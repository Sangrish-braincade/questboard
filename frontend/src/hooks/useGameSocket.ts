/**
 * Questboard — Game-level WebSocket dispatcher
 * Routes incoming WS messages to the appropriate stores.
 */

import { useCallback } from "react";
import { useWebSocket } from "./useWebSocket";
import { useSessionStore } from "@/stores/sessionStore";
import { useChatStore, createChatMessage } from "@/stores/chatStore";
import { useCombatStore } from "@/stores/combatStore";
import { useMapStore } from "@/stores/mapStore";
import type { WSMessage, InitiativeEntry, TokenState, FogRegion } from "@/types";

export function useGameSocket() {
  const addPlayer = useSessionStore((s) => s.addPlayer);
  const removePlayer = useSessionStore((s) => s.removePlayer);
  const addChatMessage = useChatStore((s) => s.addMessage);
  const combatStore = useCombatStore();
  const mapStore = useMapStore();

  const handleMessage = useCallback(
    (msg: WSMessage) => {
      const { type, from, data } = msg;

      switch (type) {
        // ─── Chat ──────────────────────
        case "chat":
          addChatMessage(
            createChatMessage("chat", from ?? "Unknown", data.message as string)
          );
          break;

        case "whisper":
          addChatMessage(
            createChatMessage(
              "whisper",
              from ?? "Unknown",
              data.message as string,
              data.to as string
            )
          );
          break;

        // ─── Dice ──────────────────────
        case "dice_result":
          addChatMessage(
            createChatMessage(
              "dice",
              from ?? "Unknown",
              `rolled ${data.notation} → [${(data.results as number[]).join(", ")}]${data.modifier ? ` + ${data.modifier}` : ""} = **${data.total}**${data.label ? ` (${data.label})` : ""}`
            )
          );
          break;

        // ─── Players ───────────────────
        case "player_join":
          addPlayer({
            name: data.name as string,
            joinedAt: new Date().toISOString(),
          });
          addChatMessage(
            createChatMessage("system", "System", `${data.name} joined the session`)
          );
          break;

        case "player_leave":
          removePlayer(data.name as string);
          addChatMessage(
            createChatMessage("system", "System", `${data.name} left the session`)
          );
          break;

        // ─── Combat ────────────────────
        case "combat_start":
          combatStore.startCombat(data.initiative as InitiativeEntry[]);
          addChatMessage(
            createChatMessage("system", "System", "Combat has started!")
          );
          break;

        case "combat_next_turn": {
          combatStore.nextTurn();
          const current =
            combatStore.initiative[combatStore.turnIndex];
          if (current) {
            addChatMessage(
              createChatMessage("system", "System", `It's ${current.name}'s turn`)
            );
          }
          break;
        }

        case "combat_damage":
          combatStore.applyDamage(
            data.target as string,
            data.damage as number
          );
          break;

        case "combat_end":
          combatStore.endCombat();
          addChatMessage(
            createChatMessage("system", "System", "Combat has ended")
          );
          break;

        // ─── Map & Tokens ──────────────
        case "token_move":
          mapStore.moveToken(
            data.token_id as string,
            data.x as number,
            data.y as number
          );
          break;

        case "token_add":
          mapStore.addToken(data.token as TokenState);
          break;

        case "token_remove":
          mapStore.removeToken(data.token_id as string);
          break;

        case "fog_update":
          mapStore.setFogRegions(data.regions as FogRegion[]);
          break;

        // ─── Errors ────────────────────
        case "error":
          addChatMessage(
            createChatMessage("system", "System", `Error: ${data.message}`)
          );
          break;

        default:
          console.log(`[GameSocket] Unhandled message type: ${type}`);
      }
    },
    [addPlayer, removePlayer, addChatMessage, combatStore, mapStore]
  );

  return useWebSocket(handleMessage);
}
