import yaml from "js-yaml";

// Secret-aware preview model for widgets.yaml.
//
// widgets.yaml is a flat list of single-key maps (`- type: { ...options }`),
// see widgetsFromConfig() in utils/config/widget-helpers.js. The editor reads
// the RAW file (comments + {{HOMEPAGE_VAR_*}} placeholders intact), so the
// server-side redaction in cleanWidgetGroups() does NOT apply here — masking
// must happen client-side, before any value reaches the React/DOM layer.

// Marker shown in place of a sensitive value. The real value is never put into
// the preview model (and therefore never into the DOM, tooltips, or errors).
export const REDACTED = "[redacted]";

// Sensitive option keys. Seeded from the project's existing private-field list
// (["username","password","key","apiKey"] in utils/config/widget-helpers.js)
// and extended with token/secret (and headers, which often carry auth).
export const SENSITIVE_FIELDS = ["username", "password", "key", "apiKey", "token", "secret", "headers"];

const SENSITIVE_LOOKUP = new Set(SENSITIVE_FIELDS.map((f) => f.toLowerCase()));

export function isSensitiveKey(key) {
  return SENSITIVE_LOOKUP.has(String(key).toLowerCase());
}

// True if the value is (or contains) a {{HOMEPAGE_VAR_*}} / {{HOMEPAGE_FILE_*}}
// placeholder. Placeholders are not secrets and stay visible.
const PLACEHOLDER_RE = /\{\{HOMEPAGE_(?:VAR|FILE)_[^}]*\}\}/;
export function isPlaceholder(value) {
  return typeof value === "string" && PLACEHOLDER_RE.test(value);
}

// Unquoted placeholders break YAML parsing (`key: {{X}}` parses to an object,
// not the string), so before parsing we swap each placeholder for an
// inert token and restore it afterwards. This runs on a COPY of the content;
// the saved/edited YAML is never modified — YAML stays the source of truth.
const PLACEHOLDER_GLOBAL = /\{\{HOMEPAGE_(?:VAR|FILE)_[^}]*\}\}/g;
const TOKEN_RE = /__HP_PH_(\d+)__/g;

function tokenizePlaceholders(text) {
  const map = [];
  const tokenized = text.replace(PLACEHOLDER_GLOBAL, (match) => {
    const token = `__HP_PH_${map.length}__`;
    map.push(match);
    return token;
  });
  return { tokenized, map };
}

function restorePlaceholders(str, map) {
  return str.replace(TOKEN_RE, (whole, i) => map[Number(i)] ?? whole);
}

// Build a safe display string for a non-sensitive primitive/object value.
// Restores placeholder tokens and recursively masks any nested sensitive keys
// so a deeply buried secret can never surface.
function safeDisplay(value, map) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return restorePlaceholders(value, map);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  // object / array -> recursively mask, then compact-stringify
  return JSON.stringify(maskDeep(value, map));
}

// Recursively replace sensitive values inside nested objects/arrays.
function maskDeep(value, map) {
  if (Array.isArray(value)) {
    return value.map((v) => maskDeep(v, map));
  }
  if (value && typeof value === "object") {
    const out = {};
    Object.entries(value).forEach(([k, v]) => {
      if (isSensitiveKey(k) && !isPlaceholder(v)) {
        out[k] = REDACTED;
      } else if (typeof v === "string") {
        out[k] = restorePlaceholders(v, map);
      } else if (v && typeof v === "object") {
        out[k] = maskDeep(v, map);
      } else {
        out[k] = v;
      }
    });
    return out;
  }
  if (typeof value === "string") {
    return restorePlaceholders(value, map);
  }
  return value;
}

// Turn one widget's options map into an ordered list of preview fields.
// Each field is { key, value, redacted } where `value` is always display-safe.
export function maskWidgetOptions(options, map = []) {
  if (!options || typeof options !== "object") {
    return [];
  }
  return Object.entries(options).map(([key, raw]) => {
    // Restore the token form so placeholder detection works on the real string.
    const restored = typeof raw === "string" ? restorePlaceholders(raw, map) : raw;
    if (isSensitiveKey(key) && !isPlaceholder(restored)) {
      return { key, value: REDACTED, redacted: true };
    }
    return { key, value: safeDisplay(raw, map), redacted: false };
  });
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
