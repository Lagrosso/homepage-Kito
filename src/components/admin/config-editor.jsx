import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import LogoutButton from "components/admin/logout-button";
import yaml from "js-yaml";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MdDragIndicator, MdHome, MdKeyboardArrowDown, MdKeyboardArrowUp } from "react-icons/md";
import { hasBarePlaceholder } from "utils/config/yaml-edit";

// Tabs shown in the editor header so the config pages cross-link. The active tab
// is matched by route (href), so /admin/layout and /admin/settings stay distinct
// even though both edit settings.yaml. Exported so standalone pages (e.g. /admin/theme)
// can render the same nav without duplicating the list.
export const CONFIG_TABS = [
  { label: "Services", href: "/admin/config" },
  { label: "Bookmarks", href: "/admin/bookmarks" },
  { label: "Widgets", href: "/admin/widgets" },
  { label: "Settings", href: "/admin/settings" },
  { label: "Layout", href: "/admin/layout" },
  { label: "Theme", href: "/admin/theme" },
];

// Parse a YAML error into a readable line/column message. Shared by every
// config editor (services, bookmarks, …).
export function describeYamlError(e) {
  const where = e?.mark ? ` (line ${e.mark.line + 1}, column ${e.mark.column + 1})` : "";
  return `${e?.reason || e?.message || "Invalid YAML"}${where}`;
}

