import yaml from "js-yaml";

import { isPlaceholder, maskValue, tokenizePlaceholders } from "./secret-mask";

// Secret-aware preview model for settings.yaml.
//
// settings.yaml is a top-level MAP of key/value settings (not a list). The
// editor reads the RAW file (comments + {{HOMEPAGE_VAR_*}} placeholders intact),
// so masking happens client-side via secret-mask.js. Known settings are sorted
// into curated groups; anything unrecognized falls into "Weitere Einstellungen"
// so no field is silently dropped.

// Curated grouping of well-known settings keys. Order here drives display order.
const SETTINGS_GROUPS = [
  { name: "Allgemein", keys: ["title", "description", "startUrl", "language", "base", "instanceName"] },
  {
    name: "Layout / UI",
    keys: ["theme", "color", "headerStyle", "layout", "statusStyle", "iconStyle", "fiveColumns", "maxGroupColumns"],
  },
  {
    name: "Verhalten",
    keys: ["quicklaunch", "hideVersion", "disableUpdateCheck", "showStats", "hideErrors", "groupsInitiallyCollapsed"],
  },
  { name: "Hintergrund / Branding", keys: ["background", "favicon", "target", "logo"] },
  { name: "Provider / Integrationen", keys: ["providers", "cardBlur", "useEqualHeights"] },
];

function valueTypeOf(raw) {
  if (typeof raw === "boolean") return "boolean";
  if (typeof raw === "number") return "number";
  if (typeof raw === "string") return "string";
  return "complex"; // object / array / null → edit raw only
}

function toEntry(key, raw, map) {
  const { value, redacted } = maskValue(key, raw, map);
  const valueType = valueTypeOf(raw);
  // Only plain scalar, non-secret, non-placeholder values are safe to edit via a
  // form; everything else stays raw-only so secrets and structure are preserved.
  const editable = !redacted && valueType !== "complex" && !(valueType === "string" && isPlaceholder(value));
  return { name: key, key, value, redacted, valueType, editable };
}

// Parse raw settings.yaml into the ConfigEditor preview model:
// [{ name, entries: [{ name, key, value, redacted }] }]. Throws on invalid YAML
// (ConfigEditor's Preview catches and shows the message).
export function parseSettings(content) {
  const { tokenized, map } = tokenizePlaceholders(content ?? "");
  const data = yaml.load(tokenized);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return [];
  }

  const assigned = new Set();
  const groups = [];

  SETTINGS_GROUPS.forEach((group) => {
    const entries = group.keys
      .filter((key) => Object.prototype.hasOwnProperty.call(data, key))
      .map((key) => {
        assigned.add(key);
        return toEntry(key, data[key], map);
      });
    if (entries.length) {
      groups.push({ name: group.name, entries });
    }
  });

  // Unknown fields keep their file order and are never dropped.
  const rest = Object.keys(data).filter((key) => !assigned.has(key));
  if (rest.length) {
    groups.push({ name: "Weitere Einstellungen", entries: rest.map((key) => toEntry(key, data[key], map)) });
  }

  return groups;
}
