/**
 * SpellAoE — Renders spell Area of Effect overlays on the battle map canvas.
 * Supports: sphere, cone, cube, line, cylinder.
 * Renders as semi-transparent colored shapes with animated edges.
 */

const GRID_SIZE_PX = 64;
const AOE_OPACITY = 0.25;
const AOE_BORDER_OPACITY = 0.6;

export interface AoEShape {
  type: "sphere" | "cone" | "cube" | "line" | "cylinder";
  originX: number; // grid coords
  originY: number;
  sizeFt: number; // radius for sphere/cylinder, length for cone/line/cube
  widthFt?: number; // only for line
  rotation?: number; // degrees, for cone/line direction
  color: string; // hex color
}

/**
 * Draw an AoE shape on a 2D canvas context.
 * Call this from inside the BattleMap render loop (after tokens, before UI).
 */
export function drawAoE(ctx: CanvasRenderingContext2D, aoe: AoEShape) {
  const gridPx = GRID_SIZE_PX;
  const ft2px = gridPx / 5; // 5ft per grid square

  const cx = (aoe.originX + 0.5) * gridPx; // center of grid cell
  const cy = (aoe.originY + 0.5) * gridPx;
  const radiusPx = (aoe.sizeFt / 2) * ft2px;
  const sizePx = aoe.sizeFt * ft2px;

  ctx.save();

  switch (aoe.type) {
    case "sphere":
    case "cylinder": {
      const r = (aoe.sizeFt / 2) * ft2px;
      // Fill
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(aoe.color, AOE_OPACITY);
      ctx.fill();
      // Border
      ctx.strokeStyle = hexToRgba(aoe.color, AOE_BORDER_OPACITY);
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      // Range rings (every 5ft)
      ctx.strokeStyle = hexToRgba(aoe.color, 0.1);
      ctx.lineWidth = 1;
      for (let ring = gridPx; ring < r; ring += gridPx) {
        ctx.beginPath();
        ctx.arc(cx, cy, ring, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }

    case "cone": {
      const length = aoe.sizeFt * ft2px;
      const angle = ((aoe.rotation ?? 0) * Math.PI) / 180;
      const halfAngle = Math.PI / 6; // 53-degree cone (D&D standard)

      ctx.translate(cx, cy);
      ctx.rotate(angle);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, length, -halfAngle, halfAngle);
      ctx.closePath();

      ctx.fillStyle = hexToRgba(aoe.color, AOE_OPACITY);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(aoe.color, AOE_BORDER_OPACITY);
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    }

    case "cube": {
      const half = (aoe.sizeFt * ft2px) / 2;
      ctx.fillStyle = hexToRgba(aoe.color, AOE_OPACITY);
      ctx.fillRect(cx - half, cy - half, half * 2, half * 2);
      ctx.strokeStyle = hexToRgba(aoe.color, AOE_BORDER_OPACITY);
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(cx - half, cy - half, half * 2, half * 2);
      ctx.setLineDash([]);
      break;
    }

    case "line": {
      const length = aoe.sizeFt * ft2px;
      const width = ((aoe.widthFt ?? 5) * ft2px) / 2;
      const angle = ((aoe.rotation ?? 0) * Math.PI) / 180;

      ctx.translate(cx, cy);
      ctx.rotate(angle);

      ctx.fillStyle = hexToRgba(aoe.color, AOE_OPACITY);
      ctx.fillRect(0, -width, length, width * 2);
      ctx.strokeStyle = hexToRgba(aoe.color, AOE_BORDER_OPACITY);
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(0, -width, length, width * 2);
      ctx.setLineDash([]);
      break;
    }
  }

  ctx.restore();

  // Label
  ctx.fillStyle = hexToRgba(aoe.color, 0.8);
  ctx.font = "11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${aoe.sizeFt}ft`, cx, cy - (aoe.sizeFt * ft2px) / 2 - 8);
}

/**
 * Convert a hex color + alpha to rgba string.
 */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─── Spell Color Map ─────────────────────────────────────────────────

export const DAMAGE_TYPE_COLORS: Record<string, string> = {
  fire: "#ff4500",
  cold: "#00bfff",
  lightning: "#ffff00",
  thunder: "#8b4513",
  poison: "#32cd32",
  acid: "#7fff00",
  necrotic: "#4b0082",
  radiant: "#ffd700",
  force: "#9370db",
  psychic: "#ff69b4",
};

export function getSpellColor(damageType: string | null | undefined): string {
  if (!damageType) return "#6366f1"; // default indigo
  return DAMAGE_TYPE_COLORS[damageType.toLowerCase()] ?? "#6366f1";
}
