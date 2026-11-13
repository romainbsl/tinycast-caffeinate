import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  formatDuration,
  formatRemaining,
  MAX_SECONDS,
  parseDisplayOffDelay,
  parseDuration,
} from "../src/lib/duration";

const seconds = (n: number) => ({ kind: "seconds", seconds: n });

describe("parseDuration", () => {
  test("empty input means unlimited", () => {
    assert.deepEqual(parseDuration(""), { kind: "unlimited" });
    assert.deepEqual(parseDuration("   "), { kind: "unlimited" });
  });

  test("a bare number is minutes", () => {
    assert.deepEqual(parseDuration("45"), seconds(2700));
    assert.deepEqual(parseDuration(" 5 "), seconds(300));
  });

  test("explicit units", () => {
    assert.deepEqual(parseDuration("30m"), seconds(1800));
    assert.deepEqual(parseDuration("2h"), seconds(7200));
    assert.deepEqual(parseDuration("90s"), seconds(90));
    assert.deepEqual(parseDuration("1h30m15s"), seconds(5415));
  });

  test("a trailing bare number takes the next smaller unit", () => {
    assert.deepEqual(parseDuration("1h30"), seconds(5400));
    assert.deepEqual(parseDuration("1m30"), seconds(90));
  });

  test("skipping a unit is fine", () => {
    assert.deepEqual(parseDuration("1h5s"), seconds(3605));
  });

  test("case, spaces and long unit names", () => {
    assert.deepEqual(parseDuration("2H"), seconds(7200));
    assert.deepEqual(parseDuration("1h 30 min"), seconds(5400));
    assert.deepEqual(parseDuration("1 hour 30"), seconds(5400));
    assert.deepEqual(parseDuration("2 hours"), seconds(7200));
    assert.deepEqual(parseDuration("2 hrs"), seconds(7200));
    assert.deepEqual(parseDuration("5 mins"), seconds(300));
    assert.deepEqual(parseDuration("15 seconds"), seconds(15));
    assert.deepEqual(parseDuration("10 minutes"), seconds(600));
    assert.deepEqual(parseDuration("20 sec"), seconds(20));
  });

  test("decimals with a dot or a comma", () => {
    assert.deepEqual(parseDuration("1.5h"), seconds(5400));
    assert.deepEqual(parseDuration("1,5h"), seconds(5400));
    assert.deepEqual(parseDuration("0.5m"), seconds(30));
  });

  test("the result is always a whole number of seconds", () => {
    assert.deepEqual(parseDuration("0.3s"), { kind: "invalid" });
    assert.deepEqual(parseDuration("1.7s"), seconds(2));
  });

  test("rejects garbage", () => {
    for (const input of ["abc", "h", "-5", "1h2h", "30m1h", "5 10", "1h30x", "30s15", "1h-5", "1:30"]) {
      assert.deepEqual(parseDuration(input), { kind: "invalid" }, input);
    }
  });

  test("rejects zero", () => {
    for (const input of ["0", "0m", "0h0m", "0s"]) {
      assert.deepEqual(parseDuration(input), { kind: "invalid" }, input);
    }
  });

  test("caps the duration so -t never gets an exponent or an overflow", () => {
    assert.equal(MAX_SECONDS, 7 * 24 * 3600);
    assert.deepEqual(parseDuration("168h"), seconds(MAX_SECONDS));
    assert.deepEqual(parseDuration("169h"), { kind: "invalid" });
    assert.deepEqual(parseDuration("99999999999999999999999h"), { kind: "invalid" });
  });
});

describe("formatDuration", () => {
  test("is exact and skips empty parts", () => {
    assert.equal(formatDuration(45), "45s");
    assert.equal(formatDuration(90), "1m 30s");
    assert.equal(formatDuration(1800), "30m");
    assert.equal(formatDuration(5400), "1h 30m");
    assert.equal(formatDuration(7200), "2h");
    assert.equal(formatDuration(5415), "1h 30m 15s");
  });
});

describe("formatRemaining", () => {
  test("seconds under a minute", () => {
    assert.equal(formatRemaining(0), "0s");
    assert.equal(formatRemaining(-3), "0s");
    assert.equal(formatRemaining(45), "45s");
    assert.equal(formatRemaining(59), "59s");
  });

  test("rounds up to the minute", () => {
    assert.equal(formatRemaining(60), "1m");
    assert.equal(formatRemaining(61), "2m");
    assert.equal(formatRemaining(1800), "30m");
  });

  test("hours, with padded minutes", () => {
    assert.equal(formatRemaining(3599), "1h");
    assert.equal(formatRemaining(3600), "1h");
    assert.equal(formatRemaining(3660), "1h 01m");
    assert.equal(formatRemaining(5400), "1h 30m");
    assert.equal(formatRemaining(7200), "2h");
  });
});

describe("parseDisplayOffDelay", () => {
  test("defaults to one second", () => {
    assert.equal(parseDisplayOffDelay(undefined), 1);
    assert.equal(parseDisplayOffDelay(""), 1);
    assert.equal(parseDisplayOffDelay("abc"), 1);
    assert.equal(parseDisplayOffDelay("-2"), 1);
  });

  test("accepts zero and decimals", () => {
    assert.equal(parseDisplayOffDelay("0"), 0);
    assert.equal(parseDisplayOffDelay("2"), 2);
    assert.equal(parseDisplayOffDelay(" 0.5 "), 0.5);
    assert.equal(parseDisplayOffDelay("1,5"), 1.5);
  });

  test("is capped at thirty seconds", () => {
    assert.equal(parseDisplayOffDelay("30"), 30);
    assert.equal(parseDisplayOffDelay("120"), 30);
  });
});
