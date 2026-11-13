import { getPreferenceValues, LocalStorage } from "@raycast/api";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

import { parseDisplayOffDelay } from "./duration";
import { buildArgs, type FlagPrefs } from "./flags";
import { parseSession, type Session } from "./model";

const CAFFEINATE = "/usr/bin/caffeinate";
const PMSET = "/usr/bin/pmset";
const PS = "/bin/ps";
const SESSION_KEY = "session";

/** Time given to caffeinate to reject its arguments or a dead `-w` pid before we call it started. */
const SETTLE_MS = 150;
const SPAWN_TIMEOUT_MS = 3000;

const execFileAsync = promisify(execFile);
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface Preferences extends FlagPrefs {
  displayOffDelay: string;
}

export const readPreferences = (): Preferences => getPreferenceValues<Preferences>();

export interface StartRequest {
  /** Stop after this many seconds. */
  seconds?: number;
  /** Stop when this process exits. */
  watched?: { pid: number; name: string };
  /** Put the display to sleep once started. */
  displayOff: boolean;
}

/** True when `pid` is alive and really is a caffeinate: a recycled pid must never be signalled. */
async function isCaffeinate(pid: number): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(PS, ["-p", String(pid), "-o", "comm="]);
    return stdout.trim().endsWith("/caffeinate");
  } catch {
    return false; // ps exits with 1 when the pid does not exist.
  }
}

/**
 * Starts caffeinate detached from the extension. Waits for the `spawn` event: in this runtime
 * `child.pid` is still 0 right after `spawn()` and only set a microtask later.
 */
function launch(file: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { detached: true, stdio: "ignore" });
    const timer = setTimeout(() => reject(new Error(`${file} did not start`)), SPAWN_TIMEOUT_MS);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("spawn", () => {
      clearTimeout(timer);
      if (child.pid) resolve(child.pid);
      else reject(new Error(`${file} has no PID`));
    });
  });
}

export async function readSession(): Promise<Session | null> {
  return parseSession(await LocalStorage.getItem<string>(SESSION_KEY));
}

/** The running session, or null. Forgets a stored session whose caffeinate has exited. */
export async function getActiveSession(): Promise<Session | null> {
  const session = await readSession();
  if (!session) return null;
  if (await isCaffeinate(session.pid)) return session;
  await LocalStorage.removeItem(SESSION_KEY);
  return null;
}

/** Stops the session this extension started, and only that one. Returns whether one was running. */
export async function stopSession(): Promise<boolean> {
  const session = await readSession();
  await LocalStorage.removeItem(SESSION_KEY);
  if (!session || !(await isCaffeinate(session.pid))) return false;
  try {
    process.kill(session.pid, "SIGTERM");
  } catch {
    return false; // It exited between the check and the signal.
  }
  return true;
}

/** Starts a session, replacing the previous one. Throws with a readable message on failure. */
export async function startSession(request: StartRequest): Promise<Session> {
  // Build the arguments first: a bad value must not cost the user their running session.
  const args = buildArgs(readPreferences(), { seconds: request.seconds, watchPid: request.watched?.pid });
  await stopSession();

  const pid = await launch(CAFFEINATE, args);
  await sleep(SETTLE_MS);
  if (!(await isCaffeinate(pid))) {
    throw new Error(
      request.watched
        ? `caffeinate exited immediately: "${request.watched.name}" may have already finished`
        : "caffeinate exited immediately",
    );
  }

  const startedAt = Date.now();
  const session: Session = {
    pid,
    startedAt,
    endsAt: request.seconds === undefined ? null : startedAt + request.seconds * 1000,
    displayOff: request.displayOff,
    ...(request.watched ? { watched: request.watched } : {}),
  };
  await LocalStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

/**
 * Puts the display to sleep after the configured delay, so that releasing the Enter key that
 * launched the command does not wake it again at once.
 *
 * The wait is handed to a detached `sh`, not done here with a timer: Tinycast discards the
 * JavaScript context, timers included, when a command finishes or its window closes, which would
 * cancel a pending `pmset`. The delay travels as a positional argument, never inside the script.
 * The result of `pmset` itself is not observed.
 */
export async function scheduleDisplayOff(): Promise<void> {
  const delay = parseDisplayOffDelay(readPreferences().displayOffDelay);
  await launch("/bin/sh", ["-c", `sleep "$1"; exec ${PMSET} displaysleepnow`, "sh", String(delay)]);
}
