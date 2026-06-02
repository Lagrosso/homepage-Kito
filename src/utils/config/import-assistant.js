import yaml from "js-yaml";
import { isMap, isScalar, isSeq, parseDocument } from "yaml";

import { hasBarePlaceholder } from "utils/config/yaml-edit";

const HOMEPAGE_SETTING_KEYS = [
  "title",
  "description",
  "language",
  "theme",
  "color",
  "cardBlur",
  "favicon",
  "target",
  "logo",
  "background",
  "quicklaunch",
  "hideVersion",
  "disableUpdateCheck",
  "showStats",
  "hideErrors",
  "groupsInitiallyCollapsed",
  "useEqualHeights",
  "maxGroupColumns",
];

const SERVICE_WIDGET_SECRET_FIELDS = new Set(["username", "password", "token", "key", "apiKey", "apikey"]);

const FILE_ROUTES = {
  "services.yaml": "/admin/config",
  "bookmarks.yaml": "/admin/bookmarks",
  "widgets.yaml": "/admin/widgets",
  "settings.yaml": "/admin/settings",
  "docker.yaml": "/admin/docker",
};

const MUXIMUX_UNSUPPORTED_KEYS = [
  "auth",
  "navigation",
  "icons",
  "health",
  "keybindings",
  "discovery",
];

function parseYamlInput(raw, label) {
  if (!raw?.trim()) {
    return null;
  }
  try {
    return yaml.load(raw);
  } catch (error) {
    const where = error?.mark ? ` (line ${error.mark.line + 1}, column ${error.mark.column + 1})` : "";
    throw new Error(`${label}: ${error.reason || error.message}${where}`);
  }
}

function parseDoc(raw, filename) {
  if (hasBarePlaceholder(raw ?? "")) {
    throw new Error(`${filename} contains an unquoted {{HOMEPAGE_*}} placeholder and cannot be merged structurally.`);
  }
  const doc = parseDocument(raw ?? "");
  if (doc.errors.length > 0) {
    throw new Error(`${filename}: ${doc.errors[0].message}`);
  }
  return doc;
}

function createItemId(parts) {
  return parts.map((part) => String(part).replace(/[:|]/g, "_")).join(":");
}

function upperSlug(input) {
  return String(input ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "IMPORT";
}

function cloneValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ""));
}

function orderedByOrder(items) {
  return [...items].sort((a, b) => {
    const orderA = typeof a?.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
    const orderB = typeof b?.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return String(a?.name ?? "").localeCompare(String(b?.name ?? ""));
  });
}

function normalizeMuximuxGroupName(value) {
  const name = String(value ?? "").trim();
  return name || "Imported";
}

function muximuxIconToHomepage(icon) {
  if (!icon) {
    return "";
  }
  if (typeof icon === "string") {
    return icon.trim();
  }
  if (typeof icon !== "object") {
    return "";
  }
  if (icon.type === "dashboard" && icon.name) {
    return `${String(icon.name).trim()}.${String(icon.variant || "svg").trim()}`;
  }
  if ((icon.type === "simple-icons" || icon.type === "simple") && icon.name) {
    return `si-${String(icon.name).trim()}`;
  }
  if ((icon.type === "selfh.st" || icon.type === "selfhst" || icon.type === "selfhosted") && icon.name) {
    return `sh-${String(icon.name).trim()}`;
  }
  if (icon.name) {
    return String(icon.name).trim();
  }
  return "";
}

function muximuxOpenModeToTarget(openMode) {
  if (openMode === "same_tab" || openMode === "iframe") {
    return "_self";
  }
  if (openMode === "new_tab") {
    return "_blank";
  }
  return undefined;
}

function muximuxAccessGroups(app) {
  const groups = new Set();
  if (app?.min_role === "admin") {
    groups.add("Admin");
  }
  app?.access?.roles?.forEach((role) => groups.add(String(role)));
  app?.access?.users?.forEach((user) => groups.add(String(user)));
  return [...groups].filter(Boolean);
}

