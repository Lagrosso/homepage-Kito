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

export const EDITABLE_SERVICE_FIELDS = ["href", "icon", "description", "server"];
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

  Object.entries(values).forEach(([key, raw]) => {
    if (raw === undefined) {
      return;
    }
    const value = typeof raw === "string" ? raw.trim() : raw;
    if (value === REDACTED) {
      return; // never persist the redaction marker
    }
    if (value === "" && isSensitiveKey(key)) {
      return; // keep an untouched secret rather than deleting it
    }
    applyScalarField(optionsMap, key, value);
  });

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

// --- reordering / moving (M5c) --------------------------------------------
// All swaps operate on the YAMLSeq `items` arrays; nodes carry their own
// comments, so reordering keeps inline comments with the moved entry/group.

// Index of a top-level group `{ GroupName: [...] }` in the document sequence.
function findGroupIndex(doc, groupName) {
  const top = doc.contents;
  if (!isSeq(top)) {
    return -1;
  }
  return top.items.findIndex(
    (item) => isMap(item) && item.items.length > 0 && String(item.items[0].key) === groupName,
  );
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

// Move an entry out of `fromGroup` and onto the END of `toGroup` (both must
// exist). Services & bookmarks. v1: appends, no chosen target index.
export function moveEntryToGroup(rawText, { fromGroup, name, toGroup }) {
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
  toSeq.items.push(node);
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
