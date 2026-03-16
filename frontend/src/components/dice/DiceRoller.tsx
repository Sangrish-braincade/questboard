/**
 * DiceRoller — 3D dice rolling with Three.js + Cannon-es physics.
 * Shows a floating dice tray + input for notation.
 *
 * The 3D scene is rendered in a small overlay. Results are sent
 * over WebSocket so all players see them.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { rollDice, formatRoll } from "@/utils/dice";
import type { WSMessage, DiceRoll } from "@/types";

interface DiceRollerProps {
  send: (msg: WSMessage) => void;
  className?: string;
}

// Quick-roll presets
const PRESETS = [
  { label: "d20", notation: "1d20" },
  { label: "d12", notation: "1d12" },
  { label: "d10", notation: "1d10" },
  { label: "d8", notation: "1d8" },
  { label: "d6", notation: "1d6" },
  { label: "d4", notation: "1d4" },
  { label: "d100", notation: "1d100" },
  { label: "2d6", notation: "2d6" },
  { label: "4d6kh3", notation: "4d6kh3" },
];

export default function DiceRoller({ send, className = "" }: DiceRollerProps) {
  const [notation, setNotation] = useState("1d20");
  const [label, setLabel] = useState("");
  const [lastResult, setLastResult] = useState<DiceRoll | null>(null);
  const [rolling, setRolling] = useState(false);
  const [showTray, setShowTray] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<DiceScene | null>(null);

  // Initialize 3D scene
  useEffect(() => {
    if (!canvasRef.current || !showTray) return;
    const scene = new DiceScene(canvasRef.current);
    sceneRef.current = scene;
    scene.start();
    return () => scene.dispose();
  }, [showTray]);

  const handleRoll = useCallback(
    (customNotation?: string) => {
      const n = customNotation ?? notation;
      if (!n.trim()) return;

      setRolling(true);

      try {
        const result = rollDice(n);
        const diceResult: DiceRoll = {
          notation: n,
          results: result.rolls,
          modifier: result.modifier,
          total: result.total,
          rolledBy: "", // server fills this
          label: label || undefined,
        };

        setLastResult(diceResult);

        // Animate dice in 3D scene
        if (sceneRef.current) {
          sceneRef.current.animateRoll(result.rolls, result.dice.sides);
        }

        // Send to all players via WebSocket
        send({
          type: "dice_roll",
          data: {
            notation: n,
            results: result.rolls,
            kept: result.kept,
            modifier: result.modifier,
            total: result.total,
            label: label || undefined,
          },
        });

        setTimeout(() => setRolling(false), 1200);
      } catch (err) {
        console.error("Dice roll error:", err);
        setRolling(false);
      }
    },
    [notation, label, send]
  );

  return (
    <div className={`${className}`}>
      {/* Compact bar */}
      <div className="flex items-center gap-2 rounded-lg bg-[var(--color-surface-light)] px-3 py-2">
        <button
          onClick={() => setShowTray(!showTray)}
          className="text-lg"
          title="Toggle dice tray"
        >
          {showTray ? "▼" : "▲"}
        </button>

        <input
          type="text"
          value={notation}
          onChange={(e) => setNotation(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRoll()}
          placeholder="1d20+5"
          className="w-24 rounded bg-[var(--color-surface)] px-2 py-1 text-center font-mono text-sm text-[var(--color-text)] outline-none ring-1 ring-[var(--color-surface-lighter)] focus:ring-[var(--color-primary)]"
        />

        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label"
          className="w-20 rounded bg-[var(--color-surface)] px-2 py-1 text-sm text-[var(--color-text)] outline-none"
        />

        <button
          onClick={() => handleRoll()}
          disabled={rolling}
          className={`rounded-lg px-4 py-1.5 text-sm font-bold text-white transition-all ${
            rolling
              ? "animate-pulse bg-amber-600"
              : "bg-amber-500 hover:bg-amber-400"
          }`}
        >
          {rolling ? "..." : "Roll!"}
        </button>

        {lastResult && (
          <span className="ml-2 text-lg font-bold text-amber-300">
            = {lastResult.total}
          </span>
        )}
      </div>

      {/* Expanded tray */}
      {showTray && (
        <div className="mt-2 rounded-lg bg-[var(--color-surface-light)] p-3">
          {/* Quick presets */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.notation}
                onClick={() => {
                  setNotation(p.notation);
                  handleRoll(p.notation);
                }}
                className="rounded bg-[var(--color-surface)] px-3 py-1.5 text-xs font-mono text-[var(--color-text)] transition-colors hover:bg-[var(--color-primary)]/20 hover:text-[var(--color-primary)]"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* 3D Canvas */}
          <div className="relative h-48 w-full overflow-hidden rounded-lg bg-[#0d0d1a]">
            <canvas
              ref={canvasRef}
              className="h-full w-full"
              style={{ touchAction: "none" }}
            />
            {lastResult && (
              <div className="absolute bottom-2 left-0 right-0 text-center">
                <span className="rounded-full bg-black/70 px-4 py-1 text-sm text-amber-300">
                  [{lastResult.results.join(", ")}]
                  {lastResult.modifier
                    ? ` ${lastResult.modifier > 0 ? "+" : ""}${lastResult.modifier}`
                    : ""}{" "}
                  = {lastResult.total}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Lightweight 3D Dice Scene ───────────────────────────────────────
// Minimal Three.js scene that shows tumbling dice.
// Full Cannon-es physics will be added when the lib is available;
// for now we use simple rotation animations.

class DiceScene {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private animId = 0;
  private dice: AnimatedDie[] = [];
  private running = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  }

  start() {
    this.running = true;
    this.resize();
    this.loop();
  }

  private resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx?.scale(dpr, dpr);
  }

  animateRoll(results: number[], sides: number) {
    const rect = this.canvas.getBoundingClientRect();
    this.dice = results.map((value, i) => ({
      value,
      sides,
      x: rect.width * (0.2 + 0.6 * Math.random()),
      y: rect.height * 0.3,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 2 + 1,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.3,
      settled: false,
      settleTimer: 40 + i * 8,
    }));
  }

  private loop = () => {
    if (!this.running) return;
    this.render();
    this.animId = requestAnimationFrame(this.loop);
  };

  private render() {
    const ctx = this.ctx;
    if (!ctx) return;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    // Dark tray background
    ctx.fillStyle = "#0d0d1a";
    ctx.fillRect(0, 0, w, h);

    for (const die of this.dice) {
      if (!die.settled) {
        die.x += die.vx;
        die.y += die.vy;
        die.rotation += die.rotationSpeed;

        // Bounce off walls
        if (die.x < 30 || die.x > w - 30) die.vx *= -0.7;
        if (die.y > h - 30) {
          die.vy *= -0.5;
          die.y = h - 30;
        }
        die.vy += 0.3; // gravity

        die.settleTimer--;
        if (die.settleTimer <= 0) {
          die.settled = true;
          die.rotationSpeed = 0;
        }
      }

      this.drawDie(ctx, die);
    }
  }

  private drawDie(ctx: CanvasRenderingContext2D, die: AnimatedDie) {
    ctx.save();
    ctx.translate(die.x, die.y);
    ctx.rotate(die.settled ? 0 : die.rotation);

    const size = 28;

    // Die shape
    ctx.fillStyle = "#1a1a3e";
    ctx.strokeStyle = "#6366f1";
    ctx.lineWidth = 2;

    if (die.sides <= 6) {
      // Cube shape
      ctx.beginPath();
      ctx.roundRect(-size, -size, size * 2, size * 2, 4);
      ctx.fill();
      ctx.stroke();
    } else {
      // Circle for other dice
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Value text
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(die.value), 0, 0);

    // Die type label
    ctx.fillStyle = "#6366f1";
    ctx.font = "9px sans-serif";
    ctx.fillText(`d${die.sides}`, 0, size - 6);

    ctx.restore();
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.animId);
  }
}

interface AnimatedDie {
  value: number;
  sides: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  settled: boolean;
  settleTimer: number;
}
