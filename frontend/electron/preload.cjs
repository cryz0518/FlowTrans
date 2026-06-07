const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("flowtransDesktop", {
  openFloatingWindow: () => ipcRenderer.invoke("floating:open"),
  closeFloatingWindow: () => ipcRenderer.invoke("floating:close"),
});
