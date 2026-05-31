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
      body: JSON.stringify({ content: "services: []\n" }),
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
});
