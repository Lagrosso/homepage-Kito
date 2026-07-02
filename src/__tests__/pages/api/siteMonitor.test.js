import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const { getServiceItem, httpProxy, perf, logger, getSession, findUser } = vi.hoisted(() => ({
  findUser: vi.fn(),
  getServiceItem: vi.fn(),
  getSession: vi.fn(),
  httpProxy: vi.fn(),
  perf: { now: vi.fn() },
  logger: { debug: vi.fn() },
}));

vi.mock("perf_hooks", () => ({
  performance: perf,
}));

vi.mock("utils/config/service-helpers", () => ({
  getServiceItem,
}));
vi.mock("utils/config/session", () => ({ getSession }));
vi.mock("utils/config/users", () => ({ findUser, normalizeGroups: (groups) => (Array.isArray(groups) ? groups : []) }));

vi.mock("utils/proxy/http", () => ({
  httpProxy,
}));

vi.mock("utils/logger", () => ({
  default: () => logger,
}));

import handler from "pages/api/siteMonitor";

describe("pages/api/siteMonitor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { username: "viewer", role: "viewer", groups: ["media"] } });
    findUser.mockReturnValue({ username: "viewer", role: "viewer", groups: ["media"] });
  });

  it("returns 400 when the service item is missing", async () => {
    getServiceItem.mockResolvedValueOnce(null);

    const req = { query: { groupName: "g", serviceName: "s" } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("Unable to find service");
  });

  it("returns 400 when the monitor URL is missing", async () => {
    getServiceItem.mockResolvedValueOnce({ siteMonitor: "" });

    const req = { query: { groupName: "g", serviceName: "s" } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("No http monitor URL given");
  });

  it("returns 403 when the service is hidden from the user", async () => {
    getServiceItem.mockResolvedValueOnce({ siteMonitor: "http://example.com", access: { groups: ["kids"] } });

    const req = { query: { groupName: "g", serviceName: "s" } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(403);
    expect(httpProxy).not.toHaveBeenCalled();
  });

  it("uses HEAD with a bounded timeout and returns status + latency when the response is OK", async () => {
    getServiceItem.mockResolvedValueOnce({ siteMonitor: "http://example.com" });
    perf.now.mockReturnValueOnce(1).mockReturnValueOnce(11);
    httpProxy.mockResolvedValueOnce([200]);

    const req = { query: { groupName: "g", serviceName: "s" } };
    const res = createMockRes();

    await handler(req, res);

    expect(httpProxy).toHaveBeenCalledWith("http://example.com", { method: "HEAD", timeout: 5000 });
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe(200);
    expect(res.body.latency).toBe(10);
  });

  it("falls back to GET (also bounded) when HEAD is rejected", async () => {
    getServiceItem.mockResolvedValueOnce({ siteMonitor: "http://example.com" });
    perf.now.mockReturnValueOnce(1).mockReturnValueOnce(2).mockReturnValueOnce(5).mockReturnValueOnce(15);
    httpProxy.mockResolvedValueOnce([500]).mockResolvedValueOnce([200]);

    const req = { query: { groupName: "g", serviceName: "s" } };
    const res = createMockRes();

    await handler(req, res);

    expect(httpProxy).toHaveBeenNthCalledWith(1, "http://example.com", { method: "HEAD", timeout: 5000 });
    expect(httpProxy).toHaveBeenNthCalledWith(2, "http://example.com", { timeout: 5000 });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: 200, latency: 10 });
  });

  it("honours HOMEPAGE_MONITOR_TIMEOUT for the probe timeout", async () => {
    const prev = process.env.HOMEPAGE_MONITOR_TIMEOUT;
    process.env.HOMEPAGE_MONITOR_TIMEOUT = "3000";
    try {
      getServiceItem.mockResolvedValueOnce({ siteMonitor: "http://example.com" });
      perf.now.mockReturnValueOnce(1).mockReturnValueOnce(11);
      httpProxy.mockResolvedValueOnce([200]);

      const req = { query: { groupName: "g", serviceName: "s" } };
      const res = createMockRes();

      await handler(req, res);

      expect(httpProxy).toHaveBeenCalledWith("http://example.com", { method: "HEAD", timeout: 3000 });
    } finally {
      if (prev === undefined) delete process.env.HOMEPAGE_MONITOR_TIMEOUT;
      else process.env.HOMEPAGE_MONITOR_TIMEOUT = prev;
    }
  });

  it("does NOT retry with GET when HEAD fails with a network error/timeout (synthetic 500)", async () => {
    getServiceItem.mockResolvedValueOnce({ siteMonitor: "http://unreachable.local" });
    perf.now.mockReturnValueOnce(0).mockReturnValueOnce(5000);
    // httpProxy's shape for a network error/timeout: [500, "application/json", { error }]
    httpProxy.mockResolvedValueOnce([500, "application/json", { error: { message: "timed out" } }]);

    const req = { query: { groupName: "g", serviceName: "s" } };
    const res = createMockRes();

    await handler(req, res);

    // Only ONE call — no doubling of the timeout on an unreachable host.
    expect(httpProxy).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe(500);
  });

  it("returns 400 when httpProxy throws", async () => {
    getServiceItem.mockResolvedValueOnce({ siteMonitor: "http://example.com" });
    httpProxy.mockRejectedValueOnce(new Error("nope"));

    const req = { query: { groupName: "g", serviceName: "s" } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("Error attempting http monitor");
  });
});