function muximuxDiscoveryDockerToConfig(discovery) {
  const docker = discovery?.docker;
  if (!docker?.enabled || !docker.endpoint) {
    return null;
  }
  const endpoint = String(docker.endpoint);
  if (endpoint.startsWith("unix://")) {
    return { socket: endpoint.replace(/^unix:\/\//, "") };
  }
  try {
    const url = new URL(endpoint);
    return compactObject({
      host: url.hostname,
      port: url.port ? Number(url.port) : undefined,
      protocol: url.protocol.replace(":", ""),
    });
  } catch {
    return null;
  }
}

function buildSecretPlaceholder(label, field) {
  return `{{HOMEPAGE_VAR_${upperSlug(label)}_${upperSlug(field)}}}`;
}

function sanitizeWidgetOptions(options, label, includeSecrets) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    return options;
  }
  const next = {};
  Object.entries(options).forEach(([key, value]) => {
    if (key === "type") {
      next[key] = value;
      return;
    }
    if (SERVICE_WIDGET_SECRET_FIELDS.has(String(key))) {
      next[key] = includeSecrets ? value : buildSecretPlaceholder(label, key);
      return;
    }
    next[key] = value;
  });
  return next;
}

function sanitizeServiceProps(props, label, includeSecrets) {
  if (!props || typeof props !== "object" || Array.isArray(props)) {
    return props;
  }
  const next = cloneValue(props);
  if (next.widget && typeof next.widget === "object") {
    next.widget = sanitizeWidgetOptions(next.widget, label, includeSecrets);
  }
  return next;
}

function pushSummary(summary, file, incoming, conflicts) {
  summary[file] = { incoming, conflicts };
}

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

function ensureTopSeq(doc) {
  if (!doc.contents) {
    doc.contents = doc.createNode([]);
  }
  if (!isSeq(doc.contents)) {
    throw new Error("Target file is not a list");
  }
  return doc.contents;
}

function ensureGroupSeq(doc, groupName) {
  const top = ensureTopSeq(doc);
  const existing = findGroupSeq(doc, groupName);
  if (existing) {
    existing.flow = false;
    return existing;
  }
  const groupNode = doc.createNode({ [groupName]: [] });
  groupNode.flow = false;
  top.items.push(groupNode);
  return findGroupSeq(doc, groupName);
}

function findEntryInGroup(groupSeq, name) {
  for (let i = 0; i < groupSeq.items.length; i += 1) {
    const item = groupSeq.items[i];
    if (isMap(item) && item.items.length > 0 && String(item.items[0].key) === name) {
      return { item, pair: item.items[0], index: i };
    }
  }
  return null;
}

function upsertService(doc, item, action, includeSecrets) {
  const groupSeq = ensureGroupSeq(doc, item.group);
  const existing = findEntryInGroup(groupSeq, item.name);
  const value = sanitizeServiceProps(item.data, `${item.group}_${item.name}`, includeSecrets);
  const entryNode = doc.createNode({ [item.name]: value });
  entryNode.flow = false;

  if (existing) {
    if (action !== "replace") {
      return false;
    }
    existing.pair.value = entryNode.items[0].value;
    return true;
  }

  groupSeq.items.push(entryNode);
  return true;
}

function bookmarkValueFromProps(props) {
  return [props];
}

function upsertBookmark(doc, item, action) {
  const groupSeq = ensureGroupSeq(doc, item.group);
  const existing = findEntryInGroup(groupSeq, item.name);
  const entryNode = doc.createNode({ [item.name]: bookmarkValueFromProps(item.data) });
  entryNode.flow = false;

  if (existing) {
    if (action !== "replace") {
      return false;
    }
    existing.pair.value = entryNode.items[0].value;
    return true;
  }

  groupSeq.items.push(entryNode);
  return true;
}

function upsertWidget(doc, item, action) {
  const top = ensureTopSeq(doc);
  const index = top.items.findIndex((node) => isMap(node) && node.items.length > 0 && String(node.items[0].key) === item.type);
  const widgetNode = doc.createNode({ [item.type]: item.data });
  widgetNode.flow = false;

  if (index !== -1) {
    if (action === "replace") {
      top.items[index] = widgetNode;
      return true;
    }
    if (action === "add") {
      top.items.push(widgetNode);
      return true;
    }
    return false;
  }

  top.items.push(widgetNode);
  return true;
}

