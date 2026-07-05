import { describe, expect, it } from "vitest";

import { entryMatches, filterPreviewGroups } from "./preview-search";

const groups = [
  {
    name: "Media",
    entries: [
      { name: "Jellyfin", href: "http://jellyfin.local", description: "Media server", badges: ["lan", "critical"] },
      { name: "Sonarr", href: "http://sonarr.local", isGroup: false },
    ],
  },
  {
    name: "Tools",
    entries: [{ name: "Portainer", href: "http://portainer.local", description: "Docker UI" }],
  },
];

describe("utils/admin/preview-search - entryMatches", () => {
  it("matches on a string field", () => {
    expect(entryMatches({ name: "Jellyfin" }, "jelly")).toBe(true);
    expect(entryMatches({ href: "http://sonarr.local" }, "sonarr")).toBe(true);
  });

  it("matches on a string array member (badges)", () => {
    expect(entryMatches({ badges: ["lan", "critical"] }, "critical")).toBe(true);
    expect(entryMatches({ badges: ["lan"] }, "vpn")).toBe(false);
  });

  it("ignores object/boolean/number helper fields", () => {
    expect(entryMatches({ isGroup: true, count: 42, entry: { deep: "true" } }, "true")).toBe(false);
  });

  it("returns false for non-object input", () => {
    expect(entryMatches(null, "x")).toBe(false);
    expect(entryMatches("string", "str")).toBe(false);
  });
});

describe("utils/admin/preview-search - filterPreviewGroups", () => {
  it("returns the same reference for an empty/whitespace query", () => {
    expect(filterPreviewGroups(groups, "")).toBe(groups);
    expect(filterPreviewGroups(groups, "   ")).toBe(groups);
    expect(filterPreviewGroups(groups, null)).toBe(groups);
  });

  it("keeps all entries when the group name matches", () => {
    const result = filterPreviewGroups(groups, "media");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Media");
    expect(result[0].entries).toHaveLength(2);
  });

  it("keeps only matching entries and drops empty groups", () => {
    const result = filterPreviewGroups(groups, "jellyfin");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Media");
    expect(result[0].entries.map((e) => e.name)).toEqual(["Jellyfin"]);
  });

  it("matches entries across groups via href and description", () => {
    expect(filterPreviewGroups(groups, "docker").map((g) => g.name)).toEqual(["Tools"]);
    expect(filterPreviewGroups(groups, ".local")).toHaveLength(2);
  });

  it("is case-insensitive", () => {
    expect(filterPreviewGroups(groups, "JELLYFIN")[0].entries[0].name).toBe("Jellyfin");
  });

  it("returns no groups when nothing matches", () => {
    expect(filterPreviewGroups(groups, "zzz-nope")).toEqual([]);
  });

  it("matches an entry by a curated badge id", () => {
    const result = filterPreviewGroups(groups, "critical");
    expect(result).toHaveLength(1);
    expect(result[0].entries.map((e) => e.name)).toEqual(["Jellyfin"]);
  });
});
