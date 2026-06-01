import { normalizeGroups } from "utils/config/users";

export function getAccessGroups(entry) {
  return normalizeGroups(entry?.access?.groups);
}

export function isVisibleForUser(entry, user) {
  const accessGroups = getAccessGroups(entry);
  if (accessGroups.length === 0) {
    return true;
  }
  if (user?.role === "admin") {
    return true;
  }

  const userGroups = new Set(normalizeGroups(user?.groups));
  return accessGroups.some((group) => userGroups.has(group));
}

export function filterServiceGroupsByUser(groups, user) {
  return (groups ?? [])
    .map((group) => {
      const services = (group.services ?? []).filter((service) => isVisibleForUser(service, user));
      const childGroups = filterServiceGroupsByUser(group.groups ?? [], user);
      return { ...group, services, groups: childGroups };
    })
    .filter((group) => group.services.length > 0 || group.groups.length > 0);
}

export function filterBookmarkGroupsByUser(groups, user) {
  return (groups ?? [])
    .map((group) => ({
      ...group,
      bookmarks: (group.bookmarks ?? []).filter((bookmark) => isVisibleForUser(bookmark, user)),
    }))
    .filter((group) => group.bookmarks.length > 0);
}
