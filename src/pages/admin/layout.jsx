import ConfigEditor, { inputClass } from "components/admin/config-editor";
import { useEffect, useMemo, useState } from "react";
import { MdCheck, MdClose, MdDelete, MdEdit } from "react-icons/md";
import {
  assignGroupToTab,
  deleteSetting,
  deleteTab,
  renameTab,
  setGroupLayoutField,
  updateSetting,
} from "utils/config/yaml-edit";
import { groupNamesFromRaw, parseGlobalLayout, parseLayout } from "utils/config/layout-preview";

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
  const optsByGroup = useMemo(() => new Map(layout.map((e) => [e.group, e])), [layout]);
  const tabs = useMemo(() => [...new Set(layout.map((e) => e.tab).filter(Boolean))], [layout]);
  const allGroups = useMemo(() => {
    const set = new Set(groupNames);
    layout.forEach((e) => set.add(e.group));
    return [...set];
  }, [groupNames, layout]);
  const global = useMemo(() => parseGlobalLayout(content), [content]);
  const maxColsValue = global.fiveColumns ? "5" : global.maxGroupColumns != null ? String(global.maxGroupColumns) : "";

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

  // Per-group layout option (style/columns/header/…). "" clears the field.
  const onSetField = (group, field, value) => {
    try {
      apply(setGroupLayoutField(content, { group, field }, value), `"${group}" aktualisiert (im Editor) — review and Save.`);
    } catch (e) {
      fail(e);
    }
  };

  // Style is special: leaving "row" also clears the now-meaningless `columns`.
  const onSetStyle = (group, value) => {
    try {
      let next = setGroupLayoutField(content, { group, field: "style" }, value);
      if (value !== "row") {
        next = setGroupLayoutField(next, { group, field: "columns" }, "");
      }
      apply(next, `"${group}" aktualisiert (im Editor) — review and Save.`);
    } catch (e) {
      fail(e);
    }
  };

  // Global "groups side by side" (maxGroupColumns 4–8). "" = back to default.
  // Always clears `fiveColumns` so it can't silently override the chosen value.
  const onSetMaxCols = (value) => {
    try {
      let next = content;
      if (parseGlobalLayout(next).fiveColumns !== undefined) {
        next = deleteSetting(next, { key: "fiveColumns" });
      }
      if (value === "") {
        if (parseGlobalLayout(next).maxGroupColumns !== undefined) {
          next = deleteSetting(next, { key: "maxGroupColumns" });
        }
      } else {
        next = updateSetting(next, { key: "maxGroupColumns" }, Number(value));
      }
      apply(next, `Max. Gruppen nebeneinander: ${value || "Standard (4)"} — review and Save.`);
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
        <h3 className="font-medium mb-2 text-theme-800 dark:text-theme-200">Gruppen-Anordnung</h3>
        <label className="flex items-center gap-2">
          <span className="min-w-0">Max. Gruppen nebeneinander</span>
          <select
            aria-label="Max. Gruppen nebeneinander (maxGroupColumns)"
            value={maxColsValue}
            onChange={(e) => onSetMaxCols(e.target.value)}
            className={`${inputClass} max-w-[10rem]`}
          >
            <option value="">Standard (4)</option>
            <option value="5">5</option>
            <option value="6">6</option>
            <option value="7">7</option>
            <option value="8">8</option>
          </select>
        </label>
        <p className="mt-1 text-xs text-theme-400">
          Gilt global (4–8). Weniger als 4 nebeneinander ist nicht global einstellbar — dafür eine Gruppe unten auf
          „nebeneinander (volle Breite)" stellen.
        </p>
      </section>

      <section>
        <h3 className="font-medium mb-2 text-theme-800 dark:text-theme-200">Gruppen-Anzeige</h3>
        {allGroups.length === 0 ? (
          <p className="text-theme-500 text-xs">Keine Gruppen in services.yaml / bookmarks.yaml gefunden.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {allGroups.map((group) => {
              const opts = optsByGroup.get(group) ?? {};
              const isRow = opts.style === "row";
              return (
                <li
                  key={group}
                  className="flex flex-col gap-2 rounded-md border border-theme-200 dark:border-theme-700 p-2"
                >
                  <span className="font-medium min-w-0 truncate">{group}</span>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <label className="flex items-center gap-1">
                      <span className="text-theme-500 text-xs">Tab</span>
                      <select
                        aria-label={`Tab für ${group}`}
                        value={tabByGroup.get(group) ?? ""}
                        onChange={(e) => onAssign(group, e.target.value)}
                        className={`${inputClass} max-w-[9rem]`}
                      >
                        <option value="">— kein Tab —</option>
                        {tabs.map((tab) => (
                          <option key={tab} value={tab}>
                            {tab}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-1">
                      <span className="text-theme-500 text-xs">Ausrichtung</span>
                      <select
                        aria-label={`Ausrichtung für ${group}`}
                        value={isRow ? "row" : ""}
                        onChange={(e) => onSetStyle(group, e.target.value)}
                        className={`${inputClass} max-w-[11rem]`}
                      >
                        <option value="">untereinander (Default)</option>
                        <option value="row">nebeneinander (volle Breite)</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-1">
                      <span className="text-theme-500 text-xs">Services/Reihe</span>
                      <select
                        aria-label={`Services pro Reihe für ${group}`}
                        value={opts.columns != null ? String(opts.columns) : ""}
                        disabled={!isRow}
                        onChange={(e) => onSetField(group, "columns", e.target.value === "" ? "" : Number(e.target.value))}
                        className={`${inputClass} max-w-[7rem] disabled:opacity-50`}
                      >
                        <option value="">Auto</option>
                        {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={opts.header !== false}
                        onChange={(e) => onSetField(group, "header", e.target.checked ? "" : false)}
                      />
                      Überschrift anzeigen
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={opts.initiallyCollapsed === true}
                        onChange={(e) => onSetField(group, "initiallyCollapsed", e.target.checked ? true : "")}
                      />
                      eingeklappt starten
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={opts.useEqualHeights === true}
                        onChange={(e) => onSetField(group, "useEqualHeights", e.target.checked ? true : "")}
                      />
                      gleiche Höhen
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function AdminLayoutConfig() {
  return <ConfigEditor configFile="settings.yaml" title="Layout & Tabs" parse={() => []} PreviewPanel={LayoutManager} />;
}
