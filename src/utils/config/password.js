import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const SCHEME = "scrypt";

const scryptAsync = promisify(scrypt);

function isValidHex(value) {
  return typeof value === "string" && value.length > 0 && value.length % 2 === 0 && /^[0-9a-f]+$/i.test(value);
}

export async function hashPassword(password) {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("password is required");
  }

  const salt = randomBytes(SALT_LENGTH);
  const hash = await scryptAsync(password, salt, KEY_LENGTH);

  return `${SCHEME}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  if (typeof password !== "string" || typeof stored !== "string") {
    return false;
  }

  const [scheme, saltHex, hashHex, ...extra] = stored.split("$");
  if (scheme !== SCHEME || extra.length > 0 || !isValidHex(saltHex) || !isValidHex(hashHex)) {
    return false;
  }

  const expected = Buffer.from(hashHex, "hex");
  let actual;

  try {
    actual = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length);
  } catch {
    return false;
  }

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}
