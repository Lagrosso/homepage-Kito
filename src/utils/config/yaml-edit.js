// Pure, FS-free helpers for structurally EDITING/DELETING existing entries in a
// raw services.yaml string via the eemeli `yaml` Document API.
//
// Unlike yaml-insert.js (text splicing for appends), these operate on the parsed
// Document so they can change/remove deeply nested entries. Round-trip behaviour:
// parseDocument(text) + doc.toString() with NO options reproduces the original
// layout for untouched nodes — comments, blank lines and the file's 4/8-space
// indentation are preserved; newly added scalars inherit sibling indentation.
// We therefore intentionally pass no stringify options. See CLAUDE.md
// "Config-Konventionen".
//
// Placeholder safety: a BARE unquoted {{HOMEPAGE_*}} value (e.g. `key: {{HOMEPAGE_VAR_X}}`,
// where the value begins with `{`) is read by YAML as a flow map and would be
// corrupted on round-trip (and is already mis-parsed by js-yaml today). When such
// a value exists anywhere in the document we refuse structured editing and direct
// the user to the raw editor, so placeholders are never altered.

import { isMap, isScalar, isSeq, parseDocument } from "yaml";

import { REDACTED, SECRET_VALUE_CONTAINERS, isSensitiveKey } from "./secret-mask";
import { isServiceWidgetSecretField } from "./service-widget-templates";

export const EDITABLE_SERVICE_FIELDS = ["href", "icon", "description", "server", "container"];
export const EDITABLE_BOOKMARK_FIELDS = ["abbr", "href", "icon", "description"];

const SECRET_CONTAINER_LOOKUP = new Set(SECRET_VALUE_CONTAINERS.map((f) => f.toLowerCase()));
function isSecretContainerKey(key) {
  return SECRET_CONTAINER_LOOKUP.has(String(key).toLowerCase());
}

// Matches a placeholder sitting directly in value position (after `:` `-` `[` `,`
// or at line start), i.e. an unquoted, non-embedded {{HOMEPAGE_*}}.
const BARE_PLACEHOLDER = /(?:^|[:[,\-])[ \t]*\{\{HOMEPAGE_(?:VAR|FILE)_[^}\n]+\}\}/m;

// True if the raw text contains a bare unquoted {{HOMEPAGE_*}} value. Such files
// cannot be round-tripped safely, so the UI disables structured edit/delete for
// them (the buttons are hidden) and points the user at the raw editor.
export function hasBarePlaceholder(rawText) {
  return BARE_PLACEHOLDER.test(rawText ?? "");
}

function parseConfigDoc(rawText) {
  const text = rawText ?? "";
  const doc = parseDocument(text);
  if (doc.errors.length > 0) {
    throw new Error(doc.errors[0].message);
  }
  if (hasBarePlaceholder(text)) {
    throw new Error(
      "Structured editing unavailable: this file contains an unquoted {{HOMEPAGE_*}} placeholder. Edit the raw YAML instead.",
    );
  }
  return doc;
}

// Top-level shape: a sequence of single-key maps { GroupName: [ ... ] }.
function findGroupSeq(doc, groupName) {
  const top = doc.contents;
  if (!isSeq(top)) {
    return null;
  }
  for (const item of top.items) {
    if (isMap(item) && item.items.length > 0) {
      const pair = item.items[0];
      if (String(pair.key) === groupName) {
        return isSeq(pair.value) ? pair.value : null;
      }
    }
  }
  return null;
}

// An entry is a single-key map { Name: value } inside a group sequence.
function findEntryByName(groupSeq, name) {
  for (let i = 0; i < groupSeq.items.length; i += 1) {
    const item = groupSeq.items[i];
    if (isMap(item) && item.items.length > 0) {
      const pair = item.items[0];
      if (String(pair.key) === name) {
        return { item, pair, index: i };
      }
    }
  }
  return null;
}

function locate(doc, group, name) {
  const groupSeq = findGroupSeq(doc, group);
  if (!groupSeq) {
    throw new Error(`Group "${group}" not found`);
  }
  const found = findEntryByName(groupSeq, name);
  if (!found) {
    throw new Error(`Entry "${name}" not found in "${group}"`);
  }
  return { groupSeq, ...found };
}

// Rename an entry by mutating its key scalar in place (keeps position + comments).
function applyRename(pair, oldName, newRaw) {
  const newName = typeof newRaw === "string" ? newRaw.trim() : "";
  if (newName && newName !== oldName) {
    pair.key.value = newName;
  }
}

// Set/clear one scalar field on a map. `undefined` leaves it as-is; "" deletes it;
// otherwise the value is set in place (keeps inline comments, re-quotes if needed).
function applyScalarField(map, field, raw) {
  if (raw === undefined) {
    return;
  }
  const value = typeof raw === "string" ? raw.trim() : raw;
  if (value === "") {
    map.delete(field);
    return;
  }
  const existing = map.get(field, true);
  if (isScalar(existing)) {
    existing.value = value;
  } else {
    map.set(field, value);
  }
}

