import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import ConfigEditor, { Field, inputClass } from "components/admin/config-editor";
import { useEffect, useState } from "react";
import { MdDelete, MdEdit } from "react-icons/md";
import { deleteWidget, updateWidgetOptions } from "utils/config/yaml-edit";
import { parseWidgets } from "utils/config/widget-preview";

// Read-only card for one info widget. Values are already masked by
// parseWidgets/maskWidgetOptions, so the real secret never reaches the DOM
// (not in text, not in title tooltips). Redacted fields render as "[redacted]".
// Edit is offered only when at least one field is form-editable or a secret that
// can be replaced; Delete is always available.
function WidgetCard({ entry, onEdit, onDelete }) {
  const hasEditable = entry.fields.some((f) => f.editable || f.redacted);
  return (
    <div className="mb-2 rounded-md font-medium text-theme-700 dark:text-theme-200 shadow-md shadow-theme-900/10 dark:shadow-theme-900/20 bg-theme-100/20 dark:bg-white/5">
      <div className="flex items-center justify-between gap-1 px-3 py-2 border-b border-theme-300/60 dark:border-theme-700/60 text-sm font-semibold">
        <span className="min-w-0 truncate">{entry.type}</span>
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
    </div>
  );
}

// Secret-aware edit dialog for one widget's options. Editable string fields are
// prefilled; secret fields render empty ("leave blank to keep"); other values
// (numbers/booleans/objects/placeholders) are shown read-only. Only changed
// editable fields and filled secret fields are sent — the real secret is never
// prefilled and never overwritten unless the user types a replacement.
function WidgetEditDialog({ open, onClose, onSubmit, initial }) {
  const fields = initial?.fields ?? [];
  const [form, setForm] = useState({});

  useEffect(() => {
    if (!open) {
      return;
    }
    const next = {};
    fields.forEach((f) => {
      if (f.editable) {
        next[f.key] = f.value;
      } else if (f.redacted) {
        next[f.key] = "";
      }
    });
    setForm(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const setField = (key) => (e) => setForm((s) => ({ ...s, [key]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    const values = {};
    fields.forEach((f) => {
      if (f.redacted) {
        const v = (form[f.key] ?? "").trim();
        if (v !== "") {
          values[f.key] = v; // replace secret only when a new value is typed
        }
      } else if (f.editable && form[f.key] !== f.value) {
        values[f.key] = form[f.key]; // changed editable field ("" deletes it)
      }
    });
    onSubmit(values);
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-lg bg-white dark:bg-theme-800 text-theme-800 dark:text-theme-200 shadow-xl">
          <form onSubmit={submit}>
            <DialogTitle className="text-lg font-bold px-5 pt-5">Edit {initial?.type} widget</DialogTitle>
            <p className="px-5 pt-1 text-xs text-theme-500">
              Updates option values in the editor. You still need to click Save.
            </p>
            <div className="px-5 py-4 flex flex-col gap-3 max-h-[60vh] overflow-auto">
              {fields.map((f) => (
                <Field key={f.key} label={f.key}>
                  {f.redacted ? (
                    <input
                      value={form[f.key] ?? ""}
                      onChange={setField(f.key)}
                      placeholder="hidden — type to replace, leave blank to keep"
                      className={inputClass}
                    />
                  ) : f.editable ? (
                    <input value={form[f.key] ?? ""} onChange={setField(f.key)} className={inputClass} />
                  ) : (
                    <input
                      value={f.value}
                      readOnly
                      title="structured value — edit raw"
                      className={`${inputClass} opacity-60 cursor-not-allowed`}
                    />
                  )}
                </Field>
              ))}
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
                Update editor
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

// Map the shell's generic locator ({ entry }) onto the index-based widget helpers.
const editWidget = (raw, { entry }, values) => updateWidgetOptions(raw, { index: entry.index }, values);
const removeWidget = (raw, { entry }) => deleteWidget(raw, { index: entry.index });

export default function AdminWidgetsConfig() {
  return (
    <ConfigEditor
      configFile="widgets.yaml"
      parse={parseWidgets}
      Card={WidgetCard}
      gridClassName="grid grid-cols-1 sm:grid-cols-2 gap-3"
      EditDialog={WidgetEditDialog}
      editEntry={editWidget}
      deleteEntry={removeWidget}
    />
  );
}