// Shorten a long URL for display while keeping its recognizable parts.
export function shortenUrl(url) {
  if (typeof url !== "string") {
    return "";
  }
  const stripped = url.replace(/^https?:\/\//, "");
  if (stripped.length <= 38) {
    return stripped;
  }
  return `${stripped.slice(0, 35)}…`;
}

export const inputClass =
  "w-full rounded-md border border-theme-300 dark:border-theme-700 bg-white dark:bg-theme-900 px-3 py-2 text-sm";

// Labelled form field used inside the quick-add dialogs.
export function Field({ label, required, children }) {
  return (
    <label className="block text-sm">
      <span className="block font-medium mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

// Small up/down arrow button used by the reorder controls.
function MoveBtn({ dir, disabled, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="rounded p-0.5 text-theme-500 enabled:hover:text-theme-700 enabled:dark:hover:text-theme-200 enabled:hover:bg-theme-300/40 enabled:dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {dir === "up" ? <MdKeyboardArrowUp className="w-4 h-4" /> : <MdKeyboardArrowDown className="w-4 h-4" />}
    </button>
  );
}

function Preview({ content, parse, Card, gridClassName, onEdit, onDelete, onMoveEntry, onMoveGroup, onMoveToGroup }) {
  const result = useMemo(() => {
    try {
      return { groups: parse(content), error: null };
    } catch (e) {
      return { groups: [], error: describeYamlError(e) };
    }
  }, [content, parse]);

  if (result.error) {
    return <p className="text-sm text-red-500">Preview unavailable: {result.error}</p>;
  }
  if (result.groups.length === 0) {
    return <p className="text-sm text-theme-500">No groups found.</p>;
  }

  const groupNames = result.groups.map((g) => g.name);

  return (
    <div className="flex flex-col gap-5">
      {result.groups.map((group, gi) => (
        <section key={group.name}>
          <div className="flex items-center gap-1 pb-2 mb-2 border-b border-theme-300 dark:border-theme-700">
            <h3 className="flex-1 min-w-0 truncate text-theme-800 dark:text-theme-200 text-sm font-medium">
              {group.name}
            </h3>
            {onMoveGroup && (
              <>
                <MoveBtn
                  dir="up"
                  disabled={gi === 0}
                  onClick={() => onMoveGroup(group.name, "up")}
                  label={`Move group ${group.name} up`}
                />
                <MoveBtn
                  dir="down"
                  disabled={gi === result.groups.length - 1}
                  onClick={() => onMoveGroup(group.name, "down")}
                  label={`Move group ${group.name} down`}
                />
              </>
            )}
          </div>
          <div className={gridClassName}>
            {group.entries.map((entry, ei) => (
              <div key={entry.name}>
                <Card
                  entry={entry}
                  group={group.name}
                  onEdit={onEdit ? () => onEdit(group.name, entry) : undefined}
                  onDelete={onDelete ? () => onDelete(group.name, entry) : undefined}
                />
                {(onMoveEntry || onMoveToGroup) && (
                  <div className="flex items-center gap-1 -mt-1 mb-2 pl-1">
                    {onMoveEntry && (
                      <>
                        <MoveBtn
                          dir="up"
                          disabled={ei === 0}
                          onClick={() => onMoveEntry(group.name, entry, "up")}
                          label={`Move ${entry.name} up`}
                        />
                        <MoveBtn
                          dir="down"
                          disabled={ei === group.entries.length - 1}
                          onClick={() => onMoveEntry(group.name, entry, "down")}
                          label={`Move ${entry.name} down`}
                        />
                      </>
                    )}
                    {onMoveToGroup && groupNames.length > 1 && (
                      <select
                        aria-label={`Move ${entry.name} to another group`}
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            onMoveToGroup(group.name, entry, e.target.value);
                          }
                        }}
                        className="ml-1 rounded border border-theme-300 dark:border-theme-700 bg-white dark:bg-theme-800 text-xs px-1 py-0.5 text-theme-600 dark:text-theme-300"
                      >
                        <option value="">→ Gruppe…</option>
                        {groupNames
                          .filter((g) => g !== group.name)
                          .map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          {group.entries.length === 0 && <p className="text-sm text-theme-500">No entries.</p>}
        </section>
      ))}
    </div>
  );
}

// --- drag & drop preview (M5d) --------------------------------------------
// Stable positional ids: "g:<gi>" for a group section, "e:<gi>:<ei>" for an
// entry card. Parsing them back gives the indices to mutate via the index-based
// yaml-edit helpers. DnD mutates the editor text only; Save stays manual.
function parseDndId(id) {
  const [type, gi, ei] = String(id).split(":");
  return { type, gi: Number(gi), ei: ei === undefined ? undefined : Number(ei) };
}

function DragHandle({ attributes, listeners, label }) {
  return (
    <button
      type="button"
      {...attributes}
      {...listeners}
      aria-label={label}
      title={label}
      className="cursor-grab touch-none rounded p-0.5 text-theme-400 hover:text-theme-600 dark:hover:text-theme-200 hover:bg-theme-300/40 dark:hover:bg-white/10"
    >
      <MdDragIndicator className="w-4 h-4" />
    </button>
  );
}

function SortableEntryCard({
  id,
  group,
  entry,
  ei,
  count,
  Card,
  onEdit,
  onDelete,
  onMoveEntry,
  onMoveToGroup,
  groupNames,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : undefined };
  return (
    <div ref={setNodeRef} style={style}>
      <Card
        entry={entry}
        group={group}
        onEdit={onEdit ? () => onEdit(group, entry) : undefined}
        onDelete={onDelete ? () => onDelete(group, entry) : undefined}
      />
      <div className="flex items-center gap-1 -mt-1 mb-2 pl-1">
        <DragHandle attributes={attributes} listeners={listeners} label={`Drag ${entry.name}`} />
        {onMoveEntry && (
          <>
            <MoveBtn
              dir="up"
              disabled={ei === 0}
              onClick={() => onMoveEntry(group, entry, "up")}
              label={`Move ${entry.name} up`}
            />
            <MoveBtn
              dir="down"
              disabled={ei === count - 1}
              onClick={() => onMoveEntry(group, entry, "down")}
              label={`Move ${entry.name} down`}
            />
          </>
        )}
        {onMoveToGroup && groupNames.length > 1 && (
          <select
            aria-label={`Move ${entry.name} to another group`}
            value=""
            onChange={(e) => {
              if (e.target.value) {
                onMoveToGroup(group, entry, e.target.value);
              }
            }}
            className="ml-1 rounded border border-theme-300 dark:border-theme-700 bg-white dark:bg-theme-800 text-xs px-1 py-0.5 text-theme-600 dark:text-theme-300"
          >
            <option value="">→ Gruppe…</option>
            {groupNames
              .filter((g) => g !== group)
              .map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
          </select>
        )}
      </div>
    </div>
  );
}

function SortableGroupSection({ gi, group, count, onMoveGroup, canDragGroup, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `g:${gi}` });
  const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : undefined };
  return (
    <section ref={setNodeRef} style={style}>
      <div className="flex items-center gap-1 pb-2 mb-2 border-b border-theme-300 dark:border-theme-700">
        {canDragGroup && <DragHandle attributes={attributes} listeners={listeners} label={`Drag group ${group}`} />}
        <h3 className="flex-1 min-w-0 truncate text-theme-800 dark:text-theme-200 text-sm font-medium">{group}</h3>
        {onMoveGroup && (
          <>
            <MoveBtn
              dir="up"
              disabled={gi === 0}
              onClick={() => onMoveGroup(group, "up")}
              label={`Move group ${group} up`}
            />
            <MoveBtn
              dir="down"
              disabled={gi === count - 1}
              onClick={() => onMoveGroup(group, "down")}
              label={`Move group ${group} down`}
            />
          </>
        )}
      </div>
      {children}
    </section>
  );
}

// Card preview with drag & drop (used when index-based reorder handlers are
// wired). Mirrors Preview's layout/controls and adds drag handles; the existing
// up/down buttons stay as the accessible fallback.
function DndPreview({
  content,
  parse,
  Card,
  gridClassName,
  onEdit,
  onDelete,
  onMoveEntry,
  onMoveGroup,
  onMoveToGroup,
  onDnd,
  canDragGroup,
}) {
  const [activeLabel, setActiveLabel] = useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const result = useMemo(() => {
    try {
      return { groups: parse(content), error: null };
    } catch (e) {
      return { groups: [], error: describeYamlError(e) };
    }
  }, [content, parse]);

  if (result.error) {
    return <p className="text-sm text-red-500">Preview unavailable: {result.error}</p>;
  }
  if (result.groups.length === 0) {
    return <p className="text-sm text-theme-500">No groups found.</p>;
  }

  const groups = result.groups;
  const groupNames = groups.map((g) => g.name);
  const groupIds = groups.map((_, gi) => `g:${gi}`);

  const onDragStart = ({ active }) => {
    const a = parseDndId(active.id);
    setActiveLabel(a.type === "g" ? groups[a.gi]?.name : groups[a.gi]?.entries[a.ei]?.name);
  };

  const onDragEnd = ({ active, over }) => {
    setActiveLabel(null);
    if (!over || active.id === over.id) {
      return;
    }
    const a = parseDndId(active.id);
    const o = parseDndId(over.id);
    if (a.type === "g") {
      onDnd({ kind: "group", group: groups[a.gi].name, toIndex: o.gi });
      return;
    }
    const fromGroup = groups[a.gi].name;
    const entry = groups[a.gi].entries[a.ei];
    if (o.type === "e") {
      if (a.gi === o.gi) {
        onDnd({ kind: "entry", group: fromGroup, entry, toIndex: o.ei });
      } else {
        onDnd({ kind: "entryToGroup", fromGroup, entry, toGroup: groups[o.gi].name, toIndex: o.ei });
      }
    } else if (a.gi !== o.gi) {
      onDnd({ kind: "entryToGroup", fromGroup, entry, toGroup: groups[o.gi].name }); // dropped on group → append
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <SortableContext items={groupIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-5">
          {groups.map((group, gi) => (
            <SortableGroupSection
              key={group.name}
              gi={gi}
              group={group.name}
              count={groups.length}
              onMoveGroup={onMoveGroup}
              canDragGroup={canDragGroup}
            >
              <SortableContext items={group.entries.map((_, ei) => `e:${gi}:${ei}`)} strategy={rectSortingStrategy}>
                <div className={gridClassName}>
                  {group.entries.map((entry, ei) => (
                    <SortableEntryCard
                      key={entry.name}
                      id={`e:${gi}:${ei}`}
                      group={group.name}
                      entry={entry}
                      ei={ei}
                      count={group.entries.length}
                      Card={Card}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onMoveEntry={onMoveEntry}
                      onMoveToGroup={onMoveToGroup}
                      groupNames={groupNames}
                    />
                  ))}
                </div>
              </SortableContext>
              {group.entries.length === 0 && <p className="text-sm text-theme-500">No entries.</p>}
            </SortableGroupSection>
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeLabel ? (
          <div className="rounded-md bg-blue-600 text-white text-sm px-3 py-1 shadow-lg">{activeLabel}</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// Generic hybrid config editor: raw YAML editor + read-only card preview,
// validation, role-gated save, backup-aware status, and a quick-add dialog.
// All file-specific behavior is injected via props.
export default function ConfigEditor({
  configFile,
  title = "Config Editor",
  parse,
  Card,
  gridClassName = "grid grid-cols-1 sm:grid-cols-2 gap-x-3",
  AddDialog = null,
  insert = null,
  addLabel = "Add",
  EditDialog = null,
  editEntry = null,
  deleteEntry = null,
  reorderEntry = null,
  reorderGroup = null,
  moveToGroup = null,
  reorderEntryTo = null,
  reorderGroupTo = null,
  PreviewPanel = null,
}) {
  const router = useRouter();
  // Quick-add is optional: a config (e.g. widgets.yaml) may ship preview-only.
  const canAdd = Boolean(AddDialog && insert);
  // Structured edit/delete are opt-in per config file (services.yaml first).
  const canEdit = Boolean(EditDialog && editEntry);
  const canDelete = Boolean(deleteEntry);
  // Reordering/moving is opt-in too (M5c).
  const canMove = Boolean(reorderEntry);
  const canMoveGroup = Boolean(reorderGroup);
  const canMoveToGroup = Boolean(moveToGroup);
  // Drag & drop (M5d) is opt-in via the index-based handlers.
  const canDnd = Boolean(reorderEntryTo || reorderGroupTo);
  const apiUrl = `/api/config/raw/${configFile}`;
  const [content, setContent] = useState("");
  const [authState, setAuthState] = useState("checking"); // checking | admin | denied
  const [currentUser, setCurrentUser] = useState(null);
  const [loadState, setLoadState] = useState("loading"); // loading | ready | disabled | error
  const [status, setStatus] = useState(null); // { type: "success"|"error"|"info", message }
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // { group, entry } | null

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then(async (res) => {
        if (res.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(router.asPath || "/admin/config")}`);
          return;
        }
        if (!res.ok) {
          throw new Error(`Failed to check session (${res.status})`);
        }
        const data = await res.json();
        if (data?.user?.role !== "admin") {
          if (!cancelled) {
            setAuthState("denied");
          }
          router.replace("/");
          return;
        }
        if (!cancelled) {
          setCurrentUser(data.user);
          setAuthState("admin");
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setAuthState("denied");
          setLoadState("error");
          setStatus({ type: "error", message: e.message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (authState !== "admin") {
      return;
    }
    fetch(apiUrl)
      .then(async (res) => {
        if (res.status === 401) {
          throw new Error("Please log in again.");
        }
        if (res.status === 403) {
          throw new Error("Admin role required.");
        }
        if (!res.ok) {
          throw new Error(`Failed to load config (${res.status})`);
        }
        const data = await res.json();
        setContent(data.content ?? "");
        setLoadState("ready");
      })
      .catch((e) => {
        setLoadState("error");
        setStatus({ type: "error", message: e.message });
      });
  }, [apiUrl, authState]);

  // Group names for the quick-add datalist (best-effort; ignores parse errors).
  const existingGroups = useMemo(() => {
    try {
      return parse(content).map((g) => g.name);
    } catch {
      return [];
    }
  }, [content, parse]);

  // Structured edit/delete can't round-trip a file with bare unquoted
  // {{HOMEPAGE_*}} placeholders, so disable those actions and explain why.
  const placeholderBlocked = useMemo(() => hasBarePlaceholder(content), [content]);
  const showEdit = canEdit && !placeholderBlocked;
  const showDelete = canDelete && !placeholderBlocked;
  const showMove = canMove && !placeholderBlocked;
  const showMoveGroup = canMoveGroup && !placeholderBlocked;
  const showMoveToGroup = canMoveToGroup && !placeholderBlocked;

  const onValidate = useCallback(() => {
    try {
      yaml.load(content);
      setStatus({ type: "success", message: "YAML is valid." });
    } catch (e) {
      setStatus({ type: "error", message: describeYamlError(e) });
    }
  }, [content]);

  const onAdd = useCallback(
    (values) => {
      setContent((prev) => insert(prev, values));
      setModalOpen(false);
      setStatus({ type: "info", message: `Added "${values.name}" to the editor — review and Save.` });
    },
    [insert],
  );

  // Structured edit: mutate the raw YAML text only (never disk); Save stays manual.
  const onEditEntry = useCallback((group, entry) => setEditTarget({ group, entry }), []);

  const onSubmitEdit = useCallback(
    (values) => {
      try {
        const next = editEntry(
          content,
          { group: editTarget.group, name: editTarget.entry.name, entry: editTarget.entry },
          values,
        );
        setContent(next);
        setStatus({
          type: "info",
          message: `Updated "${values.name || editTarget.entry.name}" in the editor — review and Save.`,
        });
        setEditTarget(null);
      } catch (e) {
        setStatus({ type: "error", message: `Edit failed — ${e.message}` });
      }
    },
    [content, editEntry, editTarget],
  );

  const onDeleteEntry = useCallback(
    (group, entry) => {
      // eslint-disable-next-line no-alert
      if (!window.confirm(`Remove "${entry.name}" from "${group}"? Review the editor, then Save to apply.`)) {
        return;
      }
      try {
        const next = deleteEntry(content, { group, name: entry.name, entry });
        setContent(next);
        setStatus({ type: "info", message: `Removed "${entry.name}" from the editor — review and Save.` });
      } catch (e) {
        setStatus({ type: "error", message: `Delete failed — ${e.message}` });
      }
    },
    [content, deleteEntry],
  );

  // Reorder / move: mutate the editor text only; Save stays manual.
  const onMoveEntry = useCallback(
    (group, entry, direction) => {
      try {
        setContent(reorderEntry(content, { group, name: entry.name, entry }, direction));
      } catch (e) {
        setStatus({ type: "error", message: `Move failed — ${e.message}` });
      }
    },
    [content, reorderEntry],
  );

  const onMoveGroup = useCallback(
    (group, direction) => {
      try {
        setContent(reorderGroup(content, { group }, direction));
      } catch (e) {
        setStatus({ type: "error", message: `Move failed — ${e.message}` });
      }
    },
    [content, reorderGroup],
  );

  const onMoveToGroup = useCallback(
    (group, entry, toGroup) => {
      try {
        setContent(moveToGroup(content, { fromGroup: group, entry, toGroup }));
        setStatus({ type: "info", message: `Moved "${entry.name}" to "${toGroup}" — review and Save.` });
      } catch (e) {
        setStatus({ type: "error", message: `Move failed — ${e.message}` });
      }
    },
    [content, moveToGroup],
  );

  // Drag & drop: route the normalized move to the index-based helpers (editor only).
  const onDnd = useCallback(
    (move) => {
      try {
        if (move.kind === "group" && reorderGroupTo) {
          setContent(reorderGroupTo(content, { group: move.group }, move.toIndex));
        } else if (move.kind === "entry" && reorderEntryTo) {
          setContent(
            reorderEntryTo(content, { group: move.group, name: move.entry.name, entry: move.entry }, move.toIndex),
          );
        } else if (move.kind === "entryToGroup" && moveToGroup) {
          setContent(
            moveToGroup(content, {
              fromGroup: move.fromGroup,
              entry: move.entry,
              toGroup: move.toGroup,
              toIndex: move.toIndex,
            }),
          );
          setStatus({ type: "info", message: `Moved "${move.entry.name}" to "${move.toGroup}" — review and Save.` });
        }
      } catch (e) {
        setStatus({ type: "error", message: `Move failed — ${e.message}` });
      }
    },
    [content, reorderEntryTo, reorderGroupTo, moveToGroup],
  );

  const onSave = useCallback(async () => {
    // Validate client-side first for fast feedback; the server validates again.
    try {
      yaml.load(content);
    } catch (e) {
      setStatus({ type: "error", message: `Not saved — ${describeYamlError(e)}` });
      return;
    }

    setStatus({ type: "info", message: "Saving…" });
    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data.detail
          ? `${data.detail.message}${data.detail.line ? ` (line ${data.detail.line}, column ${data.detail.column})` : ""}`
          : res.status === 401
            ? "Please log in again."
            : res.status === 403
              ? "Admin role required."
              : data.error;
        setStatus({ type: "error", message: `Not saved — ${detail || `error ${res.status}`}` });
        return;
      }
      setStatus({
        type: "success",
        message: data.backupPath ? `Saved. Backup: ${data.backupPath}` : "Saved (no previous file to back up).",
      });
    } catch (e) {
      setStatus({ type: "error", message: `Not saved — ${e.message}` });
    }
  }, [apiUrl, content]);

  const statusColor =
    status?.type === "error" ? "text-red-500" : status?.type === "success" ? "text-green-600" : "text-theme-500";

  return (
    <>
      <Head>
        <title>{`Homepage - ${title}`}</title>
      </Head>
      <div className="min-h-screen bg-theme-50 dark:bg-theme-900 text-theme-900 dark:text-theme-100">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-theme-200 dark:border-theme-700 bg-white dark:bg-theme-900">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              aria-label="Dashboard"
              className="flex items-center gap-1 text-theme-500 hover:text-theme-700 dark:hover:text-theme-200"
            >
              <MdHome className="w-5 h-5" />
            </Link>
            <span className="text-theme-300 dark:text-theme-600">/</span>
            <span className="text-sm font-medium">{title}</span>
            {currentUser && (
              <span className="hidden sm:inline text-xs text-theme-400 ml-2">({currentUser.username})</span>
            )}
          </div>
          <LogoutButton />
        </header>

        {/* Nav tabs */}
        <nav className="flex overflow-x-auto border-b border-theme-200 dark:border-theme-700 bg-white dark:bg-theme-900 px-2">
          {CONFIG_TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab.href === router.pathname
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-theme-500 dark:text-theme-400 hover:text-theme-700 dark:hover:text-theme-200"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <div className="mx-auto max-w-6xl px-4 py-6">
          <p className="text-sm text-theme-500 mb-4">Editing {configFile}</p>

          {(authState === "checking" || loadState === "loading") && <p className="text-sm text-theme-500">Loading…</p>}

          {authState === "denied" && loadState !== "error" && (
            <p className="text-sm text-theme-500">Redirecting to a page available for your role…</p>
          )}

          {authState === "admin" && loadState === "ready" && (
            <>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <button
                  type="button"
                  onClick={onValidate}
                  className="rounded-md bg-theme-200 dark:bg-theme-700 px-4 py-2 text-sm font-medium hover:bg-theme-300 dark:hover:bg-theme-600"
                >
                  Validate
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Save
                </button>
                {status && <span className={`text-sm ${statusColor}`}>{status.message}</span>}
              </div>

              {(canEdit || canDelete || canMove) && placeholderBlocked && (
                <div className="mb-3 rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950 p-3 text-xs">
                  Structured edit/delete is disabled because this file contains an unquoted{" "}
                  <code>{"{{HOMEPAGE_*}}"}</code> placeholder (it can&apos;t be round-tripped safely). Use the raw YAML
                  editor below, or quote the placeholder.
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="yaml-editor" className="block text-sm font-medium">
                      YAML
                    </label>
                    {canAdd && (
                      <button
                        type="button"
                        onClick={() => setModalOpen(true)}
                        className="rounded-md bg-theme-200 dark:bg-theme-700 px-3 py-1 text-xs font-medium hover:bg-theme-300 dark:hover:bg-theme-600"
                      >
                        + {addLabel}
                      </button>
                    )}
                  </div>
                  <textarea
                    id="yaml-editor"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    spellCheck={false}
                    className="w-full h-[60vh] font-mono text-sm rounded-md border border-theme-300 dark:border-theme-700 bg-white dark:bg-theme-800 p-3 resize-y"
                  />
                </div>
                <div>
                  <span className="block text-sm font-medium mb-1">
                    {PreviewPanel ? "Tabs & Layout" : "Preview (read-only)"}
                  </span>
                  <div className="h-[60vh] overflow-auto rounded-md border border-theme-300 dark:border-theme-700 bg-theme-100/40 dark:bg-theme-800 p-3">
                    {PreviewPanel ? (
                      <PreviewPanel content={content} setContent={setContent} setStatus={setStatus} />
                    ) : canDnd && !placeholderBlocked ? (
                      <DndPreview
                        content={content}
                        parse={parse}
                        Card={Card}
                        gridClassName={gridClassName}
                        onEdit={showEdit ? onEditEntry : undefined}
                        onDelete={showDelete ? onDeleteEntry : undefined}
                        onMoveEntry={showMove ? onMoveEntry : undefined}
                        onMoveGroup={showMoveGroup ? onMoveGroup : undefined}
                        onMoveToGroup={showMoveToGroup ? onMoveToGroup : undefined}
                        onDnd={onDnd}
                        canDragGroup={Boolean(reorderGroupTo) && !placeholderBlocked}
                      />
                    ) : (
                      <Preview
                        content={content}
                        parse={parse}
                        Card={Card}
                        gridClassName={gridClassName}
                        onEdit={showEdit ? onEditEntry : undefined}
                        onDelete={showDelete ? onDeleteEntry : undefined}
                        onMoveEntry={showMove ? onMoveEntry : undefined}
                        onMoveGroup={showMoveGroup ? onMoveGroup : undefined}
                        onMoveToGroup={showMoveToGroup ? onMoveToGroup : undefined}
                      />
                    )}
                  </div>
                </div>
              </div>

              {canAdd && (
                <AddDialog
                  open={modalOpen}
                  onClose={() => setModalOpen(false)}
                  onAdd={onAdd}
                  existingGroups={existingGroups}
                />
              )}

              {canEdit && editTarget && (
                <EditDialog
                  open={Boolean(editTarget)}
                  onClose={() => setEditTarget(null)}
                  onSubmit={onSubmitEdit}
                  initial={editTarget.entry}
                  group={editTarget.group}
                  existingGroups={existingGroups}
                />
              )}
            </>
          )}

          {loadState === "error" && status && <p className={`text-sm ${statusColor}`}>{status.message}</p>}
        </div>
      </div>
    </>
  );
}