function normalizeAccessGroups(groups) {
  if (typeof groups === "string") {
    return normalizeAccessGroups(groups.split(","));
  }
  if (!Array.isArray(groups)) {
    return [];
  }
  return [...new Set(groups.map((group) => String(group).trim()).filter((group) => group.length > 0))];
}

function applyAccessGroups(doc, map, rawGroups) {
  if (rawGroups === undefined) {
    return;
  }

  const groups = normalizeAccessGroups(rawGroups);
  let accessMap = map.get("access", true);

  if (groups.length === 0) {
    if (isMap(accessMap)) {
      accessMap.delete("groups");
      if (accessMap.items.length === 0) {
        map.delete("access");
      }
    }
    return;
  }

  if (!isMap(accessMap)) {
    accessMap = doc.createNode({});
    accessMap.flow = false;
    map.set("access", accessMap);
    accessMap = map.get("access", true);
  }

  if (isMap(accessMap)) {
    accessMap.set("groups", groups);
  }
}

// Read a map's `access.groups` as a plain string array (empty if absent/malformed).
function getAccessGroupsFromMap(map) {
  const accessMap = map.get("access", true);
  if (!isMap(accessMap)) {
    return [];
  }
  const groupsNode = accessMap.get("groups", true);
  if (!isSeq(groupsNode)) {
    return [];
  }
  return groupsNode.items.map((item) => String(isScalar(item) ? item.value : item));
}

// Multi-URL context keys (M14): per-service reachable URLs by network.
export const SERVICE_URL_KEYS = ["lan", "tailscale", "public"];

// Set/clear the nested `urls` map on a service. Only the keys present in
// `rawUrls` are touched; an empty string removes that key; when `urls` ends up
// empty it is removed entirely. `undefined` leaves `urls` untouched.
function applyUrls(doc, map, rawUrls) {
  if (rawUrls === undefined) {
    return;
  }
  const urls = rawUrls && typeof rawUrls === "object" ? rawUrls : {};
  let urlsMap = map.get("urls", true);

  SERVICE_URL_KEYS.forEach((key) => {
    const raw = urls[key];
    if (raw === undefined) {
      return;
    }
    const value = typeof raw === "string" ? raw.trim() : raw;
    if (value === "" || value === null) {
      if (isMap(urlsMap)) {
        urlsMap.delete(key);
      }
      return;
    }
    if (!isMap(urlsMap)) {
      urlsMap = doc.createNode({});
      urlsMap.flow = false;
      map.set("urls", urlsMap);
      urlsMap = map.get("urls", true);
    }
    const existing = urlsMap.get(key, true);
    if (isScalar(existing)) {
      existing.value = value;
    } else {
      urlsMap.set(key, value);
    }
  });

  if (isMap(urlsMap) && urlsMap.items.length === 0) {
    map.delete("urls");
  }
}

// Edit an existing service's fields and/or rename it. Only the keys present in
// `values` are touched; an empty string removes that field; unknown/nested
// fields (widget:, ping:, …) on the entry are left untouched. Returns new raw text.
export function updateServiceEntry(rawText, { group, name }, values) {
  const doc = parseConfigDoc(rawText);
  const { pair } = locate(doc, group, name);

  // A nested-group entry (value is a sequence) is not a simple, field-editable service.
  if (!isMap(pair.value)) {
    throw new Error(`"${name}" is not a simple service entry`);
  }
  const propsMap = pair.value;

  applyRename(pair, name, values.name);
  EDITABLE_SERVICE_FIELDS.forEach((field) => applyScalarField(propsMap, field, values[field]));
  applyAccessGroups(doc, propsMap, values.accessGroups);
  applyUrls(doc, propsMap, values.urls);

  return doc.toString();
}

function ensureMapField(doc, map, field) {
  let child = map.get(field, true);
  if (!isMap(child)) {
    child = doc.createNode({});
    child.flow = false;
    map.set(field, child);
    child = map.get(field, true);
  }
  return child;
}

function setWidgetOption(doc, widgetMap, field, raw) {
  if (field === "type" || raw === undefined) {
    return;
  }

  const existing = widgetMap.get(field, true);
  const isSecret = isSensitiveKey(field) || isServiceWidgetSecretField(field);

  if (raw === REDACTED) {
    return;
  }

  if (typeof raw === "string") {
    const value = raw.trim();
    if (value === "") {
      if (!isSecret) {
        widgetMap.delete(field);
      }
      return;
    }
    if (isScalar(existing)) {
      existing.value = value;
    } else {
      widgetMap.set(field, value);
    }
    return;
  }

  if (raw === null) {
    if (!isSecret) {
      widgetMap.delete(field);
    }
    return;
  }

  const node = doc.createNode(raw);
  if (isMap(node) || isSeq(node)) {
    node.flow = false;
  }
  widgetMap.set(field, node);
}

