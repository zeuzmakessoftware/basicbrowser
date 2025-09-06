const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("appWindow", {
  minimize: () => ipcRenderer.send("win:minimize"),
  maximizeToggle: () => ipcRenderer.send("win:maximizeToggle"),
  close: () => ipcRenderer.send("win:close"),
  isDark: () => ipcRenderer.invoke("theme:isDark"),
  onWindowState: (cb) => ipcRenderer.on("win:state", (_e, s) => cb(s)) // optional
});
