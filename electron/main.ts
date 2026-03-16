/**
 * Questboard — Electron main process
 * Spawns FastAPI server, manages windows, system tray.
 */

import { app, BrowserWindow, Tray, Menu, nativeImage } from "electron";
import path from "path";

// Will be implemented fully in Issue #2 and #3
// For now, just the shell that opens the frontend

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
const FRONTEND_DEV_URL = "http://localhost:5173";
const SERVER_PORT = 7777;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: "Questboard",
    backgroundColor: "#1e1e2e",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL(`${FRONTEND_DEV_URL}/dm`);
    mainWindow.webContents.openDevTools();
  } else {
    // In production, serve from built frontend
    mainWindow.loadFile(path.join(__dirname, "../frontend/dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray() {
  // Placeholder — will use proper icon in Issue #2
  tray = new Tray(nativeImage.createEmpty());
  const contextMenu = Menu.buildFromTemplate([
    { label: "Open Questboard", click: () => mainWindow?.show() },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);
  tray.setToolTip("Questboard");
  tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
