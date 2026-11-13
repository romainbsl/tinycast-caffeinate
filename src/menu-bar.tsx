import { Color, Icon, launchCommand, LaunchType, MenuBarExtra } from "@raycast/api";
import { useEffect, useState } from "react";

import { startAndReport, stopAndReport } from "./lib/actions";
import { remainingLine, sessionTitle, type Session } from "./lib/model";
import { getActiveSession } from "./lib/session";

const PRESETS: { title: string; seconds?: number }[] = [
  { title: "15m", seconds: 15 * 60 },
  { title: "30m", seconds: 30 * 60 },
  { title: "1h", seconds: 3600 },
  { title: "2h", seconds: 2 * 3600 },
  { title: "Unlimited" },
];

export default function Command() {
  // undefined while the state is being read, null when nothing is running.
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    getActiveSession()
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  const isActive = Boolean(session);

  const startMenu = (title: string, icon: Icon, displayOff: boolean) => (
    <MenuBarExtra.Submenu title={title} icon={icon}>
      {PRESETS.map((preset) => (
        <MenuBarExtra.Item
          key={preset.title}
          title={preset.title}
          onAction={() => startAndReport({ seconds: preset.seconds, displayOff })}
        />
      ))}
    </MenuBarExtra.Submenu>
  );

  return (
    <MenuBarExtra
      isLoading={session === undefined}
      icon={{ source: isActive ? "cup-filled.svg" : "cup-empty.svg", tintColor: Color.PrimaryText }}
      tooltip="Caffeinate"
    >
      {session ? (
        <MenuBarExtra.Section title="Running">
          {/* No action: the item is shown disabled, as a status line. */}
          <MenuBarExtra.Item title={sessionTitle(session)} subtitle={remainingLine(session, Date.now()) ?? undefined} />
          <MenuBarExtra.Item title="Stop" icon={Icon.Stop} onAction={stopAndReport} />
        </MenuBarExtra.Section>
      ) : null}
      <MenuBarExtra.Section title="Start">
        {startMenu("Display Off", Icon.EyeDisabled, true)}
        {startMenu("Keep Awake", Icon.Eye, false)}
        <MenuBarExtra.Item
          title="While a Process Runs…"
          icon={Icon.Clock}
          onAction={() => launchCommand({ name: "caffeinate-while", type: LaunchType.UserInitiated })}
        />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}
