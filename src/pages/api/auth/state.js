import { hasUsers } from "utils/config/users";

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userExists = hasUsers();
  return res.status(200).json({ hasUsers: userExists, setupRequired: !userExists });
}
