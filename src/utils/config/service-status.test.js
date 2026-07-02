import { beforeEach, describe, expect, it, vi } from "vitest";

const { state, servicesResponse, pingLib, httpProxy, Docker, dockerCfg, kubeCfg, perf, proxmoxCfg } = vi.hoisted(
  () => {
    const state = {
      services: [],
      pingResponse: { alive: true, time: 10 },
      pingError: null,
      httpResponses: [],
      httpError: null,
      dockerContainers: [],
      dockerInspect: { State: { Status: "running", Health: { Status: "healthy" } } },
      kubeItems: [],
      proxmoxConfig: null,
    };

    const servicesResponse = vi.fn(async () => state.services);
    const pingLib = {
      probe: vi.fn(async () => {
        if (state.pingError) throw state.pingError;
        return state.pingResponse;
      }),
    };
    const httpProxy = vi.fn(async () => {
      if (state.httpError) throw state.httpError;
      return state.httpResponses.shift();
    });
    const Docker = vi.fn(function () {
      return {
        listContainers: vi.fn(async () => state.dockerContainers),
        getContainer: vi.fn(() => ({
          inspect: vi.fn(async () => state.dockerInspect),
        })),
        getService: vi.fn(() => ({
          inspect: vi.fn(async () => ({ Spec: { Mode: { Replicated: { Replicas: 2 } } } })),
        })),
        listTasks: vi.fn(async () => []),
      };
    });
    const dockerCfg = { default: vi.fn(() => ({ conn: {} })) };
    const kubeCfg = {
      getKubeConfig: vi.fn(() => ({
        makeApiClient: vi.fn(() => ({
          listNamespacedPod: vi.fn(async () => ({ items: state.kubeItems })),
        })),
      })),
    };
    const perf = { now: vi.fn(() => 0) };
    const proxmoxCfg = { getProxmoxConfig: vi.fn(() => state.proxmoxConfig) };

    return { state, servicesResponse, pingLib, httpProxy, Docker, dockerCfg, kubeCfg, perf, proxmoxCfg };
  },
);

vi.mock("utils/config/api-response", () => ({ servicesResponse }));
vi.mock("ping", () => ({ promise: pingLib }));
vi.mock("utils/proxy/http", () => ({ httpProxy }));
vi.mock("dockerode", () => ({ default: Docker }));
vi.mock("utils/config/docker", () => dockerCfg);
vi.mock("utils/config/kubernetes", () => kubeCfg);
vi.mock("perf_hooks", () => ({ performance: perf }));
vi.mock("utils/config/proxmox", () => proxmoxCfg);
vi.mock("utils/logger", () => ({ default: vi.fn(() => ({ debug: vi.fn() })) }));

