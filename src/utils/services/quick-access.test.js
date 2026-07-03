import { describe, expect, it } from "vitest";

import {
  buildFavoritesGroup,
  buildFrequentGroup,
  buildRecentGroup,
  filterServiceGroupForFavorites,
} from "./quick-access";

const groups = [
  {
    name: "Media",
    services: [
      { name: "Jellyfin", href: "http://jf" },
      { name: "Plex", href: "http://plex" },
    ],
    groups: [
      {
        name: "Downloads",
        services: [{ name: "qBit", href: "http://qbit" }],
        groups: [],
      },
    ],
  },
  {
    name: "Infra",
    services: [{ name: "AdGuard", href: "http://ag" }],
    groups: [],
  },
];

describe("utils/services/quick-access", () => {
  it("builds a favorites group in stored order, carrying the original favoriteKey", () => {
    const g = buildFavoritesGroup(groups, ["Infra::AdGuard", "Media::Jellyfin"], "Favorites");
    expect(g.name).toBe("Favorites");
    expect(g.services.map((s) => s.name)).toEqual(["AdGuard", "Jellyfin"]);
    expect(g.services[0].favoriteKey).toBe("Infra::AdGuard");
    expect(g.services[1].favoriteKey).toBe("Media::Jellyfin");
  });

  it("returns null for an empty favorites list", () => {
    expect(buildFavoritesGroup(groups, [])).toBeNull();
  });

  it("builds recent (by lastOpenedAt) and frequent (by count) groups", () => {
    const usage = {
      "Media::Jellyfin": { count: 5, lastOpenedAt: "2026-01-01T10:00:00Z" },
      "Media::Plex": { count: 1, lastOpenedAt: "2026-01-02T10:00:00Z" },
      "Infra::AdGuard": { count: 9, lastOpenedAt: "2026-01-01T09:00:00Z" },
    };

    const recent = buildRecentGroup(groups, usage, 2, "Recent");
    expect(recent.services.map((s) => s.name)).toEqual(["Plex", "Jellyfin"]); // newest first

    const frequent = buildFrequentGroup(groups, usage, 2, "Frequent");
    expect(frequent.services.map((s) => s.name)).toEqual(["AdGuard", "Jellyfin"]); // highest count first
  });

  it("ignores usage keys that no longer match a service", () => {
    const usage = { "Gone::Service": { count: 3, lastOpenedAt: "2026-01-01T10:00:00Z" } };
    expect(buildRecentGroup(groups, usage, 6)).toBeNull();
  });

  it("filters a group tree down to favorited services", () => {
    const filtered = filterServiceGroupForFavorites(groups[0], new Set(["Media::Plex", "Media::Downloads::qBit"]));
    expect(filtered.services.map((s) => s.name)).toEqual(["Plex"]);
    // Non-favorited subgroup service is dropped; empty subgroup pruned.
    expect(filtered.groups).toEqual([]);
  });
});
