import { existsSync, readdirSync } from "fs";
import { extname, join } from "path";

// Shared helpers for locally-stored service icons (M21b). Icons uploaded or
// cached through the admin UI live in CONF_DIR/icons/ and are referenced from
// YAML as `/api/config/icon?file=<name>`. Kept framework-free so both the API
// route and config-health can reuse it (config-health must stay Node-only, no
// network).

export const ICONS_SUBDIR = "icons";

// Image extensions we accept for local icons (mirrors the background-image API).
export const ALLOWED_ICON_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif", ".ico"]);

export const ICON_MIME_MAP = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
};

// Reduce an arbitrary name to a safe flat filename (no directories, no traversal).
export function sanitizeIconName(name) {
  return String(name ?? "")
    .replace(/[^a-zA-Z0-9.\-_]/g, "_")
    .replace(/^\.+/, "") // never start with a dot (no hidden/relative names)
    .slice(0, 100);
}

// True if the extension is an allowed image type.
export function hasAllowedIconExt(name) {
  return ALLOWED_ICON_EXTS.has(extname(String(name ?? "")).toLowerCase());
}

// Absolute path of a local icon inside CONF_DIR/icons/.
export function localIconPath(confDir, name) {
  return join(confDir, ICONS_SUBDIR, sanitizeIconName(name));
}

// List the existing local icon filenames (best effort; empty if the dir is absent).
export function listLocalIcons(confDir) {
  const dir = join(confDir, ICONS_SUBDIR);
  if (!existsSync(dir)) {
    return [];
  }
  try {
    return readdirSync(dir)
      .filter((file) => hasAllowedIconExt(file))
      .sort();
  } catch {
    return [];
  }
}

// If `icon` is one of our local references (`/api/config/icon?file=<name>`),
// return the referenced filename; otherwise null. Bare `name.svg` stays a remote
// dashboard-icon reference and is intentionally NOT treated as local.
export function parseLocalIconRef(icon) {
  if (typeof icon !== "string") {
    return null;
  }
  const match = icon.match(/^\/api\/config\/icon\?file=([^&#]+)/);
  if (!match) {
    return null;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}
