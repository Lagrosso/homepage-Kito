import { getSession, isAdminSession, isAuthenticatedSession } from "utils/config/session";

// Compatibility endpoint for older UI callers. Editability is now derived from
// the current session role, never from env flags or static tokens.
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getSession(req, res);
  const authenticated = isAuthenticatedSession(session);
  const isAdmin = isAdminSession(session);
  return res.status(200).json({
    authenticated,
    enabled: isAdmin,
    isAdmin,
    role: authenticated ? session.user.role : null,
  });
}