function ensureTopMap(doc, filename) {
  if (!doc.contents) {
    doc.contents = doc.createNode({});
  }
  if (!isMap(doc.contents)) {
    throw new Error(`${filename} is not a mapping`);
  }
  return doc.contents;
}

function upsertSetting(doc, item, action) {
  const map = ensureTopMap(doc, "settings.yaml");
  if (map.has(item.key) && action !== "replace") {
    return false;
  }
  const node = doc.createNode(item.value);
  if (isMap(node) || isSeq(node)) {
    node.flow = false;
  }
  map.set(item.key, node);
  return true;
}

function upsertDockerServer(doc, item, action) {
  const map = ensureTopMap(doc, "docker.yaml");
  if (map.has(item.name) && action !== "replace") {
    return false;
  }
  const node = doc.createNode(item.data);
  if (isMap(node) || isSeq(node)) {
    node.flow = false;
  }
  map.set(item.name, node);
  return true;
}

function parseExistingServices(raw) {
  const data = parseYamlInput(raw, "services.yaml");
  const byGroupName = new Map();
  const byHref = new Map();
  if (!Array.isArray(data)) {
    return { byGroupName, byHref };
  }

  data.forEach((group) => {
    if (!group || typeof group !== "object") {
      return;
    }
    const groupName = Object.keys(group)[0];
    const items = Array.isArray(group[groupName]) ? group[groupName] : [];
    items.forEach((entry) => {
      if (!entry || typeof entry !== "object") {
        return;
      }
      const name = Object.keys(entry)[0];
      const value = entry[name];
      if (!value || Array.isArray(value)) {
        return;
      }
      byGroupName.set(`${groupName}::${name}`, { group: groupName, name });
      if (value.href) {
        byHref.set(String(value.href), { group: groupName, name });
      }
    });
  });

  return { byGroupName, byHref };
}

function parseExistingBookmarks(raw) {
  const data = parseYamlInput(raw, "bookmarks.yaml");
  const byGroupName = new Map();
  const byHref = new Map();
  if (!Array.isArray(data)) {
    return { byGroupName, byHref };
  }

  data.forEach((group) => {
    if (!group || typeof group !== "object") {
      return;
    }
    const groupName = Object.keys(group)[0];
    const items = Array.isArray(group[groupName]) ? group[groupName] : [];
    items.forEach((entry) => {
      if (!entry || typeof entry !== "object") {
        return;
      }
      const name = Object.keys(entry)[0];
      const value = Array.isArray(entry[name]) ? entry[name][0] : entry[name];
      if (!value || typeof value !== "object") {
        return;
      }
      byGroupName.set(`${groupName}::${name}`, { group: groupName, name });
      if (value.href) {
        byHref.set(String(value.href), { group: groupName, name });
      }
    });
  });

  return { byGroupName, byHref };
}

function parseExistingWidgetTypes(raw) {
  const data = parseYamlInput(raw, "widgets.yaml");
  const byType = new Map();
  if (!Array.isArray(data)) {
    return byType;
  }
  data.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") {
      return;
    }
    const type = Object.keys(entry)[0];
    if (!byType.has(type)) {
      byType.set(type, { type, index });
    }
  });
  return byType;
}

function parseExistingSettingsKeys(raw) {
  const data = parseYamlInput(raw, "settings.yaml");
  return data && typeof data === "object" && !Array.isArray(data) ? new Set(Object.keys(data)) : new Set();
}

function parseExistingDockerServers(raw) {
  const data = parseYamlInput(raw, "docker.yaml");
  return data && typeof data === "object" && !Array.isArray(data) ? new Set(Object.keys(data)) : new Set();
}

