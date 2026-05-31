import { getSession } from "utils/config/session";
import { addUser, hasUsers } from "utils/config/users";

function safeUser(user) {
  return { username: user.username, role: user.role };
}

function isValidSetupInput(username, password) {
  return typeof username === "string" && username.trim().length > 0 && typeof password === "string" && password.length > 0;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (hasUsers()) {
    return res.status(409).json({ error: "Setup has already been completed" });
  }

  const { password, username } = req.body ?? {};
  if (!isValidSetupInput(username, password)) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const user = await addUser({ username, password, role: "admin" });
  const session = await getSession(req, res);
  session.user = safeUser(user);
  await session.save();

  return res.status(201).json({ user: safeUser(user) });
}
