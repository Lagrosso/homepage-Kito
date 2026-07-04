import yaml from "js-yaml";

// Read-only helpers for the /admin/layout tab manager. They parse RAW config text
// with js-yaml (no env substitution, no mutation) — the eemeli writers in
// yaml-edit.js stay the source of truth for changes.

// Map a group's layout options object to the fields the UI cares about. Raw
// values are kept (no defaulting) so the UI can show the current on/off state;
// missing options stay undefined. Nested-group maps inside opts are ignored.
function readGroupOptions(opts) {
  const o = opts && typeof opts === "object" ? opts : {};
  return {
    tab: o.tab != null ? String(o.tab) : "",
    style: o.style != null ? String(o.style) : undefined,
    columns: o.columns,
    header: o.header,
    initiallyCollapsed: o.initiallyCollapsed,
    useEqualHeights: o.useEqualHeights,
  };
}

// Parse settings.yaml into an ordered list of per-group layout entries from the
// `layout` block: { group, tab, style, columns, header, initiallyCollapsed,
// useEqualHeights }. Supports list form (`- Group: {…}`), object form
// (`Group: {…}`) and a missing block. Returns [] on parse errors so the UI can
// degrade gracefully.
export function parseLayout(content) {
  let data;
  try {
    data = yaml.load(content);
  } catch {
    return [];
  }
  const layout = data?.layout;

  if (Array.isArray(layout)) {
    return layout
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const group = Object.keys(item)[0];
        return { group, ...readGroupOptions(item[group]) };
      })
      .filter((e) => e.group);
  }
  if (layout && typeof layout === "object") {
    return Object.entries(layout).map(([group, opts]) => ({ group, ...readGroupOptions(opts) }));
  }
  return [];
}

// Read the global, top-level group-arrangement settings. Returns raw values
// ({ maxGroupColumns, fiveColumns }); missing keys stay undefined. [] / {} safe.
export function parseGlobalLayout(content) {
  let data;
  try {
    data = yaml.load(content);
  } catch {
    return {};
  }
  if (!data || typeof data !== "object") {
    return {};
  }
  return { maxGroupColumns: data.maxGroupColumns, fiveColumns: data.fiveColumns };
}

// Read the top-level `tabs:` block (per-tab access.groups, independent of
// `layout[group].tab`). Returns { [tabName]: string[] }; a tab with no entry or
// an empty/malformed access.groups maps to []. [] / {} / parse errors are safe.
export function parseTabAccess(content) {
  let data;
  try {
    data = yaml.load(content);
  } catch {
    return {};
  }
  const tabs = data?.tabs;
  if (!tabs || typeof tabs !== "object") {
    return {};
  }
  return Object.fromEntries(
    Object.entries(tabs).map(([tab, opts]) => [
      tab,
      Array.isArray(opts?.access?.groups) ? opts.access.groups.map(String) : [],
    ]),
  );
}

// Read the top-level `profiles:` block (named reusable group-set presets, e.g.
// `profiles: { Familie: { groups: [family, kids] } }`). Returns
// { [profileName]: string[] }; a profile with malformed/missing `groups` maps
// to []. [] / {} / parse errors are safe.
export function parseProfiles(content) {
  let data;
  try {
    data = yaml.load(content);
  } catch {
    return {};
  }
  const profiles = data?.profiles;
  if (!profiles || typeof profiles !== "object") {
    return {};
  }
  return Object.fromEntries(
    Object.entries(profiles).map(([name, opts]) => [name, Array.isArray(opts?.groups) ? opts.groups.map(String) : []]),
  );
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
