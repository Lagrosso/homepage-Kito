import useSWR from "swr";

// Client access to the per-user preferences (M12). Backed by the session-bound
// /api/user/preferences endpoint (NOT localStorage), so favorites and usage follow
// the logged-in account across devices/browsers. SWR dedupes the single request
// shared by all service tiles and the dashboard sections.

const PREFERENCES_URL = "/api/user/preferences";
const EMPTY = { favorites: [], usage: {}, enabled: true };

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
  const enabled = prefs.enabled !== false;
  const favorites = Array.isArray(prefs.favorites) ? prefs.favorites : [];
  const usage = prefs.usage && typeof prefs.usage === "object" ? prefs.usage : {};

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

  const setEnabled = (value) =>
    mutate(patchPreferences({ enabled: value }), {
      optimisticData: optimistic({ enabled: value }),
      revalidate: false,
      rollbackOnError: true,
      populateCache: true,
    });

  // Fire-and-forget: never blocks navigation. Revalidate so recent/frequent update.
  const recordOpen = (key) => {
    if (!enabled || !key) {
      return;
    }
    patchPreferences({ recordOpen: key })
      .then(() => mutate())
      .catch(() => {});
  };

  return {
    loaded: Boolean(data),
    enabled,
    favorites,
    usage,
    isFavorite: (key) => favorites.includes(key),
    toggleFavorite,
    recordOpen,
    setEnabled,
  };
}
