import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  isAdminSession: vi.fn((session) => session?.user?.role === "admin"),
  isAuthenticatedSession: vi.fn((session) => Boolean(session?.user)),
  suggestServiceIcons: vi.fn(),
}));

vi.mock("utils/config/session", () => ({
  getSession: mocks.getSession,
  isAdminSession: mocks.isAdminSession,
  isAuthenticatedSession: mocks.isAuthenticatedSession,
}));

vi.mock("utils/config/icon-suggestions", () => ({
  suggestServiceIcons: mocks.suggestServiceIcons,
}));

import handler from "./icon-suggestions";

function req(method = "POST", body = {}) {
  return { body, headers: {}, method };
}

describe("/api/config/icon-suggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    mocks.getSession.mockResolvedValue({});
    const res = createMockRes();

    await handler(req(), res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.suggestServiceIcons).not.toHaveBeenCalled();
  });

  it("rejects viewer requests", async () => {
    mocks.getSession.mockResolvedValue({ user: { role: "viewer", username: "viewer" } });
    const res = createMockRes();

    await handler(req(), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.suggestServiceIcons).not.toHaveBeenCalled();
  });

  it("returns sanitized suggestions for admins", async () => {
    mocks.getSession.mockResolvedValue({ user: { role: "admin", username: "admin" } });
    mocks.suggestServiceIcons.mockResolvedValue([{ source: "dashboard-icons", icon: "jellyfin.svg" }]);
    const res = createMockRes();

    await handler(
      req("POST", {
        name: " Jellyfin ",
        href: "https://jellyfin.test/",
        widgetType: "jellyfin",
        currentIcon: "old.png",
        password: "must-not-pass-through",
      }),
      res,
    );

    expect(mocks.suggestServiceIcons).toHaveBeenCalledWith({
      name: "Jellyfin",
      href: "https://jellyfin.test/",
      widgetType: "jellyfin",
      currentIcon: "old.png",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ suggestions: [{ source: "dashboard-icons", icon: "jellyfin.svg" }] });
  });

  it("returns an empty list when suggestion lookup fails", async () => {
    mocks.getSession.mockResolvedValue({ user: { role: "admin", username: "admin" } });
    mocks.suggestServiceIcons.mockRejectedValue(new Error("network failed"));
    const res = createMockRes();

    await handler(req(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ suggestions: [] });
  });

  it("allows only POST", async () => {
    mocks.getSession.mockResolvedValue({ user: { role: "admin", username: "admin" } });
    const res = createMockRes();

    await handler(req("GET"), res);

    expect(res.setHeader).toHaveBeenCalledWith("Allow", "POST");
    expect(res.status).toHaveBeenCalledWith(405);
  });
});
