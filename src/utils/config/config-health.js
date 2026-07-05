import yaml from "js-yaml";

import { EDITABLE_CONFIGS } from "utils/config/editable-files";
import { parseLocalIconRef } from "utils/config/local-icons";
import { isPlaceholder, isSensitiveKey, SECRET_VALUE_CONTAINERS, tokenizePlaceholders } from "utils/config/secret-mask";
import themes from "utils/styles/themes";

const SUMMARY = { errors: 0, warnings: 0, info: 0 };
const LIST_FILES = new Set(["services.yaml", "bookmarks.yaml", "widgets.yaml"]);
const SECRET_CONTAINERS = new Set(SECRET_VALUE_CONTAINERS.map((key) => key.toLowerCase()));
const URL_FILES = new Set(["services.yaml", "bookmarks.yaml"]);

function emptySummary() {
  return { ...SUMMARY };
}

function bump(summary, severity) {
  if (severity === "error") summary.errors += 1;
  else if (severity === "warning") summary.warnings += 1;
  else summary.info += 1;
}

function summarize(checks) {
  const summary = emptySummary();
  checks.forEach((check) => bump(summary, check.severity));
  return summary;
}

function addCheck(checks, file, severity, code, path, message, suggestion, extra = {}) {
  checks.push({
    id: `${file}:${code}:${checks.length + 1}`,
    severity,
    file,
    path,
    message,
    suggestion,
    line: extra.line ?? null,
    column: extra.column ?? null,
  });
}

function yamlError(e) {
  const error = { message: e.reason || e.message || "Invalid YAML" };
  if (e.mark) {
    error.line = e.mark.line + 1;
    error.column = e.mark.column + 1;
  }
  return error;
}

function parseRaw(file, raw, checks) {
  const { tokenized, map } = tokenizePlaceholders(raw ?? "");
  try {
    return { data: yaml.load(tokenized), map };
  } catch (e) {
    const error = yamlError(e);
    addCheck(
      checks,
      file,
      "error",
      "yaml-syntax",
      file,
      `YAML syntax error: ${error.message}`,
      "Fix the YAML syntax in the raw editor, then run the health check again.",
      error,
    );
    return { data: undefined, map, failed: true };
  }
}

function checkLeadingTabs(file, raw, checks) {
  String(raw ?? "")
    .split(/\r?\n/)
    .forEach((line, index) => {
      if (/^[ \t]*\t[ \t]*\S/.test(line)) {
        addCheck(
          checks,
          file,
          "warning",
          "leading-tab",
          `${file}:${index + 1}`,
          "This line uses a tab in the indentation.",
          "Replace leading tabs with spaces to keep YAML indentation predictable.",
          { line: index + 1 },
        );
      }
    });
}

function restoreString(value, map) {
  if (typeof value !== "string") return value;
  return value.replace(/__HP_PH_(\d+)__/g, (whole, i) => map[Number(i)] ?? whole);
}

