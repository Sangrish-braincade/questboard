/**
 * Questboard — FastAPI sidecar manager
 * Spawns the Python/uvicorn server as a child process,
 * monitors health, and handles graceful shutdown.
 */

import { ChildProcess, spawn } from "child_process";
import path from "path";
import http from "http";
import { app } from "electron";

export interface ServerStatus {
  running: boolean;
  port: number;
  pid: number | null;
  url: string;
}

const SERVER_PORT = 7777;
const HEALTH_CHECK_INTERVAL = 5000; // ms
const STARTUP_TIMEOUT = 15000; // ms
const HEALTH_ENDPOINT = "/health";

class ServerManager {
  private process: ChildProcess | null = null;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private _port: number = SERVER_PORT;
  private _ready = false;
  private onStatusChange: ((status: ServerStatus) => void) | null = null;

  get port(): number {
    return this._port;
  }

  get url(): string {
    return `http://127.0.0.1:${this._port}`;
  }

  get wsUrl(): string {
    return `ws://127.0.0.1:${this._port}`;
  }

  get isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  get isReady(): boolean {
    return this._ready;
  }

  /**
   * Find the Python executable — checks venv first, then system.
   */
  private findPython(): string {
    const serverDir = this.getServerDir();
    const isWin = process.platform === "win32";

    // Check for venv inside server/
    const venvPython = isWin
      ? path.join(serverDir, ".venv", "Scripts", "python.exe")
      : path.join(serverDir, ".venv", "bin", "python");

    try {
      const fs = require("fs");
      if (fs.existsSync(venvPython)) {
        return venvPython;
      }
    } catch {
      // fall through
    }

    // Fallback to system Python
    return isWin ? "python" : "python3";
  }

  /**
   * Check if a frozen (PyInstaller) server exe exists.
   */
  private findFrozenServer(): string | null {
    const fs = require("fs");
    const isWin = process.platform === "win32";
    const exeName = isWin ? "questboard-server.exe" : "questboard-server";

    // In packaged app: check extraResources
    if (app.isPackaged) {
      const frozenPath = path.join(process.resourcesPath, "questboard-server", exeName);
      if (fs.existsSync(frozenPath)) return frozenPath;
    }

    // Dev mode: check server/dist/
    const devFrozen = path.join(this.getServerDir(), "dist", "questboard-server", exeName);
    if (fs.existsSync(devFrozen)) return devFrozen;

    return null;
  }