export function updateServiceWidget(rawText, { group, name }, values = {}) {
  const doc = parseConfigDoc(rawText);
  const { pair } = locate(doc, group, name);

  if (!isMap(pair.value)) {
    throw new Error(`"${name}" is not a simple service entry`);
  }
  if (!values.type || typeof values.type !== "string") {
    throw new Error("Widget type is required");
  }

  const widgetMap = ensureMapField(doc, pair.value, "widget");
  widgetMap.flow = false;
  widgetMap.set("type", values.type.trim());

  Object.entries(values).forEach(([field, raw]) => setWidgetOption(doc, widgetMap, field, raw));

  return doc.toString();
}

export function deleteServiceWidget(rawText, { group, name }) {
  const doc = parseConfigDoc(rawText);
  const { pair } = locate(doc, group, name);

  if (!isMap(pair.value)) {
    throw new Error(`"${name}" is not a simple service entry`);
  }
  pair.value.delete("widget");
  return doc.toString();
}

// Remove an existing service entry from its group. The group itself (even if it
// becomes empty) and all other entries/comments are preserved. Returns new raw text.
export function deleteServiceEntry(rawText, { group, name }) {
  const doc = parseConfigDoc(rawText);
  const { groupSeq, index } = locate(doc, group, name);
  groupSeq.items.splice(index, 1);
  return doc.toString();
}

// --- bookmarks.yaml -------------------------------------------------------
// Bookmarks nest one level deeper than services: { Group: [ { Name: [ {props} ] } ] }.
// The props live in a single-item list under the name (or, tolerantly, directly
// as a map). Returns the props map node, or null if the entry is not editable.
function bookmarkPropsMap(pair) {
  if (isSeq(pair.value)) {
    const first = pair.value.items[0];
    return isMap(first) ? first : null;
  }
  return isMap(pair.value) ? pair.value : null;
}

export function updateBookmarkEntry(rawText, { group, name }, values) {
  const doc = parseConfigDoc(rawText);
  const { pair } = locate(doc, group, name);
  const propsMap = bookmarkPropsMap(pair);
  if (!propsMap) {
    throw new Error(`"${name}" is not a simple bookmark entry`);
  }

  applyRename(pair, name, values.name);
  EDITABLE_BOOKMARK_FIELDS.forEach((field) => applyScalarField(propsMap, field, values[field]));
  applyAccessGroups(doc, propsMap, values.accessGroups);

  return doc.toString();
}

export function deleteBookmarkEntry(rawText, { group, name }) {
  const doc = parseConfigDoc(rawText);
  const { groupSeq, index } = locate(doc, group, name);
  groupSeq.items.splice(index, 1);
  return doc.toString();
}

// --- widgets.yaml (secret-aware) ------------------------------------------
// widgets.yaml is a flat list of single-key maps { type: {options} }; entries are
// addressed by their list index (types can repeat). Secret option values are never
// supplied by the form, so they are left byte-identical here.
function widgetOptionsMap(doc, index) {
  const top = doc.contents;
  if (!isSeq(top) || !top.items[index]) {
    throw new Error(`Widget #${index} not found`);
  }
  const item = top.items[index];
  if (!isMap(item) || item.items.length === 0) {
    throw new Error(`Widget #${index} is not a valid widget`);
  }
  const optionsMap = item.items[0].value;
  return isMap(optionsMap) ? optionsMap : null;
}

// Update only the option keys present in `values`. A secret marker is never
// written; blanking a sensitive key keeps it (so secrets can't be wiped by accident),
// blanking a non-secret key removes it. Returns new raw text.
export function updateWidgetOptions(rawText, { index }, values) {
  const doc = parseConfigDoc(rawText);
  const optionsMap = widgetOptionsMap(doc, index);
  if (!optionsMap) {
    throw new Error(`Widget #${index} has no editable options`);
  }

  Object.entries(values).forEach(([key, raw]) => setWidgetOption(doc, optionsMap, key, raw));

  return doc.toString();
}

export function addInfoWidget(rawText, values = {}) {
  const doc = parseConfigDoc(rawText);
  if (!values.type || typeof values.type !== "string") {
    throw new Error("Widget type is required");
  }

  if (!doc.contents) {
    doc.contents = doc.createNode([]);
  }
  const top = doc.contents;
  if (!isSeq(top)) {
    throw new Error("widgets.yaml is not a list");
  }

  const item = doc.createNode({ [values.type.trim()]: {} });
  item.flow = false;
  const optionsMap = item.get(values.type.trim(), true);
  if (isMap(optionsMap)) {
    optionsMap.flow = false;
    Object.entries(values).forEach(([key, raw]) => {
      if (key !== "name") {
        setWidgetOption(doc, optionsMap, key, raw);
      }
    });
  }
  top.items.push(item);
  return doc.toString();
}

export function deleteWidget(rawText, { index }) {
  const doc = parseConfigDoc(rawText);
  const top = doc.contents;
  if (!isSeq(top) || !top.items[index]) {
    throw new Error(`Widget #${index} not found`);
  }
  top.items.splice(index, 1);
  return doc.toString();
}

