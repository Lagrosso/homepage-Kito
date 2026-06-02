// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import AdminTabs from "./admin-tabs";

const tabs = [
  { label: "Services", href: "/admin/config" },
  { label: "Bookmarks", href: "/admin/bookmarks" },
  { label: "Widgets", href: "/admin/widgets" },
  { label: "Settings", href: "/admin/settings" },
  { label: "Docker", href: "/admin/docker" },
  { label: "Import", href: "/admin/import" },
  { label: "Layout", href: "/admin/layout" },
  { label: "Theme", href: "/admin/theme" },
  { label: "Health", href: "/admin/health" },
  { label: "Users", href: "/admin/users" },
];

describe("components/admin/admin-tabs", () => {
  it("renders primary tabs in the mobile row and keeps secondary tabs in the More menu", () => {
    render(<AdminTabs tabs={tabs} activeHref="/admin/config" />);

    const mobile = screen.getByTestId("admin-tabs-mobile");
    expect(within(mobile).getByRole("link", { name: "Services" })).toHaveAttribute("href", "/admin/config");
    expect(within(mobile).getByRole("link", { name: "Bookmarks" })).toHaveAttribute("href", "/admin/bookmarks");
    expect(within(mobile).getByRole("link", { name: "Widgets" })).toHaveAttribute("href", "/admin/widgets");
    expect(within(mobile).getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/admin/settings");
    expect(within(mobile).getByRole("button", { name: /more admin tabs/i })).toBeInTheDocument();
    expect(within(mobile).queryByRole("link", { name: "Layout" })).not.toBeInTheDocument();
  });

  it("shows the active secondary tab label on the mobile menu button", () => {
    render(<AdminTabs tabs={tabs} activeHref="/admin/health" />);

    const mobile = screen.getByTestId("admin-tabs-mobile");
    expect(within(mobile).getByRole("button", { name: /more admin tabs/i })).toHaveTextContent("Health");
  });

  it("opens the More menu and exposes secondary links", () => {
    render(<AdminTabs tabs={tabs} activeHref="/admin/config" />);

    fireEvent.click(screen.getByRole("button", { name: /more admin tabs/i }));

    expect(screen.getByRole("menuitem", { name: "Docker" })).toHaveAttribute("href", "/admin/docker");
    expect(screen.getByRole("menuitem", { name: "Import" })).toHaveAttribute("href", "/admin/import");
    expect(screen.getByRole("menuitem", { name: "Layout" })).toHaveAttribute("href", "/admin/layout");
    expect(screen.getByRole("menuitem", { name: "Theme" })).toHaveAttribute("href", "/admin/theme");
    expect(screen.getByRole("menuitem", { name: "Health" })).toHaveAttribute("href", "/admin/health");
    expect(screen.getByRole("menuitem", { name: "Users" })).toHaveAttribute("href", "/admin/users");
  });

  it("renders all tabs in the desktop row", () => {
    render(<AdminTabs tabs={tabs} activeHref="/admin/users" />);

    const desktop = screen.getByTestId("admin-tabs-desktop");
    expect(within(desktop).getAllByRole("link")).toHaveLength(10);
    expect(within(desktop).getByRole("link", { name: "Users" })).toHaveAttribute("href", "/admin/users");
  });
});
