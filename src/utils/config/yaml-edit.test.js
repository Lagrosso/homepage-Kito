import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

import {
  deleteBookmarkEntry,
  deleteServiceEntry,
  deleteSetting,
  deleteWidget,
  updateBookmarkEntry,
  updateServiceEntry,
  updateSetting,
  updateWidgetOptions,
} from "./yaml-edit";

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

// --- bookmarks ------------------------------------------------------------
const BOOKMARKS = `---
# bookmarks
- Developer:
    - Github:
        - abbr: GH
          href: https://github.com/ # code
    - Docs:
        - href: https://docs.example.com
          icon: mdi-book
`;

describe("updateBookmarkEntry", () => {
  it("edits the nested props and keeps the inline comment and siblings", () => {
    const out = updateBookmarkEntry(BOOKMARKS, { group: "Developer", name: "Github" }, { abbr: "GHB" });
    expect(out).toContain("abbr: GHB");
    expect(out).toContain("href: https://github.com/ # code");
    expect(out).toContain("- Docs:");
    expect(() => yaml.load(out)).not.toThrow();
  });

  it("renames a bookmark", () => {
    const out = updateBookmarkEntry(BOOKMARKS, { group: "Developer", name: "Docs" }, { name: "Documentation" });
    expect(out).toContain("- Documentation:");
    expect(out).not.toContain("- Docs:");
  });
});

describe("deleteBookmarkEntry", () => {
  it("removes only the target bookmark", () => {
    const out = deleteBookmarkEntry(BOOKMARKS, { group: "Developer", name: "Github" });
    expect(out).not.toContain("- Github:");
    expect(out).toContain("- Docs:");
    expect(out).toContain("# bookmarks");
  });
});

// --- widgets (secret-aware) -----------------------------------------------
const WIDGETS = `# info widgets
- resources:
    cpu: true
    memory: true
- search:
    provider: google
    target: _blank
- unifi_console:
    url: http://unifi
    username: admin
    password: super-secret
`;

describe("updateWidgetOptions", () => {
  it("edits a plain option by index without touching others", () => {
    const out = updateWidgetOptions(WIDGETS, { index: 1 }, { provider: "bing" });
    expect(out).toContain("provider: bing");
    expect(out).toContain("target: _blank");
    expect(out).toContain("# info widgets");
  });

  it("leaves a secret untouched when it is not provided", () => {
    const out = updateWidgetOptions(WIDGETS, { index: 2 }, { url: "http://unifi.local" });
    expect(out).toContain("url: http://unifi.local");
    expect(out).toContain("password: super-secret"); // secret preserved verbatim
  });

  it("replaces a secret only when a new value is given", () => {
    const out = updateWidgetOptions(WIDGETS, { index: 2 }, { password: "new-secret" });
    expect(out).toContain("password: new-secret");
  });

  it("never writes the redaction marker", () => {
    const out = updateWidgetOptions(WIDGETS, { index: 2 }, { password: "[redacted]" });
    expect(out).toContain("password: super-secret");
    expect(out).not.toContain("[redacted]");
  });
});

describe("deleteWidget", () => {
  it("removes the widget at the given index", () => {
    const out = deleteWidget(WIDGETS, { index: 0 });
    expect(out).not.toContain("- resources:");
    expect(out).toContain("- search:");
    expect(out).toContain("- unifi_console:");
  });

  it("throws for an out-of-range index", () => {
    expect(() => deleteWidget(WIDGETS, { index: 9 })).toThrow(/not found/i);
  });
});

// --- settings (secret-aware) ----------------------------------------------
const SETTINGS = `---
# settings
title: My Homepage
theme: dark
hideVersion: true
maxGroupColumns: 4
providers:
  openweathermap: my-secret-key
layout:
  Developer:
    style: row
`;

describe("updateSetting", () => {
  it("edits a scalar string value", () => {
    const out = updateSetting(SETTINGS, { key: "title" }, "New Title");
    expect(out).toContain("title: New Title");
    expect(out).toContain("# settings");
  });

  it("keeps boolean and number types", () => {
    expect(updateSetting(SETTINGS, { key: "hideVersion" }, false)).toContain("hideVersion: false");
    expect(updateSetting(SETTINGS, { key: "maxGroupColumns" }, 6)).toContain("maxGroupColumns: 6");
  });

  it("refuses secret containers and structured values", () => {
    expect(() => updateSetting(SETTINGS, { key: "providers" }, "x")).toThrow(/secret/i);
    expect(() => updateSetting(SETTINGS, { key: "layout" }, "x")).toThrow(/structured|raw/i);
  });

  it("refuses to write a redacted value", () => {
    expect(() => updateSetting(SETTINGS, { key: "title" }, "[redacted]")).toThrow(/redacted/i);
  });

  it("does not disturb the providers secret", () => {
    const out = updateSetting(SETTINGS, { key: "title" }, "X");
    expect(out).toContain("openweathermap: my-secret-key");
  });
});

describe("deleteSetting", () => {
  it("removes a top-level key and preserves the rest", () => {
    const out = deleteSetting(SETTINGS, { key: "theme" });
    expect(out).not.toContain("theme: dark");
    expect(out).toContain("title: My Homepage");
    expect(out).toContain("providers:");
  });

  it("throws for an unknown key", () => {
    expect(() => deleteSetting(SETTINGS, { key: "nope" })).toThrow(/not found/i);
  });
});
