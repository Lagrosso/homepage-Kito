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
  return { ok: status >= 200 && status < 300, status, json: vi.fn().mockResolvedValue(body) };
}

const GROUPS = [
  {
    name: "Media",
    entries: [
      { name: "Jellyfin", href: "http://jellyfin.local" },
      { name: "Sonarr", href: "http://sonarr.local" },
    ],
  },
  { name: "Tools", entries: [{ name: "Portainer", href: "http://portainer.local" }] },
];

// Minimal Card that surfaces the entry name and an Edit affordance when wired.
function Card({ entry, onEdit }) {
  return (
    <div>
      <span>{entry.name}</span>
      {onEdit && <button type="button" aria-label={`Edit ${entry.name}`} onClick={onEdit} />}
    </div>
  );
}

function renderEditor() {
  return render(
    <ConfigEditor
      configFile="services.yaml"
      title="Services"
      parse={() => GROUPS}
      Card={Card}
      EditDialog={() => null}
      editEntry={vi.fn()}
      deleteEntry={vi.fn()}
      reorderEntry={vi.fn()}
    />,
  );
}

async function renderReady() {
  global.fetch
    .mockResolvedValueOnce(fetchResponse({ authenticated: true, user: { role: "admin", username: "admin" } }))
    .mockResolvedValueOnce(fetchResponse({ content: "- Media: []\n", file: "services.yaml" }));
  renderEditor();
  await screen.findByRole("button", { name: "Save" }, { timeout: 5000 });
}

describe("ConfigEditor preview search + mobile tabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    router.asPath = "/admin/config";
    router.pathname = "/admin/config";
    global.fetch = vi.fn();
  });

  it("filters the card preview to matching entries as you type", async () => {
    await renderReady();

    expect(screen.getByText("Jellyfin")).toBeInTheDocument();
    expect(screen.getByText("Sonarr")).toBeInTheDocument();
    expect(screen.getByText("Portainer")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter preview"), { target: { value: "jellyfin" } });

    expect(screen.getByText("Jellyfin")).toBeInTheDocument();
    expect(screen.queryByText("Sonarr")).not.toBeInTheDocument();
    expect(screen.queryByText("Portainer")).not.toBeInTheDocument();
    // The non-matching group header is gone too.
    expect(screen.queryByText("Tools")).not.toBeInTheDocument();
  });

  it("hides reorder controls while filtering but keeps edit affordances", async () => {
    await renderReady();

    expect(screen.getByRole("button", { name: "Move Jellyfin up" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Jellyfin" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter preview"), { target: { value: "jellyfin" } });

    expect(screen.queryByRole("button", { name: "Move Jellyfin up" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Jellyfin" })).toBeInTheDocument();

    // Clearing the filter restores the reorder controls.
    fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));
    expect(screen.getByRole("button", { name: "Move Jellyfin up" })).toBeInTheDocument();
  });

  it("shows a 'No matches.' hint when the filter excludes everything", async () => {
    await renderReady();
    fireEvent.change(screen.getByLabelText("Filter preview"), { target: { value: "zzz-nope" } });
    expect(screen.getByText("No matches.")).toBeInTheDocument();
  });

  it("toggles the mobile YAML/Preview panes", async () => {
    await renderReady();

    const previewTab = screen.getByRole("button", { name: "Preview" });
    const yamlTab = screen.getByRole("button", { name: "YAML" });
    const yamlColumn = screen.getByLabelText("YAML").parentElement;

    expect(previewTab).toHaveAttribute("aria-pressed", "true");
    expect(yamlTab).toHaveAttribute("aria-pressed", "false");
    expect(yamlColumn.className).toContain("hidden");

    fireEvent.click(yamlTab);

    expect(yamlTab).toHaveAttribute("aria-pressed", "true");
    expect(previewTab).toHaveAttribute("aria-pressed", "false");
    // The mobile-hidden class is dropped once the YAML pane is active.
    expect(yamlColumn.className).not.toContain("hidden");
  });
});
