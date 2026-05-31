import { useRouter } from "next/router";
import { useState } from "react";
import { MdLogout } from "react-icons/md";

export default function LogoutButton({ className = "" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onLogout = async () => {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
    }
  };

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={busy}
      aria-label="Logout"
      title="Logout"
      className={
        className ||
        "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-theme-700 dark:text-theme-200 hover:bg-theme-200/60 dark:hover:bg-theme-700/60 transition-colors disabled:opacity-60"
      }
    >
      <MdLogout className="h-5 w-5" />
      <span className="hidden sm:inline">Logout</span>
    </button>
  );
}
