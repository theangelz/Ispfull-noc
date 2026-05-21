import { ipcMain, BrowserWindow } from "electron";
import { Client, type ClientChannel } from "ssh2";
import { randomUUID } from "node:crypto";
import { getSessionPassword } from "./inventory.js";
import fs from "node:fs/promises";
import path from "node:path";
import {
  loadColorRules,
  compileRules,
  processStream,
  newStreamState,
  type CompiledRule,
  type StreamState,
} from "./colorize.js";
import { getSettings } from "./settings.js";
import { TelnetClient } from "./telnet.js";
import type { SshSession } from "../shared/types.js";

interface ActiveSession {
  protocol: "ssh" | "telnet";
  client: Client | TelnetClient;
  stream: ClientChannel | null;
  sessionId: string;
  monitor?: MonitorState;
  colorState: StreamState;
}

interface MonitorState {
  client: Client;
  stream: ClientChannel | null;
  device: "ios" | "mikrotik" | "huawei" | "linux" | "unknown";
  timer: NodeJS.Timeout | null;
  buffer: string;
}

const active = new Map<string, ActiveSession>();
let cachedRules: CompiledRule[] | null = null;

async function getRules(): Promise<CompiledRule[]> {
  if (cachedRules) return cachedRules;
  const raw = await loadColorRules();
  cachedRules = compileRules(raw);
  return cachedRules;
}

