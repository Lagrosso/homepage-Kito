// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useSWR } = vi.hoisted(() => ({ useSWR: vi.fn() }));
vi.mock("swr", () => ({ default: useSWR }));

import PreviewProfileSwitcher from "./preview-profile-switcher";

describe("PreviewProfileSwitcher", () => {
  const profiles = { Familie: { groups: ["family", "kids"] }, Gast: { groups: ["guest"] } };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing for a non-admin session", () => {
    useSWR.mockReturnValue({ data: { user: { role: "viewer" } } });
    const { container } = render(
      <PreviewProfileSwitcher profiles={profiles} previewProfile={null} setPreviewProfile={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for an admin when no profiles exist yet", () => {
    useSWR.mockReturnValue({ data: { user: { role: "admin" } } });
    const { container } = render(
      <PreviewProfileSwitcher profiles={{}} previewProfile={null} setPreviewProfile={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("lists every profile plus a Normal option for an admin", () => {
    useSWR.mockReturnValue({ data: { user: { role: "admin" } } });
    render(<PreviewProfileSwitcher profiles={profiles} previewProfile={null} setPreviewProfile={vi.fn()} />);

    const select = screen.getByRole("combobox", { name: /preview dashboard as profile/i });
    expect(select).toHaveValue("");
    expect(screen.getByRole("option", { name: "Familie" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Gast" })).toBeInTheDocument();
  });

  it("calls setPreviewProfile with the profile's groups when selected", () => {
    useSWR.mockReturnValue({ data: { user: { role: "admin" } } });
    const setPreviewProfile = vi.fn();
    render(<PreviewProfileSwitcher profiles={profiles} previewProfile={null} setPreviewProfile={setPreviewProfile} />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Familie" } });
    expect(setPreviewProfile).toHaveBeenCalledWith({ name: "Familie", groups: ["family", "kids"] });
  });

  it("calls setPreviewProfile(null) when switching back to Normal", () => {
    useSWR.mockReturnValue({ data: { user: { role: "admin" } } });
    const setPreviewProfile = vi.fn();
    render(
      <PreviewProfileSwitcher
        profiles={profiles}
        previewProfile={{ name: "Familie", groups: ["family", "kids"] }}
        setPreviewProfile={setPreviewProfile}
      />,
    );

    const select = screen.getByRole("combobox");
    expect(select).toHaveValue("Familie");
    fireEvent.change(select, { target: { value: "" } });
    expect(setPreviewProfile).toHaveBeenCalledWith(null);
  });
});
