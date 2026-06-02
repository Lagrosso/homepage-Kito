import { suggestServiceIcons } from "utils/config/icon-suggestions";
import { getSession, isAdminSession, isAuthenticatedSession } from "utils/config/session";
import createLogger from "utils/logger";

const logger = createLogger("icon-suggestions-api");

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

function cleanString(value) {
  return typeof value === "string" ? value.trim().slice(0, 300) : "";
}

export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) {
    return undefined;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const input = {
    name: cleanString(req.body?.name),
    href: cleanString(req.body?.href),
    widgetType: cleanString(req.body?.widgetType),
    currentIcon: cleanString(req.body?.currentIcon),
  };

  try {
    const suggestions = await suggestServiceIcons(input);
    return res.status(200).json({ suggestions });
  } catch (error) {
    logger.error("Failed to suggest service icons: %s", error.message);
    return res.status(200).json({ suggestions: [] });
  }
}
