/**
 * Questboard — Dice notation parser and roller
 * Parses standard D&D notation like "2d6+3", "1d20", "4d6kh3" (keep highest 3).
 */

export interface ParsedDice {
  count: number;
  sides: number;
  modifier: number;
  keepHighest?: number;
  keepLowest?: number;
}

export interface RollResult {
  notation: string;
  dice: ParsedDice;
  rolls: number[];
  kept: number[];
  modifier: number;
  total: number;
}

/**
 * Parse dice notation string.
 * Supports: "2d6", "1d20+5", "4d6kh3", "2d8kl1", "d12-2"
 */
export function parseDice(notation: string): ParsedDice {
  const clean = notation.toLowerCase().replace(/\s/g, "");
  const match = clean.match(
    /^(\d*)d(\d+)(?:kh(\d+)|kl(\d+))?([+-]\d+)?$/
  );

  if (!match) {
    throw new Error(`Invalid dice notation: "${notation}"`);
  }

  return {
    count: match[1] ? parseInt(match[1]) : 1,
    sides: parseInt(match[2]),
    modifier: match[5] ? parseInt(match[5]) : 0,
    keepHighest: match[3] ? parseInt(match[3]) : undefined,
    keepLowest: match[4] ? parseInt(match[4]) : undefined,
  };
}

/**
 * Roll dice from parsed notation.
 */
export function rollDice(notation: string): RollResult {
  const dice = parseDice(notation);
  const rolls: number[] = [];

  for (let i = 0; i < dice.count; i++) {
    rolls.push(Math.floor(Math.random() * dice.sides) + 1);
  }

  let kept = [...rolls];

  if (dice.keepHighest !== undefined) {
    kept = [...rolls]
      .sort((a, b) => b - a)
      .slice(0, dice.keepHighest);
  } else if (dice.keepLowest !== undefined) {
    kept = [...rolls]
      .sort((a, b) => a - b)
      .slice(0, dice.keepLowest);
  }

  const total = kept.reduce((sum, v) => sum + v, 0) + dice.modifier;

  return {
    notation,
    dice,
    rolls,
    kept,
    modifier: dice.modifier,
    total,
  };
}

/**
 * Format a roll result as a readable string.
 */
export function formatRoll(result: RollResult): string {
  const parts = [`[${result.rolls.join(", ")}]`];

  if (result.kept.length !== result.rolls.length) {
    parts.push(`→ kept [${result.kept.join(", ")}]`);
  }

  if (result.modifier !== 0) {
    parts.push(
      result.modifier > 0 ? `+ ${result.modifier}` : `- ${Math.abs(result.modifier)}`
    );
  }

  parts.push(`= ${result.total}`);
  return parts.join(" ");
}
