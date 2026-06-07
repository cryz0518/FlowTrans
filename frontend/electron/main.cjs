const { BrowserWindow, app, desktopCapturer, session } = require("electron");
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
  const url = appUrl();
  console.log(`[main] loading ${url}`);
  mainWindow.loadURL(url);
  if (process.env.ELECTRON_OPEN_DEVTOOLS === "1") {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
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
  configureMediaPermissions();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

function configureMediaPermissions() {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === "media" || permission === "display-capture");
  });
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ["screen"] });
      const screen = sources[0];
      if (!screen) {
        callback({});
        return;
      }

      callback({
        video: screen,
        audio: process.platform === "win32" ? "loopback" : undefined,
      });
    } catch (error) {
      console.error("[main] failed to resolve display media", error);
      callback({});
    }
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

module.exports = {
  appUrl,
  configureMediaPermissions,
};
