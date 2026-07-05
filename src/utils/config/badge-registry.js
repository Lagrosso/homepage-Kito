// Curated context badges for services (M13): small colored pills shown on the
// dashboard card (e.g. LAN / VPN / Public / Admin / Familie / Kritisch / Backup
// / Beta). Custom/unknown ids are allowed too and render in a neutral style.
//
// IMPORTANT (Tailwind v4): the full class strings must appear literally here so
// Tailwind's scanner includes them — never build class names dynamically from a
// color token, those would be purged.
export const BADGE_TYPES = [
  { id: "lan", label: "LAN", className: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  { id: "vpn", label: "VPN", className: "bg-purple-500/15 text-purple-700 dark:text-purple-300" },
  { id: "public", label: "Public", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  { id: "admin", label: "Admin", className: "bg-red-500/15 text-red-700 dark:text-red-300" },
  { id: "family", label: "Familie", className: "bg-green-500/15 text-green-700 dark:text-green-300" },
  { id: "critical", label: "Kritisch", className: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  { id: "backup", label: "Backup", className: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  { id: "beta", label: "Beta", className: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300" },
];

export const BADGE_BY_ID = Object.fromEntries(BADGE_TYPES.map((b) => [b.id, b]));

export const NEUTRAL_BADGE_CLASS = "bg-theme-300/40 dark:bg-white/10 text-theme-600 dark:text-theme-300";
