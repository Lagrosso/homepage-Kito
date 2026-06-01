// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { router } = vi.hoisted(() => ({
  router: { asPath: "/admin/health", pathname: "/admin/health", replace: vi.fn() },
}));

vi.mock("next/head", () => ({ default: ({ children }) => children }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("next/router", () => ({ useRouter: () => router }));
vi.mock("components/admin/logout-button", () => ({ default: () => <button type="button">Logout</button> }));

import AdminHealth from "pages/admin/health";

function fetchResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

const healthReport = {
  summary: { errors: 1, warnings: 1, info: 1 },
  files: {
    "services.yaml": {
      summary: { errors: 1, warnings: 1, info: 0 },
      checks: [
        {
          id: "services.yaml:yaml-syntax:1",
          severity: "error",
          file: "services.yaml",
          path: "services.yaml",
          message: "YAML syntax error",
          suggestion: "Fix YAML.",
          line: 2,
          column: 3,
        },
        {
          id: "services.yaml:missing-service-href:2",
          severity: "warning",
          file: "services.yaml",
          path: "Media > Sonarr.href",
          message: "Missing href",
          suggestion: "Add href.",
          line: null,
          column: null,
        },
      ],
    },
    "settings.yaml": {
      summary: { errors: 0, warnings: 0, info: 1 },
      checks: [
        {
          id: "settings.yaml:note:1",
          severity: "info",
          file: "settings.yaml",
          path: "settings.yaml",
          message: "Looks okay",
          suggestion: "No action.",
          line: null,
          column: null,
        },
      ],
    },
  },
};

describe("/admin/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    router.asPath = "/admin/health";
    router.pathname = "/admin/health";
    global.fetch = vi.fn();
  });

  it("redirects viewers away", async () => {
    global.fetch.mockResolvedValueOnce(
      fetchResponse({ authenticated: true, user: { role: "viewer", username: "viewer" } }),
    );

    render(<AdminHealth />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("loads the health report and filters by severity", async () => {
    global.fetch
      .mockResolvedValueOnce(fetchResponse({ authenticated: true, user: { role: "admin", username: "admin" } }))
      .mockResolvedValueOnce(fetchResponse(healthReport));

    render(<AdminHealth />);

    expect(await screen.findByRole("heading", { name: "Config Health" })).toBeInTheDocument();
    expect(await screen.findByText("YAML syntax error")).toBeInTheDocument();
    expect(screen.getByText("Missing href")).toBeInTheDocument();
    expect(screen.getByText("Looks okay")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Warnings" }));

    expect(screen.queryByText("YAML syntax error")).not.toBeInTheDocument();
    expect(screen.getByText("Missing href")).toBeInTheDocument();
    expect(screen.queryByText("Looks okay")).not.toBeInTheDocument();
  });
});
