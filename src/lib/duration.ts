/** Longest accepted duration. Guards against typos and keeps `-t` a plain integer. */
export const MAX_SECONDS = 7 * 24 * 3600;

const MAX_DISPLAY_OFF_DELAY = 30;
const DEFAULT_DISPLAY_OFF_DELAY = 1;

export type ParsedDuration =
  | { kind: "unlimited" }
  | { kind: "seconds"; seconds: number }
  | { kind: "invalid" };

type Unit = "h" | "m" | "s";

const UNIT_SECONDS: Record<Unit, number> = { h: 3600, m: 60, s: 1 };
const UNIT_ORDER: Unit[] = ["h", "m", "s"];
/** What a bare trailing number means after a given unit: "1h30" is 1 h 30 min, "1m30" is 1 min 30 s. */
const NEXT_SMALLER: Partial<Record<Unit, Unit>> = { h: "m", m: "s" };

const TOKEN = /(\d+(?:[.,]\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)?\s*/gy;

function normalizeUnit(raw: string): Unit {
  if (raw.startsWith("h")) return "h";
  // "min(s)", "minute(s)" and "m" are minutes; "sec(s)", "second(s)" and "s" are seconds.
  return raw.startsWith("m") ? "m" : "s";
}

interface Token {
  value: number;
  unit: Unit | null;
}

/** The unit of a number typed without one: minutes when alone, else the unit after the previous one, last token only. */
function impliedUnit(tokens: Token[], index: number): Unit | null {
  if (tokens.length === 1) return "m";
  const isLast = index === tokens.length - 1;
  const previous = index > 0 ? tokens[index - 1].unit : null;
  return isLast && previous ? (NEXT_SMALLER[previous] ?? null) : null;
}

/**
 * Parses what the user types in the "duration" argument.
 *
 * - empty → unlimited
 * - `45` → 45 minutes; `30m`, `2h`, `90s`, `1h30m15s`, `1.5h` (or `1,5h`), `1 hour 30`
 * - a bare number after a unit takes the next smaller one: `1h30` → 1 h 30 min
 */
export function parseDuration(input: string): ParsedDuration {
  const text = input.trim().toLowerCase();
  if (text === "") return { kind: "unlimited" };

  const invalid: ParsedDuration = { kind: "invalid" };
  const tokens: Token[] = [];

  TOKEN.lastIndex = 0;
  let consumed = 0;
  while (consumed < text.length) {
    TOKEN.lastIndex = consumed;
    const match = TOKEN.exec(text);
    if (!match) return invalid;
    tokens.push({
      value: Number(match[1].replace(",", ".")),
      unit: match[2] ? normalizeUnit(match[2]) : null,
    });
    consumed = TOKEN.lastIndex;
  }

  let total = 0;
  let lastRank = -1;
  for (const [index, token] of tokens.entries()) {
    const unit = token.unit ?? impliedUnit(tokens, index);
    if (unit === null) return invalid;
    // Units must strictly decrease: "1h2h" and "30m1h" are typos.
    const rank = UNIT_ORDER.indexOf(unit);
    if (rank <= lastRank) return invalid;
    lastRank = rank;
    total += token.value * UNIT_SECONDS[unit];
  }

  const seconds = Math.round(total);
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > MAX_SECONDS) return invalid;
  return { kind: "seconds", seconds };
}

/** Exact, for confirmations: 5400 → "1h 30m", 90 → "1m 30s". */
export function formatDuration(totalSeconds: number): string {
  const total = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(" ");
}

/** Time left, rounded up to the minute from one minute on: 61 → "2m", 3660 → "1h 01m". */
export function formatRemaining(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0s";
  if (totalSeconds < 60) return `${Math.ceil(totalSeconds)}s`;
  const totalMinutes = Math.ceil(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

/** The "delay before the display goes off" preference, in seconds: 0 to 30, 1 when unreadable. */
export function parseDisplayOffDelay(value: string | undefined): number {
  const text = (value ?? "").trim().replace(",", ".");
  if (text === "") return DEFAULT_DISPLAY_OFF_DELAY;
  const delay = Number(text);
  if (!Number.isFinite(delay) || delay < 0) return DEFAULT_DISPLAY_OFF_DELAY;
  return Math.min(delay, MAX_DISPLAY_OFF_DELAY);
}
