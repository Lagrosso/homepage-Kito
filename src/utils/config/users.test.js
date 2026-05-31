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

    expect(result).toEqual({ username: "alice", role: "admin" });
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
    await usersMod.addUser({ username: "bob", password: "secret", role: "viewer" });

    expect(usersMod.loadUsers().map((user) => user.username)).toEqual(["alice", "bob"]);
    await expect(usersMod.addUser({ username: "alice", password: "secret", role: "viewer" })).rejects.toThrow(
      "user already exists",
    );
  });

  it("validates roles and required fields", async () => {
    expect(usersMod.isValidRole("admin")).toBe(true);
    expect(usersMod.isValidRole("viewer")).toBe(true);
    expect(usersMod.isValidRole("editor")).toBe(false);

    await expect(usersMod.addUser({ username: "", password: "secret", role: "admin" })).rejects.toThrow(
      "username is required",
    );
    await expect(usersMod.addUser({ username: "alice", password: "", role: "admin" })).rejects.toThrow(
      "password is required",
    );
    await expect(usersMod.addUser({ username: "alice", password: "secret", role: "editor" })).rejects.toThrow(
      "invalid role: editor",
    );
  });

  it("rejects malformed users.yaml", () => {
    writeFileSync(join(confDir, "users.yaml"), "users:\n  - username: alice\n    role: admin\n", "utf8");

    expect(() => usersMod.loadUsers()).toThrow("passwordHash is required");
  });
});
