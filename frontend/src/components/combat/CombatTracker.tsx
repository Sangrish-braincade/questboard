/**
 * CombatTracker — Initiative order, HP tracking, conditions, turn management.
 */

import { useState } from "react";
import { useCombatStore } from "@/stores/combatStore";
import type { InitiativeEntry, WSMessage } from "@/types";

interface CombatTrackerProps {
  isDm: boolean;
  send: (msg: WSMessage) => void;
  className?: string;
}

export default function CombatTracker({
  isDm,
  send,
  className = "",
}: CombatTrackerProps) {
  const { active, round, turnIndex, initiative } = useCombatStore();
  const [showSetup, setShowSetup] = useState(false);

  // ─── Setup (DM only) ────────────────────────────────────────────

  if (!active && isDm) {
    return (
      <div className={`p-4 ${className}`}>
        {showSetup ? (
          <CombatSetup
            onStart={(combatants) => {
              send({
                type: "combat_start",
                data: { initiative: combatants },
              });
              setShowSetup(false);
            }}
            onCancel={() => setShowSetup(false)}
          />
        ) : (
          <button
            onClick={() => setShowSetup(true)}
            className="w-full rounded-lg bg-red-500 px-4 py-3 font-medium text-white transition-colors hover:bg-red-600"
          >
            Start Combat
          </button>
        )}
      </div>
    );
  }

  if (!active) {
    return (
      <div className={`flex items-center justify-center p-4 text-sm text-[var(--color-text-muted)] ${className}`}>
        No active combat
      </div>
    );
  }

  const currentCombatant = initiative[turnIndex];

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Round & Turn Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-surface-lighter)] bg-red-500/10 px-3 py-2">
        <div>
          <span className="text-xs font-semibold uppercase text-red-400">
            Combat — Round {round}
          </span>
          {currentCombatant && (
            <p className="text-sm font-medium text-[var(--color-text)]">
              {currentCombatant.name}'s Turn
            </p>
          )}
        </div>
        {isDm && (
          <div className="flex gap-2">
            <button
              onClick={() => send({ type: "combat_next_turn", data: {} })}
              className="rounded bg-amber-500 px-3 py-1.5 text-xs font-medium text-black hover:bg-amber-400"
            >
              Next Turn
            </button>
            <button
              onClick={() => send({ type: "combat_end", data: {} })}
              className="rounded bg-red-500/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/50"
            >
              End
            </button>
          </div>
        )}
      </div>

      {/* Initiative Order */}
      <div className="flex-1 overflow-y-auto">
        {initiative.map((entry, idx) => (
          <InitiativeRow
            key={entry.name}
            entry={entry}
            isActive={idx === turnIndex}
            isDm={isDm}
            onDamage={(dmg) =>
              send({
                type: "combat_damage",
                data: { target: entry.name, damage: dmg },
              })
            }
          />
        ))}
      </div>
    </div>
  );
}

// ─── Initiative Row ──────────────────────────────────────────────────

