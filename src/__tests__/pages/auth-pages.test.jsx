// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { router } = vi.hoisted(() => ({
  router: { query: {}, replace: vi.fn() },
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

import LoginPage from "pages/login";
import SetupPage from "pages/setup";

function fetchResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

describe("login and setup pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    router.query = {};
    global.fetch = vi.fn();
  });

  it("redirects login to setup when no user exists", async () => {
    global.fetch.mockResolvedValueOnce(fetchResponse({ hasUsers: false, setupRequired: true }));

    render(<LoginPage />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/setup"));
  });

  it("logs in and redirects to the requested dashboard path", async () => {
    router.query = { next: "/admin/config" };
    global.fetch
      .mockResolvedValueOnce(fetchResponse({ hasUsers: true, setupRequired: false }))
      .mockResolvedValueOnce(fetchResponse({ user: { role: "admin", username: "admin" } }));

    render(<LoginPage />);

    fireEvent.change(await screen.findByLabelText(/username/i), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/admin/config"));
    expect(global.fetch).toHaveBeenLastCalledWith("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "secret" }),
    });
  });

  it("redirects setup to login when a user already exists", async () => {
    global.fetch.mockResolvedValueOnce(fetchResponse({ hasUsers: true, setupRequired: false }));

    render(<SetupPage />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
  });

  it("creates the first admin and redirects to the dashboard", async () => {
    global.fetch
      .mockResolvedValueOnce(fetchResponse({ hasUsers: false, setupRequired: true }))
      .mockResolvedValueOnce(fetchResponse({ user: { role: "admin", username: "admin" } }, 201));

    render(<SetupPage />);

    fireEvent.change(await screen.findByLabelText(/username/i), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /create admin/i }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(global.fetch).toHaveBeenLastCalledWith("/api/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "secret" }),
    });
  });
});
