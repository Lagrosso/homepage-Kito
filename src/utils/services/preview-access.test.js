import { describe, expect, it } from "vitest";

import {
  filterBookmarkGroupsForGroups,
  filterServiceGroupsForGroups,
  isTabVisibleForGroups,
  isVisibleForGroups,
} from "./preview-access";

describe("preview-access isVisibleForGroups", () => {
  const restricted = { name: "restricted", access: { groups: ["family", "media"] } };

  it("treats missing or empty access groups as visible to everyone", () => {
    expect(isVisibleForGroups({ name: "global" }, [])).toBe(true);
    expect(isVisibleForGroups({ name: "global", access: { groups: [] } }, [])).toBe(true);
  });

  it("matches preview groups against access groups", () => {
    expect(isVisibleForGroups(restricted, ["media"])).toBe(true);
    expect(isVisibleForGroups(restricted, ["kids"])).toBe(false);
  });

  it("bypass=true shows everything regardless of preview groups", () => {
    expect(isVisibleForGroups(restricted, [], { bypass: true })).toBe(true);
    expect(isVisibleForGroups(restricted, ["kids"], { bypass: true })).toBe(true);
  });

  it("trims whitespace on both sides (matching, case-sensitive, like access.js)", () => {
    expect(isVisibleForGroups({ access: { groups: [" family "] } }, ["family"])).toBe(true);
    expect(isVisibleForGroups({ access: { groups: ["Family"] } }, ["family"])).toBe(false);
  });
});

describe("preview-access filterServiceGroupsForGroups", () => {
  const restricted = { name: "restricted", access: { groups: ["family", "media"] } };

  it("filters services recursively and removes empty groups", () => {
    const groups = [
      {
        name: "Root",
        services: [{ name: "global" }, restricted],
        groups: [{ name: "Kids", services: [{ name: "kids", access: { groups: ["kids"] } }], groups: [] }],
      },
    ];

    expect(filterServiceGroupsForGroups(groups, ["media"])).toEqual([
      { name: "Root", services: [{ name: "global" }, restricted], groups: [] },
    ]);
  });

  it("bypass=true leaves every service in place", () => {
    const groups = [{ name: "Root", services: [restricted], groups: [] }];
    expect(filterServiceGroupsForGroups(groups, [], { bypass: true })).toEqual(groups);
  });
});

describe("preview-access filterBookmarkGroupsForGroups", () => {
  const restricted = { name: "restricted", access: { groups: ["family", "media"] } };

  it("filters bookmarks and removes empty groups", () => {
    const groups = [
      { name: "Links", bookmarks: [{ name: "global" }, restricted] },
      { name: "Kids", bookmarks: [{ name: "kids", access: { groups: ["kids"] } }] },
    ];

    expect(filterBookmarkGroupsForGroups(groups, ["media"])).toEqual([
      { name: "Links", bookmarks: [{ name: "global" }, restricted] },
    ]);
  });
});

describe("preview-access isTabVisibleForGroups", () => {
  it("is visible to everyone when no access groups are configured", () => {
    expect(isTabVisibleForGroups(undefined, [])).toBe(true);
    expect(isTabVisibleForGroups([], [])).toBe(true);
  });

  it("is visible when the preview groups include a matching group", () => {
    expect(isTabVisibleForGroups(["family", "kids"], ["kids"])).toBe(true);
  });

  it("is hidden when the preview groups match none of the required groups", () => {
    expect(isTabVisibleForGroups(["family"], ["kids"])).toBe(false);
    expect(isTabVisibleForGroups(["family"], [])).toBe(false);
  });

  it("bypass=true shows every tab regardless of preview groups", () => {
    expect(isTabVisibleForGroups(["family"], [], { bypass: true })).toBe(true);
  });
});
