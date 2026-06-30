import { slugifyAndEncode } from "components/tab";

import { CONFIG_TABS } from "utils/admin/config-tabs";

// Build the list of "/" command-mode entries: navigation targets the palette can
// jump to. Home is always available; the admin pages are only included for admins
// (the routes are also enforced server-side by the auth middleware, so this is a
// UI-level filter, not the security boundary).
export function buildCommands({ isAdmin = false, t = (key) => key } = {}) {
  const commands = [{ id: "cmd-home", name: t("quicklaunch.commands.home"), type: "command", href: "/" }];

  if (isAdmin) {
    for (const tab of CONFIG_TABS) {
      commands.push({
        id: `cmd-admin-${tab.href}`,
        name: t("quicklaunch.commands.admin", { page: tab.label }),
        type: "command",
        href: tab.href,
      });
    }
  }

  return commands;
}

// Build jump targets for each service/bookmark group. Selecting one switches to
// the group's tab (if any) and scrolls to the group element on the dashboard.
export function buildGroupTargets({ services = [], bookmarks = [], layout = {} } = {}) {
  const targets = [];
  const seen = new Set();

  const collect = (groups) => {
    for (const group of groups ?? []) {
      const name = group?.name;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const tab = layout?.[name]?.tab;
      targets.push({
        id: `group-target-${name}`,
        name,
        type: "group",
        slug: slugifyAndEncode(name),
        tab: tab ? slugifyAndEncode(tab.toString()) : "",
      });
    }
  };

  collect(services);
  collect(bookmarks);

  return targets;
}
