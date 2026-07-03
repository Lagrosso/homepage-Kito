// Client-safe mirror of utils/config/access.js's isVisibleForUser, for filtering
// which dashboard TAB BUTTONS a user sees (not the services/bookmarks within a
// tab — those stay filtered server-side as before). Kept separate from
// utils/config/access.js because that module imports utils/config/users.js,
// which imports node:fs and can't be bundled into client code.
//
// A tab with no access.groups (or none configured at all) stays visible to
// everyone — same default as services/bookmarks without access.groups. Admins
// always see every tab.

function normalizeGroupList(groups) {
  if (!Array.isArray(groups)) {
    return [];
  }
  return [...new Set(groups.map((group) => String(group).trim()).filter((group) => group.length > 0))];
}

export function isTabVisibleForUser(tabAccessGroups, user) {
  const accessGroups = normalizeGroupList(tabAccessGroups);
  if (accessGroups.length === 0) {
    return true;
  }
  if (user?.role === "admin") {
    return true;
  }

  const userGroups = new Set(normalizeGroupList(user?.groups));
  return accessGroups.some((group) => userGroups.has(group));
}
