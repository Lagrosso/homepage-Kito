import Link from "next/link";
import useSWR from "swr";

// Small dashboard link to the config editor. Self-contained and gated: it asks
// the server whether HOMEPAGE_CONFIG_EDIT is on and renders nothing otherwise,
// so the default-off deployment is unaffected.
export default function ConfigEditorLink() {
  const { data } = useSWR("/api/config/status");

  if (!data?.enabled) {
    return null;
  }

  return (
    <Link href="/admin/config" className="text-theme-500 hover:text-theme-600 dark:hover:text-theme-300 text-xs">
      Config Editor
    </Link>
  );
}
