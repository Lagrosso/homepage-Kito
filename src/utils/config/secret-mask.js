// Shared, secret-aware masking for the read-only config previews
// (widgets.yaml, settings.yaml, ...). The editor reads RAW config files
// (comments + {{HOMEPAGE_VAR_*}} placeholders intact), so any redaction must
// happen client-side, before a value reaches the React/DOM layer.

// Marker shown in place of a sensitive value. The real value is never put into
// the preview model (and therefore never into the DOM, tooltips, or errors).
export const REDACTED = "[redacted]";

// Sensitive option keys whose value is redacted entirely. Seeded from the
// project's existing private-field list
// (["username","password","key","apiKey"] in utils/config/widget-helpers.js)
// and extended with token/secret (and headers, which often carry auth).
export const SENSITIVE_FIELDS = ["username", "password", "key", "apiKey", "token", "secret", "headers"];

// Keys whose OBJECT children are secret values: the child keys are safe to show,
// the child values are not. settings.yaml `providers:` maps a provider name to
// its API key, so the names are useful context but the keys must stay hidden.
export const SECRET_VALUE_CONTAINERS = ["providers"];

const SENSITIVE_LOOKUP = new Set(SENSITIVE_FIELDS.map((f) => f.toLowerCase()));
const CONTAINER_LOOKUP = new Set(SECRET_VALUE_CONTAINERS.map((f) => f.toLowerCase()));

export function isSensitiveKey(key) {
  return SENSITIVE_LOOKUP.has(String(key).toLowerCase());
}

function isSecretContainer(key) {
  return CONTAINER_LOOKUP.has(String(key).toLowerCase());
}

// True if the value is (or contains) a {{HOMEPAGE_VAR_*}} / {{HOMEPAGE_FILE_*}}
// placeholder. Placeholders are not secrets and stay visible.
const PLACEHOLDER_RE = /\{\{HOMEPAGE_(?:VAR|FILE)_[^}]*\}\}/;
export function isPlaceholder(value) {
  return typeof value === "string" && PLACEHOLDER_RE.test(value);
}

// Unquoted placeholders break YAML parsing (`key: {{X}}` parses to an object,
// not the string), so before parsing we swap each placeholder for an inert
// token and restore it afterwards. This runs on a COPY of the content; the
// saved/edited YAML is never modified — YAML stays the source of truth.
const PLACEHOLDER_GLOBAL = /\{\{HOMEPAGE_(?:VAR|FILE)_[^}]*\}\}/g;
const TOKEN_RE = /__HP_PH_(\d+)__/g;

export function tokenizePlaceholders(text) {
  const map = [];
  const tokenized = (text ?? "").replace(PLACEHOLDER_GLOBAL, (match) => {
    const token = `__HP_PH_${map.length}__`;
    map.push(match);
    return token;
  });
  return { tokenized, map };
}

export function restorePlaceholders(str, map) {
  return str.replace(TOKEN_RE, (whole, i) => map[Number(i)] ?? whole);
}

// Mask a single key/value pair. `inContainer` means we are inside a secret-value
// container (e.g. providers), so even a plainly-named value here is a secret.
// `raw` may be a tokenized placeholder, so restore first before any check.
function maskEntry(key, raw, map, inContainer) {
  const restored = typeof raw === "string" ? restorePlaceholders(raw, map) : raw;
  // Placeholders are never secrets and always stay visible.
  if (isPlaceholder(restored)) {
    return restored;
  }
  if (isSensitiveKey(key)) {
    return REDACTED;
  }
  if (raw && typeof raw === "object") {
    return maskDeep(raw, map, inContainer || isSecretContainer(key));
  }
  // primitive: a bare value inside a secret container is itself a secret
  if (inContainer) {
    return REDACTED;
  }
  return restored;
}

// Recursively mask an object/array, returning a secrets-free copy.
function maskDeep(value, map, inContainer) {
  if (Array.isArray(value)) {
    return value.map((v) => maskEntry(undefined, v, map, inContainer));
  }
  if (value && typeof value === "object") {
    const out = {};
    Object.entries(value).forEach(([k, v]) => {
      out[k] = maskEntry(k, v, map, inContainer);
    });
    return out;
  }
  return typeof value === "string" ? restorePlaceholders(value, map) : value;
}

// Stringify an already-masked value for display. `value` comes from maskEntry,
// so any nested secrets are already replaced — no further masking here.
function displayString(value) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

// Mask one field into a display-safe { value, redacted } pair for a preview
// card. `value` is always a string and never contains a real secret; `redacted`
// is true only when the whole field value was replaced.
export function maskValue(key, raw, map = []) {
  const masked = maskEntry(key, raw, map, false);
  return { value: displayString(masked), redacted: masked === REDACTED };
}
