const { app, BrowserWindow, ipcMain, nativeTheme } = require("electron");
const path = require("path");

function createWindow() {
  const isMac = process.platform === "darwin";
  const win = new BrowserWindow({
    width: 1200, height: 800, minWidth: 900, minHeight: 600,
    frame: false,               // remove native bar/traffic lights
    titleBarOverlay: false,     // don’t overlay native controls
    transparent: isMac,
    backgroundColor: isMac ? "#00000000" : "#121212",
    vibrancy: isMac ? "sidebar" : undefined,
    visualEffectState: isMac ? "active" : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  });

  win.loadFile("index.html");

  // window control handlers
  ipcMain.on("win:minimize", () => win.minimize());
  ipcMain.on("win:maximizeToggle", () => win.isMaximized() ? win.unmaximize() : win.maximize());
  ipcMain.on("win:close", () => win.close());
  ipcMain.handle("theme:isDark", () => nativeTheme.shouldUseDarkColors);

  // optional: emit state to update UI styles
  const emitState = () => {
    win.webContents.send("win:state", {
      maximized: win.isMaximized(),
      fullscreen: win.isFullScreen()
    });
  };
  win.on("maximize", emitState);
  win.on("unmaximize", emitState);
  win.on("enter-full-screen", emitState);
  win.on("leave-full-screen", emitState);
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
