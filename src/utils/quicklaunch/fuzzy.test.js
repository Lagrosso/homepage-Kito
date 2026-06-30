import { describe, expect, it } from "vitest";

import { fuzzyFilter, fuzzyScore } from "./fuzzy";

describe("utils/quicklaunch/fuzzy - fuzzyScore", () => {
  it("returns 0 for an empty query", () => {
    expect(fuzzyScore("", "anything")).toBe(0);
    expect(fuzzyScore(null, "anything")).toBe(0);
  });

  it("returns -Infinity when the text is empty or not a subsequence", () => {
    expect(fuzzyScore("abc", "")).toBe(-Infinity);
    expect(fuzzyScore("xyz", "abc")).toBe(-Infinity);
  });

  it("scores a contiguous substring match higher than a scattered subsequence", () => {
    const contiguous = fuzzyScore("plex", "Plex Media Server");
    const scattered = fuzzyScore("plex", "Pi-hole lan extras");
    expect(contiguous).toBeGreaterThan(scattered);
    expect(scattered).toBeGreaterThan(-Infinity);
  });

  it("rewards prefix matches over later matches", () => {
    const prefix = fuzzyScore("graf", "Grafana");
    const later = fuzzyScore("graf", "My Grafana");
    expect(prefix).toBeGreaterThan(later);
  });

  it("matches a typo-style subsequence", () => {
    expect(fuzzyScore("nzbget", "NZBGet")).toBeGreaterThan(-Infinity);
    expect(fuzzyScore("ndg", "Nextcloud Dashboard Group")).toBeGreaterThan(-Infinity);
  });

  it("is case-insensitive", () => {
    expect(fuzzyScore("PLEX", "plex")).toBeGreaterThan(0);
  });
});

describe("utils/quicklaunch/fuzzy - fuzzyFilter", () => {
  const items = [
    { name: "Plex" },
    { name: "Pi-hole" },
    { name: "Portainer" },
    { name: "Grafana" },
  ];

  it("returns an empty array for an empty or whitespace query", () => {
    expect(fuzzyFilter("", items, (i) => i.name)).toEqual([]);
    expect(fuzzyFilter("   ", items, (i) => i.name)).toEqual([]);
  });

  it("returns only matching items ranked by score", () => {
    const result = fuzzyFilter("p", items, (i) => i.name);
    const names = result.map((i) => i.name);
    expect(names).toContain("Plex");
    expect(names).toContain("Pi-hole");
    expect(names).toContain("Portainer");
    expect(names).not.toContain("Grafana");
  });

  it("ranks a prefix match ahead of a mid-string match", () => {
    const list = [{ name: "My Plex" }, { name: "Plex" }];
    const result = fuzzyFilter("plex", list, (i) => i.name);
    expect(result[0].name).toBe("Plex");
  });

  it("defaults getText to identity for string arrays", () => {
    expect(fuzzyFilter("ab", ["abc", "xyz", "cab"])).toEqual(["abc", "cab"]);
  });
});
