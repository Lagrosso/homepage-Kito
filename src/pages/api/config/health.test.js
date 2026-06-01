import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  isAdminSession: vi.fn((session) => session?.user?.role === "admin"),
  isAuthenticatedSession: vi.fn((session) => Boolean(session?.user)),
  loadUsers: vi.fn(() => [{ groups: ["media"], role: "viewer", username: "viewer" }]),
  readRawConfig: vi.fn((file) => {
    const files = {
      "services.yaml": "- Media: []\n",
      "bookmarks.yaml": "",
      "widgets.yaml": "",
      "settings.yaml": "theme: dark\n",
    };
    return files[file] ?? "";
  }),
}));

vi.mock("utils/config/config-writer", () => ({
  EDITABLE_CONFIGS: ["services.yaml", "bookmarks.yaml", "widgets.yaml", "settings.yaml"],
  isEditableConfig: (file) => ["services.yaml", "bookmarks.yaml", "widgets.yaml", "settings.yaml"].includes(file),
  readRawConfig: mocks.readRawConfig,
}));

vi.mock("utils/config/session", () => ({
  getSession: mocks.getSession,
  isAdminSession: mocks.isAdminSession,
  isAuthenticatedSession: mocks.isAuthenticatedSession,
}));

vi.mock("utils/config/users", () => ({
  loadUsers: mocks.loadUsers,
}));

vi.mock("utils/logger", () => ({ default: () => ({ error: vi.fn(), info: vi.fn() }) }));

import handler from "./health";

function req(method = "GET", body = undefined) {
  return { body, headers: {}, method };
}

describe("/api/config/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["GET", "POST"])("returns 401 for %s without a session", async (method) => {
    mocks.getSession.mockResolvedValue({});
    const res = createMockRes();

    await handler(req(method, { content: "", file: "services.yaml" }), res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toEqual({ error: "Not authenticated" });
  });

  it.each(["GET", "POST"])("returns 403 for %s with a viewer session", async (method) => {
    mocks.getSession.mockResolvedValue({ user: { role: "viewer", username: "viewer" } });
    const res = createMockRes();

    await handler(req(method, { content: "", file: "services.yaml" }), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({ error: "Admin role required" });
  });

  it("checks all editable files on GET", async () => {
    mocks.getSession.mockResolvedValue({ user: { role: "admin", username: "admin" } });
    const res = createMockRes();

    await handler(req(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(Object.keys(res.body.files)).toEqual(["services.yaml", "bookmarks.yaml", "widgets.yaml", "settings.yaml"]);
    expect(mocks.readRawConfig).toHaveBeenCalledWith("services.yaml");
    expect(mocks.readRawConfig).toHaveBeenCalledWith("settings.yaml");
  });

  it("checks posted editor content on POST", async () => {
    mocks.getSession.mockResolvedValue({ user: { role: "admin", username: "admin" } });
    const res = createMockRes();

    await handler(req("POST", { file: "services.yaml", content: "not: a-list\n" }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(Object.keys(res.body.files)).toEqual(["services.yaml"]);
    expect(res.body.summary.errors).toBe(1);
  });

  it("rejects non-editable files on POST", async () => {
    mocks.getSession.mockResolvedValue({ user: { role: "admin", username: "admin" } });
    const res = createMockRes();

    await handler(req("POST", { file: "users.yaml", content: "" }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toContain("not editable");
  });
});
