import yaml from "js-yaml";
import Head from "next/head";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const TOKEN_STORAGE_KEY = "homepage-config-edit-token";

// Tabs shown in the editor header so the two config files cross-link.
const CONFIG_TABS = [
  { file: "services.yaml", label: "Services", href: "/admin/config" },
  { file: "bookmarks.yaml", label: "Bookmarks", href: "/admin/bookmarks" },
  { file: "widgets.yaml", label: "Widgets", href: "/admin/widgets" },
  { file: "settings.yaml", label: "Settings", href: "/admin/settings" },
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

function Preview({ content, parse, Card, gridClassName }) {
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

  return (
    <div className="flex flex-col gap-5">
      {result.groups.map((group) => (
        <section key={group.name}>
          <h3 className="text-theme-800 dark:text-theme-200 text-sm font-medium pb-2 mb-2 border-b border-theme-300 dark:border-theme-700">
            {group.name}
          </h3>
          <div className={gridClassName}>
            {group.entries.map((entry) => (
              <Card key={entry.name} entry={entry} />
            ))}
          </div>
          {group.entries.length === 0 && <p className="text-sm text-theme-500">No entries.</p>}
        </section>
      ))}
    </div>
  );
}

// Generic hybrid config editor: raw YAML editor + read-only card preview,
// validation, token-gated save, backup-aware status, and a quick-add dialog.
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
}) {
  // Quick-add is optional: a config (e.g. widgets.yaml) may ship preview-only.
  const canAdd = Boolean(AddDialog && insert);
  const apiUrl = `/api/config/raw/${configFile}`;
  const [content, setContent] = useState("");
  const [token, setToken] = useState("");
  const [loadState, setLoadState] = useState("loading"); // loading | ready | disabled | error
  const [status, setStatus] = useState(null); // { type: "success"|"error"|"info", message }
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem(TOKEN_STORAGE_KEY) || "");
    fetch(apiUrl)
      .then(async (res) => {
        if (res.status === 404) {
          setLoadState("disabled");
          return;
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
  }, [apiUrl]);

  // Group names for the quick-add datalist (best-effort; ignores parse errors).
  const existingGroups = useMemo(() => {
    try {
      return parse(content).map((g) => g.name);
    } catch {
      return [];
    }
  }, [content, parse]);

  const onTokenChange = useCallback((value) => {
    setToken(value);
    localStorage.setItem(TOKEN_STORAGE_KEY, value);
  }, []);

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
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data.detail
          ? `${data.detail.message}${data.detail.line ? ` (line ${data.detail.line}, column ${data.detail.column})` : ""}`
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
  }, [apiUrl, content, token]);

  const statusColor =
    status?.type === "error" ? "text-red-500" : status?.type === "success" ? "text-green-600" : "text-theme-500";

  return (
    <>
      <Head>
        <title>Homepage — {title}</title>
      </Head>
      <div className="min-h-screen bg-theme-50 dark:bg-theme-900 text-theme-800 dark:text-theme-200 p-6">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-xl font-bold mb-1">{title}</h1>
          <p className="text-sm text-theme-500 mb-3">Editing {configFile}</p>

          <nav className="flex gap-2 mb-4">
            {CONFIG_TABS.map((tab) => (
              <Link
                key={tab.file}
                href={tab.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  tab.file === configFile
                    ? "bg-blue-600 text-white"
                    : "bg-theme-200 dark:bg-theme-700 hover:bg-theme-300 dark:hover:bg-theme-600"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>

          {loadState === "disabled" && (
            <div className="rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950 p-4 text-sm">
              Config editing is disabled. Set <code>HOMEPAGE_CONFIG_EDIT=true</code> (and{" "}
              <code>HOMEPAGE_CONFIG_EDIT_TOKEN</code> for saving) to enable this page.
            </div>
          )}

          {loadState === "loading" && <p className="text-sm text-theme-500">Loading…</p>}

          {loadState === "ready" && (
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
                  <span className="block text-sm font-medium mb-1">Preview (read-only)</span>
                  <div className="h-[60vh] overflow-auto rounded-md border border-theme-300 dark:border-theme-700 bg-theme-100/40 dark:bg-theme-800 p-3">
                    <Preview content={content} parse={parse} Card={Card} gridClassName={gridClassName} />
                  </div>
                </div>
              </div>

              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-theme-500">Edit token</summary>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => onTokenChange(e.target.value)}
                  placeholder="HOMEPAGE_CONFIG_EDIT_TOKEN"
                  className="mt-2 w-full max-w-md rounded-md border border-theme-300 dark:border-theme-700 bg-white dark:bg-theme-800 px-3 py-2 font-mono text-sm"
                />
                <p className="mt-1 text-xs text-theme-400">Stored locally in your browser and sent only when saving.</p>
              </details>

              {canAdd && (
                <AddDialog
                  open={modalOpen}
                  onClose={() => setModalOpen(false)}
                  onAdd={onAdd}
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
