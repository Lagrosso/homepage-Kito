// Lightweight, dependency-free list of the admin navigation tabs. Kept in its
// own module (rather than inside the heavy config-editor component) so the
// dashboard command palette can reuse it without bundling the whole editor.
export const CONFIG_TABS = [
  { label: "Services", href: "/admin/config" },
  { label: "Bookmarks", href: "/admin/bookmarks" },
  { label: "Widgets", href: "/admin/widgets" },
  { label: "Settings", href: "/admin/settings" },
  { label: "Docker", href: "/admin/docker" },
  { label: "Import", href: "/admin/import" },
  { label: "Layout", href: "/admin/layout" },
  { label: "Theme", href: "/admin/theme" },
  { label: "Health", href: "/admin/health" },
  { label: "History", href: "/admin/history" },
  { label: "Users", href: "/admin/users" },
];
