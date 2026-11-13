import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildArgs, type FlagPrefs } from "../src/lib/flags";

const all: FlagPrefs = { preventIdleSleep: true, preventSystemSleepOnAC: true, preventDiskSleep: true };
const none: FlagPrefs = { preventIdleSleep: false, preventSystemSleepOnAC: false, preventDiskSleep: false };

describe("buildArgs", () => {
  test("defaults to -ims", () => {
    assert.deepEqual(buildArgs(all, {}), ["-ims"]);
  });

  test("each option can be switched off", () => {
    assert.deepEqual(buildArgs({ ...all, preventSystemSleepOnAC: false }, {}), ["-im"]);
    assert.deepEqual(buildArgs({ ...all, preventDiskSleep: false }, {}), ["-is"]);
    assert.deepEqual(buildArgs({ ...none, preventDiskSleep: true }, {}), ["-m"]);
  });

  test("sends no flag group when everything is off, leaving caffeinate's own -i default", () => {
    assert.deepEqual(buildArgs(none, {}), []);
  });

  test("never emits -d or -u", () => {
    const joined = buildArgs(all, { seconds: 60, watchPid: 42 }).join(" ");
    assert.doesNotMatch(joined, /-[a-z]*[du]/);
  });

  test("adds -t for a duration", () => {
    assert.deepEqual(buildArgs(all, { seconds: 1800 }), ["-ims", "-t", "1800"]);
    assert.deepEqual(buildArgs(none, { seconds: 60 }), ["-t", "60"]);
  });

  test("adds -w for a watched process", () => {
    assert.deepEqual(buildArgs(all, { watchPid: 4242 }), ["-ims", "-w", "4242"]);
  });

  test("combines -t and -w", () => {
    assert.deepEqual(buildArgs(all, { seconds: 60, watchPid: 7 }), ["-ims", "-t", "60", "-w", "7"]);
  });

  test("refuses a duration that would make caffeinate exit at once", () => {
    for (const seconds of [0, -1, Number.NaN, 1.5, Number.POSITIVE_INFINITY]) {
      assert.throws(() => buildArgs(all, { seconds }), RangeError, `seconds=${seconds}`);
    }
  });

  test("refuses an invalid pid", () => {
    for (const watchPid of [0, -3, Number.NaN, 1.5]) {
      assert.throws(() => buildArgs(all, { watchPid }), RangeError, `watchPid=${watchPid}`);
    }
  });
});
