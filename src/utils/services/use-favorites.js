import useSWR from "swr";

// Client access to the per-user preferences (M12). Backed by the session-bound
// /api/user/preferences endpoint (NOT localStorage), so favorites follow the
// logged-in account across devices/browsers. SWR dedupes the single request
// shared by all service tiles and the dashboard favorites section.

const PREFERENCES_URL = "/api/user/preferences";
const EMPTY = { favorites: [] };

async function patchPreferences(body) {
  const res = await fetch(PREFERENCES_URL, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error("Failed to update preferences");
  }
  return res.json();
}

export function useFavorites() {
  const { data, mutate } = useSWR(PREFERENCES_URL);
  const prefs = data?.preferences ?? EMPTY;
  const favorites = Array.isArray(prefs.favorites) ? prefs.favorites : [];

  const optimistic = (nextPrefs) => ({ preferences: { ...prefs, ...nextPrefs } });

  const toggleFavorite = (key) => {
    const nextFavorites = favorites.includes(key) ? favorites.filter((k) => k !== key) : [key, ...favorites];
    return mutate(patchPreferences({ toggleFavorite: key }), {
      optimisticData: optimistic({ favorites: nextFavorites }),
      revalidate: false,
      rollbackOnError: true,
      populateCache: true,
    });
  };

  return {
    loaded: Boolean(data),
    favorites,
    isFavorite: (key) => favorites.includes(key),
    toggleFavorite,
  };
}
