import { NextResponse } from "next/server";

import { getSessionFromRequest, isAuthenticatedSession } from "utils/config/session";

const PUBLIC_PATHS = new Set([
  "/login",
  "/setup",
  "/offline",
  "/sw.js",
  "/favicon.ico",
  "/homepage.ico",
  "/apple-touch-icon.png",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/android-chrome-192x192.png",
  "/android-chrome-512x512.png",
  "/mstile-70x70.png",
  "/mstile-144x144.png",
  "/mstile-150x150.png",
  "/mstile-310x150.png",
  "/mstile-310x310.png",
  "/safari-pinned-tab.svg",
  "/site.webmanifest",
  "/browserconfig.xml",
  "/robots.txt",
]);

function isPublicPath(pathname) {
  return (
    PUBLIC_PATHS.has(pathname) ||
    pathname === "/api/healthcheck" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/auth/")
  );
}

function unauthorizedApi() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function redirectToLogin(req) {
  const url = req.nextUrl.clone();
  const next = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  url.pathname = "/login";
  url.search = "";
  if (next && next !== "/login") {
    url.searchParams.set("next", next);
  }
  return NextResponse.redirect(url);
}

export async function middleware(req) {
  // Check the Host header, if HOMEPAGE_ALLOWED_HOSTS is set
  const host = req.headers.get("host");
  const port = process.env.PORT || 3000;
  let allowedHosts = [`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`];
  const allowAll = process.env.HOMEPAGE_ALLOWED_HOSTS === "*";
  if (process.env.HOMEPAGE_ALLOWED_HOSTS) {
    allowedHosts = allowedHosts.concat(process.env.HOMEPAGE_ALLOWED_HOSTS.split(","));
  }
  if (!allowAll && (!host || !allowedHosts.includes(host))) {
    console.error(
      `Host validation failed for: ${host}. Hint: Set the HOMEPAGE_ALLOWED_HOSTS environment variable to allow requests from this host / port.`,
    );
    return NextResponse.json({ error: "Host validation failed. See logs for more details." }, { status: 400 });
  }

  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const session = await getSessionFromRequest(req, res);
  if (isAuthenticatedSession(session)) {
    return res;
  }

  if (pathname.startsWith("/api/")) {
    return unauthorizedApi();
  }
  return redirectToLogin(req);
}

export const config = {
  matcher: ["/", "/((?!_next/static|_next/image).*)"],
};