// --- settings.yaml (secret-aware) -----------------------------------------
// settings.yaml is a top-level map. Only scalar, non-secret values are editable;
// complex (object/array) and secret/container values must be edited raw. Returns
// new raw text.
export function updateSetting(rawText, { key }, newValue) {
  const doc = parseConfigDoc(rawText);
  const map = doc.contents;
  if (!isMap(map)) {
    throw new Error("settings.yaml is not a mapping");
  }
  if (isSensitiveKey(key) || isSecretContainerKey(key)) {
    throw new Error(`"${key}" is a secret and must be edited in the raw YAML`);
  }
  const existing = map.get(key, true);
  if (existing !== undefined && !isScalar(existing)) {
    throw new Error(`"${key}" is a structured value and must be edited in the raw YAML`);
  }
  const value = typeof newValue === "string" ? newValue.trim() : newValue;
  if (value === REDACTED) {
    throw new Error("Refusing to write a redacted value");
  }
  // Set in place (keeps inline comment / re-quotes); empty stays empty rather
  // than deleting — deletion is an explicit, separate action.
  if (isScalar(existing)) {
    existing.value = value;
  } else {
    map.set(key, value);
  }
  return doc.toString();
}

export function deleteSetting(rawText, { key }) {
  const doc = parseConfigDoc(rawText);
  const map = doc.contents;
  if (!isMap(map) || map.get(key, true) === undefined) {
    throw new Error(`Setting "${key}" not found`);
  }
  map.delete(key);
  return doc.toString();
}

// Set/clear one scalar field inside the `background` object in settings.yaml.
// Creates the `background` map if absent. Clears the field when value is empty/null.
// Returns new raw text.
export function setBackgroundField(rawText, field, value) {
  const doc = parseConfigDoc(rawText);
  const root = doc.contents;
  if (!isMap(root)) {
    throw new Error("settings.yaml is not a mapping");
  }
  const cleared = value === undefined || value === null || (typeof value === "string" && value.trim() === "");

  let bgNode = root.get("background", true);

  if (!isMap(bgNode)) {
    if (cleared) {
      return doc.toString(); // nothing to remove, already absent
    }
    const newBg = doc.createNode({});
    newBg.flow = false;
    root.set("background", newBg);
    bgNode = root.get("background", true);
  }

  if (isMap(bgNode)) {
    bgNode.flow = false;
    applyScalarField(bgNode, field, cleared ? "" : value);
  }

  return doc.toString();
}

// Remove the entire `background` key from settings.yaml. No-op when absent.
export function removeBackground(rawText) {
  const doc = parseConfigDoc(rawText);
  const root = doc.contents;
  if (!isMap(root)) {
    throw new Error("settings.yaml is not a mapping");
  }
  root.delete("background");
  return doc.toString();
}

// --- reordering / moving (M5c) --------------------------------------------
// All swaps operate on the YAMLSeq `items` arrays; nodes carry their own
// comments, so reordering keeps inline comments with the moved entry/group.

// Index of a top-level group `{ GroupName: [...] }` in the document sequence.
function findGroupIndex(doc, groupName) {
  const top = doc.contents;
  if (!isSeq(top)) {
    return -1;
  }
  return top.items.findIndex((item) => isMap(item) && item.items.length > 0 && String(item.items[0].key) === groupName);
}

// Swap two entries of a (local) items array. `up`/`down` out of range = no-op.
function swapInArray(arr, index, direction) {
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= arr.length) {
    return false;
  }
  const tmp = arr[index];
  arr[index] = arr[target];
  arr[target] = tmp;
  return true;
}

// Move an entry up/down within its group (services & bookmarks share structure).
export function moveEntryInGroup(rawText, { group, name }, direction) {
  const doc = parseConfigDoc(rawText);
  const { groupSeq, index } = locate(doc, group, name);
  swapInArray(groupSeq.items, index, direction);
  return doc.toString();
}

// Move a whole group up/down at the top level (services & bookmarks).
export function moveGroup(rawText, { group }, direction) {
  const doc = parseConfigDoc(rawText);
  const top = doc.contents;
  if (!isSeq(top)) {
    throw new Error("Config is not a list of groups");
  }
  const index = findGroupIndex(doc, group);
  if (index === -1) {
    throw new Error(`Group "${group}" not found`);
  }
  swapInArray(top.items, index, direction);
  return doc.toString();
}

// Move an entry out of `fromGroup` into `toGroup` (both must exist). Services &
// bookmarks. With `toIndex` it inserts at that position (drag & drop, M5d);
// without it appends to the end (button move, M5c).
export function moveEntryToGroup(rawText, { fromGroup, name, toGroup, toIndex }) {
  if (!toGroup || fromGroup === toGroup) {
    return rawText ?? "";
  }
  const doc = parseConfigDoc(rawText);
  const { groupSeq: fromSeq, index } = locate(doc, fromGroup, name);
  const toSeq = findGroupSeq(doc, toGroup);
  if (!toSeq) {
    throw new Error(`Group "${toGroup}" not found`);
  }
  const [node] = fromSeq.items.splice(index, 1);
  // A previously-emptied group serializes as flow `[]`; force block style so the
  // moved entry renders as a normal block list item, not inline `[ { … } ]`.
  toSeq.flow = false;
  if (typeof toIndex === "number" && toIndex >= 0 && toIndex <= toSeq.items.length) {
    toSeq.items.splice(toIndex, 0, node);
  } else {
    toSeq.items.push(node);
  }
  return doc.toString();
}

