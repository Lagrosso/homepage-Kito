import cache from "memory-cache";

// Interactive search over the homarr-labs/dashboard-icons catalog (M21b).
// M21 only guessed slugs from the service name/host; here the admin can type a
// free-text query and pick from live previews. The catalog is loaded once from
// the CDN metadata.json (which also carries aliases/categories for better
// matches) and cached in-process; matching/ranking is a pure function.

const METADATA_URL = "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons@main/metadata.json";
const ICON_CDN_BASE = "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons";
const CACHE_KEY = "dashboard-icon-index";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const DEFAULT_TIMEOUT_MS = 4000;
const DEFAULT_LIMIT = 24;

function toStringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

// Turn the raw metadata.json map into a flat, searchable index. Each entry keeps
// the slug, its preferred format (`base`) and any aliases/categories to match on.
export function parseIconIndex(metadata) {
  if (!metadata || typeof metadata !== "object") {
    return [];
  }
  const index = [];
  for (const [slug, meta] of Object.entries(metadata)) {
    if (typeof slug !== "string" || !slug) {
      continue;
    }
    const base = typeof meta?.base === "string" && meta.base ? meta.base : "svg";
    index.push({
      slug,
      base,
      aliases: toStringArray(meta?.aliases),
      categories: toStringArray(meta?.categories),
    });
  }
  return index;
}

function withTimeout(fetchImpl, timeoutMs) {
  return async (url, options = {}) => {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      return await fetchImpl(url, { ...options, signal: controller?.signal });
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  };
}

// Load (and cache) the dashboard-icons index. Best effort: on any failure we
// return whatever is cached, otherwise an empty list — the UI degrades to "no
// results" instead of erroring, matching the M21 icon-suggestions behavior.
export async function fetchDashboardIconIndex(options = {}) {
  const cached = cache.get(CACHE_KEY);
  if (cached) {
    return cached;
  }
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return [];
  }
  const fetcher = withTimeout(fetchImpl, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetcher(METADATA_URL, { method: "GET" });
    if (!response.ok) {
      return [];
    }
    const metadata = await response.json();
    const index = parseIconIndex(metadata);
    if (index.length > 0) {
      cache.put(CACHE_KEY, index, CACHE_TTL_MS);
    }
    return index;
  } catch {
    return [];
  }
}

// Rank a single index entry against the lowercased query. Higher is better;
// null means "no match". Exact slug > slug prefix > slug substring > alias
// (prefix > substring) > category.
function scoreEntry(entry, q) {
  const slug = entry.slug.toLowerCase();
  if (slug === q) {
    return 100;
  }
  if (slug.startsWith(q)) {
    return 80;
  }
  if (slug.includes(q)) {
    return 60;
  }
  let best = null;
  for (const alias of entry.aliases) {
    const a = alias.toLowerCase();
    if (a === q || a.startsWith(q)) {
      best = Math.max(best ?? 0, 45);
    } else if (a.includes(q)) {
      best = Math.max(best ?? 0, 35);
    }
  }
  if (best !== null) {
    return best;
  }
  if (entry.categories.some((category) => category.toLowerCase().includes(q))) {
    return 20;
  }
  return null;
}

function previewUrl(entry) {
  return `${ICON_CDN_BASE}/${entry.base}/${entry.slug}.${entry.base}`;
}

// Pure filter/rank over a parsed index. Returns suggestion objects compatible
// with the existing IconSuggestionList (source/icon/label/previewUrl/reason).
export function searchDashboardIcons(query, index, { limit = DEFAULT_LIMIT } = {}) {
  const q = typeof query === "string" ? query.trim().toLowerCase() : "";
  if (q.length < 2 || !Array.isArray(index)) {
    return [];
  }
  const scored = [];
  for (const entry of index) {
    const score = scoreEntry(entry, q);
    if (score !== null) {
      scored.push({ entry, score });
    }
  }
  scored.sort((a, b) => b.score - a.score || a.entry.slug.localeCompare(b.entry.slug));
  return scored.slice(0, limit).map(({ entry }) => ({
    source: "dashboard-icons",
    icon: `${entry.slug}.${entry.base}`,
    label: entry.slug,
    previewUrl: previewUrl(entry),
    confidence: 90,
    reason: "Dashboard-icons search match",
  }));
}
