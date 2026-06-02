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

function fetchResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

describe("/admin/config icon suggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("loads icon suggestions and applies a selected icon to the form", async () => {
    global.fetch.mockResolvedValueOnce(
      fetchResponse({
        suggestions: [
          {
            source: "dashboard-icons",
            icon: "jellyfin.svg",
            label: "jellyfin.svg",
            reason: "Found in dashboard-icons",
          },
        ],
      }),
    );

    render(<AdminServicesConfig />);

    fireEvent.change(screen.getByLabelText(/Service Name/), { target: { value: "Jellyfin" } });
    fireEvent.change(screen.getByLabelText("URL"), { target: { value: "https://jellyfin.test/" } });
    fireEvent.click(screen.getByRole("button", { name: /Find icon/ }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith("/api/config/icon-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Jellyfin",
          href: "https://jellyfin.test/",
          widgetType: undefined,
          currentIcon: "",
        }),
      }),
    );

    await screen.findAllByText("jellyfin.svg");
    fireEvent.click(screen.getByRole("button", { name: /jellyfin.svg/ }));

    expect(screen.getByDisplayValue("jellyfin.svg")).toBeInTheDocument();
  });
});
