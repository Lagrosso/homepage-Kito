import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import ConfigEditor, { Field, inputClass } from "components/admin/config-editor";
import { useEffect, useState } from "react";
import { MdDelete, MdEdit } from "react-icons/md";
import { deleteSetting, updateSetting } from "utils/config/yaml-edit";
import { parseSettings } from "utils/config/settings-preview";

// Read-only card for one settings field. Values are already masked by
// parseSettings/maskValue, so a real secret never reaches the DOM (not in text,
// not in title tooltips). Redacted fields render as "[redacted]". Only plain
// scalar, non-secret values expose an Edit action (entry.editable); Delete is
// always available.
function SettingsCard({ entry, onEdit, onDelete }) {
  return (
    <div className="mb-2 rounded-md font-medium text-theme-700 dark:text-theme-200 shadow-md shadow-theme-900/10 dark:shadow-theme-900/20 bg-theme-100/20 dark:bg-white/5">
      <div className="flex items-start justify-between gap-1 px-3 pt-2">
        <div className="text-xs font-semibold min-w-0 truncate">{entry.key}</div>
        {(onEdit || onDelete) && (
          <div className="shrink-0 flex gap-1">
            {onEdit && entry.editable && (
              <button
                type="button"
                onClick={onEdit}
                title="Edit"
                aria-label={`Edit ${entry.key}`}
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
                aria-label={`Delete ${entry.key}`}
                className="rounded p-0.5 text-theme-500 hover:text-red-600 hover:bg-theme-300/40 dark:hover:bg-white/10"
              >
                <MdDelete className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="px-3 pb-2 text-xs">
        {entry.redacted ? (
          <span className="font-mono italic text-theme-400 dark:text-theme-500">{entry.value}</span>
        ) : (
          <span className="block truncate font-mono text-theme-700 dark:text-theme-300" title={entry.value}>
            {entry.value || "—"}
          </span>
        )}
        {!entry.redacted && !entry.editable && (
          <span className="block text-[10px] text-theme-400 dark:text-theme-500">structured — edit raw</span>
        )}
      </div>
    </div>
  );
}

// Edit dialog for a single scalar setting. Renders a control matching the value
// type so booleans/numbers keep their type on save. Sends the typed value to the
// editor only (never disk); Save stays manual.
function SettingsEditDialog({ open, onClose, onSubmit, initial }) {
  const valueType = initial?.valueType ?? "string";
  const [text, setText] = useState("");

  useEffect(() => {
    if (open) {
      setText(initial?.value ?? "");
    }
  }, [open, initial]);

  const submit = (e) => {
    e.preventDefault();
    let typed = text;
    if (valueType === "boolean") {
      typed = text === "true";
    } else if (valueType === "number") {
      const n = Number(text);
      if (Number.isNaN(n)) {
        return;
      }
      typed = n;
    }
    onSubmit(typed);
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-lg bg-white dark:bg-theme-800 text-theme-800 dark:text-theme-200 shadow-xl">
          <form onSubmit={submit}>
            <DialogTitle className="text-lg font-bold px-5 pt-5">Edit {initial?.key}</DialogTitle>
            <p className="px-5 pt-1 text-xs text-theme-500">
              Updates the YAML in the editor. You still need to click Save.
            </p>
            <div className="px-5 py-4">
              <Field label={`Value (${valueType})`}>
                {valueType === "boolean" ? (
                  <select value={text} onChange={(e) => setText(e.target.value)} className={inputClass}>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : (
                  <input
                    type={valueType === "number" ? "number" : "text"}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className={inputClass}
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                  />
                )}
              </Field>
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

// Map the shell's generic locator ({ entry }) onto the key-based settings helpers.
const editSetting = (raw, { entry }, value) => updateSetting(raw, { key: entry.key }, value);
const removeSetting = (raw, { entry }) => deleteSetting(raw, { key: entry.key });

export default function AdminSettingsConfig() {
  return (
    <ConfigEditor
      configFile="settings.yaml"
      parse={parseSettings}
      Card={SettingsCard}
      gridClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
      EditDialog={SettingsEditDialog}
      editEntry={editSetting}
      deleteEntry={removeSetting}
    />
  );
}
