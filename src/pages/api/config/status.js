import { isConfigEditEnabled } from "utils/config/admin-auth";

// Public, token-free endpoint that only reveals whether the config editor is
// enabled. Used by the dashboard to conditionally show the editor link.
export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  return res.status(200).json({ enabled: isConfigEditEnabled() });
}
