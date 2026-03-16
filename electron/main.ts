/**
 * Questboard — Electron main process
 * Spawns FastAPI server, manages windows, system tray, IPC.
 */

import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, dialog } from "electron";
import path from "path";
import { serverManager } from "./server-manager";
import { tunnelManager } from "./tunnel-manager";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
const FRONTEND_DEV_URL = "http://localhost:5173";

// ─── Window Management ───────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: "Questboard",
    backgroundColor: "#1e1e2e",
    show: false, // Show after ready-to-show to avoid flash
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  if (isDev) {
    mainWindow.loadURL(`${FRONTEND_DEV_URL}/dm`);
    mainWindow.webContents.openDevTools();
  } else {
    // In production, frontend is bundled alongside the app
    const frontendPath = path.join(__dirname, "../frontend/dist/index.html");
    mainWindow.loadFile(frontendPath);
  }

  mainWindow.on("close", (e) => {
    // Minimize to tray instead of closing (on non-mac)
    if (process.platform !== "darwin" && tray) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ─── System Tray ─────────────────────────────────────────────────────

function createTray() {
  // Use a 16x16 placeholder icon — replace with real icon later
  tray = new Tray(nativeImage.createEmpty());

  const updateTrayMenu = () => {
    const status = serverManager.getStatus();
    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Open Questboard",
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          } else {
            createWindow();
          }
        },
      },
      { type: "separator" },
      {
        label: status.running
          ? `Server running on :${status.port}`
          : "Server stopped",
        enabled: false,
      },
      {
        label: "Restart Server",
        click: async () => {
          await serverManager.restart();
        },
      },
      { type: "separator" },
      {
        label: "Quit Questboard",
        click: () => {
          // Force close — bypass minimize-to-tray
          mainWindow?.removeAllListeners("close");
          app.quit();
        },
      },
    ]);
    tray?.setContextMenu(contextMenu);
  };

  tray.setToolTip("Questboard — D&D Session Manager");
  tray.on("double-click", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  updateTrayMenu();

  // Update tray menu when server status changes
  return updateTrayMenu;
}

// ─── IPC Handlers ────────────────────────────────────────────────────

function registerIpcHandlers() {
  // Server info
  ipcMain.handle("get-server-url", () => serverManager.url);
  ipcMain.handle("get-server-status", () => serverManager.getStatus());

  // Session code — fetched from the running server
  ipcMain.handle("get-session-code", async () => {
    // The session code is managed by the FastAPI server, not Electron.
    // Frontend should call the API directly. This is a convenience bridge.
    try {
      const http = require("http");
      return new Promise((resolve) => {
        const req = http.get(`${serverManager.url}/api/auth/session`, { timeout: 2000 }, (res: any) => {
          let data = "";
          res.on("data", (chunk: string) => (data += chunk));
          res.on("end", () => {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve(null);
            }
          });
        });
        req.on("error", () => resolve(null));
      });
    } catch {
      return null;
    }
  });

  // Campaign folder picker
  ipcMain.handle("select-campaign-folder", async () => {
    const result = await dialog.showOpenDialog({
      title: "Select Campaign Root Folder",
      properties: ["openDirectory", "createDirectory"],
      defaultPath: app.getPath("documents"),
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle("get-campaign-root", () => {
    return process.env.QUESTBOARD_CAMPAIGN_ROOT ?? path.join(app.getPath("home"), "DnD Sessions");
  });

  // Tunnel management
  ipcMain.handle("start-tunnel", async () => {
    const status = await tunnelManager.start(serverManager.port);
    return { url: status.url, error: status.error };
  });

  ipcMain.handle("stop-tunnel", async () => {
    await tunnelManager.stop();
    return { ok: true };
  });

  ipcMain.handle("get-tunnel-url", () => tunnelManager.url);

  // App info
  ipcMain.handle("get-version", () => app.getVersion());
}

// ─── App Lifecycle ───────────────────────────────────────────────────

app.whenReady().then(async () => {
  registerIpcHandlers();
  const updateTrayMenu = createTray();

  // Start the FastAPI server
  try {
    await serverManager.start({
      onStatus: () => updateTrayMenu(),
    });
    console.log(`[Main] Server ready at ${serverManager.url}`);
  } catch (err) {
    console.error("[Main] Failed to start server:", err);
    // Still show the window — it can display an error state
  }

  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // Don't quit — keep running in tray
    // The "Quit" menu item handles actual quit
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on("before-quit", async () => {
  console.log("[Main] Shutting down...");
  await tunnelManager.stop();
  await serverManager.stop();
});
