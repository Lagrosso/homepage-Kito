import { useTranslation } from "next-i18next";

import { findServiceStatus, findSignal, useServiceStatusReport } from "utils/services/use-service-status";

const SLOW_THRESHOLD_MS = 1000;

// Map an aggregated siteMonitor signal back to the shape this component's render
// logic already expects ({ status, latency } or { error }), so only the data
// source changes — the display branches below stay identical.
function signalToData(signal) {
  if (!signal) {
    return undefined;
  }
  if (signal.state === "error") {
    return { error: "error" };
  }
  return { status: signal.httpStatus, latency: signal.latencyMs };
}

export default function SiteMonitor({ groupName, serviceName, style }) {
  const { t } = useTranslation();
  const { data: report, error } = useServiceStatusReport();
  const data = signalToData(findSignal(findServiceStatus(report, groupName, serviceName), "siteMonitor"));

  let colorClass = "text-black/20 dark:text-white/40 opacity-20";
  let backgroundClass = "bg-theme-500/10 dark:bg-theme-900/50 px-1.5 py-0.5";
  let statusTitle = t("siteMonitor.http_status");
  let statusText = "";

  if (error || (data && data.error)) {
    colorClass = "text-rose-500";
    statusText = t("siteMonitor.error");
    statusTitle += ` ${t("siteMonitor.error")}`;
  } else if (!data) {
    statusText = t("siteMonitor.response");
    statusTitle += ` ${t("siteMonitor.not_available")}`;
  } else if (data.status > 403) {
    colorClass = "text-rose-500/80";
    statusTitle += ` ${data.status}`;

    if (style === "basic") {
      statusText = t("siteMonitor.down");
    } else {
      statusText = data.status;
    }
  } else if (data) {
    const responseTime = t("common.ms", {
      value: data.latency,
      style: "unit",
      unit: "millisecond",
      maximumFractionDigits: 0,
    });
    const isSlow = data.latency >= SLOW_THRESHOLD_MS;
    statusTitle += isSlow
      ? ` ${data.status} (${responseTime}, ${t("siteMonitor.slow")})`
      : ` ${data.status} (${responseTime})`;
    colorClass = isSlow ? "text-orange-400/80 dark:text-orange-300/80" : "text-emerald-500/80";

    if (style === "basic") {
      statusText = isSlow ? t("siteMonitor.slow") : t("siteMonitor.up");
    } else {
      statusText = responseTime;
      colorClass += " lowercase";
    }
  }

  if (style === "dot") {
    backgroundClass = "p-4";
    colorClass = colorClass.replace(/text-/g, "bg-").replace(/\/\d\d/g, "");
  }

  return (
    <div
      className={`w-auto text-center rounded-[4px] overflow-hidden site-monitor-status ${backgroundClass}`}
      title={statusTitle}
    >
      {style !== "dot" && <div className={`font-bold uppercase text-[8px] ${colorClass}`}>{statusText}</div>}
      {style === "dot" && <div className={`rounded-full h-3 w-3 ${colorClass}`} />}
    </div>
  );
}
