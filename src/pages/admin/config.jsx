import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import ConfigEditor, { Field, inputClass, shortenUrl } from "components/admin/config-editor";
import ResolvedIcon from "components/resolvedicon";
import yaml from "js-yaml";
import { useEffect, useState } from "react";
import { MdDelete, MdEdit, MdInfoOutline, MdSearch } from "react-icons/md";

import { useLayoutGoverns } from "components/admin/use-layout-governs";
import { BADGE_BY_ID, BADGE_TYPES, NEUTRAL_BADGE_CLASS } from "utils/config/badge-registry";
import { isPlaceholder, maskValue } from "utils/config/secret-mask";
import {
  SERVICE_WIDGET_TEMPLATES,
  SERVICE_WIDGET_TEMPLATE_BY_TYPE,
  isServiceWidgetSecretField,
  validateServiceWidgetFields,
} from "utils/config/service-widget-templates";
import {
  deleteServiceEntry,
  deleteServiceWidget,
  moveEntryInGroup,
  moveEntryToGroup,
  moveEntryToIndex,
  moveGroup,
  moveGroupToIndex,
  updateServiceEntry,
  updateServiceWidget,
} from "utils/config/yaml-edit";
import { insertService } from "utils/config/yaml-insert";

function maskWidget(widget) {
  if (!widget || typeof widget !== "object") {
    return null;
  }
  const type = typeof widget.type === "string" ? widget.type : "";
  const template = SERVICE_WIDGET_TEMPLATE_BY_TYPE[type];
  const fields = Object.entries(widget)
    .filter(([key]) => key !== "type")
    .map(([key, value]) => {
      const masked = maskValue(key, value);
      return {
        key,
        value: masked.value,
        redacted: masked.redacted,
        secret: isServiceWidgetSecretField(key),
      };
    });

  return {
    type,
    label: template?.label ?? type,
    fields,
    supported: Boolean(template),
  };
}

// Parse services.yaml into groups of card props for the read-only preview.
// Top-level shape: a list of { GroupName: [ { ServiceName: {...} } ] }.
function parseServices(content) {
  const data = yaml.load(content);
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .filter((group) => group && typeof group === "object")
    .map((group) => {
      const name = Object.keys(group)[0];
      const items = Array.isArray(group[name]) ? group[name] : [];
      const entries = items
        .filter((entry) => entry && typeof entry === "object")
        .map((entry) => {
          const serviceName = Object.keys(entry)[0];
          const value = entry[serviceName];
          if (Array.isArray(value)) {
            return { name: serviceName, isGroup: true };
          }
          return {
            name: serviceName,
            href: value?.href,
            siteMonitor: value?.siteMonitor,
            description: value?.description,
            icon: value?.icon,
            server: value?.server ?? value?.widget?.server,
            container: value?.container ?? value?.widget?.container,
            widget: maskWidget(value?.widget),
            accessGroups: Array.isArray(value?.access?.groups) ? value.access.groups : [],
            urls: value?.urls && typeof value.urls === "object" ? value.urls : undefined,
            docs: value?.docs && typeof value.docs === "object" ? value.docs : undefined,
            badges: Array.isArray(value?.badges) ? value.badges.map(String) : undefined,
          };
        });
      return { name, entries };
    });
}

