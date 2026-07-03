import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { CONF_DIR } from "utils/config/config";

// Per-user dashboard preferences (M12): favorites (pinned services) and local
// usage history (recently / frequently opened). Stored server-side and keyed by
// username so they follow the account across devices/browsers — NOT localStorage.
//
// This is a separate small data file, intentionally NOT one of the YAML config
// files: it never enters EDITABLE_CONFIGS and holds no secrets. Each caller acts
// only on its own (session) username.

export const PREFERENCES_FILENAME = "user-preferences.json";
export const PREFERENCES_FILE = join(CONF_DIR, PREFERENCES_FILENAME);

// Hardening caps so a single user can't grow the store unbounded.
const MAX_KEY_LENGTH = 512;
const MAX_FAVORITES = 200;
const MAX_USAGE_ENTRIES = 100;

export function isValidPreferenceKey(key) {
  return typeof key === "string" && key.length > 0 && key.length <= MAX_KEY_LENGTH;
}

function defaultPrefs() {
  return { favorites: [], usage: {}, enabled: true };
}

// Coerce an arbitrary (possibly hand-edited) entry into a safe, capped shape.
function normalizePrefs(raw) {
  const prefs = defaultPrefs();
  if (!raw || typeof raw !== "object") {
    return prefs;
  }

  if (Array.isArray(raw.favorites)) {
    prefs.favorites = [...new Set(raw.favorites.filter(isValidPreferenceKey))].slice(0, MAX_FAVORITES);
  }

  if (raw.usage && typeof raw.usage === "object") {
    for (const [key, value] of Object.entries(raw.usage)) {
      if (!isValidPreferenceKey(key) || !value || typeof value !== "object") {
        continue;
      }
      const count = Number(value.count);
      prefs.usage[key] = {
        count: Number.isFinite(count) && count > 0 ? Math.floor(count) : 0,
        lastOpenedAt: typeof value.lastOpenedAt === "string" ? value.lastOpenedAt : "",
      };
    }
  }

  prefs.enabled = raw.enabled !== false;
  return prefs;
}

function loadAll() {
  if (!existsSync(PREFERENCES_FILE)) {
    return {};
  }
  try {
    const data = JSON.parse(readFileSync(PREFERENCES_FILE, "utf8"));
    return data && typeof data === "object" ? data : {};
  } catch {
    // Corrupt/unreadable file must never break the dashboard.
    return {};
  }
}

function writeAll(data) {
  if (!existsSync(CONF_DIR)) {
    mkdirSync(CONF_DIR, { recursive: true });
  }
  const tmpPath = `${PREFERENCES_FILE}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
  renameSync(tmpPath, PREFERENCES_FILE);
}

// Keep only the most-recently-opened MAX_USAGE_ENTRIES usage records.
function pruneUsage(usage) {
  const entries = Object.entries(usage);
  if (entries.length <= MAX_USAGE_ENTRIES) {
    return usage;
  }
  entries.sort(([, a], [, b]) => String(b.lastOpenedAt).localeCompare(String(a.lastOpenedAt)));
  return Object.fromEntries(entries.slice(0, MAX_USAGE_ENTRIES));
}

export function getUserPreferences(username) {
  if (typeof username !== "string" || username.length === 0) {
    return defaultPrefs();
  }
  return normalizePrefs(loadAll()[username]);
}

function updateUserPrefs(username, mutate) {
  const all = loadAll();
  const prefs = normalizePrefs(all[username]);
  mutate(prefs);
  all[username] = prefs;
  writeAll(all);
  return prefs;
}

export function toggleFavorite(username, key) {
  if (!isValidPreferenceKey(key)) {
    throw new Error("invalid preference key");
  }
  return updateUserPrefs(username, (prefs) => {
    if (prefs.favorites.includes(key)) {
      prefs.favorites = prefs.favorites.filter((k) => k !== key);
    } else {
      prefs.favorites = [key, ...prefs.favorites].slice(0, MAX_FAVORITES);
    }
  });
}

export function recordOpen(username, key) {
  if (!isValidPreferenceKey(key)) {
    throw new Error("invalid preference key");
  }
  return updateUserPrefs(username, (prefs) => {
    const existing = prefs.usage[key] ?? { count: 0, lastOpenedAt: "" };
    prefs.usage[key] = { count: existing.count + 1, lastOpenedAt: new Date().toISOString() };
    prefs.usage = pruneUsage(prefs.usage);
  });
}

export function setEnabled(username, enabled) {
  return updateUserPrefs(username, (prefs) => {
    prefs.enabled = enabled !== false;
  });
}
