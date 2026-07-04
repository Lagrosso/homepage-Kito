import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let confDir;
let mod;

beforeEach(async () => {
  confDir = mkdtempSync(join(tmpdir(), "homepage-prefs-"));
  process.env.HOMEPAGE_CONFIG_DIR = confDir;
  vi.resetModules();
  mod = await import("utils/config/user-preferences");
});

afterEach(() => {
  rmSync(confDir, { recursive: true, force: true });
  delete process.env.HOMEPAGE_CONFIG_DIR;
});

describe("user-preferences store", () => {
  it("returns safe defaults when nothing is stored", () => {
    expect(mod.getUserPreferences("alice")).toEqual({ favorites: [], enabled: true });
    expect(mod.getUserPreferences("")).toEqual({ favorites: [], enabled: true });
  });

  it("toggles a favorite on and off and persists to disk per user", () => {
    const after = mod.toggleFavorite("alice", "Media::Jellyfin");
    expect(after.favorites).toEqual(["Media::Jellyfin"]);
    expect(existsSync(join(confDir, "user-preferences.json"))).toBe(true);

    // Different user is unaffected → truly per-user.
    expect(mod.getUserPreferences("bob").favorites).toEqual([]);

    const off = mod.toggleFavorite("alice", "Media::Jellyfin");
    expect(off.favorites).toEqual([]);
  });

  it("drops a legacy usage key from an existing store on next write", () => {
    // Simulate a pre-existing file written by the old recently/frequently-used
    // feature; getUserPreferences must ignore `usage` and only surface favorites.
    const file = join(confDir, "user-preferences.json");
    const { writeFileSync } = require("node:fs");
    writeFileSync(
      file,
      JSON.stringify({ alice: { favorites: ["Media::Jellyfin"], usage: { "Media::Plex": { count: 3 } }, enabled: true } }),
    );
    expect(mod.getUserPreferences("alice")).toEqual({ favorites: ["Media::Jellyfin"], enabled: true });
  });

  it("stores the enabled flag", () => {
    expect(mod.setEnabled("alice", false).enabled).toBe(false);
    expect(mod.getUserPreferences("alice").enabled).toBe(false);
    expect(mod.setEnabled("alice", true).enabled).toBe(true);
  });

  it("rejects invalid keys", () => {
    expect(() => mod.toggleFavorite("alice", "")).toThrow(/invalid/i);
    expect(mod.isValidPreferenceKey("a".repeat(600))).toBe(false);
    expect(mod.isValidPreferenceKey("Media::Jellyfin")).toBe(true);
  });
});
