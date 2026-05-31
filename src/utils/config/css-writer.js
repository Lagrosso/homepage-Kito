import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "fs";
import { join } from "path";

import { CONF_DIR } from "utils/config/config";
import createLogger from "utils/logger";

const logger = createLogger("css-writer");
const CSS_FILENAME = "custom.css";
const BACKUP_DIR = ".backups";

export function readCustomCss() {
  const cssPath = join(CONF_DIR, CSS_FILENAME);
  if (!existsSync(cssPath)) {
    return "";
  }
  return readFileSync(cssPath, "utf8");
}

// Back up and atomically write custom.css (no YAML validation — any text is valid).
// Returns { written: true, backupPath } or throws on FS error.
export function writeCustomCss(content) {
  const cssPath = join(CONF_DIR, CSS_FILENAME);

  let backupPath = null;
  if (existsSync(cssPath)) {
    const backupDir = join(CONF_DIR, BACKUP_DIR);
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    backupPath = join(backupDir, `${CSS_FILENAME}.${timestamp}.bak`);
    writeFileSync(backupPath, readFileSync(cssPath, "utf8"), "utf8");
  }

  const tmpPath = `${cssPath}.tmp`;
  writeFileSync(tmpPath, content, "utf8");
  renameSync(tmpPath, cssPath);

  logger.info(
    "Wrote %s (%d bytes)%s",
    CSS_FILENAME,
    statSync(cssPath).size,
    backupPath ? `, backup at ${backupPath}` : "",
  );

  return { written: true, backupPath };
}
