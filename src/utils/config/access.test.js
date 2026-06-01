import { describe, expect, it } from "vitest";

import { filterBookmarkGroupsByUser, filterServiceGroupsByUser, isVisibleForUser } from "./access";

describe("access visibility", () => {
  const restricted = { name: "restricted", access: { groups: ["family", "media"] } };

  it("treats missing or empty access groups as visible to everyone", () => {
    expect(isVisibleForUser({ name: "global" }, { role: "viewer", groups: [] })).toBe(true);
    expect(isVisibleForUser({ name: "global", access: { groups: [] } }, { role: "viewer", groups: [] })).toBe(true);
  });

  it("matches viewer groups and lets admins see everything", () => {
    expect(isVisibleForUser(restricted, { role: "viewer", groups: ["media"] })).toBe(true);
    expect(isVisibleForUser(restricted, { role: "viewer", groups: ["kids"] })).toBe(false);
    expect(isVisibleForUser(restricted, { role: "admin", groups: [] })).toBe(true);
  });

  it("filters services recursively and removes empty groups", () => {
    const groups = [
      {
        name: "Root",
        services: [{ name: "global" }, restricted],
        groups: [{ name: "Kids", services: [{ name: "kids", access: { groups: ["kids"] } }], groups: [] }],
      },
    ];

    expect(filterServiceGroupsByUser(groups, { role: "viewer", groups: ["media"] })).toEqual([
      { name: "Root", services: [{ name: "global" }, restricted], groups: [] },
    ]);
  });

  it("filters bookmarks and removes empty groups", () => {
    const groups = [
      { name: "Links", bookmarks: [{ name: "global" }, restricted] },
      { name: "Kids", bookmarks: [{ name: "kids", access: { groups: ["kids"] } }] },
    ];

    expect(filterBookmarkGroupsByUser(groups, { role: "viewer", groups: ["media"] })).toEqual([
      { name: "Links", bookmarks: [{ name: "global" }, restricted] },
    ]);
  });
});
