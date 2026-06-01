import { verifyPassword } from "utils/config/password";
import { getSession } from "utils/config/session";
import { findUser } from "utils/config/users";

const INVALID_CREDENTIALS_ERROR = "Invalid username or password";

function safeUser(user) {
  return { username: user.username, role: user.role, groups: user.groups ?? [] };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { password, username } = req.body ?? {};
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(401).json({ error: INVALID_CREDENTIALS_ERROR });
  }

  const user = findUser(username.trim());
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ error: INVALID_CREDENTIALS_ERROR });
  }

  const sessionUser = safeUser(user);
  const session = await getSession(req, res);
  session.user = sessionUser;
  await session.save();

  return res.status(200).json({ user: sessionUser });
}
