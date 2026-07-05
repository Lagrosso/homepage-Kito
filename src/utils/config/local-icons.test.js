import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { hasAllowedIconExt, listLocalIcons, parseLocalIconRef, sanitizeIconName } from "./local-icons";

describe("sanitizeIconName", () => {
  it("strips directories, traversal and leading dots", () => {
    expect(sanitizeIconName("../../etc/passwd")).not.toContain("/");
    expect(sanitizeIconName("../../etc/passwd")).not.toMatch(/^\./);
    expect(sanitizeIconName("..%2f.svg")).not.toContain("/");
    expect(sanitizeIconName("foo bar!.png")).toBe("foo_bar_.png");
  });

  it("caps the length", () => {
    expect(sanitizeIconName("a".repeat(300)).length).toBeLessThanOrEqual(100);
  });
});

describe("hasAllowedIconExt", () => {
  it("accepts image extensions and rejects others", () => {
    expect(hasAllowedIconExt("foo.png")).toBe(true);
    expect(hasAllowedIconExt("foo.svg")).toBe(true);
    expect(hasAllowedIconExt("foo.exe")).toBe(false);
    expect(hasAllowedIconExt("foo")).toBe(false);
  });
});

describe("parseLocalIconRef", () => {
  it("returns the filename only for our local scheme", () => {
    expect(parseLocalIconRef("/api/config/icon?file=jelly.png")).toBe("jelly.png");
    expect(parseLocalIconRef("/api/config/icon?file=my%20icon.png")).toBe("my icon.png");
  });

  it("returns null for remote/bare icons", () => {
    expect(parseLocalIconRef("jellyfin.svg")).toBeNull();
    expect(parseLocalIconRef("sh-jellyfin")).toBeNull();
    expect(parseLocalIconRef("https://example.com/i.png")).toBeNull();
    expect(parseLocalIconRef(null)).toBeNull();
  });
});

describe("listLocalIcons", () => {
  let confDir;
  beforeAll(() => {
    confDir = mkdtempSync(join(tmpdir(), "kito-icons-"));
    mkdirSync(join(confDir, "icons"), { recursive: true });
    writeFileSync(join(confDir, "icons", "b.png"), "x");
    writeFileSync(join(confDir, "icons", "a.svg"), "x");
    writeFileSync(join(confDir, "icons", "notes.txt"), "x");
  });
  afterAll(() => rmSync(confDir, { recursive: true, force: true }));

  it("lists sorted image files only", () => {
    expect(listLocalIcons(confDir)).toEqual(["a.svg", "b.png"]);
  });

  it("returns an empty list when the dir is absent", () => {
    expect(listLocalIcons(mkdtempSync(join(tmpdir(), "kito-empty-")))).toEqual([]);
  });
});
