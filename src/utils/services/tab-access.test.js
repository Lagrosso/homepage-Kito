import { describe, expect, it } from "vitest";

import { isTabVisibleForUser } from "./tab-access";

describe("utils/services/tab-access isTabVisibleForUser", () => {
  it("is visible to everyone when no access groups are configured", () => {
    expect(isTabVisibleForUser(undefined, { role: "viewer", groups: [] })).toBe(true);
    expect(isTabVisibleForUser([], { role: "viewer", groups: [] })).toBe(true);
    expect(isTabVisibleForUser(undefined, undefined)).toBe(true); // logged out / not yet loaded
  });

  it("is always visible to admins, even with access groups configured", () => {
    expect(isTabVisibleForUser(["family"], { role: "admin", groups: [] })).toBe(true);
  });

  it("is visible when the user has a matching group", () => {
    expect(isTabVisibleForUser(["family", "kids"], { role: "viewer", groups: ["kids"] })).toBe(true);
  });

  it("is hidden when the user has none of the required groups", () => {
    expect(isTabVisibleForUser(["family"], { role: "viewer", groups: ["kids"] })).toBe(false);
    expect(isTabVisibleForUser(["family"], { role: "viewer", groups: [] })).toBe(false);
  });

  it("trims whitespace on both sides (matching, case-sensitive, like access.js)", () => {
    expect(isTabVisibleForUser([" family "], { role: "viewer", groups: ["family"] })).toBe(true);
    expect(isTabVisibleForUser(["Family"], { role: "viewer", groups: ["family"] })).toBe(false);
  });
});