function buildHomepageModel(inputs, existingRawConfigs) {
  const items = [];
  const warnings = [];
  const unsupported = [];
  const summary = {};

  const existingServices = parseExistingServices(existingRawConfigs["services.yaml"]);
  const existingBookmarks = parseExistingBookmarks(existingRawConfigs["bookmarks.yaml"]);
  const existingWidgetTypes = parseExistingWidgetTypes(existingRawConfigs["widgets.yaml"]);
  const existingSettingsKeys = parseExistingSettingsKeys(existingRawConfigs["settings.yaml"]);
  const existingDockerServers = parseExistingDockerServers(existingRawConfigs["docker.yaml"]);

  const servicesSource = parseYamlInput(inputs["services.yaml"], "services.yaml");
  if (Array.isArray(servicesSource)) {
    let conflicts = 0;
    let incoming = 0;
    servicesSource.forEach((group) => {
      if (!group || typeof group !== "object") {
        return;
      }
      const groupName = Object.keys(group)[0];
      const entries = Array.isArray(group[groupName]) ? group[groupName] : [];
      entries.forEach((entry) => {
        if (!entry || typeof entry !== "object") {
          return;
        }
        const name = Object.keys(entry)[0];
        const value = entry[name];
        if (Array.isArray(value)) {
          unsupported.push(`Nested service group "${name}" in "${groupName}" is skipped in v1.`);
          return;
        }
        incoming += 1;
        const item = {
          id: createItemId(["service", groupName, name]),
          file: "services.yaml",
          kind: "service",
          group: groupName,
          name,
          label: `${groupName} / ${name}`,
          data: value ?? {},
          actions: ["replace", "skip"],
          defaultAction: "add",
        };
        const nameConflict = existingServices.byGroupName.get(`${groupName}::${name}`);
        const hrefConflict = value?.href ? existingServices.byHref.get(String(value.href)) : null;
        if (nameConflict) {
          item.conflict = {
            kind: "name",
            label: `Existing service "${name}" already exists in group "${groupName}".`,
          };
          item.defaultAction = "skip";
          conflicts += 1;
        } else if (hrefConflict) {
          item.conflict = {
            kind: "href",
            label: `URL already used by "${hrefConflict.group} / ${hrefConflict.name}".`,
          };
          item.actions = ["add", "skip"];
          item.defaultAction = "skip";
          conflicts += 1;
        } else {
          item.actions = ["add"];
          item.defaultAction = "add";
        }
        items.push(item);
      });
    });
    pushSummary(summary, "services.yaml", incoming, conflicts);
  }

  const bookmarksSource = parseYamlInput(inputs["bookmarks.yaml"], "bookmarks.yaml");
  if (Array.isArray(bookmarksSource)) {
    let conflicts = 0;
    let incoming = 0;
    bookmarksSource.forEach((group) => {
      if (!group || typeof group !== "object") {
        return;
      }
      const groupName = Object.keys(group)[0];
      const entries = Array.isArray(group[groupName]) ? group[groupName] : [];
      entries.forEach((entry) => {
        if (!entry || typeof entry !== "object") {
          return;
        }
        const name = Object.keys(entry)[0];
        const value = Array.isArray(entry[name]) ? entry[name][0] : entry[name];
        if (!value || typeof value !== "object") {
          return;
        }
        incoming += 1;
        const item = {
          id: createItemId(["bookmark", groupName, name]),
          file: "bookmarks.yaml",
          kind: "bookmark",
          group: groupName,
          name,
          label: `${groupName} / ${name}`,
          data: value,
          actions: ["replace", "skip"],
          defaultAction: "add",
        };
        const nameConflict = existingBookmarks.byGroupName.get(`${groupName}::${name}`);
        const hrefConflict = value?.href ? existingBookmarks.byHref.get(String(value.href)) : null;
        if (nameConflict) {
          item.conflict = {
            kind: "name",
            label: `Existing bookmark "${name}" already exists in group "${groupName}".`,
          };
          item.defaultAction = "skip";
          conflicts += 1;
        } else if (hrefConflict) {
          item.conflict = {
            kind: "href",
            label: `URL already used by "${hrefConflict.group} / ${hrefConflict.name}".`,
          };
          item.actions = ["add", "skip"];
          item.defaultAction = "skip";
          conflicts += 1;
        } else {
          item.actions = ["add"];
          item.defaultAction = "add";
        }
        items.push(item);
      });
    });
    pushSummary(summary, "bookmarks.yaml", incoming, conflicts);
  }

  const widgetsSource = parseYamlInput(inputs["widgets.yaml"], "widgets.yaml");
  if (Array.isArray(widgetsSource)) {
    let conflicts = 0;
    let incoming = 0;
    widgetsSource.forEach((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return;
      }
      const type = Object.keys(entry)[0];
      const value = entry[type];
      incoming += 1;
      const item = {
        id: createItemId(["widget", type, index]),
        file: "widgets.yaml",
        kind: "widget",
        type,
        label: type,
        data: value,
        actions: ["add", "replace", "skip"],
        defaultAction: "add",
      };
      if (existingWidgetTypes.has(type)) {
        item.conflict = { kind: "type", label: `Widget type "${type}" already exists.` };
        item.defaultAction = "skip";
        conflicts += 1;
      } else {
        item.actions = ["add"];
      }
      items.push(item);
    });
    pushSummary(summary, "widgets.yaml", incoming, conflicts);
  }

  const settingsSource = parseYamlInput(inputs["settings.yaml"], "settings.yaml");
  if (settingsSource && typeof settingsSource === "object" && !Array.isArray(settingsSource)) {
    let conflicts = 0;
    let incoming = 0;
    HOMEPAGE_SETTING_KEYS.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(settingsSource, key)) {
        return;
      }
      incoming += 1;
      const item = {
        id: createItemId(["setting", key]),
        file: "settings.yaml",
        kind: "setting",
        key,
        label: key,
        value: settingsSource[key],
        actions: existingSettingsKeys.has(key) ? ["replace", "skip"] : ["replace"],
        defaultAction: existingSettingsKeys.has(key) ? "skip" : "replace",
      };
      if (existingSettingsKeys.has(key)) {
        item.conflict = { kind: "key", label: `Setting "${key}" already exists.` };
        conflicts += 1;
      }
      items.push(item);
    });
    const unsupportedKeys = Object.keys(settingsSource).filter((key) => !HOMEPAGE_SETTING_KEYS.includes(key));
    unsupportedKeys.forEach((key) => unsupported.push(`settings.yaml: key "${key}" is not imported in v1.`));
    pushSummary(summary, "settings.yaml", incoming, conflicts);
  }

  const dockerSource = parseYamlInput(inputs["docker.yaml"], "docker.yaml");
  if (dockerSource && typeof dockerSource === "object" && !Array.isArray(dockerSource)) {
    let conflicts = 0;
    let incoming = 0;
    Object.entries(dockerSource).forEach(([name, value]) => {
      incoming += 1;
      const item = {
        id: createItemId(["docker", name]),
        file: "docker.yaml",
        kind: "docker",
        name,
        label: name,
        data: value,
        actions: existingDockerServers.has(name) ? ["replace", "skip"] : ["replace"],
        defaultAction: existingDockerServers.has(name) ? "skip" : "replace",
      };
      if (existingDockerServers.has(name)) {
        item.conflict = { kind: "name", label: `Docker server "${name}" already exists.` };
        conflicts += 1;
      }
      items.push(item);
    });
    pushSummary(summary, "docker.yaml", incoming, conflicts);
  }

  return { items, warnings, unsupported, summary };
}

