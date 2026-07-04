import useSWR from "swr";

// Header dropdown letting an admin preview the dashboard as a named profile
// (M10b) — a client-side re-filter of already-loaded (unfiltered, since admins
// bypass access.groups server-side) data, purely for READING. It never logs
// the admin out/in as someone else and never changes any permission. Hidden
// entirely for non-admins and when no profiles exist yet (see
// utils/services/preview-access.js + /admin/profiles for the presets).
export default function PreviewProfileSwitcher({ profiles, previewProfile, setPreviewProfile }) {
  const { data } = useSWR("/api/auth/me");
  const profileNames = Object.keys(profiles ?? {});

  if (data?.user?.role !== "admin" || profileNames.length === 0) {
    return null;
  }

  return (
    <select
      aria-label="Preview dashboard as profile"
      title="Ansicht als Profil"
      value={previewProfile?.name ?? ""}
      onChange={(e) => {
        const name = e.target.value;
        if (!name) {
          setPreviewProfile(null);
          return;
        }
        setPreviewProfile({ name, groups: profiles[name]?.groups ?? [] });
      }}
      className="rounded-md px-2 py-1.5 text-sm bg-transparent text-theme-700 dark:text-theme-200 hover:bg-theme-200/60 dark:hover:bg-theme-700/60 transition-colors border-none"
    >
      <option value="">Normal</option>
      {profileNames.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}
