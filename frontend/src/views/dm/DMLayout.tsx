import { Routes, Route } from "react-router-dom";

function CampaignList() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-[var(--color-primary)]">
          Questboard
        </h1>
        <p className="mt-2 text-[var(--color-text-muted)]">
          Local-first D&D Session Manager
        </p>
        <p className="mt-8 text-sm text-[var(--color-text-muted)]">
          No campaigns yet. Create one to get started.
        </p>
        <button className="mt-4 rounded-lg bg-[var(--color-primary)] px-6 py-3 font-medium text-white transition-colors hover:bg-[var(--color-primary-dark)]">
          + New Campaign
        </button>
      </div>
    </div>
  );
}

export default function DMLayout() {
  return (
    <Routes>
      <Route index element={<CampaignList />} />
    </Routes>
  );
}