function isPlaceholderValue(value, map) {
  return isPlaceholder(restoreString(value, map));
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function singleKey(value) {
  if (!isObject(value)) return null;
  const keys = Object.keys(value);
  return keys.length === 1 ? keys[0] : null;
}

function normalizedString(value, map) {
  return typeof value === "string" ? restoreString(value, map).trim() : "";
}

function isBadIcon(icon, map) {
  if (icon == null || isPlaceholderValue(icon, map)) return false;
  if (typeof icon !== "string") return true;
  const value = restoreString(icon, map).trim();
  return value.length === 0 || value.includes("..") || value.startsWith("file:") || value.startsWith("\\");
}

// If `icon` references a local uploaded/cached icon (/api/config/icon?file=X)
// whose file is not present, return the missing filename; otherwise null. Bare
// `name.svg` stays a remote dashboard-icon reference and is not flagged.
function missingLocalIcon(icon, map, localIcons) {
  if (typeof icon !== "string" || isPlaceholderValue(icon, map)) return null;
  const filename = parseLocalIconRef(restoreString(icon, map).trim());
  return filename && !localIcons.has(filename) ? filename : null;
}

// Emits a warning when an icon points at a missing local file. Shared by the
// services and bookmarks passes; runs in addition to the existing icon checks.
function warnMissingLocalIcon(file, checks, path, icon, map, context) {
  const missing = missingLocalIcon(icon, map, context.localIcons);
  if (missing) {
    addCheck(checks, file, "warning", "missing-local-icon", `${path}.icon`, `The referenced local icon "${missing}" was not found.`, "Upload the icon again in the service dialog, or fix the reference.");
  }
}

function collectSecrets(file, value, map, checks, path, inSecretContainer = false) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectSecrets(file, item, map, checks, `${path}[${index}]`, inSecretContainer));
    return;
  }
  if (!isObject(value)) {
    return;
  }

  Object.entries(value).forEach(([key, child]) => {
    const childPath = path ? `${path}.${key}` : key;
    const secretContainer = SECRET_CONTAINERS.has(String(key).toLowerCase());
    if (isSensitiveKey(key) && !isPlaceholderValue(child, map)) {
      addCheck(
        checks,
        file,
        "warning",
        "plaintext-secret",
        childPath,
        "A sensitive field appears to contain a plaintext value.",
        "Move the value to a HOMEPAGE_VAR_* or HOMEPAGE_FILE_* placeholder so it is not stored directly in YAML.",
      );
    } else if (inSecretContainer && !isPlaceholderValue(child, map)) {
      addCheck(
        checks,
        file,
        "warning",
        "plaintext-secret-container",
        childPath,
        "A provider or secret-container value appears to be stored in plaintext.",
        "Move this value to a HOMEPAGE_VAR_* or HOMEPAGE_FILE_* placeholder.",
      );
    }
    collectSecrets(file, child, map, checks, childPath, inSecretContainer || secretContainer);
  });
}

function collectAccessGroups(entry) {
  return Array.isArray(entry?.access?.groups) ? entry.access.groups.map(String) : [];
}

function warnUnknownGroups(file, checks, path, accessGroups, knownUserGroups) {
  accessGroups.forEach((group) => {
    if (!knownUserGroups.has(group)) {
      addCheck(
        checks,
        file,
        "warning",
        "unknown-access-group",
        `${path}.access.groups`,
        `Access group "${group}" is not assigned to any user.`,
        "Create or assign this group in /admin/users, or remove it from the entry.",
      );
    }
  });
}

// Profiles (M10c) store their groups directly (`profiles.<name>.groups`), not
// nested under `access` like services/bookmarks/tabs do, so they get their own
// collector + warning path instead of reusing collectAccessGroups/warnUnknownGroups.
function collectProfileGroups(entry) {
  return Array.isArray(entry?.groups) ? entry.groups.map(String) : [];
}

function warnUnknownProfileGroups(file, checks, profileName, groups, knownUserGroups) {
  groups.forEach((group) => {
    if (!knownUserGroups.has(group)) {
      addCheck(
        checks,
        file,
        "warning",
        "unknown-access-group",
        `profiles.${profileName}.groups`,
        `Access group "${group}" is not assigned to any user.`,
        "Create or assign this group in /admin/users, or remove it from the entry.",
      );
    }
  });
}

function rememberHref(hrefs, file, path, href) {
  if (!href) return;
  const key = href.trim();
  if (!key) return;
  hrefs.push({ file, path, href: key });
}

