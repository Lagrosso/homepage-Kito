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

export const EDITABLE_SERVICE_FIELDS = ["href", "icon", "description", "server"];

// Matches a placeholder sitting directly in value position (after `:` `-` `[` `,`
// or at line start), i.e. an unquoted, non-embedded {{HOMEPAGE_*}}.
const BARE_PLACEHOLDER = /(?:^|[:[,\-])[ \t]*\{\{HOMEPAGE_(?:VAR|FILE)_[^}\n]+\}\}/m;

function parseServicesDoc(rawText) {
  const text = rawText ?? "";
  const doc = parseDocument(text);
  if (doc.errors.length > 0) {
    throw new Error(doc.errors[0].message);
  }
  if (BARE_PLACEHOLDER.test(text)) {
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

// Each service is a single-key map { ServiceName: {props} } inside the group seq.
function findServiceEntry(groupSeq, serviceName) {
  for (let i = 0; i < groupSeq.items.length; i += 1) {
    const item = groupSeq.items[i];
    if (isMap(item) && item.items.length > 0) {
      const pair = item.items[0];
      if (String(pair.key) === serviceName) {
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
  const found = findServiceEntry(groupSeq, name);
  if (!found) {
    throw new Error(`Service "${name}" not found in "${group}"`);
  }
  return { groupSeq, ...found };
}

// Edit an existing service's fields and/or rename it. Only the keys present in
// `values` are touched; an empty string removes that field; unknown/nested
// fields (widget:, ping:, …) on the entry are left untouched. Returns new raw text.
export function updateServiceEntry(rawText, { group, name }, values) {
  const doc = parseServicesDoc(rawText);
  const { pair } = locate(doc, group, name);

  // A nested-group entry (value is a sequence) is not a simple, field-editable service.
  if (!isMap(pair.value)) {
    throw new Error(`"${name}" is not a simple service entry`);
  }
  const propsMap = pair.value;

  // Rename in place so the entry keeps its position and surrounding comments.
  const newName = typeof values.name === "string" ? values.name.trim() : "";
  if (newName && newName !== name) {
    pair.key.value = newName;
  }

  EDITABLE_SERVICE_FIELDS.forEach((field) => {
    const raw = values[field];
    if (raw === undefined) {
      return; // field not part of this form → leave as-is
    }
    const value = typeof raw === "string" ? raw.trim() : raw;
    if (value === "") {
      propsMap.delete(field);
      return;
    }
    const existing = propsMap.get(field, true);
    if (isScalar(existing)) {
      // In-place keeps any inline comment and re-quotes the value if needed.
      existing.value = value;
    } else {
      propsMap.set(field, value);
    }
  });

  return doc.toString();
}

// Remove an existing service entry from its group. The group itself (even if it
// becomes empty) and all other entries/comments are preserved. Returns new raw text.
export function deleteServiceEntry(rawText, { group, name }) {
  const doc = parseServicesDoc(rawText);
  const { groupSeq, index } = locate(doc, group, name);
  groupSeq.items.splice(index, 1);
  return doc.toString();
}
