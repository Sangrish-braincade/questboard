import { Routes, Route } from "react-router-dom";

function JoinSession() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="w-full max-w-sm rounded-xl bg-[var(--color-surface-light)] p-8 shadow-lg">
        <h1 className="text-center text-2xl font-bold text-[var(--color-primary)]">
          Join Session
        </h1>
        <p className="mt-2 text-center text-sm text-[var(--color-text-muted)]">
          Enter the session code from your DM
        </p>
        <input
          type="text"
          maxLength={6}
          placeholder="ABC123"
          className="mt-6 w-full rounded-lg bg-[var(--color-surface)] px-4 py-3 text-center text-2xl font-mono tracking-widest text-[var(--color-text)] placeholder-[var(--color-surface-lighter)] outline-none ring-2 ring-[var(--color-surface-lighter)] focus:ring-[var(--color-primary)]"
        />
        <button className="mt-4 w-full rounded-lg bg-[var(--color-primary)] px-6 py-3 font-medium text-white transition-colors hover:bg-[var(--color-primary-dark)]">
          Join
        </button>
      </div>
    </div>
  );
}

export default function PlayerLayout() {
  return (
    <Routes>
      <Route index element={<JoinSession />} />
    </Routes>
  );
}
