import AdminTabs from "components/admin/admin-tabs";
import { CONFIG_TABS, inputClass } from "components/admin/config-editor";
import LogoutButton from "components/admin/logout-button";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { MdHome } from "react-icons/md";

import { setImportDrafts } from "utils/config/import-drafts";

const SOURCE_FILES = {
  homepage: ["services.yaml", "bookmarks.yaml", "widgets.yaml", "settings.yaml", "docker.yaml"],
  muximux: ["muximux"],
};

const FILE_LABELS = {
  "services.yaml": "services.yaml",
  "bookmarks.yaml": "bookmarks.yaml",
  "widgets.yaml": "widgets.yaml",
  "settings.yaml": "settings.yaml",
  "docker.yaml": "docker.yaml",
  muximux: "muximux config",
};

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

function FileInput({ file, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{FILE_LABELS[file]}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(file, event.target.value)}
        spellCheck={false}
        className="h-40 w-full rounded-md border border-theme-300 bg-white p-3 font-mono text-sm dark:border-theme-700 dark:bg-theme-800"
        placeholder={`Paste ${FILE_LABELS[file]} here`}
      />
    </label>
  );
}

function ConflictRow({ item, value, onChange }) {
  return (
    <div className="rounded-md border border-theme-300 bg-white/70 p-3 text-sm dark:border-theme-700 dark:bg-theme-900/40">
      <div className="font-medium">{item.label}</div>
      <p className="mt-1 text-xs text-amber-600 dark:text-amber-300">{item.conflict?.label}</p>
      <select value={value} onChange={(event) => onChange(item.id, event.target.value)} className={`${inputClass} mt-2`}>
        {item.actions.map((action) => (
          <option key={action} value={action}>
            {action}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function AdminImport() {
  const router = useRouter();
  const [authState, setAuthState] = useState("checking");
  const [currentUser, setCurrentUser] = useState(null);
  const [sourceType, setSourceType] = useState("homepage");
  const [inputs, setInputs] = useState({
    "services.yaml": "",
    "bookmarks.yaml": "",
    "widgets.yaml": "",
    "settings.yaml": "",
    "docker.yaml": "",
    muximux: "",
  });
  const [status, setStatus] = useState(null);
  const [preview, setPreview] = useState(null);
  const [decisionById, setDecisionById] = useState({});
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then(async (res) => {
        if (res.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(router.asPath || "/admin/import")}`);
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

  const activeFiles = SOURCE_FILES[sourceType];

  const conflictItems = useMemo(
    () =>
      preview
        ? Object.values(preview.files)
            .flatMap((file) => file.items)
            .filter((item) => item.conflict)
        : [],
    [preview],
  );

  function setInput(file, value) {
    setInputs((state) => ({ ...state, [file]: value }));
  }

  async function runPreview() {
    setBusy(true);
    setStatus({ type: "info", message: "Building import preview…" });
    setPreview(null);
    try {
      const res = await fetch("/api/config/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType,
          inputs: Object.fromEntries(activeFiles.map((file) => [file, inputs[file]])),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Preview failed (${res.status})`);
      }
      const defaults = {};
      Object.values(data.files).forEach((file) => {
        file.items.forEach((item) => {
          defaults[item.id] = item.defaultAction;
        });
      });
      setDecisionById(defaults);
      setPreview(data);
      setStatus({
        type: data.totalConflicts > 0 ? "info" : "success",
        message: `Preview ready: ${data.totalItems} items, ${data.totalConflicts} conflicts.`,
      });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function applyPreview() {
    if (!preview) {
      return;
    }
    setBusy(true);
    setStatus({ type: "info", message: "Applying import into editor drafts…" });
    try {
      const res = await fetch("/api/config/import/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType,
          includeSecrets,
          decisions: decisionById,
          inputs: Object.fromEntries(activeFiles.map((file) => [file, inputs[file]])),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Apply failed (${res.status})`);
      }
      setImportDrafts(
        Object.fromEntries(
          Object.entries(data.drafts ?? {}).map(([filename, draft]) => [
            filename,
            {
              content: draft.content,
              sourceType,
              appliedAt: new Date().toISOString(),
            },
          ]),
        ),
      );
      const firstRoute = Object.values(data.drafts ?? {})[0]?.route;
      setStatus({
        type: "success",
        message: `Drafts created for ${Object.keys(data.drafts ?? {}).length} file(s). Review them in the editors and save manually.`,
      });
      if (firstRoute) {
        router.push(firstRoute);
      }
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>Homepage - Import Assistant</title>
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
            <span className="text-sm font-medium">Import Assistant</span>
            {currentUser && <span className="hidden text-xs text-theme-400 sm:inline">({currentUser.username})</span>}
          </div>
          <LogoutButton />
        </header>

        <AdminTabs tabs={CONFIG_TABS} activeHref={router.pathname} />

        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
          {authState === "checking" && <p className="text-sm text-theme-500">Loading…</p>}
          {authState === "denied" && <p className="text-sm text-theme-500">Redirecting…</p>}

          {authState === "admin" && (
            <>
              <div className="grid gap-4 rounded-md border border-theme-300 bg-theme-100/40 p-4 dark:border-theme-700 dark:bg-theme-800/40 lg:grid-cols-[280px,1fr]">
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium">Source</span>
                    <select value={sourceType} onChange={(event) => setSourceType(event.target.value)} className={inputClass}>
                      <option value="homepage">Homepage YAML</option>
                      <option value="muximux">Muximux YAML</option>
                    </select>
                  </label>

                  <label className="flex items-center gap-2 rounded-md border border-theme-300 bg-white px-3 py-2 text-sm dark:border-theme-700 dark:bg-theme-900">
                    <input
                      type="checkbox"
                      checked={includeSecrets}
                      onChange={(event) => setIncludeSecrets(event.target.checked)}
                      className="rounded border-theme-300 dark:border-theme-700"
                    />
                    import original secrets
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={runPreview}
                      disabled={busy}
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={applyPreview}
                      disabled={busy || !preview}
                      className="rounded-md bg-theme-200 px-4 py-2 text-sm font-medium hover:bg-theme-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-theme-700 dark:hover:bg-theme-600"
                    >
                      Apply to editors
                    </button>
                  </div>

                  <p className="text-xs text-theme-500">
                    Secrets are always redacted in the preview. If you leave the checkbox disabled, imported widget
                    secrets become <code>{"{{HOMEPAGE_VAR_*}}"}</code> placeholders.
                  </p>
                </div>

                <div className="space-y-4">
                  <StatusBanner status={status} />
                  <div className="grid gap-4 lg:grid-cols-2">
                    {activeFiles.map((file) => (
                      <FileInput key={file} file={file} value={inputs[file]} onChange={setInput} />
                    ))}
                  </div>
                </div>
              </div>

              {preview && (
                <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
                  <div className="rounded-md border border-theme-300 bg-theme-100/40 p-4 dark:border-theme-700 dark:bg-theme-800/40">
                    <h2 className="text-sm font-semibold">Preview</h2>
                    <div className="mt-3 space-y-4">
                      {Object.entries(preview.files).map(([file, filePreview]) => (
                        <section key={file} className="rounded-md border border-theme-300 bg-white/70 p-3 dark:border-theme-700 dark:bg-theme-900/40">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-sm font-medium">{file}</h3>
                            <span className="text-xs text-theme-500">
                              {filePreview.incoming} item(s), {filePreview.conflicts} conflict(s)
                            </span>
                          </div>
                          <ul className="mt-2 space-y-2 text-xs">
                            {filePreview.items.map((item) => (
                              <li key={item.id} className="rounded-md border border-theme-200 px-2 py-2 dark:border-theme-700">
                                <div className="font-medium">{item.label}</div>
                                <div className="mt-1 text-theme-500">
                                  {item.conflict ? item.conflict.label : `Action: ${item.defaultAction}`}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </section>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-md border border-theme-300 bg-theme-100/40 p-4 dark:border-theme-700 dark:bg-theme-800/40">
                      <h2 className="text-sm font-semibold">Conflict decisions</h2>
                      <div className="mt-3 space-y-3">
                        {conflictItems.length === 0 ? (
                          <p className="text-xs text-green-600 dark:text-green-400">No conflicts detected.</p>
                        ) : (
                          conflictItems.map((item) => (
                            <ConflictRow
                              key={item.id}
                              item={item}
                              value={decisionById[item.id] ?? item.defaultAction}
                              onChange={(id, action) => setDecisionById((state) => ({ ...state, [id]: action }))}
                            />
                          ))
                        )}
                      </div>
                    </div>

                    {(preview.warnings.length > 0 || preview.unsupported.length > 0) && (
                      <div className="rounded-md border border-theme-300 bg-theme-100/40 p-4 text-xs dark:border-theme-700 dark:bg-theme-800/40">
                        {preview.warnings.length > 0 && (
                          <>
                            <h3 className="font-semibold">Warnings</h3>
                            <ul className="mt-2 list-disc pl-5">
                              {preview.warnings.map((warning) => (
                                <li key={warning}>{warning}</li>
                              ))}
                            </ul>
                          </>
                        )}
                        {preview.unsupported.length > 0 && (
                          <>
                            <h3 className="mt-3 font-semibold">Unsupported / manual follow-up</h3>
                            <ul className="mt-2 list-disc pl-5">
                              {preview.unsupported.map((entry) => (
                                <li key={entry}>{entry}</li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
