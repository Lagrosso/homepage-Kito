import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Avoid winston file transports during tests.
vi.mock("utils/logger", () => ({ default: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }) }));

let confDir;
let mod;

beforeEach(async () => {
  confDir = mkdtempSync(join(tmpdir(), "homepage-config-"));
  process.env.HOMEPAGE_CONFIG_DIR = confDir;
  // Re-import so CONF_DIR picks up the temp dir for this test.
  vi.resetModules();
  mod = await import("utils/config/config-writer");
});

afterEach(() => {
  rmSync(confDir, { recursive: true, force: true });
  delete process.env.HOMEPAGE_CONFIG_DIR;
});

describe("validateYaml", () => {
  it("accepts valid YAML", () => {
    expect(mod.validateYaml("- a: 1\n- b: 2\n")).toEqual({ valid: true });
  });

  it("reports line and column for invalid YAML", () => {
    const result = mod.validateYaml("foo:\n  - bar\n   baz: 1\n");
    expect(result.valid).toBe(false);
    expect(result.error.line).toBeGreaterThan(0);
    expect(result.error.column).toBeGreaterThan(0);
  });
});

describe("isEditableConfig", () => {
  it("allows whitelisted files and rejects others", () => {
    expect(mod.isEditableConfig("services.yaml")).toBe(true);
    expect(mod.isEditableConfig("settings.yaml")).toBe(false);
    expect(mod.isEditableConfig("../../etc/passwd")).toBe(false);
  });
});

describe("readRawConfig", () => {
  it("reads raw contents without env substitution", () => {
    writeFileSync(join(confDir, "services.yaml"), "- Group:\n    - Svc:\n        href: {{HOMEPAGE_VAR_X}}\n");
    const content = mod.readRawConfig("services.yaml");
    expect(content).toContain("{{HOMEPAGE_VAR_X}}");
  });

  it("rejects non-whitelisted filenames", () => {
    expect(() => mod.readRawConfig("../secrets.yaml")).toThrow();
  });
});

describe("writeRawConfig", () => {
  it("refuses to write non-editable files", () => {
    expect(() => mod.writeRawConfig("settings.yaml", "a: 1")).toThrow();
  });

  it("rejects invalid YAML without writing", () => {
    const target = join(confDir, "services.yaml");
    const result = mod.writeRawConfig("services.yaml", "foo:\n  - bar\n   baz: 1\n");
    expect(result.written).toBe(false);
    expect(result.error).toBeDefined();
    expect(existsSync(target)).toBe(false);
  });

  it("writes valid YAML atomically without a backup when no file exists", () => {
    const result = mod.writeRawConfig("services.yaml", "- Group:\n    - Svc:\n        href: http://x\n");
    expect(result.written).toBe(true);
    expect(result.backupPath).toBeNull();
    expect(readFileSync(join(confDir, "services.yaml"), "utf8")).toContain("Svc");
    // No leftover temp file.
    expect(existsSync(join(confDir, "services.yaml.tmp"))).toBe(false);
  });

  it("backs up the existing file before overwriting", () => {
    writeFileSync(join(confDir, "services.yaml"), "- Old:\n    - Svc:\n        href: http://old\n");
    const result = mod.writeRawConfig("services.yaml", "- New:\n    - Svc:\n        href: http://new\n");
    expect(result.written).toBe(true);
    expect(result.backupPath).toBeTruthy();
    expect(readFileSync(result.backupPath, "utf8")).toContain("http://old");
    expect(readFileSync(join(confDir, "services.yaml"), "utf8")).toContain("http://new");
    // Backup lives in the .backups dir.
    expect(readdirSync(join(confDir, ".backups")).length).toBe(1);
  });
});
