import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_MONITOR_TIMEOUT_MS,
  getMonitorTimeoutMs,
  getMonitorTimeoutSeconds,
  hasExplicitMonitorTimeout,
} from "./monitor-timeout";

describe("utils/config/monitor-timeout", () => {
  let prev;

  beforeEach(() => {
    prev = process.env.HOMEPAGE_MONITOR_TIMEOUT;
    delete process.env.HOMEPAGE_MONITOR_TIMEOUT;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.HOMEPAGE_MONITOR_TIMEOUT;
    else process.env.HOMEPAGE_MONITOR_TIMEOUT = prev;
  });

  it("returns the default when the env var is unset", () => {
    expect(getMonitorTimeoutMs()).toBe(DEFAULT_MONITOR_TIMEOUT_MS);
    expect(hasExplicitMonitorTimeout()).toBe(false);
  });

  it("returns the default for an empty string", () => {
    process.env.HOMEPAGE_MONITOR_TIMEOUT = "";
    expect(getMonitorTimeoutMs()).toBe(DEFAULT_MONITOR_TIMEOUT_MS);
    expect(hasExplicitMonitorTimeout()).toBe(false);
  });

  it("parses a valid numeric override", () => {
    process.env.HOMEPAGE_MONITOR_TIMEOUT = "3000";
    expect(getMonitorTimeoutMs()).toBe(3000);
    expect(hasExplicitMonitorTimeout()).toBe(true);
  });

  it("honours an explicit 0 (disables the monitor-specific bound)", () => {
    process.env.HOMEPAGE_MONITOR_TIMEOUT = "0";
    expect(getMonitorTimeoutMs()).toBe(0);
    expect(hasExplicitMonitorTimeout()).toBe(true);
  });

  it("falls back to the default for non-numeric or negative values", () => {
    process.env.HOMEPAGE_MONITOR_TIMEOUT = "abc";
    expect(getMonitorTimeoutMs()).toBe(DEFAULT_MONITOR_TIMEOUT_MS);

    process.env.HOMEPAGE_MONITOR_TIMEOUT = "-500";
    expect(getMonitorTimeoutMs()).toBe(DEFAULT_MONITOR_TIMEOUT_MS);
  });

  it("converts to seconds with a 1s floor", () => {
    expect(getMonitorTimeoutSeconds()).toBe(5); // default 5000ms

    process.env.HOMEPAGE_MONITOR_TIMEOUT = "3000";
    expect(getMonitorTimeoutSeconds()).toBe(3);

    process.env.HOMEPAGE_MONITOR_TIMEOUT = "200"; // rounds to 0 -> floored to 1
    expect(getMonitorTimeoutSeconds()).toBe(1);
  });
});
