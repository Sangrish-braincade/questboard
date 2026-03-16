/**
 * TokenPanel — Sidebar for adding, editing, and managing tokens on the map.
 * DM only.
 */

import { useState } from "react";
import { useMapStore } from "@/stores/mapStore";
import type { TokenState } from "@/types";

interface TokenPanelProps {
  selectedToken: TokenState | null;
  onAddToken: (token: TokenState) => void;
  onRemoveToken: (id: string) => void;
  onUpdateToken: (id: string, updates: Partial<TokenState>) => void;
}

export default function TokenPanel({
  selectedToken,
  onAddToken,
  onRemoveToken,
  onUpdateToken,
}: TokenPanelProps) {
  const tokens = useMapStore((s) => s.tokens);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSize, setNewSize] = useState(1);
  const [newHp, setNewHp] = useState(10);
  const [newMaxHp, setNewMaxHp] = useState(10);

  const handleAdd = () => {
    if (!newName.trim()) return;
    const token: TokenState = {
      id: `token-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: newName.trim(),
      imageUrl: "",
      x: 0,
      y: 0,
      size: newSize,
      hp: newHp,
      maxHp: newMaxHp,
      visible: true,
    };
    onAddToken(token);
    setNewName("");
    setShowAdd(false);
  };

  return (
    <div className="flex h-full w-64 flex-col border-l border-[var(--color-surface-lighter)] bg-[var(--color-surface-light)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-surface-lighter)] px-3 py-2">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">
          Tokens ({tokens.length})
        </h3>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="rounded bg-[var(--color-primary)] px-2 py-1 text-xs text-white hover:bg-[var(--color-primary-dark)]"
        >
          {showAdd ? "Cancel" : "+ Add"}
        </button>
      </div>

      {/* Add Token Form */}
      {showAdd && (
        <div className="border-b border-[var(--color-surface-lighter)] p-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Token name"
            className="mb-2 w-full rounded bg-[var(--color-surface)] px-2 py-1.5 text-sm text-[var(--color-text)] outline-none ring-1 ring-[var(--color-surface-lighter)] focus:ring-[var(--color-primary)]"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <div className="mb-2 flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-[var(--color-text-muted)]">
                Size
              </label>
              <select
                value={newSize}
                onChange={(e) => setNewSize(Number(e.target.value))}
                className="w-full rounded bg-[var(--color-surface)] px-2 py-1 text-sm text-[var(--color-text)]"
              >
                <option value={1}>Small/Med (1x1)</option>
                <option value={2}>Large (2x2)</option>
                <option value={3}>Huge (3x3)</option>
                <option value={4}>Gargantuan (4x4)</option>
              </select>
            </div>
          </div>
          <div className="mb-2 flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-[var(--color-text-muted)]">HP</label>
              <input
                type="number"
                value={newHp}
                onChange={(e) => setNewHp(Number(e.target.value))}
                className="w-full rounded bg-[var(--color-surface)] px-2 py-1 text-sm text-[var(--color-text)]"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-[var(--color-text-muted)]">
                Max HP
              </label>
              <input
                type="number"
                value={newMaxHp}
                onChange={(e) => setNewMaxHp(Number(e.target.value))}
                className="w-full rounded bg-[var(--color-surface)] px-2 py-1 text-sm text-[var(--color-text)]"
              />
            </div>
          </div>
          <button
            onClick={handleAdd}
            className="w-full rounded bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent)]/80"
          >
            Place Token
          </button>
        </div>
      )}

      {/* Selected Token Inspector */}
      {selectedToken && (
        <div className="border-b border-[var(--color-surface-lighter)] p-3">
          <h4 className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
            Selected
          </h4>
          <p className="mt-1 text-sm font-medium text-[var(--color-text)]">
            {selectedToken.name}
          </p>
          {selectedToken.hp !== undefined && (
            <div className="mt-2 flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-[var(--color-text-muted)]">HP</label>
                <input
                  type="number"
                  value={selectedToken.hp}
                  onChange={(e) =>
                    onUpdateToken(selectedToken.id, {
                      hp: Number(e.target.value),
                    })
                  }
                  className="w-full rounded bg-[var(--color-surface)] px-2 py-1 text-sm text-[var(--color-text)]"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-[var(--color-text-muted)]">
                  Position
                </label>
                <p className="py-1 text-sm text-[var(--color-text)]">
                  ({selectedToken.x}, {selectedToken.y})
                </p>
              </div>
            </div>
          )}
          <div className="mt-2 flex gap-2">
            <button
              onClick={() =>
                onUpdateToken(selectedToken.id, {
                  visible: !selectedToken.visible,
                })
              }
              className="flex-1 rounded bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              {selectedToken.visible ? "Hide" : "Show"}
            </button>
            <button
              onClick={() => onRemoveToken(selectedToken.id)}
              className="flex-1 rounded bg-red-500/20 px-2 py-1 text-xs text-red-400 hover:bg-red-500/30"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Token List */}
      <div className="flex-1 overflow-y-auto">
        {tokens.map((token) => (
          <div
            key={token.id}
            className={`flex items-center gap-2 border-b border-[var(--color-surface-lighter)] px-3 py-2 text-sm ${
              token.id === selectedToken?.id
                ? "bg-[var(--color-primary)]/10"
                : "hover:bg-[var(--color-surface)]"
            }`}
          >
            <div
              className={`h-3 w-3 rounded-full ${
                token.visible ? "bg-green-400" : "bg-gray-500"
              }`}
            />
            <span className="flex-1 truncate text-[var(--color-text)]">
              {token.name}
            </span>
            {token.hp !== undefined && token.maxHp !== undefined && (
              <span className="text-xs text-[var(--color-text-muted)]">
                {token.hp}/{token.maxHp}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