// Move a widget up/down in the flat widgets list (by index).
export function moveWidget(rawText, { index }, direction) {
  const doc = parseConfigDoc(rawText);
  const top = doc.contents;
  if (!isSeq(top) || !top.items[index]) {
    throw new Error(`Widget #${index} not found`);
  }
  swapInArray(top.items, index, direction);
  return doc.toString();
}

// --- arbitrary index moves (drag & drop, M5d) -----------------------------
// Move an item to an arbitrary index inside an array (dnd-kit arrayMove
// semantics: remove `from`, then insert at `to`). Returns true if it ran.
function arrayMoveInPlace(arr, from, to) {
  if (from < 0 || from >= arr.length) {
    return false;
  }
  const [node] = arr.splice(from, 1);
  const dest = to < 0 ? arr.length + to : Math.min(to, arr.length);
  arr.splice(dest, 0, node);
  return true;
}

// Move an entry to an arbitrary index within its own group.
export function moveEntryToIndex(rawText, { group, name }, toIndex) {
  const doc = parseConfigDoc(rawText);
  const { groupSeq, index } = locate(doc, group, name);
  arrayMoveInPlace(groupSeq.items, index, toIndex);
  return doc.toString();
}

// Move a top-level group to an arbitrary index.
export function moveGroupToIndex(rawText, { group }, toIndex) {
  const doc = parseConfigDoc(rawText);
  const top = doc.contents;
  if (!isSeq(top)) {
    throw new Error("Config is not a list of groups");
  }
  const index = findGroupIndex(doc, group);
  if (index === -1) {
    throw new Error(`Group "${group}" not found`);
  }
  arrayMoveInPlace(top.items, index, toIndex);
  return doc.toString();
}

// Move a widget to an arbitrary index in the flat widgets list.
export function moveWidgetToIndex(rawText, { index }, toIndex) {
  const doc = parseConfigDoc(rawText);
  const top = doc.contents;
  if (!isSeq(top) || !top.items[index]) {
    throw new Error(`Widget #${index} not found`);
  }
  arrayMoveInPlace(top.items, index, toIndex);
  return doc.toString();
}

// --- settings.yaml `layout:` / tabs (M6) ----------------------------------
// Tabs are derived from settings.yaml `layout[group].tab`. The `layout` block can
// be a YAML list (`- Group: {…}`, ordered, preferred), an object (`Group: {…}`) or
// absent. These helpers edit it in place (comment-preserving); the existing form
// is kept, a freshly created block is written as a block list.

// The per-group "name → options" pairs of the layout block, regardless of form.
function layoutPairs(layout) {
  if (isSeq(layout)) {
    return layout.items.filter((it) => isMap(it) && it.items.length > 0).map((it) => it.items[0]);
  }
  if (isMap(layout)) {
    return layout.items;
  }
  return [];
}

// Drop group entries whose options became empty (e.g. after clearing the only tab),
// so settings.yaml doesn't accumulate dangling `- Group: {}` items.
function pruneEmptyLayoutEntries(layout) {
  const isEmptyOpts = (v) => !isMap(v) || v.items.length === 0;
  if (isSeq(layout)) {
    for (let i = layout.items.length - 1; i >= 0; i -= 1) {
      const it = layout.items[i];
      if (isMap(it) && it.items.length > 0 && isEmptyOpts(it.items[0].value)) {
        layout.items.splice(i, 1);
      }
    }
  } else if (isMap(layout)) {
    for (let i = layout.items.length - 1; i >= 0; i -= 1) {
      if (isEmptyOpts(layout.items[i].value)) {
        layout.items.splice(i, 1);
      }
    }
  }
}

// Set or clear one scalar field (`tab`, `style`, `columns`, `header`, …) on a
// group's `layout` options. A value is written in place (comment-preserving);
// "" / whitespace / null / undefined clears the field. Creates the layout block
// and the group entry as needed, prunes entries whose options become empty, and
// refuses an unexpected scalar `layout:` (raw editor stays the escape hatch).
// Returns new raw text.
export function setGroupLayoutField(rawText, { group, field }, value) {
  const doc = parseConfigDoc(rawText);
  const root = doc.contents;
  if (!isMap(root)) {
    throw new Error("settings.yaml is not a mapping");
  }
  const cleared = value === undefined || value === null || (typeof value === "string" && value.trim() === "");

  let layout = root.get("layout", true);
  const pair = layoutPairs(layout).find((p) => String(p.key) === group) ?? null;

  if (!pair) {
    if (cleared) {
      return doc.toString(); // group has no entry and the field is empty: nothing to do
    }
    if (!isSeq(layout) && !isMap(layout)) {
      // A non-null scalar `layout:` is an unexpected shape — don't silently
      // overwrite it; the raw editor stays the escape hatch.
      if (isScalar(layout) && layout.value != null && layout.value !== "") {
        throw new Error("`layout` is not a list/mapping — edit it in the raw editor.");
      }
      layout = doc.createNode([]);
      layout.flow = false;
      root.set("layout", layout);
    }
    let created;
    if (isSeq(layout)) {
      const item = doc.createNode({ [group]: null });
      item.flow = false;
      layout.items.push(item);
      created = item.items[0];
    } else {
      layout.set(group, null);
      created = layout.items[layout.items.length - 1];
    }
    const opts = doc.createNode({});
    opts.flow = false;
    created.value = opts;
    applyScalarField(opts, field, value);
    return doc.toString();
  }

  // Group entry exists.
  if (!isMap(pair.value)) {
    if (cleared) {
      return doc.toString();
    }
    const opts = doc.createNode({});
    opts.flow = false;
    pair.value = opts;
  }
  const opts = pair.value;
  opts.flow = false; // an empty `{}` entry would otherwise stay inline flow
  applyScalarField(opts, field, value);
  pruneEmptyLayoutEntries(layout);
  return doc.toString();
}