function checkServices(data, map, file, checks, context) {
  if (data == null) return;
  if (!Array.isArray(data)) {
    addCheck(checks, file, "error", "top-level-list", file, "services.yaml must contain a top-level list.", "Use the Homepage services.yaml list format.");
    return;
  }

  data.forEach((group, groupIndex) => {
    const groupName = singleKey(group);
    if (!groupName) {
      addCheck(checks, file, "error", "group-shape", `group[${groupIndex}]`, "Each service group must be a single-key mapping.", "Use `- Group Name:` followed by a list of services.");
      return;
    }
    const items = group[groupName];
    if (!Array.isArray(items)) {
      addCheck(checks, file, "error", "group-list", groupName, "Service group entries must be a list.", "Indent services as list items under the group name.");
      return;
    }

    const names = new Set();
    items.forEach((entry, entryIndex) => {
      const serviceName = singleKey(entry);
      const path = serviceName ? `${groupName} > ${serviceName}` : `${groupName} > entry[${entryIndex}]`;
      if (!serviceName) {
        addCheck(checks, file, "error", "service-shape", path, "Each service entry must be a single-key mapping.", "Use `- Service Name:` followed by its options.");
        return;
      }
      if (names.has(serviceName)) {
        addCheck(checks, file, "warning", "duplicate-service-name", path, "This service name is duplicated within its group.", "Rename one of the duplicate services.");
      }
      names.add(serviceName);

      const value = entry[serviceName];
      if (Array.isArray(value)) return;
      const options = isObject(value) ? value : {};
      const href = normalizedString(options.href, map);
      if (options.href === undefined && !options.widget && !options.ping && !options.siteMonitor) {
        addCheck(checks, file, "warning", "missing-service-href", `${path}.href`, "This service has no href and no widget/ping/siteMonitor fallback.", "Add an href or configure a widget, ping, or siteMonitor.");
      } else if (options.href !== undefined && (typeof options.href !== "string" || !href)) {
        addCheck(checks, file, "warning", "invalid-service-href", `${path}.href`, "This service href is empty or not a string.", "Use a non-empty URL string for href.");
      }
      rememberHref(context.hrefs, file, `${path}.href`, href);

      if (options.icon === undefined) {
        addCheck(checks, file, "info", "missing-service-icon", `${path}.icon`, "This service has no icon.", "Add an icon if you want the dashboard card to show one.");
      } else if (isBadIcon(options.icon, map)) {
        addCheck(checks, file, "warning", "bad-service-icon", `${path}.icon`, "This service icon value looks unsafe or unsupported.", "Use a known icon name, relative path, or http(s) URL; avoid path traversal.");
      }
      warnMissingLocalIcon(file, checks, path, options.icon, map, context);

      warnUnknownGroups(file, checks, path, collectAccessGroups(options), context.knownUserGroups);
      collectSecrets(file, options, map, checks, path);
    });
  });
}

function checkBookmarks(data, map, file, checks, context) {
  if (data == null) return;
  if (!Array.isArray(data)) {
    addCheck(checks, file, "error", "top-level-list", file, "bookmarks.yaml must contain a top-level list.", "Use the Homepage bookmarks.yaml list format.");
    return;
  }

  data.forEach((group, groupIndex) => {
    const groupName = singleKey(group);
    if (!groupName) {
      addCheck(checks, file, "error", "bookmark-group-shape", `group[${groupIndex}]`, "Each bookmark group must be a single-key mapping.", "Use `- Group Name:` followed by a list of bookmarks.");
      return;
    }
    const items = group[groupName];
    if (!Array.isArray(items)) {
      addCheck(checks, file, "error", "bookmark-group-list", groupName, "Bookmark group entries must be a list.", "Indent bookmarks as list items under the group name.");
      return;
    }

    const names = new Set();
    items.forEach((entry, entryIndex) => {
      const bookmarkName = singleKey(entry);
      const path = bookmarkName ? `${groupName} > ${bookmarkName}` : `${groupName} > entry[${entryIndex}]`;
      if (!bookmarkName) {
        addCheck(checks, file, "error", "bookmark-shape", path, "Each bookmark entry must be a single-key mapping.", "Use `- Bookmark Name:` followed by a list with its options.");
        return;
      }
      if (names.has(bookmarkName)) {
        addCheck(checks, file, "warning", "duplicate-bookmark-name", path, "This bookmark name is duplicated within its group.", "Rename one of the duplicate bookmarks.");
      }
      names.add(bookmarkName);

      const rawValue = entry[bookmarkName];
      const options = Array.isArray(rawValue) ? rawValue[0] : rawValue;
      if (!Array.isArray(rawValue) || !isObject(options)) {
        addCheck(checks, file, "error", "bookmark-nested-list", path, "Bookmark options should use the nested list shape.", "Use `- Bookmark: [ { href, abbr, icon } ]` or the expanded YAML equivalent.");
        return;
      }

      const href = normalizedString(options.href, map);
      if (typeof options.href !== "string" || !href) {
        addCheck(checks, file, "warning", "invalid-bookmark-href", `${path}.href`, "This bookmark href is missing, empty, or not a string.", "Use a non-empty URL string for href.");
      }
      rememberHref(context.hrefs, file, `${path}.href`, href);

      if (options.icon === undefined) {
        addCheck(checks, file, "info", "missing-bookmark-icon", `${path}.icon`, "This bookmark has no icon.", "Add an icon if you want a visual marker.");
      } else if (isBadIcon(options.icon, map)) {
        addCheck(checks, file, "warning", "bad-bookmark-icon", `${path}.icon`, "This bookmark icon value looks unsafe or unsupported.", "Use a known icon name, relative path, or http(s) URL; avoid path traversal.");
      }
      warnMissingLocalIcon(file, checks, path, options.icon, map, context);
      if (options.abbr === undefined) {
        addCheck(checks, file, "info", "missing-bookmark-abbr", `${path}.abbr`, "This bookmark has no abbreviation.", "Add an abbr for a compact fallback label.");
      }

      warnUnknownGroups(file, checks, path, collectAccessGroups(options), context.knownUserGroups);
      collectSecrets(file, options, map, checks, path);
    });
  });
}

