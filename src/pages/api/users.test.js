import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

import handler from "./users";

const mocks = vi.hoisted(() => ({
  addUser: vi.fn(),
  deleteUser: vi.fn(),
  getSession: vi.fn(),
  isAdminSession: vi.fn((session) => session?.user?.role === "admin"),
  isAuthenticatedSession: vi.fn((session) => Boolean(session?.user)),
  listSafeUsers: vi.fn(),
  setUserPassword: vi.fn(),
  updateUser: vi.fn(),
  updateUserRole: vi.fn(),
}));

vi.mock("utils/logger", () => ({ default: () => ({ error: vi.fn() }) }));

vi.mock("utils/config/session", () => ({
  getSession: mocks.getSession,
  isAdminSession: mocks.isAdminSession,
  isAuthenticatedSession: mocks.isAuthenticatedSession,
}));

vi.mock("utils/config/users", () => ({
  addUser: mocks.addUser,
  deleteUser: mocks.deleteUser,
  listSafeUsers: mocks.listSafeUsers,
  setUserPassword: mocks.setUserPassword,
  updateUser: mocks.updateUser,
  updateUserRole: mocks.updateUserRole,
}));

function req(method, body) {
  return { body, headers: {}, method };
}

function expectNoSecrets(body) {
  expect(JSON.stringify(body)).not.toContain("password");
  expect(JSON.stringify(body)).not.toContain("passwordHash");
  expect(JSON.stringify(body)).not.toContain("scrypt$");
}

describe("/api/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { role: "admin", username: "admin" } });
  });

  it("requires authentication and admin role", async () => {
    mocks.getSession.mockResolvedValueOnce({});
    const unauthenticated = createMockRes();
    await handler(req("GET"), unauthenticated);
    expect(unauthenticated.status).toHaveBeenCalledWith(401);

    mocks.getSession.mockResolvedValueOnce({ user: { role: "viewer", username: "viewer" } });
    const viewer = createMockRes();
    await handler(req("GET"), viewer);
    expect(viewer.status).toHaveBeenCalledWith(403);
  });

  it("lets admins list, create, update and delete safe users", async () => {
    mocks.listSafeUsers.mockReturnValue([{ groups: [], role: "admin", username: "admin" }]);
    mocks.addUser.mockResolvedValue({ groups: ["media"], role: "viewer", username: "bob" });
    mocks.updateUser.mockReturnValue({ groups: ["media"], role: "admin", username: "bob" });
    mocks.setUserPassword.mockResolvedValue({ groups: ["media"], role: "admin", username: "bob" });
    mocks.deleteUser.mockReturnValue({ username: "bob" });

    const list = createMockRes();
    await handler(req("GET"), list);
    expect(list.status).toHaveBeenCalledWith(200);
    expect(list.body).toEqual({ users: [{ groups: [], role: "admin", username: "admin" }] });

    const create = createMockRes();
    await handler(req("POST", { groups: "media", password: "secret", role: "viewer", username: "bob" }), create);
    expect(mocks.addUser).toHaveBeenCalledWith({
      groups: "media",
      password: "secret",
      role: "viewer",
      username: "bob",
    });
    expect(create.status).toHaveBeenCalledWith(201);
    expect(create.body).toEqual({ user: { groups: ["media"], role: "viewer", username: "bob" } });

    const patch = createMockRes();
    await handler(req("PATCH", { groups: ["media"], password: "changed", role: "admin", username: "bob" }), patch);
    expect(mocks.updateUser).toHaveBeenCalledWith("bob", { groups: ["media"], role: "admin" });
    expect(mocks.setUserPassword).toHaveBeenCalledWith("bob", "changed");
    expect(patch.status).toHaveBeenCalledWith(200);
    expect(patch.body).toEqual({ user: { groups: ["media"], role: "admin", username: "bob" } });

    const remove = createMockRes();
    await handler(req("DELETE", { username: "bob" }), remove);
    expect(mocks.deleteUser).toHaveBeenCalledWith("bob");
    expect(remove.status).toHaveBeenCalledWith(200);
    expect(remove.body).toEqual({ deleted: true, user: { username: "bob" } });

    expectNoSecrets(list.body);
    expectNoSecrets(create.body);
    expectNoSecrets(patch.body);
    expectNoSecrets(remove.body);
  });

  it("returns validation statuses from the user store", async () => {
    mocks.addUser.mockRejectedValueOnce(new Error("user already exists"));
    const duplicate = createMockRes();
    await handler(req("POST", { password: "secret", role: "viewer", username: "bob" }), duplicate);
    expect(duplicate.status).toHaveBeenCalledWith(409);

    mocks.updateUser.mockImplementationOnce(() => {
      throw new Error("user not found");
    });
    const missing = createMockRes();
    await handler(req("PATCH", { role: "admin", username: "missing" }), missing);
    expect(missing.status).toHaveBeenCalledWith(404);

    mocks.deleteUser.mockImplementationOnce(() => {
      throw new Error("at least one admin user is required");
    });
    const lastAdmin = createMockRes();
    await handler(req("DELETE", { username: "admin" }), lastAdmin);
    expect(lastAdmin.status).toHaveBeenCalledWith(422);
    expect(lastAdmin.body).toEqual({ error: "at least one admin user is required" });
  });

  it("rejects empty PATCH operations and unsupported methods", async () => {
    const empty = createMockRes();
    await handler(req("PATCH", { username: "bob" }), empty);
    expect(empty.status).toHaveBeenCalledWith(400);

    const missingPassword = createMockRes();
    await handler(req("PATCH", { password: "", role: "admin", username: "bob" }), missingPassword);
    expect(missingPassword.status).toHaveBeenCalledWith(422);
    expect(mocks.updateUser).not.toHaveBeenCalled();

    const unsupported = createMockRes();
    await handler(req("PUT"), unsupported);
    expect(unsupported.status).toHaveBeenCalledWith(405);
    expect(unsupported.headers.Allow).toBe("GET, POST, PATCH, DELETE");
  });
});
