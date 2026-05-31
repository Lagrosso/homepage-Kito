import classNames from "classnames";
import { CONFIG_TABS, inputClass } from "components/admin/config-editor";
import LogoutButton from "components/admin/logout-button";
import yaml from "js-yaml";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MdDelete, MdHome, MdUpload } from "react-icons/md";
import { ALL_COLORS, THEME_PRESETS } from "utils/config/theme-presets";
import { deleteSetting, removeBackground, setBackgroundField, updateSetting } from "utils/config/yaml-edit";

function StatusBanner({ status }) {
  if (!status) return null;
  const cls =
    status.type === "error"
      ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
      : status.type === "success"
        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
        : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300";
  return <p className={`rounded-md px-3 py-2 text-sm ${cls}`}>{status.message}</p>;
}

const BTN_PRIMARY =
  "rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY =
  "rounded-md border border-theme-300 dark:border-theme-600 px-4 py-2 text-sm font-medium text-theme-700 dark:text-theme-200 hover:bg-theme-100 dark:hover:bg-theme-700/40 disabled:opacity-50 disabled:cursor-not-allowed";

export default function AdminTheme() {
  const router = useRouter();
  const [authState, setAuthState] = useState("checking"); // checking | admin | denied
  const [currentUser, setCurrentUser] = useState(null);
  const [loadState, setLoadState] = useState("loading"); // loading | ready | error

  const [settingsRaw, setSettingsRaw] = useState("");
  const [settingsStatus, setSettingsStatus] = useState(null);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const [cssContent, setCssContent] = useState("");
  const [cssStatus, setCssStatus] = useState(null);
  const [cssSaving, setCssSaving] = useState(false);

  const [bgPreview, setBgPreview] = useState(null); // { dataUrl, filename }
  const [bgUploading, setBgUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [importText, setImportText] = useState("");
  const [importStatus, setImportStatus] = useState(null);

  // --- Auth ---
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then(async (res) => {
        if (res.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(router.asPath || "/admin/theme")}`);
          return;
        }
        if (!res.ok) throw new Error(`Failed to check session (${res.status})`);
        const data = await res.json();
        if (data?.user?.role !== "admin") {
          if (!cancelled) setAuthState("denied");
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
          setSettingsStatus({ type: "error", message: e.message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  // --- Load data ---
  useEffect(() => {
    if (authState !== "admin") return;
    let cancelled = false;
    Promise.all([
      fetch("/api/config/raw/settings.yaml").then((r) => (r.ok ? r.json() : Promise.reject(new Error(`settings.yaml: ${r.status}`)))),
      fetch("/api/config/custom-css").then((r) => (r.ok ? r.json() : Promise.reject(new Error(`custom-css: ${r.status}`)))),
    ])
      .then(([settings, css]) => {
        if (cancelled) return;
        setSettingsRaw(settings.content ?? "");
        setCssContent(css.content ?? "");
        setLoadState("ready");
      })
      .catch((e) => {
        if (!cancelled) {
          setLoadState("error");
          setSettingsStatus({ type: "error", message: `Laden fehlgeschlagen: ${e.message}` });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [authState]);

  // Parsed settings for reading current values
  const parsed = useMemo(() => {
    try {
      return yaml.load(settingsRaw) ?? {};
    } catch {
      return {};
    }
  }, [settingsRaw]);

  // Apply a YAML mutation to settingsRaw
  const mutateSettings = useCallback(
    (mutate, message) => {
      try {
        setSettingsRaw(mutate(settingsRaw));
        setSettingsStatus({ type: "info", message });
      } catch (e) {
        setSettingsStatus({ type: "error", message: e.message });
      }
    },
    [settingsRaw],
  );

  // --- Preset ---
  const applyPreset = useCallback(
    (preset) => {
      mutateSettings((raw) => {
        let r = updateSetting(raw, { key: "color" }, preset.color);
        r = updateSetting(r, { key: "theme" }, preset.theme);
        if (preset.cardBlur === "") {
          try {
            r = deleteSetting(r, { key: "cardBlur" });
          } catch {
            /* not present – ok */
          }
        } else {
          r = updateSetting(r, { key: "cardBlur" }, preset.cardBlur);
        }
        return r;
      }, `Preset "${preset.label}" angewendet — Speichern nicht vergessen.`);
    },
    [mutateSettings],
  );

  // --- Visual settings ---
  const setColor = (color) =>
    mutateSettings((r) => updateSetting(r, { key: "color" }, color), `Farbe: ${color}`);

  const setTheme = (t) =>
    mutateSettings((r) => updateSetting(r, { key: "theme" }, t), `Modus: ${t}`);

  const setCardBlur = (v) =>
    mutateSettings((r) => {
      if (!v) {
        try {
          return deleteSetting(r, { key: "cardBlur" });
        } catch {
          return r;
        }
      }
      return updateSetting(r, { key: "cardBlur" }, v);
    }, `Card Blur: ${v || "keiner"}`);

  // --- Background ---
  const setBgField = (field, value) =>
    mutateSettings((r) => setBackgroundField(r, field, value), `Hintergrund: ${field} geändert`);

  const clearBackground = () =>
    mutateSettings((r) => removeBackground(r), "Hintergrund entfernt");

  const onFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setBgPreview({ dataUrl: ev.target.result, filename: file.name });
    reader.readAsDataURL(file);
  };

  const uploadBackground = async () => {
    if (!bgPreview) return;
    setBgUploading(true);
    try {
      const r = await fetch("/api/config/background-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: bgPreview.filename, dataUrl: bgPreview.dataUrl }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error ?? `Upload fehlgeschlagen (${r.status})`);
      }
      const { path } = await r.json();
      mutateSettings((raw) => setBackgroundField(raw, "image", path), `Hintergrundbild hochgeladen: ${path}`);
      setBgPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
      setSettingsStatus({ type: "error", message: e.message });
    } finally {
      setBgUploading(false);
    }
  };

  // --- Save settings ---
  const saveSettings = async () => {
    setSettingsSaving(true);
    setSettingsStatus(null);
    try {
      const r = await fetch("/api/config/raw/settings.yaml", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: settingsRaw }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? `Fehler ${r.status}`);
      setSettingsStatus({
        type: "success",
        message: `Gespeichert.${d.backupPath ? ` Backup: ${d.backupPath}` : ""}`,
      });
    } catch (e) {
      setSettingsStatus({ type: "error", message: e.message });
    } finally {
      setSettingsSaving(false);
    }
  };

  // --- Save CSS ---
  const saveCss = async () => {
    setCssSaving(true);
    setCssStatus(null);
    try {
      const r = await fetch("/api/config/custom-css", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: cssContent }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? `Fehler ${r.status}`);
      setCssStatus({
        type: "success",
        message: `CSS gespeichert.${d.backupPath ? ` Backup: ${d.backupPath}` : ""}`,
      });
    } catch (e) {
      setCssStatus({ type: "error", message: e.message });
    } finally {
      setCssSaving(false);
    }
  };

  // --- Export ---
  const exportTheme = () => {
    const bg =
      typeof parsed.background === "object" && parsed.background !== null ? { ...parsed.background } : {};
    delete bg.image; // local/external path — not portable
    const themeData = {
      schemaVersion: 1,
      color: parsed.color ?? null,
      theme: parsed.theme ?? null,
      cardBlur: parsed.cardBlur ?? null,
      ...(Object.keys(bg).length > 0 ? { background: bg } : {}),
      ...(cssContent ? { customCss: cssContent } : {}),
    };
    const blob = new Blob([JSON.stringify(themeData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "homepage-theme.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Import ---
  const applyImport = () => {
    setImportStatus(null);
    let data;
    try {
      data = JSON.parse(importText);
    } catch {
      setImportStatus({ type: "error", message: "Ungültiges JSON" });
      return;
    }
    try {
      let raw = settingsRaw;
      if (data.color) raw = updateSetting(raw, { key: "color" }, data.color);
      if (data.theme) raw = updateSetting(raw, { key: "theme" }, data.theme);
      if (data.cardBlur != null) {
        if (data.cardBlur === "") {
          try {
            raw = deleteSetting(raw, { key: "cardBlur" });
          } catch {
            /* ok */
          }
        } else {
          raw = updateSetting(raw, { key: "cardBlur" }, data.cardBlur);
        }
      }
      if (data.background && typeof data.background === "object") {
        Object.entries(data.background).forEach(([k, v]) => {
          raw = setBackgroundField(raw, k, v);
        });
      }
      setSettingsRaw(raw);
      if (typeof data.customCss === "string") setCssContent(data.customCss);
      setImportStatus({ type: "success", message: "Importiert — Speichern nicht vergessen." });
      setImportText("");
    } catch (e) {
      setImportStatus({ type: "error", message: `Import fehlgeschlagen: ${e.message}` });
    }
  };

  if (authState === "checking" || authState === "denied") {
    return null;
  }

  return (
    <>
      <Head>
        <title>Theme &amp; Branding</title>
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
            <span className="text-sm font-medium">Theme &amp; Branding</span>
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
              className={classNames(
                "px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                router.pathname === tab.href
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-theme-500 dark:text-theme-400 hover:text-theme-700 dark:hover:text-theme-200",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        {/* Content */}
        <main className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-8">
          {loadState === "loading" && <p className="text-theme-500">Lade…</p>}
          {loadState === "error" && <StatusBanner status={settingsStatus} />}

          {loadState === "ready" && (
            <>
              {/* ── Presets ── */}
              <section>
                <h2 className="text-lg font-semibold mb-3">Presets</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {THEME_PRESETS.map((p) => {
                    const active = parsed.color === p.color && parsed.theme === p.theme;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => applyPreset(p)}
                        title={p.label}
                        className={classNames(
                          "rounded-lg overflow-hidden text-left border-2 transition-all hover:scale-[1.03]",
                          active
                            ? "border-blue-500 ring-2 ring-blue-400/40"
                            : "border-transparent hover:border-theme-300 dark:hover:border-theme-600",
                        )}
                      >
                        <div className={`theme-${p.color} h-10 w-full bg-theme-500`} />
                        <div className="px-2 py-1 bg-white dark:bg-theme-800">
                          <span className="block text-xs font-medium truncate text-theme-900 dark:text-theme-100">
                            {p.label}
                          </span>
                          <span className="text-[10px] text-theme-400">
                            {p.theme === "dark" ? "Dark" : "Light"}
                            {p.cardBlur ? ` · blur-${p.cardBlur}` : ""}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* ── Visuelle Einstellungen ── */}
              <section>
                <h2 className="text-lg font-semibold mb-3">Visuelle Einstellungen</h2>
                <div className="flex flex-col gap-5">
                  {/* Color picker */}
                  <div>
                    <p className="text-sm font-medium mb-2">
                      Farbe <span className="font-normal text-theme-400">— aktiv: {parsed.color ?? "(Standard)"}</span>
                    </p>
                    <div className="grid grid-cols-[repeat(17,minmax(0,1fr))] gap-1.5">
                      {ALL_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          title={c}
                          onClick={() => setColor(c)}
                          className={classNames(
                            `theme-${c} rounded w-7 h-7 bg-theme-400 border-2 transition-transform`,
                            parsed.color === c
                              ? "border-blue-500 scale-125 z-10"
                              : "border-transparent hover:border-theme-400 dark:hover:border-theme-500 hover:scale-110",
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Theme toggle */}
                  <div className="flex items-center gap-4 flex-wrap">
                    <p className="text-sm font-medium">Modus</p>
                    <div className="flex gap-2">
                      {["light", "dark"].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTheme(t)}
                          className={classNames(
                            "px-4 py-1.5 rounded-full text-sm border transition-colors",
                            parsed.theme === t
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "border-theme-300 dark:border-theme-600 text-theme-600 dark:text-theme-300 hover:bg-theme-100 dark:hover:bg-theme-700/40",
                          )}
                        >
                          {t === "light" ? "☀️ Hell" : "🌙 Dunkel"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Card blur */}
                  <div className="flex items-center gap-4 flex-wrap">
                    <label htmlFor="cardBlur" className="text-sm font-medium">
                      Card Blur
                    </label>
                    <select
                      id="cardBlur"
                      value={parsed.cardBlur ?? ""}
                      onChange={(e) => setCardBlur(e.target.value)}
                      className={`${inputClass} max-w-[10rem]`}
                    >
                      <option value="">Kein (Standard)</option>
                      <option value="sm">sm</option>
                      <option value="md">md</option>
                      <option value="lg">lg</option>
                      <option value="xl">xl</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* ── Hintergrund ── */}
              <section>
                <h2 className="text-lg font-semibold mb-3">Hintergrund</h2>
                <div className="flex flex-col gap-3">
                  {/* Current image */}
                  {parsed.background?.image && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-theme-500 shrink-0">Aktuell:</span>
                      <code className="flex-1 min-w-0 truncate text-xs bg-theme-100 dark:bg-theme-800 rounded px-2 py-1">
                        {parsed.background.image}
                      </code>
                      <button
                        type="button"
                        onClick={() => setBgField("image", "")}
                        title="Bild entfernen"
                        className="shrink-0 text-red-500 hover:text-red-700"
                      >
                        <MdDelete className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* URL input */}
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">Bild-URL</span>
                    <input
                      type="url"
                      placeholder="https://example.com/background.jpg"
                      defaultValue={parsed.background?.image ?? ""}
                      key={parsed.background?.image ?? ""}
                      onBlur={(e) => {
                        if (e.target.value !== (parsed.background?.image ?? "")) {
                          setBgField("image", e.target.value);
                        }
                      }}
                      className={inputClass}
                    />
                  </label>

                  {/* File upload */}
                  <div className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">Oder Datei hochladen</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={onFileSelect}
                      />
                      <button type="button" onClick={() => fileInputRef.current?.click()} className={BTN_SECONDARY}>
                        Datei wählen…
                      </button>
                      {bgPreview && (
                        <>
                          <span className="text-theme-500 text-xs truncate max-w-[150px]">{bgPreview.filename}</span>
                          <button
                            type="button"
                            onClick={uploadBackground}
                            disabled={bgUploading}
                            className={BTN_PRIMARY}
                          >
                            <MdUpload className="inline w-4 h-4 mr-1" />
                            {bgUploading ? "Lädt hoch…" : "Hochladen"}
                          </button>
                        </>
                      )}
                    </div>
                    {bgPreview && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={bgPreview.dataUrl}
                        alt="Vorschau"
                        className="mt-1 max-h-24 rounded object-cover self-start"
                      />
                    )}
                  </div>

                  {/* Regler */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium">Deckkraft ({parsed.background?.opacity ?? 0}%)</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={parsed.background?.opacity ?? 0}
                        onChange={(e) => setBgField("opacity", Number(e.target.value))}
                        className="w-full"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <span className="font-medium shrink-0">Blur</span>
                      <select
                        value={parsed.background?.blur ?? ""}
                        onChange={(e) => setBgField("blur", e.target.value)}
                        className={`${inputClass} flex-1`}
                      >
                        <option value="">Kein</option>
                        <option value="sm">sm</option>
                        <option value="md">md</option>
                        <option value="lg">lg</option>
                        <option value="xl">xl</option>
                        <option value="2xl">2xl</option>
                        <option value="3xl">3xl</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium">Sättigung ({parsed.background?.saturate ?? 100}%)</span>
                      <input
                        type="range"
                        min="0"
                        max="200"
                        step="10"
                        value={parsed.background?.saturate ?? 100}
                        onChange={(e) => setBgField("saturate", Number(e.target.value))}
                        className="w-full"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium">Helligkeit ({parsed.background?.brightness ?? 100}%)</span>
                      <input
                        type="range"
                        min="0"
                        max="200"
                        step="10"
                        value={parsed.background?.brightness ?? 100}
                        onChange={(e) => setBgField("brightness", Number(e.target.value))}
                        className="w-full"
                      />
                    </label>
                  </div>

                  {parsed.background && (
                    <button
                      type="button"
                      onClick={clearBackground}
                      className={`${BTN_SECONDARY} self-start text-red-600 border-red-300 dark:border-red-800`}
                    >
                      Hintergrund komplett entfernen
                    </button>
                  )}
                </div>
              </section>

              {/* ── Save settings ── */}
              <div className="flex items-center gap-3 flex-wrap">
                <button type="button" onClick={saveSettings} disabled={settingsSaving} className={BTN_PRIMARY}>
                  {settingsSaving ? "Speichert…" : "Einstellungen speichern"}
                </button>
                <StatusBanner status={settingsStatus} />
              </div>

              {/* ── Custom CSS ── */}
              <section>
                <h2 className="text-lg font-semibold mb-1">Custom CSS</h2>
                <p className="text-sm text-amber-600 dark:text-amber-400 mb-3">
                  ⚠ Custom CSS wird auf allen Seiten geladen. Fehlerhafte Regeln können das Dashboard beschädigen.
                </p>
                <textarea
                  value={cssContent}
                  onChange={(e) => setCssContent(e.target.value)}
                  spellCheck={false}
                  rows={12}
                  className={`${inputClass} font-mono text-xs`}
                  placeholder="/* Eigene CSS-Regeln… */"
                />
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <button type="button" onClick={saveCss} disabled={cssSaving} className={BTN_PRIMARY}>
                    {cssSaving ? "Speichert…" : "CSS speichern"}
                  </button>
                  <button type="button" onClick={() => setCssContent("")} className={BTN_SECONDARY}>
                    Zurücksetzen
                  </button>
                  <StatusBanner status={cssStatus} />
                </div>
              </section>

              {/* ── Export / Import ── */}
              <section>
                <h2 className="text-lg font-semibold mb-3">Export / Import</h2>
                <div className="flex flex-col gap-5">
                  <div>
                    <h3 className="text-sm font-medium mb-1">Exportieren</h3>
                    <p className="text-xs text-theme-400 mb-2">
                      Farbe, Modus, Blur, Hintergrund-Effekte und Custom CSS als JSON. Bild-URLs und Secrets werden nicht
                      exportiert.
                    </p>
                    <button type="button" onClick={exportTheme} className={BTN_SECONDARY}>
                      Theme als JSON herunterladen
                    </button>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium mb-1">Importieren</h3>
                    <p className="text-xs text-theme-400 mb-2">JSON eines exportierten Themes einfügen:</p>
                    <textarea
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      spellCheck={false}
                      rows={5}
                      className={`${inputClass} font-mono text-xs`}
                      placeholder='{"schemaVersion": 1, "color": "slate", "theme": "dark", …}'
                    />
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <button
                        type="button"
                        onClick={applyImport}
                        disabled={!importText.trim()}
                        className={BTN_PRIMARY}
                      >
                        Anwenden
                      </button>
                      <StatusBanner status={importStatus} />
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </>
  );
}