describe("utils/config/service-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.services = [];
    state.pingResponse = { alive: true, time: 10 };
    state.pingError = null;
    state.httpResponses = [];
    state.httpError = null;
    state.dockerContainers = [];
    state.dockerInspect = { State: { Status: "running", Health: { Status: "healthy" } } };
    state.kubeItems = [];
    state.proxmoxConfig = null;
    perf.now.mockReset();
  });

  it("builds a report and marks slow ping, failing http and no-check services correctly", async () => {
    state.services = [
      {
        name: "Media",
        services: [
          { name: "Jellyfin", ping: "jellyfin.local", href: "http://jellyfin.local", widgets: [] },
          { name: "Grafana", siteMonitor: "http://grafana.local", href: "http://grafana.local", widgets: [] },
          { name: "Docs", href: "http://docs.local", widgets: [] },
        ],
        groups: [],
      },
    ];
    state.pingResponse = { alive: true, time: 1500 };
    state.httpResponses = [[500], [500]];
    perf.now.mockReturnValueOnce(0).mockReturnValueOnce(1500).mockReturnValueOnce(0).mockReturnValueOnce(5);

    const mod = await import("./service-status");
    const report = await mod.buildServiceStatusReport({ role: "viewer", groups: [] });

    expect(report.summary.total).toBe(3);
    expect(report.summary.problematic).toBe(2);
    expect(report.summary.slow).toBe(1);
    expect(report.summary.noCheck).toBe(1);

    expect(report.services[0]).toMatchObject({
      name: "Grafana",
      signalType: "siteMonitor",
      state: "down",
      severity: "critical",
      httpStatus: 500,
    });
    expect(report.services[1]).toMatchObject({
      name: "Jellyfin",
      signalType: "ping",
      state: "up",
      severity: "warning",
      slow: true,
      latencyMs: 1500,
    });
    expect(report.services[2]).toMatchObject({
      name: "Docs",
      signalType: "none",
      state: "no-check",
      severity: "neutral",
    });
  });

  it("bounds siteMonitor checks with a timeout so an unreachable host can't hang the status report", async () => {
    state.httpResponses = [[200]];

    const mod = await import("./service-status");
    await mod.fetchSiteMonitorSignal({ name: "Grafana", siteMonitor: "http://grafana.local" });

    expect(httpProxy).toHaveBeenCalledWith("http://grafana.local", {
      method: "HEAD",
      timeout: expect.any(Number),
    });
    expect(httpProxy.mock.calls[0][1].timeout).toBeGreaterThan(0);
  });

  it("does not double the timeout: an unreachable siteMonitor makes a single httpProxy call", async () => {
    // httpProxy's network-error/timeout shape: [500, "application/json", { error }]
    state.httpResponses = [[500, "application/json", { error: { message: "timed out" } }]];

    const mod = await import("./service-status");
    const signal = await mod.fetchSiteMonitorSignal({ name: "ZimaFiles", siteMonitor: "http://192.168.1.2/" });

    expect(httpProxy).toHaveBeenCalledTimes(1);
    expect(signal).toMatchObject({ signalType: "siteMonitor", state: "down", httpStatus: 500 });
  });

  it("maps docker, kubernetes and proxmox states into unified severities", async () => {
    state.services = [
      {
        name: "Infra",
        services: [
          { name: "DockerSvc", container: "docker-svc", server: "main", widgets: [] },
          { name: "KubeSvc", app: "kube-svc", namespace: "default", widgets: [] },
          { name: "ProxSvc", proxmoxNode: "pve", proxmoxVMID: "100", proxmoxType: "qemu", widgets: [] },
        ],
        groups: [],
      },
    ];
    state.dockerContainers = [{ Names: ["/docker-svc"] }];
    state.dockerInspect = { State: { Status: "running", Health: { Status: "unhealthy" } } };
    state.kubeItems = [{ status: { phase: "Pending" } }, { status: { phase: "Running" } }];
    state.proxmoxConfig = { pve: { url: "https://pve.local", token: "token", secret: "secret" } };
    state.httpResponses = [[200, "", Buffer.from(JSON.stringify({ data: { status: "paused" } }))]];

    const mod = await import("./service-status");
    const report = await mod.buildServiceStatusReport({ role: "admin", groups: [] });

    expect(report.services.find((service) => service.name === "DockerSvc")).toMatchObject({
      severity: "critical",
      state: "down",
      detailLabel: "Docker unhealthy",
    });
    expect(report.services.find((service) => service.name === "KubeSvc")).toMatchObject({
      severity: "warning",
      state: "unknown",
      detailLabel: "Kubernetes partial",
    });
    expect(report.services.find((service) => service.name === "ProxSvc")).toMatchObject({
      severity: "warning",
      state: "unknown",
      detailLabel: "Proxmox paused",
    });
  });

  it("filters statuses by problematic, slow and no-check", async () => {
    const mod = await import("./service-status");
    const statuses = [
      { id: "1", signalType: "ping", severity: "warning", state: "up", slow: true, detailLabel: "Slow ping (1200 ms)" },
      { id: "2", signalType: "siteMonitor", severity: "critical", state: "down", detailLabel: "HTTP 500" },
      { id: "3", signalType: "none", severity: "neutral", state: "no-check", detailLabel: "No check configured" },
      // warning that is NOT slow (e.g. docker "starting") must not be counted as slow
      { id: "4", signalType: "docker", severity: "warning", state: "unknown", detailLabel: "Docker starting" },
    ];

    expect(mod.filterStatuses(statuses, "problematic", "all").map((status) => status.id)).toEqual(["1", "2", "4"]);
    expect(mod.filterStatuses(statuses, "slow", "all").map((status) => status.id)).toEqual(["1"]);
    expect(mod.filterStatuses(statuses, "no-check", "all").map((status) => status.id)).toEqual(["3"]);
    expect(mod.filterStatuses(statuses, "all", "siteMonitor").map((status) => status.id)).toEqual(["2"]);
  });
});
