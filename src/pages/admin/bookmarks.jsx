import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import ConfigEditor, { Field, inputClass, shortenUrl } from "components/admin/config-editor";
import ResolvedIcon from "components/resolvedicon";
import yaml from "js-yaml";
import { useEffect, useState } from "react";
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
function BookmarkCard({ entry }) {
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
      </div>
    </div>
  );
}

const EMPTY_FORM = { group: "", name: "", href: "", icon: "", abbr: "", description: "" };

// Modal that collects fields for a single bookmark and hands the generated
// YAML back to the editor. It never writes to disk — Save stays manual.
function BookmarkAddDialog({ open, onClose, onAdd, existingGroups }) {
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
    }
  }, [open]);

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const canSubmit = form.group.trim() && form.name.trim() && form.href.trim();

  const submit = (e) => {
    e.preventDefault();
    if (!canSubmit) {
      return;
    }
    onAdd({
      group: form.group.trim(),
      name: form.name.trim(),
      href: form.href.trim(),
      icon: form.icon.trim(),
      abbr: form.abbr.trim(),
      description: form.description.trim(),
    });
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-lg bg-white dark:bg-theme-800 text-theme-800 dark:text-theme-200 shadow-xl">
          <form onSubmit={submit}>
            <DialogTitle className="text-lg font-bold px-5 pt-5">Add Bookmark</DialogTitle>
            <p className="px-5 pt-1 text-xs text-theme-500">
              Generates YAML and inserts it into the editor. You still need to click Save.
            </p>
            <div className="px-5 py-4 flex flex-col gap-3">
              <Field label="Group" required>
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
                Add to editor
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

export default function AdminBookmarksConfig() {
  return (
    <ConfigEditor
      configFile="bookmarks.yaml"
      parse={parseBookmarks}
      Card={BookmarkCard}
      gridClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3"
      AddDialog={BookmarkAddDialog}
      insert={insertBookmark}
      addLabel="Add Bookmark"
    />
  );
}