function checkWidgets(data, map, file, checks) {
  if (data == null) return;
  if (!Array.isArray(data)) {
    addCheck(checks, file, "error", "top-level-list", file, "widgets.yaml must contain a top-level list.", "Use the Homepage widgets.yaml list format.");
    return;
  }
  const seen = new Map();
  data.forEach((widget, index) => {
    const type = singleKey(widget);
    const path = type ? `${type}[${index}]` : `widget[${index}]`;
    if (!type || !String(type).trim()) {
      addCheck(checks, file, "error", "widget-shape", path, "Each widget entry must be a single-key mapping with a non-empty type.", "Use `- widgettype:` followed by its options.");
      return;
    }
    const options = widget[type];
    const fingerprint = JSON.stringify(options ?? {});
    const duplicateKey = `${type}:${fingerprint}`;
    if (seen.has(duplicateKey)) {
      addCheck(checks, file, "warning", "duplicate-widget", path, "This widget duplicates an earlier widget of the same type with identical options.", "Remove the duplicate if it is accidental.");
    }
    seen.set(duplicateKey, true);
    collectSecrets(file, options, map, checks, path);
  });
}

function collectLayoutGroupNames(layout) {
  if (Array.isArray(layout)) {
    return layout.flatMap((item) => (isObject(item) ? Object.keys(item) : []));
  }
  if (isObject(layout)) {
    return Object.keys(layout);
  }
  return [];
}

function checkSettings(data, map, file, checks, context) {
  if (data == null) return;
  if (!isObject(data)) {
    addCheck(checks, file, "error", "top-level-map", file, "settings.yaml must contain a top-level mapping.", "Use key/value settings at the top level.");
    return;
  }

  collectSecrets(file, data, map, checks, "");

  collectLayoutGroupNames(data.layout).forEach((group) => {
    if (!context.configGroups.has(group)) {
      addCheck(checks, file, "warning", "unknown-layout-group", `layout.${group}`, "This layout group does not exist in services.yaml or bookmarks.yaml.", "Create the group or remove it from settings.yaml layout.");
    }
  });

  if (isObject(data.tabs)) {
    Object.entries(data.tabs).forEach(([tabName, options]) => {
      warnUnknownGroups(file, checks, `tabs.${tabName}`, collectAccessGroups(options), context.knownUserGroups);
    });
  }

  if (isObject(data.profiles)) {
    Object.entries(data.profiles).forEach(([profileName, options]) => {
      warnUnknownProfileGroups(file, checks, profileName, collectProfileGroups(options), context.knownUserGroups);
    });
  }

  if (data.maxGroupColumns !== undefined && (!Number.isInteger(data.maxGroupColumns) || data.maxGroupColumns < 4 || data.maxGroupColumns > 8)) {
    addCheck(checks, file, "warning", "invalid-max-group-columns", "maxGroupColumns", "maxGroupColumns should be an integer from 4 to 8.", "Choose a value between 4 and 8 in /admin/layout.");
  }
  if (data.theme !== undefined && !["light", "dark"].includes(String(data.theme))) {
    addCheck(checks, file, "warning", "invalid-theme", "theme", "theme should be either light or dark.", "Choose light or dark in /admin/theme.");
  }
  if (data.color !== undefined && !themes[String(data.color)]) {
    addCheck(checks, file, "warning", "invalid-color", "color", "No theme palette exists for this color.", "Choose one of the offered colors in /admin/theme.");
  }

  ["background.image", "favicon"].forEach((field) => {
    const value = field === "background.image" ? data.background?.image : data.favicon;
    if (value !== undefined && isBadIcon(value, map)) {
      addCheck(checks, file, "warning", `bad-${field.replace(".", "-")}`, field, "This visual asset path looks unsafe or unsupported.", "Use a relative path, /api/config/background-image URL, or http(s) URL; avoid path traversal.");
    }
  });
}

