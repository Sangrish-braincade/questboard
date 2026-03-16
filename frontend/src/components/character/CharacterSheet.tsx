/**
 * CharacterSheet — View/edit character stats, spells, and uploaded sheet.
 * Players see their own character; DM can view any.
 */

import { useState, useEffect } from "react";
import { api } from "@/services/api";

interface CharacterData {
  name: string;
  player_name: string;
  race: string;
  char_class: string;
  level: number;
  hp: number;
  max_hp: number;
  ac: number;
  stats: Record<string, number>;
  folder?: string;
}

interface CharacterSheetProps {
  campaignFolder: string;
  playerFolder?: string;
  isDm: boolean;
  className?: string;
}

const STAT_NAMES = ["str", "dex", "con", "int", "wis", "cha"];

function modifierFor(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export default function CharacterSheet({
  campaignFolder,
  playerFolder,
  isDm,
  className = "",
}: CharacterSheetProps) {
  const [character, setCharacter] = useState<CharacterData | null>(null);
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editHp, setEditHp] = useState(0);

  // Fetch character(s)
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (playerFolder) {
          const data = await api.get<CharacterData>(
            `/characters/${campaignFolder}/${playerFolder}`
          );
          setCharacter(data);
        } else {
          const data = await api.get<CharacterData[]>(
            `/characters/${campaignFolder}`
          );
          setCharacters(data);
          if (data.length > 0) setCharacter(data[0]!);
        }
      } catch {
        // No character yet
      }
      setLoading(false);
    };
    load();
  }, [campaignFolder, playerFolder]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <span className="text-sm text-[var(--color-text-muted)]">Loading...</span>
      </div>
    );
  }

  if (!character) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <span className="text-sm text-[var(--color-text-muted)]">
          No character found
        </span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col overflow-y-auto ${className}`}>
      {/* DM: character picker */}
      {isDm && characters.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b border-[var(--color-surface-lighter)] px-3 py-2">
          {characters.map((c) => (
            <button
              key={c.folder}
              onClick={() => setCharacter(c)}
              className={`shrink-0 rounded px-3 py-1 text-xs ${
                character.folder === c.folder
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-[var(--color-surface)] text-[var(--color-text-muted)]"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="border-b border-[var(--color-surface-lighter)] px-4 py-3">
        <h2 className="text-lg font-bold text-[var(--color-text)]">
          {character.name}
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Level {character.level} {character.race} {character.char_class}
        </p>
      </div>

      {/* Vitals */}
      <div className="flex items-center gap-4 border-b border-[var(--color-surface-lighter)] px-4 py-3">
        <div className="text-center">
          <p className="text-xs text-[var(--color-text-muted)]">HP</p>
          <div className="flex items-center gap-1">
            <span className="text-2xl font-bold text-[var(--color-text)]">
              {character.hp}
            </span>
            <span className="text-sm text-[var(--color-text-muted)]">
              / {character.max_hp}
            </span>
          </div>
          {/* HP bar */}
          <div className="mt-1 h-2 w-24 overflow-hidden rounded-full bg-[var(--color-surface)]">
            <div
              className={`h-full rounded-full transition-all ${
                character.hp / character.max_hp > 0.5
                  ? "bg-green-500"
                  : character.hp / character.max_hp > 0.25
                  ? "bg-yellow-500"
                  : "bg-red-500"
              }`}
              style={{
                width: `${Math.max(0, (character.hp / character.max_hp) * 100)}%`,
              }}
            />
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs text-[var(--color-text-muted)]">AC</p>
          <span className="text-2xl font-bold text-[var(--color-text)]">
            {character.ac}
          </span>
        </div>

        <div className="text-center">
          <p className="text-xs text-[var(--color-text-muted)]">Level</p>
          <span className="text-2xl font-bold text-[var(--color-primary)]">
            {character.level}
          </span>
        </div>
      </div>

      {/* Ability Scores */}
      <div className="grid grid-cols-3 gap-2 px-4 py-3">
        {STAT_NAMES.map((stat) => {
          const score = character.stats[stat] ?? 10;
          return (
            <div
              key={stat}
              className="rounded-lg bg-[var(--color-surface)] p-2 text-center"
            >
              <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                {stat}
              </p>
              <p className="text-xl font-bold text-[var(--color-text)]">
                {score}
              </p>
              <p className="text-xs text-[var(--color-primary)]">
                {modifierFor(score)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Player info */}
      <div className="border-t border-[var(--color-surface-lighter)] px-4 py-3">
        <p className="text-xs text-[var(--color-text-muted)]">
          Player: {character.player_name}
        </p>
      </div>
    </div>
  );
}
