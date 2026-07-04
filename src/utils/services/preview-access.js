// Client-safe mirror of utils/config/access.js, parametrized on an arbitrary
// "preview groups" list instead of a real user object. Used ONLY for the admin
// "view as profile" preview switcher (M10b): a client-side re-filter of data
// the server already sent unfiltered (admins always receive the full
// services/bookmarks/tabs). It never substitutes for server-side access
// control — non-admins keep getting filtered data straight from the API, as
// before. Kept separate from utils/config/access.js because that module
// imports utils/config/users.js, which imports node:fs and can't be bundled
// into client code (same reason tab-access.js exists as its own mirror).

function normalizeGroupList(groups) {
  if (!Array.isArray(groups)) {
    return [];
  }
  return [...new Set(groups.map((group) => String(group).trim()).filter((group) => group.length > 0))];
}

// bypass=true means "show everything" (the real, non-preview admin view).
export function isVisibleForGroups(entry, previewGroups, { bypass = false } = {}) {
  const accessGroups = normalizeGroupList(entry?.access?.groups);
  if (bypass || accessGroups.length === 0) {
    return true;
  }
  const preview = new Set(normalizeGroupList(previewGroups));
  return accessGroups.some((group) => preview.has(group));
}

export function filterServiceGroupsForGroups(groups, previewGroups, options = {}) {
  return (groups ?? [])
    .map((group) => {
      const services = (group.services ?? []).filter((service) => isVisibleForGroups(service, previewGroups, options));
      const childGroups = filterServiceGroupsForGroups(group.groups ?? [], previewGroups, options);
      return { ...group, services, groups: childGroups };
    })
    .filter((group) => group.services.length > 0 || group.groups.length > 0);
}

export function filterBookmarkGroupsForGroups(groups, previewGroups, options = {}) {
  return (groups ?? [])
    .map((group) => ({
      ...group,
      bookmarks: (group.bookmarks ?? []).filter((bookmark) => isVisibleForGroups(bookmark, previewGroups, options)),
    }))
    .filter((group) => group.bookmarks.length > 0);
}

export function isTabVisibleForGroups(tabAccessGroups, previewGroups, { bypass = false } = {}) {
  const accessGroups = normalizeGroupList(tabAccessGroups);
  if (bypass || accessGroups.length === 0) {
    return true;
  }
  const preview = new Set(normalizeGroupList(previewGroups));
  return accessGroups.some((group) => preview.has(group));
}
