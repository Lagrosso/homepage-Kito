import { beforeEach, describe, expect, it, vi } from "vitest";

const { useSWR } = vi.hoisted(() => ({ useSWR: vi.fn() }));

vi.mock("swr", () => ({ default: useSWR }));

import {
  SERVICE_STATUS_KEY,
  SERVICE_STATUS_REFRESH_MS,
  findServiceStatus,
  findSignal,
  useServiceStatusReport,
} from "./use-service-status";

describe("utils/services/use-service-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("subscribes to the shared aggregated key with a refresh interval (enables SWR dedup)", () => {
    useSWR.mockReturnValue({ data: undefined, error: undefined });

    useServiceStatusReport();

    expect(useSWR).toHaveBeenCalledWith(SERVICE_STATUS_KEY, { refreshInterval: SERVICE_STATUS_REFRESH_MS });
    expect(SERVICE_STATUS_KEY).toBe("/api/services/status");
  });

  it("finds a service status entry by group + name", () => {
    const report = {
      services: [
        { group: "A", name: "one", signals: [] },
        { group: "B", name: "two", signals: [] },
      ],
    };

    expect(findServiceStatus(report, "B", "two")).toBe(report.services[1]);
  });

  it("returns undefined for a missing entry or missing report", () => {
    expect(findServiceStatus(undefined, "A", "one")).toBeUndefined();
    expect(findServiceStatus({ services: [] }, "A", "one")).toBeUndefined();
    expect(findServiceStatus({ services: [{ group: "A", name: "one" }] }, "A", "other")).toBeUndefined();
  });

  it("finds a specific signal type on a status entry", () => {
    const status = {
      signals: [
        { signalType: "ping", state: "up" },
        { signalType: "siteMonitor", state: "down" },
      ],
    };

    expect(findSignal(status, "siteMonitor")).toEqual({ signalType: "siteMonitor", state: "down" });
    expect(findSignal(status, "docker")).toBeUndefined();
    expect(findSignal(undefined, "ping")).toBeUndefined();
    expect(findSignal({}, "ping")).toBeUndefined();
  });
});
