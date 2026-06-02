const DASHBOARD_ICON_BASE = "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons";
const DASHBOARD_ICON_EXTENSIONS = ["svg", "webp", "png"];
const MAX_CANDIDATE_SLUGS = 8;
const MAX_SUGGESTIONS = 10;
const DEFAULT_TIMEOUT_MS = 1500;
const MAX_HTML_BYTES = 200000;

const KNOWN_ALIASES = {
  "adguard home": "adguard-home",
  audiobookshelf: "audiobookshelf",
  authentik: "authentik",
  beszel: "beszel",
  "calibre web": "calibre-web",
  calibreweb: "calibre-web",
  caddy: "caddy",
  deluge: "deluge",
  dockhand: "dockhand",
  "fritz box": "fritzbox",
  "fritz!box": "fritzbox",
  gitea: "gitea",
  gitlab: "gitlab",
  glances: "glances",
  gotify: "gotify",
  grafana: "grafana",
  karakeep: "karakeep",
  "home assistant": "home-assistant",
  homeassistant: "home-assistant",
  immich: "immich",
  jdownloader: "jdownloader",
  jellyfin: "jellyfin",
  linkwarden: "linkwarden",
  minecraft: "minecraft",
  nextcloud: "nextcloud",
  "nginx proxy manager": "nginx-proxy-manager",
  npm: "nginx-proxy-manager",
  paperlessngx: "paperless-ngx",
  "paperless ngx": "paperless-ngx",
  prometheus: "prometheus",
  proxmox: "proxmox",
  "proxmox backup server": "proxmox-backup-server",
  proxmoxbackupserver: "proxmox-backup-server",
  pterodactyl: "pterodactyl",
  romm: "romm",
  tailscale: "tailscale",
  tdarr: "tdarr",
  traefik: "traefik",
  transmission: "transmission",
  trilium: "trilium",
  "uptime kuma": "uptime-kuma",
  uptimekuma: "uptime-kuma",
  uptimerobot: "uptimerobot",
  vikunja: "vikunja",
};

function stripExtension(value) {
  return value.replace(/\.(svg|webp|png|ico)$/i, "");
}

export function normalizeIconSlug(value) {
  if (typeof value !== "string") {
    return "";
  }
  return stripExtension(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function addUnique(list, value) {
  const slug = normalizeIconSlug(value);
  if (slug && !list.includes(slug)) {
    list.push(slug);
  }
}

function hostnameFromUrl(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    return "";
  }
  try {
    return new URL(rawUrl).hostname;
  } catch {
    return "";
  }
}

function hostBaseName(hostname) {
  if (!hostname || /^[\d.:]+$/.test(hostname)) {
    return "";
  }
  const parts = hostname.split(".").filter(Boolean);
  if (parts.length <= 1) {
    return hostname;
  }
  const secondLevelDomains = new Set(["co", "com", "net", "org"]);
  const candidate = parts.length > 2 && secondLevelDomains.has(parts.at(-2)) ? parts.at(-3) : parts.at(-2);
  return candidate ?? "";
}

export function buildIconCandidateSlugs({ name, href, widgetType, currentIcon } = {}) {
  const slugs = [];
  const normalizedName = normalizeIconSlug(name);
  const aliasKey = String(name ?? "")
    .trim()
    .toLowerCase();
  const compactAliasKey = aliasKey.replace(/[^a-z0-9]+/g, "");
  addUnique(slugs, KNOWN_ALIASES[aliasKey]);
  addUnique(slugs, KNOWN_ALIASES[compactAliasKey]);
  addUnique(slugs, normalizedName);
  addUnique(slugs, String(name ?? "").replace(/\s+/g, ""));
  addUnique(slugs, widgetType);

  const host = hostnameFromUrl(href);
  addUnique(slugs, hostBaseName(host));
  addUnique(slugs, host.split(".")[0]);

  if (typeof currentIcon === "string" && currentIcon && !currentIcon.includes("://")) {
    addUnique(slugs, currentIcon.replace(/^(sh|si|mdi)-/, ""));
  }

  return slugs.slice(0, MAX_CANDIDATE_SLUGS);
}

function dashboardIconUrl(slug, extension) {
  return `${DASHBOARD_ICON_BASE}/${extension}/${slug}.${extension}`;
}

function candidateKey(candidate) {
  return `${candidate.source}:${candidate.icon}`;
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = candidateKey(candidate);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
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

async function urlExists(fetcher, url) {
  try {
    const head = await fetcher(url, { method: "HEAD" });
    if (head.ok) {
      return true;
    }
    if (![405, 403].includes(head.status)) {
      return false;
    }
    const get = await fetcher(url, { method: "GET" });
    return get.ok;
  } catch {
    return false;
  }
}

async function dashboardIconSuggestions(slugs, fetcher) {
  const suggestions = [];
  for (const slug of slugs) {
    for (const extension of DASHBOARD_ICON_EXTENSIONS) {
      const url = dashboardIconUrl(slug, extension);
      if (await urlExists(fetcher, url)) {
        suggestions.push({
          source: "dashboard-icons",
          icon: `${slug}.${extension}`,
          label: `${slug}.${extension}`,
          previewUrl: url,
          confidence: 95,
          reason: "Found in homarr-labs/dashboard-icons",
        });
        break;
      }
    }
    if (suggestions.length >= 4) {
      break;
    }
  }
  return suggestions;
}

function localSyntaxSuggestions(slugs) {
  return slugs.slice(0, 3).flatMap((slug, index) => [
    {
      source: "selfh.st",
      icon: `sh-${slug}`,
      label: `sh-${slug}`,
      previewUrl: null,
      confidence: 70 - index,
      reason: "Self-hosted icon naming pattern",
    },
    {
      source: "simple-icons",
      icon: `si-${slug}`,
      label: `si-${slug}`,
      previewUrl: null,
      confidence: 65 - index,
      reason: "Simple Icons naming pattern",
    },
  ]);
}

function absoluteUrl(baseUrl, href) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return "";
  }
}

