const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("flowtransDesktop", {
  openFloatingWindow: () => ipcRenderer.invoke("floating:open"),
  closeFloatingWindow: () => ipcRenderer.invoke("floating:close"),
  sendFloatingSubtitles: (snapshot) => ipcRenderer.invoke("floating:subtitles", snapshot),
  sendFloatingControlState: (state) => ipcRenderer.invoke("floating:control-state", state),
  sendFloatingControlCommand: (command) => ipcRenderer.invoke("floating:control-command", command),
  onFloatingSubtitles: (listener) => {
    const handler = (_event, snapshot) => listener(snapshot);
    ipcRenderer.on("floating:subtitles", handler);
    return () => ipcRenderer.off("floating:subtitles", handler);
  },
  onFloatingControlState: (listener) => {
    const handler = (_event, state) => listener(state);
    ipcRenderer.on("floating:control-state", handler);
    return () => ipcRenderer.off("floating:control-state", handler);
  },
  onFloatingControlCommand: (listener) => {
    const handler = (_event, command) => listener(command);
    ipcRenderer.on("floating:control-command", handler);
    return () => ipcRenderer.off("floating:control-command", handler);
  },
});
