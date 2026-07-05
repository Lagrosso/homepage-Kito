import { describe, expect, it } from "vitest";

import { BADGE_BY_ID, BADGE_TYPES, NEUTRAL_BADGE_CLASS } from "./badge-registry";

describe("badge-registry", () => {
  it("has unique, non-empty ids and labels", () => {
    const ids = BADGE_TYPES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    BADGE_TYPES.forEach((b) => {
      expect(b.id.length).toBeGreaterThan(0);
      expect(b.label.length).toBeGreaterThan(0);
    });
  });

  it("gives every badge a non-empty className", () => {
    BADGE_TYPES.forEach((b) => {
      expect(typeof b.className).toBe("string");
      expect(b.className.trim().length).toBeGreaterThan(0);
    });
    expect(NEUTRAL_BADGE_CLASS.trim().length).toBeGreaterThan(0);
  });

  it("indexes every badge in BADGE_BY_ID", () => {
    expect(Object.keys(BADGE_BY_ID).length).toBe(BADGE_TYPES.length);
    BADGE_TYPES.forEach((b) => expect(BADGE_BY_ID[b.id]).toBe(b));
  });
});
