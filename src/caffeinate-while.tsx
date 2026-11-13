import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { execFile } from "node:child_process";
import { useEffect, useState } from "react";
import { promisify } from "node:util";

import { startAndReport } from "./lib/actions";
import { parsePs, type ProcessInfo } from "./lib/processes";

const execFileAsync = promisify(execFile);

/** The `ps` calls that build the listing show up in it themselves. */
const OWN_PS = /^(\/bin\/)?ps -xww -o pid=,/;

/** Two calls, because `comm` and `command` can each only be parsed as the last column. */
async function listProcesses(): Promise<ProcessInfo[]> {
  const [comm, command] = await Promise.all([
    execFileAsync("/bin/ps", ["-xww", "-o", "pid=,comm="]),
    execFileAsync("/bin/ps", ["-xww", "-o", "pid=,command="]),
  ]);
  return parsePs(comm.stdout, command.stdout, { excludeCommand: OWN_PS });
}

export default function Command() {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    listProcesses()
      .then(setProcesses)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setIsLoading(false));
  }, []);

  const watch = (process: ProcessInfo, displayOff: boolean) =>
    startAndReport({ watched: { pid: process.pid, name: process.name }, displayOff });

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Filter by name, PID or command line…">
      {error ? <List.EmptyView title="Process list unavailable" description={error} /> : null}
      {processes.map((process) => (
        <List.Item
          key={process.pid}
          title={process.name}
          subtitle={process.command}
          keywords={[String(process.pid)]}
          accessories={[{ text: String(process.pid) }]}
          actions={
            <ActionPanel>
              <Action
                title="Keep Awake While It Runs"
                icon={Icon.Clock}
                onAction={() => watch(process, false)}
              />
              <Action
                title="Keep Awake While It Runs, Display Off"
                icon={Icon.EyeDisabled}
                shortcut={{ modifiers: ["cmd"], key: "return" }}
                onAction={() => watch(process, true)}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
