import { describe, expect, it } from "vitest";

import { isPlaceholder, isSensitiveKey, maskValue, REDACTED, tokenizePlaceholders } from "./secret-mask";

describe("isSensitiveKey", () => {
  it("matches the documented sensitive fields case-insensitively", () => {
    ["username", "password", "key", "apiKey", "token", "secret", "headers"].forEach((f) => {
      expect(isSensitiveKey(f)).toBe(true);
      expect(isSensitiveKey(f.toUpperCase())).toBe(true);
    });
  });

  it("treats safe keys as non-sensitive", () => {
    ["title", "theme", "provider", "url", "cpu"].forEach((f) => expect(isSensitiveKey(f)).toBe(false));
  });
});

describe("isPlaceholder", () => {
  it("recognizes VAR and FILE placeholders", () => {
    expect(isPlaceholder("{{HOMEPAGE_VAR_X}}")).toBe(true);
    expect(isPlaceholder("{{HOMEPAGE_FILE_Y}}")).toBe(true);
    expect(isPlaceholder("plain")).toBe(false);
  });
});

describe("maskValue", () => {
  it("redacts a sensitive top-level field", () => {
    expect(maskValue("password", "hunter2")).toEqual({ value: REDACTED, redacted: true });
  });

  it("keeps a placeholder visible even for a sensitive key", () => {
    expect(maskValue("key", "{{HOMEPAGE_VAR_API_KEY}}")).toEqual({
      value: "{{HOMEPAGE_VAR_API_KEY}}",
      redacted: false,
    });
  });

  it("shows safe primitive values as-is", () => {
    expect(maskValue("theme", "dark")).toEqual({ value: "dark", redacted: false });
    expect(maskValue("hideVersion", true)).toEqual({ value: "true", redacted: false });
  });

  it("masks values inside a secret-value container (providers) but keeps the names", () => {
    const { value, redacted } = maskValue("providers", { openweathermap: "secretkey", finnhub: "anotherkey" });
    expect(redacted).toBe(false);
    expect(value).toContain("openweathermap");
    expect(value).toContain("finnhub");
    expect(value).toContain(REDACTED);
    expect(value).not.toContain("secretkey");
    expect(value).not.toContain("anotherkey");
  });

  it("redacts sensitive keys nested in a generic object", () => {
    const { value } = maskValue("auth", { user: "bob", token: "DEEP_SECRET" });
    expect(value).toContain("bob");
    expect(value).toContain(REDACTED);
    expect(value).not.toContain("DEEP_SECRET");
  });

  it("restores tokenized placeholders inside containers", () => {
    const { tokenized, map } = tokenizePlaceholders("{{HOMEPAGE_VAR_OWM}}");
    const { value } = maskValue("providers", { openweathermap: tokenized }, map);
    expect(value).toContain("{{HOMEPAGE_VAR_OWM}}");
  });
});
