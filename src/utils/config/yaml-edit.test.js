import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

import { deleteServiceEntry, updateServiceEntry } from "./yaml-edit";

// Representative services.yaml: doc marker, header comment, blank lines, an
// inline comment, an unknown field (ping), placeholders embedded in a URL and
// quoted, and a nested widget block with its own (2-space) indentation.
const SRC = `---
# For configuration options and examples, please see:
# https://gethomepage.dev/configs/services/

- My First Group:
    - My First Service:
        href: http://localhost/ # inline note
        description: Homepage is awesome
        ping: 8.8.8.8
    - Embedded:
        href: http://{{HOMEPAGE_VAR_HOST}}:8080
        icon: "{{HOMEPAGE_FILE_ICON}}"

- My Second Group:
    - My Second Service:
        href: http://localhost/
        widget:
          type: sonarr
          url: http://sonarr
          key: plain-secret
`;

describe("updateServiceEntry", () => {
  it("changes a field in place and keeps the inline comment", () => {
    const out = updateServiceEntry(SRC, { group: "My First Group", name: "My First Service" }, { href: "http://new:9000" });
    expect(out).toContain("href: http://new:9000 # inline note");
    expect(out).toContain("description: Homepage is awesome");
  });

  it("adds a missing field and removes a field set to empty", () => {
    const out = updateServiceEntry(
      SRC,
      { group: "My First Group", name: "My First Service" },
      { icon: "sonarr.png", description: "" },
    );
    expect(out).toContain("icon: sonarr.png");
    expect(out).not.toContain("description: Homepage is awesome");
  });

  it("renames the entry without touching siblings", () => {
    const out = updateServiceEntry(SRC, { group: "My First Group", name: "My First Service" }, { name: "Renamed" });
    expect(out).toContain("- Renamed:");
    expect(out).not.toContain("- My First Service:");
    expect(out).toContain("- Embedded:");
  });

  it("preserves header comment, blank lines and doc marker", () => {
    const out = updateServiceEntry(SRC, { group: "My First Group", name: "My First Service" }, { icon: "x.png" });
    expect(out.startsWith("---\n")).toBe(true);
    expect(out).toContain("# For configuration options and examples, please see:");
    expect(out).toContain("\n\n- My Second Group:");
  });

  it("preserves embedded and quoted {{HOMEPAGE_*}} placeholders", () => {
    const out = updateServiceEntry(SRC, { group: "My First Group", name: "My First Service" }, { icon: "x.png" });
    expect(out).toContain("href: http://{{HOMEPAGE_VAR_HOST}}:8080");
    expect(out).toContain('icon: "{{HOMEPAGE_FILE_ICON}}"');
  });

  it("preserves unknown and nested fields (ping, widget block)", () => {
    const out = updateServiceEntry(SRC, { group: "My First Group", name: "My First Service" }, { href: "http://x" });
    expect(out).toContain("ping: 8.8.8.8");
    expect(out).toContain("widget:");
    expect(out).toContain("          type: sonarr");
    expect(out).toContain("          url: http://sonarr");
    expect(out).toContain("          key: plain-secret");
  });

  it("re-quotes a value that needs quoting and stays valid YAML", () => {
    const out = updateServiceEntry(SRC, { group: "My First Group", name: "My First Service" }, { href: "a: b #c" });
    expect(out).toContain('href: "a: b #c"');
    expect(() => yaml.load(out)).not.toThrow();
  });

  it("refuses structured edits when a bare unquoted placeholder exists", () => {
    const bare = "- G:\n    - S:\n        key: {{HOMEPAGE_VAR_SECRET}}\n";
    expect(() => updateServiceEntry(bare, { group: "G", name: "S" }, { icon: "x" })).toThrow(/unquoted/i);
  });

  it("throws for an unknown group or service", () => {
    expect(() => updateServiceEntry(SRC, { group: "Nope", name: "S" }, { icon: "x" })).toThrow(/not found/i);
    expect(() => updateServiceEntry(SRC, { group: "My First Group", name: "Nope" }, { icon: "x" })).toThrow(/not found/i);
  });
});

describe("deleteServiceEntry", () => {
  it("removes only the target entry and keeps comments/blank lines", () => {
    const out = deleteServiceEntry(SRC, { group: "My First Group", name: "Embedded" });
    expect(out).not.toContain("- Embedded:");
    expect(out).toContain("- My First Service:");
    expect(out).toContain("# For configuration options and examples, please see:");
    expect(out).toContain("\n\n- My Second Group:");
    // Still valid YAML after removal.
    expect(() => yaml.load(out)).not.toThrow();
  });

  it("keeps an emptied group present", () => {
    const out = deleteServiceEntry(SRC, { group: "My Second Group", name: "My Second Service" });
    expect(out).toContain("- My Second Group:");
    expect(out).not.toContain("- My Second Service:");
  });

  it("throws for an unknown entry", () => {
    expect(() => deleteServiceEntry(SRC, { group: "My First Group", name: "Nope" })).toThrow(/not found/i);
  });
});
