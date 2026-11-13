import { formatDuration, formatRemaining } from "./duration";

/**
 * The caffeinate process this extension started. Persisted in LocalStorage so that the menu bar,
 * which runs in a fresh JavaScript context on every refresh, can find it again.
 */
export interface Session {
  pid: number;
  /** Epoch milliseconds. */
  startedAt: number;
  /** Epoch milliseconds, or null when the session has no time limit. */
  endsAt: number | null;
  /** Whether the display was put to sleep when the session started. */
  displayOff: boolean;
  /** The process caffeinate waits for (`-w`), when there is one. */
  watched?: { pid: number; name: string };
}

const isPid = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value > 0;
const isTime = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** Reads the stored JSON back. Anything unexpected is treated as "no session", never as an error. */
export function parseSession(raw: string | undefined): Session | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const { pid, startedAt, endsAt, displayOff, watched } = value as Record<string, unknown>;

  if (!isPid(pid) || !isTime(startedAt) || typeof displayOff !== "boolean") return null;
  if (endsAt !== null && !isTime(endsAt)) return null;

  const session: Session = { pid, startedAt, endsAt, displayOff };
  if (watched !== undefined) {
    const w = watched as Record<string, unknown> | null;
    if (typeof w !== "object" || w === null || !isPid(w.pid) || typeof w.name !== "string") return null;
    session.watched = { pid: w.pid, name: w.name };
  }
  return session;
}

/** What the session does, e.g. "Keeping Mac awake, display off". */
function sessionTitle(session: Session): string {
  let title = "Keeping Mac awake";
  if (session.watched) title += ` while "${session.watched.name}" runs`;
  if (session.displayOff) title += ", display off";
  return title;
}

/** The confirmation shown right after a start. */
export function startMessage(session: Session): string {
  const title = sessionTitle(session);
  if (session.endsAt === null) return title;
  return `${title} for ${formatDuration((session.endsAt - session.startedAt) / 1000)}`;
}

/** The menu bar's second line; null when there is nothing to count down. */
export function remainingLine(session: Session, now: number): string | null {
  if (session.endsAt !== null) return `${formatRemaining((session.endsAt - now) / 1000)} left`;
  return session.watched ? null : "unlimited";
}

export { sessionTitle };
