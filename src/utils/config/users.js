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

export function normalizeGroups(groups) {
  if (typeof groups === "string") {
    return normalizeGroups(groups.split(","));
  }
  if (!Array.isArray(groups)) {
    return [];
  }

  return [...new Set(groups.map((group) => String(group).trim()).filter((group) => group.length > 0))];
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

  return { username, role, passwordHash, groups: normalizeGroups(user.groups) };
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

export function listSafeUsers() {
  return loadUsers().map(({ username, role, groups }) => ({ username, role, groups }));
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

function assertAdminWouldRemain(users) {
  if (!users.some((user) => user.role === "admin")) {
    throw new Error("at least one admin user is required");
  }
}

function safeUser(user) {
  return { username: user.username, role: user.role, groups: user.groups };
}

export async function addUser({ username, password, role, groups }) {
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
    groups: normalizeGroups(groups),
    passwordHash: await hashPassword(password),
  };

  writeUsers([...users, user]);

  return safeUser(user);
}

export function updateUser(username, values = {}) {
  assertValidUsername(username);

  if (values.role !== undefined && !isValidRole(values.role)) {
    throw new Error(`invalid role: ${values.role}`);
  }

  const normalizedUsername = username.trim();
  const users = loadUsers();
  const index = users.findIndex((user) => user.username === normalizedUsername);
  if (index === -1) {
    throw new Error("user not found");
  }

  const nextUsers = users.map((user, userIndex) =>
    userIndex === index
      ? {
          ...user,
          ...(values.role !== undefined ? { role: values.role } : {}),
          ...(values.groups !== undefined ? { groups: normalizeGroups(values.groups) } : {}),
        }
      : user,
  );
  assertAdminWouldRemain(nextUsers);
  writeUsers(nextUsers);

  return safeUser(nextUsers[index]);
}

export function updateUserRole(username, role) {
  return updateUser(username, { role });
}

export async function setUserPassword(username, password) {
  assertValidUsername(username);
  assertValidPassword(password);

  const normalizedUsername = username.trim();
  const users = loadUsers();
  const index = users.findIndex((user) => user.username === normalizedUsername);
  if (index === -1) {
    throw new Error("user not found");
  }

  const passwordHash = await hashPassword(password);
  const nextUsers = users.map((user, userIndex) => (userIndex === index ? { ...user, passwordHash } : user));
  writeUsers(nextUsers);

  return safeUser(nextUsers[index]);
}

export function deleteUser(username) {
  assertValidUsername(username);

  const normalizedUsername = username.trim();
  const users = loadUsers();
  if (!users.some((user) => user.username === normalizedUsername)) {
    throw new Error("user not found");
  }

  const nextUsers = users.filter((user) => user.username !== normalizedUsername);
  assertAdminWouldRemain(nextUsers);
  writeUsers(nextUsers);

  return { username: normalizedUsername };
}
