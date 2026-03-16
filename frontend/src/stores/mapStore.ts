/**
 * Questboard — Map/Token store
 * Tracks current map, tokens, fog of war.
 */

import { create } from "zustand";
import type { MapState, TokenState, FogRegion } from "@/types";

interface MapStore extends MapState {
  loadMap: (mapId: string, mapUrl: string) => void;
  unloadMap: () => void;

  // Token management
  addToken: (token: TokenState) => void;
  removeToken: (id: string) => void;
  moveToken: (id: string, x: number, y: number) => void;
  updateToken: (id: string, updates: Partial<TokenState>) => void;

  // Fog of war
  addFogRegion: (region: FogRegion) => void;
  revealFog: (id: string) => void;
  setFogRegions: (regions: FogRegion[]) => void;

  // Bulk sync from server
  syncTokens: (tokens: TokenState[]) => void;
}

const initialMap: MapState = {
  mapId: null,
  mapUrl: null,
  gridType: "square",
  gridSizeFt: 5,
  tokens: [],
  fogRegions: [],
};

export const useMapStore = create<MapStore>((set) => ({
  ...initialMap,

  loadMap: (mapId, mapUrl) =>
    set({ mapId, mapUrl, tokens: [], fogRegions: [] }),

  unloadMap: () => set(initialMap),

  addToken: (token) =>
    set((s) => ({ tokens: [...s.tokens, token] })),

  removeToken: (id) =>
    set((s) => ({ tokens: s.tokens.filter((t) => t.id !== id) })),

  moveToken: (id, x, y) =>
    set((s) => ({
      tokens: s.tokens.map((t) => (t.id === id ? { ...t, x, y } : t)),
    })),

  updateToken: (id, updates) =>
    set((s) => ({
      tokens: s.tokens.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),

  addFogRegion: (region) =>
    set((s) => ({ fogRegions: [...s.fogRegions, region] })),

  revealFog: (id) =>
    set((s) => ({
      fogRegions: s.fogRegions.map((r) =>
        r.id === id ? { ...r, revealed: true } : r
      ),
    })),

  setFogRegions: (regions) => set({ fogRegions: regions }),

  syncTokens: (tokens) => set({ tokens }),
}));
