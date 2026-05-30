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
    /^[-?]/.test(value) // could be read as a list item / complex key
  );
}

// Quote + escape a scalar only when necessary, keeping simple values clean.
export function quoteScalar(value) {
  const s = String(value ?? "");
  if (!needsQuoting(s)) {
    return s;
  }
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

// Build the indented YAML for one service entry (under a group). Mirrors the
// skeleton indentation: service at 4 spaces, properties at 8 spaces.
export function buildServiceEntry({ name, href, icon, server }) {
  const lines = [`    - ${quoteScalar(name)}:`];
  if (href) {
    lines.push(`        href: ${quoteScalar(href)}`);
  }
  if (icon) {
    lines.push(`        icon: ${quoteScalar(icon)}`);
  }
  if (server) {
    lines.push(`        server: ${quoteScalar(server)}`);
  }
  return lines.join("\n");
}

// Build the indented YAML for one bookmark entry. Bookmarks nest one extra
// level: the properties live in a single-item list under the name, with the
// first property carrying the `- ` list marker (matches the skeleton).
export function buildBookmarkEntry({ name, abbr, href, icon, description }) {
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
export function insertService(rawText, { group, name, href, icon, server }) {
  return insertEntry(rawText, group, buildServiceEntry({ name, href, icon, server }));
}

// Insert a bookmark into a raw bookmarks.yaml string.
export function insertBookmark(rawText, { group, name, abbr, href, icon, description }) {
  return insertEntry(rawText, group, buildBookmarkEntry({ name, abbr, href, icon, description }));
}
