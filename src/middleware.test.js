import { beforeEach, describe, expect, it, vi } from "vitest";

const { NextResponse, sessionMocks } = vi.hoisted(() => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ type: "json", body, init })),
    next: vi.fn(() => ({ type: "next" })),
    redirect: vi.fn((url) => ({ type: "redirect", url: url.toString() })),
  },
  sessionMocks: {
    getSessionFromRequest: vi.fn(),
    isAuthenticatedSession: vi.fn((session) => Boolean(session?.user)),
  },
}));

vi.mock("next/server", () => ({ NextResponse }));
vi.mock("utils/config/session", () => ({
  getSessionFromRequest: sessionMocks.getSessionFromRequest,
  isAuthenticatedSession: sessionMocks.isAuthenticatedSession,
}));

import { middleware } from "./middleware";

function cloneableUrl(value) {
  const url = new URL(value);
  url.clone = () => cloneableUrl(url.toString());
  return url;
}

function createReq(host, url = "http://localhost:3000/") {
  return {
    headers: {
      get: (key) => (key === "host" ? host : null),
    },
    nextUrl: cloneableUrl(url),
  };
}

describe("middleware", () => {
  const originalEnv = process.env;
  const originalConsoleError = console.error;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    console.error = originalConsoleError;
    sessionMocks.getSessionFromRequest.mockResolvedValue({});
  });

  it("allows authenticated requests for default localhost hosts", async () => {
    process.env.PORT = "3000";
    sessionMocks.getSessionFromRequest.mockResolvedValue({ user: { role: "viewer", username: "viewer" } });
    const res = await middleware(createReq("localhost:3000"));

    expect(NextResponse.next).toHaveBeenCalled();
    expect(res).toEqual({ type: "next" });
  });

  it("blocks requests when host is not allowed", async () => {
    process.env.PORT = "3000";
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await middleware(createReq("evil.com"));

    expect(errSpy).toHaveBeenCalled();
    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "Host validation failed. See logs for more details." },
      { status: 400 },
    );
    expect(res.type).toBe("json");
    expect(res.init.status).toBe(400);
    expect(sessionMocks.getSessionFromRequest).not.toHaveBeenCalled();
  });

  it("allows requests when HOMEPAGE_ALLOWED_HOSTS is '*'", async () => {
    process.env.HOMEPAGE_ALLOWED_HOSTS = "*";
    sessionMocks.getSessionFromRequest.mockResolvedValue({ user: { role: "viewer", username: "viewer" } });
    const res = await middleware(createReq("anything.example"));

    expect(NextResponse.next).toHaveBeenCalled();
    expect(res).toEqual({ type: "next" });
  });

  it("allows requests when host is included in HOMEPAGE_ALLOWED_HOSTS", async () => {
    process.env.PORT = "3000";
    process.env.HOMEPAGE_ALLOWED_HOSTS = "example.com:3000,other:3000";
    sessionMocks.getSessionFromRequest.mockResolvedValue({ user: { role: "viewer", username: "viewer" } });

    const res = await middleware(createReq("example.com:3000", "http://example.com:3000/"));

    expect(NextResponse.next).toHaveBeenCalled();
    expect(res).toEqual({ type: "next" });
  });

  it.each([
    "/login",
    "/setup",
    "/api/auth/state",
    "/api/healthcheck",
    "/_next/static/chunk.js",
    "/favicon-32x32.png",
  ])(
    "allows public path %s without a session",
    async (path) => {
      const res = await middleware(createReq("localhost:3000", `http://localhost:3000${path}`));

      expect(res).toEqual({ type: "next" });
      expect(sessionMocks.getSessionFromRequest).not.toHaveBeenCalled();
    },
  );

  it("redirects page requests without a session to login", async () => {
    const res = await middleware(createReq("localhost:3000", "http://localhost:3000/admin/config?tab=x"));

    expect(NextResponse.redirect).toHaveBeenCalled();
    expect(res.type).toBe("redirect");
    expect(res.url).toBe("http://localhost:3000/login?next=%2Fadmin%2Fconfig%3Ftab%3Dx");
  });

  it("returns 401 for api requests without a session", async () => {
    const res = await middleware(createReq("localhost:3000", "http://localhost:3000/api/services"));

    expect(NextResponse.json).toHaveBeenCalledWith({ error: "Not authenticated" }, { status: 401 });
    expect(res).toEqual({ type: "json", body: { error: "Not authenticated" }, init: { status: 401 } });
  });
});
