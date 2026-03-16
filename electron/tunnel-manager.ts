/**
 * Questboard — Tunnel manager
 * Wraps Cloudflare Tunnel (cloudflared) or fallback to ngrok
 * to expose the local FastAPI server to remote players.
 */

import { ChildProcess, spawn } from "child_process";
import { app } from "electron";
import path from "path";
import fs from "fs";

export interface TunnelStatus {
  running: boolean;
  provider: "cloudflare" | "ngrok" | null;
  url: string | null;
  error: string | null;
}

type TunnelProvider = "cloudflare" | "ngrok";

class TunnelManager {
  private process: ChildProcess | null = null;
  private _url: string | null = null;
  private _provider: TunnelProvider | null = null;
  private _error: string | null = null;

  get url(): string | null {
    return this._url;
  }

  get isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  getStatus(): TunnelStatus {
    return {
      running: this.isRunning,
      provider: this._provider,
      url: this._url,
      error: this._error,
    };
  }

  /**
   * Start a tunnel to expose the given local port.
   * Tries cloudflared first, falls back to ngrok.
   */
  async start(port: number): Promise<TunnelStatus> {
    if (this.isRunning) {
      return this.getStatus();
    }

    this._error = null;
    this._url = null;

    // Try cloudflared first
    const cfPath = this.findBinary("cloudflared");
    if (cfPath) {
      try {
        await this.startCloudflare(cfPath, port);
        return this.getStatus();
      } catch (err) {
        console.warn("[TunnelManager] Cloudflare tunnel failed, trying ngrok:", err);
      }
    }

    // Fallback to ngrok
    const ngrokPath = this.findBinary("ngrok");
    if (ngrokPath) {
      try {
        await this.startNgrok(ngrokPath, port);
        return this.getStatus();
      } catch (err) {
        this._error = `Both tunnel providers failed. Last error: ${err}`;
      }
    }

    if (!cfPath && !ngrokPath) {
      this._error =
        "No tunnel provider found. Install cloudflared or ngrok for remote play.";
    }

    return this.getStatus();
  }

  /**
   * Start cloudflared quick tunnel (no account needed).
   */
  private startCloudflare(binaryPath: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Cloudflare tunnel startup timed out"));
      }, 30000);

      this.process = spawn(
        binaryPath,
        ["tunnel", "--url", `http://127.0.0.1:${port}`],
        { stdio: ["ignore", "pipe", "pipe"], windowsHide: true }
      );

      this._provider = "cloudflare";

      // cloudflared prints the URL to stderr
      let output = "";
      const extractUrl = (data: Buffer) => {
        output += data.toString();
        // Look for the trycloudflare.com URL
        const match = output.match(
          /https:\/\/[a-z0-9-]+\.trycloudflare\.com/
        );
        if (match) {
          this._url = match[0];
          clearTimeout(timeout);
          console.log(`[TunnelManager] Cloudflare tunnel: ${this._url}`);
          resolve();
        }
      };

      this.process.stderr?.on("data", extractUrl);
      this.process.stdout?.on("data", extractUrl);

      this.process.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      this.process.on("exit", (code) => {
        if (!this._url) {
          clearTimeout(timeout);
          reject(new Error(`cloudflared exited with code ${code}`));
        }
        this._url = null;
        this.process = null;
      });
    });
  }

  /**
   * Start ngrok tunnel.
   */
  private startNgrok(binaryPath: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("ngrok tunnel startup timed out"));
      }, 30000);

      this.process = spawn(binaryPath, ["http", String(port), "--log=stdout"], {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });

      this._provider = "ngrok";

      let output = "";
      this.process.stdout?.on("data", (data: Buffer) => {
        output += data.toString();
        // ngrok prints url= in its log output
        const match = output.match(/url=(https?:\/\/[^\s]+)/);
        if (match) {
          this._url = match[1];
          clearTimeout(timeout);
          console.log(`[TunnelManager] ngrok tunnel: ${this._url}`);
          resolve();
        }
      });

      this.process.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      this.process.on("exit", (code) => {
        if (!this._url) {
          clearTimeout(timeout);
          reject(new Error(`ngrok exited with code ${code}`));
        }
        this._url = null;
        this.process = null;
      });
    });
  }

  /**
   * Stop the tunnel process.
   */
  async stop(): Promise<void> {
    if (!this.process) return;

    console.log("[TunnelManager] Stopping tunnel...");

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.process?.kill("SIGKILL");
        resolve();
      }, 5000);

      this.process!.on("exit", () => {
        clearTimeout(timeout);
        this.process = null;
        this._url = null;
        this._provider = null;
        resolve();
      });

      if (process.platform === "win32") {
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
   * Find a binary — checks PATH, bundled resources, and common install locations.
   */
  private findBinary(name: string): string | null {
    const isWin = process.platform === "win32";
    const ext = isWin ? ".exe" : "";
    const fullName = `${name}${ext}`;

    // Check bundled in app resources
    if (app.isPackaged) {
      const bundled = path.join(process.resourcesPath, "bin", fullName);
      if (fs.existsSync(bundled)) return bundled;
    }

    // Check common install paths
    const searchPaths = isWin
      ? [
          path.join(
            process.env.LOCALAPPDATA ?? "",
            "Programs",
            name,
            fullName
          ),
          path.join("C:\\Program Files", name, fullName),
          path.join("C:\\Program Files (x86)", name, fullName),
        ]
      : [
          `/usr/local/bin/${name}`,
          `/usr/bin/${name}`,
          path.join(process.env.HOME ?? "", `.${name}`, name),
        ];

    for (const p of searchPaths) {
      if (p && fs.existsSync(p)) return p;
    }

    // Rely on PATH
    return fullName;
  }
}

export const tunnelManager = new TunnelManager();