function collectConfigGroups(rawFiles) {
  const groups = new Set();
  ["services.yaml", "bookmarks.yaml"].forEach((file) => {
    const checks = [];
    const { data, failed } = parseRaw(file, rawFiles[file] ?? "", checks);
    if (failed || !Array.isArray(data)) return;
    data.forEach((group) => {
      const name = singleKey(group);
      if (name) groups.add(name);
    });
  });
  return groups;
}

function applyDuplicateHrefChecks(result, hrefs) {
  const byHref = new Map();
  hrefs.forEach((item) => {
    if (!URL_FILES.has(item.file)) return;
    const existing = byHref.get(item.href) ?? [];
    existing.push(item);
    byHref.set(item.href, existing);
  });
  byHref.forEach((items) => {
    if (items.length < 2) return;
    items.forEach((item) => {
      addCheck(
        result.files[item.file].checks,
        item.file,
        "warning",
        "duplicate-href",
        item.path,
        "This href is also used by another service or bookmark.",
        "Confirm the duplicate is intentional, or update one of the links.",
      );
    });
  });
}

export function buildHealthReport(rawFiles = {}, options = {}) {
  const context = {
    knownUserGroups: new Set(options.knownUserGroups ?? []),
    configGroups: collectConfigGroups(rawFiles),
    localIcons: new Set(options.localIcons ?? []),
    hrefs: [],
  };
  const result = { summary: emptySummary(), files: {} };

  EDITABLE_CONFIGS.forEach((file) => {
    const checks = [];
    checkLeadingTabs(file, rawFiles[file] ?? "", checks);
    const { data, map, failed } = parseRaw(file, rawFiles[file] ?? "", checks);
    if (!failed) {
      if (file === "services.yaml") checkServices(data, map, file, checks, context);
      else if (file === "bookmarks.yaml") checkBookmarks(data, map, file, checks, context);
      else if (file === "widgets.yaml") checkWidgets(data, map, file, checks);
      else if (file === "settings.yaml") checkSettings(data, map, file, checks, context);
      else if (LIST_FILES.has(file) && data != null && !Array.isArray(data)) {
        addCheck(checks, file, "error", "top-level-list", file, `${file} must contain a top-level list.`, "Use the expected Homepage YAML format.");
      }
    }
    result.files[file] = { summary: emptySummary(), checks };
  });

  applyDuplicateHrefChecks(result, context.hrefs);

  Object.values(result.files).forEach((fileReport) => {
    fileReport.summary = summarize(fileReport.checks);
    result.summary.errors += fileReport.summary.errors;
    result.summary.warnings += fileReport.summary.warnings;
    result.summary.info += fileReport.summary.info;
  });

  return result;
}

export function buildSingleFileHealthReport(file, content, rawFiles = {}, options = {}) {
  const report = buildHealthReport({ ...rawFiles, [file]: content }, options);
  const fileReport = report.files[file] ?? { summary: emptySummary(), checks: [] };
  return { summary: fileReport.summary, files: { [file]: fileReport } };
}