  /**
   * Get the server directory path.
   * In dev: <project-root>/server
   * In prod: <resources>/server (bundled with electron-builder extraResources)
   */
  private getServerDir(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, "server");
    }
    // Dev mode — server directory is sibling to electron/
    return path.join(__dirname, "..", "server");
  }

  /**
   * Start the FastAPI server as a child process.
   * Uses frozen exe if available, falls back to Python + uvicorn.
   */
  async start(opts?: {
    port?: number;
    campaignRoot?: string;
    onStatus?: (status: ServerStatus) => void;
  }): Promise<void> {
    if (this.isRunning) {
      console.log("[ServerManager] Server already running");
      return;
    }

    this._port = opts?.port ?? SERVER_PORT;
    this.onStatusChange = opts?.onStatus ?? null;

    const serverDir = this.getServerDir();
    const frozenExe = this.findFrozenServer();

    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      QUESTBOARD_PORT: String(this._port),
      QUESTBOARD_HOST: "127.0.0.1",
    };

    if (opts?.campaignRoot) {
      env.QUESTBOARD_CAMPAIGN_ROOT = opts.campaignRoot;
    }

    let spawnCmd: string;
    let spawnArgs: string[];
    let spawnCwd: string;

    if (frozenExe) {
      // Use frozen PyInstaller exe — no Python needed!
      spawnCmd = frozenExe;
      spawnArgs = [];
      spawnCwd = path.dirname(frozenExe);
      console.log(`[ServerManager] Using frozen server: ${frozenExe}`);
    } else {
      // Fallback: use Python + uvicorn
      spawnCmd = this.findPython();
      spawnArgs = [
        "-m", "uvicorn", "app.main:app",
        "--host", "127.0.0.1",
        "--port", String(this._port),
        "--log-level", "info",
      ];
      spawnCwd = serverDir;
      console.log(`[ServerManager] Using Python: ${spawnCmd}`);
    }

    console.log(`[ServerManager] Server dir: ${spawnCwd}`);
    console.log(`[ServerManager] Port: ${this._port}`);

    this.process = spawn(spawnCmd, spawnArgs, {
      cwd: spawnCwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    // Pipe stdout/stderr to main process console
    this.process.stdout?.on("data", (data: Buffer) => {
      const lines = data.toString().trim();
      if (lines) console.log(`[Server] ${lines}`);
    });

    this.process.stderr?.on("data", (data: Buffer) => {
      const lines = data.toString().trim();
      if (lines) console.log(`[Server:err] ${lines}`);
    });

    this.process.on("exit", (code, signal) => {
      console.log(
        `[ServerManager] Server exited (code=${code}, signal=${signal})`
      );
      this._ready = false;
      this.process = null;
      this.stopHealthCheck();
      this.emitStatus();
    });

    this.process.on("error", (err) => {
      console.error(`[ServerManager] Failed to start server:`, err);
      this._ready = false;
      this.process = null;
    });

    // Wait for server to become ready
    await this.waitForReady();
    this.startHealthCheck();
  }

  /**
   * Poll the health endpoint until the server responds or timeout.
   */
  private waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const check = () => {
        if (!this.isRunning) {
          reject(new Error("Server process died during startup"));
          return;
        }

        if (Date.now() - startTime > STARTUP_TIMEOUT) {
          reject(new Error("Server startup timed out"));
          return;
        }

        this.healthCheck()
          .then((ok) => {
            if (ok) {
              console.log("[ServerManager] Server is ready!");
              this._ready = true;
              this.emitStatus();
              resolve();
            } else {
              setTimeout(check, 500);
            }
          })
          .catch(() => setTimeout(check, 500));
      };

      // Give the process a moment to start
      setTimeout(check, 800);
    });
  }

  /**
   * Hit the /health endpoint.
   */
  private healthCheck(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(
        `${this.url}${HEALTH_ENDPOINT}`,
        { timeout: 2000 },
        (res) => {
          resolve(res.statusCode === 200);
        }
      );
      req.on("error", () => resolve(false));
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  /**
   * Periodic health monitoring after startup.
   */
  private startHealthCheck() {
    this.stopHealthCheck();
    this.healthTimer = setInterval(async () => {
      const ok = await this.healthCheck();
      if (!ok && this._ready) {
        console.warn("[ServerManager] Health check failed!");
        this._ready = false;
        this.emitStatus();
      } else if (ok && !this._ready) {
        this._ready = true;
        this.emitStatus();
      }
    }, HEALTH_CHECK_INTERVAL);
  }

  private stopHealthCheck() {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }

  /**
   * Gracefully stop the server.
   */
  async stop(): Promise<void> {
    this.stopHealthCheck();

    if (!this.process) {
      return;
    }

    console.log("[ServerManager] Stopping server...");

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        // Force kill if graceful shutdown takes too long
        console.warn("[ServerManager] Force killing server");
        this.process?.kill("SIGKILL");
        resolve();
      }, 5000);

      this.process!.on("exit", () => {
        clearTimeout(timeout);
        this.process = null;
        this._ready = false;
        this.emitStatus();
        resolve();
      });

      // Send SIGTERM for graceful shutdown
      if (process.platform === "win32") {
        // On Windows, SIGTERM doesn't work properly — use taskkill
        const pid = this.process!.pid;
        if (pid) {
          spawn("taskkill", ["/pid", String(pid), "/f", "/t"], {
            windowsHide: true,
          });
        }
      } else {
        this.process!.kill("SIGTERM");
      }
    });
  }

  /**
   * Restart the server.
   */
  async restart(): Promise<void> {
    await this.stop();
    await this.start({ port: this._port });
  }

  /**
   * Get current server status.
   */
  getStatus(): ServerStatus {
    return {
      running: this.isRunning,
      port: this._port,
      pid: this.process?.pid ?? null,
      url: this.url,
    };
  }

  private emitStatus() {
    if (this.onStatusChange) {
      this.onStatusChange(this.getStatus());
    }
  }
}

export const serverManager = new ServerManager();
