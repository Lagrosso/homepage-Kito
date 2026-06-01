import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import ConfigEditor, { Field, inputClass, shortenUrl } from "components/admin/config-editor";
import { useLayoutGoverns } from "components/admin/use-layout-governs";
import ResolvedIcon from "components/resolvedicon";
import yaml from "js-yaml";
import { useEffect, useState } from "react";
import { MdDelete, MdEdit } from "react-icons/md";
import {
  deleteBookmarkEntry,
  moveEntryInGroup,
  moveEntryToGroup,
  moveEntryToIndex,
  moveGroup,
  moveGroupToIndex,
  updateBookmarkEntry,
} from "utils/config/yaml-edit";
import { insertBookmark } from "utils/config/yaml-insert";

// Parse bookmarks.yaml into groups of card props for the read-only preview.
// Bookmarks nest one extra level: { Group: [ { Name: [ { abbr, href, ... } ] } ] }.
function parseBookmarks(content) {
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
          const bookmarkName = Object.keys(entry)[0];
          const value = entry[bookmarkName];
          const props = Array.isArray(value) ? (value[0] ?? {}) : (value ?? {});
          return {
            name: bookmarkName,
            abbr: props.abbr,
            href: props.href,
            icon: props.icon,
            description: props.description,
          };
        });
      return { name, entries };
    });
}

// Read-only card mirroring the dashboard bookmark styling
// (components/bookmarks/item.jsx) without navigation.
function BookmarkCard({ entry, onEdit, onDelete }) {
  return (
    <div className="mb-3 rounded-md font-medium text-theme-700 dark:text-theme-200 shadow-md shadow-theme-900/10 dark:shadow-theme-900/20 bg-theme-100/20 dark:bg-white/5">
      <div className="flex">
        <div className="shrink-0 flex items-center justify-center w-11 bg-theme-500/10 dark:bg-theme-900/50 text-sm font-medium rounded-l-md">
          {entry.icon ? (
            <div className="shrink-0 w-5 h-5">
              <ResolvedIcon icon={entry.icon} alt={entry.abbr} />
            </div>
          ) : (
            entry.abbr || entry.name?.slice(0, 2)?.toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0 flex items-center justify-between rounded-r-md">
          <div className="pl-3 py-2 text-xs truncate">{entry.name}</div>
          <div className="shrink truncate px-2 py-2 text-theme-500 dark:text-theme-300 text-xs" title={entry.href}>
            {entry.description || shortenUrl(entry.href)}
          </div>
        </div>
        {(onEdit || onDelete) && (
          <div className="shrink-0 self-center flex gap-1 pr-2">
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

const EMPTY_FORM = { group: "", name: "", href: "", icon: "", abbr: "", description: "" };

// Modal that collects fields for a single bookmark and hands the values back to
// the editor. It never writes to disk — Save stays manual. In "edit" mode the
// group is fixed (no moving in v1) and the form is prefilled from the entry.
function BookmarkFormDialog({ mode = "add", open, onClose, onSubmit, initial, group, existingGroups = [] }) {
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
            abbr: initial?.abbr ?? "",
            description: initial?.description ?? "",
          }
        : EMPTY_FORM,
    );
  }, [open, isEdit, initial, group]);

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const canSubmit = form.group.trim() && form.name.trim() && form.href.trim();

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
        icon: form.icon.trim(),
        abbr: form.abbr.trim(),
        description: form.description.trim(),
      });
      return;
    }
    // Edit mode: send name plus only changed fields so untouched fields stay
    // byte-identical in the YAML.
    const values = { name: form.name.trim() };
    ["abbr", "href", "icon", "description"].forEach((field) => {
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
            <DialogTitle className="text-lg font-bold px-5 pt-5">
              {isEdit ? "Edit Bookmark" : "Add Bookmark"}
            </DialogTitle>
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
              <Field label="Bookmark Name" required>
                <input value={form.name} onChange={setField("name")} placeholder="Github" className={inputClass} />
              </Field>
              <Field label="URL" required>
                <input
                  value={form.href}
                  onChange={setField("href")}
                  placeholder="https://github.com/"
                  className={inputClass}
                />
              </Field>
              <Field label="Abbreviation">
                <input value={form.abbr} onChange={setField("abbr")} placeholder="GH" className={inputClass} />
              </Field>
              <Field label="Icon">
                <input
                  value={form.icon}
                  onChange={setField("icon")}
                  placeholder="github.png / mdi-github / sh-github"
                  className={inputClass}
                />
              </Field>
              <Field label="Description">
                <input
                  value={form.description}
                  onChange={setField("description")}
                  placeholder="Code hosting"
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
function BookmarkAddDialog({ open, onClose, onAdd, existingGroups }) {
  return (
    <BookmarkFormDialog mode="add" open={open} onClose={onClose} onSubmit={onAdd} existingGroups={existingGroups} />
  );
}

// Adapter for the shell's edit contract (onSubmit/initial/group).
function BookmarkEditDialog(props) {
  return <BookmarkFormDialog mode="edit" {...props} />;
}

// Map the shell's move-to-group locator ({ entry }) onto the name-based helper.
// `toIndex` (drag & drop) inserts at that position; without it the helper appends.
const moveBookmarkToGroup = (raw, { fromGroup, entry, toGroup, toIndex }) =>
  moveEntryToGroup(raw, { fromGroup, name: entry.name, toGroup, toIndex });

// Drag & drop adapters (arbitrary target index).
const reorderBookmarkTo = (raw, { group, name }, toIndex) => moveEntryToIndex(raw, { group, name }, toIndex);
const reorderBookmarkGroupTo = (raw, { group }, toIndex) => moveGroupToIndex(raw, { group }, toIndex);

export default function AdminBookmarksConfig() {
  // Group order is governed by settings.yaml `layout:` when present — then hide
  // group reordering here and point to /admin/layout.
  const layoutGoverns = useLayoutGoverns();
  return (
    <ConfigEditor
      configFile="bookmarks.yaml"
      parse={parseBookmarks}
      Card={BookmarkCard}
      gridClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3"
      AddDialog={BookmarkAddDialog}
      insert={insertBookmark}
      addLabel="Add Bookmark"
      EditDialog={BookmarkEditDialog}
      editEntry={updateBookmarkEntry}
      deleteEntry={deleteBookmarkEntry}
      reorderEntry={moveEntryInGroup}
      moveToGroup={moveBookmarkToGroup}
      reorderEntryTo={reorderBookmarkTo}
      {...(layoutGoverns
        ? { groupReorderHint: "Gruppen-Reihenfolge wird über die Layout-Verwaltung gesteuert →" }
        : { reorderGroup: moveGroup, reorderGroupTo: reorderBookmarkGroupTo })}
    />
  );
}
