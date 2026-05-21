import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerSshHandlers, closeAllSshSessions } from "./ssh.js";
import {
  registerInventoryHandlers,
  importLegacyInventory,
} from "./inventory.js";
import { registerSettingsHandlers } from "./settings.js";
import { registerBackupHandlers } from "./backup.js";
import { registerUpdaterHandlers } from "./updater.js";
import { registerKeywordHandlers } from "./keywords.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDev = process.env.NODE_ENV === "development";

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    backgroundColor: "#050505",
    title: "SJNET NOC",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    await mainWindow.loadURL("http://localhost:5173");
    // DevTools só sob demanda — abre com Cmd+Option+I se precisar
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  registerSshHandlers(() => mainWindow);
  registerInventoryHandlers();
  registerSettingsHandlers();
  registerBackupHandlers();
  registerUpdaterHandlers(() => mainWindow);
  registerKeywordHandlers();

  // Import legacy ssh-launcher inventory on first launch
  await importLegacyInventory();

  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  closeAllSshSessions();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  closeAllSshSessions();
});
