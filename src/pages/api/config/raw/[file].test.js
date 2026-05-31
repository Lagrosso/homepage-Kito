import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  isAdminSession: vi.fn((session) => session?.user?.role === "admin"),
  isAuthenticatedSession: vi.fn((session) => Boolean(session?.user)),
  isEditableConfig: vi.fn((file) => file === "services.yaml"),
  readRawConfig: vi.fn(() => "raw: true\n"),
  writeRawConfig: vi.fn(() => ({ backupPath: "/tmp/backup", written: true })),
}));

vi.mock("utils/config/config-writer", () => ({
  isEditableConfig: mocks.isEditableConfig,
  readRawConfig: mocks.readRawConfig,
  writeRawConfig: mocks.writeRawConfig,
}));

vi.mock("utils/config/session", () => ({
  getSession: mocks.getSession,
  isAdminSession: mocks.isAdminSession,
  isAuthenticatedSession: mocks.isAuthenticatedSession,
}));

vi.mock("utils/logger", () => ({ default: () => ({ error: vi.fn(), info: vi.fn() }) }));

import handler from "./[file]";

function req(method, body) {
  return { body, headers: {}, method, query: { file: "services.yaml" } };
}

describe("/api/config/raw/[file]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["GET", "POST"])("returns 401 for %s without a session", async (method) => {
    mocks.getSession.mockResolvedValue({});
    const res = createMockRes();

    await handler(req(method, { content: "x: true\n" }), res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toEqual({ error: "Not authenticated" });
  });

  it.each(["GET", "POST"])("returns 403 for %s with a viewer session", async (method) => {
    mocks.getSession.mockResolvedValue({ user: { role: "viewer", username: "viewer" } });
    const res = createMockRes();

    await handler(req(method, { content: "x: true\n" }), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({ error: "Admin role required" });
  });

  it("allows raw GET for admins", async () => {
    mocks.getSession.mockResolvedValue({ user: { role: "admin", username: "admin" } });
    const res = createMockRes();

    await handler(req("GET"), res);

    expect(mocks.readRawConfig).toHaveBeenCalledWith("services.yaml");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ content: "raw: true\n", file: "services.yaml" });
  });

  it("allows raw POST for admins without an Authorization header", async () => {
    mocks.getSession.mockResolvedValue({ user: { role: "admin", username: "admin" } });
    const res = createMockRes();

    await handler(req("POST", { content: "x: true\n" }), res);

    expect(mocks.writeRawConfig).toHaveBeenCalledWith("services.yaml", "x: true\n");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ backupPath: "/tmp/backup", written: true });
  });
});
