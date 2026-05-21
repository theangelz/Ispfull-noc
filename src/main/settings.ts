import { app, ipcMain } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

export interface AppSettings {
  colorizationEnabled: boolean;
  fontSize: number;
  fontFamily: string;
  cursorBlink: boolean;
  scrollback: number;
  monitorEnabled: boolean;
  monitorIntervalSec: number;
}

const DEFAULTS: AppSettings = {
  colorizationEnabled: true,
  fontSize: 13,
  fontFamily: "JetBrains Mono",
  cursorBlink: true,
  scrollback: 10000,
  monitorEnabled: true,
  monitorIntervalSec: 5,
};

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await fs.readFile(settingsPath(), "utf-8");
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveSettings(s: AppSettings): Promise<void> {
  const p = settingsPath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(s, null, 2), "utf-8");
}

let cached: AppSettings | null = null;

export async function getSettings(): Promise<AppSettings> {
  if (!cached) cached = await loadSettings();
  return cached;
}

export function registerSettingsHandlers() {
  ipcMain.handle("settings:get", async () => {
    return await getSettings();
  });
  ipcMain.handle("settings:save", async (_evt, s: AppSettings) => {
    cached = s;
    await saveSettings(s);
    return true;
  });
}
