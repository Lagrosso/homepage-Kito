// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
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

const { AddDialog, EditDialog } = vi.hoisted(() => ({ AddDialog: {}, EditDialog: {} }));

vi.mock("components/admin/config-editor", () => ({
  default: (props) => {
    AddDialog.Component = props.AddDialog;
    EditDialog.Component = props.EditDialog;
    return <div />;
  },
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

const { insertService, updateServiceEntry } = vi.hoisted(() => ({
  insertService: vi.fn(),
  updateServiceEntry: vi.fn(),
}));

vi.mock("utils/config/yaml-edit", () => ({
  deleteServiceEntry: vi.fn(),
  deleteServiceWidget: vi.fn(),
  moveEntryInGroup: vi.fn(),
  moveEntryToGroup: vi.fn(),
  moveEntryToIndex: vi.fn(),
  moveGroup: vi.fn(),
  moveGroupToIndex: vi.fn(),
  updateServiceEntry,
  updateServiceWidget: vi.fn(),
}));

vi.mock("utils/config/yaml-insert", () => ({
  insertService,
}));

import AdminServicesConfig from "pages/admin/config";

function openDocsSection() {
  fireEvent.click(screen.getByText("Service docs (optional)"));
}

describe("/admin/config service docs form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    AddDialog.Component = undefined;
    EditDialog.Component = undefined;
  });

  it("includes only the filled docs fields when adding a service", () => {
    render(<AdminServicesConfig />);
    const onAdd = vi.fn();
    const { unmount } = render(
      <AddDialog.Component open onClose={vi.fn()} onAdd={onAdd} existingGroups={["Media"]} />,
    );

    fireEvent.change(screen.getByLabelText("Group*"), { target: { value: "Media" } });
    fireEvent.change(screen.getByLabelText("Service Name*"), { target: { value: "Jellyfin" } });
    openDocsSection();
    fireEvent.change(screen.getByLabelText("Zweck"), { target: { value: "Media server" } });
    fireEvent.change(screen.getByLabelText("Was tun bei Fehler"), { target: { value: "Restart container" } });

    fireEvent.submit(screen.getByLabelText("Service Name*").closest("form"));

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        docs: { purpose: "Media server", troubleshooting: "Restart container" },
      }),
    );
    unmount();
  });

  it("does not include a docs key when no docs field is filled", () => {
    render(<AdminServicesConfig />);
    const onAdd = vi.fn();
    render(<AddDialog.Component open onClose={vi.fn()} onAdd={onAdd} existingGroups={["Media"]} />);

    fireEvent.change(screen.getByLabelText("Group*"), { target: { value: "Media" } });
    fireEvent.change(screen.getByLabelText("Service Name*"), { target: { value: "Jellyfin" } });
    fireEvent.submit(screen.getByLabelText("Service Name*").closest("form"));

    expect(onAdd).toHaveBeenCalledWith(expect.not.objectContaining({ docs: expect.anything() }));
  });

  it("passes the siteMonitor URL when adding a service", () => {
    render(<AdminServicesConfig />);
    const onAdd = vi.fn();
    render(<AddDialog.Component open onClose={vi.fn()} onAdd={onAdd} existingGroups={["Media"]} />);

    fireEvent.change(screen.getByLabelText("Group*"), { target: { value: "Media" } });
    fireEvent.change(screen.getByLabelText("Service Name*"), { target: { value: "Jellyfin" } });
    fireEvent.change(screen.getByLabelText("Site monitor URL (optional)"), {
      target: { value: "http://jellyfin/health" },
    });
    fireEvent.submit(screen.getByLabelText("Service Name*").closest("form"));

    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ siteMonitor: "http://jellyfin/health" }));
  });

  it("prefills existing docs values and sends only changed fields when editing", () => {
    render(<AdminServicesConfig />);
    const onSubmit = vi.fn();
    render(
      <EditDialog.Component
        open
        onClose={vi.fn()}
        onSubmit={onSubmit}
        group="Media"
        initial={{
          name: "Jellyfin",
          href: "http://jellyfin/",
          docs: { purpose: "Media server", admin: "tob" },
        }}
        existingGroups={["Media"]}
      />,
    );

    openDocsSection();
    expect(screen.getByLabelText("Zweck")).toHaveValue("Media server");
    expect(screen.getByLabelText("Admin-Kontakt")).toHaveValue("tob");

    fireEvent.change(screen.getByLabelText("Zweck"), { target: { value: "Media & photo server" } });
    fireEvent.submit(screen.getByLabelText("Service Name*").closest("form"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ docs: { purpose: "Media & photo server" } }),
    );
  });
});
