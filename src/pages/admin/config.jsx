import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import ConfigEditor, { Field, inputClass, shortenUrl } from "components/admin/config-editor";
import { useLayoutGoverns } from "components/admin/use-layout-governs";
import ResolvedIcon from "components/resolvedicon";
import yaml from "js-yaml";
import { useEffect, useState } from "react";
import { MdDelete, MdEdit } from "react-icons/md";
import {
  deleteServiceEntry,
  moveEntryInGroup,
  moveEntryToGroup,
  moveEntryToIndex,
  moveGroup,
  moveGroupToIndex,
  updateServiceEntry,
} from "utils/config/yaml-edit";
import { insertService } from "utils/config/yaml-insert";

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

const EMPTY_FORM = { group: "", name: "", href: "", icon: "", description: "", server: "" };

// Modal that collects fields for a single service and hands the values back to
// the editor. It never writes to disk — Save stays manual. Works in two modes:
//   - "add":  group is free-text (datalist of existing groups), no description.
//   - "edit": group is fixed/read-only (no moving in v1), description is editable.
function ServiceFormDialog({ mode = "add", open, onClose, onSubmit, initial, group, existingGroups = [] }) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!open) {
      return;
    }
    setForm(
      isEdit
        ? {
            group: group ?? "",
            name: initial?.name ?? "",
            href: initial?.href ?? "",
            icon: initial?.icon ?? "",
            description: initial?.description ?? "",
            server: initial?.server ?? "",
          }
        : EMPTY_FORM,
    );
  }, [open, isEdit, initial, group]);

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const canSubmit = form.group.trim() && form.name.trim();

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
      });
      return;
    }
    // Edit mode: send the name plus only fields that actually changed, so
    // untouched fields stay byte-identical and no derived value (e.g. a service's
    // widget.server shown in `server`) is written back as a new top-level field.
    const values = { name: form.name.trim() };
    ["href", "icon", "description", "server"].forEach((field) => {
      if (form[field].trim() !== String(initial?.[field] ?? "")) {
        values[field] = form[field].trim();
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
                      // eslint-disable-next-line jsx-a11y/no-autofocus
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
      editEntry={updateServiceEntry}
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
