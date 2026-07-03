import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

import {
  addInfoWidget,
  assignGroupToTab,
  deleteBookmarkEntry,
  deleteServiceEntry,
  deleteServiceWidget,
  deleteSetting,
  deleteTab,
  deleteWidget,
  hasBarePlaceholder,
  moveEntryInGroup,
  moveEntryToGroup,
  moveEntryToIndex,
  moveGroup,
  moveGroupToIndex,
  moveLayoutGroup,
  moveLayoutGroupToIndex,
  moveLayoutTab,
  moveWidget,
  moveWidgetToIndex,
  removeBackground,
  renameTab,
  setBackgroundField,
  setGroupLayoutField,
  setTabAccessGroups,
  updateBookmarkEntry,
  updateServiceEntry,
  updateServiceWidget,
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
    const out = updateServiceEntry(
      SRC,
      { group: "My First Group", name: "My First Service" },
      { href: "http://new:9000" },
    );
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
    expect(() => updateServiceEntry(SRC, { group: "My First Group", name: "Nope" }, { icon: "x" })).toThrow(
      /not found/i,
    );
  });

  it("does not add a top-level server when it is not in values (widget.server preserved)", () => {
    const src =
      "- G:\n    - S:\n        href: http://x\n        widget:\n          type: sonarr\n          server: my-docker\n";
    const out = updateServiceEntry(src, { group: "G", name: "S" }, { name: "S", href: "http://y" });
    expect(out).toContain("href: http://y");
    expect(out).toContain("          server: my-docker"); // stays nested under widget
    expect(out).not.toMatch(/\n {8}server:/); // no new top-level service `server:`
  });

  it("updates top-level Docker server and container fields", () => {
    const src = "- G:\n    - S:\n        href: http://x\n        server: old\n        container: old-container\n";
    const out = updateServiceEntry(src, { group: "G", name: "S" }, { server: "docker-a", container: "sonarr" });
    const service = yaml.load(out)[0].G[0].S;
    expect(service.server).toBe("docker-a");
    expect(service.container).toBe("sonarr");
  });

  it("adds and removes access groups", () => {
    const withGroups = updateServiceEntry(
      SRC,
      { group: "My First Group", name: "My First Service" },
      { accessGroups: "family, media, family" },
    );
    expect(yaml.load(withGroups)[0]["My First Group"][0]["My First Service"].access.groups).toEqual([
      "family",
      "media",
    ]);

    const withoutGroups = updateServiceEntry(
      withGroups,
      { group: "My First Group", name: "My First Service" },
      { accessGroups: "" },
    );
    expect(yaml.load(withoutGroups)[0]["My First Group"][0]["My First Service"].access).toBeUndefined();
  });

  it("adds nested network urls and keeps other fields + comments", () => {
    const out = updateServiceEntry(
      SRC,
      { group: "My First Group", name: "My First Service" },
      { urls: { lan: "http://192.168.1.2:8080", public: "https://svc.example.com" } },
    );
    const svc = yaml.load(out)[0]["My First Group"][0]["My First Service"];
    expect(svc.urls).toEqual({ lan: "http://192.168.1.2:8080", public: "https://svc.example.com" });
    // Untouched fields + inline comment preserved.
    expect(out).toContain("href: http://localhost/ # inline note");
    expect(out).toContain("ping: 8.8.8.8");
  });

  it("updates one url key without touching the others", () => {
    const withUrls = updateServiceEntry(
      SRC,
      { group: "My First Group", name: "My First Service" },
      { urls: { lan: "http://old:1", tailscale: "http://ts:1" } },
    );
    const out = updateServiceEntry(
      withUrls,
      { group: "My First Group", name: "My First Service" },
      { urls: { lan: "http://new:2" } },
    );
    const svc = yaml.load(out)[0]["My First Group"][0]["My First Service"];
    expect(svc.urls).toEqual({ lan: "http://new:2", tailscale: "http://ts:1" });
  });

  it("removes a single url key with an empty string", () => {
    const withUrls = updateServiceEntry(
      SRC,
      { group: "My First Group", name: "My First Service" },
      { urls: { lan: "http://a", public: "https://b" } },
    );
    const out = updateServiceEntry(
      withUrls,
      { group: "My First Group", name: "My First Service" },
      { urls: { public: "" } },
    );
    const svc = yaml.load(out)[0]["My First Group"][0]["My First Service"];
    expect(svc.urls).toEqual({ lan: "http://a" });
  });

  it("removes the whole urls map when the last key is cleared", () => {
    const withUrls = updateServiceEntry(
      SRC,
      { group: "My First Group", name: "My First Service" },
      { urls: { lan: "http://a" } },
    );
    const out = updateServiceEntry(
      withUrls,
      { group: "My First Group", name: "My First Service" },
      { urls: { lan: "" } },
    );
    expect(yaml.load(out)[0]["My First Group"][0]["My First Service"].urls).toBeUndefined();
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

describe("updateServiceWidget", () => {
  it("adds a block-style widget to an existing service", () => {
    const out = updateServiceWidget(
      SRC,
      { group: "My First Group", name: "My First Service" },
      {
        type: "adguard",
        url: "http://adguard",
        username: "{{HOMEPAGE_VAR_ADGUARD_USER}}",
        password: "{{HOMEPAGE_VAR_ADGUARD_PASSWORD}}",
        fields: ["queries", "blocked"],
      },
    );
    const service = yaml.load(out)[0]["My First Group"][0]["My First Service"];
    expect(service.widget).toEqual({
      type: "adguard",
      url: "http://adguard",
      username: "{{HOMEPAGE_VAR_ADGUARD_USER}}",
      password: "{{HOMEPAGE_VAR_ADGUARD_PASSWORD}}",
      fields: ["queries", "blocked"],
    });
    expect(out).toContain("widget:\n          type: adguard");
    expect(out).toContain("href: http://localhost/ # inline note");
  });

  it("changes a widget type and preserves unknown widget options", () => {
    const out = updateServiceWidget(
      SRC,
      { group: "My Second Group", name: "My Second Service" },
      {
        type: "npm",
        url: "http://npm",
        username: "admin",
        password: "",
      },
    );
    const widget = yaml.load(out)[1]["My Second Group"][0]["My Second Service"].widget;
    expect(widget.type).toBe("npm");
    expect(widget.url).toBe("http://npm");
    expect(widget.username).toBe("admin");
    expect(widget.key).toBe("plain-secret");
  });

  it("keeps existing secrets when submitted blank and never writes redacted markers", () => {
    const out = updateServiceWidget(
      SRC,
      { group: "My Second Group", name: "My Second Service" },
      {
        type: "sonarr",
        url: "http://sonarr-new",
        key: "[redacted]",
        password: "",
      },
    );
    const widget = yaml.load(out)[1]["My Second Group"][0]["My Second Service"].widget;
    expect(widget.url).toBe("http://sonarr-new");
    expect(widget.key).toBe("plain-secret");
    expect(widget.password).toBeUndefined();
    expect(out).not.toContain("[redacted]");
  });

  it("removes non-secret fields submitted blank", () => {
    const out = updateServiceWidget(
      SRC,
      { group: "My Second Group", name: "My Second Service" },
      {
        type: "sonarr",
        url: "",
      },
    );
    const widget = yaml.load(out)[1]["My Second Group"][0]["My Second Service"].widget;
    expect(widget.url).toBeUndefined();
    expect(widget.key).toBe("plain-secret");
  });

  it("updates service widget display fields as a YAML list", () => {
    const out = updateServiceWidget(
      SRC,
      { group: "My Second Group", name: "My Second Service" },
      {
        type: "sonarr",
        fields: ["queue", "wanted"],
      },
    );
    const widget = yaml.load(out)[1]["My Second Group"][0]["My Second Service"].widget;
    expect(widget.fields).toEqual(["queue", "wanted"]);
  });

  it("removes service widget display fields when submitted empty", () => {
    const withFields =
      "- G:\n    - S:\n        widget:\n          type: jellyfin\n          fields:\n            - movies\n            - series\n";
    const out = updateServiceWidget(withFields, { group: "G", name: "S" }, { type: "jellyfin", fields: "" });
    expect(yaml.load(out)[0].G[0].S.widget.fields).toBeUndefined();
  });

  it("deletes only the widget block", () => {
    const out = deleteServiceWidget(SRC, { group: "My Second Group", name: "My Second Service" });
    const service = yaml.load(out)[1]["My Second Group"][0]["My Second Service"];
    expect(service.widget).toBeUndefined();
    expect(service.href).toBe("http://localhost/");
    expect(out).toContain("- My Second Service:");
  });

  it("refuses widget edits when a bare unquoted placeholder exists", () => {
    const bare = "- G:\n    - S:\n        key: {{HOMEPAGE_VAR_SECRET}}\n";
    expect(() => updateServiceWidget(bare, { group: "G", name: "S" }, { type: "adguard" })).toThrow(/unquoted/i);
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

  it("adds access groups to a bookmark", () => {
    const out = updateBookmarkEntry(BOOKMARKS, { group: "Developer", name: "Docs" }, { accessGroups: ["kids"] });
    expect(yaml.load(out)[0].Developer[1].Docs[0].access.groups).toEqual(["kids"]);
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

  it("keeps typed booleans, numbers and arrays when editing options", () => {
    const out = updateWidgetOptions(WIDGETS, { index: 0 }, { cpu: false, refresh: 3000, disk: ["/mnt/a", "/mnt/b"] });
    const resources = yaml.load(out)[0].resources;
    expect(resources.cpu).toBe(false);
    expect(resources.refresh).toBe(3000);
    expect(resources.disk).toEqual(["/mnt/a", "/mnt/b"]);
  });
});

describe("addInfoWidget", () => {
  it("adds a block-style info widget and keeps comments", () => {
    const out = addInfoWidget(WIDGETS, {
      type: "resources",
      cpu: true,
      memory: true,
      refresh: 3000,
      disk: ["/mnt/storage", "/mnt/backup"],
    });
    const widgets = yaml.load(out);
    expect(widgets[3].resources).toEqual({
      cpu: true,
      memory: true,
      refresh: 3000,
      disk: ["/mnt/storage", "/mnt/backup"],
    });
    expect(out).toContain("# info widgets");
    expect(out).toContain("- resources:\n    cpu: true");
  });

  it("creates a widgets list when the file is empty", () => {
    const out = addInfoWidget("", { type: "search", name: "search", provider: "duckduckgo", focus: true });
    expect(yaml.load(out)).toEqual([{ search: { provider: "duckduckgo", focus: true } }]);
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

const SETTINGS_WITH_BG = `---
title: My Homepage
theme: dark
background:
  image: https://example.com/bg.jpg
  opacity: 30
  blur: md
`;

describe("setBackgroundField", () => {
  it("creates the background block when absent and sets a field", () => {
    const out = setBackgroundField(SETTINGS, "image", "https://example.com/bg.jpg");
    expect(out).toContain("background:");
    expect(out).toContain("image: https://example.com/bg.jpg");
    expect(out).toContain("title: My Homepage");
  });

  it("updates an existing background field", () => {
    const out = setBackgroundField(SETTINGS_WITH_BG, "opacity", 50);
    expect(out).toContain("opacity: 50");
    expect(out).toContain("image: https://example.com/bg.jpg");
  });

  it("adds a new field to an existing background block", () => {
    const out = setBackgroundField(SETTINGS_WITH_BG, "saturate", 150);
    expect(out).toContain("saturate: 150");
    expect(out).toContain("image: https://example.com/bg.jpg");
  });

  it("removes a field when value is empty string", () => {
    const out = setBackgroundField(SETTINGS_WITH_BG, "blur", "");
    expect(out).not.toContain("blur:");
    expect(out).toContain("image: https://example.com/bg.jpg");
  });

  it("is a no-op when clearing a field that has no background block", () => {
    const out = setBackgroundField(SETTINGS, "blur", "");
    expect(out).not.toContain("background:");
    expect(out).toContain("title: My Homepage");
  });

  it("preserves comments and other settings", () => {
    const out = setBackgroundField(SETTINGS, "image", "https://x.com/img.png");
    expect(out).toContain("# settings");
    expect(out).toContain("providers:");
  });
});

describe("removeBackground", () => {
  it("removes the background key entirely", () => {
    const out = removeBackground(SETTINGS_WITH_BG);
    expect(out).not.toContain("background:");
    expect(out).not.toContain("image:");
    expect(out).toContain("title: My Homepage");
  });

  it("is a no-op when background is absent", () => {
    const out = removeBackground(SETTINGS);
    expect(out).toContain("title: My Homepage");
    expect(out).not.toContain("background:");
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
    expect(() => moveEntryToGroup(SRC, { fromGroup: "My First Group", name: "Embedded", toGroup: "Nope" })).toThrow(
      /not found/i,
    );
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

// --- arbitrary index moves (drag & drop, M5d) -----------------------------
describe("moveEntryToIndex", () => {
  it("moves an entry to an arbitrary index within its group", () => {
    const out = moveEntryToIndex(SRC, { group: "My First Group", name: "My First Service" }, 1);
    expect(out.indexOf("- Embedded:")).toBeLessThan(out.indexOf("- My First Service:"));
    expect(out).toContain("# For configuration options and examples, please see:");
    expect(out).toContain('icon: "{{HOMEPAGE_FILE_ICON}}"'); // placeholders intact
    expect(() => yaml.load(out)).not.toThrow();
  });

  it("clamps an out-of-range index to the end", () => {
    const out = moveEntryToIndex(SRC, { group: "My First Group", name: "My First Service" }, 99);
    expect(out.indexOf("- Embedded:")).toBeLessThan(out.indexOf("- My First Service:"));
  });

  it("refuses a file with a bare placeholder", () => {
    const bare = "- G:\n    - A:\n        href: {{HOMEPAGE_VAR_X}}\n";
    expect(() => moveEntryToIndex(bare, { group: "G", name: "A" }, 0)).toThrow(/unquoted/i);
  });
});

describe("moveGroupToIndex", () => {
  it("moves a group to an arbitrary index", () => {
    const out = moveGroupToIndex(SRC, { group: "My Second Group" }, 0);
    expect(out.indexOf("- My Second Group:")).toBeLessThan(out.indexOf("- My First Group:"));
    expect(out).toContain("ping: 8.8.8.8"); // entries preserved
  });

  it("throws for an unknown group", () => {
    expect(() => moveGroupToIndex(SRC, { group: "Nope" }, 0)).toThrow(/not found/i);
  });
});

describe("moveWidgetToIndex", () => {
  it("moves a widget to an arbitrary index and keeps secrets byte-identical", () => {
    const out = moveWidgetToIndex(WIDGETS, { index: 0 }, 1);
    expect(out.indexOf("- search:")).toBeLessThan(out.indexOf("- resources:"));
    expect(out).toContain("password: super-secret");
  });
});

describe("moveEntryToGroup with toIndex", () => {
  it("inserts the moved entry at the chosen position in the target group", () => {
    const out = moveEntryToGroup(SRC, {
      fromGroup: "My First Group",
      name: "Embedded",
      toGroup: "My Second Group",
      toIndex: 0,
    });
    expect(out.indexOf("- Embedded:")).toBeLessThan(out.indexOf("- My Second Service:"));
    expect((out.match(/- Embedded:/g) || []).length).toBe(1);
    expect(() => yaml.load(out)).not.toThrow();
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

describe("setTabAccessGroups", () => {
  it("creates the tabs: block for a fresh tab", () => {
    const out = setTabAccessGroups(SETTINGS_LIST, { tab: "Ops" }, "family, kids, family");
    const data = yaml.load(out);
    expect(data.tabs.Ops.access.groups).toEqual(["family", "kids"]);
    expect(out).toContain("# settings"); // comment preserved
    // Untouched layout stays intact.
    expect(data.layout.find((i) => i.Admin).Admin.tab).toBe("Ops");
  });

  it("updates an existing tab's groups without touching other tabs", () => {
    const withA = setTabAccessGroups(SETTINGS_LIST, { tab: "Ops" }, "family");
    const withB = setTabAccessGroups(withA, { tab: "Apps" }, "kids");
    const data = yaml.load(withB);
    expect(data.tabs.Ops.access.groups).toEqual(["family"]);
    expect(data.tabs.Apps.access.groups).toEqual(["kids"]);

    const changed = setTabAccessGroups(withB, { tab: "Ops" }, "family, admin");
    const changedData = yaml.load(changed);
    expect(changedData.tabs.Ops.access.groups).toEqual(["family", "admin"]);
    expect(changedData.tabs.Apps.access.groups).toEqual(["kids"]); // unaffected
  });

  it("clearing groups removes the tab entry, and an emptied tabs: block", () => {
    const withA = setTabAccessGroups(SETTINGS_LIST, { tab: "Ops" }, "family");
    const cleared = setTabAccessGroups(withA, { tab: "Ops" }, "");
    expect(yaml.load(cleared).tabs).toBeUndefined();
    expect(cleared).not.toContain("tabs:");
  });

  it("clearing an already-absent tab is a byte-identical no-op", () => {
    const out = setTabAccessGroups(SETTINGS_LIST, { tab: "Ops" }, "");
    expect(out).toBe(SETTINGS_LIST);
  });

  it("leaves one tab's groups alone when clearing a different one", () => {
    const withBoth = setTabAccessGroups(setTabAccessGroups(SETTINGS_LIST, { tab: "Ops" }, "family"), { tab: "Apps" }, "kids");
    const out = setTabAccessGroups(withBoth, { tab: "Ops" }, "");
    const data = yaml.load(out);
    expect(data.tabs.Ops).toBeUndefined();
    expect(data.tabs.Apps.access.groups).toEqual(["kids"]);
  });

  it("refuses when a bare placeholder is present", () => {
    const bare = "title: x\nlayout:\n  - A:\n      tab: {{HOMEPAGE_VAR_X}}\n";
    expect(() => setTabAccessGroups(bare, { tab: "A" }, "family")).toThrow(/unquoted/i);
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

  it("moves the tabs.<from> access-groups entry to tabs.<to>", () => {
    const withAccess = setTabAccessGroups(SETTINGS_LIST, { tab: "Apps" }, "family");
    const out = renameTab(withAccess, { from: "Apps", to: "Medien" });
    const data = yaml.load(out);
    expect(data.tabs.Apps).toBeUndefined();
    expect(data.tabs.Medien.access.groups).toEqual(["family"]);
  });

  it("merges tabs.<from> groups into an existing tabs.<to> entry", () => {
    const withBoth = setTabAccessGroups(setTabAccessGroups(SETTINGS_LIST, { tab: "Apps" }, "family"), { tab: "Ops" }, "kids");
    const out = renameTab(withBoth, { from: "Apps", to: "Ops" });
    const data = yaml.load(out);
    expect(data.tabs.Apps).toBeUndefined();
    expect(new Set(data.tabs.Ops.access.groups)).toEqual(new Set(["kids", "family"]));
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

  it("also removes the tab's tabs.<tab> access-groups entry", () => {
    const withAccess = setTabAccessGroups(SETTINGS_LIST, { tab: "Ops" }, "family");
    const out = deleteTab(withAccess, { tab: "Ops" });
    expect(yaml.load(out).tabs).toBeUndefined();
  });

  it("leaves other tabs' access-groups entries alone", () => {
    const withBoth = setTabAccessGroups(setTabAccessGroups(SETTINGS_LIST, { tab: "Apps" }, "family"), { tab: "Ops" }, "kids");
    const out = deleteTab(withBoth, { tab: "Ops" });
    const data = yaml.load(out);
    expect(data.tabs.Ops).toBeUndefined();
    expect(data.tabs.Apps.access.groups).toEqual(["family"]);
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

describe("moveLayoutGroup / moveLayoutGroupToIndex", () => {
  const THREE = `---
layout:
  - Media:
      tab: Apps
  - Admin:
      tab: Ops
  - Misc:
      tab: Apps
`;

  it("moves a group up within the list form", () => {
    const out = moveLayoutGroup(THREE, { group: "Admin" }, "up");
    expect(out.indexOf("- Admin:")).toBeLessThan(out.indexOf("- Media:"));
    expect(yaml.load(out).layout.map((i) => Object.keys(i)[0])).toEqual(["Admin", "Media", "Misc"]);
  });

  it("moves a group down within the list form", () => {
    const out = moveLayoutGroup(THREE, { group: "Media" }, "down");
    expect(yaml.load(out).layout.map((i) => Object.keys(i)[0])).toEqual(["Admin", "Media", "Misc"]);
  });

  it("is a no-op past the boundaries", () => {
    expect(moveLayoutGroup(THREE, { group: "Media" }, "up")).toBe(THREE);
    expect(moveLayoutGroup(THREE, { group: "Misc" }, "down")).toBe(THREE);
  });

  it("moves to an arbitrary index and preserves options + comments", () => {
    const withComment = `---
# my layout
layout:
  - Media:
      tab: Apps
      style: row
  - Admin:
      tab: Ops
`;
    const out = moveLayoutGroupToIndex(withComment, { group: "Admin" }, 0);
    expect(out.indexOf("- Admin:")).toBeLessThan(out.indexOf("- Media:"));
    expect(out).toContain("# my layout");
    expect(out).toContain("style: row");
  });

  it("works on the mapping form", () => {
    const obj = `---
layout:
  Media:
    tab: Apps
  Admin:
    tab: Ops
`;
    const out = moveLayoutGroup(obj, { group: "Admin" }, "up");
    expect(Object.keys(yaml.load(out).layout)).toEqual(["Admin", "Media"]);
  });

  it("throws for a group not in the layout", () => {
    expect(() => moveLayoutGroup(THREE, { group: "Nope" }, "up")).toThrow(/not in the layout/i);
  });

  it("throws for a scalar layout", () => {
    expect(() => moveLayoutGroup("layout: nope\n", { group: "A" }, "up")).toThrow(/list\/mapping|raw editor/i);
  });
});

describe("moveLayoutTab", () => {
  const TABS = `---
layout:
  - Media:
      tab: Test
  - Proxmox:
      tab: Test
  - Social:
      tab: Kitohome
  - Entertainment:
      tab: Kitohome
  - Admin:
      tab: Ops
`;

  it("moves a complete tab block down", () => {
    const out = moveLayoutTab(TABS, { tab: "Test" }, "down");
    expect(yaml.load(out).layout.map((i) => Object.keys(i)[0])).toEqual([
      "Social",
      "Entertainment",
      "Media",
      "Proxmox",
      "Admin",
    ]);
  });

  it("moves a complete tab block up", () => {
    const out = moveLayoutTab(TABS, { tab: "Ops" }, "up");
    expect(yaml.load(out).layout.map((i) => Object.keys(i)[0])).toEqual([
      "Media",
      "Proxmox",
      "Admin",
      "Social",
      "Entertainment",
    ]);
  });

  it("is a no-op at the boundaries", () => {
    expect(moveLayoutTab(TABS, { tab: "Test" }, "up")).toBe(TABS);
    expect(moveLayoutTab(TABS, { tab: "Ops" }, "down")).toBe(TABS);
  });

  it("works on mapping-form layout order", () => {
    const obj = `---
layout:
  Media:
    tab: Test
  Social:
    tab: Kitohome
  Admin:
    tab: Ops
`;
    const out = moveLayoutTab(obj, { tab: "Kitohome" }, "up");
    expect(Object.keys(yaml.load(out).layout)).toEqual(["Social", "Media", "Admin"]);
  });

  it("throws when the tab does not exist", () => {
    expect(() => moveLayoutTab(TABS, { tab: "Nope" }, "up")).toThrow(/not found/i);
  });
});
