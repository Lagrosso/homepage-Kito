import { getSettings } from "utils/config/config";

// Returns only non-secret, purely visual theme variables that the client sets
// as CSS custom properties (currently the card corner radius). Safe for any
// authenticated session (the login wall is enforced by middleware).
export default function handler(req, res) {
  try {
    const settings = getSettings();
    const cardRadius = typeof settings.cardRadius === "string" ? settings.cardRadius : null;
    return res.status(200).json({ cardRadius });
  } catch {
    return res.status(200).json({ cardRadius: null });
  }
}
