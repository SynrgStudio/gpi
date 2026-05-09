import { contextBridge, ipcRenderer } from "electron";
import type { GpiWorkspaceSnapshot } from "../domain/types.js";
import type { GpiPiEvent } from "../bridge/pi-bridge.js";

const versions = {
  node: process.versions.node,
  chrome: process.versions.chrome,
  electron: process.versions.electron,
};

contextBridge.exposeInMainWorld("gpi", {
  versions,
  getWorkspaceSnapshot: () => ipcRenderer.invoke("gpi:get-workspace-snapshot") as Promise<GpiWorkspaceSnapshot>,
  createSession: (projectId: string) => ipcRenderer.invoke("gpi:create-session", projectId) as Promise<{ id: string }>,
  openSession: (sessionPath: string) => ipcRenderer.invoke("gpi:open-session", sessionPath) as Promise<{ id: string }>,
  prompt: (sessionHandleId: string, text: string) => ipcRenderer.invoke("gpi:prompt", sessionHandleId, text) as Promise<{ ok: true }>,
  abort: (sessionHandleId: string) => ipcRenderer.invoke("gpi:abort", sessionHandleId) as Promise<{ ok: true }>,
  onPiEvent: (listener: (event: GpiPiEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, piEvent: GpiPiEvent) => listener(piEvent);
    ipcRenderer.on("gpi:pi-event", handler);
    return () => ipcRenderer.off("gpi:pi-event", handler);
  },
});