// Assign a group to a tab (empty `tab` = remove the tab → group falls back to the
// default view). Thin wrapper over setGroupLayoutField for the `tab` field.
export function assignGroupToTab(rawText, { group, tab }) {
  return setGroupLayoutField(rawText, { group, field: "tab" }, tab);
}

// --- top-level `tabs:` block — per-tab access.groups -----------------------
// Independent of `layout[group].tab`: a tab with no entry here (or an empty
// access.groups) stays visible to everyone, matching how services/bookmarks
// behave without access.groups. Shape: `tabs: { <TabName>: { access: { groups } } }`.

function findTabPair(tabsMap, tab) {
  return isMap(tabsMap) ? tabsMap.items.find((p) => String(p.key) === tab) : undefined;
}

// Set/replace a tab's access.groups. Empty groups clears/removes the entry
// (and the whole `tabs:` block if it becomes empty). Reuses the same generic
// applyAccessGroups helper services/bookmarks use. Returns new raw text.
export function setTabAccessGroups(rawText, { tab }, groupsRaw) {
  const doc = parseConfigDoc(rawText);
  const root = doc.contents;
  if (!isMap(root)) {
    throw new Error("settings.yaml is not a mapping");
  }
  const groups = normalizeAccessGroups(groupsRaw);

  let tabsMap = root.get("tabs", true);

  if (groups.length === 0) {
    // Nothing to clear if there's no tabs block or no entry for this tab.
    const pair = findTabPair(tabsMap, tab);
    if (!pair) {
      return doc.toString();
    }
    if (isMap(pair.value)) {
      pair.value.delete("access");
    }
    if (!isMap(pair.value) || pair.value.items.length === 0) {
      tabsMap.items.splice(tabsMap.items.indexOf(pair), 1);
    }
    if (tabsMap.items.length === 0) {
      root.delete("tabs");
    }
    return doc.toString();
  }

  if (!isMap(tabsMap)) {
    if (isScalar(tabsMap) && tabsMap.value != null && tabsMap.value !== "") {
      throw new Error("`tabs` is not a mapping — edit it in the raw editor.");
    }
    tabsMap = doc.createNode({});
    tabsMap.flow = false;
    root.set("tabs", tabsMap);
    tabsMap = root.get("tabs", true);
  }

  let entry = tabsMap.get(tab, true);
  if (!isMap(entry)) {
    entry = doc.createNode({});
    entry.flow = false;
    tabsMap.set(tab, entry);
    entry = tabsMap.get(tab, true);
  }
  applyAccessGroups(doc, entry, groups);
  return doc.toString();
}

// Rename a tab: every layout group whose `tab` equals `from` is set to `to`,
// and its `tabs.<from>` access-groups entry (if any) moves to `tabs.<to>`
// (merging into an existing `tabs.<to>` entry rather than overwriting it).
export function renameTab(rawText, { from, to }) {
  const doc = parseConfigDoc(rawText);
  const layout = doc.contents?.get("layout", true);
  const target = typeof to === "string" ? to.trim() : "";
  if (!target) {
    throw new Error("New tab name is required");
  }
  let changed = 0;
  layoutPairs(layout).forEach((p) => {
    if (isMap(p.value)) {
      const tabNode = p.value.get("tab", true);
      if (isScalar(tabNode) && String(tabNode.value) === from) {
        tabNode.value = target;
        changed += 1;
      }
    }
  });
  if (changed === 0) {
    throw new Error(`Tab "${from}" not found`);
  }

  const tabsMap = doc.contents?.get("tabs", true);
  const fromPair = findTabPair(tabsMap, from);
  if (fromPair && target !== from) {
    const fromGroups = isMap(fromPair.value) ? getAccessGroupsFromMap(fromPair.value) : [];
    tabsMap.items.splice(tabsMap.items.indexOf(fromPair), 1);
    if (fromGroups.length > 0) {
      const toPair = findTabPair(tabsMap, target);
      const existingGroups = toPair && isMap(toPair.value) ? getAccessGroupsFromMap(toPair.value) : [];
      const mergedGroups = [...new Set([...existingGroups, ...fromGroups])];
      let entry = tabsMap.get(target, true);
      if (!isMap(entry)) {
        entry = doc.createNode({});
        entry.flow = false;
        tabsMap.set(target, entry);
        entry = tabsMap.get(target, true);
      }
      applyAccessGroups(doc, entry, mergedGroups);
    }
    if (tabsMap.items.length === 0) {
      doc.contents.delete("tabs");
    }
  }

  return doc.toString();
}

