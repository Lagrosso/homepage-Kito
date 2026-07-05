import { existsSync, readFileSync, rmSync } from "fs";
import { join } from "path";

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const { TMP, mocks } = vi.hoisted(() => {
  const { mkdtempSync } = require("fs");
  const { tmpdir } = require("os");
  const { join: joinPath } = require("path");
  return {
    TMP: mkdtempSync(joinPath(tmpdir(), "kito-icon-api-")),
    mocks: {
      getSession: vi.fn(),
      isAdminSession: vi.fn((session) => session?.user?.role === "admin"),
      isAuthenticatedSession: vi.fn((session) => Boolean(session?.user)),
    },
  };
});

vi.mock("utils/config/config", () => ({ CONF_DIR: TMP }));
vi.mock("utils/logger", () => ({
  default: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock("utils/config/session", () => ({
  getSession: mocks.getSession,
  isAdminSession: mocks.isAdminSession,
  isAuthenticatedSession: mocks.isAuthenticatedSession,
}));

import handler from "./icon";

const PNG_DATA_URL = `data:image/png;base64,${Buffer.from("fake-png").toString("base64")}`;

function req(method, { body = {}, query = {} } = {}) {
  return { method, body, query, headers: {} };
}

function asAdmin() {
  mocks.getSession.mockResolvedValue({ user: { role: "admin", username: "admin" } });
}

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

describe("/api/config/icon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rmSync(join(TMP, "icons"), { recursive: true, force: true });
  });

  it("rejects unauthenticated requests", async () => {
    mocks.getSession.mockResolvedValue({});
    const res = createMockRes();
    await handler(req("GET", { query: {} }), res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("uploads a base64 icon and stores it on disk (admin)", async () => {
    asAdmin();
    const res = createMockRes();
    await handler(req("POST", { body: { filename: "my icon.png", dataUrl: PNG_DATA_URL } }), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.path).toBe("/api/config/icon?file=my_icon.png");
    expect(existsSync(join(TMP, "icons", "my_icon.png"))).toBe(true);
    expect(readFileSync(join(TMP, "icons", "my_icon.png")).toString()).toBe("fake-png");
  });

  it("rejects an unsupported upload type", async () => {
    asAdmin();
    const res = createMockRes();
    await handler(req("POST", { body: { filename: "evil.exe", dataUrl: PNG_DATA_URL } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("serves an uploaded icon to any authenticated user", async () => {
    asAdmin();
    await handler(req("POST", { body: { filename: "logo.png", dataUrl: PNG_DATA_URL } }), createMockRes());

    mocks.getSession.mockResolvedValue({ user: { role: "viewer", username: "viewer" } });
    const res = createMockRes();
    await handler(req("GET", { query: { file: "logo.png" } }), res);
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/png");
    expect(res.send).toHaveBeenCalled();
    expect(res.body.toString()).toBe("fake-png");
  });

  it("404s a missing icon", async () => {
    asAdmin();
    const res = createMockRes();
    await handler(req("GET", { query: { file: "nope.png" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("lists local icons for admins only", async () => {
    asAdmin();
    await handler(req("POST", { body: { filename: "a.png", dataUrl: PNG_DATA_URL } }), createMockRes());
    const res = createMockRes();
    await handler(req("GET", { query: {} }), res);
    expect(res.body).toEqual({ files: ["a.png"] });

    mocks.getSession.mockResolvedValue({ user: { role: "viewer", username: "viewer" } });
    const denied = createMockRes();
    await handler(req("GET", { query: {} }), denied);
    expect(denied.status).toHaveBeenCalledWith(403);
  });

  it("caches a remote icon from a sourceUrl (admin)", async () => {
    asAdmin();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "image/svg+xml" },
      arrayBuffer: async () => Buffer.from("<svg/>"),
    });
    const res = createMockRes();
    await handler(
      req("POST", { body: { sourceUrl: "https://cdn.example.com/icons/grafana.svg" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.path).toBe("/api/config/icon?file=grafana.svg");
    expect(readFileSync(join(TMP, "icons", "grafana.svg")).toString()).toBe("<svg/>");
  });

  it("rejects a sourceUrl that does not return an image", async () => {
    asAdmin();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "text/html" },
      arrayBuffer: async () => Buffer.from("<html/>"),
    });
    const res = createMockRes();
    await handler(req("POST", { body: { sourceUrl: "https://evil.example.com/page" } }), res);
    expect(res.status).toHaveBeenCalledWith(415);
  });

  it("derives an extension from content-type when the URL has none", async () => {
    asAdmin();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "image/png" },
      arrayBuffer: async () => Buffer.from("png"),
    });
    const res = createMockRes();
    await handler(req("POST", { body: { sourceUrl: "https://cdn.example.com/favicon" } }), res);
    expect(res.body.filename).toBe("favicon.png");
  });

  it("rejects POST from viewers", async () => {
    mocks.getSession.mockResolvedValue({ user: { role: "viewer", username: "viewer" } });
    const res = createMockRes();
    await handler(req("POST", { body: { filename: "a.png", dataUrl: PNG_DATA_URL } }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("405s other methods", async () => {
    asAdmin();
    const res = createMockRes();
    await handler(req("DELETE"), res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});
