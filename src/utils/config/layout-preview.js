import yaml from "js-yaml";

// Read-only helpers for the /admin/layout tab manager. They parse RAW config text
// with js-yaml (no env substitution, no mutation) — the eemeli writers in
// yaml-edit.js stay the source of truth for changes.

// Parse settings.yaml into an ordered list of { group, tab } from the `layout`
// block. Supports list form (`- Group: {tab}`), object form (`Group: {tab}`) and
// a missing block. Returns [] on parse errors so the UI can degrade gracefully.
export function parseLayout(content) {
  let data;
  try {
    data = yaml.load(content);
  } catch {
    return [];
  }
  const layout = data?.layout;
  const toTab = (opts) => (opts && opts.tab != null ? String(opts.tab) : "");

  if (Array.isArray(layout)) {
    return layout
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const group = Object.keys(item)[0];
        return { group, tab: toTab(item[group]) };
      })
      .filter((e) => e.group);
  }
  if (layout && typeof layout === "object") {
    return Object.entries(layout).map(([group, opts]) => ({ group, tab: toTab(opts) }));
  }
  return [];
}

// Extract the top-level group names from a raw services.yaml / bookmarks.yaml
// string (list of single-key maps). Returns [] on parse errors.
export function groupNamesFromRaw(content) {
  let data;
  try {
    data = yaml.load(content);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .filter((group) => group && typeof group === "object")
    .map((group) => Object.keys(group)[0])
    .filter(Boolean);
}
