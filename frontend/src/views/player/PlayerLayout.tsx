import { Routes, Route } from "react-router-dom";
import { useState } from "react";
import { useSessionStore } from "@/stores/sessionStore";

// ─── Join Session Screen ─────────────────────────────────────────────

function JoinSession() {
  const joinSession = useSessionStore((s) => s.joinSession);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const handleJoin = async () => {
    if (code.length !== 6 || !name.trim()) return;
    setError(null);
    setJoining(true);
    try {
      await joinSession(code.toUpperCase(), name.trim());
      // On success, navigate to session view
      window.location.hash = "#/play/session";
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to join session";
      setError(message);
    } finally {
      setJoining(false);
    }
  };

  const handleCodeInput = (value: string) => {
    // Only allow alphanumeric, uppercase
    const clean = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (clean.length <= 6) {
      setCode(clean);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-[var(--color-surface)]">
      <div className="w-full max-w-sm rounded-xl bg-[var(--color-surface-light)] p-8 shadow-lg">
        <h1 className="text-center text-2xl font-bold text-[var(--color-primary)]">
          Join Session
        </h1>
        <p className="mt-2 text-center text-sm text-[var(--color-text-muted)]">
          Enter the session code from your DM
        </p>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your Name"
          className="mt-6 w-full rounded-lg bg-[var(--color-surface)] px-4 py-3 text-center text-[var(--color-text)] placeholder-[var(--color-surface-lighter)] outline-none ring-1 ring-[var(--color-surface-lighter)] focus:ring-[var(--color-primary)]"
        />

        <input
          type="text"
          maxLength={6}
          value={code}
          onChange={(e) => handleCodeInput(e.target.value)}
          placeholder="ABC123"
          className="mt-3 w-full rounded-lg bg-[var(--color-surface)] px-4 py-3 text-center font-mono text-2xl tracking-widest text-[var(--color-text)] placeholder-[var(--color-surface-lighter)] outline-none ring-1 ring-[var(--color-surface-lighter)] focus:ring-[var(--color-primary)]"
          onKeyDown={(e) => e.key === "Enter" && handleJoin()}
        />

        {error && (
          <p className="mt-3 text-center text-sm text-red-400">{error}</p>
        )}

        <button
          onClick={handleJoin}
          disabled={code.length !== 6 || !name.trim() || joining}
          className="mt-4 w-full rounded-lg bg-[var(--color-primary)] px-6 py-3 font-medium text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {joining ? "Joining..." : "Join"}
        </button>
      </div>
    </div>
  );
}

// ─── Router ──────────────────────────────────────────────────────────

import PlayerSession from "./PlayerSession";

export default function PlayerLayout() {
  return (
    <Routes>
      <Route index element={<JoinSession />} />
      <Route path="session" element={<PlayerSession />} />
    </Routes>
  );
}
