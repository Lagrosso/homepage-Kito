import { getHistoryDraftRoute, getHistoryEntry, readHistoryContent } from "utils/config/backup-history";
import { getSession, isAdminSession, isAuthenticatedSession } from "utils/config/session";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!isAuthenticatedSession(session)) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  if (!isAdminSession(session)) {
    return res.status(403).json({ error: "Admin role required" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const entry = getHistoryEntry(id);
  if (!entry) {
    return res.status(404).json({ error: "History entry not found" });
  }

  const route = getHistoryDraftRoute(entry.file);
  if (!route) {
    return res.status(400).json({ error: `No editor route available for ${entry.file}` });
  }

  try {
    const content = readHistoryContent(entry);
    return res.status(200).json({
      draft: {
        filename: entry.file,
        route,
        content,
        kind: "restore",
        sourceBackupId: entry.id,
        actor: session.user ? { role: session.user.role, username: session.user.username } : null,
      },
      entry,
    });
  } catch (error) {
    return res.status(404).json({ error: error.message });
  }
}
