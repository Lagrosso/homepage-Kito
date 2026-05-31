import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

import {
  assignGroupToTab,
  deleteBookmarkEntry,
  deleteServiceEntry,
  deleteSetting,
  deleteTab,
  deleteWidget,
  hasBarePlaceholder,
  moveEntryInGroup,
  moveEntryToGroup,
  moveGroup,
  moveWidget,
  renameTab,
  setGroupLayoutField,
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

  it("does not add a top-level server when it is not in values (widget.server preserved)", () => {
    const src = "- G:\n    - S:\n        href: http://x\n        widget:\n          type: sonarr\n          server: my-docker\n";
    const out = updateServiceEntry(src, { group: "G", name: "S" }, { name: "S", href: "http://y" });
    expect(out).toContain("href: http://y");
    expect(out).toContain("          server: my-docker"); // stays nested under widget
    expect(out).not.toMatch(/\n {8}server:/); // no new top-level service `server:`
  });
});

describe("hasBarePlaceholder", () => {
  it("detects a bare unquoted placeholder in value position", () => {
    expect(hasBarePlaceholder("key: {{HOMEPAGE_VAR_X}}")).toBe(true);
    expect(hasBarePlaceholder("- {{HOMEPAGE_FILE_Y}}")).toBe(true);
  });

  it("ignores quoted, embedded and absent placeholders", () => {
    expect(hasBarePlaceholder('key: "{{HOMEPAGE_VAR_X}}"')).toBe(false);
    expect(hasBarePlaceholder("href: http://{{HOMEPAGE_VAR_HOST}}:8080")).toBe(false);
    expect(hasBarePlaceholder("title: My Homepage")).toBe(false);
    expect(hasBarePlaceholder("")).toBe(false);
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

// --- reordering / moving (M5c) --------------------------------------------
describe("moveEntryInGroup", () => {
  it("moves an entry up within its group and leaves other groups intact", () => {
    const out = moveEntryInGroup(SRC, { group: "My First Group", name: "Embedded" }, "up");
    expect(out.indexOf("- Embedded:")).toBeLessThan(out.indexOf("- My First Service:"));
    expect(out).toContain("- My Second Service:");
    expect(out).toContain("# For configuration options and examples, please see:");
    expect(() => yaml.load(out)).not.toThrow();
  });

  it("is a no-op at the boundary", () => {
    const out = moveEntryInGroup(SRC, { group: "My First Group", name: "My First Service" }, "up");
    expect(out.indexOf("- My First Service:")).toBeLessThan(out.indexOf("- Embedded:"));
  });
});

describe("moveGroup", () => {
  it("reorders whole groups", () => {
    const out = moveGroup(SRC, { group: "My Second Group" }, "up");
    expect(out.indexOf("- My Second Group:")).toBeLessThan(out.indexOf("- My First Group:"));
    expect(out).toContain("ping: 8.8.8.8"); // entries preserved
  });
});

describe("moveEntryToGroup", () => {
  it("moves an entry to the end of another group with its props/placeholders", () => {
    const out = moveEntryToGroup(SRC, { fromGroup: "My First Group", name: "Embedded", toGroup: "My Second Group" });
    expect(out.indexOf("- Embedded:")).toBeGreaterThan(out.indexOf("- My Second Service:"));
    expect(out).toContain("href: http://{{HOMEPAGE_VAR_HOST}}:8080"); // placeholder preserved
    expect((out.match(/- Embedded:/g) || []).length).toBe(1); // moved, not duplicated
    expect(() => yaml.load(out)).not.toThrow();
  });

  it("throws when the target group is missing", () => {
    expect(() =>
      moveEntryToGroup(SRC, { fromGroup: "My First Group", name: "Embedded", toGroup: "Nope" }),
    ).toThrow(/not found/i);
  });

  it("moves into a previously-emptied group as block style (not inline flow)", () => {
    // Empty "My Second Group" first, then move an entry back into it.
    const emptied = deleteServiceEntry(SRC, { group: "My Second Group", name: "My Second Service" });
    expect(emptied).toContain("My Second Group: []"); // delete leaves an empty flow seq
    const out = moveEntryToGroup(emptied, {
      fromGroup: "My First Group",
      name: "My First Service",
      toGroup: "My Second Group",
    });
    expect(out).not.toMatch(/My Second Group:\s*\[/); // not inline flow
    expect(out).toMatch(/- My Second Group:\n {4}- My First Service:/); // proper block entry
    expect(() => yaml.load(out)).not.toThrow();
  });
});

describe("moveWidget", () => {
  it("swaps adjacent widgets by index and keeps secrets byte-identical", () => {
    const out = moveWidget(WIDGETS, { index: 1 }, "up");
    expect(out.indexOf("- search:")).toBeLessThan(out.indexOf("- resources:"));
    expect(out).toContain("password: super-secret");
  });

  it("is a no-op at the boundary", () => {
    const out = moveWidget(WIDGETS, { index: 0 }, "up");
    expect(out.indexOf("- resources:")).toBeLessThan(out.indexOf("- search:"));
  });
});

// --- settings.yaml layout / tabs (M6) -------------------------------------
const SETTINGS_NO_LAYOUT = `---
# settings
title: My Homepage
providers:
  openweathermap: key
`;

const SETTINGS_LIST = `---
# settings
title: Home
layout:
  - Media:
      tab: Apps
  - Admin:
      tab: Ops
`;

const SETTINGS_OBJ = `---
layout:
  Media:
    tab: Apps
`;

describe("assignGroupToTab", () => {
  it("creates a block-list layout when none exists", () => {
    const out = assignGroupToTab(SETTINGS_NO_LAYOUT, { group: "Media", tab: "Apps" });
    expect(out).toContain("# settings"); // comment preserved
    const data = yaml.load(out);
    expect(Array.isArray(data.layout)).toBe(true);
    expect(data.layout[0].Media.tab).toBe("Apps");
    expect(out).not.toMatch(/layout:\s*\[/); // block, not flow
  });

  it("sets the tab on an existing group (list form)", () => {
    const out = assignGroupToTab(SETTINGS_LIST, { group: "Media", tab: "Medien" });
    expect(yaml.load(out).layout.find((i) => i.Media)?.Media.tab).toBe("Medien");
  });

  it("clearing the tab prunes a now-empty entry", () => {
    const out = assignGroupToTab(SETTINGS_LIST, { group: "Admin", tab: "" });
    const data = yaml.load(out);
    expect(data.layout.some((i) => i.Admin)).toBe(false);
    expect(data.layout.some((i) => i.Media)).toBe(true);
  });

  it("keeps object form when the layout is an object", () => {
    const out = assignGroupToTab(SETTINGS_OBJ, { group: "Admin", tab: "Ops" });
    const data = yaml.load(out);
    expect(Array.isArray(data.layout)).toBe(false);
    expect(data.layout.Admin.tab).toBe("Ops");
    expect(data.layout.Media.tab).toBe("Apps");
  });

  it("refuses when a bare placeholder is present", () => {
    const bare = "title: x\nlayout:\n  - A:\n      tab: {{HOMEPAGE_VAR_X}}\n";
    expect(() => assignGroupToTab(bare, { group: "A", tab: "B" })).toThrow(/unquoted/i);
  });

  it("writes block style when assigning onto an empty flow `{}` entry", () => {
    const out = assignGroupToTab(`layout:\n  - Misc: {}\n`, { group: "Misc", tab: "Apps" });
    expect(out).not.toMatch(/\{\s*tab/); // not inline flow
    expect(yaml.load(out).layout[0].Misc.tab).toBe("Apps");
  });

  it("refuses to overwrite a non-null scalar `layout:`", () => {
    expect(() => assignGroupToTab("layout: somestring\n", { group: "A", tab: "B" })).toThrow(/raw editor/i);
  });
});

describe("renameTab", () => {
  it("renames the tab across all matching groups and keeps comments", () => {
    const src = `---
# settings
layout:
  - Media:
      tab: Apps
  - More:
      tab: Apps
  - Admin:
      tab: Ops
`;
    const out = renameTab(src, { from: "Apps", to: "Medien" });
    const data = yaml.load(out);
    expect(data.layout.find((i) => i.Media).Media.tab).toBe("Medien");
    expect(data.layout.find((i) => i.More).More.tab).toBe("Medien");
    expect(data.layout.find((i) => i.Admin).Admin.tab).toBe("Ops");
    expect(out).toContain("# settings");
  });

  it("throws for an unknown tab", () => {
    expect(() => renameTab(SETTINGS_LIST, { from: "Nope", to: "X" })).toThrow(/not found/i);
  });
});

describe("deleteTab", () => {
  it("removes the tab key and prunes emptied entries", () => {
    const out = deleteTab(SETTINGS_LIST, { tab: "Ops" });
    const data = yaml.load(out);
    expect(data.layout.some((i) => i.Admin)).toBe(false); // Admin had only the tab → pruned
    expect(data.layout.find((i) => i.Media).Media.tab).toBe("Apps");
  });

  it("keeps a group that has other layout options", () => {
    const src = `layout:
  - Media:
      tab: Apps
      style: row
`;
    const out = deleteTab(src, { tab: "Apps" });
    const data = yaml.load(out);
    expect(data.layout[0].Media.tab).toBeUndefined();
    expect(data.layout[0].Media.style).toBe("row");
  });

  it("throws for an unknown tab", () => {
    expect(() => deleteTab(SETTINGS_LIST, { tab: "Nope" })).toThrow(/not found/i);
  });
});

describe("setGroupLayoutField", () => {
  it("creates a block-list layout + group entry for a fresh field", () => {
    const out = setGroupLayoutField(SETTINGS_NO_LAYOUT, { group: "Media", field: "style" }, "row");
    expect(out).toContain("# settings"); // comment preserved
    expect(out).not.toMatch(/layout:\s*\[/); // block, not flow
    expect(yaml.load(out).layout[0].Media.style).toBe("row");
  });

  it("writes a numeric field (columns)", () => {
    const out = setGroupLayoutField(SETTINGS_LIST, { group: "Media", field: "columns" }, 4);
    expect(yaml.load(out).layout.find((i) => i.Media).Media.columns).toBe(4);
  });

  it("writes a boolean field (header: false)", () => {
    const out = setGroupLayoutField(SETTINGS_LIST, { group: "Media", field: "header" }, false);
    expect(yaml.load(out).layout.find((i) => i.Media).Media.header).toBe(false);
  });

  it("clearing a field deletes it and prunes a now-empty entry", () => {
    // Admin had only `tab: Ops`; clearing it leaves no options → entry pruned.
    const out = setGroupLayoutField(SETTINGS_LIST, { group: "Admin", field: "tab" }, "");
    const data = yaml.load(out);
    expect(data.layout.some((i) => i.Admin)).toBe(false);
    expect(data.layout.some((i) => i.Media)).toBe(true);
  });

  it("keeps other fields (incl. tab) when setting a new one", () => {
    const out = setGroupLayoutField(SETTINGS_LIST, { group: "Media", field: "style" }, "row");
    const media = yaml.load(out).layout.find((i) => i.Media).Media;
    expect(media.tab).toBe("Apps");
    expect(media.style).toBe("row");
  });

  it("writes block style when adding onto an empty flow `{}` entry", () => {
    const out = setGroupLayoutField(`layout:\n  - Misc: {}\n`, { group: "Misc", field: "style" }, "row");
    expect(out).not.toMatch(/\{\s*style/);
    expect(yaml.load(out).layout[0].Misc.style).toBe("row");
  });

  it("refuses to overwrite a non-null scalar `layout:`", () => {
    expect(() => setGroupLayoutField("layout: nope\n", { group: "A", field: "style" }, "row")).toThrow(/raw editor/i);
  });

  it("refuses when a bare placeholder is present", () => {
    const bare = "title: x\nlayout:\n  - A:\n      tab: {{HOMEPAGE_VAR_X}}\n";
    expect(() => setGroupLayoutField(bare, { group: "A", field: "style" }, "row")).toThrow(/unquoted/i);
  });
});