function buildMuximuxModel(inputs, existingRawConfigs) {
  const items = [];
  const warnings = [];
  const unsupported = [];
  const summary = {};

  const existingServices = parseExistingServices(existingRawConfigs["services.yaml"]);
  const existingSettingsKeys = parseExistingSettingsKeys(existingRawConfigs["settings.yaml"]);
  const existingDockerServers = parseExistingDockerServers(existingRawConfigs["docker.yaml"]);
  const muximuxSource = parseYamlInput(inputs.muximux, "muximux");

  if (!muximuxSource || typeof muximuxSource !== "object") {
    return { items, warnings, unsupported, summary };
  }

  const groups = Array.isArray(muximuxSource.groups) ? orderedByOrder(muximuxSource.groups) : [];
  const groupOrder = new Map(groups.map((group, index) => [normalizeMuximuxGroupName(group.name), index]));
  const apps = Array.isArray(muximuxSource.apps) ? orderedByOrder(muximuxSource.apps) : [];
  let serviceConflicts = 0;
  let serviceIncoming = 0;

  apps.forEach((app, index) => {
    if (!app || typeof app !== "object") {
      return;
    }
    const name = String(app.name || `App ${index + 1}`).trim();
    if (app.enabled === false) {
      warnings.push(`Muximux app "${name}" is disabled and was skipped.`);
      return;
    }
    const group = normalizeMuximuxGroupName(app.group);
    const href = app.url || app.href || "";
    const accessGroups = muximuxAccessGroups(app);
    serviceIncoming += 1;
    const item = {
      id: createItemId(["muximux-service", group, name, index]),
      file: "services.yaml",
      kind: "service",
      group,
      name,
      label: `${group} / ${name}`,
      data: {
        href,
        description: app.description || (app.open_mode === "iframe" ? "Muximux iframe app" : ""),
        icon: muximuxIconToHomepage(app.icon),
        target: muximuxOpenModeToTarget(app.open_mode),
        siteMonitor: app.health_check ? href : undefined,
        access: accessGroups.length > 0 ? { groups: accessGroups } : undefined,
      },
      actions: ["replace", "skip"],
      defaultAction: "add",
    };
    item.data = compactObject(item.data);
    const nameConflict = existingServices.byGroupName.get(`${group}::${name}`);
    const hrefConflict = href ? existingServices.byHref.get(String(href)) : null;
    if (nameConflict) {
      item.conflict = { kind: "name", label: `Existing service "${name}" already exists in group "${group}".` };
      item.defaultAction = "skip";
      serviceConflicts += 1;
    } else if (hrefConflict) {
      item.conflict = { kind: "href", label: `URL already used by "${hrefConflict.group} / ${hrefConflict.name}".` };
      item.actions = ["add", "skip"];
      item.defaultAction = "skip";
      serviceConflicts += 1;
    } else {
      item.actions = ["add"];
    }
    items.push(item);
  });

  let settingsIncoming = 0;
  let settingsConflicts = 0;
  const addSettingItem = (key, value) => {
    settingsIncoming += 1;
    const exists = existingSettingsKeys.has(key);
    if (exists) {
      settingsConflicts += 1;
    }
    items.push({
      id: createItemId(["muximux-setting", key]),
      file: "settings.yaml",
      kind: "setting",
      key,
      label: key,
      value,
      actions: exists ? ["replace", "skip"] : ["replace"],
      defaultAction: exists ? "skip" : "replace",
      conflict: exists ? { kind: "key", label: `Setting "${key}" already exists.` } : null,
    });
  };

  if (muximuxSource.server?.title) {
    addSettingItem("title", String(muximuxSource.server.title).trim());
  }
  if (muximuxSource.server?.language) {
    addSettingItem("language", String(muximuxSource.server.language).trim());
  }
  if (muximuxSource.theme?.variant) {
    const variant = String(muximuxSource.theme.variant).trim();
    if (variant === "dark" || variant === "light") {
      addSettingItem("theme", variant);
    }
  }
  if (groups.length > 0) {
    addSettingItem(
      "layout",
      groups.map((group) => {
        const groupName = normalizeMuximuxGroupName(group.name);
        return {
          [groupName]: compactObject({
            initiallyCollapsed: group.expanded === false ? true : undefined,
          }),
        };
      }),
    );
  }
  if (settingsIncoming > 0) {
    pushSummary(summary, "settings.yaml", settingsIncoming, settingsConflicts);
  }

  const dockerConfig = muximuxDiscoveryDockerToConfig(muximuxSource.discovery);
  if (dockerConfig) {
    const exists = existingDockerServers.has("muximux-docker");
    items.push({
      id: createItemId(["muximux-docker", "muximux-docker"]),
      file: "docker.yaml",
      kind: "docker",
      name: "muximux-docker",
      label: "muximux-docker",
      data: dockerConfig,
      actions: exists ? ["replace", "skip"] : ["replace"],
      defaultAction: exists ? "skip" : "replace",
      conflict: exists ? { kind: "name", label: 'Docker server "muximux-docker" already exists.' } : null,
    });
    pushSummary(summary, "docker.yaml", 1, exists ? 1 : 0);
  }

  MUXIMUX_UNSUPPORTED_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(muximuxSource, key)) {
      if (key === "discovery" && dockerConfig) {
        unsupported.push(`Muximux key "${key}" was partially imported for Docker; remaining discovery options need manual review.`);
      } else {
        unsupported.push(`Muximux key "${key}" is not fully imported in v2 and must be reviewed manually.`);
      }
    }
  });
  if (muximuxSource.theme?.family) {
    unsupported.push(`Muximux theme family "${muximuxSource.theme.family}" has no direct Homepage equivalent.`);
  }

  if (groups.length > 0) {
    warnings.push("Muximux group colors and group icons are not imported; group order/collapse state is mapped to settings.layout.");
  }

  // Keep services in source group order when possible; the YAML append order
  // follows this sorted item list.
  items.sort((a, b) => {
    if (a.file !== "services.yaml" || b.file !== "services.yaml") {
      return 0;
    }
    const groupA = groupOrder.get(a.group) ?? Number.MAX_SAFE_INTEGER;
    const groupB = groupOrder.get(b.group) ?? Number.MAX_SAFE_INTEGER;
    if (groupA !== groupB) {
      return groupA - groupB;
    }
    return a.label.localeCompare(b.label);
  });

  pushSummary(summary, "services.yaml", serviceIncoming, serviceConflicts);
  return { items, warnings, unsupported, summary };
}

