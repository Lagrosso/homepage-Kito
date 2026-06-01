import { EDITABLE_CONFIGS, isEditableConfig, readRawConfig } from "utils/config/config-writer";
import { buildHealthReport, buildSingleFileHealthReport } from "utils/config/config-health";
import { getSession, isAdminSession, isAuthenticatedSession } from "utils/config/session";
import { loadUsers } from "utils/config/users";
import createLogger from "utils/logger";

const logger = createLogger("config-health-api");

function knownUserGroups() {
  try {
    return [...new Set(loadUsers().flatMap((user) => user.groups ?? []))];
  } catch {
    return [];
  }
}

function readAllRawConfigs() {
  return EDITABLE_CONFIGS.reduce((acc, file) => {
    acc[file] = readRawConfig(file);
    return acc;
  }, {});
}

async function requireAdmin(req, res) {
  const session = await getSession(req, res);
  if (!isAuthenticatedSession(session)) {
    res.status(401).json({ error: "Not authenticated" });
    return false;
  }
  if (!isAdminSession(session)) {
    res.status(403).json({ error: "Admin role required" });
    return false;
  }
  return true;
}

export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) {
    return undefined;
  }

  if (req.method === "GET") {
    try {
      const report = buildHealthReport(readAllRawConfigs(), { knownUserGroups: knownUserGroups() });
      return res.status(200).json(report);
    } catch (e) {
      logger.error("Failed to build config health report: %s", e.message);
      return res.status(500).json({ error: "Could not build config health report" });
    }
  }

  if (req.method === "POST") {
    const { file, content } = req.body ?? {};
    if (!isEditableConfig(file)) {
      return res.status(400).json({ error: `Config file "${file}" is not editable` });
    }
    if (typeof content !== "string") {
      return res.status(400).json({ error: "Request body must include string 'file' and 'content' fields" });
    }

    try {
      const report = buildSingleFileHealthReport(file, content, readAllRawConfigs(), {
        knownUserGroups: knownUserGroups(),
      });
      return res.status(200).json(report);
    } catch (e) {
      logger.error("Failed to build config health report for %s: %s", file, e.message);
      return res.status(500).json({ error: "Could not build config health report" });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
