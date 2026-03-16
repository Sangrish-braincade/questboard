/**
 * Questboard — Shared TypeScript types
 */

// ─── Auth & Session ──────────────────────────────────────────────────

export type Role = "dm" | "player";

export interface AuthToken {
  token: string;
  role: Role;
  name: string;
  sessionCode: string;
  campaign: string;
}

export interface SessionInfo {
  code: string;
  campaign: string;
  dmName: string;
  players: PlayerInfo[];
  locked: boolean;
  createdAt: string;
}

export interface PlayerInfo {
  name: string;
  joinedAt: string;
  characterName?: string;
}

// ─── Campaign ────────────────────────────────────────────────────────

export interface Campaign {
  name: string;
  folderName: string;
  path: string;
  description: string;
  createdAt: string;
  system: string;
  sessionCount: number;
  playerCount: number;
}

export interface CampaignDetail extends Campaign {
  maps: AssetFile[];
  tokens: AssetFile[];
  handouts: AssetFile[];
  audio: AssetFile[];
}

export interface AssetFile {
  name: string;
  path: string;
  sizeBytes: number;
  modified: string;
}

// ─── WebSocket Messages ──────────────────────────────────────────────

export type WSMessageType =
  | "chat"
  | "whisper"
  | "dice_roll"
  | "dice_result"
  | "token_move"
  | "token_add"
  | "token_remove"
  | "fog_update"
  | "combat_start"
  | "combat_next_turn"
  | "combat_damage"
  | "combat_end"
  | "music_play"
  | "music_stop"
  | "character_update"
  | "speech_transcript"
  | "handout_reveal"
  | "player_join"
  | "player_leave"
  | "error";

export interface WSMessage {
  type: WSMessageType;
  from?: string;
  data: Record<string, unknown>;
}

// ─── Chat ────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  type: "chat" | "whisper" | "system" | "dice";
  from: string;
  content: string;
  target?: string; // for whispers
  timestamp: number;
}

// ─── Dice ────────────────────────────────────────────────────────────

export interface DiceRoll {
  notation: string; // e.g. "2d6+3"
  results: number[];
  modifier: number;
  total: number;
  rolledBy: string;
  label?: string; // e.g. "Attack Roll"
}

// ─── Combat ──────────────────────────────────────────────────────────

export interface CombatState {
  active: boolean;
  round: number;
  turnIndex: number;
  initiative: InitiativeEntry[];
}

export interface InitiativeEntry {
  name: string;
  initiative: number;
  hp: number;
  maxHp: number;
  ac: number;
  isNpc: boolean;
  conditions: string[];
}

// ─── Map & Tokens ────────────────────────────────────────────────────

export interface MapState {
  mapId: string | null;
  mapUrl: string | null;
  gridType: "square" | "hex";
  gridSizeFt: number;
  tokens: TokenState[];
  fogRegions: FogRegion[];
}

export interface TokenState {
  id: string;
  name: string;
  imageUrl: string;
  x: number;
  y: number;
  size: number; // grid squares
  hp?: number;
  maxHp?: number;
  visible: boolean;
  ownerId?: string;
}

export interface FogRegion {
  id: string;
  points: { x: number; y: number }[];
  revealed: boolean;
}

// ─── Electron Bridge ─────────────────────────────────────────────────

export interface QuestboardBridge {
  getServerUrl: () => Promise<string>;
  getSessionCode: () => Promise<SessionInfo | null>;
  startTunnel: () => Promise<{ url: string | null; error?: string }>;
  stopTunnel: () => Promise<{ ok: boolean }>;
  getTunnelUrl: () => Promise<string | null>;
  selectCampaignFolder: () => Promise<string | null>;
  getCampaignRoot: () => Promise<string>;
  getVersion: () => Promise<string>;
  getPlatform: () => string;
}

declare global {
  interface Window {
    questboard?: QuestboardBridge;
  }
}
