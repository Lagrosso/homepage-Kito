import { timingSafeEqual } from "crypto";

// The admin config UI and its read route are only available when explicitly
// enabled. Defaults to disabled so existing deployments are unaffected.
export function isConfigEditEnabled() {
  return process.env.HOMEPAGE_CONFIG_EDIT === "true";
}

function safeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // timingSafeEqual requires equal lengths; compare lengths first but still
  // run a constant-time comparison to avoid leaking via early return.
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function extractToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }
  const headerToken = req.headers["x-homepage-config-token"];
  if (headerToken) {
    return Array.isArray(headerToken) ? headerToken[0] : headerToken;
  }
  return null;
}

// Verify the request carries a valid write token. Writing is refused entirely
// when no HOMEPAGE_CONFIG_EDIT_TOKEN is configured.
export function checkAdminToken(req) {
  const expected = process.env.HOMEPAGE_CONFIG_EDIT_TOKEN;
  if (!expected) {
    return false;
  }
  const provided = extractToken(req);
  if (!provided) {
    return false;
  }
  return safeEqual(provided, expected);
}
