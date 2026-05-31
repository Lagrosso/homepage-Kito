import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import yaml from "js-yaml";

import { CONF_DIR } from "utils/config/config";
import { hashPassword } from "utils/config/password";

export const USERS_FILENAME = "users.yaml";
export const USERS_FILE = join(CONF_DIR, USERS_FILENAME);
export const ROLES = ["admin", "viewer"];

export function isValidRole(role) {
  return ROLES.includes(role);
}

function assertValidUsername(username) {
  if (typeof username !== "string" || username.trim().length === 0) {
    throw new Error("username is required");
  }
}

function assertValidPassword(password) {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("password is required");
  }
}

function normalizeUser(user) {
  if (!user || typeof user !== "object") {
    throw new Error("invalid user entry");
  }

  const { username, role, passwordHash } = user;
  assertValidUsername(username);

  if (!isValidRole(role)) {
    throw new Error(`invalid role: ${role}`);
  }

  if (typeof passwordHash !== "string" || passwordHash.length === 0) {
    throw new Error("passwordHash is required");
  }

  return { username, role, passwordHash };
}

export function loadUsers() {
  if (!existsSync(USERS_FILE)) {
    return [];
  }

  const data = yaml.load(readFileSync(USERS_FILE, "utf8")) ?? {};
  if (!data || typeof data !== "object" || !Array.isArray(data.users)) {
    throw new Error("users.yaml must contain a users list");
  }

  return data.users.map(normalizeUser);
}

export function hasUsers() {
  return loadUsers().length > 0;
}

export function findUser(username) {
  return loadUsers().find((user) => user.username === username) ?? null;
}

function writeUsers(users) {
  if (!existsSync(CONF_DIR)) {
    mkdirSync(CONF_DIR, { recursive: true });
  }

  const tmpPath = `${USERS_FILE}.tmp`;
  const content = yaml.dump({ users }, { lineWidth: -1 });
  writeFileSync(tmpPath, content, { encoding: "utf8", mode: 0o600 });
  renameSync(tmpPath, USERS_FILE);
}

export async function addUser({ username, password, role }) {
  assertValidUsername(username);
  assertValidPassword(password);

  if (!isValidRole(role)) {
    throw new Error(`invalid role: ${role}`);
  }

  const normalizedUsername = username.trim();
  const users = loadUsers();
  if (users.some((user) => user.username === normalizedUsername)) {
    throw new Error("user already exists");
  }

  const user = {
    username: normalizedUsername,
    role,
    passwordHash: await hashPassword(password),
  };

  writeUsers([...users, user]);

  return { username: user.username, role: user.role };
}
