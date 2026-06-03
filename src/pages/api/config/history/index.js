import { listHistoryEntries } from "utils/config/backup-history";
import { getSession, isAdminSession, isAuthenticatedSession } from "utils/config/session";

function serializeEntry(entry) {
  return {
    ...entry,
    hasSnapshot: Boolean(entry.backupPath),
    restorable: Boolean(entry.backupPath),
  };
}

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

  const { action = "all", file = "all" } = req.query;
  const entries = listHistoryEntries({
    action: Array.isArray(action) ? action[0] : action,
    file: Array.isArray(file) ? file[0] : file,
  }).map(serializeEntry);

  return res.status(200).json({ entries });
}
