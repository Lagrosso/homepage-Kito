import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  SESSION_COOKIE_NAME,
  SESSION_ROLES,
  SESSION_SECRET_MIN_LENGTH,
  SESSION_TTL_SECONDS,
  getSessionFromRequest,
  getSessionOptions,
  isAdminSession,
  isAuthenticatedSession,
  isValidSessionSecret,
  isValidSessionUser,
  requireSessionSecret,
} from "utils/config/session";

const VALID_SECRET = "0123456789abcdef0123456789abcdef";

afterEach(() => {
  delete process.env.HOMEPAGE_SESSION_SECRET;
});

describe("session config", () => {
  it("rejects a missing HOMEPAGE_SESSION_SECRET", () => {
    delete process.env.HOMEPAGE_SESSION_SECRET;

    expect(isValidSessionSecret(undefined)).toBe(false);
    expect(() => requireSessionSecret()).toThrow("HOMEPAGE_SESSION_SECRET is required");
    expect(() => getSessionOptions()).toThrow("HOMEPAGE_SESSION_SECRET is required");
  });

  it("rejects a HOMEPAGE_SESSION_SECRET shorter than 32 characters", () => {
    process.env.HOMEPAGE_SESSION_SECRET = "short-secret";

    expect(isValidSessionSecret(process.env.HOMEPAGE_SESSION_SECRET)).toBe(false);
    expect(() => requireSessionSecret()).toThrow(
      `HOMEPAGE_SESSION_SECRET must be at least ${SESSION_SECRET_MIN_LENGTH} characters long`,
    );
    expect(() => getSessionOptions()).toThrow(
      `HOMEPAGE_SESSION_SECRET must be at least ${SESSION_SECRET_MIN_LENGTH} characters long`,
    );
  });

  it("creates valid iron-session options from a valid secret", () => {
    process.env.HOMEPAGE_SESSION_SECRET = VALID_SECRET;

    expect(getSessionOptions()).toEqual({
      cookieName: SESSION_COOKIE_NAME,
      password: VALID_SECRET,
      ttl: SESSION_TTL_SECONDS,
      cookieOptions: {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: false,
      },
    });
  });

  it("marks the cookie Secure only when HOMEPAGE_SECURE_COOKIE=true", () => {
    process.env.HOMEPAGE_SESSION_SECRET = VALID_SECRET;

    delete process.env.HOMEPAGE_SECURE_COOKIE;
    expect(getSessionOptions().cookieOptions.secure).toBe(false);

    process.env.HOMEPAGE_SECURE_COOKIE = "true";
    expect(getSessionOptions().cookieOptions.secure).toBe(true);

    process.env.HOMEPAGE_SECURE_COOKIE = "false";
    expect(getSessionOptions().cookieOptions.secure).toBe(false);
  });

  it("sets secure cookie defaults for the homepage session", () => {
    process.env.HOMEPAGE_SESSION_SECRET = VALID_SECRET;

    const options = getSessionOptions();

    expect(options.cookieName).toBe("homepage_session");
    expect(options.cookieName).toMatch(/homepage.*session/);
    expect(options.cookieOptions.httpOnly).toBe(true);
    expect(options.cookieOptions.sameSite).toBe("lax");
    expect(options.cookieOptions.path).toBe("/");
  });

  it("stores and reads encrypted user data through the session cookie", async () => {
    process.env.HOMEPAGE_SESSION_SECRET = VALID_SECRET;

    const response = new Response();
    const session = await getSessionFromRequest(new Request("http://localhost/"), response);
    session.user = { username: "admin", role: "admin" };
    await session.save();

    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).not.toContain("admin");

    const cookie = setCookie.split(";")[0];
    const nextSession = await getSessionFromRequest(
      new Request("http://localhost/", { headers: { cookie } }),
      new Response(),
    );

    expect(nextSession.user).toEqual({ username: "admin", role: "admin" });
  });

  it("validates v1 session user data", () => {
    expect(SESSION_ROLES).toEqual(["admin", "viewer"]);
    expect(isValidSessionUser({ username: "admin", role: "admin" })).toBe(true);
    expect(isValidSessionUser({ username: "reader", role: "viewer" })).toBe(true);
    expect(isValidSessionUser({ username: "reader", role: "editor" })).toBe(false);
    expect(isAuthenticatedSession({ user: { username: "admin", role: "admin" } })).toBe(true);
    expect(isAdminSession({ user: { username: "admin", role: "admin" } })).toBe(true);
    expect(isAdminSession({ user: { username: "reader", role: "viewer" } })).toBe(false);
  });

  it("keeps the session module edge-safe without fs or node:crypto imports", () => {
    const source = readFileSync(join(process.cwd(), "src/utils/config/session.js"), "utf8");

    expect(source).not.toMatch(/from ["'](?:node:)?fs["']/);
    expect(source).not.toMatch(/from ["'](?:node:)?crypto["']/);
    expect(source).not.toContain("require(\"fs\")");
    expect(source).not.toContain("require(\"node:fs\")");
    expect(source).not.toContain("require(\"crypto\")");
    expect(source).not.toContain("require(\"node:crypto\")");
  });
});
