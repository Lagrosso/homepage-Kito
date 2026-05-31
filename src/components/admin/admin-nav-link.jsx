import Link from "next/link";
import { MdAdminPanelSettings } from "react-icons/md";
import useSWR from "swr";

// Header button linking into the admin/config UI. Visibility is derived from
// the current session role; viewers can use the dashboard but do not see admin UI.
export default function AdminNavLink() {
  const { data } = useSWR("/api/auth/me");

  if (data?.user?.role !== "admin") {
    return null;
  }

  return (
    <Link
      href="/admin/config"
      aria-label="Admin"
      title="Admin"
      className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-theme-700 dark:text-theme-200 hover:bg-theme-200/60 dark:hover:bg-theme-700/60 transition-colors"
    >
      <MdAdminPanelSettings className="w-5 h-5" />
      <span className="hidden sm:inline">Admin</span>
    </Link>
  );
}
