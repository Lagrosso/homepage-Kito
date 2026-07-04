import { serviceKey } from "./service-key";

// Pure helpers that turn favorites data (M12) into a synthetic service group the
// dashboard can render with the normal <ServicesGroup>. Each collected service is
// cloned with `favoriteKey` = its original group::name so the pin star keeps
// acting on the original service, not the synthetic "Favorites" section it is
// shown in.

// Flatten all services (recursing subgroups), keyed by serviceKey. First
// occurrence wins if a name somehow repeats.
export function indexServices(groups) {
  const map = new Map();
  const walk = (group) => {
    (group.services ?? []).forEach((service) => {
      const key = serviceKey(group.name, service.name);
      if (!map.has(key)) {
        map.set(key, { ...service, favoriteKey: key });
      }
    });
    (group.groups ?? []).forEach(walk);
  };
  (groups ?? []).forEach(walk);
  return map;
}

function synthGroup(name, services) {
  if (!services.length) {
    return null;
  }
  return { name, type: "group", services, groups: [] };
}

// Favorited services, in the stored order (most-recently pinned first).
export function buildFavoritesGroup(groups, favoriteKeys, name = "Favorites") {
  const index = indexServices(groups);
  const services = (favoriteKeys ?? []).map((key) => index.get(key)).filter(Boolean);
  return synthGroup(name, services);
}

// Recursively reduce a service group to only favorited services (for the
// "favorites only" dashboard filter). Mirrors filterServiceGroupForProblematic.
export function filterServiceGroupForFavorites(group, favoriteKeys) {
  const favSet = favoriteKeys instanceof Set ? favoriteKeys : new Set(favoriteKeys ?? []);
  const services = (group.services ?? []).filter((service) => favSet.has(serviceKey(group.name, service.name)));
  const groups = (group.groups ?? [])
    .map((subgroup) => filterServiceGroupForFavorites(subgroup, favSet))
    .filter(Boolean);

  if (services.length === 0 && groups.length === 0) {
    return null;
  }

  return { ...group, services, groups };
}
