import yaml from "js-yaml";
import Head from "next/head";
import { useCallback, useEffect, useMemo, useState } from "react";

const CONFIG_FILE = "services.yaml";
const API_URL = `/api/config/raw/${CONFIG_FILE}`;
const TOKEN_STORAGE_KEY = "homepage-config-edit-token";

// Parse a YAML error into a readable line/column message.
function describeYamlError(e) {
  const where = e?.mark ? ` (line ${e.mark.line + 1}, column ${e.mark.column + 1})` : "";
  return `${e?.reason || e?.message || "Invalid YAML"}${where}`;
}

// Turn the services.yaml structure into a flat list of groups for the
// read-only preview. Mirrors the top-level shape used by the dashboard:
// a list of { GroupName: [ { ServiceName: {...} } ] }.
function parsePreview(content) {
  const data = yaml.load(content);
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .filter((group) => group && typeof group === "object")
    .map((group) => {
      const name = Object.keys(group)[0];
      const entries = Array.isArray(group[name]) ? group[name] : [];
      const services = entries
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
          };
        });
      return { name, services };
    });
}

function Preview({ content }) {
  const result = useMemo(() => {
    try {
      return { groups: parsePreview(content), error: null };
    } catch (e) {
      return { groups: [], error: describeYamlError(e) };
    }
  }, [content]);

  if (result.error) {
    return <p className="text-sm text-red-500">Preview unavailable: {result.error}</p>;
  }
  if (result.groups.length === 0) {
    return <p className="text-sm text-theme-500">No groups found.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {result.groups.map((group) => (
        <div key={group.name} className="rounded-md border border-theme-300 dark:border-theme-700 p-3">
          <h3 className="font-semibold text-theme-800 dark:text-theme-200">{group.name}</h3>
          <ul className="mt-2 flex flex-col gap-1">
            {group.services.map((service) => (
              <li key={service.name} className="text-sm text-theme-700 dark:text-theme-300">
                <span className="font-medium">{service.name}</span>
                {service.isGroup && <span className="ml-1 text-theme-500">(nested group)</span>}
                {service.description && <span className="ml-1 text-theme-500">— {service.description}</span>}
                {service.href && <span className="ml-1 text-theme-400 break-all">{service.href}</span>}
              </li>
            ))}
            {group.services.length === 0 && <li className="text-sm text-theme-500">No services.</li>}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function AdminConfig() {
  const [content, setContent] = useState("");
  const [token, setToken] = useState("");
  const [loadState, setLoadState] = useState("loading"); // loading | ready | disabled | error
  const [status, setStatus] = useState(null); // { type: "success"|"error"|"info", message }

  useEffect(() => {
    setToken(localStorage.getItem(TOKEN_STORAGE_KEY) || "");
    fetch(API_URL)
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
  }, []);

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
      const res = await fetch(API_URL, {
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
  }, [content, token]);

  const statusColor =
    status?.type === "error" ? "text-red-500" : status?.type === "success" ? "text-green-600" : "text-theme-500";

  return (
    <>
      <Head>
        <title>Homepage — Config Editor</title>
      </Head>
      <div className="min-h-screen bg-theme-50 dark:bg-theme-900 text-theme-800 dark:text-theme-200 p-6">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-xl font-bold mb-1">Config Editor</h1>
          <p className="text-sm text-theme-500 mb-4">Editing {CONFIG_FILE}</p>

          {loadState === "disabled" && (
            <div className="rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950 p-4 text-sm">
              Config editing is disabled. Set <code>HOMEPAGE_CONFIG_EDIT=true</code> (and{" "}
              <code>HOMEPAGE_CONFIG_EDIT_TOKEN</code> for saving) to enable this page.
            </div>
          )}

          {loadState === "loading" && <p className="text-sm text-theme-500">Loading…</p>}

          {loadState === "ready" && (
            <>
              <div className="flex items-center gap-3 mb-3">
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
                  <label htmlFor="yaml-editor" className="block text-sm font-medium mb-1">
                    YAML
                  </label>
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
                  <div className="h-[60vh] overflow-auto rounded-md border border-theme-300 dark:border-theme-700 bg-white dark:bg-theme-800 p-3">
                    <Preview content={content} />
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
            </>
          )}

          {loadState === "error" && status && <p className={`text-sm ${statusColor}`}>{status.message}</p>}
        </div>
      </div>
    </>
  );
}
