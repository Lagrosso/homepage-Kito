import {
  getUserPreferences,
  isValidPreferenceKey,
  recordOpen,
  setEnabled,
  toggleFavorite,
} from "utils/config/user-preferences";
import { getSession, isAuthenticatedSession } from "utils/config/session";

// Per-user dashboard preferences API (M12). Always operates on the *session*
// user's own data — never another user's — so both admins and viewers may manage
// their own favorites / usage history.
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!isAuthenticatedSession(session)) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const username = session.user.username;

  if (req.method === "GET") {
    return res.status(200).json({ preferences: getUserPreferences(username) });
  }

  if (req.method === "PATCH") {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    try {
      let preferences;
      if (typeof body.toggleFavorite === "string") {
        if (!isValidPreferenceKey(body.toggleFavorite)) {
          return res.status(400).json({ error: "Invalid key" });
        }
        preferences = toggleFavorite(username, body.toggleFavorite);
      } else if (typeof body.recordOpen === "string") {
        if (!isValidPreferenceKey(body.recordOpen)) {
          return res.status(400).json({ error: "Invalid key" });
        }
        preferences = recordOpen(username, body.recordOpen);
      } else if (typeof body.enabled === "boolean") {
        preferences = setEnabled(username, body.enabled);
      } else {
        return res.status(400).json({ error: "No valid action provided" });
      }
      return res.status(200).json({ preferences });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }

  res.setHeader("Allow", "GET, PATCH");
  return res.status(405).json({ error: "Method not allowed" });
}
