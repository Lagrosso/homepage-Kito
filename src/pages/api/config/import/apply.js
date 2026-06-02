import { readRawConfig } from "utils/config/config-writer";
import { applyImport } from "utils/config/import-assistant";
import { getSession, isAdminSession, isAuthenticatedSession } from "utils/config/session";

const IMPORTABLE_FILES = ["services.yaml", "bookmarks.yaml", "widgets.yaml", "settings.yaml", "docker.yaml"];

function existingRawConfigs() {
  return Object.fromEntries(IMPORTABLE_FILES.map((filename) => [filename, readRawConfig(filename)]));
}

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

  try {
    const { sourceType, inputs, decisions, includeSecrets } = req.body ?? {};
    const result = applyImport({
      sourceType,
      inputs: inputs ?? {},
      decisions: decisions ?? {},
      includeSecrets: Boolean(includeSecrets),
      existingRawConfigs: existingRawConfigs(),
    });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(422).json({ error: error.message });
  }
}
