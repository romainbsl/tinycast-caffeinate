import { launchCommand, LaunchType, showHUD } from "@raycast/api";

import { parseDuration } from "./duration";
import { startMessage } from "./model";
import { scheduleDisplayOff, startSession, stopSession, type StartRequest } from "./session";

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Asks the menu bar to redraw its icon now rather than at its next 10 s refresh. A background launch
 * only refreshes a menu bar item that is already shown, so this is harmless when it is not.
 * Best effort: never worth failing a command over.
 */
export async function refreshMenuBar(): Promise<void> {
  try {
    await launchCommand({ name: "menu-bar", type: LaunchType.Background });
  } catch {
    // Not installed as a menu bar item, or the refresh is busy: the next interval will catch up.
  }
}

/** Starts a session and tells the user what happened. Failures are reported, not thrown. */
export async function startAndReport(request: StartRequest): Promise<void> {
  try {
    const session = await startSession(request);
    // Scheduled before the HUD: showHUD may close the window, and the wait lives in a detached shell.
    if (request.displayOff) await scheduleDisplayOff();
    await showHUD(startMessage(session));
  } catch (error) {
    await showHUD(`Failed: ${messageOf(error)}`);
  }
  await refreshMenuBar();
}

/** The two "duration" commands: parse the argument, then start. */
export async function startFromDurationArgument(duration: string | undefined, displayOff: boolean): Promise<void> {
  const text = duration ?? "";
  const parsed = parseDuration(text);
  if (parsed.kind === "invalid") {
    await showHUD(`Unreadable duration: "${text.trim()}". Try 30m, 1h30, 2h or 45 (minutes).`);
    return;
  }
  await startAndReport({ seconds: parsed.kind === "seconds" ? parsed.seconds : undefined, displayOff });
}

export async function stopAndReport(): Promise<void> {
  try {
    const stopped = await stopSession();
    await showHUD(stopped ? "caffeinate stopped" : "No caffeinate session to stop");
  } catch (error) {
    await showHUD(`Failed: ${messageOf(error)}`);
  }
  await refreshMenuBar();
}
