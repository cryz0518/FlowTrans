const { BrowserWindow, app } = require("electron");
const path = require("node:path");

const isDev = process.env.VITE_DEV_SERVER_URL !== undefined;
const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? "http://127.0.0.1:5173";

let mainWindow = null;

function appUrl() {
  if (isDev) {
    return devServerUrl;
  }
  return new URL(`file://${path.join(__dirname, "../dist/index.html")}`).toString();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  attachWindowDiagnostics(mainWindow);
  mainWindow.loadURL(appUrl());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function attachWindowDiagnostics(window) {
  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedUrl) => {
    console.error(`[main] failed to load ${validatedUrl}: ${errorCode} ${errorDescription}`);
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    console.error("[main] render process gone", details);
  });
  window.webContents.on("console-message", (_event, level, message) => {
    if (level >= 2) {
      console.error(`[main] renderer console: ${message}`);
    }
  });
}

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
