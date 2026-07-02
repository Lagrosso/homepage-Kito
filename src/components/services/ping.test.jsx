// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useServiceStatusReport } = vi.hoisted(() => ({ useServiceStatusReport: vi.fn() }));

// Mock only the shared SWR hook; keep the real (pure) lookup helpers.
vi.mock("utils/services/use-service-status", async (importActual) => ({
  ...(await importActual()),
  useServiceStatusReport,
}));

import Ping from "./ping";

// Build an aggregated report shaped like /api/services/status for one service.
function reportWith(signal) {
  return { services: [{ group: "g", name: "s", signals: signal ? [signal] : [] }] };
}

function pingSignal({ state = "up", latencyMs } = {}) {
  return { signalType: "ping", state, latencyMs };
}

describe("components/services/ping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useServiceStatusReport.mockReturnValue({ data: undefined, error: undefined });
  });

  it("renders a loading state when the report is not available yet", () => {
    useServiceStatusReport.mockReturnValue({ data: undefined, error: undefined });

    render(<Ping groupName="g" serviceName="s" />);

    expect(screen.getByText("ping.ping")).toBeInTheDocument();
    expect(screen.getByText("ping.ping").closest(".ping-status")).toHaveAttribute(
      "title",
      expect.stringContaining("ping.not_available"),
    );
  });

  it("renders an error label when the report request errors", () => {
    useServiceStatusReport.mockReturnValue({ data: undefined, error: new Error("boom") });

    render(<Ping groupName="g" serviceName="s" />);

    expect(screen.getByText("ping.error")).toBeInTheDocument();
  });

  it("treats an error-state signal as an error", () => {
    useServiceStatusReport.mockReturnValue({ data: reportWith(pingSignal({ state: "error" })), error: undefined });

    render(<Ping groupName="g" serviceName="s" />);

    expect(screen.getByText("ping.error")).toBeInTheDocument();
  });

  it("renders down when the host is not alive", () => {
    useServiceStatusReport.mockReturnValue({
      data: reportWith(pingSignal({ state: "down", latencyMs: 0 })),
      error: undefined,
    });

    render(<Ping groupName="g" serviceName="s" />);

    expect(screen.getByText("ping.down")).toBeInTheDocument();
  });

  it("renders the ping time when the host is alive", () => {
    useServiceStatusReport.mockReturnValue({
      data: reportWith(pingSignal({ state: "up", latencyMs: 123 })),
      error: undefined,
    });

    render(<Ping groupName="g" serviceName="s" />);

    expect(screen.getByText("123")).toBeInTheDocument();
    expect(screen.getByText("123").closest(".ping-status")).toHaveAttribute(
      "title",
      expect.stringContaining("ping.up"),
    );
  });

  it("renders an up label for basic style", () => {
    useServiceStatusReport.mockReturnValue({
      data: reportWith(pingSignal({ state: "up", latencyMs: 1 })),
      error: undefined,
    });

    render(<Ping groupName="g" serviceName="s" style="basic" />);

    expect(screen.getByText("ping.up")).toBeInTheDocument();
  });

  it("renders a slow warning label for high latency in basic style", () => {
    useServiceStatusReport.mockReturnValue({
      data: reportWith(pingSignal({ state: "up", latencyMs: 1500 })),
      error: undefined,
    });

    render(<Ping groupName="g" serviceName="s" style="basic" />);

    expect(screen.getByText("ping.slow")).toBeInTheDocument();
    expect(screen.getByText("ping.slow").closest(".ping-status")).toHaveAttribute(
      "title",
      expect.stringContaining("ping.slow"),
    );
  });

  it("shows not-available when the report has no matching ping signal", () => {
    useServiceStatusReport.mockReturnValue({
      data: { services: [{ group: "other", name: "x", signals: [] }] },
      error: undefined,
    });

    render(<Ping groupName="g" serviceName="s" />);

    expect(screen.getByText("ping.ping")).toBeInTheDocument();
  });

  it("renders a dot when style is dot", () => {
    useServiceStatusReport.mockReturnValue({
      data: reportWith(pingSignal({ state: "up", latencyMs: 5 })),
      error: undefined,
    });

    const { container } = render(<Ping groupName="g" serviceName="s" style="dot" />);

    expect(screen.queryByText("5")).not.toBeInTheDocument();
    expect(container.querySelector(".rounded-full")).toBeTruthy();
  });
});
