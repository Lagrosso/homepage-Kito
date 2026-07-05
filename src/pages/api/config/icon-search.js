import { fetchDashboardIconIndex, searchDashboardIcons } from "utils/config/icon-search";
import { getSession, isAdminSession, isAuthenticatedSession } from "utils/config/session";
import createLogger from "utils/logger";

const logger = createLogger("icon-search-api");

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

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const query = typeof req.query?.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  if (query.length < 2) {
    return res.status(200).json({ results: [] });
  }

  try {
    const index = await fetchDashboardIconIndex();
    return res.status(200).json({ results: searchDashboardIcons(query, index) });
  } catch (error) {
    logger.error("Failed to search dashboard icons: %s", error.message);
    return res.status(200).json({ results: [] });
  }
}
