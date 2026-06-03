import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { basename, join, relative, resolve, sep } from "path";
import { randomUUID } from "crypto";

import { createPatch } from "diff";

import { CONF_DIR } from "utils/config/config";
import { readCustomCss } from "utils/config/css-writer";
import { HISTORY_ACTIONS, HISTORY_FILES, HISTORY_ROUTE_BY_FILE } from "utils/config/history-constants";

export const BACKUP_DIR = ".backups";
export const HISTORY_FILE = "history.jsonl";

const HISTORY_PATH = join(CONF_DIR, BACKUP_DIR, HISTORY_FILE);
const BACKUP_ROOT = join(CONF_DIR, BACKUP_DIR);

function ensureBackupDir() {
  if (!existsSync(BACKUP_ROOT)) {
    mkdirSync(BACKUP_ROOT, { recursive: true });
  }
}

function normalizeComment(comment) {
  return typeof comment === "string" ? comment.trim() : "";
}

function isTrackedFile(file) {
  return HISTORY_FILES.includes(file);
}

function isAllowedAction(action) {
  return HISTORY_ACTIONS.includes(action);
}

function safeActor(actor) {
  if (!actor || typeof actor !== "object") {
    return null;
  }
  if (typeof actor.username !== "string" || typeof actor.role !== "string") {
    return null;
  }
  return {
    username: actor.username,
    role: actor.role,
  };
}

function toEntry(input) {
  if (!isTrackedFile(input.file)) {
    throw new Error(`History tracking is not supported for "${input.file}"`);
  }
  if (!isAllowedAction(input.action)) {
    throw new Error(`Unsupported history action "${input.action}"`);
  }

  return {
    id: input.id ?? randomUUID(),
    timestamp: input.timestamp ?? new Date().toISOString(),
    file: input.file,
    action: input.action,
    actor: safeActor(input.actor),
    backupPath: input.backupPath ?? null,
    comment: normalizeComment(input.comment),
    sourceBackupId: input.sourceBackupId ?? null,
    legacy: Boolean(input.legacy),
  };
}

export function appendHistoryEntry(input) {
  ensureBackupDir();
  const entry = toEntry(input);
  writeFileSync(HISTORY_PATH, `${JSON.stringify(entry)}\n`, { encoding: "utf8", flag: "a" });
  return entry;
}

function parseHistoryLine(line) {
  if (!line.trim()) {
    return null;
  }
  try {
    return toEntry(JSON.parse(line));
  } catch {
    return null;
  }
}

export function readHistoryEntries() {
  if (!existsSync(HISTORY_PATH)) {
    return [];
  }
  return readFileSync(HISTORY_PATH, "utf8")
    .split(/\r?\n/)
    .map(parseHistoryLine)
    .filter(Boolean)
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
}

function inferLegacyFile(name) {
  return [...HISTORY_FILES]
    .sort((a, b) => b.length - a.length)
    .find((file) => name.startsWith(`${file}.`) && name.endsWith(".bak"));
}

function isPathInsideBackupDir(filePath) {
  const resolved = resolve(filePath);
  const backupRoot = resolve(BACKUP_ROOT);
  const rel = relative(backupRoot, resolved);
  return rel === "" || (!rel.startsWith("..") && !rel.includes(`..${sep}`));
}

export function readLegacyHistoryEntries() {
  if (!existsSync(BACKUP_ROOT)) {
    return [];
  }

  const knownPaths = new Set(readHistoryEntries().map((entry) => entry.backupPath).filter(Boolean));

  return readdirSync(BACKUP_ROOT)
    .filter((name) => name !== HISTORY_FILE)
    .map((name) => {
      const file = inferLegacyFile(name);
      if (!file) {
        return null;
      }
      const backupPath = join(BACKUP_ROOT, name);
      if (knownPaths.has(backupPath)) {
        return null;
      }
      const stat = statSync(backupPath);
      return toEntry({
        id: `legacy:${name}`,
        timestamp: stat.mtime.toISOString(),
        file,
        action: "save",
        actor: null,
        backupPath,
        comment: "",
        sourceBackupId: null,
        legacy: true,
      });
    })
    .filter(Boolean)
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
}

export function listHistoryEntries(filters = {}) {
  const { file = "all", action = "all" } = filters;
  return [...readHistoryEntries(), ...readLegacyHistoryEntries()]
    .filter((entry) => (file === "all" ? true : entry.file === file))
    .filter((entry) => (action === "all" ? true : entry.action === action))
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
}

export function getHistoryEntry(id) {
  return listHistoryEntries().find((entry) => entry.id === id) ?? null;
}

export function assertValidBackupPath(backupPath) {
  if (!backupPath) {
    throw new Error("This history entry has no backup snapshot");
  }
  if (!isPathInsideBackupDir(backupPath)) {
    throw new Error("Backup path is outside the backup directory");
  }
  if (!existsSync(backupPath)) {
    throw new Error("Backup snapshot not found");
  }
  return backupPath;
}

export function readHistoryContent(entryOrId) {
  const entry = typeof entryOrId === "string" ? getHistoryEntry(entryOrId) : entryOrId;
  if (!entry) {
    throw new Error("History entry not found");
  }
  const backupPath = assertValidBackupPath(entry.backupPath);
  return readFileSync(backupPath, "utf8");
}

export function readCurrentTrackedFile(file) {
  if (file === "custom.css") {
    return readCustomCss();
  }
  if (!isTrackedFile(file)) {
    throw new Error(`History tracking is not supported for "${file}"`);
  }
  return readFileSync(join(CONF_DIR, file), "utf8");
}

export function buildHistoryDiff(entryOrId) {
  const entry = typeof entryOrId === "string" ? getHistoryEntry(entryOrId) : entryOrId;
  if (!entry) {
    throw new Error("History entry not found");
  }
  const previous = readHistoryContent(entry);
  const current = readCurrentTrackedFile(entry.file);
  return {
    entry,
    currentContent: current,
    patch: createPatch(entry.file, previous, current, "backup", "current"),
  };
}

export function getHistoryDownloadName(entry) {
  return entry?.backupPath ? basename(entry.backupPath) : `${entry.file}.snapshot.txt`;
}

export function getHistoryDraftRoute(file) {
  return HISTORY_ROUTE_BY_FILE[file] ?? null;
}
