import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { parsePs } from "../src/lib/processes";

// Real shape of `ps -xww -o pid=,comm=` and `ps -xww -o pid=,command=` on macOS.
const COMM = `
    1 /sbin/launchd
  536 /usr/libexec/logd
 1339 /Applications/Tinycast.app/Contents/MacOS/Tinycast
 2326 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
 4242 /bin/sleep
 5000 kernel_task
83990 /bin/ps
`;

const COMMAND = `
    1 /sbin/launchd
  536 /usr/libexec/logd
 1339 /Applications/Tinycast.app/Contents/MacOS/Tinycast
 2326 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --profile-directory=Default
 4242 sleep 600
 5000 kernel_task
83990 ps -xww -o pid=,command=
`;

describe("parsePs", () => {
  test("takes the name from the executable path, spaces included", () => {
    const chrome = parsePs(COMM, COMMAND).find((p) => p.pid === 2326);
    assert.deepEqual(chrome, {
      pid: 2326,
      name: "Google Chrome",
      command: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --profile-directory=Default",
    });
  });

  test("keeps the full command line, arguments included", () => {
    const sleep = parsePs(COMM, COMMAND).find((p) => p.pid === 4242);
    assert.equal(sleep?.name, "sleep");
    assert.equal(sleep?.command, "sleep 600");
  });

  test("a bare executable name has no path to cut", () => {
    assert.equal(parsePs(COMM, COMMAND).find((p) => p.pid === 5000)?.name, "kernel_task");
  });

  test("falls back to the executable path when the command line is missing", () => {
    const processes = parsePs(COMM, "");
    assert.equal(processes.find((p) => p.pid === 4242)?.command, "/bin/sleep");
  });

  test("leaves out the excluded pids, such as ps itself", () => {
    const pids = parsePs(COMM, COMMAND, { excludePids: [83990, 1] }).map((p) => p.pid);
    assert.ok(!pids.includes(83990));
    assert.ok(!pids.includes(1));
    assert.ok(pids.includes(4242));
  });

  test("leaves out the command lines matching a pattern, such as our own ps calls", () => {
    const own = /^(\/bin\/)?ps -xww -o pid=,/;
    const pids = parsePs(COMM, COMMAND, { excludeCommand: own }).map((p) => p.pid);
    assert.ok(!pids.includes(83990));
    assert.ok(pids.includes(4242));
  });

  test("never lists pid 0", () => {
    assert.ok(!parsePs("    0 kernel_task\n  10 /bin/zsh\n", "").some((p) => p.pid === 0));
  });

  test("sorts by name, ignoring case, then by pid", () => {
    const comm = ` 30 /usr/bin/zebra\n 20 /usr/bin/Apple\n 10 /usr/bin/apple\n 40 /usr/bin/apple\n`;
    assert.deepEqual(
      parsePs(comm, "").map((p) => [p.name, p.pid]),
      [
        ["apple", 10],
        ["Apple", 20],
        ["apple", 40],
        ["zebra", 30],
      ],
    );
  });

  test("ignores blank and malformed lines", () => {
    const comm = `\n  garbage line\n\n  77 /bin/ok\n   x /bin/nope\n`;
    assert.deepEqual(
      parsePs(comm, "").map((p) => p.pid),
      [77],
    );
  });
});
