import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { extname, join } from "path";

import { CONF_DIR } from "utils/config/config";
import { getSession, isAdminSession, isAuthenticatedSession } from "utils/config/session";
import createLogger from "utils/logger";

const logger = createLogger("config-background-image-api");
const IMAGES_SUBDIR = "images";
const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"]);
const MIME_MAP = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
};
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export const config = {
  api: { bodyParser: { sizeLimit: "12mb" } },
};

function sanitize(name) {
  return String(name)
    .replace(/[^a-zA-Z0-9.\-_]/g, "_")
    .slice(0, 100);
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!isAuthenticatedSession(session)) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (req.method === "GET") {
    const { file } = req.query;
    if (!file) {
      return res.status(400).json({ error: "Missing file parameter" });
    }
    const safeFile = sanitize(file);
    const ext = extname(safeFile).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) {
      return res.status(400).json({ error: "Unsupported file type" });
    }
    const imagePath = join(CONF_DIR, IMAGES_SUBDIR, safeFile);
    if (!existsSync(imagePath)) {
      return res.status(404).json({ error: "Image not found" });
    }
    res.setHeader("Content-Type", MIME_MAP[ext] ?? "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(readFileSync(imagePath));
  }

  if (req.method === "POST") {
    if (!isAdminSession(session)) {
      return res.status(403).json({ error: "Admin role required" });
    }
    const { filename, dataUrl } = req.body ?? {};
    if (!filename || !dataUrl) {
      return res.status(400).json({ error: "filename and dataUrl are required" });
    }
    const safeFile = sanitize(filename);
    const ext = extname(safeFile).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) {
      return res.status(400).json({ error: "Unsupported file type" });
    }
    const match = String(dataUrl).match(/^data:[^;]+;base64,(.+)$/s);
    if (!match) {
      return res.status(400).json({ error: "Invalid dataUrl format — expected data:<mime>;base64,<data>" });
    }
    const buffer = Buffer.from(match[1], "base64");
    if (buffer.length > MAX_BYTES) {
      return res.status(413).json({ error: "Image too large (max 10 MB)" });
    }
    const imagesDir = join(CONF_DIR, IMAGES_SUBDIR);
    if (!existsSync(imagesDir)) {
      mkdirSync(imagesDir, { recursive: true });
    }
    const imagePath = join(imagesDir, safeFile);
    writeFileSync(imagePath, buffer);
    logger.info("Saved background image %s (%d bytes)", safeFile, buffer.length);
    const path = `/api/config/background-image?file=${encodeURIComponent(safeFile)}`;
    return res.status(200).json({ path, filename: safeFile });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
