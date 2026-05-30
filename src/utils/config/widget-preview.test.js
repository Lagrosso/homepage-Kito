import { describe, expect, it } from "vitest";

import { isPlaceholder, isSensitiveKey, maskWidgetOptions, parseWidgets, REDACTED, SENSITIVE_FIELDS } from "./widget-preview";

describe("isSensitiveKey", () => {
  it("matches the documented sensitive fields case-insensitively", () => {
    ["username", "password", "key", "apiKey", "token", "secret"].forEach((f) => {
      expect(isSensitiveKey(f)).toBe(true);
      expect(isSensitiveKey(f.toUpperCase())).toBe(true);
    });
    expect(SENSITIVE_FIELDS).toEqual(expect.arrayContaining(["username", "password", "key", "apiKey", "token", "secret"]));
  });

  it("treats safe fields as non-sensitive", () => {
    ["provider", "url", "cpu", "target", "type", "fields"].forEach((f) => {
      expect(isSensitiveKey(f)).toBe(false);
    });
  });
});

describe("isPlaceholder", () => {
  it("recognizes VAR and FILE placeholders", () => {
    expect(isPlaceholder("{{HOMEPAGE_VAR_API_KEY}}")).toBe(true);
    expect(isPlaceholder("{{HOMEPAGE_FILE_SECRET}}")).toBe(true);
    expect(isPlaceholder("http://x/{{HOMEPAGE_VAR_Y}}/z")).toBe(true);
  });

  it("rejects plain values", () => {
    expect(isPlaceholder("supersecret")).toBe(false);
    expect(isPlaceholder("duckduckgo")).toBe(false);
    expect(isPlaceholder(42)).toBe(false);
  });
});

describe("maskWidgetOptions", () => {
  it("redacts sensitive values and keeps safe ones", () => {
    const fields = maskWidgetOptions({ url: "http://x", username: "admin", password: "s3cr3t", provider: "google" });
    const byKey = Object.fromEntries(fields.map((f) => [f.key, f]));
    expect(byKey.password).toEqual({ key: "password", value: REDACTED, redacted: true });
    expect(byKey.username).toEqual({ key: "username", value: REDACTED, redacted: true });
    expect(byKey.url).toEqual({ key: "url", value: "http://x", redacted: false });
    expect(byKey.provider.value).toBe("google");
  });

  it("never leaks the real secret value", () => {
    const fields = maskWidgetOptions({ key: "REAL_SECRET_VALUE" });
    expect(JSON.stringify(fields)).not.toContain("REAL_SECRET_VALUE");
  });

  it("keeps placeholders visible even for sensitive keys", () => {
    const fields = maskWidgetOptions({ key: "{{HOMEPAGE_VAR_API_KEY}}", password: "{{HOMEPAGE_FILE_PW}}" });
    const byKey = Object.fromEntries(fields.map((f) => [f.key, f]));
    expect(byKey.key).toEqual({ key: "key", value: "{{HOMEPAGE_VAR_API_KEY}}", redacted: false });
    expect(byKey.password.value).toBe("{{HOMEPAGE_FILE_PW}}");
  });

  it("masks sensitive keys nested inside object values", () => {
    const fields = maskWidgetOptions({ headers: { Authorization: "Bearer abc" }, opts: { key: "DEEP_SECRET" } });
    const byKey = Object.fromEntries(fields.map((f) => [f.key, f]));
    expect(byKey.headers).toEqual({ key: "headers", value: REDACTED, redacted: true });
    expect(byKey.opts.value).not.toContain("DEEP_SECRET");
    expect(byKey.opts.value).toContain(REDACTED);
  });
});

describe("parseWidgets", () => {
  it("returns a single synthetic section with one entry per widget", () => {
    const yamlText = ["---", "- resources:", "    cpu: true", "    disk: /", "- search:", "    provider: duckduckgo"].join("\n");
    const groups = parseWidgets(yamlText);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("Info Widgets");
    const types = groups[0].entries.map((e) => e.type);
    expect(types).toEqual(["resources", "search"]);
    expect(groups[0].entries[0].index).toBe(0);
  });

  it("redacts secrets while parsing real widget config", () => {
    const yamlText = ["- unifi_console:", "    url: https://unifi", "    username: admin", "    password: hunter2"].join("\n");
    const groups = parseWidgets(yamlText);
    const fields = groups[0].entries[0].fields;
    const pw = fields.find((f) => f.key === "password");
    expect(pw.redacted).toBe(true);
    expect(JSON.stringify(groups)).not.toContain("hunter2");
  });

  it("preserves unquoted {{HOMEPAGE_VAR_*}} placeholders in the model", () => {
    const yamlText = ["- glances:", "    url: {{HOMEPAGE_VAR_GLANCES_URL}}", "    password: {{HOMEPAGE_FILE_GLANCES_PW}}"].join("\n");
    const groups = parseWidgets(yamlText);
    const byKey = Object.fromEntries(groups[0].entries[0].fields.map((f) => [f.key, f]));
    expect(byKey.url.value).toBe("{{HOMEPAGE_VAR_GLANCES_URL}}");
    expect(byKey.password.value).toBe("{{HOMEPAGE_FILE_GLANCES_PW}}");
    expect(byKey.password.redacted).toBe(false);
  });

  it("returns an empty array for empty or non-list YAML", () => {
    expect(parseWidgets("")).toEqual([]);
    expect(parseWidgets("foo: bar")).toEqual([]);
  });

  it("throws on invalid YAML so the preview can report it", () => {
    expect(() => parseWidgets("- a:\n  - b\n   c: 1\n")).toThrow();
  });
});
