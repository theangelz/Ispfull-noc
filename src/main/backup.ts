import { app, dialog, ipcMain } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { loadSettings, saveSettings, type AppSettings } from "./settings.js";
import { getSessionPassword } from "./inventory.js";
import { encryptPassword } from "./secrets.js";
import type { SshSession } from "../shared/types.js";

export interface BackupBundle {
  version: 1;
  exportedAt: string;
  appVersion: string;
  sessions?: SshSessionWithPassword[];
  settings?: AppSettings;
  colorRules?: {
    ciscoWords: string | null;
    labHighlights: string | null;
  };
}

interface SshSessionWithPassword extends SshSession {
  password?: string;
}

export interface ExportOptions {
  selectedSessionIds: string[]; // [] = nenhum; toda a lista = tudo
  includePasswords: boolean;
  includeSettings: boolean;
  includeColorRules: boolean;
}

export interface ImportOptions {
  selectedSessionIds: string[];
  importPasswords: boolean;
  importSettings: boolean;
  importColorRules: boolean;
  mode: "merge" | "replace"; // merge soma; replace zera as locais
}

interface DiskRecord {
  id: string;
  path: string;
  name: string;
  folder: string;
  host: string;
  port: number;
  user: string;
  protocol?: "ssh" | "telnet";
  encryptedPassword?: string;
}

async function readRecords(): Promise<DiskRecord[]> {
  const p = path.join(app.getPath("userData"), "sessions.json");
  try {
    return JSON.parse(await fs.readFile(p, "utf-8"));
  } catch {
    return [];
  }
}

async function writeRecords(s: DiskRecord[]): Promise<void> {
  const p = path.join(app.getPath("userData"), "sessions.json");
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(s, null, 2));
}

export function registerBackupHandlers() {
  ipcMain.handle(
    "backup:export",
    async (_evt, options: ExportOptions) => {
      const result = await dialog.showSaveDialog({
        title: "Exportar config SJNET NOC",
        defaultPath: `sjnet-noc-backup-${new Date()
          .toISOString()
          .slice(0, 19)
          .replace(/[:T]/g, "-")}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (result.canceled || !result.filePath) return { ok: false };

      const records = await readRecords();
      const sessions: SshSession[] = records.map((r) => ({
        id: r.id,
        path: r.path,
        name: r.name,
        folder: r.folder,
        host: r.host,
        port: r.port,
        user: r.user,
        protocol: r.protocol,
        hasPassword: !!r.encryptedPassword,
      }));
      const selected = sessions.filter((s) =>
        options.selectedSessionIds.includes(s.id)
      );
      const bundle: BackupBundle = {
        version: 1,
        exportedAt: new Date().toISOString(),
        appVersion: app.getVersion(),
      };

      if (selected.length > 0) {
        bundle.sessions = await Promise.all(
          selected.map(async (s) => {
            const out: SshSessionWithPassword = { ...s };
            if (options.includePasswords && s.hasPassword) {
              const pw = await getSessionPassword(s.path);
              if (pw) out.password = pw;
            }
            return out;
          })
        );
      }

      if (options.includeSettings) {
        bundle.settings = await loadSettings();
      }

      if (options.includeColorRules) {
        const homedir = (await import("node:os")).homedir();
        const kwDir = path.join(
          homedir,
          "Library/Application Support/VanDyke/SecureCRT/Config/Keywords"
        );
        const readSafe = async (fn: string) => {
          try {
            return await fs.readFile(path.join(kwDir, fn), "utf-8");
          } catch {
            return null;
          }
        };
        bundle.colorRules = {
          ciscoWords: await readSafe("Cisco Words.ini"),
          labHighlights: await readSafe("Lab Highlights.ini"),
        };
      }

      await fs.writeFile(
        result.filePath,
        JSON.stringify(bundle, null, 2),
        "utf-8"
      );
      return { ok: true, path: result.filePath, sessionCount: selected.length };
    }
  );

  ipcMain.handle("backup:preview", async () => {
    const result = await dialog.showOpenDialog({
      title: "Importar config SJNET NOC",
      filters: [{ name: "JSON", extensions: ["json"] }],
      properties: ["openFile"],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    try {
      const raw = await fs.readFile(result.filePaths[0], "utf-8");
      const bundle: BackupBundle = JSON.parse(raw);
      return { filePath: result.filePaths[0], bundle };
    } catch (e: any) {
      return { error: e?.message ?? "arquivo inválido" };
    }
  });

  ipcMain.handle(
    "backup:apply",
    async (
      _evt,
      data: { bundle: BackupBundle; options: ImportOptions }
    ) => {
      const { bundle, options } = data;
      let importedSessions = 0;

      if (bundle.sessions) {
        const current = options.mode === "replace" ? [] : await readRecords();
        for (const s of bundle.sessions) {
          if (!options.selectedSessionIds.includes(s.id)) continue;
          const idx = current.findIndex((c) => c.id === s.id);
          const rec: DiskRecord = {
            id: s.id,
            path: s.path,
            name: s.name,
            folder: s.folder,
            host: s.host,
            port: s.port,
            user: s.user,
            protocol: (s as any).protocol,
          };
          if (options.importPasswords && s.password) {
            const enc = encryptPassword(s.password);
            if (enc) rec.encryptedPassword = enc;
          }
          if (idx >= 0) current[idx] = rec;
          else current.push(rec);
          importedSessions++;
        }
        await writeRecords(current);
      }

      if (options.importSettings && bundle.settings) {
        await saveSettings(bundle.settings);
      }

      if (options.importColorRules && bundle.colorRules) {
        const homedir = (await import("node:os")).homedir();
        const kwDir = path.join(
          homedir,
          "Library/Application Support/VanDyke/SecureCRT/Config/Keywords"
        );
        await fs.mkdir(kwDir, { recursive: true });
        if (bundle.colorRules.ciscoWords) {
          await fs.writeFile(
            path.join(kwDir, "Cisco Words.ini"),
            bundle.colorRules.ciscoWords,
            "utf-8"
          );
        }
        if (bundle.colorRules.labHighlights) {
          await fs.writeFile(
            path.join(kwDir, "Lab Highlights.ini"),
            bundle.colorRules.labHighlights,
            "utf-8"
          );
        }
      }

      return { ok: true, importedSessions };
    }
  );
}
