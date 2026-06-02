import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import ConfigEditor, { Field, inputClass } from "components/admin/config-editor";
import { useEffect, useState } from "react";
import { MdDelete, MdEdit } from "react-icons/md";

import {
  INFO_WIDGET_TEMPLATES,
  INFO_WIDGET_TEMPLATE_BY_TYPE,
  parseInfoWidgetValue,
} from "utils/config/info-widget-templates";
import { parseWidgets } from "utils/config/widget-preview";
import {
  addInfoWidget,
  deleteWidget,
  moveWidget,
  moveWidgetToIndex,
  updateWidgetOptions,
} from "utils/config/yaml-edit";

function WidgetCard({ entry, onEdit, onDelete }) {
  const template = INFO_WIDGET_TEMPLATE_BY_TYPE[entry.type];
  const hasEditable = Boolean(template) || entry.fields.some((f) => f.editable || f.redacted);
  return (
    <div className="mb-2 rounded-md font-medium text-theme-700 dark:text-theme-200 shadow-md shadow-theme-900/10 dark:shadow-theme-900/20 bg-theme-100/20 dark:bg-white/5">
      <div className="flex items-center justify-between gap-1 px-3 py-2 border-b border-theme-300/60 dark:border-theme-700/60 text-sm font-semibold">
        <span className="min-w-0 truncate">{template?.label ?? entry.type}</span>
        {(onEdit || onDelete) && (
          <span className="shrink-0 flex gap-1">
            {onEdit && hasEditable && (
              <button
                type="button"
                onClick={onEdit}
                title="Edit"
                aria-label={`Edit ${entry.type} widget`}
                className="rounded p-0.5 text-theme-500 hover:text-theme-700 dark:hover:text-theme-200 hover:bg-theme-300/40 dark:hover:bg-white/10"
              >
                <MdEdit className="w-4 h-4" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                title="Delete"
                aria-label={`Delete ${entry.type} widget`}
                className="rounded p-0.5 text-theme-500 hover:text-red-600 hover:bg-theme-300/40 dark:hover:bg-white/10"
              >
                <MdDelete className="w-4 h-4" />
              </button>
            )}
          </span>
        )}
      </div>
      {entry.fields.length > 0 ? (
        <dl className="px-3 py-2 flex flex-col gap-1">
          {entry.fields.map((field) => (
            <div key={field.key} className="flex gap-2 text-xs">
              <dt className="shrink-0 text-theme-500 dark:text-theme-400 font-medium">{field.key}</dt>
              {field.redacted ? (
                <dd className="font-mono italic text-theme-400 dark:text-theme-500">{field.value}</dd>
              ) : (
                <dd className="min-w-0 truncate font-mono text-theme-700 dark:text-theme-300" title={field.value}>
                  {field.value}
                </dd>
              )}
            </div>
          ))}
        </dl>
      ) : (
        <p className="px-3 py-2 text-xs text-theme-500">No options.</p>
      )}
      {!template && (
        <p className="px-3 pb-2 text-[11px] text-amber-600 dark:text-amber-300">
          Unknown widget type; advanced edits stay in raw YAML.
        </p>
      )}
    </div>
  );
}

function valueFromDisplay(field, value) {
  if (field.type === "boolean") {
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
    return "";
  }
  if (field.type === "listOrString") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.join(", ");
      }
    } catch {
      // keep the display string
    }
  }
  return value ?? "";
}

function fieldValueByKey(fields, key) {
  return fields.find((field) => field.key === key)?.value;
}

