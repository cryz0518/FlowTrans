const assert = require("node:assert/strict");
const Module = require("node:module");
const test = require("node:test");

function loadMainWithElectronStub() {
  const windows = [];
  const ipcHandlers = new Map();
  class BrowserWindowStub {
    constructor(options) {
      this.options = options;
      this.loadedUrl = null;
      this.handlers = new Map();
      this.webContents = {
        sentMessages: [],
        openDevTools() {},
        on() {},
        send(channel, payload) {
          this.sentMessages.push({ channel, payload });
        },
      };
      windows.push(this);
    }

    loadURL(url) {
      this.loadedUrl = url;
    }

    on(event, handler) {
      this.handlers.set(event, handler);
    }

    close() {
      this.handlers.get("closed")?.();
    }

    isDestroyed() {
      return false;
    }

    setAlwaysOnTop(value, level) {
      this.alwaysOnTop = { value, level };
    }

    show() {
      this.wasShown = true;
    }
  }
  BrowserWindowStub.getAllWindows = () => windows;

  const electronStub = {
    BrowserWindow: BrowserWindowStub,
    app: {
      whenReady: () => ({ then() {} }),
      on() {},
      quit() {},
    },
    desktopCapturer: {
      getSources: async () => [],
    },
    ipcMain: {
      handle(channel, handler) {
        ipcHandlers.set(channel, handler);
      },
    },
    session: {
      defaultSession: {
        setPermissionRequestHandler() {},
        setDisplayMediaRequestHandler() {},
      },
    },
  };

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "electron") {
      return electronStub;
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  const modulePath = require.resolve("./main.cjs");
  delete require.cache[modulePath];
  const main = require("./main.cjs");
  Module._load = originalLoad;

  return { main, windows, ipcHandlers };
}

test("createFloatingWindow creates an always-on-top resizable subtitle window", () => {
  const { main, windows } = loadMainWithElectronStub();

  const floatingWindow = main.createFloatingWindow();

  assert.equal(windows.length, 1);
  assert.equal(floatingWindow.options.alwaysOnTop, true);
  assert.equal(floatingWindow.options.frame, false);
  assert.equal(floatingWindow.options.resizable, true);
  assert.equal(floatingWindow.options.skipTaskbar, true);
  assert.match(floatingWindow.loadedUrl, /floating\.html$/);
});

test("configureFloatingWindowIpc registers open and close handlers", async () => {
  const { main, ipcHandlers } = loadMainWithElectronStub();

  main.configureFloatingWindowIpc();

  assert.equal(ipcHandlers.has("floating:open"), true);
  assert.equal(ipcHandlers.has("floating:close"), true);

  await ipcHandlers.get("floating:open")();
  await ipcHandlers.get("floating:close")();
});

test("configureFloatingWindowIpc forwards subtitles to the floating window", async () => {
  const { main, ipcHandlers } = loadMainWithElectronStub();
  const snapshot = {
    current: { eventId: "event-1", displayKey: "event-1", sourceText: "Hello", translatedText: "你好" },
  };

  main.configureFloatingWindowIpc();
  const floatingWindow = main.createFloatingWindow();
  await ipcHandlers.get("floating:subtitles")({}, snapshot);

  assert.deepEqual(floatingWindow.webContents.sentMessages, [
    { channel: "floating:subtitles", payload: snapshot },
  ]);
});
