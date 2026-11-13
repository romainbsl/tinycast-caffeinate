/** Which sleep assertions to hold, mirroring the extension preferences one to one. */
export interface FlagPrefs {
  /** -i: prevent idle sleep of the system. */
  preventIdleSleep: boolean;
  /** -s: prevent system sleep while on AC power, even with the lid closed. */
  preventSystemSleepOnAC: boolean;
  /** -m: prevent disk idle sleep. */
  preventDiskSleep: boolean;
}

export interface SessionOptions {
  /** Stop after this many seconds (`-t`). Omitted means no limit. */
  seconds?: number;
  /** Stop when this process exits (`-w`). */
  watchPid?: number;
}

function assertPositiveInteger(name: string, value: number): void {
  // `-t NaN` makes caffeinate exit at once, so a bad value must never reach the command line.
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer, got ${value}`);
  }
}

/**
 * Builds the argument list for `/usr/bin/caffeinate`.
 *
 * Never emits `-d` (it would keep the display lit) nor `-u` (it would wake it). With every
 * assertion switched off no flag group is sent, and caffeinate falls back to its own `-i`.
 */
export function buildArgs(prefs: FlagPrefs, options: SessionOptions): string[] {
  const letters =
    (prefs.preventIdleSleep ? "i" : "") + (prefs.preventDiskSleep ? "m" : "") + (prefs.preventSystemSleepOnAC ? "s" : "");
  const args: string[] = [];
  if (letters) args.push(`-${letters}`);

  if (options.seconds !== undefined) {
    assertPositiveInteger("seconds", options.seconds);
    args.push("-t", String(options.seconds));
  }
  if (options.watchPid !== undefined) {
    assertPositiveInteger("watchPid", options.watchPid);
    args.push("-w", String(options.watchPid));
  }
  return args;
}
