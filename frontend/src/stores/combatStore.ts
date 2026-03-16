/**
 * Questboard — Combat tracker store
 */

import { create } from "zustand";
import type { CombatState, InitiativeEntry } from "@/types";

interface CombatStore extends CombatState {
  startCombat: (initiative: InitiativeEntry[]) => void;
  nextTurn: () => void;
  applyDamage: (name: string, damage: number) => void;
  applyHealing: (name: string, healing: number) => void;
  addCondition: (name: string, condition: string) => void;
  removeCondition: (name: string, condition: string) => void;
  endCombat: () => void;
  syncState: (state: CombatState) => void;
}

const initialCombat: CombatState = {
  active: false,
  round: 0,
  turnIndex: 0,
  initiative: [],
};

export const useCombatStore = create<CombatStore>((set) => ({
  ...initialCombat,

  startCombat: (initiative) =>
    set({
      active: true,
      round: 1,
      turnIndex: 0,
      initiative: [...initiative].sort((a, b) => b.initiative - a.initiative),
    }),

  nextTurn: () =>
    set((s) => {
      const nextIndex = s.turnIndex + 1;
      if (nextIndex >= s.initiative.length) {
        return { turnIndex: 0, round: s.round + 1 };
      }
      return { turnIndex: nextIndex };
    }),

  applyDamage: (name, damage) =>
    set((s) => ({
      initiative: s.initiative.map((e) =>
        e.name === name ? { ...e, hp: Math.max(0, e.hp - damage) } : e
      ),
    })),

  applyHealing: (name, healing) =>
    set((s) => ({
      initiative: s.initiative.map((e) =>
        e.name === name ? { ...e, hp: Math.min(e.maxHp, e.hp + healing) } : e
      ),
    })),

  addCondition: (name, condition) =>
    set((s) => ({
      initiative: s.initiative.map((e) =>
        e.name === name && !e.conditions.includes(condition)
          ? { ...e, conditions: [...e.conditions, condition] }
          : e
      ),
    })),

  removeCondition: (name, condition) =>
    set((s) => ({
      initiative: s.initiative.map((e) =>
        e.name === name
          ? { ...e, conditions: e.conditions.filter((c) => c !== condition) }
          : e
      ),
    })),

  endCombat: () => set(initialCombat),

  syncState: (state) => set(state),
}));
