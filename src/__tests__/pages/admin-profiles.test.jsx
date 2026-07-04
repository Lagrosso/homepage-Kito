// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { router } = vi.hoisted(() => ({
  router: { asPath: "/admin/profiles", pathname: "/admin/profiles", replace: vi.fn() },
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

import AdminProfilesConfig from "pages/admin/profiles";

function fetchResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

const SETTINGS_WITH_PROFILE = `---
# settings
title: My Homepage
profiles:
  Familie:
    groups: [family, kids]
`;

describe("/admin/profiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    router.asPath = "/admin/profiles";
    router.pathname = "/admin/profiles";
    global.fetch = vi.fn();
  });

  it("redirects viewers away", async () => {
    global.fetch.mockResolvedValueOnce(
      fetchResponse({ authenticated: true, user: { role: "viewer", username: "viewer" } }),
    );

    render(<AdminProfilesConfig />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  });

  it("lists existing profiles parsed from settings.yaml", async () => {
    global.fetch
      .mockResolvedValueOnce(fetchResponse({ authenticated: true, user: { role: "admin", username: "admin" } }))
      .mockResolvedValueOnce(fetchResponse({ content: SETTINGS_WITH_PROFILE, file: "settings.yaml" }));

    render(<AdminProfilesConfig />);

    expect(await screen.findByText("Familie")).toBeInTheDocument();
    expect(screen.getByLabelText("Groups for profile Familie")).toHaveValue("family, kids");
  });

  it("creates a new profile through the form (editor only, not saved yet)", async () => {
    global.fetch
      .mockResolvedValueOnce(fetchResponse({ authenticated: true, user: { role: "admin", username: "admin" } }))
      .mockResolvedValueOnce(fetchResponse({ content: SETTINGS_WITH_PROFILE, file: "settings.yaml" }));

    render(<AdminProfilesConfig />);
    await screen.findByText("Familie");

    fireEvent.change(screen.getByPlaceholderText("Profil-Name (z.B. Familie)"), { target: { value: "Gast" } });
    fireEvent.change(screen.getByPlaceholderText("Gruppen, kommagetrennt (z.B. family, kids)"), {
      target: { value: "guest" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Anlegen" }));

    expect(await screen.findByText("Gast")).toBeInTheDocument();
    expect(screen.getByLabelText("Groups for profile Gast")).toHaveValue("guest");
    // Only two fetches so far — nothing was written to disk by creating a profile.
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("renames a profile inline", async () => {
    global.fetch
      .mockResolvedValueOnce(fetchResponse({ authenticated: true, user: { role: "admin", username: "admin" } }))
      .mockResolvedValueOnce(fetchResponse({ content: SETTINGS_WITH_PROFILE, file: "settings.yaml" }));

    render(<AdminProfilesConfig />);
    await screen.findByText("Familie");

    fireEvent.click(screen.getByRole("button", { name: "Rename profile Familie" }));
    const renameInput = screen.getByDisplayValue("Familie");
    fireEvent.change(renameInput, { target: { value: "Zuhause" } });
    fireEvent.click(screen.getByRole("button", { name: "Save rename" }));

    expect(await screen.findByText("Zuhause")).toBeInTheDocument();
    expect(screen.queryByText("Familie")).not.toBeInTheDocument();
  });

  it("commits a groups edit on blur", async () => {
    global.fetch
      .mockResolvedValueOnce(fetchResponse({ authenticated: true, user: { role: "admin", username: "admin" } }))
      .mockResolvedValueOnce(fetchResponse({ content: SETTINGS_WITH_PROFILE, file: "settings.yaml" }));

    render(<AdminProfilesConfig />);
    await screen.findByText("Familie");

    const groupsInput = screen.getByLabelText("Groups for profile Familie");
    fireEvent.change(groupsInput, { target: { value: "family" } });
    fireEvent.blur(groupsInput);

    await waitFor(() => expect(screen.getByLabelText("Groups for profile Familie")).toHaveValue("family"));
  });

  it("deletes a profile after confirmation", async () => {
    global.fetch
      .mockResolvedValueOnce(fetchResponse({ authenticated: true, user: { role: "admin", username: "admin" } }))
      .mockResolvedValueOnce(fetchResponse({ content: SETTINGS_WITH_PROFILE, file: "settings.yaml" }));
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<AdminProfilesConfig />);
    await screen.findByText("Familie");

    fireEvent.click(screen.getByRole("button", { name: "Delete profile Familie" }));

    await waitFor(() => expect(screen.queryByText("Familie")).not.toBeInTheDocument());
    expect(screen.getByText("Noch keine Profile.")).toBeInTheDocument();
  });
});
