import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "utils/config/password";

describe("password hashing", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("correct horse battery staple");

    expect(hash).toMatch(/^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("secret");

    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("uses a new salt for each hash", async () => {
    const first = await hashPassword("secret");
    const second = await hashPassword("secret");

    expect(first).not.toBe(second);
  });

  it("rejects malformed or manipulated hashes", async () => {
    const hash = await hashPassword("secret");
    const manipulated = hash.replace(/.$/, (char) => (char === "0" ? "1" : "0"));

    expect(await verifyPassword("secret", manipulated)).toBe(false);
    expect(await verifyPassword("secret", "scrypt$not-hex$abc")).toBe(false);
    expect(await verifyPassword("secret", "pbkdf2$00$00")).toBe(false);
    expect(await verifyPassword("secret", null)).toBe(false);
  });

  it("requires a non-empty password when hashing", async () => {
    await expect(hashPassword("")).rejects.toThrow("password is required");
  });
});
