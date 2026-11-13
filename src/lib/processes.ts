export interface ProcessInfo {
  pid: number;
  /** Executable name, e.g. "Google Chrome". */
  name: string;
  /** Full command line, arguments included. */
  command: string;
}

export interface ParseOptions {
  excludePids?: number[];
  /** Drops processes whose command line matches, e.g. the `ps` that produced the listing. */
  excludeCommand?: RegExp;
}

/** `ps -xww -o pid=,<column>=` → pid → text. The text is whatever follows the pid, spaces included. */
function readColumn(stdout: string): Map<number, string> {
  const rows = new Map<number, string>();
  for (const line of stdout.split("\n")) {
    const match = /^\s*(\d+)\s+(.+?)\s*$/.exec(line);
    if (match) rows.set(Number(match[1]), match[2]);
  }
  return rows;
}

function baseName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/**
 * Joins the outputs of two `ps` calls:
 * - `comm` gives the executable path, whole, spaces included, which is what the name is cut from;
 * - `command` gives the command line, which is only displayed.
 *
 * One call could not do both: `comm` and `command` are each only parseable as the last column.
 */
export function parsePs(commOutput: string, commandOutput: string, options: ParseOptions = {}): ProcessInfo[] {
  const excluded = new Set(options.excludePids ?? []);
  const commands = readColumn(commandOutput);

  const processes: ProcessInfo[] = [];
  for (const [pid, path] of readColumn(commOutput)) {
    if (pid === 0 || excluded.has(pid)) continue;
    const command = commands.get(pid) ?? path;
    if (options.excludeCommand?.test(command)) continue;
    processes.push({ pid, name: baseName(path), command });
  }

  return processes.sort(
    (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.pid - b.pid,
  );
}
