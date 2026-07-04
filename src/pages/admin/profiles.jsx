import ConfigEditor, { inputClass } from "components/admin/config-editor";
import { useState } from "react";
import { MdCheck, MdClose, MdDelete, MdEdit } from "react-icons/md";
import { parseProfiles } from "utils/config/layout-preview";
import { deleteProfile, renameProfile, setProfileGroups } from "utils/config/yaml-edit";

// Profile manager rendered inside the ConfigEditor shell (configFile=settings.yaml).
// Profiles are named, reusable group-set presets (`profiles: { <Name>: { groups } }`)
// — independent of tabs/layout. They feed the admin "view as profile" preview
// switcher (M10b) and prefill the group textfield on /admin/users; they don't
// grant access themselves. It edits only the editor text (via setContent);
// Save/Validate/Backup stay manual, same as the rest of the admin editors.
function ProfileManager({ content, setContent, setStatus }) {
  const [newName, setNewName] = useState("");
  const [newGroups, setNewGroups] = useState("");
  const [renaming, setRenaming] = useState(null); // profile currently being renamed
  const [renameValue, setRenameValue] = useState("");
  const [groupsDrafts, setGroupsDrafts] = useState({}); // { [profile]: string } — only mid-edit

  const profiles = parseProfiles(content);
  const profileNames = Object.keys(profiles);

  const apply = (next, message) => {
    setContent(next);
    setStatus({ type: "info", message });
  };
  const fail = (e) => setStatus({ type: "error", message: `Profiles: ${e.message}` });

  const onCreate = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || !newGroups.trim()) return;
    try {
      apply(setProfileGroups(content, { profile: name }, newGroups), `Profil "${name}" angelegt (im Editor) — review and Save.`);
      setNewName("");
      setNewGroups("");
    } catch (e2) {
      fail(e2);
    }
  };

  const startRename = (name) => {
    setRenaming(name);
    setRenameValue(name);
  };

  const submitRename = (e) => {
    e.preventDefault();
    const to = renameValue.trim();
    if (to && to !== renaming) {
      try {
        apply(renameProfile(content, { from: renaming, to }), `Profil "${renaming}" → "${to}" — review and Save.`);
      } catch (err) {
        fail(err);
      }
    }
    setRenaming(null);
  };

  const onDelete = (name) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Profil "${name}" löschen? Zugewiesene User behalten ihre Gruppen unverändert.`)) return;
    try {
      apply(deleteProfile(content, { profile: name }), `Profil "${name}" entfernt — review and Save.`);
    } catch (e) {
      fail(e);
    }
  };

  // Groups draft for a profile: uncommitted typing, or the parsed value.
  const groupsValue = (name) => (groupsDrafts[name] !== undefined ? groupsDrafts[name] : (profiles[name] ?? []).join(", "));

  const onGroupsChange = (name, value) => {
    setGroupsDrafts((prev) => ({ ...prev, [name]: value }));
  };

  // Commit on blur (not on every keystroke), matching the tabs access-groups pattern.
  const commitGroups = (name) => {
    const value = groupsDrafts[name];
    if (value === undefined) return;
    try {
      apply(setProfileGroups(content, { profile: name }, value), `Gruppen für Profil "${name}" aktualisiert (im Editor) — review and Save.`);
    } catch (e) {
      fail(e);
    }
    setGroupsDrafts((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const iconBtn = "rounded p-0.5 text-theme-500 hover:bg-theme-300/40 dark:hover:bg-white/10";

  return (
    <div className="flex flex-col gap-4 text-sm">
      <section>
        <h3 className="font-medium mb-2 text-theme-800 dark:text-theme-200">Neues Profil anlegen</h3>
        <form onSubmit={onCreate} className="flex flex-wrap items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Profil-Name (z.B. Familie)"
            className={`${inputClass} flex-1 min-w-[8rem]`}
          />
          <input
            value={newGroups}
            onChange={(e) => setNewGroups(e.target.value)}
            placeholder="Gruppen, kommagetrennt (z.B. family, kids)"
            className={`${inputClass} flex-1 min-w-[12rem]`}
          />
          <button
            type="submit"
            disabled={!newName.trim() || !newGroups.trim()}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anlegen
          </button>
        </form>
        <p className="mt-1 text-xs text-theme-400">
          Profile sind benannte Gruppen-Sets — praktisch als Vorlage bei der Nutzeranlage (/admin/users) und für die
          "Ansicht als Profil"-Vorschau im Dashboard-Header. Sie vergeben selbst keinen Zugriff.
        </p>
      </section>

      <section>
        <h3 className="font-medium mb-2 text-theme-800 dark:text-theme-200">Profile</h3>
        {profileNames.length === 0 ? (
          <p className="text-theme-500 text-xs">Noch keine Profile.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {profileNames.map((name) => (
              <li key={name} className="flex flex-col gap-1 rounded-md bg-theme-100/40 dark:bg-white/5 px-2 py-1">
                <div className="flex items-center justify-between gap-2">
                  {renaming === name ? (
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
                      <button
                        type="button"
                        onClick={() => setRenaming(null)}
                        title="Abbrechen"
                        aria-label="Cancel rename"
                        className={iconBtn}
                      >
                        <MdClose className="w-4 h-4" />
                      </button>
                    </form>
                  ) : (
                    <>
                      <span className="min-w-0 truncate font-medium">{name}</span>
                      <span className="shrink-0 flex gap-1">
                        <button
                          type="button"
                          onClick={() => startRename(name)}
                          title="Umbenennen"
                          aria-label={`Rename profile ${name}`}
                          className={`${iconBtn} hover:text-theme-700 dark:hover:text-theme-200`}
                        >
                          <MdEdit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(name)}
                          title="Löschen"
                          aria-label={`Delete profile ${name}`}
                          className={`${iconBtn} hover:text-red-600`}
                        >
                          <MdDelete className="w-4 h-4" />
                        </button>
                      </span>
                    </>
                  )}
                </div>
                {renaming !== name && (
                  <div className="flex items-center gap-2 pl-1">
                    <span className="shrink-0 text-theme-500 text-xs">Gruppen</span>
                    <input
                      value={groupsValue(name)}
                      onChange={(e) => onGroupsChange(name, e.target.value)}
                      onBlur={() => commitGroups(name)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                      }}
                      placeholder="family, kids"
                      aria-label={`Groups for profile ${name}`}
                      className={`${inputClass} flex-1 text-xs py-1`}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-xs text-theme-400">
          Leere Gruppen entfernen das Profil wieder. Eine Umbenennung auf einen bestehenden Namen vereinigt beide
          Gruppen-Listen.
        </p>
      </section>
    </div>
  );
}

export default function AdminProfilesConfig() {
  return <ConfigEditor configFile="settings.yaml" title="Profiles" parse={() => []} PreviewPanel={ProfileManager} />;
}
