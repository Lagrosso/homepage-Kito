import Link from "next/link";
import useSWR from "swr";

// Small dashboard link to the config editor. Viewers can use the dashboard, but
// only admins see links into the config UI.
export default function ConfigEditorLink() {
  const { data } = useSWR("/api/auth/me");

  if (data?.user?.role !== "admin") {
    return null;
  }

  return (
    <Link href="/admin/config" className="text-theme-500 hover:text-theme-600 dark:hover:text-theme-300 text-xs">
      Config Editor
    </Link>
  );
}
