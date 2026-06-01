import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import yaml from "js-yaml";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("utils/logger", () => ({ default: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }) }));

let confDir;
let usersMod;
let writerMod;

beforeEach(async () => {
  confDir = mkdtempSync(join(tmpdir(), "homepage-users-"));
  process.env.HOMEPAGE_CONFIG_DIR = confDir;
  vi.resetModules();
  usersMod = await import("utils/config/users");
  writerMod = await import("utils/config/config-writer");
});

afterEach(() => {
  rmSync(confDir, { recursive: true, force: true });
  delete process.env.HOMEPAGE_CONFIG_DIR;
});

describe("users store", () => {
  it("stores users in users.yaml outside EDITABLE_CONFIGS", async () => {
    const result = await usersMod.addUser({ username: "alice", password: "secret", role: "admin" });

    expect(result).toEqual({ username: "alice", role: "admin", groups: [] });
    expect(writerMod.EDITABLE_CONFIGS).not.toContain("users.yaml");
    expect(writerMod.isEditableConfig("users.yaml")).toBe(false);
    expect(existsSync(join(confDir, "users.yaml"))).toBe(true);
  });

  it("loads, finds and detects users", async () => {
    expect(usersMod.loadUsers()).toEqual([]);
    expect(usersMod.hasUsers()).toBe(false);
    expect(usersMod.findUser("alice")).toBeNull();

    await usersMod.addUser({ username: "alice", password: "secret", role: "viewer" });

    const users = usersMod.loadUsers();
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ username: "alice", role: "viewer" });
    expect(users[0].passwordHash).toMatch(/^scrypt\$/);
    expect(usersMod.hasUsers()).toBe(true);
    expect(usersMod.findUser("alice")).toEqual(users[0]);
  });

  it("lists safe users without password hashes", async () => {
    await usersMod.addUser({ username: "alice", password: "secret", role: "admin", groups: [" media ", "media", "kids"] });

    expect(usersMod.listSafeUsers()).toEqual([{ username: "alice", role: "admin", groups: ["media", "kids"] }]);
    expect(JSON.stringify(usersMod.listSafeUsers())).not.toContain("passwordHash");
  });

  it("writes users.yaml atomically with owner-only permissions", async () => {
    await usersMod.addUser({ username: "alice", password: "secret", role: "admin" });

    const usersPath = join(confDir, "users.yaml");
    const parsed = yaml.load(readFileSync(usersPath, "utf8"));
    expect(parsed.users[0].passwordHash).toMatch(/^scrypt\$/);
    expect(existsSync(`${usersPath}.tmp`)).toBe(false);
    expect(statSync(usersPath).mode & 0o777).toBe(0o600);
  });

  it("appends users and rejects duplicates", async () => {
    await usersMod.addUser({ username: "alice", password: "secret", role: "admin" });
    await usersMod.addUser({ username: "bob", password: "secret", role: "viewer", groups: "family, media, family" });

    expect(usersMod.loadUsers().map((user) => user.username)).toEqual(["alice", "bob"]);
    await expect(usersMod.addUser({ username: "alice", password: "secret", role: "viewer" })).rejects.toThrow(
      "user already exists",
    );
  });

  it("updates roles and password hashes", async () => {
    await usersMod.addUser({ username: "alice", password: "secret", role: "admin" });
    await usersMod.addUser({ username: "bob", password: "secret", role: "viewer", groups: "family, media, family" });
    const before = usersMod.findUser("bob").passwordHash;

    expect(usersMod.updateUserRole("bob", "admin")).toEqual({
      username: "bob",
      role: "admin",
      groups: ["family", "media"],
    });
    expect(usersMod.updateUser("bob", { groups: ["kids", "", "kids"] })).toEqual({
      username: "bob",
      role: "admin",
      groups: ["kids"],
    });
    await expect(usersMod.setUserPassword("bob", "changed")).resolves.toEqual({
      username: "bob",
      role: "admin",
      groups: ["kids"],
    });

    expect(usersMod.findUser("bob").role).toBe("admin");
    expect(usersMod.findUser("bob").groups).toEqual(["kids"]);
    expect(usersMod.findUser("bob").passwordHash).toMatch(/^scrypt\$/);
    expect(usersMod.findUser("bob").passwordHash).not.toBe(before);
  });

  it("deletes users", async () => {
    await usersMod.addUser({ username: "alice", password: "secret", role: "admin" });
    await usersMod.addUser({ username: "bob", password: "secret", role: "viewer" });

    expect(usersMod.deleteUser("bob")).toEqual({ username: "bob" });
    expect(usersMod.loadUsers().map((user) => user.username)).toEqual(["alice"]);
  });

  it("keeps at least one admin", async () => {
    await usersMod.addUser({ username: "alice", password: "secret", role: "admin" });

    expect(() => usersMod.updateUserRole("alice", "viewer")).toThrow("at least one admin user is required");
    expect(() => usersMod.deleteUser("alice")).toThrow("at least one admin user is required");
    expect(usersMod.findUser("alice")).toMatchObject({ username: "alice", role: "admin" });
  });

  it("validates roles and required fields", async () => {
    expect(usersMod.isValidRole("admin")).toBe(true);
    expect(usersMod.isValidRole("viewer")).toBe(true);
    expect(usersMod.isValidRole("editor")).toBe(false);
    expect(usersMod.normalizeGroups("family, media, family, ")).toEqual(["family", "media"]);

    await expect(usersMod.addUser({ username: "", password: "secret", role: "admin" })).rejects.toThrow(
      "username is required",
    );
    await expect(usersMod.addUser({ username: "alice", password: "", role: "admin" })).rejects.toThrow(
      "password is required",
    );
    await expect(usersMod.addUser({ username: "alice", password: "secret", role: "editor" })).rejects.toThrow(
      "invalid role: editor",
    );
    expect(() => usersMod.updateUserRole("missing", "admin")).toThrow("user not found");
    expect(() => usersMod.updateUserRole("alice", "editor")).toThrow("invalid role: editor");
    await expect(usersMod.setUserPassword("alice", "")).rejects.toThrow("password is required");
  });

  it("rejects malformed users.yaml", () => {
    writeFileSync(join(confDir, "users.yaml"), "users:\n  - username: alice\n    role: admin\n", "utf8");

    expect(() => usersMod.loadUsers()).toThrow("passwordHash is required");
  });
});
