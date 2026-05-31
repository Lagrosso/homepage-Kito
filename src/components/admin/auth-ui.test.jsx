// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useSWR } = vi.hoisted(() => ({
  useSWR: vi.fn(),
}));

vi.mock("swr", () => ({ default: useSWR }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import AdminNavLink from "./admin-nav-link";
import ConfigEditorLink from "./config-editor-link";

describe("admin auth UI links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows admin links for admins", () => {
    useSWR.mockReturnValue({ data: { authenticated: true, user: { role: "admin", username: "admin" } } });

    render(
      <>
        <AdminNavLink />
        <ConfigEditorLink />
      </>,
    );

    expect(screen.getByRole("link", { name: /admin/i })).toHaveAttribute("href", "/admin/config");
    expect(screen.getByRole("link", { name: /config editor/i })).toHaveAttribute("href", "/admin/config");
    expect(useSWR).toHaveBeenCalledWith("/api/auth/me");
  });

  it("hides admin links for viewers", () => {
    useSWR.mockReturnValue({ data: { authenticated: true, user: { role: "viewer", username: "viewer" } } });

    render(
      <>
        <AdminNavLink />
        <ConfigEditorLink />
      </>,
    );

    expect(screen.queryByRole("link", { name: /admin/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /config editor/i })).not.toBeInTheDocument();
  });
});
