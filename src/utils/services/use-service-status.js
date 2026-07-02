import useSWR from "swr";

// Shared client-side source for per-service status. All service tiles (Ping,
// SiteMonitor) read from this ONE aggregated endpoint instead of each firing
// their own /api/ping or /api/siteMonitor request. SWR deduplicates by key, so
// N tiles collapse into a single HTTP request — this keeps a burst of tiles from
// saturating the browser's per-origin HTTP/1.1 connection pool (which otherwise
// stalls page navigation behind hanging checks to unreachable hosts).

export const SERVICE_STATUS_KEY = "/api/services/status";
export const SERVICE_STATUS_REFRESH_MS = 30000;

// Single shared SWR subscription to the aggregated status report. Using an
// identical key + options everywhere guarantees SWR dedupes into one request.
export function useServiceStatusReport() {
  return useSWR(SERVICE_STATUS_KEY, { refreshInterval: SERVICE_STATUS_REFRESH_MS });
}

// Look up one service's aggregated status entry by its group + name.
export function findServiceStatus(report, groupName, serviceName) {
  return report?.services?.find((status) => status.group === groupName && status.name === serviceName);
}

// Find a specific raw signal (e.g. "ping" or "siteMonitor") on a status entry.
// A service may carry several signals; each tile reads only its own type.
export function findSignal(status, signalType) {
  return status?.signals?.find((signal) => signal.signalType === signalType);
}
