import {
  addUser,
  deleteUser,
  listSafeUsers,
  setUserPassword,
  updateUser,
} from "utils/config/users";
import { getSession, isAdminSession, isAuthenticatedSession } from "utils/config/session";
import createLogger from "utils/logger";

const logger = createLogger("users-api");

function mapUserError(e) {
  if (e.message === "user not found") {
    return 404;
  }
  if (e.message === "user already exists") {
    return 409;
  }
  if (
    e.message === "username is required" ||
    e.message === "password is required" ||
    e.message === "at least one admin user is required" ||
    e.message.startsWith("invalid role:")
  ) {
    return 422;
  }
  return 500;
}

function sendUserError(res, e) {
  const status = mapUserError(e);
  if (status === 500) {
    logger.error("User API failed: %s", e.message);
  }
  return res.status(status).json({ error: e.message });
}

async function requireAdmin(req, res) {
  const session = await getSession(req, res);
  if (!isAuthenticatedSession(session)) {
    res.status(401).json({ error: "Not authenticated" });
    return false;
  }
  if (!isAdminSession(session)) {
    res.status(403).json({ error: "Admin role required" });
    return false;
  }
  return true;
}

export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) {
    return undefined;
  }

  if (req.method === "GET") {
    return res.status(200).json({ users: listSafeUsers() });
  }

  if (req.method === "POST") {
    const { username, role, password, groups } = req.body ?? {};
    try {
      const user = await addUser({ username, role, password, groups });
      return res.status(201).json({ user });
    } catch (e) {
      return sendUserError(res, e);
    }
  }

  if (req.method === "PATCH") {
    const { username, role, password, groups } = req.body ?? {};
    if (role === undefined && password === undefined && groups === undefined) {
      return res.status(400).json({ error: "Request body must include role, password and/or groups" });
    }
    if (password !== undefined && (typeof password !== "string" || password.length === 0)) {
      return res.status(422).json({ error: "password is required" });
    }

    try {
      let user = null;
      if (role !== undefined || groups !== undefined) {
        user = updateUser(username, { role, groups });
      }
      if (password !== undefined) {
        user = await setUserPassword(username, password);
      }
      return res.status(200).json({ user });
    } catch (e) {
      return sendUserError(res, e);
    }
  }

  if (req.method === "DELETE") {
    const { username } = req.body ?? {};
    try {
      const user = deleteUser(username);
      return res.status(200).json({ deleted: true, user });
    } catch (e) {
      return sendUserError(res, e);
    }
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
