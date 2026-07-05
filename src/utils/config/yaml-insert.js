// Pure, FS-free helpers for inserting a single service into a raw services.yaml
// string. These work on TEXT only (splicing), never parse→re-serialize the
// whole document, so comments and {{HOMEPAGE_VAR_*}} placeholders are preserved.
// See CLAUDE.md "Config-Konventionen".

// Strip a single pair of surrounding quotes from a YAML scalar.
function unquote(value) {
  const v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

// Decide whether a scalar must be double-quoted to stay valid YAML.
function needsQuoting(value) {
  return (
    value === "" ||
    /^\s|\s$/.test(value) || // leading/trailing whitespace
    /[:#[\]{}&*!|>'"%@`,]/.test(value) || // YAML-significant characters
    /^[-?]/.test(value) || // could be read as a list item / complex key
    /[\r\n]/.test(value) // embedded line breaks (e.g. multi-line docs fields)
  );
}

// Quote + escape a scalar only when necessary, keeping simple values clean.
// Embedded line breaks become the two-character `\n` escape (a raw line break
// inside a double-quoted plain-line scalar would otherwise fold into a space
// or break the document, since this module splices single text lines).
export function quoteScalar(value) {
  const s = String(value ?? "");
  if (!needsQuoting(s)) {
    return s;
  }
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r\n|\r|\n/g, "\\n")}"`;
}

function normalizeGroups(groups) {
  if (typeof groups === "string") {
    return normalizeGroups(groups.split(","));
  }
  if (!Array.isArray(groups)) {
    return [];
  }
  return [...new Set(groups.map((group) => String(group).trim()).filter((group) => group.length > 0))];
}

function appendAccessGroups(lines, groups, indent = "        ") {
  const normalizedGroups = normalizeGroups(groups);
  if (normalizedGroups.length === 0) {
    return;
  }
  lines.push(`${indent}access:`);
  lines.push(`${indent}  groups: [${normalizedGroups.map(quoteScalar).join(", ")}]`);
}

// Context badges (M13): a flat inline list on the service, e.g. `badges: [lan, critical]`.
function appendBadges(lines, badges, indent = "        ") {
  const normalized = normalizeGroups(badges);
  if (normalized.length === 0) {
    return;
  }
  lines.push(`${indent}badges: [${normalized.map(quoteScalar).join(", ")}]`);
}

// Multi-URL context keys (M14): per-service reachable URLs by network.
const URL_CONTEXT_KEYS = ["lan", "tailscale", "public"];

function appendUrls(lines, urls, indent = "        ") {
  if (!urls || typeof urls !== "object") {
    return;
  }
  const present = URL_CONTEXT_KEYS.filter((key) => typeof urls[key] === "string" && urls[key].trim());
  if (present.length === 0) {
    return;
  }
  lines.push(`${indent}urls:`);
  present.forEach((key) => lines.push(`${indent}  ${key}: ${quoteScalar(urls[key].trim())}`));
}

// Structured service docs (M15): free-text documentation fields.
const DOCS_CONTEXT_KEYS = ["purpose", "location", "backup", "admin", "note", "troubleshooting"];

function appendDocs(lines, docs, indent = "        ") {
  if (!docs || typeof docs !== "object") {
    return;
  }
  const present = DOCS_CONTEXT_KEYS.filter((key) => typeof docs[key] === "string" && docs[key].trim());
  if (present.length === 0) {
    return;
  }
  lines.push(`${indent}docs:`);
  present.forEach((key) => lines.push(`${indent}  ${key}: ${quoteScalar(docs[key].trim())}`));
}

