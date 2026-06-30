import { describe, expect, it } from "vitest";

import { buildCommands, buildGroupTargets } from "./commands";

const t = (key, opts) => (opts?.page ? `${key}:${opts.page}` : key);

describe("utils/quicklaunch/commands - buildCommands", () => {
  it("always includes Home and omits admin pages for non-admins", () => {
    const commands = buildCommands({ isAdmin: false, t });
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({ type: "command", href: "/" });
    expect(commands.some((c) => c.href.startsWith("/admin"))).toBe(false);
  });

  it("includes the admin pages for admins", () => {
    const commands = buildCommands({ isAdmin: true, t });
    expect(commands.length).toBeGreaterThan(1);
    expect(commands.some((c) => c.href === "/admin/config")).toBe(true);
    expect(commands.some((c) => c.href === "/admin/users")).toBe(true);
    expect(commands.every((c) => c.type === "command")).toBe(true);
  });

  it("defaults to non-admin and a passthrough translator", () => {
    const commands = buildCommands();
    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe("quicklaunch.commands.home");
  });
});

describe("utils/quicklaunch/commands - buildGroupTargets", () => {
  it("builds slugged jump targets from services and bookmarks with their tab", () => {
    const targets = buildGroupTargets({
      services: [{ name: "My First Group" }],
      bookmarks: [{ name: "Links" }],
      layout: { "My First Group": { tab: "Home Tab" } },
    });

    expect(targets).toEqual([
      { id: "group-target-My First Group", name: "My First Group", type: "group", slug: "my-first-group", tab: "home-tab" },
      { id: "group-target-Links", name: "Links", type: "group", slug: "links", tab: "" },
    ]);
  });

  it("de-duplicates group names across services and bookmarks", () => {
    const targets = buildGroupTargets({
      services: [{ name: "Shared" }],
      bookmarks: [{ name: "Shared" }],
    });
    expect(targets).toHaveLength(1);
  });

  it("returns an empty array when nothing is provided", () => {
    expect(buildGroupTargets()).toEqual([]);
  });
});
