import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("utils/logger", () => ({ default: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }) }));

let confDir;
let mod;

beforeEach(async () => {
  confDir = mkdtempSync(join(tmpdir(), "homepage-history-"));
  process.env.HOMEPAGE_CONFIG_DIR = confDir;
  vi.resetModules();
  mod = await import("utils/config/backup-history");
});

afterEach(() => {
  rmSync(confDir, { recursive: true, force: true });
  delete process.env.HOMEPAGE_CONFIG_DIR;
});

describe("backup-history", () => {
  it("appends and reads history entries", () => {
    const entry = mod.appendHistoryEntry({
      action: "save",
      actor: { role: "admin", username: "admin" },
      backupPath: "/tmp/backup-path",
      comment: "Saved from test",
      file: "services.yaml",
      sourceBackupId: null,
    });

    const entries = mod.readHistoryEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      action: "save",
      actor: { role: "admin", username: "admin" },
      backupPath: "/tmp/backup-path",
      comment: "Saved from test",
      file: "services.yaml",
      id: entry.id,
    });
  });

  it("infers legacy backup entries from .bak files without JSONL records", () => {
    const backupDir = join(confDir, ".backups");
    mkdirSync(backupDir, { recursive: true });
    writeFileSync(join(confDir, "services.yaml"), "- Group: []\n", "utf8");
    writeFileSync(join(backupDir, "services.yaml.2026-06-03T10-00-00-000Z.bak"), "- Old: []\n", "utf8");

    const entries = mod.readLegacyHistoryEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      file: "services.yaml",
      legacy: true,
    });
  });

  it("reads history content and builds a text diff", () => {
    const backupDir = join(confDir, ".backups");
    mkdirSync(backupDir, { recursive: true });
    writeFileSync(join(confDir, "services.yaml"), "- Group:\n    - New:\n        href: http://new\n", "utf8");
    writeFileSync(join(backupDir, "services.yaml.2026-06-03T10-00-00-000Z.bak"), "- Group:\n    - Old:\n        href: http://old\n", "utf8");
    const entry = mod.appendHistoryEntry({
      action: "save",
      actor: { role: "admin", username: "admin" },
      backupPath: join(backupDir, "services.yaml.2026-06-03T10-00-00-000Z.bak"),
      comment: "",
      file: "services.yaml",
      sourceBackupId: null,
    });

    expect(mod.readHistoryContent(entry)).toContain("http://old");
    const diff = mod.buildHistoryDiff(entry);
    expect(diff.patch).toContain("--- services.yaml\tbackup");
    expect(diff.patch).toContain("+++ services.yaml\tcurrent");
    expect(diff.patch).toContain("http://new");
  });

  it("rejects backup paths outside the backup directory", () => {
    const outsidePath = join(confDir, "outside.bak");
    writeFileSync(outsidePath, "x\n", "utf8");

    const entry = mod.appendHistoryEntry({
      action: "save",
      actor: { role: "admin", username: "admin" },
      backupPath: outsidePath,
      comment: "",
      file: "services.yaml",
      sourceBackupId: null,
    });

    expect(() => mod.readHistoryContent(entry)).toThrow("outside the backup directory");
    expect(existsSync(outsidePath)).toBe(true);
  });
});
