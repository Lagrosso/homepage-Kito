import AdminTabs from "components/admin/admin-tabs";
import { CONFIG_TABS, HealthResults } from "components/admin/config-editor";
import LogoutButton from "components/admin/logout-button";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { MdHome } from "react-icons/md";

const FILTERS = [
  { label: "All", value: "all" },
  { label: "Errors", value: "error" },
  { label: "Warnings", value: "warning" },
  { label: "Info", value: "info" },
];

function SummaryCard({ label, value, tone }) {
  const cls =
    tone === "error"
      ? "text-red-600 dark:text-red-300"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-300"
        : "text-blue-600 dark:text-blue-300";
  return (
    <div className="rounded-md border border-theme-200 dark:border-theme-700 bg-white dark:bg-theme-800 px-4 py-3">
      <div className={`text-2xl font-semibold ${cls}`}>{value}</div>
      <div className="text-xs text-theme-500 dark:text-theme-400">{label}</div>
    </div>
  );
}

export default function AdminHealth() {
  const router = useRouter();
  const [authState, setAuthState] = useState("checking");
  const [currentUser, setCurrentUser] = useState(null);
  const [loadState, setLoadState] = useState("loading");
  const [report, setReport] = useState(null);
  const [status, setStatus] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then(async (res) => {
        if (res.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(router.asPath || "/admin/health")}`);
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
          setStatus(e.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (authState !== "admin") return;
    let cancelled = false;
    setLoadState("loading");
    fetch("/api/config/health")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? `Failed to load health report (${res.status})`);
        if (!cancelled) {
          setReport(data);
          setLoadState("ready");
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setStatus(e.message);
          setLoadState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [authState]);

  const summary = report?.summary ?? { errors: 0, warnings: 0, info: 0 };
  const activeCount = useMemo(() => {
    if (!report) return 0;
    return Object.values(report.files ?? {}).reduce(
      (sum, fileReport) =>
        sum + (fileReport.checks ?? []).filter((check) => filter === "all" || check.severity === filter).length,
      0,
    );
  }, [filter, report]);

  return (
    <>
      <Head>
        <title>Homepage - Health</title>
      </Head>
      <div className="admin-shell min-h-screen bg-theme-50 dark:bg-theme-900 text-theme-900 dark:text-theme-100">
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
            <span className="text-sm font-medium">Health</span>
            {currentUser && (
              <span className="hidden sm:inline text-xs text-theme-400 ml-2">({currentUser.username})</span>
            )}
          </div>
          <LogoutButton />
        </header>

        <AdminTabs tabs={CONFIG_TABS} activeHref={router.pathname} />

        <main className="mx-auto max-w-6xl px-4 py-6">
          <div className="mb-5">
            <h1 className="text-xl font-semibold">Config Health</h1>
            <p className="mt-1 text-sm text-theme-500 dark:text-theme-400">
              Static checks for the editable YAML configs. Findings are advisory and do not block saving.
            </p>
          </div>

          {(authState === "checking" || loadState === "loading") && (
            <p className="text-sm text-theme-500">Loading…</p>
          )}
          {authState === "denied" && loadState !== "error" && (
            <p className="text-sm text-theme-500">Redirecting to a page available for your role…</p>
          )}
          {loadState === "error" && <p className="text-sm text-red-500">{status}</p>}

          {authState === "admin" && loadState === "ready" && report && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <SummaryCard label="Errors" value={summary.errors} tone="error" />
                <SummaryCard label="Warnings" value={summary.warnings} tone="warning" />
                <SummaryCard label="Info" value={summary.info} tone="info" />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {FILTERS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setFilter(item.value)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                      filter === item.value
                        ? "bg-blue-600 text-white"
                        : "bg-theme-200 dark:bg-theme-700 text-theme-700 dark:text-theme-200 hover:bg-theme-300 dark:hover:bg-theme-600"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
                <span className="text-xs text-theme-500">{activeCount} findings shown</span>
              </div>

              <div className="rounded-md border border-theme-300 dark:border-theme-700 bg-theme-100/40 dark:bg-theme-800 p-3">
                <HealthResults report={report} filter={filter} />
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
