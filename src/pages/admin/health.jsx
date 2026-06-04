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

const SERVICE_FILTERS = [
  { label: "All", value: "all" },
  { label: "Problematic", value: "problematic" },
  { label: "Slow", value: "slow" },
  { label: "No Check", value: "no-check" },
];

const SERVICE_SOURCES = [
  { label: "All sources", value: "all" },
  { label: "HTTP", value: "siteMonitor" },
  { label: "Ping", value: "ping" },
  { label: "Docker", value: "docker" },
  { label: "Kubernetes", value: "kubernetes" },
  { label: "Proxmox", value: "proxmox" },
  { label: "No check", value: "none" },
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
  const [serviceReport, setServiceReport] = useState(null);
  const [status, setStatus] = useState(null);
  const [filter, setFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [serviceSource, setServiceSource] = useState("all");

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
    Promise.all([
      fetch("/api/config/health").then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? `Failed to load health report (${res.status})`);
        return data;
      }),
      fetch("/api/services/status").then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? `Failed to load service status report (${res.status})`);
        return data;
      }),
    ])
      .then(([configData, servicesData]) => {
        if (!cancelled) {
          setReport(configData);
          setServiceReport(servicesData);
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

  const visibleServiceStatuses = useMemo(() => {
    const statuses = serviceReport?.services ?? [];
    return statuses.filter((serviceStatus) => {
      if (serviceSource !== "all" && serviceStatus.signalType !== serviceSource) {
        return false;
      }
      if (serviceFilter === "all") return true;
      if (serviceFilter === "problematic") {
        return serviceStatus.severity === "critical" || serviceStatus.severity === "warning";
      }
      if (serviceFilter === "slow") {
        return serviceStatus.severity === "warning" && serviceStatus.detailLabel?.toLowerCase().includes("slow");
      }
      if (serviceFilter === "no-check") {
        return serviceStatus.state === "no-check";
      }
      return true;
    });
  }, [serviceFilter, serviceReport, serviceSource]);

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
              Static config checks and runtime service status. Findings are advisory and do not block saving.
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

              <section className="space-y-4 rounded-md border border-theme-300 dark:border-theme-700 bg-theme-100/40 dark:bg-theme-800 p-4">
                <div>
                  <h2 className="text-lg font-semibold">Service Status</h2>
                  <p className="mt-1 text-sm text-theme-500 dark:text-theme-400">
                    Unified read-only view across ping, HTTP monitor, Docker, Kubernetes and Proxmox signals.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <SummaryCard label="Problematic" value={serviceReport?.summary?.problematic ?? 0} tone="error" />
                  <SummaryCard label="Slow" value={serviceReport?.summary?.slow ?? 0} tone="warning" />
                  <SummaryCard label="No Check" value={serviceReport?.summary?.noCheck ?? 0} tone="info" />
                  <SummaryCard label="OK" value={serviceReport?.summary?.ok ?? 0} tone="info" />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {SERVICE_FILTERS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setServiceFilter(item.value)}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                        serviceFilter === item.value
                          ? "bg-blue-600 text-white"
                          : "bg-theme-200 dark:bg-theme-700 text-theme-700 dark:text-theme-200 hover:bg-theme-300 dark:hover:bg-theme-600"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {SERVICE_SOURCES.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setServiceSource(item.value)}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                        serviceSource === item.value
                          ? "bg-blue-600 text-white"
                          : "bg-theme-200 dark:bg-theme-700 text-theme-700 dark:text-theme-200 hover:bg-theme-300 dark:hover:bg-theme-600"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                  <span className="text-xs text-theme-500">{visibleServiceStatuses.length} services shown</span>
                </div>

                <div className="overflow-x-auto rounded-md border border-theme-200 dark:border-theme-700 bg-white dark:bg-theme-900/40">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-theme-200 dark:border-theme-700 text-left text-theme-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">Service</th>
                        <th className="px-3 py-2 font-medium">Group</th>
                        <th className="px-3 py-2 font-medium">Source</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Latency</th>
                        <th className="px-3 py-2 font-medium">HTTP</th>
                        <th className="px-3 py-2 font-medium">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleServiceStatuses.map((serviceStatus) => (
                        <tr key={serviceStatus.id} className="border-b border-theme-100 dark:border-theme-700/70">
                          <td className="px-3 py-2 font-medium">{serviceStatus.name}</td>
                          <td className="px-3 py-2">{serviceStatus.group}</td>
                          <td className="px-3 py-2">{serviceStatus.signalType}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`rounded px-2 py-1 text-xs font-semibold uppercase ${
                                serviceStatus.severity === "critical"
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                  : serviceStatus.severity === "warning"
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                    : serviceStatus.severity === "neutral"
                                      ? "bg-theme-200 text-theme-700 dark:bg-theme-700 dark:text-theme-200"
                                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                              }`}
                            >
                              {serviceStatus.state}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {serviceStatus.latencyMs !== undefined ? `${serviceStatus.latencyMs} ms` : "—"}
                          </td>
                          <td className="px-3 py-2">{serviceStatus.httpStatus ?? "—"}</td>
                          <td className="px-3 py-2">{serviceStatus.detailLabel ?? "—"}</td>
                        </tr>
                      ))}
                      {visibleServiceStatuses.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-3 py-4 text-center text-theme-500 dark:text-theme-400">
                            No services match the current filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
