import { describe, expect, it } from "vitest";

import { REDACTED } from "./secret-mask";
import { parseSettings } from "./settings-preview";

// Helper: flatten the grouped model into { groupName, fields: {key: entry} }.
function byGroup(groups) {
  return Object.fromEntries(
    groups.map((g) => [g.name, Object.fromEntries(g.entries.map((e) => [e.key, e]))]),
  );
}

describe("parseSettings", () => {
  it("sorts known settings into curated groups", () => {
    const yamlText = [
      "title: My Homepage",
      "language: en",
      "theme: dark",
      "color: slate",
      "hideVersion: true",
    ].join("\n");
    const groups = parseSettings(yamlText);
    const names = groups.map((g) => g.name);
    expect(names).toContain("Allgemein");
    expect(names).toContain("Layout / UI");
    expect(names).toContain("Verhalten");

    const g = byGroup(groups);
    expect(g["Allgemein"].title.value).toBe("My Homepage");
    expect(g["Allgemein"].language.value).toBe("en");
    expect(g["Layout / UI"].theme.value).toBe("dark");
    expect(g["Verhalten"].hideVersion.value).toBe("true");
  });

  it("puts unrecognized fields into 'Weitere Einstellungen' instead of dropping them", () => {
    const groups = parseSettings(["title: X", "someCustomField: hello"].join("\n"));
    const g = byGroup(groups);
    expect(g["Weitere Einstellungen"].someCustomField.value).toBe("hello");
    expect(g["Allgemein"].title.value).toBe("X");
  });

  it("redacts provider secret values but keeps provider names visible", () => {
    const yamlText = ["providers:", "  openweathermap: realweatherkey", "  finnhub: realfinnhubkey"].join("\n");
    const groups = parseSettings(yamlText);
    const providers = byGroup(groups)["Provider / Integrationen"].providers;
    expect(providers.value).toContain("openweathermap");
    expect(providers.value).toContain("finnhub");
    expect(providers.value).toContain(REDACTED);
    expect(JSON.stringify(groups)).not.toContain("realweatherkey");
    expect(JSON.stringify(groups)).not.toContain("realfinnhubkey");
  });

  it("redacts sensitive field names recursively", () => {
    const yamlText = ["title: X", "auth:", "  password: hunter2", "  token: abc123"].join("\n");
    const groups = parseSettings(yamlText);
    const auth = byGroup(groups)["Weitere Einstellungen"].auth;
    expect(auth.value).toContain(REDACTED);
    expect(JSON.stringify(groups)).not.toContain("hunter2");
    expect(JSON.stringify(groups)).not.toContain("abc123");
  });

  it("keeps {{HOMEPAGE_VAR_*}} / {{HOMEPAGE_FILE_*}} placeholders visible (incl. unquoted)", () => {
    const yamlText = [
      "providers:",
      "  openweathermap: {{HOMEPAGE_VAR_OWM_KEY}}",
      "title: {{HOMEPAGE_FILE_TITLE}}",
    ].join("\n");
    const groups = parseSettings(yamlText);
    const g = byGroup(groups);
    expect(g["Allgemein"].title.value).toBe("{{HOMEPAGE_FILE_TITLE}}");
    expect(g["Allgemein"].title.redacted).toBe(false);
    expect(g["Provider / Integrationen"].providers.value).toContain("{{HOMEPAGE_VAR_OWM_KEY}}");
  });

  it("returns an empty array for empty or non-map YAML", () => {
    expect(parseSettings("")).toEqual([]);
    expect(parseSettings("- a\n- b")).toEqual([]);
  });

  it("throws on invalid YAML so the preview can report it", () => {
    expect(() => parseSettings("a:\n  - b\n   c: 1\n")).toThrow();
  });
});