// Read-only card mirroring the dashboard service-card styling
// (components/services/item.jsx) without its interactive/widget behavior.
function ServiceCard({ entry, onEdit, onDelete }) {
  if (entry.isGroup) {
    return (
      <div className="mb-2 p-2 rounded-md text-sm font-medium text-theme-700 dark:text-theme-200 shadow-md shadow-theme-900/10 dark:shadow-theme-900/20 bg-theme-100/20 dark:bg-white/5">
        <span className="font-semibold">{entry.name}</span>
        <span className="ml-1 text-theme-500">(nested group)</span>
      </div>
    );
  }

  return (
    <div className="mb-2 p-1 rounded-md font-medium text-theme-700 dark:text-theme-200 shadow-md shadow-theme-900/10 dark:shadow-theme-900/20 bg-theme-100/20 dark:bg-white/5">
      <div className="flex">
        <div className="shrink-0 flex items-center justify-center w-12">
          {entry.icon ? (
            <ResolvedIcon icon={entry.icon} />
          ) : (
            <div className="w-8 h-8 rounded-md bg-theme-300/40 dark:bg-white/10 flex items-center justify-center text-xs text-theme-500">
              {entry.name?.charAt(0)?.toUpperCase() || "?"}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 px-2 py-2 text-left">
          <div className="text-sm truncate">{entry.name}</div>
          {entry.description && (
            <p className="text-theme-500 dark:text-theme-300 text-xs font-light truncate">{entry.description}</p>
          )}
          {entry.href && (
            <p className="text-theme-400 text-xs font-light truncate" title={entry.href}>
              {shortenUrl(entry.href)}
            </p>
          )}
        </div>
        {entry.server && (
          <div className="shrink-0 self-start m-1">
            <span className="inline-block rounded bg-theme-300/40 dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-theme-600 dark:text-theme-300">
              {entry.server}
            </span>
          </div>
        )}
        {entry.container && (
          <div className="shrink-0 self-start m-1">
            <span className="inline-block rounded bg-theme-300/40 dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-theme-600 dark:text-theme-300">
              {entry.container}
            </span>
          </div>
        )}
        {entry.accessGroups?.length > 0 && (
          <div className="shrink-0 self-start m-1">
            <span className="inline-block rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
              {entry.accessGroups.join(", ")}
            </span>
          </div>
        )}
        {entry.widget?.type && (
          <div className="shrink-0 self-start m-1">
            <span
              className="inline-block rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300"
              title={entry.widget.supported ? `Widget: ${entry.widget.label}` : "Widget uses raw YAML options"}
            >
              {entry.widget.label || entry.widget.type}
            </span>
          </div>
        )}
        {entry.urls && (
          <div className="shrink-0 self-start m-1">
            <span
              className="inline-block rounded bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:text-purple-300"
              title={`Network URLs: ${Object.keys(entry.urls).join(", ")}`}
            >
              {["lan", "tailscale", "public"]
                .filter((key) => entry.urls[key])
                .map((key) => ({ lan: "LAN", tailscale: "TS", public: "WWW" })[key])
                .join(" · ")}
            </span>
          </div>
        )}
        {entry.docs && Object.values(entry.docs).some((value) => value?.trim()) && (
          <div className="shrink-0 self-start m-1" title="Hat Service-Doku">
            <MdInfoOutline className="w-4 h-4 text-theme-400" />
          </div>
        )}
        {entry.badges?.length > 0 && (
          <div className="shrink-0 self-start m-1 flex flex-wrap gap-1 max-w-[10rem] justify-end">
            {entry.badges.map((id) => {
              const badge = BADGE_BY_ID[id];
              return (
                <span
                  key={id}
                  className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${badge ? badge.className : NEUTRAL_BADGE_CLASS}`}
                >
                  {badge ? badge.label : id}
                </span>
              );
            })}
          </div>
        )}
        {(onEdit || onDelete) && (
          <div className="shrink-0 self-start flex gap-1 m-1">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                title="Edit"
                aria-label={`Edit ${entry.name}`}
                className="rounded p-1 text-theme-500 hover:text-theme-700 dark:hover:text-theme-200 hover:bg-theme-300/40 dark:hover:bg-white/10"
              >
                <MdEdit className="w-4 h-4" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                title="Delete"
                aria-label={`Delete ${entry.name}`}
                className="rounded p-1 text-theme-500 hover:text-red-600 hover:bg-theme-300/40 dark:hover:bg-white/10"
              >
                <MdDelete className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const EMPTY_FORM = {
  group: "",
  name: "",
  href: "",
  siteMonitor: "",
  icon: "",
  description: "",
  server: "",
  container: "",
  accessGroups: "",
  badges: "",
  urlLan: "",
  urlTailscale: "",
  urlPublic: "",
  docPurpose: "",
  docLocation: "",
  docBackup: "",
  docAdmin: "",
  docNote: "",
  docTroubleshooting: "",
  widgetEnabled: false,
  widgetType: SERVICE_WIDGET_TEMPLATES[0].type,
  widgetOptions: {},
};

// Maps form field keys (urlLan/…) to the YAML urls.* keys and back.
const URL_FORM_FIELDS = [
  ["urlLan", "lan", "LAN URL"],
  ["urlTailscale", "tailscale", "Tailscale URL"],
  ["urlPublic", "public", "Public URL"],
];

// Maps form field keys (docPurpose/…) to the YAML docs.* keys and back.
// The fourth entry picks the form control: "textarea" for potentially
// multi-line fields, "input" for short ones.
const DOCS_FORM_FIELDS = [
  ["docPurpose", "purpose", "Zweck", "input"],
  ["docLocation", "location", "Standort (wo läuft er)", "input"],
  ["docBackup", "backup", "Backup", "input"],
  ["docAdmin", "admin", "Admin-Kontakt", "input"],
  ["docNote", "note", "Notiz", "textarea"],
  ["docTroubleshooting", "troubleshooting", "Was tun bei Fehler", "textarea"],
];

function uniqueFields(fields) {
  return [...new Set(fields.filter(Boolean))];
}

function widgetOptionsFromInitial(widget) {
  const options = {};
  widget?.fields?.forEach((field) => {
    options[field.key] = field.redacted && !isPlaceholder(field.value) ? "" : field.value;
  });
  return options;
}

function parseDisplayFields(raw) {
  if (raw === undefined) {
    return undefined;
  }
  if (Array.isArray(raw)) {
    return uniqueFields(raw.map((item) => String(item).trim()));
  }
  if (typeof raw === "string") {
    const value = raw.trim();
    if (value === "") {
      return "";
    }
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return uniqueFields(parsed.map((item) => String(item).trim()));
      }
    } catch {
      // fall through to comma parsing
    }
    return uniqueFields(value.split(",").map((item) => item.trim()));
  }
  return [];
}

function parseWidgetOption(field, raw) {
  if (raw === undefined) {
    return undefined;
  }
  const value = typeof raw === "string" ? raw.trim() : raw;
  if (field === "fields") {
    return parseDisplayFields(value);
  }
  if (field === "metrics") {
    if (!value) {
      return "";
    }
    return JSON.parse(value);
  }
  if (field === "refreshInterval" || field === "version" || field === "port") {
    if (value === "") {
      return "";
    }
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) {
      throw new Error(`${field} must be a number`);
    }
    return numericValue;
  }
  if (
    [
      "allowScrolling",
      "chart",
      "enableBlocks",
      "enableNowPlaying",
      "enableUser",
      "enableMediaControl",
      "showEpisodeNumber",
      "expandOneStreamToTwoRows",
      "enableTaskList",
    ].includes(field)
  ) {
    if (value === "") {
      return "";
    }
    if (typeof value === "boolean") {
      return value;
    }
    return value === "true";
  }
  return value;
}

function WidgetOptionsForm({ type, options, onChange, existingWidget }) {
  const template = SERVICE_WIDGET_TEMPLATE_BY_TYPE[type] ?? SERVICE_WIDGET_TEMPLATES[0];
  const optionFields = template.optionFields ?? template.fields ?? [];
  const selectedFields = parseDisplayFields(options.fields) || [];
  const validation = validateServiceWidgetFields(template, selectedFields);
  const existingKeys = existingWidget?.fields?.map((field) => field.key) ?? [];
  const knownKeys = uniqueFields([...optionFields, "fields"]);
  const unknownKeys = existingKeys.filter((key) => key !== "type" && !knownKeys.includes(key));
  const toggleDisplayField = (field) => {
    const next = selectedFields.includes(field)
      ? selectedFields.filter((item) => item !== field)
      : [...selectedFields, field];
    onChange("widgetOption", "fields", next);
  };

  return (
    <div className="rounded-md border border-theme-200 dark:border-theme-700 p-3 space-y-3">
      <Field label="Widget type">
        <select value={type} onChange={(e) => onChange("widgetType", e.target.value)} className={inputClass}>
          {SERVICE_WIDGET_TEMPLATES.map((templateOption) => (
            <option key={templateOption.type} value={templateOption.type}>
              {templateOption.label}
            </option>
          ))}
        </select>
      </Field>
      {optionFields.map((field) => {
        const isSecret = isServiceWidgetSecretField(field);
        const placeholder =
          field === "metrics"
            ? '[{"label":"Requests","query":"sum(rate(http_requests_total[5m]))"}]'
            : isSecret
              ? "Leave blank to keep existing secret"
              : "";
        const isBoolean = [
          "allowScrolling",
          "chart",
          "enableBlocks",
          "enableNowPlaying",
          "enableUser",
          "enableMediaControl",
          "showEpisodeNumber",
          "expandOneStreamToTwoRows",
          "enableTaskList",
        ].includes(field);
        return (
          <Field key={field} label={field}>
            {field === "metrics" ? (
              <textarea
                value={options[field] ?? ""}
                onChange={(e) => onChange("widgetOption", field, e.target.value)}
                placeholder={placeholder}
                spellCheck={false}
                className={`${inputClass} min-h-20 font-mono`}
              />
            ) : isBoolean ? (
              <label className="flex items-center gap-2 rounded-md border border-theme-300 dark:border-theme-700 bg-white dark:bg-theme-800 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={options[field] === true || options[field] === "true"}
                  onChange={(e) => onChange("widgetOption", field, e.target.checked)}
                  className="rounded border-theme-300 dark:border-theme-700"
                />
                enabled
              </label>
            ) : (
              <input
                value={options[field] ?? ""}
                onChange={(e) => onChange("widgetOption", field, e.target.value)}
                placeholder={placeholder}
                type={isSecret && !isPlaceholder(options[field]) ? "password" : "text"}
                className={inputClass}
              />
            )}
            {isSecret && (
              <p className="mt-1 text-[11px] text-theme-400">
                Existing secret values are not shown. Use <code>{"{{HOMEPAGE_VAR_*}}"}</code> placeholders when
                possible.
              </p>
            )}
          </Field>
        );
      })}
      {template.allowedFields?.length > 0 && (
        <Field label="Display fields">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md border border-theme-300 dark:border-theme-700 bg-white dark:bg-theme-800 p-2">
            {template.allowedFields.map((field) => (
              <label key={field} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedFields.includes(field)}
                  onChange={() => toggleDisplayField(field)}
                  className="rounded border-theme-300 dark:border-theme-700"
                />
                <code className="text-xs">{field}</code>
              </label>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-theme-400">
            {template.maxFields ? `Select up to ${template.maxFields} fields.` : "Empty selection removes fields."}
          </p>
          {!validation.valid && (
            <p className="mt-1 text-[11px] text-red-500">
              {validation.tooMany && `Too many fields selected. Maximum is ${template.maxFields}.`}
              {validation.invalidFields.length > 0 && ` Invalid fields: ${validation.invalidFields.join(", ")}.`}
            </p>
          )}
        </Field>
      )}
      {template.supportsRawMode && (
        <p className="text-xs text-theme-400">
          This widget has special options; advanced cases can still be edited in raw YAML.
        </p>
      )}
      {unknownKeys.length > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-300">
          Existing raw-only widget options are preserved: <code>{unknownKeys.join(", ")}</code>.
        </p>
      )}
      <p className="text-xs text-theme-400">
        Special options not shown here can still be edited in the raw YAML editor.
      </p>
    </div>
  );
}

function IconSuggestionList({ suggestions, onSelect, onCache, cachingUrl, title = "Icon suggestions" }) {
  if (!suggestions.length) {
    return null;
  }

  return (
    <div className="mt-2 rounded-md border border-theme-200 dark:border-theme-700 bg-theme-50/40 dark:bg-white/5 p-2">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-theme-500">{title}</p>
      <div className="grid gap-2">
        {suggestions.map((suggestion) => (
          <div
            key={`${suggestion.source}:${suggestion.icon}`}
            className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-theme-200/60 dark:hover:bg-white/10"
          >
            <button
              type="button"
              onClick={() => onSelect(suggestion.icon)}
              className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
            >
              <span className="shrink-0 flex h-9 w-9 items-center justify-center rounded bg-white/60 dark:bg-black/20">
                <ResolvedIcon icon={suggestion.icon} width={28} height={28} alt={suggestion.label} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{suggestion.label || suggestion.icon}</span>
                <span className="block truncate text-[11px] text-theme-500">
                  {suggestion.source} · {suggestion.reason}
                </span>
              </span>
              <code className="hidden sm:block shrink-0 max-w-40 truncate rounded bg-theme-200/70 dark:bg-theme-900/60 px-1.5 py-0.5 text-[10px]">
                {suggestion.icon}
              </code>
            </button>
            {onCache && suggestion.previewUrl && (
              <button
                type="button"
                onClick={() => onCache(suggestion.previewUrl)}
                disabled={cachingUrl === suggestion.previewUrl}
                title="Download this icon into your config so it no longer depends on the CDN"
                className="shrink-0 rounded-md bg-theme-200 dark:bg-theme-700 px-2 py-1 text-[11px] font-medium hover:bg-theme-300 dark:hover:bg-theme-600 disabled:opacity-50"
              >
                {cachingUrl === suggestion.previewUrl ? "Saving…" : "Cache locally"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Modal that collects fields for a single service and hands the values back to
// the editor. It never writes to disk — Save stays manual. Works in two modes:
//   - "add":  group is free-text (datalist of existing groups), no description.
//   - "edit": group is fixed/read-only (no moving in v1), description is editable.
function ServiceFormDialog({ mode = "add", open, onClose, onSubmit, initial, group, existingGroups = [] }) {
  const isEdit = mode === "edit";
  const iconInputId = isEdit ? "service-edit-icon" : "service-add-icon";
  const [form, setForm] = useState(EMPTY_FORM);
  const [widgetError, setWidgetError] = useState(null);
  const [iconSuggestions, setIconSuggestions] = useState([]);
  const [iconSuggestionState, setIconSuggestionState] = useState("idle");
  const [iconSuggestionError, setIconSuggestionError] = useState(null);
  // M21b: interactive dashboard-icons search, local upload gallery, cache action.
  const [iconSearchQuery, setIconSearchQuery] = useState("");
  const [iconSearchResults, setIconSearchResults] = useState([]);
  const [iconSearchState, setIconSearchState] = useState("idle"); // idle | loading | done | error
  const [localIcons, setLocalIcons] = useState([]);
  const [iconUploadError, setIconUploadError] = useState(null);
  const [cachingUrl, setCachingUrl] = useState(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setWidgetError(null);
    setIconSuggestions([]);
    setIconSuggestionState("idle");
    setIconSuggestionError(null);
    setIconSearchQuery("");
    setIconSearchResults([]);
    setIconSearchState("idle");
    setIconUploadError(null);
    setCachingUrl(null);
    // Load the reuse gallery of already-uploaded/cached local icons. Wrapped in
    // Promise.resolve so a stubbed fetch that returns undefined can't throw.
    Promise.resolve()
      .then(() => fetch("/api/config/icon"))
      .then((res) => (res && res.ok ? res.json() : { files: [] }))
      .then((data) => setLocalIcons(Array.isArray(data?.files) ? data.files : []))
      .catch(() => setLocalIcons([]));
    setForm(
      isEdit
        ? {
            group: group ?? "",
            name: initial?.name ?? "",
            href: initial?.href ?? "",
            siteMonitor: initial?.siteMonitor ?? "",
            icon: initial?.icon ?? "",
            description: initial?.description ?? "",
            server: initial?.server ?? "",
            container: initial?.container ?? "",
            accessGroups: Array.isArray(initial?.accessGroups) ? initial.accessGroups.join(", ") : "",
            badges: Array.isArray(initial?.badges) ? initial.badges.join(", ") : "",
            urlLan: initial?.urls?.lan ?? "",
            urlTailscale: initial?.urls?.tailscale ?? "",
            urlPublic: initial?.urls?.public ?? "",
            docPurpose: initial?.docs?.purpose ?? "",
            docLocation: initial?.docs?.location ?? "",
            docBackup: initial?.docs?.backup ?? "",
            docAdmin: initial?.docs?.admin ?? "",
            docNote: initial?.docs?.note ?? "",
            docTroubleshooting: initial?.docs?.troubleshooting ?? "",
            widgetEnabled: Boolean(initial?.widget?.type && initial?.widget?.supported),
            widgetType:
              initial?.widget?.type && initial?.widget?.supported
                ? initial.widget.type
                : SERVICE_WIDGET_TEMPLATES[0].type,
            widgetOptions: widgetOptionsFromInitial(initial?.widget),
          }
        : EMPTY_FORM,
    );
  }, [open, isEdit, initial, group]);

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  // Badges live in the single comma-string `form.badges`; the checkbox grid
  // reflects/toggles curated ids within it, custom ones stay in the text field.
  const badgeList = form.badges
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean);
  const toggleBadge = (id) => {
    const next = badgeList.includes(id) ? badgeList.filter((b) => b !== id) : [...badgeList, id];
    setForm((f) => ({ ...f, badges: next.join(", ") }));
  };
  const setIconField = (value) => {
    setIconSuggestionError(null);
    setForm((f) => ({ ...f, icon: value }));
  };
  const setWidgetField = (kind, key, value) => {
    setWidgetError(null);
    if (kind === "widgetType") {
      setForm((f) => ({ ...f, widgetType: key }));
      return;
    }
    setForm((f) => ({ ...f, widgetOptions: { ...f.widgetOptions, [key]: value } }));
  };
  const canSubmit = form.group.trim() && form.name.trim() && (!form.widgetEnabled || form.widgetType);

  const findIcons = async () => {
    setIconSuggestionState("loading");
    setIconSuggestionError(null);
    try {
      const response = await fetch("/api/config/icon-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          href: form.href,
          widgetType: form.widgetEnabled ? form.widgetType : initial?.widget?.type,
          currentIcon: form.icon,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Could not fetch icon suggestions");
      }
      setIconSuggestions(Array.isArray(payload.suggestions) ? payload.suggestions : []);
      setIconSuggestionState("done");
    } catch (error) {
      setIconSuggestions([]);
      setIconSuggestionError(error.message);
      setIconSuggestionState("error");
    }
  };

  // M21b: free-text search over the dashboard-icons catalog.
  const searchIcons = async () => {
    const query = iconSearchQuery.trim();
    if (query.length < 2) {
      return;
    }
    setIconSearchState("loading");
    try {
      const response = await fetch(`/api/config/icon-search?q=${encodeURIComponent(query)}`);
      const payload = await response.json().catch(() => ({}));
      setIconSearchResults(Array.isArray(payload.results) ? payload.results : []);
      setIconSearchState("done");
    } catch {
      setIconSearchResults([]);
      setIconSearchState("error");
    }
  };

  // M21b: upload a local image → stored under CONF_DIR/icons/, referenced locally.
  const uploadIcon = (file) => {
    if (!file) {
      return;
    }
    setIconUploadError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const response = await fetch("/api/config/icon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, dataUrl: reader.result }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || "Upload failed");
        }
        setIconField(payload.path);
        setLocalIcons((prev) => (prev.includes(payload.filename) ? prev : [...prev, payload.filename].sort()));
      } catch (error) {
        setIconUploadError(error.message);
      }
    };
    reader.onerror = () => setIconUploadError("Could not read the selected file");
    reader.readAsDataURL(file);
  };

  // M21b: download a remote icon (dashboard-icon/favicon) into the local config.
  const cacheIcon = async (sourceUrl) => {
    setCachingUrl(sourceUrl);
    setIconUploadError(null);
    try {
      const response = await fetch("/api/config/icon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Could not cache the icon");
      }
      setIconField(payload.path);
      setLocalIcons((prev) => (prev.includes(payload.filename) ? prev : [...prev, payload.filename].sort()));
    } catch (error) {
      setIconUploadError(error.message);
    } finally {
      setCachingUrl(null);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!canSubmit) {
      return;
    }
    if (!isEdit) {
      const addValues = {
        group: form.group.trim(),
        name: form.name.trim(),
        href: form.href.trim(),
        siteMonitor: form.siteMonitor.trim(),
        description: form.description.trim(),
        icon: form.icon.trim(),
        server: form.server.trim(),
        container: form.container.trim(),
        accessGroups: form.accessGroups.trim(),
      };
      if (form.badges.trim()) {
        addValues.badges = form.badges.trim();
      }
      const urls = {};
      URL_FORM_FIELDS.forEach(([formKey, urlKey]) => {
        if (form[formKey].trim()) {
          urls[urlKey] = form[formKey].trim();
        }
      });
      if (Object.keys(urls).length > 0) {
        addValues.urls = urls;
      }
      const docs = {};
      DOCS_FORM_FIELDS.forEach(([formKey, docKey]) => {
        if (form[formKey].trim()) {
          docs[docKey] = form[formKey].trim();
        }
      });
      if (Object.keys(docs).length > 0) {
        addValues.docs = docs;
      }
      onSubmit(addValues);
      return;
    }
    // Edit mode: send the name plus only fields that actually changed, so
    // untouched fields stay byte-identical and no derived value (e.g. a service's
    // widget.server/container shown here) is written back as a new top-level field.
    const values = { name: form.name.trim() };
    ["href", "siteMonitor", "icon", "description", "server", "container"].forEach((field) => {
      if (form[field].trim() !== String(initial?.[field] ?? "")) {
        values[field] = form[field].trim();
      }
    });
    if (form.accessGroups.trim() !== (Array.isArray(initial?.accessGroups) ? initial.accessGroups.join(", ") : "")) {
      values.accessGroups = form.accessGroups.trim();
    }
    if (form.badges.trim() !== (Array.isArray(initial?.badges) ? initial.badges.join(", ") : "")) {
      values.badges = form.badges.trim();
    }
    // Only send the url keys that actually changed (empty = remove that variant).
    const urlChanges = {};
    URL_FORM_FIELDS.forEach(([formKey, urlKey]) => {
      const current = form[formKey].trim();
      const original = String(initial?.urls?.[urlKey] ?? "");
      if (current !== original) {
        urlChanges[urlKey] = current;
      }
    });
    if (Object.keys(urlChanges).length > 0) {
      values.urls = urlChanges;
    }
    // Only send the docs keys that actually changed (empty = remove that field).
    const docChanges = {};
    DOCS_FORM_FIELDS.forEach(([formKey, docKey]) => {
      const current = form[formKey].trim();
      const original = String(initial?.docs?.[docKey] ?? "");
      if (current !== original) {
        docChanges[docKey] = current;
      }
    });
    if (Object.keys(docChanges).length > 0) {
      values.docs = docChanges;
    }
    if (!form.widgetEnabled && initial?.widget?.type && initial?.widget?.supported) {
      values.__widget = { delete: true };
    } else if (form.widgetEnabled) {
      const template = SERVICE_WIDGET_TEMPLATE_BY_TYPE[form.widgetType] ?? SERVICE_WIDGET_TEMPLATES[0];
      const widgetValues = { type: form.widgetType };
      const fields = uniqueFields([...(template.optionFields ?? template.fields ?? []), "fields"]);
      try {
        fields.forEach((field) => {
          const value = parseWidgetOption(field, form.widgetOptions[field]);
          if (value !== undefined) {
            widgetValues[field] = value;
          }
        });
        const validation = validateServiceWidgetFields(template, widgetValues.fields || []);
        if (!validation.valid) {
          const invalid = validation.invalidFields.length
            ? ` Invalid fields: ${validation.invalidFields.join(", ")}.`
            : "";
          const tooMany = validation.tooMany ? ` Maximum is ${template.maxFields}.` : "";
          throw new Error(`fields are invalid.${invalid}${tooMany}`);
        }
      } catch (error) {
        setWidgetError(`Widget options are invalid — ${error.message}`);
        return;
      }
      values.__widget = widgetValues;
    }
    onSubmit(values);
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-3xl max-h-[90vh] overflow-auto rounded-lg bg-white dark:bg-theme-800 text-theme-800 dark:text-theme-200 shadow-xl">
          <form onSubmit={submit}>
            <DialogTitle className="text-lg font-bold px-5 pt-5">{isEdit ? "Edit Service" : "Add Service"}</DialogTitle>
            <p className="px-5 pt-1 text-xs text-theme-500">
              {isEdit
                ? "Updates the YAML in the editor. You still need to click Save."
                : "Generates YAML and inserts it into the editor. You still need to click Save."}
            </p>
            <div className="px-5 py-4 flex flex-col gap-3">
              <Field label="Group" required>
                {isEdit ? (
                  <input value={form.group} readOnly className={`${inputClass} opacity-60 cursor-not-allowed`} />
                ) : (
                  <>
                    <input
                      list="config-existing-groups"
                      value={form.group}
                      onChange={setField("group")}
                      placeholder="Existing or new group"
                      className={inputClass}
                      autoFocus
                    />
                    <datalist id="config-existing-groups">
                      {existingGroups.map((g) => (
                        <option key={g} value={g} />
                      ))}
                    </datalist>
                  </>
                )}
              </Field>
              <Field label="Service Name" required>
                <input value={form.name} onChange={setField("name")} placeholder="Sonarr" className={inputClass} />
              </Field>
              <Field label="URL">
                <input
                  value={form.href}
                  onChange={setField("href")}
                  placeholder="http://localhost:8989"
                  className={inputClass}
                />
              </Field>
              <Field label="Site monitor URL (optional)">
                <input
                  value={form.siteMonitor}
                  onChange={setField("siteMonitor")}
                  placeholder="http://localhost:8989"
                  className={inputClass}
                />
              </Field>
              <details className="block text-sm rounded-md border border-theme-200 dark:border-theme-700 px-3 py-2">
                <summary className="cursor-pointer font-medium">Network URLs (optional)</summary>
                <p className="mt-1 mb-2 text-xs text-theme-400">
                  Per-network URLs. The dashboard auto-picks the one matching how it is accessed (LAN / Tailscale /
                  public); the URL above is the fallback.
                </p>
                <div className="space-y-2">
                  {URL_FORM_FIELDS.map(([formKey, , label]) => (
                    <Field key={formKey} label={label}>
                      <input
                        value={form[formKey]}
                        onChange={setField(formKey)}
                        placeholder={formKey === "urlPublic" ? "https://service.example.com" : "http://192.168.1.2:8080"}
                        className={inputClass}
                      />
                    </Field>
                  ))}
                </div>
              </details>
              <details className="block text-sm rounded-md border border-theme-200 dark:border-theme-700 px-3 py-2">
                <summary className="cursor-pointer font-medium">Service docs (optional)</summary>
                <p className="mt-1 mb-2 text-xs text-theme-400">
                  Strukturierte Doku, im Dashboard über ein Info-Icon auf der Kachel abrufbar.
                </p>
                <div className="space-y-2">
                  {DOCS_FORM_FIELDS.map(([formKey, , label, kind]) => (
                    <Field key={formKey} label={label}>
                      {kind === "textarea" ? (
                        <textarea
                          value={form[formKey]}
                          onChange={setField(formKey)}
                          className={`${inputClass} min-h-16`}
                        />
                      ) : (
                        <input value={form[formKey]} onChange={setField(formKey)} className={inputClass} />
                      )}
                    </Field>
                  ))}
                </div>
              </details>
              <div className="block text-sm">
                <label htmlFor={iconInputId} className="block font-medium mb-1">
                  Icon
                </label>
                <div className="flex gap-2">
                  <input
                    id={iconInputId}
                    value={form.icon}
                    onChange={setField("icon")}
                    placeholder="sonarr.png / mdi-server / sh-sonarr"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={findIcons}
                    disabled={iconSuggestionState === "loading" || !form.name.trim()}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md bg-theme-200 dark:bg-theme-700 px-3 py-2 text-sm font-medium hover:bg-theme-300 dark:hover:bg-theme-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <MdSearch className="h-4 w-4" />
                    {iconSuggestionState === "loading" ? "Searching" : "Find icon"}
                  </button>
                </div>
                {iconSuggestionError && <p className="mt-1 text-xs text-red-500">{iconSuggestionError}</p>}
                {iconSuggestionState === "done" && iconSuggestions.length === 0 && (
                  <p className="mt-1 text-xs text-theme-400">No matching icon found in curated sources.</p>
                )}
                <IconSuggestionList
                  suggestions={iconSuggestions}
                  onSelect={setIconField}
                  onCache={cacheIcon}
                  cachingUrl={cachingUrl}
                />

                {/* M21b: interactive dashboard-icons search */}
                <div className="mt-2 flex gap-2">
                  <input
                    value={iconSearchQuery}
                    onChange={(e) => setIconSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        searchIcons();
                      }
                    }}
                    placeholder="Search dashboard icons…"
                    aria-label="Search dashboard icons"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={searchIcons}
                    disabled={iconSearchState === "loading" || iconSearchQuery.trim().length < 2}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md bg-theme-200 dark:bg-theme-700 px-3 py-2 text-sm font-medium hover:bg-theme-300 dark:hover:bg-theme-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <MdSearch className="h-4 w-4" />
                    {iconSearchState === "loading" ? "Searching" : "Search"}
                  </button>
                </div>
                {iconSearchState === "done" && iconSearchResults.length === 0 && (
                  <p className="mt-1 text-xs text-theme-400">No dashboard icons matched that search.</p>
                )}
                <IconSuggestionList
                  suggestions={iconSearchResults}
                  onSelect={setIconField}
                  onCache={cacheIcon}
                  cachingUrl={cachingUrl}
                  title="Search results"
                />

                {/* M21b: upload a local icon + reuse gallery */}
                <div className="mt-2">
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-theme-200 dark:bg-theme-700 px-3 py-2 text-sm font-medium hover:bg-theme-300 dark:hover:bg-theme-600">
                    Upload icon
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      aria-label="Upload icon"
                      onChange={(e) => {
                        uploadIcon(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {iconUploadError && <p className="mt-1 text-xs text-red-500">{iconUploadError}</p>}
                  {localIcons.length > 0 && (
                    <div className="mt-2">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-theme-500">
                        Your uploaded icons
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {localIcons.map((file) => {
                          const iconRef = `/api/config/icon?file=${encodeURIComponent(file)}`;
                          return (
                            <button
                              key={file}
                              type="button"
                              onClick={() => setIconField(iconRef)}
                              title={file}
                              className="flex h-10 w-10 items-center justify-center rounded border border-theme-200 dark:border-theme-700 bg-white/60 dark:bg-black/20 hover:border-blue-500"
                            >
                              <ResolvedIcon icon={iconRef} width={28} height={28} alt={file} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <Field label="Description">
                <input
                  value={form.description}
                  onChange={setField("description")}
                  placeholder="Short description"
                  className={inputClass}
                />
              </Field>
              <Field label="Server (optional)">
                <input
                  value={form.server}
                  onChange={setField("server")}
                  placeholder="my-docker"
                  className={inputClass}
                />
              </Field>
              <Field label="Container (optional)">
                <input
                  value={form.container}
                  onChange={setField("container")}
                  placeholder="sonarr"
                  className={inputClass}
                />
              </Field>
              <Field label="Access groups">
                <input
                  value={form.accessGroups}
                  onChange={setField("accessGroups")}
                  placeholder="family, media"
                  className={inputClass}
                />
              </Field>
              <div className="block text-sm">
                <span className="block font-medium mb-1">Service badges (optional)</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 rounded-md border border-theme-300 dark:border-theme-700 bg-white dark:bg-theme-900 p-2 mb-2">
                  {BADGE_TYPES.map((badge) => (
                    <label key={badge.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={badgeList.includes(badge.id)}
                        onChange={() => toggleBadge(badge.id)}
                        className="rounded border-theme-300 dark:border-theme-700"
                      />
                      <span>{badge.label}</span>
                    </label>
                  ))}
                </div>
                <input
                  aria-label="Service badges"
                  value={form.badges}
                  onChange={setField("badges")}
                  placeholder="lan, critical, mein-eigenes-badge"
                  className={inputClass}
                />
                <p className="mt-1 text-[11px] text-theme-400">
                  Kuratierte Badges per Häkchen; eigene kommagetrennt ergänzen.
                </p>
              </div>
              {isEdit && (
                <div className="space-y-3 border-t border-theme-200 dark:border-theme-700 pt-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={form.widgetEnabled}
                      onChange={(e) => setForm((f) => ({ ...f, widgetEnabled: e.target.checked }))}
                      className="rounded border-theme-300 dark:border-theme-700"
                    />
                    Enable service widget
                  </label>
                  {form.widgetEnabled && (
                    <WidgetOptionsForm
                      type={form.widgetType}
                      options={form.widgetOptions}
                      onChange={setWidgetField}
                      existingWidget={initial?.widget}
                    />
                  )}
                  {!form.widgetEnabled && initial?.widget?.type && (
                    <p className="text-xs text-amber-600 dark:text-amber-300">
                      {initial.widget.supported ? (
                        <>
                          Updating will remove the existing <code>{initial.widget.label}</code> widget block from the
                          editor.
                        </>
                      ) : (
                        <>
                          Existing widget type <code>{initial.widget.type}</code> is not part of the curated UI list and
                          will be preserved. Edit it in raw YAML.
                        </>
                      )}
                    </p>
                  )}
                  {widgetError && <p className="text-xs text-red-500">{widgetError}</p>}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-theme-200 dark:bg-theme-700 px-4 py-2 text-sm font-medium hover:bg-theme-300 dark:hover:bg-theme-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isEdit ? "Update editor" : "Add to editor"}
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

// Adapter preserving the shell's add contract (onAdd) on top of the shared form.
function ServiceAddDialog({ open, onClose, onAdd, existingGroups }) {
  return (
    <ServiceFormDialog mode="add" open={open} onClose={onClose} onSubmit={onAdd} existingGroups={existingGroups} />
  );
}

// Adapter for the shell's edit contract (onSubmit/initial/group).
function ServiceEditDialog(props) {
  return <ServiceFormDialog mode="edit" {...props} />;
}

function updateServiceAndWidget(raw, locator, values) {
  const { __widget: widgetValues, ...serviceValues } = values;
  let next = updateServiceEntry(raw, locator, serviceValues);
  const nextName = serviceValues.name || locator.name;
  if (widgetValues?.delete) {
    next = deleteServiceWidget(next, { ...locator, name: nextName });
  } else if (widgetValues) {
    next = updateServiceWidget(next, { ...locator, name: nextName }, widgetValues);
  }
  return next;
}

// Map the shell's move-to-group locator ({ entry }) onto the name-based helper.
// `toIndex` (drag & drop) inserts at that position; without it the helper appends.
const moveServiceToGroup = (raw, { fromGroup, entry, toGroup, toIndex }) =>
  moveEntryToGroup(raw, { fromGroup, name: entry.name, toGroup, toIndex });

// Drag & drop adapters (arbitrary target index).
const reorderServiceTo = (raw, { group, name }, toIndex) => moveEntryToIndex(raw, { group, name }, toIndex);
const reorderServiceGroupTo = (raw, { group }, toIndex) => moveGroupToIndex(raw, { group }, toIndex);

export default function AdminServicesConfig() {
  // When a settings.yaml `layout:` governs group order, group reordering here has
  // no dashboard effect — manage it in /admin/layout instead (and hide it here).
  const layoutGoverns = useLayoutGoverns();
  return (
    <ConfigEditor
      configFile="services.yaml"
      parse={parseServices}
      Card={ServiceCard}
      AddDialog={ServiceAddDialog}
      insert={insertService}
      addLabel="Add Service"
      EditDialog={ServiceEditDialog}
      editEntry={updateServiceAndWidget}
      deleteEntry={deleteServiceEntry}
      reorderEntry={moveEntryInGroup}
      moveToGroup={moveServiceToGroup}
      reorderEntryTo={reorderServiceTo}
      {...(layoutGoverns
        ? { groupReorderHint: "Gruppen-Reihenfolge wird über die Layout-Verwaltung gesteuert →" }
        : { reorderGroup: moveGroup, reorderGroupTo: reorderServiceGroupTo })}
    />
  );
}
