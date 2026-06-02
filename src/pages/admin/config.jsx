import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import ConfigEditor, { Field, inputClass, shortenUrl } from "components/admin/config-editor";
import ResolvedIcon from "components/resolvedicon";
import yaml from "js-yaml";
import { useEffect, useState } from "react";
import { MdDelete, MdEdit } from "react-icons/md";

import { useLayoutGoverns } from "components/admin/use-layout-governs";
import { isPlaceholder, maskValue } from "utils/config/secret-mask";
import {
  SERVICE_WIDGET_TEMPLATES,
  SERVICE_WIDGET_TEMPLATE_BY_TYPE,
  isServiceWidgetSecretField,
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
            description: value?.description,
            icon: value?.icon,
            server: value?.server ?? value?.widget?.server,
            container: value?.container ?? value?.widget?.container,
            widget: maskWidget(value?.widget),
            accessGroups: Array.isArray(value?.access?.groups) ? value.access.groups : [],
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
  icon: "",
  description: "",
  server: "",
  container: "",
  accessGroups: "",
  widgetEnabled: false,
  widgetType: SERVICE_WIDGET_TEMPLATES[0].type,
  widgetOptions: {},
};

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

function parseWidgetOption(field, raw) {
  const value = typeof raw === "string" ? raw.trim() : raw;
  if (field === "fields") {
    if (typeof value === "string" && value === "") {
      return "";
    }
    return typeof value === "string"
      ? uniqueFields(value.split(",").map((item) => item.trim()))
      : Array.isArray(value)
        ? uniqueFields(value)
        : [];
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
  return value;
}

function WidgetOptionsForm({ type, options, onChange, existingWidget }) {
  const template = SERVICE_WIDGET_TEMPLATE_BY_TYPE[type] ?? SERVICE_WIDGET_TEMPLATES[0];
  const fields = uniqueFields([...(template.fields ?? []), template.displayFields ? "fields" : null]);
  const existingKeys = existingWidget?.fields?.map((field) => field.key) ?? [];
  const unknownKeys = existingKeys.filter((key) => key !== "type" && !fields.includes(key));

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
      {fields.map((field) => {
        const isSecret = isServiceWidgetSecretField(field);
        const label = field === "fields" ? "Display fields" : field;
        const placeholder =
          field === "metrics"
            ? '[{"label":"Requests","query":"sum(rate(http_requests_total[5m]))"}]'
            : isSecret
              ? "Leave blank to keep existing secret"
              : "";
        return (
          <Field key={field} label={label}>
            {field === "metrics" ? (
              <textarea
                value={options[field] ?? ""}
                onChange={(e) => onChange("widgetOption", field, e.target.value)}
                placeholder={placeholder}
                spellCheck={false}
                className={`${inputClass} min-h-20 font-mono`}
              />
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
            {field === "fields" && template.displayFields && (
              <p className="mt-1 text-[11px] text-theme-400">
                Suggested: <code>{template.displayFields.join(", ")}</code>
              </p>
            )}
          </Field>
        );
      })}
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

// Modal that collects fields for a single service and hands the values back to
// the editor. It never writes to disk — Save stays manual. Works in two modes:
//   - "add":  group is free-text (datalist of existing groups), no description.
//   - "edit": group is fixed/read-only (no moving in v1), description is editable.
function ServiceFormDialog({ mode = "add", open, onClose, onSubmit, initial, group, existingGroups = [] }) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState(EMPTY_FORM);
  const [widgetError, setWidgetError] = useState(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setWidgetError(null);
    setForm(
      isEdit
        ? {
            group: group ?? "",
            name: initial?.name ?? "",
            href: initial?.href ?? "",
            icon: initial?.icon ?? "",
            description: initial?.description ?? "",
            server: initial?.server ?? "",
            container: initial?.container ?? "",
            accessGroups: Array.isArray(initial?.accessGroups) ? initial.accessGroups.join(", ") : "",
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
  const setWidgetField = (kind, key, value) => {
    setWidgetError(null);
    if (kind === "widgetType") {
      setForm((f) => ({ ...f, widgetType: key }));
      return;
    }
    setForm((f) => ({ ...f, widgetOptions: { ...f.widgetOptions, [key]: value } }));
  };
  const canSubmit = form.group.trim() && form.name.trim() && (!form.widgetEnabled || form.widgetType);

  const submit = (e) => {
    e.preventDefault();
    if (!canSubmit) {
      return;
    }
    if (!isEdit) {
      onSubmit({
        group: form.group.trim(),
        name: form.name.trim(),
        href: form.href.trim(),
        description: form.description.trim(),
        icon: form.icon.trim(),
        server: form.server.trim(),
        container: form.container.trim(),
        accessGroups: form.accessGroups.trim(),
      });
      return;
    }
    // Edit mode: send the name plus only fields that actually changed, so
    // untouched fields stay byte-identical and no derived value (e.g. a service's
    // widget.server/container shown here) is written back as a new top-level field.
    const values = { name: form.name.trim() };
    ["href", "icon", "description", "server", "container"].forEach((field) => {
      if (form[field].trim() !== String(initial?.[field] ?? "")) {
        values[field] = form[field].trim();
      }
    });
    if (form.accessGroups.trim() !== (Array.isArray(initial?.accessGroups) ? initial.accessGroups.join(", ") : "")) {
      values.accessGroups = form.accessGroups.trim();
    }
    if (!form.widgetEnabled && initial?.widget?.type && initial?.widget?.supported) {
      values.__widget = { delete: true };
    } else if (form.widgetEnabled) {
      const template = SERVICE_WIDGET_TEMPLATE_BY_TYPE[form.widgetType] ?? SERVICE_WIDGET_TEMPLATES[0];
      const widgetValues = { type: form.widgetType };
      const fields = uniqueFields([...(template.fields ?? []), template.displayFields ? "fields" : null]);
      try {
        fields.forEach((field) => {
          widgetValues[field] = parseWidgetOption(field, form.widgetOptions[field] ?? "");
        });
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
        <DialogPanel className="w-full max-w-lg max-h-[90vh] overflow-auto rounded-lg bg-white dark:bg-theme-800 text-theme-800 dark:text-theme-200 shadow-xl">
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
              <Field label="Icon">
                <input
                  value={form.icon}
                  onChange={setField("icon")}
                  placeholder="sonarr.png / mdi-server / sh-sonarr"
                  className={inputClass}
                />
              </Field>
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
