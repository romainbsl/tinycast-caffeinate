import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { parseSession, remainingLine, startMessage, type Session } from "../src/lib/model";

const NOW = 1_700_000_000_000;

const base: Session = { pid: 4242, startedAt: NOW, endsAt: null, displayOff: false };

describe("parseSession", () => {
  test("round-trips a stored session", () => {
    const stored: Session = {
      pid: 4242,
      startedAt: NOW,
      endsAt: NOW + 1_800_000,
      displayOff: true,
      watched: { pid: 99, name: "node" },
    };
    assert.deepEqual(parseSession(JSON.stringify(stored)), stored);
  });

  test("accepts a session without limit and without watched process", () => {
    assert.deepEqual(parseSession(JSON.stringify(base)), base);
  });

  test("returns null when there is nothing stored", () => {
    assert.equal(parseSession(undefined), null);
    assert.equal(parseSession(""), null);
  });

  test("returns null for corrupt state instead of throwing", () => {
    assert.equal(parseSession("not json"), null);
    assert.equal(parseSession("null"), null);
    assert.equal(parseSession("[]"), null);
    assert.equal(parseSession(JSON.stringify({ ...base, pid: "4242" })), null);
    assert.equal(parseSession(JSON.stringify({ ...base, pid: -1 })), null);
    assert.equal(parseSession(JSON.stringify({ ...base, pid: 1.5 })), null);
    assert.equal(parseSession(JSON.stringify({ ...base, startedAt: undefined })), null);
    assert.equal(parseSession(JSON.stringify({ ...base, endsAt: "soon" })), null);
    assert.equal(parseSession(JSON.stringify({ ...base, displayOff: "yes" })), null);
    assert.equal(parseSession(JSON.stringify({ ...base, watched: { pid: 1 } })), null);
  });
});

describe("startMessage", () => {
  test("system only", () => {
    assert.equal(startMessage(base), "Keeping Mac awake");
  });

  test("display off", () => {
    assert.equal(startMessage({ ...base, displayOff: true }), "Keeping Mac awake, display off");
  });

  test("with a duration", () => {
    assert.equal(startMessage({ ...base, endsAt: NOW + 1_800_000 }), "Keeping Mac awake for 30m");
    assert.equal(
      startMessage({ ...base, displayOff: true, endsAt: NOW + 5_400_000 }),
      "Keeping Mac awake, display off for 1h 30m",
    );
  });

  test("while a process runs", () => {
    const watched = { pid: 99, name: "node" };
    assert.equal(startMessage({ ...base, watched }), "Keeping Mac awake while \"node\" runs");
    assert.equal(
      startMessage({ ...base, watched, displayOff: true }),
      "Keeping Mac awake while \"node\" runs, display off",
    );
  });
});

describe("remainingLine", () => {
  test("unlimited", () => {
    assert.equal(remainingLine(base, NOW), "unlimited");
  });

  test("time left", () => {
    assert.equal(remainingLine({ ...base, endsAt: NOW + 12 * 60_000 }, NOW), "12m left");
    assert.equal(remainingLine({ ...base, endsAt: NOW + 5_400_000 }, NOW), "1h 30m left");
  });

  test("never negative", () => {
    assert.equal(remainingLine({ ...base, endsAt: NOW - 5_000 }, NOW), "0s left");
  });

  test("a watched process with no limit has nothing to count down", () => {
    assert.equal(remainingLine({ ...base, watched: { pid: 99, name: "node" } }, NOW), null);
  });
});
