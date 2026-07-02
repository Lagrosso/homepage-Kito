import { performance } from "perf_hooks";

import { CoreV1Api } from "@kubernetes/client-node";
import Docker from "dockerode";
import { promise as ping } from "ping";

import { servicesResponse } from "utils/config/api-response";
import getDockerArguments from "utils/config/docker";
import { getKubeConfig } from "utils/config/kubernetes";
import { getMonitorTimeoutMs } from "utils/config/monitor-timeout";
import { getProxmoxConfig } from "utils/config/proxmox";
import createLogger from "utils/logger";
import { httpProxy } from "utils/proxy/http";

const logger = createLogger("service-status");

export const SLOW_THRESHOLD_MS = 1000;

const PRIORITY_BY_SIGNAL = {
  siteMonitor: 0,
  ping: 1,
  docker: 2,
  kubernetes: 3,
  proxmox: 4,
};

const SEVERITY_WEIGHT = {
  critical: 0,
  warning: 1,
  ok: 2,
  neutral: 3,
};

function serviceStatusKey(group, name) {
  return `${group}::${name}`;
}

function flattenServiceGroups(groups) {
  const items = [];

  function visit(group) {
    for (const service of group.services ?? []) {
      items.push({ group: group.name, name: service.name, service });
    }
    for (const subgroup of group.groups ?? []) {
      visit(subgroup);
    }
  }

  for (const group of groups ?? []) {
    visit(group);
  }

  return items;
}

function sortSignals(signals) {
  return [...signals].sort((left, right) => {
    const severityWeight = (SEVERITY_WEIGHT[left.severity] ?? 99) - (SEVERITY_WEIGHT[right.severity] ?? 99);
    if (severityWeight !== 0) {
      return severityWeight;
    }
    return (PRIORITY_BY_SIGNAL[left.signalType] ?? 99) - (PRIORITY_BY_SIGNAL[right.signalType] ?? 99);
  });
}

function buildNoCheckStatus(group, name, service) {
  return {
    id: serviceStatusKey(group, name),
    group,
    name,
    href: service.href,
    signalType: "none",
    state: "no-check",
    severity: "neutral",
    detailLabel: "No check configured",
    lastCheckedAt: new Date().toISOString(),
    problemSignals: [],
  };
}

function choosePrimarySignal(signals) {
  return sortSignals(signals)[0] ?? null;
}

function buildAggregatedStatus(group, name, service, signals) {
  const primary = choosePrimarySignal(signals);
  if (!primary) {
    return buildNoCheckStatus(group, name, service);
  }

  return {
    id: serviceStatusKey(group, name),
    group,
    name,
    href: service.href,
    signalType: primary.signalType,
    state: primary.state,
    severity: primary.severity,
    slow: Boolean(primary.slow),
    latencyMs: primary.latencyMs,
    httpStatus: primary.httpStatus,
    detailLabel: primary.detailLabel,
    lastCheckedAt: new Date().toISOString(),
    signals: sortSignals(signals),
    hasProblem: signals.some((signal) => ["critical", "warning"].includes(signal.severity)),
    problemSignals: sortSignals(signals.filter((signal) => ["critical", "warning"].includes(signal.severity))),
  };
}

function buildSummary(statuses) {
  return statuses.reduce(
    (summary, status) => {
      summary.total += 1;
      if (status.state === "no-check") summary.noCheck += 1;
      else if (status.severity === "critical") summary.problematic += 1;
      else if (status.severity === "warning") {
        summary.problematic += 1;
        if (status.slow) summary.slow += 1;
      } else if (status.severity === "ok") summary.ok += 1;
      else summary.neutral += 1;
      return summary;
    },
    { total: 0, problematic: 0, slow: 0, noCheck: 0, ok: 0, neutral: 0 },
  );
}

