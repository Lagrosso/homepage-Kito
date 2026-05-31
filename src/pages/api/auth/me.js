import { getSession, isAuthenticatedSession } from "utils/config/session";

function safeUser(user) {
  return { username: user.username, role: user.role };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getSession(req, res);
  if (!isAuthenticatedSession(session)) {
    return res.status(401).json({ authenticated: false });
  }

  return res.status(200).json({ authenticated: true, user: safeUser(session.user) });
}
