import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("utils/logger", () => ({ default: () => ({ info: vi.fn(), error: vi.fn() }) }));

let confDir;
let mod;

beforeEach(async () => {
  confDir = mkdtempSync(join(tmpdir(), "homepage-css-writer-"));
  process.env.HOMEPAGE_CONFIG_DIR = confDir;
  vi.resetModules();
  mod = await import("utils/config/css-writer");
});

afterEach(() => {
  rmSync(confDir, { recursive: true, force: true });
  delete process.env.HOMEPAGE_CONFIG_DIR;
});

describe("readCustomCss", () => {
  it("returns empty string when custom.css does not exist", () => {
    expect(mod.readCustomCss()).toBe("");
  });

  it("returns the file contents when custom.css exists", () => {
    writeFileSync(join(confDir, "custom.css"), "body { color: red; }", "utf8");
    expect(mod.readCustomCss()).toBe("body { color: red; }");
  });
});

describe("writeCustomCss", () => {
  it("creates custom.css with the given content", () => {
    const result = mod.writeCustomCss("body { font-size: 16px; }");
    expect(result.written).toBe(true);
    expect(readFileSync(join(confDir, "custom.css"), "utf8")).toBe("body { font-size: 16px; }");
    expect(readFileSync(join(confDir, ".backups", "history.jsonl"), "utf8")).toContain('"file":"custom.css"');
  });

  it("creates a timestamped backup when custom.css already exists", () => {
    writeFileSync(join(confDir, "custom.css"), "/* old */", "utf8");
    const result = mod.writeCustomCss("/* new */");
    expect(result.written).toBe(true);
    expect(result.backupPath).toBeTruthy();
    expect(existsSync(result.backupPath)).toBe(true);
    expect(readFileSync(result.backupPath, "utf8")).toBe("/* old */");
    expect(readFileSync(join(confDir, "custom.css"), "utf8")).toBe("/* new */");
  });

  it("returns null backupPath when no prior file existed", () => {
    const result = mod.writeCustomCss("/* fresh */");
    expect(result.backupPath).toBeNull();
  });

  it("accepts an empty string (reset)", () => {
    const result = mod.writeCustomCss("");
    expect(result.written).toBe(true);
    expect(readFileSync(join(confDir, "custom.css"), "utf8")).toBe("");
  });

  it("stores restore metadata in the history log", () => {
    writeFileSync(join(confDir, "custom.css"), "/* old */", "utf8");
    mod.writeCustomCss("/* restored */", {
      action: "restore",
      actor: { role: "admin", username: "admin" },
      comment: "restore css",
      sourceBackupId: "hist-css",
    });

    const history = readFileSync(join(confDir, ".backups", "history.jsonl"), "utf8");
    expect(history).toContain('"action":"restore"');
    expect(history).toContain('"comment":"restore css"');
    expect(history).toContain('"sourceBackupId":"hist-css"');
  });
});
