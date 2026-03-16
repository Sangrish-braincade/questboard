/**
 * Questboard — Electron preload script
 * Exposes safe IPC bridge to renderer process.
 */

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("questboard", {
  // Server management
  getServerUrl: () => ipcRenderer.invoke("get-server-url"),
  getSessionCode: () => ipcRenderer.invoke("get-session-code"),

  // Tunnel management
  startTunnel: () => ipcRenderer.invoke("start-tunnel"),
  stopTunnel: () => ipcRenderer.invoke("stop-tunnel"),
  getTunnelUrl: () => ipcRenderer.invoke("get-tunnel-url"),

  // Campaign management
  selectCampaignFolder: () => ipcRenderer.invoke("select-campaign-folder"),
  getCampaignRoot: () => ipcRenderer.invoke("get-campaign-root"),

  // App info
  getVersion: () => ipcRenderer.invoke("get-version"),
  getPlatform: () => process.platform,
});
