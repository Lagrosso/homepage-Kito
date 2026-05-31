import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  isAdminSession: vi.fn((session) => session?.user?.role === "admin"),
  isAuthenticatedSession: vi.fn((session) => Boolean(session?.user)),
}));

vi.mock("utils/config/session", () => ({
  getSession: mocks.getSession,
  isAdminSession: mocks.isAdminSession,
  isAuthenticatedSession: mocks.isAuthenticatedSession,
}));

import handler from "./status";

function req(method = "GET") {
  return { headers: {}, method };
}

describe("/api/config/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports editable for admins", async () => {
    mocks.getSession.mockResolvedValue({ user: { role: "admin", username: "admin" } });
    const res = createMockRes();

    await handler(req(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ authenticated: true, enabled: true, isAdmin: true, role: "admin" });
  });

  it("reports not editable for viewers", async () => {
    mocks.getSession.mockResolvedValue({ user: { role: "viewer", username: "viewer" } });
    const res = createMockRes();

    await handler(req(), res);

    expect(res.body).toEqual({ authenticated: true, enabled: false, isAdmin: false, role: "viewer" });
  });

  it("reports not editable without a session", async () => {
    mocks.getSession.mockResolvedValue({});
    const res = createMockRes();

    await handler(req(), res);

    expect(res.body).toEqual({ authenticated: false, enabled: false, isAdmin: false, role: null });
  });
});
