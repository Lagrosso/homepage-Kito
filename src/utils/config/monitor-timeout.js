// Shared, configurable timeout for read-only reachability checks (siteMonitor HTTP
// probes and the aggregated service-status check). Unreachable/silently-dropping
// hosts — e.g. a device on a different subnet than the one the browser is currently
// on — would otherwise hang these checks for the OS-level TCP timeout (observed at
// 30+ seconds), saturating the browser's per-origin HTTP/1.1 connection pool and
// stalling unrelated navigations. A monitor check only needs a fast up/down answer,
// so we bound it aggressively.
//
// Override via HOMEPAGE_MONITOR_TIMEOUT (milliseconds). Set it to 0 to disable the
// monitor-specific bound (falls back to httpProxy's own default timeout).

export const DEFAULT_MONITOR_TIMEOUT_MS = 5000;

// Returns the monitor timeout in milliseconds. Invalid/negative values fall back to
// the default; an explicit 0 is honoured (disables the monitor-specific bound).
export function getMonitorTimeoutMs() {
  const raw = process.env.HOMEPAGE_MONITOR_TIMEOUT;
  if (raw === undefined || raw === null || raw === "") {
    return DEFAULT_MONITOR_TIMEOUT_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_MONITOR_TIMEOUT_MS;
  }
  return parsed;
}

// True only when the operator has explicitly configured a monitor timeout. Used by
// the ping endpoint, which is already bounded by the ping library's own fast default
// (~2s) and should only be overridden when the operator opts in — never made slower
// by the 5s HTTP default.
export function hasExplicitMonitorTimeout() {
  const raw = process.env.HOMEPAGE_MONITOR_TIMEOUT;
  return raw !== undefined && raw !== null && raw !== "";
}

// Ping's library takes seconds. Convert the configured ms value, with a 1s floor so
// an explicit sub-second setting never rounds down to 0 (which the library treats as
// "no timeout").
export function getMonitorTimeoutSeconds() {
  return Math.max(1, Math.round(getMonitorTimeoutMs() / 1000));
}
