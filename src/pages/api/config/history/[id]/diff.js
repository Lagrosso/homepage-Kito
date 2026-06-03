import { buildHistoryDiff, getHistoryEntry } from "utils/config/backup-history";
import { getSession, isAdminSession, isAuthenticatedSession } from "utils/config/session";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!isAuthenticatedSession(session)) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  if (!isAdminSession(session)) {
    return res.status(403).json({ error: "Admin role required" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const entry = getHistoryEntry(id);
  if (!entry) {
    return res.status(404).json({ error: "History entry not found" });
  }

  try {
    const diff = buildHistoryDiff(entry);
    return res.status(200).json(diff);
  } catch (error) {
    return res.status(404).json({ error: error.message });
  }
}
