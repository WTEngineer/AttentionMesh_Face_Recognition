const { app, BrowserWindow } = require("electron");
const path = require("path");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      webSecurity: false, // ⚠️ Disable security (for local dev only)
      contextIsolation: false,
      enableRemoteModule: true,
    },
  });

  mainWindow.loadFile("src/index.html");

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
