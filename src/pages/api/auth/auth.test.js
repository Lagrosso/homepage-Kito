import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

import loginHandler from "./login";
import logoutHandler from "./logout";
import meHandler from "./me";
import setupHandler from "./setup";
import stateHandler from "./state";

const mocks = vi.hoisted(() => ({
  addUser: vi.fn(),
  findUser: vi.fn(),
  getSession: vi.fn(),
  hasUsers: vi.fn(),
  isAuthenticatedSession: vi.fn((session) => Boolean(session?.user)),
  verifyPassword: vi.fn(),
}));

vi.mock("utils/config/password", () => ({
  verifyPassword: mocks.verifyPassword,
}));

vi.mock("utils/config/session", () => ({
  getSession: mocks.getSession,
  isAuthenticatedSession: mocks.isAuthenticatedSession,
}));

vi.mock("utils/config/users", () => ({
  addUser: mocks.addUser,
  findUser: mocks.findUser,
  hasUsers: mocks.hasUsers,
}));

function createReq(method, body) {
  return { body, headers: {}, method };
}

function expectNoPasswordHash(body) {
  expect(JSON.stringify(body)).not.toContain("passwordHash");
  expect(JSON.stringify(body)).not.toContain("scrypt$");
}

describe("/api/auth/state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports setupRequired true when no users exist", () => {
    mocks.hasUsers.mockReturnValue(false);
    const res = createMockRes();

    stateHandler(createReq("GET"), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ hasUsers: false, setupRequired: true });
  });

  it("reports setupRequired false when users exist", () => {
    mocks.hasUsers.mockReturnValue(true);
    const res = createMockRes();

    stateHandler(createReq("GET"), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ hasUsers: true, setupRequired: false });
  });
});

describe("/api/auth/setup", () => {
  let session;

  beforeEach(() => {
    vi.clearAllMocks();
    session = { save: vi.fn().mockResolvedValue(undefined) };
    mocks.getSession.mockResolvedValue(session);
  });

  it("creates the first admin user and starts a session", async () => {
    mocks.hasUsers.mockReturnValue(false);
    mocks.addUser.mockResolvedValue({ passwordHash: "scrypt$secret", role: "admin", username: "admin" });
    const res = createMockRes();

    await setupHandler(createReq("POST", { password: "secret", username: "admin" }), res);

    expect(mocks.addUser).toHaveBeenCalledWith({ password: "secret", role: "admin", username: "admin" });
    expect(session.user).toEqual({ role: "admin", username: "admin" });
    expect(session.save).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.body).toEqual({ user: { role: "admin", username: "admin" } });
    expectNoPasswordHash(res.body);
  });

  it("rejects a second setup attempt", async () => {
    mocks.hasUsers.mockReturnValue(true);
    const res = createMockRes();

    await setupHandler(createReq("POST", { password: "secret", username: "admin" }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(mocks.addUser).not.toHaveBeenCalled();
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it.each([
    ["missing username", { password: "secret", username: "" }],
    ["missing password", { password: "", username: "admin" }],
  ])("rejects invalid setup input: %s", async (name, body) => {
    mocks.hasUsers.mockReturnValue(false);
    const res = createMockRes();

    await setupHandler(createReq("POST", body), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.addUser).not.toHaveBeenCalled();
    expect(mocks.getSession).not.toHaveBeenCalled();
  });
});

describe("/api/auth/login", () => {
  let session;

  beforeEach(() => {
    vi.clearAllMocks();
    session = { save: vi.fn().mockResolvedValue(undefined) };
    mocks.getSession.mockResolvedValue(session);
  });

  it("logs in with valid credentials and starts a session", async () => {
    mocks.findUser.mockReturnValue({ passwordHash: "scrypt$secret", role: "admin", username: "admin" });
    mocks.verifyPassword.mockResolvedValue(true);
    const res = createMockRes();

    await loginHandler(createReq("POST", { password: "secret", username: " admin " }), res);

    expect(mocks.findUser).toHaveBeenCalledWith("admin");
    expect(mocks.verifyPassword).toHaveBeenCalledWith("secret", "scrypt$secret");
    expect(session.user).toEqual({ role: "admin", username: "admin" });
    expect(session.save).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ user: { role: "admin", username: "admin" } });
    expectNoPasswordHash(res.body);
  });

  it("rejects a wrong password with a generic 401", async () => {
    mocks.findUser.mockReturnValue({ passwordHash: "scrypt$secret", role: "admin", username: "admin" });
    mocks.verifyPassword.mockResolvedValue(false);
    const res = createMockRes();

    await loginHandler(createReq("POST", { password: "wrong", username: "admin" }), res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toEqual({ error: "Invalid username or password" });
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it("rejects an unknown user with the same generic 401", async () => {
    mocks.findUser.mockReturnValue(null);
    const res = createMockRes();

    await loginHandler(createReq("POST", { password: "secret", username: "unknown" }), res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toEqual({ error: "Invalid username or password" });
    expect(mocks.verifyPassword).not.toHaveBeenCalled();
    expect(mocks.getSession).not.toHaveBeenCalled();
  });
});

describe("/api/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("destroys the session", async () => {
    const session = { destroy: vi.fn() };
    mocks.getSession.mockResolvedValue(session);
    const res = createMockRes();

    await logoutHandler(createReq("POST"), res);

    expect(session.destroy).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalledWith();
  });
});

describe("/api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue({});
    const res = createMockRes();

    await meHandler(createReq("GET"), res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toEqual({ authenticated: false });
  });

  it("returns safe user data for the current session", async () => {
    mocks.getSession.mockResolvedValue({
      user: { passwordHash: "scrypt$secret", role: "viewer", username: "viewer" },
    });
    const res = createMockRes();

    await meHandler(createReq("GET"), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ authenticated: true, user: { role: "viewer", username: "viewer" } });
    expectNoPasswordHash(res.body);
  });
});
