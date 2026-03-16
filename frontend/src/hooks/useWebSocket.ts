/**
 * Questboard — WebSocket hook
 * Manages a single WS connection per session, with auto-reconnect.
 */

import { useEffect, useRef, useCallback } from "react";
import { useSessionStore } from "@/stores/sessionStore";
import type { WSMessage } from "@/types";

const WS_BASE = import.meta.env.DEV
  ? "ws://localhost:7777"
  : `ws://${window.location.host}`;

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000]; // backoff

export function useWebSocket(onMessage: (msg: WSMessage) => void) {
  const { token, sessionCode } = useSessionStore();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (!token || !sessionCode) return;

    const url = `${WS_BASE}/ws/${sessionCode}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] Connected");
      reconnectAttempt.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        onMessageRef.current(msg);
      } catch (err) {
        console.warn("[WS] Failed to parse message:", err);
      }
    };

    ws.onclose = (event) => {
      console.log(`[WS] Closed (code=${event.code})`);
      wsRef.current = null;

      // Don't reconnect on intentional close (1000) or auth failure (4001/4003)
      if (event.code === 1000 || event.code === 4001 || event.code === 4003) {
        return;
      }

      // Auto-reconnect with backoff
      const delay =
        RECONNECT_DELAYS[
          Math.min(reconnectAttempt.current, RECONNECT_DELAYS.length - 1)
        ];
      console.log(
        `[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempt.current + 1})`
      );
      reconnectTimer.current = setTimeout(() => {
        reconnectAttempt.current++;
        connect();
      }, delay);
    };

    ws.onerror = (err) => {
      console.error("[WS] Error:", err);
    };
  }, [token, sessionCode]);

  // Connect when token/code become available
  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close(1000, "Component unmount");
    };
  }, [connect]);

  // Send helper
  const send = useCallback((msg: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    } else {
      console.warn("[WS] Cannot send — not connected");
    }
  }, []);

  const isConnected = useCallback(() => {
    return wsRef.current?.readyState === WebSocket.OPEN;
  }, []);

  return { send, isConnected };
}
