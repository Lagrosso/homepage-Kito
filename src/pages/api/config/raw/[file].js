import { checkAdminToken, isConfigEditEnabled } from "utils/config/admin-auth";
import { isEditableConfig, readRawConfig, writeRawConfig } from "utils/config/config-writer";
import createLogger from "utils/logger";

const logger = createLogger("config-raw-api");

export default async function handler(req, res) {
  // Whole feature is gated behind the env flag; pretend it doesn't exist otherwise.
  if (!isConfigEditEnabled()) {
    return res.status(404).json({ error: "Config editing is disabled" });
  }

  const { file } = req.query;
  if (!isEditableConfig(file)) {
    return res.status(400).json({ error: `Config file "${file}" is not editable` });
  }

  if (req.method === "GET") {
    try {
      const content = readRawConfig(file);
      return res.status(200).json({ file, content });
    } catch (e) {
      logger.error("Failed to read %s: %s", file, e.message);
      return res.status(500).json({ error: `Could not read ${file}` });
    }
  }

  if (req.method === "POST") {
    if (!checkAdminToken(req)) {
      return res.status(401).json({ error: "Invalid or missing config edit token" });
    }

    const { content } = req.body ?? {};
    if (typeof content !== "string") {
      return res.status(400).json({ error: "Request body must include a string 'content' field" });
    }

    const result = writeRawConfig(file, content);
    if (!result.written) {
      return res.status(422).json({ error: "Invalid YAML", detail: result.error });
    }

    return res.status(200).json({ written: true, backupPath: result.backupPath });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