// Delete a tab: remove the `tab` key from every group that used it (groups stay,
// falling back to the default view), and drop its `tabs.<tab>` access entry.
// Empty group entries and an emptied `tabs:` block are pruned.
export function deleteTab(rawText, { tab }) {
  const doc = parseConfigDoc(rawText);
  const layout = doc.contents?.get("layout", true);
  let changed = 0;
  layoutPairs(layout).forEach((p) => {
    if (isMap(p.value)) {
      const tabNode = p.value.get("tab", true);
      if (isScalar(tabNode) && String(tabNode.value) === tab) {
        p.value.delete("tab");
        changed += 1;
      }
    }
  });
  if (changed === 0) {
    throw new Error(`Tab "${tab}" not found`);
  }
  pruneEmptyLayoutEntries(layout);

  const tabsMap = doc.contents?.get("tabs", true);
  const pair = findTabPair(tabsMap, tab);
  if (pair) {
    tabsMap.items.splice(tabsMap.items.indexOf(pair), 1);
    if (tabsMap.items.length === 0) {
      doc.contents.delete("tabs");
    }
  }

  return doc.toString();
}

// Resolve the reorderable container of the `layout:` block and an index lookup
// by group name. Works on the list form (preferred) and the mapping form.
function locateLayoutForReorder(rawText) {
  const doc = parseConfigDoc(rawText);
  const root = doc.contents;
  if (!isMap(root)) {
    throw new Error("settings.yaml is not a mapping");
  }
  const layout = root.get("layout", true);
  if (isSeq(layout)) {
    return {
      doc,
      items: layout.items,
      indexOf: (g) => layout.items.findIndex((it) => isMap(it) && it.items.length > 0 && String(it.items[0].key) === g),
    };
  }
  if (isMap(layout)) {
    return { doc, items: layout.items, indexOf: (g) => layout.items.findIndex((p) => String(p.key) === g) };
  }
  throw new Error("`layout` is not a list/mapping — edit it in the raw editor.");
}

function layoutItemTab(item) {
  const value = isMap(item) && item.items.length > 0 ? item.items[0].value : item?.value;
  if (!isMap(value)) {
    return "";
  }
  const tabNode = value.get("tab", true);
  return isScalar(tabNode) && tabNode.value != null ? String(tabNode.value) : "";
}

// Move a group within the settings.yaml `layout:` block to an arbitrary index.
// The dashboard renders groups in `layout` order (per tab, that order filtered
// to the tab), so this is what actually controls group order. The group must
// already have a layout entry (assign a tab/option first); throws otherwise.
export function moveLayoutGroupToIndex(rawText, { group }, toIndex) {
  const { doc, items, indexOf } = locateLayoutForReorder(rawText);
  const index = indexOf(group);
  if (index === -1) {
    throw new Error(`Group "${group}" is not in the layout`);
  }
  arrayMoveInPlace(items, index, toIndex);
  return doc.toString();
}

// Move a group up/down by one position within the `layout:` block.
export function moveLayoutGroup(rawText, { group }, direction) {
  const { doc, items, indexOf } = locateLayoutForReorder(rawText);
  const index = indexOf(group);
  if (index === -1) {
    throw new Error(`Group "${group}" is not in the layout`);
  }
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= items.length) {
    return doc.toString();
  }
  arrayMoveInPlace(items, index, target);
  return doc.toString();
}

// Move a complete tab block up/down. Tabs are represented by contiguous groups
// with the same `layout[group].tab` value. To make the visible tab order user
// controlled, move all entries for that tab together in the layout order.
export function moveLayoutTab(rawText, { tab }, direction) {
  const { doc, items } = locateLayoutForReorder(rawText);
  const targetTab = typeof tab === "string" ? tab.trim() : "";
  if (!targetTab) {
    throw new Error("Tab name is required");
  }

  const ranges = [];
  for (let i = 0; i < items.length; i += 1) {
    const itemTab = layoutItemTab(items[i]);
    if (!itemTab) {
      continue;
    }
    const previous = ranges[ranges.length - 1];
    if (previous && previous.tab === itemTab && previous.end === i) {
      previous.end = i + 1;
    } else {
      ranges.push({ tab: itemTab, start: i, end: i + 1 });
    }
  }

  const index = ranges.findIndex((range) => range.tab === targetTab);
  if (index === -1) {
    throw new Error(`Tab "${targetTab}" not found`);
  }
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= ranges.length) {
    return doc.toString();
  }

  const range = ranges[index];
  const targetRange = ranges[targetIndex];
  const block = items.splice(range.start, range.end - range.start);
  const insertAt = direction === "up" ? targetRange.start : targetRange.end - block.length;
  items.splice(insertAt, 0, ...block);
  return doc.toString();
}

