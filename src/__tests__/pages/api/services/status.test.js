import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const { buildServiceStatusReport, getSession, findUser, isAuthenticatedSession } = vi.hoisted(() => ({
  buildServiceStatusReport: vi.fn(),
  getSession: vi.fn(),
  findUser: vi.fn(),
  isAuthenticatedSession: vi.fn(),
}));

vi.mock("utils/config/service-status", () => ({
  buildServiceStatusReport,
  filterStatuses: vi.fn((services, filter, source) =>
    services.filter((service) => {
      if (source !== "all" && service.signalType !== source) return false;
      if (filter === "problematic") return service.severity === "critical" || service.severity === "warning";
      if (filter === "slow") return service.detailLabel?.toLowerCase().includes("slow");
      if (filter === "no-check") return service.state === "no-check";
      return true;
    }),
  ),
  sortStatuses: vi.fn((services) => services),
}));
vi.mock("utils/config/session", () => ({ getSession, isAuthenticatedSession }));
vi.mock("utils/config/users", () => ({ findUser }));

import handler from "pages/api/services/status";

describe("pages/api/services/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { username: "viewer", role: "viewer", groups: ["media"] } });
    isAuthenticatedSession.mockReturnValue(true);
    findUser.mockReturnValue({ username: "viewer", role: "viewer", groups: ["media"] });
  });

  it("returns 401 for unauthenticated sessions", async () => {
    isAuthenticatedSession.mockReturnValue(false);

    const req = { method: "GET", query: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
  });

  it("returns the full report for the current user", async () => {
    buildServiceStatusReport.mockResolvedValue({
      generatedAt: "2026-06-03T00:00:00.000Z",
      summary: { total: 2, problematic: 1, slow: 1, noCheck: 0, ok: 1, neutral: 0 },
      services: [
        { id: "a", signalType: "ping", severity: "warning", state: "up", detailLabel: "Slow ping (1200 ms)" },
        { id: "b", signalType: "docker", severity: "ok", state: "up", detailLabel: "Docker running" },
      ],
    });

    const req = { method: "GET", query: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(buildServiceStatusReport).toHaveBeenCalledWith({ username: "viewer", role: "viewer", groups: ["media"] });
    expect(res.statusCode).toBe(200);
    expect(res.body.summary.problematic).toBe(1);
    expect(res.body.services).toHaveLength(2);
  });

  it("filters the response by query parameters", async () => {
    buildServiceStatusReport.mockResolvedValue({
      generatedAt: "2026-06-03T00:00:00.000Z",
      summary: { total: 3, problematic: 2, slow: 1, noCheck: 1, ok: 0, neutral: 0 },
      services: [
        { id: "a", signalType: "ping", severity: "warning", state: "up", detailLabel: "Slow ping (1200 ms)" },
        { id: "b", signalType: "siteMonitor", severity: "critical", state: "down", detailLabel: "HTTP 500" },
        { id: "c", signalType: "none", severity: "neutral", state: "no-check", detailLabel: "No check configured" },
      ],
    });

    const req = { method: "GET", query: { filter: "no-check", source: "none" } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.services).toEqual([
      { id: "c", signalType: "none", severity: "neutral", state: "no-check", detailLabel: "No check configured" },
    ]);
  });
});
