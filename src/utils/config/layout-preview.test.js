import { describe, expect, it } from "vitest";

import { groupNamesFromRaw, parseLayout } from "./layout-preview";

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