export function filterStatuses(statuses, filter = "all", source = "all") {
  return statuses.filter((status) => {
    if (source !== "all" && status.signalType !== source) {
      return false;
    }

    if (filter === "all") return true;
    if (filter === "problematic") return status.severity === "critical" || status.severity === "warning";
    if (filter === "slow") return status.slow === true;
    if (filter === "no-check") return status.state === "no-check";
    return true;
  });
}

export function sortStatuses(statuses) {
  return [...statuses].sort((left, right) => {
    const severityWeight = (SEVERITY_WEIGHT[left.severity] ?? 99) - (SEVERITY_WEIGHT[right.severity] ?? 99);
    if (severityWeight !== 0) {
      return severityWeight;
    }

    const latencyWeight = (right.latencyMs ?? -1) - (left.latencyMs ?? -1);
    if (latencyWeight !== 0) {
      return latencyWeight;
    }

    const groupCompare = left.group.localeCompare(right.group);
    if (groupCompare !== 0) {
      return groupCompare;
    }
    return left.name.localeCompare(right.name);
  });
}

export async function fetchPingSignal(service) {
  if (!service?.ping) return null;

  let hostname = service.ping;
  try {
    hostname = new URL(service.ping).hostname;
  } catch {}

  try {
    const response = await ping.probe(hostname);
    if (!response.alive) {
      return {
        signalType: "ping",
        state: "down",
        severity: "critical",
        detailLabel: "Ping down",
      };
    }

    const roundedLatency = Math.round(response.time ?? 0);
    const slow = roundedLatency >= SLOW_THRESHOLD_MS;
    return {
      signalType: "ping",
      state: "up",
      severity: slow ? "warning" : "ok",
      slow,
      latencyMs: roundedLatency,
      detailLabel: slow ? `Slow ping (${roundedLatency} ms)` : `${roundedLatency} ms`,
    };
  } catch (error) {
    logger.debug("Failed to fetch ping signal for %s: %s", service.name, error?.message ?? error);
    return {
      signalType: "ping",
      state: "error",
      severity: "critical",
      detailLabel: "Ping error",
    };
  }
}

export async function fetchSiteMonitorSignal(service) {
  if (!service?.siteMonitor) return null;

  // Bound each probe so one unreachable service can't stall the whole status
  // report (and saturate the browser connection pool). Shared, env-configurable
  // timeout via HOMEPAGE_MONITOR_TIMEOUT.
  const timeout = getMonitorTimeoutMs();

  try {
    let startTime = performance.now();
    let [status, , data] = await httpProxy(service.siteMonitor, { method: "HEAD", timeout });
    let endTime = performance.now();

    // A synthetic 500 with an { error } body means a network error/timeout, i.e. the
    // host is unreachable — skip the GET retry so an unreachable service costs one
    // timeout, not two (which would double the wait and pool-hold time).
    const headNetworkError = status === 500 && data?.error;
    if (status > 403 && !headNetworkError) {
      startTime = performance.now();
      [status] = await httpProxy(service.siteMonitor, { timeout });
      endTime = performance.now();
    }

    const latency = Math.round(endTime - startTime);
    if (status > 403) {
      return {
        signalType: "siteMonitor",
        state: "down",
        severity: "critical",
        httpStatus: status,
        latencyMs: latency,
        detailLabel: `HTTP ${status}`,
      };
    }

    const slow = latency >= SLOW_THRESHOLD_MS;
    return {
      signalType: "siteMonitor",
      state: "up",
      severity: slow ? "warning" : "ok",
      slow,
      httpStatus: status,
      latencyMs: latency,
      detailLabel: slow ? `Slow HTTP ${status} (${latency} ms)` : `HTTP ${status} (${latency} ms)`,
    };
  } catch (error) {
    logger.debug("Failed to fetch site monitor signal for %s: %s", service.name, error?.message ?? error);
    return {
      signalType: "siteMonitor",
      state: "error",
      severity: "critical",
      detailLabel: "HTTP monitor error",
    };
  }
}

