import AdminTabs from "components/admin/admin-tabs";
import { CONFIG_TABS, inputClass } from "components/admin/config-editor";
import LogoutButton from "components/admin/logout-button";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { MdHome } from "react-icons/md";

import { HISTORY_ACTIONS, HISTORY_FILES } from "utils/config/history-constants";
import { setEditorDraft } from "utils/config/import-drafts";

function StatusBanner({ status }) {
  if (!status) {
    return null;
  }
  const className =
    status.type === "error"
      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
      : status.type === "success"
        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
  return <p className={`rounded-md px-3 py-2 text-sm ${className}`}>{status.message}</p>;
}

function formatActor(entry) {
  return entry.actor?.username ?? (entry.legacy ? "legacy" : "system");
}

export default function AdminHistory() {
  const router = useRouter();
  const [authState, setAuthState] = useState("checking");
  const [currentUser, setCurrentUser] = useState(null);
  const [entries, setEntries] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [diff, setDiff] = useState(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [fileFilter, setFileFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then(async (res) => {
        if (res.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(router.asPath || "/admin/history")}`);
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
      .catch((error) => {
        if (!cancelled) {
          setAuthState("denied");
          setStatus({ type: "error", message: error.message });
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
    const params = new URLSearchParams();
    if (fileFilter !== "all") {
      params.set("file", fileFilter);
    }
    if (actionFilter !== "all") {
      params.set("action", actionFilter);
    }
    fetch(`/api/config/history?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error ?? `Failed to load history (${res.status})`);
        }
        setEntries(data.entries ?? []);
        if (!selectedId && data.entries?.length) {
          setSelectedId(data.entries[0].id);
        } else if (selectedId && !data.entries?.some((entry) => entry.id === selectedId)) {
          setSelectedId(data.entries?.[0]?.id ?? null);
        }
      })
      .catch((error) => setStatus({ type: "error", message: error.message }));
  }, [actionFilter, authState, fileFilter, selectedId]);

  useEffect(() => {
    if (authState !== "admin" || !selectedId) {
      setDetail(null);
      setDiff(null);
      return;
    }
    let cancelled = false;
    Promise.all([
      fetch(`/api/config/history/${encodeURIComponent(selectedId)}`).then((res) =>
        res.json().then((data) => ({ data, ok: res.ok, status: res.status })),
      ),
      fetch(`/api/config/history/${encodeURIComponent(selectedId)}/diff`).then((res) =>
        res.json().then((data) => ({ data, ok: res.ok, status: res.status })),
      ),
    ])
      .then(([detailRes, diffRes]) => {
        if (cancelled) {
          return;
        }
        if (!detailRes.ok) {
          throw new Error(detailRes.data.error ?? `Failed to load entry (${detailRes.status})`);
        }
        setDetail(detailRes.data);
        if (diffRes.ok) {
          setDiff(diffRes.data);
        } else {
          setDiff({ error: diffRes.data.error ?? `Failed to load diff (${diffRes.status})` });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setStatus({ type: "error", message: error.message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [authState, selectedId]);

  const selectedEntry = useMemo(() => entries.find((entry) => entry.id === selectedId) ?? null, [entries, selectedId]);

  async function restoreEntry() {
    if (!selectedEntry?.restorable) {
      return;
    }
    setBusy(true);
    setStatus({ type: "info", message: "Preparing restore draft…" });
    try {
      const res = await fetch(`/api/config/history/${encodeURIComponent(selectedEntry.id)}/restore`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `Restore failed (${res.status})`);
      }
      const { draft } = data;
      setEditorDraft(draft.filename, {
        actor: draft.actor,
        comment: "",
        content: draft.content,
        file: draft.filename,
        kind: draft.kind,
        route: draft.route,
        sourceBackupId: draft.sourceBackupId,
      });
      router.push(draft.route);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>Homepage - History</title>
      </Head>
      <div className="admin-shell min-h-screen bg-theme-50 text-theme-900 dark:bg-theme-900 dark:text-theme-100">
        <header className="flex items-center justify-between border-b border-theme-200 bg-white px-4 py-3 dark:border-theme-700 dark:bg-theme-900">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              aria-label="Dashboard"
              className="flex items-center gap-1 text-theme-500 hover:text-theme-700 dark:hover:text-theme-200"
            >
              <MdHome className="h-5 w-5" />
            </Link>
            <span className="text-theme-300 dark:text-theme-600">/</span>
            <span className="text-sm font-medium">History</span>
            {currentUser && <span className="hidden text-xs text-theme-400 sm:inline">({currentUser.username})</span>}
          </div>
          <LogoutButton />
        </header>

        <AdminTabs tabs={CONFIG_TABS} activeHref={router.pathname} />

        <main className="mx-auto max-w-7xl px-4 py-6">
          {authState === "checking" && <p className="text-sm text-theme-500">Loading…</p>}
          {authState === "denied" && <p className="text-sm text-theme-500">Redirecting…</p>}

          {authState === "admin" && (
            <div className="space-y-4">
              <StatusBanner status={status} />

              <div className="grid gap-3 rounded-md border border-theme-300 bg-theme-100/40 p-4 dark:border-theme-700 dark:bg-theme-800/40 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">File</span>
                  <select value={fileFilter} onChange={(event) => setFileFilter(event.target.value)} className={inputClass}>
                    <option value="all">All files</option>
                    {HISTORY_FILES.map((file) => (
                      <option key={file} value={file}>
                        {file}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Action</span>
                  <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)} className={inputClass}>
                    <option value="all">All actions</option>
                    {HISTORY_ACTIONS.map((action) => (
                      <option key={action} value={action}>
                        {action}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-[360px,1fr]">
                <section className="rounded-md border border-theme-300 bg-theme-100/40 p-3 dark:border-theme-700 dark:bg-theme-800/40">
                  <h2 className="mb-3 text-sm font-semibold">History Entries</h2>
                  <div className="space-y-2">
                    {entries.length === 0 && <p className="text-sm text-theme-500">No history entries found.</p>}
                    {entries.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setSelectedId(entry.id)}
                        className={`w-full rounded-md border p-3 text-left text-sm ${
                          entry.id === selectedId
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                            : "border-theme-300 bg-white/70 dark:border-theme-700 dark:bg-theme-900/40"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">{entry.file}</span>
                          <span className="text-xs uppercase text-theme-500">{entry.action}</span>
                        </div>
                        <div className="mt-1 text-xs text-theme-500">{new Date(entry.timestamp).toLocaleString()}</div>
                        <div className="mt-1 text-xs text-theme-500">
                          {formatActor(entry)}
                          {entry.legacy ? " · legacy" : ""}
                        </div>
                        {entry.comment && <div className="mt-1 text-xs">{entry.comment}</div>}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="rounded-md border border-theme-300 bg-theme-100/40 p-4 dark:border-theme-700 dark:bg-theme-800/40">
                  {!selectedEntry && <p className="text-sm text-theme-500">Select a history entry to inspect it.</p>}

                  {selectedEntry && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-semibold">{selectedEntry.file}</h2>
                          <p className="text-sm text-theme-500">
                            {selectedEntry.action} by {formatActor(selectedEntry)} on{" "}
                            {new Date(selectedEntry.timestamp).toLocaleString()}
                          </p>
                          {selectedEntry.comment && <p className="mt-1 text-sm">{selectedEntry.comment}</p>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {selectedEntry.hasSnapshot && (
                            <a
                              href={`/api/config/history/${encodeURIComponent(selectedEntry.id)}/download`}
                              className="rounded-md border border-theme-300 px-3 py-2 text-sm hover:bg-theme-100 dark:border-theme-700 dark:hover:bg-theme-700/40"
                            >
                              Download
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={restoreEntry}
                            disabled={busy || !selectedEntry.restorable}
                            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Restore to editor
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-4 xl:grid-cols-2">
                        <div>
                          <h3 className="mb-2 text-sm font-semibold">Snapshot</h3>
                          <pre className="max-h-96 overflow-auto rounded-md border border-theme-300 bg-theme-950 p-3 text-xs text-theme-100 dark:border-theme-700">
                            {detail?.content ?? "No snapshot content available for this entry."}
                          </pre>
                        </div>
                        <div>
                          <h3 className="mb-2 text-sm font-semibold">Diff vs current live file</h3>
                          <pre className="max-h-96 overflow-auto rounded-md border border-theme-300 bg-theme-950 p-3 text-xs text-theme-100 dark:border-theme-700">
                            {diff?.patch ?? diff?.error ?? "No diff available."}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