// --- top-level `profiles:` block — named reusable group-set presets --------
// Shape: `profiles: { <Name>: { groups: [...] } }`. Independent of tabs/layout;
// used as presets for the admin "view as" preview switcher (M10b) and to
// prefill the group textfield when creating/editing users (/admin/users). No
// `access` wrapper here: a profile itself *is* a set of groups, not a thing
// that has access, so it doesn't reuse applyAccessGroups' nested shape.

function findProfilePair(profilesMap, name) {
  return isMap(profilesMap) ? profilesMap.items.find((p) => String(p.key) === name) : undefined;
}

// Read a map's `groups` (direct, not nested under `access`) as a plain string
// array (empty if absent/malformed).
function getGroupsFromMap(map) {
  const groupsNode = map.get("groups", true);
  if (!isSeq(groupsNode)) {
    return [];
  }
  return groupsNode.items.map((item) => String(isScalar(item) ? item.value : item));
}

// Set a map's `groups` field directly. Empty groups clears the field.
function applyGroupsField(map, rawGroups) {
  const groups = normalizeAccessGroups(rawGroups);
  if (groups.length === 0) {
    map.delete("groups");
    return;
  }
  map.set("groups", groups);
}

// Set/replace a profile's groups. Empty groups clears/removes the entry (and
// the whole `profiles:` block if it becomes empty). Returns new raw text.
export function setProfileGroups(rawText, { profile }, groupsRaw) {
  const doc = parseConfigDoc(rawText);
  const root = doc.contents;
  if (!isMap(root)) {
    throw new Error("settings.yaml is not a mapping");
  }
  const groups = normalizeAccessGroups(groupsRaw);

  let profilesMap = root.get("profiles", true);

  if (groups.length === 0) {
    const pair = findProfilePair(profilesMap, profile);
    if (!pair) {
      return doc.toString(); // nothing to clear
    }
    profilesMap.items.splice(profilesMap.items.indexOf(pair), 1);
    if (profilesMap.items.length === 0) {
      root.delete("profiles");
    }
    return doc.toString();
  }

  if (!isMap(profilesMap)) {
    if (isScalar(profilesMap) && profilesMap.value != null && profilesMap.value !== "") {
      throw new Error("`profiles` is not a mapping — edit it in the raw editor.");
    }
    profilesMap = doc.createNode({});
    profilesMap.flow = false;
    root.set("profiles", profilesMap);
    profilesMap = root.get("profiles", true);
  }

  let entry = profilesMap.get(profile, true);
  if (!isMap(entry)) {
    entry = doc.createNode({});
    entry.flow = false;
    profilesMap.set(profile, entry);
    entry = profilesMap.get(profile, true);
  }
  applyGroupsField(entry, groups);
  return doc.toString();
}

// Rename a profile. Merges into an existing `to` entry's groups (union) rather
// than overwriting it, matching renameTab's merge behaviour.
export function renameProfile(rawText, { from, to }) {
  const doc = parseConfigDoc(rawText);
  const root = doc.contents;
  if (!isMap(root)) {
    throw new Error("settings.yaml is not a mapping");
  }
  const target = typeof to === "string" ? to.trim() : "";
  if (!target) {
    throw new Error("New profile name is required");
  }
  const profilesMap = root.get("profiles", true);
  const fromPair = findProfilePair(profilesMap, from);
  if (!fromPair) {
    throw new Error(`Profile "${from}" not found`);
  }
  if (target === from) {
    return doc.toString();
  }

  const fromGroups = isMap(fromPair.value) ? getGroupsFromMap(fromPair.value) : [];
  profilesMap.items.splice(profilesMap.items.indexOf(fromPair), 1);

  const toPair = findProfilePair(profilesMap, target);
  const existingGroups = toPair && isMap(toPair.value) ? getGroupsFromMap(toPair.value) : [];
  const mergedGroups = [...new Set([...existingGroups, ...fromGroups])];

  let entry = profilesMap.get(target, true);
  if (!isMap(entry)) {
    entry = doc.createNode({});
    entry.flow = false;
    profilesMap.set(target, entry);
    entry = profilesMap.get(target, true);
  }
  applyGroupsField(entry, mergedGroups);
  return doc.toString();
}

// Delete a profile. Prunes an emptied `profiles:` block.
export function deleteProfile(rawText, { profile }) {
  const doc = parseConfigDoc(rawText);
  const root = doc.contents;
  if (!isMap(root)) {
    throw new Error("settings.yaml is not a mapping");
  }
  const profilesMap = root.get("profiles", true);
  const pair = findProfilePair(profilesMap, profile);
  if (!pair) {
    throw new Error(`Profile "${profile}" not found`);
  }
  profilesMap.items.splice(profilesMap.items.indexOf(pair), 1);
  if (profilesMap.items.length === 0) {
    root.delete("profiles");
  }
  return doc.toString();
}
