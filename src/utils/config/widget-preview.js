import yaml from "js-yaml";

import { maskValue, tokenizePlaceholders } from "./secret-mask";

// Secret-aware preview model for widgets.yaml.
//
// widgets.yaml is a flat list of single-key maps (`- type: { ...options }`),
// see widgetsFromConfig() in utils/config/widget-helpers.js. The shared masking
// logic lives in secret-mask.js (re-exported here for backwards compatibility).
export { REDACTED, SENSITIVE_FIELDS, isPlaceholder, isSensitiveKey } from "./secret-mask";

// Turn one widget's options map into an ordered list of preview fields.
// Each field is { key, value, redacted } where `value` is always display-safe.
export function maskWidgetOptions(options, map = []) {
  if (!options || typeof options !== "object") {
    return [];
  }
  return Object.entries(options).map(([key, raw]) => ({ key, ...maskValue(key, raw, map) }));
}

// Parse raw widgets.yaml into the preview model expected by ConfigEditor:
// [{ name, entries: [{ name, type, index, fields }] }]. widgets.yaml has no
// groups, so everything lives under a single synthetic section. Throws on
// invalid YAML (ConfigEditor's Preview catches and shows the message).
export function parseWidgets(content) {
  const { tokenized, map } = tokenizePlaceholders(content ?? "");
  const data = yaml.load(tokenized);
  if (!Array.isArray(data)) {
    return [];
  }

  const entries = data
    .filter((widget) => widget && typeof widget === "object")
    .map((widget, index) => {
      const type = Object.keys(widget)[0];
      const options = widget[type];
      return {
        name: type,
        type,
        index,
        fields: maskWidgetOptions(options, map),
      };
    });

  return entries.length ? [{ name: "Info Widgets", entries }] : [];
}
