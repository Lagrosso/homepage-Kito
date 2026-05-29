import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { checkAdminToken, isConfigEditEnabled } from "utils/config/admin-auth";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

beforeEach(() => {
  delete process.env.HOMEPAGE_CONFIG_EDIT;
  delete process.env.HOMEPAGE_CONFIG_EDIT_TOKEN;
});

describe("isConfigEditEnabled", () => {
  it("is disabled by default", () => {
    expect(isConfigEditEnabled()).toBe(false);
  });

  it("is enabled only for the exact string 'true'", () => {
    process.env.HOMEPAGE_CONFIG_EDIT = "true";
    expect(isConfigEditEnabled()).toBe(true);
    process.env.HOMEPAGE_CONFIG_EDIT = "1";
    expect(isConfigEditEnabled()).toBe(false);
  });
});

describe("checkAdminToken", () => {
  const req = (headers) => ({ headers });

  it("refuses when no token is configured", () => {
    expect(checkAdminToken(req({ authorization: "Bearer anything" }))).toBe(false);
  });

  it("accepts a matching Bearer token", () => {
    process.env.HOMEPAGE_CONFIG_EDIT_TOKEN = "s3cret";
    expect(checkAdminToken(req({ authorization: "Bearer s3cret" }))).toBe(true);
  });

  it("accepts a matching x-homepage-config-token header", () => {
    process.env.HOMEPAGE_CONFIG_EDIT_TOKEN = "s3cret";
    expect(checkAdminToken(req({ "x-homepage-config-token": "s3cret" }))).toBe(true);
  });

  it("rejects a wrong token", () => {
    process.env.HOMEPAGE_CONFIG_EDIT_TOKEN = "s3cret";
    expect(checkAdminToken(req({ authorization: "Bearer nope" }))).toBe(false);
  });

  it("rejects when no token is provided", () => {
    process.env.HOMEPAGE_CONFIG_EDIT_TOKEN = "s3cret";
    expect(checkAdminToken(req({}))).toBe(false);
  });
});
