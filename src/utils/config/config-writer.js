import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "fs";
import { join } from "path";

import yaml from "js-yaml";

import { CONF_DIR } from "utils/config/config";
import createLogger from "utils/logger";

const logger = createLogger("config-writer");

// Only these files may be read/written through the admin config API.
// Extended per roadmap step 2 to cover bookmarks.yaml and widgets.yaml; all
// share the same read/validate/backup/atomic-write path.
export const EDITABLE_CONFIGS = ["services.yaml", "bookmarks.yaml", "widgets.yaml"];

const BACKUP_DIR = ".backups";

export function isEditableConfig(filename) {
  return EDITABLE_CONFIGS.includes(filename);
}

// Resolve a config filename to an absolute path inside CONF_DIR, rejecting
// anything that is not a plain whitelisted filename (no path traversal).
function resolveConfigPath(filename) {
  if (!isEditableConfig(filename)) {
    throw new Error(`Config file "${filename}" is not editable`);
  }
  return join(CONF_DIR, filename);
}

export function readRawConfig(filename) {
  const configPath = resolveConfigPath(filename);
  // Read the raw bytes without env-var substitution so comments and
  // {{HOMEPAGE_VAR_*}} placeholders stay intact for round-tripping.
  return readFileSync(configPath, "utf8");
}

// Validate YAML syntax. Returns { valid: true } or { valid: false, error }.
// The error includes line/column (1-based) when js-yaml provides a mark.
export function validateYaml(content) {
  try {
    yaml.load(content);
    return { valid: true };
  } catch (e) {
    const error = { message: e.reason || e.message };
    if (e.mark) {
      error.line = e.mark.line + 1;
      error.column = e.mark.column + 1;
    }
    return { valid: false, error };
  }
}

function backupExistingConfig(configPath, filename) {
  if (!existsSync(configPath)) {
    return null;
  }
  const backupDir = join(CONF_DIR, BACKUP_DIR);
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(backupDir, `${filename}.${timestamp}.bak`);
  // Copy current contents into the timestamped backup.
  writeFileSync(backupPath, readFileSync(configPath, "utf8"), "utf8");
  return backupPath;
}

// Validate, back up, then atomically write a config file.
// Returns { written, backupPath } on success, or { written: false, error }.
export function writeRawConfig(filename, content) {
  const configPath = resolveConfigPath(filename);

  const validation = validateYaml(content);
  if (!validation.valid) {
    return { written: false, error: validation.error };
  }

  const backupPath = backupExistingConfig(configPath, filename);

  // Atomic write: write to a temp file in the same dir, then rename.
  const tmpPath = `${configPath}.tmp`;
  writeFileSync(tmpPath, content, "utf8");
  renameSync(tmpPath, configPath);

  logger.info(
    "Wrote %s (%d bytes)%s",
    filename,
    statSync(configPath).size,
    backupPath ? `, backup at ${backupPath}` : "",
  );

  return { written: true, backupPath };
}
