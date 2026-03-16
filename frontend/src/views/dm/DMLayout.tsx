import { Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import { useCampaignStore } from "@/stores/campaignStore";
import { useSessionStore } from "@/stores/sessionStore";
import type { Campaign } from "@/types";

// ─── Campaign List (DM home) ─────────────────────────────────────────

function CampaignList() {
  const { campaigns, loading, fetchCampaigns, createCampaign } =
    useCampaignStore();
  const { hostSession, sessionCode } = useSessionStore();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [dmName, setDmName] = useState("DM");

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createCampaign(newName.trim(), newDesc.trim());
    setShowCreate(false);
    setNewName("");
    setNewDesc("");
  };

  const handleHost = async (campaign: Campaign) => {
    const code = await hostSession(campaign.folderName, dmName);
    console.log("Session code:", code);
  };

  return (
    <div className="flex h-screen flex-col bg-[var(--color-surface)]">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[var(--color-surface-lighter)] px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-primary)]">
            Questboard
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Dungeon Master Console
          </p>
        </div>
        <div className="flex items-center gap-4">
          {sessionCode && (
            <div className="rounded-lg bg-[var(--color-primary)] px-4 py-2 font-mono text-lg font-bold tracking-widest text-white">
              {sessionCode}
            </div>
          )}
          <input
            type="text"
            value={dmName}
            onChange={(e) => setDmName(e.target.value)}
            placeholder="DM Name"
            className="w-32 rounded-lg bg-[var(--color-surface-light)] px-3 py-2 text-sm text-[var(--color-text)] outline-none ring-1 ring-[var(--color-surface-lighter)] focus:ring-[var(--color-primary)]"
          />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <p className="text-center text-[var(--color-text-muted)]">
            Loading campaigns...
          </p>
        ) : campaigns.length === 0 && !showCreate ? (
          <div className="flex h-full flex-col items-center justify-center">
            <p className="text-[var(--color-text-muted)]">
              No campaigns yet. Create one to get started.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 rounded-lg bg-[var(--color-primary)] px-6 py-3 font-medium text-white transition-colors hover:bg-[var(--color-primary-dark)]"
            >
              + New Campaign
            </button>
          </div>
        ) : (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--color-text)]">
                Your Campaigns
              </h2>
              <button
                onClick={() => setShowCreate(true)}
                className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-dark)]"
              >
                + New Campaign
              </button>
            </div>

            {/* Campaign cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {campaigns.map((c) => (
                <CampaignCard
                  key={c.folderName}
                  campaign={c}
                  onHost={() => handleHost(c)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Create Campaign Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-xl bg-[var(--color-surface-light)] p-6 shadow-2xl">
              <h2 className="text-xl font-bold text-[var(--color-text)]">
                New Campaign
              </h2>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Campaign Name"
                className="mt-4 w-full rounded-lg bg-[var(--color-surface)] px-4 py-3 text-[var(--color-text)] outline-none ring-1 ring-[var(--color-surface-lighter)] focus:ring-[var(--color-primary)]"
                autoFocus
              />
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Description (optional)"
                rows={3}
                className="mt-3 w-full resize-none rounded-lg bg-[var(--color-surface)] px-4 py-3 text-[var(--color-text)] outline-none ring-1 ring-[var(--color-surface-lighter)] focus:ring-[var(--color-primary)]"
              />
              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg px-4 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  className="rounded-lg bg-[var(--color-primary)] px-6 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-dark)]"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Campaign Card ───────────────────────────────────────────────────

function CampaignCard({
  campaign,
  onHost,
}: {
  campaign: Campaign;
  onHost: () => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-surface-lighter)] bg-[var(--color-surface-light)] p-5 transition-colors hover:border-[var(--color-primary)]/50">
      <h3 className="text-lg font-semibold text-[var(--color-text)]">
        {campaign.name}
      </h3>
      {campaign.description && (
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {campaign.description}
        </p>
      )}
      <div className="mt-3 flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
        <span>{campaign.sessionCount} sessions</span>
        <span>{campaign.playerCount} players</span>
        <span className="rounded bg-[var(--color-surface)] px-2 py-0.5">
          {campaign.system}
        </span>
      </div>
      <button
        onClick={onHost}
        className="mt-4 w-full rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent)]/80"
      >
        Host Session
      </button>
    </div>
  );
}

// ─── DM Session View (placeholder for Phase 2+) ─────────────────────

function DMSession() {
  return (
    <div className="flex h-screen items-center justify-center bg-[var(--color-surface)]">
      <p className="text-[var(--color-text-muted)]">
        Session view — battle map, chat, combat tracker will go here.
      </p>
    </div>
  );
}

// ─── Router ──────────────────────────────────────────────────────────

export default function DMLayout() {
  return (
    <Routes>
      <Route index element={<CampaignList />} />
      <Route path="session" element={<DMSession />} />
    </Routes>
  );
}
