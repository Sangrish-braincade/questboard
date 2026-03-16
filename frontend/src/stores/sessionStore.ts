/**
 * Questboard — Session/Auth store
 * Tracks current session, auth token, and connected players.
 */

import { create } from "zustand";
import { api } from "@/services/api";
import type { Role, PlayerInfo } from "@/types";

interface SessionState {
  // Auth
  token: string | null;
  role: Role | null;
  name: string | null;
  sessionCode: string | null;
  campaign: string | null;

  // Session info
  players: PlayerInfo[];
  locked: boolean;
  connected: boolean;

  // Actions
  hostSession: (campaign: string, dmName: string) => Promise<string>;
  joinSession: (code: string, playerName: string) => Promise<void>;
  endSession: () => Promise<void>;
  kickPlayer: (playerName: string) => Promise<void>;
  regenerateCode: () => Promise<string>;
  toggleLock: () => Promise<void>;

  // Player list management (called from WS events)
  addPlayer: (player: PlayerInfo) => void;
  removePlayer: (name: string) => void;
  setConnected: (connected: boolean) => void;
  reset: () => void;
}

const initialState = {
  token: null,
  role: null,
  name: null,
  sessionCode: null,
  campaign: null,
  players: [],
  locked: false,
  connected: false,
};

export const useSessionStore = create<SessionState>((set, get) => ({
  ...initialState,

  hostSession: async (campaign, dmName) => {
    const res = await api.post<{
      session_code: string;
      token: string;
      campaign: string;
    }>("/auth/host", {
      campaign_folder: campaign,
      dm_name: dmName,
    });

    api.setToken(res.token);
    set({
      token: res.token,
      role: "dm",
      name: dmName,
      sessionCode: res.session_code,
      campaign: res.campaign,
    });

    return res.session_code;
  },

  joinSession: async (code, playerName) => {
    const res = await api.post<{
      token: string;
      session_code: string;
      campaign: string;
      dm_name: string;
    }>("/auth/join", {
      session_code: code,
      player_name: playerName,
    });

    api.setToken(res.token);
    set({
      token: res.token,
      role: "player",
      name: playerName,
      sessionCode: res.session_code,
      campaign: res.campaign,
    });
  },

  endSession: async () => {
    const { sessionCode } = get();
    if (sessionCode) {
      await api.post(`/auth/session/${sessionCode}/end`);
    }
    api.setToken(null);
    set(initialState);
  },

  kickPlayer: async (playerName) => {
    const { sessionCode } = get();
    if (sessionCode) {
      await api.post(`/auth/session/${sessionCode}/kick`, {
        player_name: playerName,
      });
    }
  },

  regenerateCode: async () => {
    const { sessionCode } = get();
    if (!sessionCode) throw new Error("No active session");
    const res = await api.post<{ new_code: string }>(
      `/auth/session/${sessionCode}/regenerate`
    );
    set({ sessionCode: res.new_code });
    return res.new_code;
  },

  toggleLock: async () => {
    const { sessionCode, locked } = get();
    if (!sessionCode) return;
    const endpoint = locked ? "unlock" : "lock";
    await api.post(`/auth/session/${sessionCode}/${endpoint}`);
    set({ locked: !locked });
  },

  addPlayer: (player) =>
    set((s) => ({ players: [...s.players, player] })),

  removePlayer: (name) =>
    set((s) => ({ players: s.players.filter((p) => p.name !== name) })),

  setConnected: (connected) => set({ connected }),

  reset: () => {
    api.setToken(null);
    set(initialState);
  },
}));
