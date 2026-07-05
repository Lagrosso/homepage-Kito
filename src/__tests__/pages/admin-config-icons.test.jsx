// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("components/resolvedicon", () => ({
  default: ({ icon, alt }) => <span data-testid="resolved-icon" data-icon={icon} aria-label={alt} />,
}));

vi.mock("components/admin/use-layout-governs", () => ({
  useLayoutGoverns: () => false,
}));

vi.mock("utils/config/service-widget-templates", () => ({
  SERVICE_WIDGET_TEMPLATES: [{ type: "jellyfin", label: "Jellyfin", fields: ["url"], displayFields: ["movies"] }],
  SERVICE_WIDGET_TEMPLATE_BY_TYPE: {
    jellyfin: { type: "jellyfin", label: "Jellyfin", fields: ["url"], displayFields: ["movies"] },
  },
  isServiceWidgetSecretField: () => false,
}));

vi.mock("components/admin/config-editor", () => ({
  default: ({ AddDialog }) => (
    <div>
      <AddDialog open onClose={vi.fn()} onAdd={vi.fn()} existingGroups={["Media"]} />
    </div>
  ),
  Field: ({ label, required, children }) => (
    <label>
      {label}
      {required ? "*" : ""}
      {children}
    </label>
  ),
  inputClass: "input",
  shortenUrl: (url) => url,
}));

vi.mock("utils/config/secret-mask", () => ({
  isPlaceholder: () => false,
  maskValue: (_key, value) => ({ value, redacted: false }),
}));

vi.mock("utils/config/yaml-edit", () => ({
  deleteServiceEntry: vi.fn(),
  deleteServiceWidget: vi.fn(),
  moveEntryInGroup: vi.fn(),
  moveEntryToGroup: vi.fn(),
  moveEntryToIndex: vi.fn(),
  moveGroup: vi.fn(),
  moveGroupToIndex: vi.fn(),
  updateServiceEntry: vi.fn(),
  updateServiceWidget: vi.fn(),
}));

vi.mock("utils/config/yaml-insert", () => ({
  insertService: vi.fn(),
}));

import AdminServicesConfig from "pages/admin/config";

function jsonResponse(body) {
  return { ok: true, status: 200, json: vi.fn().mockResolvedValue(body) };
}

// URL-routing fetch mock. The dialog loads the local-icon gallery on open, so a
// simple mockResolvedValueOnce sequence would be brittle; route by URL instead.
const state = { files: [], results: [], suggestions: [] };

function installFetch() {
  global.fetch = vi.fn((url, options) => {
    const u = String(url);
    if (u.startsWith("/api/config/icon-search")) {
      return Promise.resolve(jsonResponse({ results: state.results }));
    }
    if (u.startsWith("/api/config/icon-suggestions")) {
      return Promise.resolve(jsonResponse({ suggestions: state.suggestions }));
    }
    if (u === "/api/config/icon" && options?.method === "POST") {
      const body = JSON.parse(options.body);
      if (body.sourceUrl) {
        const filename = body.sourceUrl.split("/").pop();
        return Promise.resolve(jsonResponse({ path: `/api/config/icon?file=${filename}`, filename }));
      }
      const filename = body.filename.replace(/[^\w.]/g, "_");
      return Promise.resolve(jsonResponse({ path: `/api/config/icon?file=${filename}`, filename }));
    }
    if (u === "/api/config/icon") {
      return Promise.resolve(jsonResponse({ files: state.files }));
    }
    return Promise.resolve(jsonResponse({}));
  });
}

describe("/admin/config icon suggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.files = [];
    state.results = [];
    state.suggestions = [];
    installFetch();
  });

  it("loads heuristic icon suggestions and applies a selected icon to the form", async () => {
    state.suggestions = [
      { source: "dashboard-icons", icon: "jellyfin.svg", label: "jellyfin.svg", reason: "Found in dashboard-icons" },
    ];

    render(<AdminServicesConfig />);

    fireEvent.change(screen.getByLabelText(/Service Name/), { target: { value: "Jellyfin" } });
    fireEvent.change(screen.getByLabelText("URL"), { target: { value: "https://jellyfin.test/" } });
    fireEvent.click(screen.getByRole("button", { name: /Find icon/ }));

    await screen.findAllByText("jellyfin.svg");
    fireEvent.click(screen.getByRole("button", { name: /jellyfin\.svg/ }));

    expect(screen.getByDisplayValue("jellyfin.svg")).toBeInTheDocument();
  });

  it("searches dashboard icons and applies a chosen result", async () => {
    state.results = [
      {
        source: "dashboard-icons",
        icon: "grafana.svg",
        label: "grafana",
        previewUrl: "https://cdn/svg/grafana.svg",
        reason: "Dashboard-icons search match",
      },
    ];

    render(<AdminServicesConfig />);
    fireEvent.change(screen.getByLabelText(/Service Name/), { target: { value: "Svc" } });
    fireEvent.change(screen.getByLabelText("Search dashboard icons"), { target: { value: "grafana" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    const result = await screen.findByRole("button", { name: /grafana/i });
    fireEvent.click(result);

    expect(screen.getByDisplayValue("grafana.svg")).toBeInTheDocument();
  });

  it("shows the uploaded-icon gallery and applies a local icon reference", async () => {
    state.files = ["mine.png"];

    render(<AdminServicesConfig />);
    fireEvent.change(screen.getByLabelText(/Service Name/), { target: { value: "Svc" } });

    const galleryBtn = await screen.findByRole("button", { name: "mine.png" });
    fireEvent.click(galleryBtn);

    expect(screen.getByDisplayValue("/api/config/icon?file=mine.png")).toBeInTheDocument();
  });

  it("caches a remote search result locally and applies the returned local path", async () => {
    state.results = [
      {
        source: "dashboard-icons",
        icon: "grafana.svg",
        label: "grafana",
        previewUrl: "https://cdn/svg/grafana.svg",
        reason: "match",
      },
    ];

    render(<AdminServicesConfig />);
    fireEvent.change(screen.getByLabelText(/Service Name/), { target: { value: "Svc" } });
    fireEvent.change(screen.getByLabelText("Search dashboard icons"), { target: { value: "grafana" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByRole("button", { name: /grafana/i });

    fireEvent.click(screen.getByRole("button", { name: "Cache locally" }));

    await waitFor(() => expect(screen.getByDisplayValue("/api/config/icon?file=grafana.svg")).toBeInTheDocument());
  });
});
