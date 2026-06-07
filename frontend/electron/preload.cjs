const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("flowtransDesktop", {
  openFloatingWindow: () => ipcRenderer.invoke("floating:open"),
  closeFloatingWindow: () => ipcRenderer.invoke("floating:close"),
  sendFloatingSubtitles: (snapshot) => ipcRenderer.invoke("floating:subtitles", snapshot),
  onFloatingSubtitles: (listener) => {
    const handler = (_event, snapshot) => listener(snapshot);
    ipcRenderer.on("floating:subtitles", handler);
    return () => ipcRenderer.off("floating:subtitles", handler);
  },
});
