// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { router } = vi.hoisted(() => ({
  router: { asPath: "/admin/config", pathname: "/admin/config", replace: vi.fn() },
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

import ConfigEditor from "./config-editor";

function fetchResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

function renderEditor() {
  return render(<ConfigEditor configFile="services.yaml" title="Services" parse={() => []} Card={() => <div />} />);
}

describe("ConfigEditor auth behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    router.asPath = "/admin/config";
    router.pathname = "/admin/config";
    global.fetch = vi.fn();
  });

  it("saves with the session cookie flow and no token or Authorization header", async () => {
    global.fetch
      .mockResolvedValueOnce(fetchResponse({ authenticated: true, user: { role: "admin", username: "admin" } }))
      .mockResolvedValueOnce(fetchResponse({ content: "services: []\n", file: "services.yaml" }))
      .mockResolvedValueOnce(fetchResponse({ backupPath: "/tmp/backup", written: true }));

    renderEditor();

    await screen.findByRole("button", { name: "Save" });
    expect(screen.queryByLabelText(/config edit token/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByText(/Saved\. Backup:/)).toBeInTheDocument());
    expect(global.fetch).toHaveBeenLastCalledWith("/api/config/raw/services.yaml", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save",
        comment: "",
        content: "services: []\n",
        sourceBackupId: null,
      }),
    });
    expect(JSON.stringify(global.fetch.mock.calls)).not.toContain("Authorization");
  });

  it("redirects viewers away from admin pages before loading raw config", async () => {
    global.fetch.mockResolvedValueOnce(
      fetchResponse({ authenticated: true, user: { role: "viewer", username: "viewer" } }),
    );

    renderEditor();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("runs a health check for the current editor content", async () => {
    global.fetch
      .mockResolvedValueOnce(fetchResponse({ authenticated: true, user: { role: "admin", username: "admin" } }))
      .mockResolvedValueOnce(fetchResponse({ content: "- Media: []\n", file: "services.yaml" }))
      .mockResolvedValueOnce(
        fetchResponse({
          summary: { errors: 0, warnings: 1, info: 0 },
          files: {
            "services.yaml": {
              summary: { errors: 0, warnings: 1, info: 0 },
              checks: [
                {
                  id: "services.yaml:missing-service-href:1",
                  severity: "warning",
                  file: "services.yaml",
                  path: "Media > Sonarr.href",
                  message: "This service has no href.",
                  suggestion: "Add an href.",
                  line: null,
                  column: null,
                },
              ],
            },
          },
        }),
      );

    renderEditor();

    fireEvent.click(await screen.findByRole("button", { name: "Health check" }));

    await waitFor(() => expect(screen.getByText(/Health: 0 errors, 1 warnings, 0 info/)).toBeInTheDocument());
    expect(screen.getByText("This service has no href.")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenLastCalledWith("/api/config/health", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: "services.yaml", content: "- Media: []\n" }),
    });
  });
});