export function extractFaviconUrls(html, pageUrl) {
  if (typeof html !== "string" || !pageUrl) {
    return [];
  }
  const matches = [...html.matchAll(/<link\b[^>]*>/gi)];
  const icons = [];
  matches.forEach(([tag]) => {
    const rel = tag.match(/\brel=["']?([^"'\s>]+(?:\s+[^"'\s>]+)*)/i)?.[1]?.toLowerCase() ?? "";
    if (!rel.split(/\s+/).some((part) => ["icon", "shortcut", "apple-touch-icon"].includes(part))) {
      return;
    }
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1] ?? tag.match(/\bhref=([^\s>]+)/i)?.[1] ?? "";
    const resolved = absoluteUrl(pageUrl, href);
    if (resolved && !icons.includes(resolved)) {
      icons.push(resolved);
    }
  });
  return icons.slice(0, 3);
}

async function faviconSuggestions(href, fetcher) {
  if (!href || typeof href !== "string") {
    return [];
  }
  let base;
  try {
    base = new URL(href);
  } catch {
    return [];
  }

  const direct = new URL("/favicon.ico", base.origin).toString();
  const suggestions = [];
  if (await urlExists(fetcher, direct)) {
    suggestions.push({
      source: "favicon",
      icon: direct,
      label: "favicon.ico",
      previewUrl: direct,
      confidence: 60,
      reason: "Found /favicon.ico on the service host",
    });
  }

  try {
    const response = await fetcher(base.toString(), {
      method: "GET",
      headers: { Accept: "text/html,application/xhtml+xml" },
    });
    if (response.ok) {
      const html = (await response.text()).slice(0, MAX_HTML_BYTES);
      extractFaviconUrls(html, base.toString()).forEach((url, index) => {
        suggestions.push({
          source: "favicon",
          icon: url,
          label: new URL(url).pathname.split("/").pop() || "favicon",
          previewUrl: url,
          confidence: 58 - index,
          reason: "Found icon link in service HTML",
        });
      });
    }
  } catch {
    // Favicon discovery is best effort.
  }

  return suggestions;
}

export async function suggestServiceIcons(input = {}, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const slugs = buildIconCandidateSlugs(input);
  const localSuggestions = localSyntaxSuggestions(slugs);

  if (typeof fetchImpl !== "function") {
    return dedupeCandidates(localSuggestions).slice(0, MAX_SUGGESTIONS);
  }

  const fetcher = withTimeout(fetchImpl, timeoutMs);
  const [dashboardSuggestions, favicons] = await Promise.all([
    dashboardIconSuggestions(slugs, fetcher),
    faviconSuggestions(input.href, fetcher),
  ]);

  return dedupeCandidates([...dashboardSuggestions, ...localSuggestions, ...favicons])
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_SUGGESTIONS);
}
