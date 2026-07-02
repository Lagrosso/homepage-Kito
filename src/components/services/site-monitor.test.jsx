// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useServiceStatusReport } = vi.hoisted(() => ({ useServiceStatusReport: vi.fn() }));

// Mock only the shared SWR hook; keep the real (pure) lookup helpers.
vi.mock("utils/services/use-service-status", async (importActual) => ({
  ...(await importActual()),
  useServiceStatusReport,
}));

import SiteMonitor from "./site-monitor";

// Build an aggregated report shaped like /api/services/status for one service.
function reportWith(signal) {
  return { services: [{ group: "g", name: "s", signals: signal ? [signal] : [] }] };
}

function siteMonitorSignal({ state = "up", httpStatus, latencyMs } = {}) {
  return { signalType: "siteMonitor", state, httpStatus, latencyMs };
}

describe("components/services/site-monitor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useServiceStatusReport.mockReturnValue({ data: undefined, error: undefined });
  });

  it("renders a loading state when the report is not available yet", () => {
    useServiceStatusReport.mockReturnValue({ data: undefined, error: undefined });

    render(<SiteMonitor groupName="g" serviceName="s" />);

    expect(screen.getByText("siteMonitor.response")).toBeInTheDocument();
    expect(screen.getByText("siteMonitor.response").closest(".site-monitor-status")).toHaveAttribute(
      "title",
      expect.stringContaining("siteMonitor.not_available"),
    );
  });

  it("renders response time when status is up", () => {
    useServiceStatusReport.mockReturnValue({
      data: reportWith(siteMonitorSignal({ state: "up", httpStatus: 200, latencyMs: 10 })),
      error: undefined,
    });

    render(<SiteMonitor groupName="g" serviceName="s" />);

    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("renders up label for basic style when status is ok", () => {
    useServiceStatusReport.mockReturnValue({
      data: reportWith(siteMonitorSignal({ state: "up", httpStatus: 200, latencyMs: 1 })),
      error: undefined,
    });

    render(<SiteMonitor groupName="g" serviceName="s" style="basic" />);

    expect(screen.getByText("siteMonitor.up")).toBeInTheDocument();
  });

  it("renders a slow warning label for high latency in basic style", () => {
    useServiceStatusReport.mockReturnValue({
      data: reportWith(siteMonitorSignal({ state: "up", httpStatus: 200, latencyMs: 1500 })),
      error: undefined,
    });

    render(<SiteMonitor groupName="g" serviceName="s" style="basic" />);

    expect(screen.getByText("siteMonitor.slow")).toBeInTheDocument();
    expect(screen.getByText("siteMonitor.slow").closest(".site-monitor-status")).toHaveAttribute(
      "title",
      expect.stringContaining("siteMonitor.slow"),
    );
  });

  it("renders down label for failing status in basic style", () => {
    useServiceStatusReport.mockReturnValue({
      data: reportWith(siteMonitorSignal({ state: "down", httpStatus: 500, latencyMs: 0 })),
      error: undefined,
    });

    render(<SiteMonitor groupName="g" serviceName="s" style="basic" />);

    expect(screen.getByText("siteMonitor.down")).toBeInTheDocument();
  });

  it("renders the http status code for failing status in non-basic style", () => {
    useServiceStatusReport.mockReturnValue({
      data: reportWith(siteMonitorSignal({ state: "down", httpStatus: 500, latencyMs: 0 })),
      error: undefined,
    });

    render(<SiteMonitor groupName="g" serviceName="s" />);

    expect(screen.getByText("500")).toBeInTheDocument();
  });

  it("renders an error label when the report request errors", () => {
    useServiceStatusReport.mockReturnValue({ data: undefined, error: new Error("boom") });

    render(<SiteMonitor groupName="g" serviceName="s" />);

    expect(screen.getByText("siteMonitor.error")).toBeInTheDocument();
  });

  it("treats an error-state signal as an error", () => {
    useServiceStatusReport.mockReturnValue({
      data: reportWith(siteMonitorSignal({ state: "error" })),
      error: undefined,
    });

    render(<SiteMonitor groupName="g" serviceName="s" />);

    expect(screen.getByText("siteMonitor.error")).toBeInTheDocument();
  });

  it("shows not-available when the report has no matching siteMonitor signal", () => {
    useServiceStatusReport.mockReturnValue({
      data: { services: [{ group: "other", name: "x", signals: [] }] },
      error: undefined,
    });

    render(<SiteMonitor groupName="g" serviceName="s" />);

    expect(screen.getByText("siteMonitor.response")).toBeInTheDocument();
  });

  it("renders a dot when style is dot", () => {
    useServiceStatusReport.mockReturnValue({
      data: reportWith(siteMonitorSignal({ state: "down", httpStatus: 500, latencyMs: 0 })),
      error: undefined,
    });

    const { container } = render(<SiteMonitor groupName="g" serviceName="s" style="dot" />);

    expect(container.querySelector(".rounded-full")).toBeTruthy();
    expect(screen.queryByText("500")).toBeNull();
  });
});
