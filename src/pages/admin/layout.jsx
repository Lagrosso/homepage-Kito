import ConfigEditor, { inputClass } from "components/admin/config-editor";
import { useEffect, useMemo, useState } from "react";
import { MdCheck, MdClose, MdDelete, MdEdit } from "react-icons/md";
import { assignGroupToTab, deleteTab, renameTab } from "utils/config/yaml-edit";
import { groupNamesFromRaw, parseLayout } from "utils/config/layout-preview";

// Tab/layout manager rendered inside the ConfigEditor shell (configFile=settings.yaml).
// It edits only the editor text (via setContent); Save/Validate/Backup stay manual.
// Tabs are derived from settings.yaml `layout[group].tab`; group names come from
// services.yaml + bookmarks.yaml (read-only, cross-file). All input is inline —
// window.prompt() is not supported by the Next.js dev runtime.
function LayoutManager({ content, setContent, setStatus }) {
  const [groupNames, setGroupNames] = useState([]);
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [renaming, setRenaming] = useState(null); // tab currently being renamed
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      ["services.yaml", "bookmarks.yaml"].map((file) =>
        fetch(`/api/config/raw/${file}`)
          .then((r) => (r.ok ? r.json() : { content: "" }))
          .catch(() => ({ content: "" })),
      ),
    ).then((results) => {
      if (cancelled) return;
      const names = results.flatMap((d) => groupNamesFromRaw(d?.content ?? ""));
      setGroupNames([...new Set(names)]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const layout = useMemo(() => parseLayout(content), [content]);
  const tabByGroup = useMemo(() => new Map(layout.map((e) => [e.group, e.tab])), [layout]);
  const tabs = useMemo(() => [...new Set(layout.map((e) => e.tab).filter(Boolean))], [layout]);
  const allGroups = useMemo(() => {
    const set = new Set(groupNames);
    layout.forEach((e) => set.add(e.group));
    return [...set];
  }, [groupNames, layout]);

  const apply = (next, message) => {
    setContent(next);
    setStatus({ type: "info", message });
  };
  const fail = (e) => setStatus({ type: "error", message: `Layout: ${e.message}` });

  const onAssign = (group, tab) => {
    try {
      apply(assignGroupToTab(content, { group, tab }), `"${group}" → ${tab || "kein Tab"} (im Editor) — review and Save.`);
    } catch (e) {
      fail(e);
    }
  };

  const onCreateTab = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || !newGroup) return;
    onAssign(newGroup, name);
    setNewName("");
    setNewGroup("");
  };

  const startRename = (tab) => {
    setRenaming(tab);
    setRenameValue(tab);
  };

  const submitRename = (e) => {
    e.preventDefault();
    const to = renameValue.trim();
    if (to && to !== renaming) {
      try {
        apply(renameTab(content, { from: renaming, to }), `Tab "${renaming}" → "${to}" — review and Save.`);
      } catch (err) {
        fail(err);
      }
    }
    setRenaming(null);
  };

  const onDelete = (tab) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Tab "${tab}" entfernen? Die zugewiesenen Gruppen bleiben erhalten (Default-Ansicht).`)) return;
    try {
      apply(deleteTab(content, { tab }), `Tab "${tab}" entfernt — review and Save.`);
    } catch (e) {
      fail(e);
    }
  };

  const iconBtn = "rounded p-0.5 text-theme-500 hover:bg-theme-300/40 dark:hover:bg-white/10";

  return (
    <div className="flex flex-col gap-4 text-sm">
      <section>
        <h3 className="font-medium mb-2 text-theme-800 dark:text-theme-200">Neuen Tab anlegen</h3>
        <form onSubmit={onCreateTab} className="flex flex-wrap items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Tab-Name"
            className={`${inputClass} flex-1 min-w-[8rem]`}
          />
          <select value={newGroup} onChange={(e) => setNewGroup(e.target.value)} className={`${inputClass} flex-1 min-w-[8rem]`}>
            <option value="">Gruppe wählen…</option>
            {allGroups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!newName.trim() || !newGroup}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anlegen
          </button>
        </form>
        <p className="mt-1 text-xs text-theme-400">Ein Tab erscheint, sobald ihm mindestens eine Gruppe zugewiesen ist.</p>
      </section>

      <section>
        <h3 className="font-medium mb-2 text-theme-800 dark:text-theme-200">Tabs</h3>
        {tabs.length === 0 ? (
          <p className="text-theme-500 text-xs">Noch keine Tabs.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {tabs.map((tab) => (
              <li
                key={tab}
                className="flex items-center justify-between gap-2 rounded-md bg-theme-100/40 dark:bg-white/5 px-2 py-1"
              >
                {renaming === tab ? (
                  <form onSubmit={submitRename} className="flex items-center gap-1 w-full">
                    <input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      // eslint-disable-next-line jsx-a11y/no-autofocus
                      autoFocus
                      className={`${inputClass} flex-1`}
                    />
                    <button type="submit" title="Speichern" aria-label="Save rename" className={iconBtn}>
                      <MdCheck className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => setRenaming(null)} title="Abbrechen" aria-label="Cancel rename" className={iconBtn}>
                      <MdClose className="w-4 h-4" />
                    </button>
                  </form>
                ) : (
                  <>
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{tab}</span>
                      <span className="ml-2 text-theme-500 text-xs">
                        {layout.filter((e) => e.tab === tab).map((e) => e.group).join(", ") || "—"}
                      </span>
                    </span>
                    <span className="shrink-0 flex gap-1">
                      <button
                        type="button"
                        onClick={() => startRename(tab)}
                        title="Umbenennen"
                        aria-label={`Rename tab ${tab}`}
                        className={`${iconBtn} hover:text-theme-700 dark:hover:text-theme-200`}
                      >
                        <MdEdit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(tab)}
                        title="Löschen"
                        aria-label={`Delete tab ${tab}`}
                        className={`${iconBtn} hover:text-red-600`}
                      >
                        <MdDelete className="w-4 h-4" />
                      </button>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="font-medium mb-2 text-theme-800 dark:text-theme-200">Gruppen zuordnen</h3>
        {allGroups.length === 0 ? (
          <p className="text-theme-500 text-xs">Keine Gruppen in services.yaml / bookmarks.yaml gefunden.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {allGroups.map((group) => (
              <li key={group} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">{group}</span>
                <select
                  aria-label={`Tab für ${group}`}
                  value={tabByGroup.get(group) ?? ""}
                  onChange={(e) => onAssign(group, e.target.value)}
                  className={`${inputClass} max-w-[55%]`}
                >
                  <option value="">— kein Tab (Default) —</option>
                  {tabs.map((tab) => (
                    <option key={tab} value={tab}>
                      {tab}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function AdminLayoutConfig() {
  return <ConfigEditor configFile="settings.yaml" title="Layout & Tabs" parse={() => []} PreviewPanel={LayoutManager} />;
}
