/**
 * BattleMap — Pixi.js WebGL canvas with grid, pan/zoom, and token rendering.
 * This is the core visual component of Questboard.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { useMapStore } from "@/stores/mapStore";
import type { TokenState } from "@/types";

// ─── Constants ───────────────────────────────────────────────────────

const GRID_SIZE_PX = 64; // pixels per grid square (at zoom 1)
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_SPEED = 0.001;
const GRID_LINE_COLOR = "rgba(255, 255, 255, 0.15)";
const GRID_LINE_WIDTH = 1;
const TOKEN_BORDER = 2;
const TOKEN_HP_BAR_HEIGHT = 6;

// ─── Types ───────────────────────────────────────────────────────────

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

interface DragState {
  active: boolean;
  startX: number;
  startY: number;
  startViewX: number;
  startViewY: number;
  tokenId: string | null; // null = panning the map, string = dragging a token
  tokenStartX: number;
  tokenStartY: number;
}

interface BattleMapProps {
  isDm: boolean;
  onTokenMove?: (tokenId: string, gridX: number, gridY: number) => void;
  onTokenSelect?: (token: TokenState | null) => void;
  className?: string;
}

// ─── Component ───────────────────────────────────────────────────────

export default function BattleMap({
  isDm,
  onTokenMove,
  onTokenSelect,
  className = "",
}: BattleMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const viewportRef = useRef<Viewport>({ x: 0, y: 0, zoom: 1 });
  const dragRef = useRef<DragState>({
    active: false,
    startX: 0,
    startY: 0,
    startViewX: 0,
    startViewY: 0,
    tokenId: null,
    tokenStartX: 0,
    tokenStartY: 0,
  });

  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);

  // Token images cache
  const tokenImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const { mapUrl, tokens, fogRegions, gridSizeFt } = useMapStore();

  // ─── Load Map Image ──────────────────────────────────────────────

  useEffect(() => {
    if (!mapUrl) {
      setMapImage(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setMapImage(img);
    img.onerror = () => console.error("[BattleMap] Failed to load map image");

    // mapUrl can be a data:uri (b64 from server) or a regular URL
    if (mapUrl.startsWith("data:")) {
      img.src = mapUrl;
    } else {
      img.src = mapUrl;
    }
  }, [mapUrl]);

  // ─── Load Token Images ───────────────────────────────────────────

  useEffect(() => {
    const cache = tokenImagesRef.current;
    for (const token of tokens) {
      if (token.imageUrl && !cache.has(token.imageUrl)) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => cache.set(token.imageUrl, img);
        img.src = token.imageUrl;
      }
    }
  }, [tokens]);

  // ─── Canvas Helpers ──────────────────────────────────────────────

  const screenToWorld = useCallback(
    (sx: number, sy: number): [number, number] => {
      const v = viewportRef.current;
      return [(sx - v.x) / v.zoom, (sy - v.y) / v.zoom];
    },
    []
  );

  const worldToGrid = useCallback(
    (wx: number, wy: number): [number, number] => {
      return [Math.floor(wx / GRID_SIZE_PX), Math.floor(wy / GRID_SIZE_PX)];
    },
    []
  );

  const findTokenAt = useCallback(
    (wx: number, wy: number): TokenState | null => {
      // Iterate in reverse so topmost tokens are picked first
      for (let i = tokens.length - 1; i >= 0; i--) {
        const t = tokens[i]!;
        if (!t.visible && !isDm) continue;
        const tx = t.x * GRID_SIZE_PX;
        const ty = t.y * GRID_SIZE_PX;
        const ts = t.size * GRID_SIZE_PX;
        if (wx >= tx && wx < tx + ts && wy >= ty && wy < ty + ts) {
          return t;
        }
      }
      return null;
    },
    [tokens, isDm]
  );

  // ─── Render Loop ─────────────────────────────────────────────────

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    const v = viewportRef.current;

    // Clear
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.scale(v.zoom, v.zoom);

    // Draw map image
    if (mapImage) {
      ctx.drawImage(mapImage, 0, 0);
    }

    // Draw grid
    const gridPx = GRID_SIZE_PX;
    const [startX] = worldToGrid(-v.x / v.zoom, -v.y / v.zoom);
    const [startY] = worldToGrid(-v.x / v.zoom, -v.y / v.zoom);
    const endX = startX + Math.ceil(width / (gridPx * v.zoom)) + 2;
    const endY = startY + Math.ceil(height / (gridPx * v.zoom)) + 2;

    // Calculate visible grid bounds properly
    const visStartX = Math.floor(-v.x / (v.zoom * gridPx));
    const visStartY = Math.floor(-v.y / (v.zoom * gridPx));
    const visEndX = visStartX + Math.ceil(width / (gridPx * v.zoom)) + 2;
    const visEndY = visStartY + Math.ceil(height / (gridPx * v.zoom)) + 2;

    ctx.strokeStyle = GRID_LINE_COLOR;
    ctx.lineWidth = GRID_LINE_WIDTH / v.zoom;

    ctx.beginPath();
    for (let x = visStartX; x <= visEndX; x++) {
      ctx.moveTo(x * gridPx, visStartY * gridPx);
      ctx.lineTo(x * gridPx, visEndY * gridPx);
    }
    for (let y = visStartY; y <= visEndY; y++) {
      ctx.moveTo(visStartX * gridPx, y * gridPx);
      ctx.lineTo(visEndX * gridPx, y * gridPx);
    }
    ctx.stroke();

    // Draw fog of war
    if (fogRegions.length > 0) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      for (const region of fogRegions) {
        if (region.revealed && !isDm) continue;
        if (region.points.length < 3) continue;

        ctx.beginPath();
        ctx.moveTo(
          region.points[0]!.x * gridPx,
          region.points[0]!.y * gridPx
        );
        for (let i = 1; i < region.points.length; i++) {
          ctx.lineTo(
            region.points[i]!.x * gridPx,
            region.points[i]!.y * gridPx
          );
        }
        ctx.closePath();

        if (isDm && region.revealed) {
          // DM sees revealed fog as semi-transparent
          ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
          ctx.fill();
          ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        } else {
          ctx.fill();
        }
      }
    }

    // Draw tokens
    for (const token of tokens) {
      if (!token.visible && !isDm) continue;

      const tx = token.x * gridPx;
      const ty = token.y * gridPx;
      const ts = token.size * gridPx;

      // Token background circle
      ctx.fillStyle = !token.visible ? "rgba(100, 100, 100, 0.5)" : "#4a4a6a";
      ctx.beginPath();
      ctx.arc(tx + ts / 2, ty + ts / 2, ts / 2 - 2, 0, Math.PI * 2);
      ctx.fill();

      // Token image
      const cachedImg = tokenImagesRef.current.get(token.imageUrl);
      if (cachedImg) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(tx + ts / 2, ty + ts / 2, ts / 2 - 4, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(cachedImg, tx + 2, ty + 2, ts - 4, ts - 4);
        ctx.restore();
      }

      // Selection ring
      if (token.id === selectedTokenId) {
        ctx.strokeStyle = "#ffd700";
        ctx.lineWidth = (TOKEN_BORDER + 1) / v.zoom;
        ctx.beginPath();
        ctx.arc(tx + ts / 2, ty + ts / 2, ts / 2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Name label
      ctx.fillStyle = "#ffffff";
      ctx.font = `${Math.max(11, 14 / v.zoom)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(token.name, tx + ts / 2, ty + ts + 14 / v.zoom);

      // HP bar
      if (token.hp !== undefined && token.maxHp !== undefined && token.maxHp > 0) {
        const barW = ts - 8;
        const barH = TOKEN_HP_BAR_HEIGHT / v.zoom;
        const barX = tx + 4;
        const barY = ty - barH - 4 / v.zoom;
        const ratio = Math.max(0, token.hp / token.maxHp);

        // Background
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(barX, barY, barW, barH);

        // Fill
        ctx.fillStyle =
          ratio > 0.5 ? "#22c55e" : ratio > 0.25 ? "#eab308" : "#ef4444";
        ctx.fillRect(barX, barY, barW * ratio, barH);
      }
    }

    ctx.restore();

    animFrameRef.current = requestAnimationFrame(render);
  }, [mapImage, tokens, fogRegions, isDm, selectedTokenId, worldToGrid]);

  // ─── Canvas Setup & Resize ───────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);
    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [render]);

  // ─── Mouse Event Handlers ────────────────────────────────────────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const [wx, wy] = screenToWorld(sx, sy);
      const token = findTokenAt(wx, wy);

      if (token) {
        // Start token drag (DM can drag any, player can drag their own)
        if (isDm || token.ownerId === undefined) {
          dragRef.current = {
            active: true,
            startX: sx,
            startY: sy,
            startViewX: viewportRef.current.x,
            startViewY: viewportRef.current.y,
            tokenId: token.id,
            tokenStartX: token.x,
            tokenStartY: token.y,
          };
        }
        setSelectedTokenId(token.id);
        onTokenSelect?.(token);
      } else {
        // Start map pan
        dragRef.current = {
          active: true,
          startX: sx,
          startY: sy,
          startViewX: viewportRef.current.x,
          startViewY: viewportRef.current.y,
          tokenId: null,
          tokenStartX: 0,
          tokenStartY: 0,
        };
        setSelectedTokenId(null);
        onTokenSelect?.(null);
      }
    },
    [isDm, screenToWorld, findTokenAt, onTokenSelect]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const d = dragRef.current;
      if (!d.active) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const dx = sx - d.startX;
      const dy = sy - d.startY;

      if (d.tokenId) {
        // Dragging a token — snap to grid
        const v = viewportRef.current;
        const worldDx = dx / v.zoom;
        const worldDy = dy / v.zoom;
        const newGridX = Math.round(
          d.tokenStartX + worldDx / GRID_SIZE_PX
        );
        const newGridY = Math.round(
          d.tokenStartY + worldDy / GRID_SIZE_PX
        );

        // Update store optimistically
        useMapStore.getState().moveToken(d.tokenId, newGridX, newGridY);
      } else {
        // Panning
        viewportRef.current.x = d.startViewX + dx;
        viewportRef.current.y = d.startViewY + dy;
      }
    },
    []
  );

  const handleMouseUp = useCallback(
    (_e: React.MouseEvent) => {
      const d = dragRef.current;
      if (d.active && d.tokenId) {
        // Emit final position
        const map = useMapStore.getState();
        const token = map.tokens.find((t) => t.id === d.tokenId);
        if (
          token &&
          (token.x !== d.tokenStartX || token.y !== d.tokenStartY)
        ) {
          onTokenMove?.(d.tokenId, token.x, token.y);
        }
      }
      dragRef.current.active = false;
    },
    [onTokenMove]
  );

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const v = viewportRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const oldZoom = v.zoom;
    const delta = -e.deltaY * ZOOM_SPEED;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom + delta * oldZoom));

    // Zoom toward cursor position
    v.x = mx - (mx - v.x) * (newZoom / oldZoom);
    v.y = my - (my - v.y) * (newZoom / oldZoom);
    v.zoom = newZoom;
  }, []);

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <canvas
      ref={canvasRef}
      className={`block h-full w-full cursor-grab active:cursor-grabbing ${className}`}
      style={{ touchAction: "none" }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