function buildModel(sourceType, inputs, existingRawConfigs) {
  if (sourceType === "homepage") {
    return buildHomepageModel(inputs, existingRawConfigs);
  }
  if (sourceType === "muximux") {
    return buildMuximuxModel(inputs, existingRawConfigs);
  }
  throw new Error(`Unsupported source type "${sourceType}"`);
}

export function previewImport({ sourceType, inputs, existingRawConfigs }) {
  const model = buildModel(sourceType, inputs, existingRawConfigs);
  const files = {};
  Object.entries(model.summary).forEach(([file, fileSummary]) => {
    files[file] = {
      ...fileSummary,
      items: model.items
        .filter((item) => item.file === file)
        .map((item) => ({
          id: item.id,
          label: item.label,
          kind: item.kind,
          conflict: item.conflict ?? null,
          actions: item.actions,
          defaultAction: item.defaultAction,
        })),
    };
  });
  return {
    sourceType,
    files,
    warnings: model.warnings,
    unsupported: model.unsupported,
    totalItems: model.items.length,
    totalConflicts: model.items.filter((item) => item.conflict).length,
  };
}

export function applyImport({ sourceType, inputs, existingRawConfigs, decisions = {}, includeSecrets = false }) {
  const model = buildModel(sourceType, inputs, existingRawConfigs);
  const nextRaw = { ...existingRawConfigs };

  model.items.forEach((item) => {
    const action = decisions[item.id] ?? item.defaultAction;
    if (action === "skip") {
      return;
    }

    if (item.file === "services.yaml") {
      const doc = parseDoc(nextRaw["services.yaml"], "services.yaml");
      if (upsertService(doc, item, action, includeSecrets)) {
        nextRaw["services.yaml"] = doc.toString();
      }
      return;
    }

    if (item.file === "bookmarks.yaml") {
      const doc = parseDoc(nextRaw["bookmarks.yaml"], "bookmarks.yaml");
      if (upsertBookmark(doc, item, action)) {
        nextRaw["bookmarks.yaml"] = doc.toString();
      }
      return;
    }

    if (item.file === "widgets.yaml") {
      const doc = parseDoc(nextRaw["widgets.yaml"], "widgets.yaml");
      if (upsertWidget(doc, item, action)) {
        nextRaw["widgets.yaml"] = doc.toString();
      }
      return;
    }

    if (item.file === "settings.yaml") {
      const doc = parseDoc(nextRaw["settings.yaml"], "settings.yaml");
      if (upsertSetting(doc, item, action)) {
        nextRaw["settings.yaml"] = doc.toString();
      }
      return;
    }

    if (item.file === "docker.yaml") {
      const doc = parseDoc(nextRaw["docker.yaml"], "docker.yaml");
      if (upsertDockerServer(doc, item, action)) {
        nextRaw["docker.yaml"] = doc.toString();
      }
    }
  });

  const drafts = {};
  Object.entries(nextRaw).forEach(([filename, content]) => {
    if (content !== existingRawConfigs[filename] && FILE_ROUTES[filename]) {
      drafts[filename] = {
        content,
        route: FILE_ROUTES[filename],
        sourceType,
      };
    }
  });

  return {
    drafts,
    warnings: model.warnings,
    unsupported: model.unsupported,
  };
}
