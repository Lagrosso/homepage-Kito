import { readCustomCss, writeCustomCss } from "utils/config/css-writer";
import { getSession, isAdminSession, isAuthenticatedSession } from "utils/config/session";
import createLogger from "utils/logger";

const logger = createLogger("config-custom-css-api");

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!isAuthenticatedSession(session)) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  if (!isAdminSession(session)) {
    return res.status(403).json({ error: "Admin role required" });
  }

  if (req.method === "GET") {
    try {
      const content = readCustomCss();
      return res.status(200).json({ content });
    } catch (e) {
      logger.error("Failed to read custom.css: %s", e.message);
      return res.status(500).json({ error: "Could not read custom.css" });
    }
  }

  if (req.method === "POST") {
    const { action, comment, content, sourceBackupId } = req.body ?? {};
    if (typeof content !== "string") {
      return res.status(400).json({ error: "Request body must include a string 'content' field" });
    }
    try {
      const result = writeCustomCss(content, {
        actor: session.user,
        action: action === "restore" ? "restore" : "save",
        comment,
        sourceBackupId: typeof sourceBackupId === "string" ? sourceBackupId : null,
      });
      return res.status(200).json({ written: true, backupPath: result.backupPath });
    } catch (e) {
      logger.error("Failed to write custom.css: %s", e.message);
      return res.status(500).json({ error: "Could not write custom.css" });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
