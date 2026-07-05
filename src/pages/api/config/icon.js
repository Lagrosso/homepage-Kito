import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { extname, join } from "path";

import { CONF_DIR } from "utils/config/config";
import {
  hasAllowedIconExt,
  ICON_MIME_MAP,
  ICONS_SUBDIR,
  listLocalIcons,
  localIconPath,
  sanitizeIconName,
} from "utils/config/local-icons";
import { getSession, isAdminSession, isAuthenticatedSession } from "utils/config/session";
import createLogger from "utils/logger";

const logger = createLogger("config-icon-api");
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB — icons are small
const FETCH_TIMEOUT_MS = 8000;

// Extension implied by an image content-type (for cached remote icons whose URL
// has no extension).
const CONTENT_TYPE_EXT = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
  "image/avif": ".avif",
  "image/x-icon": ".ico",
  "image/vnd.microsoft.icon": ".ico",
};

export const config = {
  api: { bodyParser: { sizeLimit: "4mb" } },
};

function iconsDir() {
  const dir = join(CONF_DIR, ICONS_SUBDIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function iconPathResponse(safeFile) {
  return { path: `/api/config/icon?file=${encodeURIComponent(safeFile)}`, filename: safeFile };
}

function saveIcon(safeFile, buffer) {
  iconsDir();
  writeFileSync(localIconPath(CONF_DIR, safeFile), buffer);
  logger.info("Saved icon %s (%d bytes)", safeFile, buffer.length);
  return iconPathResponse(safeFile);
}

async function handleUpload(req, res) {
  const { filename, dataUrl } = req.body ?? {};
  if (!filename || !dataUrl) {
    return res.status(400).json({ error: "filename and dataUrl are required" });
  }
  const safeFile = sanitizeIconName(filename);
  if (!hasAllowedIconExt(safeFile)) {
    return res.status(400).json({ error: "Unsupported file type" });
  }
  const match = String(dataUrl).match(/^data:[^;]+;base64,(.+)$/s);
  if (!match) {
    return res.status(400).json({ error: "Invalid dataUrl format — expected data:<mime>;base64,<data>" });
  }
  const buffer = Buffer.from(match[1], "base64");
  if (buffer.length > MAX_BYTES) {
    return res.status(413).json({ error: "Icon too large (max 2 MB)" });
  }
  return res.status(200).json(saveIcon(safeFile, buffer));
}

async function handleCacheFromUrl(req, res, sourceUrl) {
  let url;
  try {
    url = new URL(sourceUrl);
  } catch {
    return res.status(400).json({ error: "Invalid sourceUrl" });
  }
  if (!/^https?:$/.test(url.protocol)) {
    return res.status(400).json({ error: "sourceUrl must be http(s)" });
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS) : null;
  let response;
  try {
    response = await fetch(url.toString(), { signal: controller?.signal });
  } catch (error) {
    logger.warn("Failed to fetch icon from %s: %s", url.origin, error.message);
    return res.status(502).json({ error: "Could not download the icon" });
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
  if (!response.ok) {
    return res.status(502).json({ error: `Icon download failed (${response.status})` });
  }
  const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!contentType.startsWith("image/")) {
    return res.status(415).json({ error: "sourceUrl did not return an image" });
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.length === 0) {
    return res.status(502).json({ error: "Downloaded icon was empty" });
  }
  if (buffer.length > MAX_BYTES) {
    return res.status(413).json({ error: "Icon too large (max 2 MB)" });
  }

  const urlName = url.pathname.split("/").filter(Boolean).pop() || "icon";
  let safeFile = sanitizeIconName(urlName);
  if (!hasAllowedIconExt(safeFile)) {
    const ext = CONTENT_TYPE_EXT[contentType];
    if (!ext) {
      return res.status(415).json({ error: "Unsupported image type" });
    }
    safeFile = sanitizeIconName(`${safeFile}${ext}`);
  }
  return res.status(200).json(saveIcon(safeFile, buffer));
}

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!isAuthenticatedSession(session)) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (req.method === "GET") {
    const { file } = req.query;
    // Admin-only listing (no file param) for the reuse gallery.
    if (!file) {
      if (!isAdminSession(session)) {
        return res.status(403).json({ error: "Admin role required" });
      }
      return res.status(200).json({ files: listLocalIcons(CONF_DIR) });
    }
    // Serving is available to any authenticated user so the dashboard renders.
    const safeFile = sanitizeIconName(file);
    const ext = extname(safeFile).toLowerCase();
    if (!hasAllowedIconExt(safeFile)) {
      return res.status(400).json({ error: "Unsupported file type" });
    }
    const iconPath = localIconPath(CONF_DIR, safeFile);
    if (!existsSync(iconPath)) {
      return res.status(404).json({ error: "Icon not found" });
    }
    res.setHeader("Content-Type", ICON_MIME_MAP[ext] ?? "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(readFileSync(iconPath));
  }

  if (req.method === "POST") {
    if (!isAdminSession(session)) {
      return res.status(403).json({ error: "Admin role required" });
    }
    const sourceUrl = req.body?.sourceUrl;
    if (sourceUrl) {
      return handleCacheFromUrl(req, res, sourceUrl);
    }
    return handleUpload(req, res);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