// Build the indented YAML for one service entry (under a group). Mirrors the
// skeleton indentation: service at 4 spaces, properties at 8 spaces.
export function buildServiceEntry({
  name,
  href,
  siteMonitor,
  description,
  icon,
  server,
  container,
  accessGroups,
  urls,
  docs,
  badges,
}) {
  const lines = [`    - ${quoteScalar(name)}:`];
  if (href) {
    lines.push(`        href: ${quoteScalar(href)}`);
  }
  if (siteMonitor) {
    lines.push(`        siteMonitor: ${quoteScalar(siteMonitor)}`);
  }
  appendUrls(lines, urls);
  appendDocs(lines, docs);
  if (description) {
    lines.push(`        description: ${quoteScalar(description)}`);
  }
  if (icon) {
    lines.push(`        icon: ${quoteScalar(icon)}`);
  }
  if (server) {
    lines.push(`        server: ${quoteScalar(server)}`);
  }
  if (container) {
    lines.push(`        container: ${quoteScalar(container)}`);
  }
  appendBadges(lines, badges);
  appendAccessGroups(lines, accessGroups);
  return lines.join("\n");
}

// Build the indented YAML for one bookmark entry. Bookmarks nest one extra
// level: the properties live in a single-item list under the name, with the
// first property carrying the `- ` list marker (matches the skeleton).
export function buildBookmarkEntry({ name, abbr, href, icon, description, accessGroups }) {
  const props = [];
  if (abbr) {
    props.push(["abbr", abbr]);
  }
  if (href) {
    props.push(["href", href]);
  }
  if (icon) {
    props.push(["icon", icon]);
  }
  if (description) {
    props.push(["description", description]);
  }
  const lines = [`    - ${quoteScalar(name)}:`];
  props.forEach(([key, value], i) => {
    // First property opens the list item ("        - key: ..."), the rest
    // align underneath it ("          key: ...").
    const prefix = i === 0 ? "        - " : "          ";
    lines.push(`${prefix}${key}: ${quoteScalar(value)}`);
  });
  appendAccessGroups(lines, accessGroups, "          ");
  return lines.join("\n");
}

// Match a top-level group header line: `- Group Name:` (no leading indent).
const GROUP_HEADER = /^-\s+(.+?):\s*$/;

// Splice a pre-built entry block into rawText. If the named group exists, the
// entry is inserted into that group block; otherwise a new group block is
// appended. Returns new raw text. rawText is never re-serialized, so comments
// and {{HOMEPAGE_VAR_*}} placeholders are preserved.
export function insertEntry(rawText, group, entry) {
  const entryLines = entry.split("\n");
  const text = rawText ?? "";
  const lines = text.split("\n");

  // Locate the target group header.
  let groupIdx = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(GROUP_HEADER);
    if (m && unquote(m[1]) === group) {
      groupIdx = i;
      break;
    }
  }

  // Group not found → append a fresh block at the end.
  if (groupIdx === -1) {
    const block = `- ${quoteScalar(group)}:\n${entry}`;
    const trimmed = text.replace(/\s*$/, "");
    return trimmed.length ? `${trimmed}\n\n${block}\n` : `${block}\n`;
  }

  // Find where this group's block ends (next top-level header / doc marker).
  let end = lines.length;
  for (let i = groupIdx + 1; i < lines.length; i += 1) {
    if (GROUP_HEADER.test(lines[i]) || /^---\s*$/.test(lines[i])) {
      end = i;
      break;
    }
  }

  // Back up over trailing blank lines so the entry sits next to its siblings.
  let insertAt = end;
  while (insertAt - 1 > groupIdx && lines[insertAt - 1].trim() === "") {
    insertAt -= 1;
  }

  lines.splice(insertAt, 0, ...entryLines);
  return lines.join("\n");
}

// Insert a service into a raw services.yaml string.
export function insertService(
  rawText,
  { group, name, href, siteMonitor, description, icon, server, container, accessGroups, urls, docs, badges },
) {
  return insertEntry(
    rawText,
    group,
    buildServiceEntry({
      name,
      href,
      siteMonitor,
      description,
      icon,
      server,
      container,
      accessGroups,
      urls,
      docs,
      badges,
    }),
  );
}

// Insert a bookmark into a raw bookmarks.yaml string.
export function insertBookmark(rawText, { group, name, abbr, href, icon, description, accessGroups }) {
  return insertEntry(rawText, group, buildBookmarkEntry({ name, abbr, href, icon, description, accessGroups }));
}
