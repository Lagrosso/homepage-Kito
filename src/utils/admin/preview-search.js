// Read-only helpers for the config editor's card preview search (see
// components/admin/config-editor.jsx). They narrow the parsed preview groups by
// a free-text query without touching the raw YAML (the editor stays the source
// of truth). Config-agnostic: works for services, bookmarks, widgets and
// settings previews because it only inspects an entry's own string/string-array
// values (name, href, description, abbr, badges, …) and ignores object/boolean
// helper fields such as `isGroup` or nested locator objects.

// True if any of the entry's own primitive values contains the (lowercased)
// query. Strings are matched directly; arrays are matched element-wise for
// string members (e.g. `badges`). Everything else (booleans, nested objects,
// numbers) is ignored so internal helper fields never produce phantom matches.
export function entryMatches(entry, q) {
  if (!entry || typeof entry !== "object") {
    return false;
  }
  for (const value of Object.values(entry)) {
    if (typeof value === "string") {
      if (value.toLowerCase().includes(q)) {
        return true;
      }
    } else if (Array.isArray(value)) {
      if (value.some((item) => typeof item === "string" && item.toLowerCase().includes(q))) {
        return true;
      }
    }
  }
  return false;
}

// Filter parsed preview groups by a free-text query. An empty/whitespace query
// returns the groups unchanged (same reference). A group whose NAME matches keeps
// all its entries; otherwise only matching entries are kept and groups left with
// no entries are dropped.
export function filterPreviewGroups(groups, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) {
    return groups;
  }
  const result = [];
  for (const group of groups) {
    const groupMatches = String(group.name ?? "")
      .toLowerCase()
      .includes(q);
    if (groupMatches) {
      result.push(group);
      continue;
    }
    const entries = (group.entries ?? []).filter((entry) => entryMatches(entry, q));
    if (entries.length > 0) {
      result.push({ ...group, entries });
    }
  }
  return result;
}