export async function fetchDockerSignal(service) {
  if (!service?.container) return null;

  try {
    const dockerArgs = getDockerArguments(service.server || "");
    const docker = new Docker(dockerArgs.conn);
    const containers = await docker.listContainers({ all: true });

    if (!Array.isArray(containers)) {
      return {
        signalType: "docker",
        state: "error",
        severity: "critical",
        detailLabel: "Docker query failed",
      };
    }

    const containerNames = containers.flatMap((container) => container.Names.map((name) => name.replace(/^\//, "")));
    const containerExists = containerNames.includes(service.container);

    if (containerExists) {
      const container = docker.getContainer(service.container);
      const info = await container.inspect();
      if (info.State.Status?.includes("running")) {
        if (info.State.Health?.Status === "unhealthy") {
          return {
            signalType: "docker",
            state: "down",
            severity: "critical",
            detailLabel: "Docker unhealthy",
          };
        }
        if (info.State.Health?.Status === "starting") {
          return {
            signalType: "docker",
            state: "unknown",
            severity: "warning",
            detailLabel: "Docker starting",
          };
        }
        return {
          signalType: "docker",
          state: "up",
          severity: "ok",
          detailLabel: info.State.Health?.Status || "Docker running",
        };
      }

      return {
        signalType: "docker",
        state: "down",
        severity: "critical",
        detailLabel: info.State.Status || "Docker stopped",
      };
    }

    if (dockerArgs.swarm) {
      const serviceInfo = await docker.getService(service.container).inspect().catch(() => undefined);
      if (!serviceInfo) {
        return {
          signalType: "docker",
          state: "down",
          severity: "critical",
          detailLabel: "Docker service not found",
        };
      }

      const tasks = await docker
        .listTasks({
          filters: {
            service: [service.container],
            "desired-state": ["running"],
          },
        })
        .catch(() => []);

      if (serviceInfo.Spec.Mode?.Replicated) {
        const replicas = parseInt(serviceInfo.Spec.Mode?.Replicated?.Replicas, 10);
        if (tasks.length === replicas) {
          return {
            signalType: "docker",
            state: "up",
            severity: "ok",
            detailLabel: `Docker running ${tasks.length}/${replicas}`,
          };
        }
        if (tasks.length > 0) {
          return {
            signalType: "docker",
            state: "unknown",
            severity: "warning",
            detailLabel: `Docker partial ${tasks.length}/${replicas}`,
          };
        }
      }
    }

    return {
      signalType: "docker",
      state: "down",
      severity: "critical",
      detailLabel: "Docker not found",
    };
  } catch (error) {
    logger.debug("Failed to fetch docker signal for %s: %s", service.name, error?.message ?? error);
    return {
      signalType: "docker",
      state: "error",
      severity: "critical",
      detailLabel: "Docker error",
    };
  }
}

export async function fetchKubernetesSignal(service) {
  if (!service?.app) return null;

  try {
    const kc = getKubeConfig();
    if (!kc) {
      return {
        signalType: "kubernetes",
        state: "error",
        severity: "critical",
        detailLabel: "Kubernetes config missing",
      };
    }

    const APP_LABEL = "app.kubernetes.io/name";
    const labelSelector = service.podSelector !== undefined ? service.podSelector : `${APP_LABEL}=${service.app}`;
    const coreApi = kc.makeApiClient(CoreV1Api);
    const podsResponse = await coreApi.listNamespacedPod({
      namespace: service.namespace,
      labelSelector,
    });
    const pods = podsResponse.items;

    if (pods.length === 0) {
      return {
        signalType: "kubernetes",
        state: "down",
        severity: "critical",
        detailLabel: "Kubernetes not found",
      };
    }

    const someReady = pods.find((pod) => ["Succeeded", "Running"].includes(pod.status.phase));
    const allReady = pods.every((pod) => ["Succeeded", "Running"].includes(pod.status.phase));

    if (allReady) {
      return {
        signalType: "kubernetes",
        state: "up",
        severity: "ok",
        detailLabel: "Kubernetes running",
      };
    }

    if (someReady) {
      return {
        signalType: "kubernetes",
        state: "unknown",
        severity: "warning",
        detailLabel: "Kubernetes partial",
      };
    }

    return {
      signalType: "kubernetes",
      state: "down",
      severity: "critical",
      detailLabel: "Kubernetes down",
    };
  } catch (error) {
    logger.debug("Failed to fetch kubernetes signal for %s: %s", service.name, error?.message ?? error);
    return {
      signalType: "kubernetes",
      state: "error",
      severity: "critical",
      detailLabel: "Kubernetes error",
    };
  }
}

export async function fetchProxmoxSignal(service) {
  if (!(service?.proxmoxNode && service?.proxmoxVMID)) return null;

  try {
    const proxmoxConfig = getProxmoxConfig();
    if (!proxmoxConfig) {
      return {
        signalType: "proxmox",
        state: "error",
        severity: "critical",
        detailLabel: "Proxmox config missing",
      };
    }

    const nodeConfig =
      proxmoxConfig[service.proxmoxNode] ||
      (proxmoxConfig.url && proxmoxConfig.token && proxmoxConfig.secret
        ? { url: proxmoxConfig.url, token: proxmoxConfig.token, secret: proxmoxConfig.secret }
        : null);

    if (!nodeConfig) {
      return {
        signalType: "proxmox",
        state: "error",
        severity: "critical",
        detailLabel: "Proxmox node config missing",
      };
    }

    const vmType = service.proxmoxType || "qemu";
    const baseUrl = `${nodeConfig.url}/api2/json`;
    const headers = {
      Authorization: `PVEAPIToken=${nodeConfig.token}=${nodeConfig.secret}`,
    };
    const statusUrl = `${baseUrl}/nodes/${service.proxmoxNode}/${vmType}/${service.proxmoxVMID}/status/current`;
    const [status, , data] = await httpProxy(statusUrl, { method: "GET", headers });

    if (status !== 200) {
      return {
        signalType: "proxmox",
        state: "error",
        severity: "critical",
        detailLabel: "Proxmox status error",
      };
    }

    const parsedData = JSON.parse(Buffer.from(data).toString());
    const vmStatus = parsedData?.data?.status || "unknown";

    if (vmStatus === "running") {
      return {
        signalType: "proxmox",
        state: "up",
        severity: "ok",
        detailLabel: "Proxmox running",
      };
    }
    if (vmStatus === "paused") {
      return {
        signalType: "proxmox",
        state: "unknown",
        severity: "warning",
        detailLabel: "Proxmox paused",
      };
    }

    return {
      signalType: "proxmox",
      state: "down",
      severity: "critical",
      detailLabel: `Proxmox ${vmStatus}`,
    };
  } catch (error) {
    logger.debug("Failed to fetch proxmox signal for %s: %s", service.name, error?.message ?? error);
    return {
      signalType: "proxmox",
      state: "error",
      severity: "critical",
      detailLabel: "Proxmox error",
    };
  }
}

export async function fetchServiceSignals(service) {
  const signals = await Promise.all([
    fetchSiteMonitorSignal(service),
    fetchPingSignal(service),
    fetchDockerSignal(service),
    fetchKubernetesSignal(service),
    fetchProxmoxSignal(service),
  ]);
  return signals.filter(Boolean);
}

export async function buildServiceStatusReport(user) {
  const groups = await servicesResponse(user);
  const flattened = flattenServiceGroups(groups);
  const statuses = await Promise.all(
    flattened.map(async ({ group, name, service }) => {
      const signals = await fetchServiceSignals(service);
      return buildAggregatedStatus(group, name, service, signals);
    }),
  );

  const sorted = sortStatuses(statuses);
  return {
    generatedAt: new Date().toISOString(),
    summary: buildSummary(sorted),
    services: sorted,
  };
}