function InfoWidgetFields({ template, form, setForm, mode }) {
  const setField = (key, value) => setForm((state) => ({ ...state, [key]: value }));

  return (
    <>
      {template.fields.map((field) => (
        <Field key={field.key} label={field.key}>
          {field.type === "boolean" ? (
            <label className="flex items-center gap-2 rounded-md border border-theme-300 dark:border-theme-700 bg-white dark:bg-theme-800 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={form[field.key] === true}
                onChange={(e) => setField(field.key, e.target.checked)}
                className="rounded border-theme-300 dark:border-theme-700"
              />
              enabled
            </label>
          ) : field.type === "enum" ? (
            <select
              value={form[field.key] ?? ""}
              onChange={(e) => setField(field.key, e.target.value)}
              className={inputClass}
            >
              <option value="">Default / unset</option>
              {field.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={form[field.key] ?? ""}
              onChange={(e) => setField(field.key, e.target.value)}
              type={field.type === "number" ? "number" : "text"}
              placeholder={field.placeholder ?? ""}
              className={inputClass}
            />
          )}
          {field.type === "listOrString" && (
            <p className="mt-1 text-[11px] text-theme-400">Use commas or new lines for multiple values.</p>
          )}
        </Field>
      ))}
      {template.advancedFields?.length > 0 && (
        <p className="text-xs text-theme-400">
          Advanced options are kept for raw YAML in v1: <code>{template.advancedFields.join(", ")}</code>.
        </p>
      )}
      {mode === "add" && (
        <p className="text-xs text-theme-400">Only filled fields and enabled booleans are inserted.</p>
      )}
    </>
  );
}

function WidgetFormDialog({ mode = "edit", open, onClose, onSubmit, initial }) {
  const isAdd = mode === "add";
  const [type, setType] = useState(INFO_WIDGET_TEMPLATES[0].type);
  const [form, setForm] = useState({});
  const [error, setError] = useState(null);
  const fields = initial?.fields ?? [];
  const template = INFO_WIDGET_TEMPLATE_BY_TYPE[type];

  useEffect(() => {
    if (!open) {
      return;
    }
    setError(null);
    const nextType = isAdd ? INFO_WIDGET_TEMPLATES[0].type : initial?.type;
    setType(nextType);
    const next = {};
    const nextTemplate = INFO_WIDGET_TEMPLATE_BY_TYPE[nextType];
    if (nextTemplate) {
      nextTemplate.fields.forEach((field) => {
        const displayValue = fieldValueByKey(fields, field.key);
        if (displayValue !== undefined) {
          next[field.key] = valueFromDisplay(field, displayValue);
        }
      });
    } else {
      fields.forEach((field) => {
        if (field.editable) {
          next[field.key] = field.value;
        } else if (field.redacted) {
          next[field.key] = "";
        }
      });
    }
    setForm(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, isAdd]);

  const setLegacyField = (key) => (e) => setForm((state) => ({ ...state, [key]: e.target.value }));

  const submitLegacy = () => {
    const values = {};
    fields.forEach((field) => {
      if (field.redacted) {
        const value = (form[field.key] ?? "").trim();
        if (value !== "") {
          values[field.key] = value;
        }
      } else if (field.editable && form[field.key] !== field.value) {
        values[field.key] = form[field.key];
      }
    });
    onSubmit(values);
  };

  const submitStructured = () => {
    const values = { type };
    template.fields.forEach((field) => {
      const raw = form[field.key];
      if (isAdd && field.type === "boolean" && raw !== true) {
        return;
      }
      const value = parseInfoWidgetValue(field, raw);
      if (value !== undefined && (!isAdd || value !== "")) {
        values[field.key] = value;
      }
    });
    if (isAdd) {
      values.name = type;
    }
    onSubmit(values);
  };

  const submit = (e) => {
    e.preventDefault();
    setError(null);
    try {
      if (!template) {
        submitLegacy();
      } else {
        submitStructured();
      }
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-lg bg-white dark:bg-theme-800 text-theme-800 dark:text-theme-200 shadow-xl">
          <form onSubmit={submit}>
            <DialogTitle className="text-lg font-bold px-5 pt-5">
              {isAdd ? "Add Info Widget" : `Edit ${initial?.type} widget`}
            </DialogTitle>
            <p className="px-5 pt-1 text-xs text-theme-500">
              {isAdd
                ? "Adds a widgets.yaml entry to the editor. You still need to click Save."
                : "Updates option values in the editor. You still need to click Save."}
            </p>
            <div className="px-5 py-4 flex flex-col gap-3 max-h-[60vh] overflow-auto">
              {isAdd && (
                <Field label="Widget type" required>
                  <select
                    value={type}
                    onChange={(e) => {
                      setType(e.target.value);
                      setForm({});
                      setError(null);
                    }}
                    className={inputClass}
                  >
                    {INFO_WIDGET_TEMPLATES.map((templateOption) => (
                      <option key={templateOption.type} value={templateOption.type}>
                        {templateOption.label}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {template ? (
                <InfoWidgetFields template={template} form={form} setForm={setForm} mode={mode} />
              ) : (
                <>
                  <p className="text-xs text-amber-600 dark:text-amber-300">
                    This widget type is not in the structured UI list. Simple string options can be edited here; complex
                    options stay raw YAML.
                  </p>
                  {fields.map((field) => (
                    <Field key={field.key} label={field.key}>
                      {field.redacted ? (
                        <input
                          value={form[field.key] ?? ""}
                          onChange={setLegacyField(field.key)}
                          placeholder="hidden — type to replace, leave blank to keep"
                          className={inputClass}
                        />
                      ) : field.editable ? (
                        <input
                          value={form[field.key] ?? ""}
                          onChange={setLegacyField(field.key)}
                          className={inputClass}
                        />
                      ) : (
                        <input
                          value={field.value}
                          readOnly
                          title="structured value — edit raw"
                          className={`${inputClass} opacity-60 cursor-not-allowed`}
                        />
                      )}
                    </Field>
                  ))}
                </>
              )}
              {error && <p className="text-xs text-red-500">{error}</p>}
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
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {isAdd ? "Add to editor" : "Update editor"}
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function WidgetAddDialog({ open, onClose, onAdd }) {
  return <WidgetFormDialog mode="add" open={open} onClose={onClose} onSubmit={onAdd} />;
}

function WidgetEditDialog(props) {
  return <WidgetFormDialog mode="edit" {...props} />;
}

const insertWidget = (raw, values) => addInfoWidget(raw, values);
const editWidget = (raw, { entry }, values) => updateWidgetOptions(raw, { index: entry.index }, values);
const removeWidget = (raw, { entry }) => deleteWidget(raw, { index: entry.index });
const reorderWidget = (raw, { entry }, direction) => moveWidget(raw, { index: entry.index }, direction);
const reorderWidgetTo = (raw, { entry }, toIndex) => moveWidgetToIndex(raw, { index: entry.index }, toIndex);

export default function AdminWidgetsConfig() {
  return (
    <ConfigEditor
      configFile="widgets.yaml"
      parse={parseWidgets}
      Card={WidgetCard}
      gridClassName="grid grid-cols-1 sm:grid-cols-2 gap-3"
      AddDialog={WidgetAddDialog}
      insert={insertWidget}
      addLabel="Add Info Widget"
      EditDialog={WidgetEditDialog}
      editEntry={editWidget}
      deleteEntry={removeWidget}
      reorderEntry={reorderWidget}
      reorderEntryTo={reorderWidgetTo}
    />
  );
}
