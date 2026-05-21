const { contextBridge, ipcRenderer } = require("electron");

const api = {
  inventory: {
    load: () => ipcRenderer.invoke("inventory:load"),
    importLegacy: () => ipcRenderer.invoke("inventory:import-legacy"),
    create: (data) => ipcRenderer.invoke("inventory:create", data),
    update: (data) => ipcRenderer.invoke("inventory:update", data),
    delete: (id) => ipcRenderer.invoke("inventory:delete", id),
    renameFolder: (data) => ipcRenderer.invoke("inventory:rename-folder", data),
    folders: () => ipcRenderer.invoke("inventory:folders"),
  },
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    save: (s) => ipcRenderer.invoke("settings:save", s),
  },
  backup: {
    export: (options) => ipcRenderer.invoke("backup:export", options),
    preview: () => ipcRenderer.invoke("backup:preview"),
    apply: (bundle, options) =>
      ipcRenderer.invoke("backup:apply", { bundle, options }),
  },
  updater: {
    check: () => ipcRenderer.invoke("updater:check"),
    onDownloaded: (cb) => {
      const handler = () => cb();
      ipcRenderer.on("updater:downloaded", handler);
      return () => ipcRenderer.removeListener("updater:downloaded", handler);
    },
  },
  keywords: {
    load: () => ipcRenderer.invoke("keywords:load"),
    save: (rules) => ipcRenderer.invoke("keywords:save", rules),
  },
  ssh: {
    connect: (sessionId) => ipcRenderer.invoke("ssh:connect", sessionId),
    write: (pid, data) => ipcRenderer.send("ssh:write", pid, data),
    resize: (pid, cols, rows) => ipcRenderer.send("ssh:resize", pid, cols, rows),
    close: (pid) => ipcRenderer.send("ssh:close", pid),
    reloadColors: () => ipcRenderer.invoke("colors:reload"),
    onData: (pid, cb) => {
      const channel = `ssh:data:${pid}`;
      const handler = (_evt, data) => cb(data);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
    onClose: (pid, cb) => {
      const channel = `ssh:close:${pid}`;
      const handler = () => cb();
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
    onMetrics: (pid, cb) => {
      const channel = `ssh:metrics:${pid}`;
      const handler = (_evt, m) => cb(m);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
  },
};

contextBridge.exposeInMainWorld("api", api);
