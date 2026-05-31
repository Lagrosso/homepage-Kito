import { describe, expect, it } from "vitest";

import { groupNamesFromRaw, parseGlobalLayout, parseLayout } from "./layout-preview";

describe("parseLayout", () => {
  it("parses list-form layout in order", () => {
    const content = `layout:
  - Media:
      tab: Apps
  - Admin:
      tab: Ops
  - Misc: {}
`;
    expect(parseLayout(content)).toEqual([
      { group: "Media", tab: "Apps" },
      { group: "Admin", tab: "Ops" },
      { group: "Misc", tab: "" },
    ]);
  });

  it("parses object-form layout", () => {
    const content = `layout:
  Media:
    tab: Apps
  Admin: {}
`;
    expect(parseLayout(content)).toEqual([
      { group: "Media", tab: "Apps" },
      { group: "Admin", tab: "" },
    ]);
  });

  it("returns [] when layout is missing or YAML is invalid", () => {
    expect(parseLayout("title: x")).toEqual([]);
    expect(parseLayout("layout: : :")).toEqual([]);
    expect(parseLayout("")).toEqual([]);
  });

  it("reads per-group display options", () => {
    const content = `layout:
  - Media:
      tab: Apps
      style: row
      columns: 4
      header: false
      initiallyCollapsed: true
      useEqualHeights: true
  - Plain: {}
`;
    const [media, plain] = parseLayout(content);
    expect(media).toEqual({
      group: "Media",
      tab: "Apps",
      style: "row",
      columns: 4,
      header: false,
      initiallyCollapsed: true,
      useEqualHeights: true,
    });
    // missing options stay undefined
    expect(plain.style).toBeUndefined();
    expect(plain.columns).toBeUndefined();
    expect(plain.header).toBeUndefined();
  });
});

describe("parseGlobalLayout", () => {
  it("reads maxGroupColumns and fiveColumns", () => {
    expect(parseGlobalLayout("maxGroupColumns: 6\nfiveColumns: true\n")).toEqual({
      maxGroupColumns: 6,
      fiveColumns: true,
    });
  });

  it("leaves missing keys undefined and is safe on invalid/empty input", () => {
    expect(parseGlobalLayout("title: x")).toEqual({ maxGroupColumns: undefined, fiveColumns: undefined });
    expect(parseGlobalLayout("layout: : :")).toEqual({});
    expect(parseGlobalLayout("")).toEqual({});
  });
});

describe("groupNamesFromRaw", () => {
  it("extracts top-level group names from services/bookmarks YAML", () => {
    const content = `- Media:
    - Jellyfin:
        href: http://x
- Admin:
    - Proxmox:
        href: http://y
`;
    expect(groupNamesFromRaw(content)).toEqual(["Media", "Admin"]);
  });

  it("returns [] for empty or non-list input", () => {
    expect(groupNamesFromRaw("")).toEqual([]);
    expect(groupNamesFromRaw("foo: bar")).toEqual([]);
  });
});
