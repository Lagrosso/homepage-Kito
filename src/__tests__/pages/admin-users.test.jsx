// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { router } = vi.hoisted(() => ({
  router: { asPath: "/admin/users", pathname: "/admin/users", replace: vi.fn() },
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

import AdminUsers from "pages/admin/users";

function fetchResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

function usersResponse() {
  return fetchResponse({
    users: [
      { groups: [], role: "admin", username: "admin" },
      { groups: ["media"], role: "viewer", username: "viewer" },
    ],
  });
}

describe("/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    router.asPath = "/admin/users";
    router.pathname = "/admin/users";
    global.fetch = vi.fn();
  });

  it("redirects viewers away", async () => {
    global.fetch.mockResolvedValueOnce(
      fetchResponse({ authenticated: true, user: { role: "viewer", username: "viewer" } }),
    );

    render(<AdminUsers />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("shows the user list and add form to admins", async () => {
    global.fetch
      .mockResolvedValueOnce(fetchResponse({ authenticated: true, user: { role: "admin", username: "admin" } }))
      .mockResolvedValueOnce(usersResponse());

    render(<AdminUsers />);

    expect(await screen.findByRole("heading", { name: "Add User" })).toBeInTheDocument();
    expect(screen.getAllByText("admin").length).toBeGreaterThan(0);
    expect(screen.getAllByText("viewer").length).toBeGreaterThan(0);
  });

  it("creates, changes roles, resets passwords and deletes through the API", async () => {
    global.fetch
      .mockResolvedValueOnce(fetchResponse({ authenticated: true, user: { role: "admin", username: "admin" } }))
      .mockResolvedValueOnce(usersResponse())
      .mockResolvedValueOnce(fetchResponse({ user: { groups: [], role: "viewer", username: "bob" } }, 201))
      .mockResolvedValueOnce(usersResponse())
      .mockResolvedValueOnce(fetchResponse({ user: { groups: ["family", "media"], role: "viewer", username: "viewer" } }))
      .mockResolvedValueOnce(usersResponse())
      .mockResolvedValueOnce(fetchResponse({ user: { role: "admin", username: "viewer" } }))
      .mockResolvedValueOnce(usersResponse())
      .mockResolvedValueOnce(fetchResponse({ user: { role: "viewer", username: "viewer" } }))
      .mockResolvedValueOnce(usersResponse())
      .mockResolvedValueOnce(fetchResponse({ deleted: true, user: { username: "viewer" } }))
      .mockResolvedValueOnce(fetchResponse({ users: [{ role: "admin", username: "admin" }] }));

    render(<AdminUsers />);

    await screen.findByRole("heading", { name: "Add User" });

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "bob" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "bob", role: "viewer", password: "secret", groups: "" }),
      }),
    );

    fireEvent.change(screen.getByLabelText("Groups for viewer"), { target: { value: "family, media" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[1]);
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "viewer", groups: "family, media" }),
      }),
    );

    fireEvent.change(screen.getByLabelText("Role for viewer"), { target: { value: "admin" } });
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "viewer", role: "admin" }),
      }),
    );

    fireEvent.change(screen.getByLabelText("New password for viewer"), { target: { value: "changed" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Reset" })[1]);
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "viewer", password: "changed" }),
      }),
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[1]);
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "viewer" }),
      }),
    );
  });
});
