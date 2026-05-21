import { app, ipcMain } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import {
  encryptPassword,
  decryptPassword,
  getKeychainPasswordLegacy,
  keychainHasPasswordLegacy,
} from "./secrets.js";
import type { SshSession } from "../shared/types.js";

const LEGACY_INVENTORY = path.join(
  os.homedir(),
  ".config/ssh-launcher/sessions.json"
);

function appInventoryPath() {
  return path.join(app.getPath("userData"), "sessions.json");
}

// Versão em disco da sessão (inclui encryptedPassword opcional)
interface SessionRecord extends Omit<SshSession, "hasPassword"> {
  encryptedPassword?: string;
}

interface LegacySession {
  path: string;
  name?: string;
  folder?: string;
  host?: string;
  port?: number;
  user?: string;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function loadRecords(): Promise<SessionRecord[]> {
  const p = appInventoryPath();
  if (!(await fileExists(p))) return [];
  try {
    const raw = await fs.readFile(p, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveRecords(records: SessionRecord[]): Promise<void> {
  const p = appInventoryPath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(records, null, 2), "utf-8");
}

function toSession(rec: SessionRecord): SshSession {
  const { encryptedPassword, ...rest } = rec;
  return {
    ...rest,
    hasPassword: !!encryptedPassword,
  };
}

// Tenta primeiro o encryptedPassword no record. Se não tiver, cai no Keychain
// legacy do Mac (compat com sessões importadas do ssh-launcher antigo).
export async function getSessionPassword(
  sessionPath: string
): Promise<string | null> {
  const records = await loadRecords();
  const rec = records.find((r) => r.path === sessionPath);
  if (rec?.encryptedPassword) {
    const pw = decryptPassword(rec.encryptedPassword);
    if (pw) return pw;
  }
  // Fallback: Keychain do Mac (legacy)
  return await getKeychainPasswordLegacy(sessionPath);
}

export async function importLegacyInventory(): Promise<{ imported: number }> {
  if (!(await fileExists(LEGACY_INVENTORY))) return { imported: 0 };

  const existing = await loadRecords();
  if (existing.length > 0) return { imported: 0 };

  const raw = await fs.readFile(LEGACY_INVENTORY, "utf-8");
  const legacy: LegacySession[] = JSON.parse(raw);

  const records: SessionRecord[] = [];
  for (const s of legacy) {
    if (!s.path || !s.host) continue;
    // Se tem senha no Keychain legacy, migra pro safeStorage do app
    let encryptedPassword: string | undefined;
    const legacyPw = await getKeychainPasswordLegacy(s.path);
    if (legacyPw) {
      const enc = encryptPassword(legacyPw);
      if (enc) encryptedPassword = enc;
    }
    records.push({
      id: s.path,
      path: s.path,
      name: s.name ?? s.path.split("/").pop() ?? s.path,
      folder: s.folder ?? s.path.split("/").slice(0, -1).join("/"),
      host: s.host,
      port: s.port ?? 22,
      user: s.user ?? "admin",
      protocol: "ssh",
      ...(encryptedPassword ? { encryptedPassword } : {}),
    });
  }

  await saveRecords(records);
  return { imported: records.length };
}

export function registerInventoryHandlers() {
  ipcMain.handle("inventory:load", async (): Promise<SshSession[]> => {
    const records = await loadRecords();
    return records.map(toSession);
  });

  ipcMain.handle("inventory:import-legacy", async () => {
    return await importLegacyInventory();
  });

  ipcMain.handle(
    "inventory:create",
    async (
      _evt,
      data: {
        name: string;
        folder: string;
        host: string;
        port: number;
        user: string;
        password?: string;
        protocol?: "ssh" | "telnet";
      }
    ) => {
      const records = await loadRecords();
      const id = randomUUID();
      const sessPath = data.folder ? `${data.folder}/${data.name}` : data.name;
      let finalPath = sessPath;
      let suffix = 1;
      while (records.find((r) => r.path === finalPath)) {
        finalPath = `${sessPath}-${suffix++}`;
      }
      const newRec: SessionRecord = {
        id,
        path: finalPath,
        name: data.name,
        folder: data.folder,
        host: data.host,
        port: data.port,
        user: data.user,
        protocol: data.protocol ?? "ssh",
      };
      if (data.password) {
        const enc = encryptPassword(data.password);
        if (enc) newRec.encryptedPassword = enc;
      }
      records.push(newRec);
      await saveRecords(records);
      return toSession(newRec);
    }
  );

  ipcMain.handle(
    "inventory:update",
    async (
      _evt,
      data: {
        id: string;
        name: string;
        folder: string;
        host: string;
        port: number;
        user: string;
        password?: string;
        clearPassword?: boolean;
        protocol?: "ssh" | "telnet";
      }
    ) => {
      const records = await loadRecords();
      const idx = records.findIndex((r) => r.id === data.id);
      if (idx < 0) return null;
      const old = records[idx];
      const newPath = data.folder ? `${data.folder}/${data.name}` : data.name;

      let encryptedPassword = old.encryptedPassword;
      if (data.clearPassword) {
        encryptedPassword = undefined;
      } else if (data.password) {
        const enc = encryptPassword(data.password);
        if (enc) encryptedPassword = enc;
      }

      const updated: SessionRecord = {
        ...old,
        path: newPath,
        name: data.name,
        folder: data.folder,
        host: data.host,
        port: data.port,
        user: data.user,
        protocol: data.protocol ?? old.protocol ?? "ssh",
        ...(encryptedPassword ? { encryptedPassword } : {}),
      };
      if (!encryptedPassword) delete updated.encryptedPassword;

      records[idx] = updated;
      await saveRecords(records);
      return toSession(updated);
    }
  );

  ipcMain.handle("inventory:delete", async (_evt, id: string) => {
    const records = await loadRecords();
    const filtered = records.filter((r) => r.id !== id);
    await saveRecords(filtered);
    return true;
  });

  ipcMain.handle(
    "inventory:rename-folder",
    async (_evt, data: { oldFolder: string; newFolder: string }) => {
      const records = await loadRecords();
      let moved = 0;
      for (const r of records) {
        if (
          r.folder === data.oldFolder ||
          r.folder.startsWith(data.oldFolder + "/")
        ) {
          r.folder = data.newFolder + r.folder.slice(data.oldFolder.length);
          r.path = r.folder ? `${r.folder}/${r.name}` : r.name;
          moved++;
        }
      }
      await saveRecords(records);
      return moved;
    }
  );

  ipcMain.handle("inventory:folders", async () => {
    const records = await loadRecords();
    const set = new Set<string>();
    for (const r of records) {
      if (r.folder) set.add(r.folder);
    }
    return Array.from(set).sort();
  });
}

// Compat exports (usado pelo backup.ts e ssh.ts antigos)
export const getKeychainPassword = getSessionPassword;
export { keychainHasPasswordLegacy };