async function loadSessionsRaw(): Promise<SshSession[]> {
  const { app } = await import("electron");
  const p = path.join(app.getPath("userData"), "sessions.json");
  try {
    const raw = await fs.readFile(p, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function buildSshConfig(
  sess: SshSession,
  password: string | null
): Parameters<Client["connect"]>[0] {
  const config: Parameters<Client["connect"]>[0] = {
    host: sess.host,
    port: sess.port || 22,
    username: sess.user || "admin",
    readyTimeout: 15000,
    algorithms: {
      kex: [
        "curve25519-sha256",
        "curve25519-sha256@libssh.org",
        "ecdh-sha2-nistp256",
        "ecdh-sha2-nistp384",
        "ecdh-sha2-nistp521",
        "diffie-hellman-group-exchange-sha256",
        "diffie-hellman-group14-sha256",
        "diffie-hellman-group14-sha1",
        "diffie-hellman-group1-sha1",
        "diffie-hellman-group-exchange-sha1",
      ],
      serverHostKey: [
        "ssh-ed25519",
        "ecdsa-sha2-nistp256",
        "ecdsa-sha2-nistp384",
        "ecdsa-sha2-nistp521",
        "rsa-sha2-512",
        "rsa-sha2-256",
        "ssh-rsa",
        "ssh-dss",
      ],
      cipher: [
        "aes128-gcm",
        "aes256-gcm",
        "aes128-ctr",
        "aes192-ctr",
        "aes256-ctr",
        "aes128-cbc",
        "aes256-cbc",
        "3des-cbc",
      ],
      hmac: ["hmac-sha2-256", "hmac-sha2-512", "hmac-sha1", "hmac-md5"],
    },
  };
  if (password) {
    config.password = password;
    config.tryKeyboard = true;
  }
  return config;
}

function detectDevice(text: string): MonitorState["device"] {
  if (/MikroTik|RouterOS|\[admin@/.test(text)) return "mikrotik";
  if (/Cisco|IOS Software|^\S+[>#]\s*$/im.test(text)) return "ios";
  if (/<[A-Z]\w*>|^\<.*\>$|VRP|Huawei/m.test(text)) return "huawei";
  if (/Linux|GNU|\$ $|@.*~|@.*:/m.test(text)) return "linux";
  return "unknown";
}

function monitorCommand(device: MonitorState["device"]): string {
  switch (device) {
    case "mikrotik":
      return "/system resource print\n";
    case "ios":
      return "show processes cpu | inc CPU\n";
    case "huawei":
      return "display cpu-usage\n";
    case "linux":
      return "top -bn1 | head -5 && free -m | head -2\n";
    default:
      return "";
  }
}

function parseMonitorOutput(
  device: MonitorState["device"],
  text: string
): { cpu?: number; mem?: number; memTotal?: number } | null {
  try {
    if (device === "mikrotik") {
      const cpuM = text.match(/cpu-load:\s*(\d+)%/);
      const freeM = text.match(/free-memory:\s*([\d.]+)([KMG]i?B)/);
      const totalM = text.match(/total-memory:\s*([\d.]+)([KMG]i?B)/);
      const cpu = cpuM ? parseInt(cpuM[1]) : undefined;
      const memFree = freeM ? toMB(freeM[1], freeM[2]) : undefined;
      const memTotal = totalM ? toMB(totalM[1], totalM[2]) : undefined;
      const mem =
        memFree !== undefined && memTotal !== undefined
          ? memTotal - memFree
          : undefined;
      return { cpu, mem, memTotal };
    }
    if (device === "ios") {
      const m = text.match(/CPU utilization.*?(\d+)%/);
      return m ? { cpu: parseInt(m[1]) } : null;
    }
    if (device === "huawei") {
      const m = text.match(/CPU Usage\s*:\s*(\d+)%/);
      return m ? { cpu: parseInt(m[1]) } : null;
    }
    if (device === "linux") {
      const cpuM = text.match(/%Cpu\(s\):\s*([\d.]+)\s*us,\s*([\d.]+)\s*sy/);
      const memM = text.match(/Mem:\s+(\d+)\s+(\d+)\s+(\d+)/);
      const cpu =
        cpuM ? Math.round(parseFloat(cpuM[1]) + parseFloat(cpuM[2])) : undefined;
      const memTotal = memM ? parseInt(memM[1]) : undefined;
      const memUsed = memM ? parseInt(memM[2]) : undefined;
      return { cpu, mem: memUsed, memTotal };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function toMB(numStr: string, unit: string): number {
  const n = parseFloat(numStr);
  if (unit.startsWith("K")) return n / 1024;
  if (unit.startsWith("M")) return n;
  if (unit.startsWith("G")) return n * 1024;
  return n;
}

async function startMonitor(
  pid: string,
  sess: SshSession,
  password: string | null,
  getWindow: () => BrowserWindow | null
) {
  const settings = await getSettings();
  if (!settings.monitorEnabled) return;

  const monClient = new Client();
  await new Promise<void>((resolve) => {
    monClient.on("ready", () => {
      monClient.shell({ term: "xterm-256color" }, (err, stream) => {
        if (err) {
          monClient.end();
          resolve();
          return;
        }
        const state: MonitorState = {
          client: monClient,
          stream,
          device: "unknown",
          timer: null,
          buffer: "",
        };
        let bannerTimeout: NodeJS.Timeout | null = null;
        let detected = false;
        stream.on("data", (data: Buffer) => {
          state.buffer += data.toString("utf-8");
          if (!detected && state.buffer.length > 32) {
            state.device = detectDevice(state.buffer);
            detected = true;
            if (bannerTimeout) clearTimeout(bannerTimeout);
            startPolling();
          }
        });
        stream.on("close", () => {
          if (state.timer) clearInterval(state.timer);
          monClient.end();
        });
        // Fallback se banner não dispara
        bannerTimeout = setTimeout(() => {
          if (!detected) {
            state.device = detectDevice(state.buffer);
            detected = true;
            startPolling();
          }
        }, 2000);

        const startPolling = () => {
          const cmd = monitorCommand(state.device);
          if (!cmd) return;
          const tick = () => {
            state.buffer = "";
            try {
              stream.write(cmd);
            } catch {
              if (state.timer) clearInterval(state.timer);
              return;
            }
            setTimeout(() => {
              const parsed = parseMonitorOutput(state.device, state.buffer);
              if (parsed) {
                const win = getWindow();
                win?.webContents.send(`ssh:metrics:${pid}`, {
                  device: state.device,
                  ...parsed,
                });
              }
            }, 1500);
          };
          tick();
          state.timer = setInterval(tick, settings.monitorIntervalSec * 1000);
        };

        const a = active.get(pid);
        if (a) a.monitor = state;
        resolve();
      });
    });
    monClient.on("error", () => resolve());
    monClient.connect(buildSshConfig(sess, password));
  });
}

export function registerSshHandlers(
  getWindow: () => BrowserWindow | null
): void {
  ipcMain.handle("ssh:connect", async (_evt, sessionId: string) => {
    const sessions = await loadSessionsRaw();
    const sess = sessions.find((s) => s.id === sessionId);
    if (!sess) return { ok: false, error: "session not found" };

    const pid = randomUUID();
    const settings = await getSettings();
    const rules = settings.colorizationEnabled ? await getRules() : [];
    const password = await getSessionPassword(sess.path);
    const protocol = sess.protocol === "telnet" ? "telnet" : "ssh";
    const win = getWindow();

    if (protocol === "telnet") {
      // ─────────── TELNET ───────────
      const tn = new TelnetClient({
        host: sess.host,
        port: sess.port || 23,
        timeoutMs: 15000,
      });
      const colorState = newStreamState();
      return await new Promise<{ ok: boolean; error?: string; pid?: string }>(
        (resolve) => {
          let resolved = false;
          tn.on("data", (data: Buffer) => {
            const text = data.toString("utf-8");
            const out = processStream(text, colorState, rules);
            win?.webContents.send(`ssh:data:${pid}`, out);
          });
          tn.on("close", () => {
            win?.webContents.send(`ssh:close:${pid}`);
            active.delete(pid);
          });
          tn.on("error", (err: Error) => {
            if (!resolved) {
              resolved = true;
              resolve({ ok: false, error: err.message });
            }
          });
          tn.connect()
            .then(() => {
              active.set(pid, {
                protocol: "telnet",
                client: tn,
                stream: null,
                sessionId,
                colorState,
              });
              if (!resolved) {
                resolved = true;
                resolve({ ok: true, pid });
              }
              // Acorda devices que ficam mudos esperando input (MikroTik, alguns IOS)
              setTimeout(() => {
                try { tn.write("\r"); } catch {}
              }, 600);
            })
            .catch((err) => {
              if (!resolved) {
                resolved = true;
                resolve({ ok: false, error: err?.message ?? String(err) });
              }
            });
        }
      );
    }

    // ─────────── SSH ───────────
    const client = new Client();
    return await new Promise<{ ok: boolean; error?: string; pid?: string }>(
      (resolve) => {
        client.on("ready", () => {
          client.shell({ term: "xterm-256color" }, (err, stream) => {
            if (err) {
              client.end();
              resolve({ ok: false, error: err.message });
              return;
            }
            const colorState = newStreamState();
            stream.on("data", (data: Buffer) => {
              const text = data.toString("utf-8");
              const out = processStream(text, colorState, rules);
              win?.webContents.send(`ssh:data:${pid}`, out);
            });
            stream.stderr.on("data", (data: Buffer) => {
              const text = data.toString("utf-8");
              const out = processStream(text, colorState, rules);
              win?.webContents.send(`ssh:data:${pid}`, out);
            });
            stream.on("close", () => {
              const a = active.get(pid);
              if (a?.monitor) {
                if (a.monitor.timer) clearInterval(a.monitor.timer);
                try { a.monitor.client.end(); } catch {}
              }
              win?.webContents.send(`ssh:close:${pid}`);
              client.end();
              active.delete(pid);
            });
            active.set(pid, {
              protocol: "ssh",
              client,
              stream,
              sessionId,
              colorState,
            });
            resolve({ ok: true, pid });
            // Acorda devices que ficam mudos esperando input (MikroTik, alguns IOS)
            setTimeout(() => {
              try { stream.write("\r"); } catch {}
            }, 600);
            startMonitor(pid, sess, password, getWindow).catch(() => {});
          });
        });

        client.on("error", (err) => {
          resolve({ ok: false, error: err.message });
        });

        const config = buildSshConfig(sess, password);
        client.on("keyboard-interactive", (_n, _i, _l, _p, finish) => {
          if (password) finish([password]);
          else finish([]);
        });

        client.connect(config);
      }
    );
  });

  ipcMain.on("ssh:write", (_evt, pid: string, data: string) => {
    const sess = active.get(pid);
    if (!sess) return;
    if (sess.protocol === "telnet") {
      (sess.client as TelnetClient).write(data);
    } else if (sess.stream) {
      sess.stream.write(data);
    }
  });

  ipcMain.on(
    "ssh:resize",
    (_evt, pid: string, cols: number, rows: number) => {
      const sess = active.get(pid);
      if (!sess) return;
      if (sess.protocol === "telnet") {
        (sess.client as TelnetClient).setWindow(rows, cols);
      } else if (sess.stream) {
        sess.stream.setWindow(rows, cols, 0, 0);
      }
    }
  );

  ipcMain.on("ssh:close", (_evt, pid: string) => {
    const sess = active.get(pid);
    if (!sess) return;
    if (sess.monitor) {
      if (sess.monitor.timer) clearInterval(sess.monitor.timer);
      try { sess.monitor.client.end(); } catch {}
    }
    if (sess.protocol === "telnet") {
      try { (sess.client as TelnetClient).end(); } catch {}
    } else {
      try { sess.stream?.end(); } catch {}
      try { (sess.client as Client).end(); } catch {}
    }
    active.delete(pid);
  });

  ipcMain.handle("colors:reload", async () => {
    cachedRules = null;
    const rules = await getRules();
    return rules.length;
  });
}

export function closeAllSshSessions(): void {
  for (const [, sess] of active) {
    if (sess.monitor) {
      if (sess.monitor.timer) clearInterval(sess.monitor.timer);
      try { sess.monitor.client.end(); } catch {}
    }
    if (sess.protocol === "telnet") {
      try { (sess.client as TelnetClient).end(); } catch {}
    } else {
      try { sess.stream?.end(); } catch {}
      try { (sess.client as Client).end(); } catch {}
    }
  }
  active.clear();
}
