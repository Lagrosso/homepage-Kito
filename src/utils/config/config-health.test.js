import { describe, expect, it } from "vitest";

import { buildHealthReport, buildSingleFileHealthReport } from "./config-health";

const EMPTY_FILES = {
  "services.yaml": "",
  "bookmarks.yaml": "",
  "widgets.yaml": "",
  "settings.yaml": "",
};

function allChecks(report) {
  return Object.values(report.files).flatMap((file) => file.checks);
}

describe("config-health", () => {
  it("accepts empty/minimal configs without errors", () => {
    const report = buildHealthReport(EMPTY_FILES);

    expect(report.summary.errors).toBe(0);
  });

  it("reports YAML syntax errors with line and column", () => {
    const report = buildSingleFileHealthReport("services.yaml", "foo:\n  - bar\n   baz: 1\n", EMPTY_FILES);
    const check = report.files["services.yaml"].checks.find((item) => item.id.includes("yaml-syntax"));

    expect(check).toMatchObject({ severity: "error", file: "services.yaml" });
    expect(check.line).toBeGreaterThan(0);
    expect(check.column).toBeGreaterThan(0);
  });

  it("checks services and bookmarks for hrefs, duplicates and unknown access groups", () => {
    const report = buildHealthReport(
      {
        ...EMPTY_FILES,
        "services.yaml": `
- Media:
    - Sonarr:
        href: http://same.local
        access:
          groups:
            - unknown
    - Sonarr:
        href: ""
`,
        "bookmarks.yaml": `
- Links:
    - Docs:
        - href: http://same.local
    - Docs:
        - abbr: D
`,
      },
      { knownUserGroups: ["media"] },
    );

    const ids = allChecks(report)
      .map((check) => check.id)
      .join("\n");
    expect(ids).toContain("duplicate-service-name");
    expect(ids).toContain("invalid-service-href");
    expect(ids).toContain("duplicate-bookmark-name");
    expect(ids).toContain("invalid-bookmark-href");
    expect(ids).toContain("unknown-access-group");
    expect(ids).toContain("duplicate-href");
  });

  it("detects plaintext secrets without leaking their values", () => {
    const report = buildHealthReport({
      ...EMPTY_FILES,
      "widgets.yaml": `
- openweathermap:
    apiKey: super-secret-token
`,
      "settings.yaml": `
providers:
  openweathermap: another-secret
`,
    });

    const serialized = JSON.stringify(report);
    expect(serialized).toContain("plaintext-secret");
    expect(serialized).not.toContain("super-secret-token");
    expect(serialized).not.toContain("another-secret");
  });

  it("does not flag Homepage placeholders as plaintext secrets", () => {
    const report = buildHealthReport({
      ...EMPTY_FILES,
      "widgets.yaml": `
- openweathermap:
    apiKey: "{{HOMEPAGE_VAR_OPENWEATHER_KEY}}"
`,
      "settings.yaml": `
providers:
  openweathermap: "{{HOMEPAGE_FILE_OPENWEATHER_KEY}}"
`,
    });

    const ids = allChecks(report).map((check) => check.id);
    expect(ids.some((id) => id.includes("plaintext-secret"))).toBe(false);
  });

  it("checks settings layout, maxGroupColumns, theme and color", () => {
    const report = buildHealthReport({
      ...EMPTY_FILES,
      "services.yaml": `
- Media: []
`,
      "settings.yaml": `
layout:
  Missing: {}
maxGroupColumns: 3
theme: twilight
color: nope
`,
    });

    const ids = allChecks(report)
      .map((check) => check.id)
      .join("\n");
    expect(ids).toContain("unknown-layout-group");
    expect(ids).toContain("invalid-max-group-columns");
    expect(ids).toContain("invalid-theme");
    expect(ids).toContain("invalid-color");
  });
});
