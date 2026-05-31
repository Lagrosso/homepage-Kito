import { getSession } from "utils/config/session";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getSession(req, res);
  session.destroy();

  return res.status(204).end();
}
