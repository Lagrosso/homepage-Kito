import { getIronSession } from "iron-session";

export const SESSION_COOKIE_NAME = "homepage_session";
export const SESSION_SECRET_MIN_LENGTH = 32;
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
export const SESSION_ROLES = ["admin", "viewer"];

export function isValidSessionSecret(secret) {
  return typeof secret === "string" && secret.length >= SESSION_SECRET_MIN_LENGTH;
}

export function requireSessionSecret() {
  const secret = process.env.HOMEPAGE_SESSION_SECRET;

  if (!secret) {
    throw new Error("HOMEPAGE_SESSION_SECRET is required");
  }

  if (!isValidSessionSecret(secret)) {
    throw new Error(`HOMEPAGE_SESSION_SECRET must be at least ${SESSION_SECRET_MIN_LENGTH} characters long`);
  }

  return secret;
}

// The session cookie is marked `Secure` only when explicitly enabled via
// HOMEPAGE_SECURE_COOKIE=true. Default is off so the login works over plain HTTP
// (typical LAN/homelab access) — a `Secure` cookie would be dropped by the
// browser over http:// and the user could never stay logged in. Enable it when
// serving over HTTPS.
export function isSecureCookieEnabled() {
  return process.env.HOMEPAGE_SECURE_COOKIE === "true";
}

export function getSessionOptions() {
  return {
    cookieName: SESSION_COOKIE_NAME,
    password: requireSessionSecret(),
    ttl: SESSION_TTL_SECONDS,
    cookieOptions: {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: isSecureCookieEnabled(),
    },
  };
}

export function getSession(req, res) {
  return getIronSession(req, res, getSessionOptions());
}

export function getSessionFromRequest(req, res) {
  return getIronSession(req, res, getSessionOptions());
}

export function isValidSessionRole(role) {
  return SESSION_ROLES.includes(role);
}

export function isValidSessionUser(user) {
  return (
    user !== null &&
    typeof user === "object" &&
    typeof user.username === "string" &&
    user.username.length > 0 &&
    isValidSessionRole(user.role) &&
    (user.groups === undefined || Array.isArray(user.groups))
  );
}

export function isAuthenticatedSession(session) {
  return isValidSessionUser(session?.user);
}

export function isAdminSession(session) {
  return isAuthenticatedSession(session) && session.user.role === "admin";
}
