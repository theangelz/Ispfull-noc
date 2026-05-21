import { app, ipcMain, dialog, BrowserWindow } from "electron";
import electronUpdater from "electron-updater";
const { autoUpdater } = electronUpdater;

let mainWindowRef: () => BrowserWindow | null = () => null;

export function registerUpdaterHandlers(getWindow: () => BrowserWindow | null) {
  mainWindowRef = getWindow;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = {
    info: (m: any) => console.log("[updater]", m),
    warn: (m: any) => console.warn("[updater]", m),
    error: (m: any) => console.error("[updater]", m),
    debug: (m: any) => console.debug("[updater]", m),
  } as any;

  autoUpdater.on("update-downloaded", () => {
    const win = mainWindowRef();
    win?.webContents.send("updater:downloaded");
    dialog
      .showMessageBox({
        type: "info",
        buttons: ["Reiniciar agora", "Depois"],
        defaultId: 0,
        title: "Atualização baixada",
        message: "SJNET NOC foi atualizado. Reiniciar para aplicar?",
      })
      .then((r) => {
        if (r.response === 0) autoUpdater.quitAndInstall();
      });
  });

  autoUpdater.on("error", (err) => {
    console.error("[updater] error:", err);
  });

  ipcMain.handle("updater:check", async () => {
    if (!app.isPackaged) {
      return {
        currentVersion: app.getVersion(),
        updateAvailable: false,
        error: "dev mode — auto-update só funciona no app empacotado",
      };
    }
    try {
      autoUpdater.setFeedURL({
        provider: "github",
        owner: "theangelz",
        repo: "Ispfull-noc",
      });
      const r = await autoUpdater.checkForUpdates();
      const currentVersion = app.getVersion();
      const latestVersion = r?.updateInfo?.version ?? currentVersion;
      const updateAvailable = latestVersion !== currentVersion;
      return { currentVersion, updateAvailable, version: latestVersion };
    } catch (err: any) {
      return {
        currentVersion: app.getVersion(),
        updateAvailable: false,
        error: err?.message ?? String(err),
      };
    }
  });
}