function InitiativeRow({
  entry,
  isActive,
  isDm,
  onDamage,
}: {
  entry: InitiativeEntry;
  isActive: boolean;
  isDm: boolean;
  onDamage: (dmg: number) => void;
}) {
  const [dmgInput, setDmgInput] = useState("");
  const hpRatio = entry.maxHp > 0 ? entry.hp / entry.maxHp : 1;

  const hpColor =
    hpRatio > 0.5 ? "bg-green-500" : hpRatio > 0.25 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div
      className={`flex items-center gap-3 border-b border-[var(--color-surface-lighter)] px-3 py-2 ${
        isActive ? "bg-amber-500/10" : ""
      } ${entry.hp === 0 ? "opacity-40" : ""}`}
    >
      {/* Turn indicator */}
      <div
        className={`h-2 w-2 rounded-full ${
          isActive ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]" : "bg-transparent"
        }`}
      />

      {/* Initiative number */}
      <span className="w-6 text-center text-xs font-mono text-[var(--color-text-muted)]">
        {entry.initiative}
      </span>

      {/* Name & info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={`text-sm font-medium truncate ${
              entry.isNpc
                ? "text-red-300"
                : "text-[var(--color-text)]"
            }`}
          >
            {entry.name}
          </span>
          {entry.isNpc && (
            <span className="text-xs text-red-400/60">NPC</span>
          )}
        </div>

        {/* Conditions */}
        {entry.conditions.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {entry.conditions.map((c) => (
              <span
                key={c}
                className="rounded-full bg-orange-500/20 px-1.5 py-0.5 text-xs text-orange-300"
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* HP bar + AC */}
      <div className="flex items-center gap-2">
        <div className="w-20">
          <div className="flex justify-between text-xs">
            <span className="text-[var(--color-text)]">
              {entry.hp}/{entry.maxHp}
            </span>
            <span className="text-[var(--color-text-muted)]">AC {entry.ac}</span>
          </div>
          <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface)]">
            <div
              className={`h-full rounded-full transition-all ${hpColor}`}
              style={{ width: `${Math.max(0, hpRatio * 100)}%` }}
            />
          </div>
        </div>

        {/* Quick damage (DM only) */}
        {isDm && (
          <div className="flex gap-1">
            <input
              type="number"
              value={dmgInput}
              onChange={(e) => setDmgInput(e.target.value)}
              placeholder="dmg"
              className="w-12 rounded bg-[var(--color-surface)] px-1 py-0.5 text-center text-xs text-[var(--color-text)] outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && dmgInput) {
                  onDamage(parseInt(dmgInput));
                  setDmgInput("");
                }
              }}
            />
            <button
              onClick={() => {
                if (dmgInput) {
                  onDamage(parseInt(dmgInput));
                  setDmgInput("");
                }
              }}
              className="rounded bg-red-500/20 px-1.5 py-0.5 text-xs text-red-300 hover:bg-red-500/30"
              title="Apply damage"
            >
              Hit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Combat Setup Form ───────────────────────────────────────────────

function CombatSetup({
  onStart,
  onCancel,
}: {
  onStart: (combatants: InitiativeEntry[]) => void;
  onCancel: () => void;
}) {
  const [combatants, setCombatants] = useState<InitiativeEntry[]>([]);
  const [name, setName] = useState("");
  const [initiative, setInitiative] = useState(10);
  const [hp, setHp] = useState(10);
  const [maxHp, setMaxHp] = useState(10);
  const [ac, setAc] = useState(10);
  const [isNpc, setIsNpc] = useState(false);

  const addCombatant = () => {
    if (!name.trim()) return;
    setCombatants([
      ...combatants,
      {
        name: name.trim(),
        initiative,
        hp,
        maxHp,
        ac,
        isNpc,
        conditions: [],
      },
    ]);
    setName("");
    setInitiative(10);
    setHp(10);
    setMaxHp(10);
  };

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-[var(--color-text)]">
        Combat Setup
      </h3>

      {/* Add combatant form */}
      <div className="mb-3 rounded-lg bg-[var(--color-surface)] p-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="mb-2 w-full rounded bg-[var(--color-surface-light)] px-2 py-1.5 text-sm text-[var(--color-text)] outline-none"
          onKeyDown={(e) => e.key === "Enter" && addCombatant()}
        />
        <div className="grid grid-cols-4 gap-2">
          <div>
            <label className="text-xs text-[var(--color-text-muted)]">Init</label>
            <input
              type="number"
              value={initiative}
              onChange={(e) => setInitiative(Number(e.target.value))}
              className="w-full rounded bg-[var(--color-surface-light)] px-2 py-1 text-sm text-[var(--color-text)]"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--color-text-muted)]">HP</label>
            <input
              type="number"
              value={hp}
              onChange={(e) => {
                setHp(Number(e.target.value));
                setMaxHp(Number(e.target.value));
              }}
              className="w-full rounded bg-[var(--color-surface-light)] px-2 py-1 text-sm text-[var(--color-text)]"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--color-text-muted)]">AC</label>
            <input
              type="number"
              value={ac}
              onChange={(e) => setAc(Number(e.target.value))}
              className="w-full rounded bg-[var(--color-surface-light)] px-2 py-1 text-sm text-[var(--color-text)]"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-[var(--color-text-muted)]">NPC?</label>
            <label className="mt-1 flex cursor-pointer items-center gap-1">
              <input
                type="checkbox"
                checked={isNpc}
                onChange={(e) => setIsNpc(e.target.checked)}
                className="accent-red-500"
              />
              <span className="text-xs text-[var(--color-text)]">Yes</span>
            </label>
          </div>
        </div>
        <button
          onClick={addCombatant}
          className="mt-2 w-full rounded bg-[var(--color-primary)]/20 py-1.5 text-xs text-[var(--color-primary)] hover:bg-[var(--color-primary)]/30"
        >
          + Add Combatant
        </button>
      </div>

      {/* Combatant preview list */}
      {combatants.length > 0 && (
        <div className="mb-3 max-h-40 overflow-y-auto rounded-lg bg-[var(--color-surface)] p-2">
          {combatants
            .sort((a, b) => b.initiative - a.initiative)
            .map((c, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-1 text-xs"
              >
                <span
                  className={
                    c.isNpc ? "text-red-300" : "text-[var(--color-text)]"
                  }
                >
                  {c.initiative} — {c.name}
                </span>
                <span className="text-[var(--color-text-muted)]">
                  {c.hp}hp AC{c.ac}
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 rounded-lg py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          Cancel
        </button>
        <button
          onClick={() => combatants.length > 0 && onStart(combatants)}
          disabled={combatants.length === 0}
          className="flex-1 rounded-lg bg-red-500 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
        >
          Start Combat ({combatants.length})
        </button>
      </div>
    </div>
  );
}
