import { useEffect, useState } from "react";

// Multi-URL resolution for services (M14). A service may define several URLs for
// the different networks it is reachable on:
//
//   urls:
//     lan: http://192.168.14.2:8080
//     tailscale: http://100.x.y.z:8080
//     public: https://service.example.com
//
// The dashboard picks the URL matching the context it is *itself* accessed from
// (LAN / Tailscale / public), so links always point at a reachable address.
// `href` stays the default/fallback and full backward compatibility is preserved:
// a service without `urls` behaves exactly as before.

export const NETWORK_CONTEXTS = ["lan", "tailscale", "public"];
export const DEFAULT_CONTEXT = "lan";

// Parse an "a.b.c.d" IPv4 string into its octets, or null if it isn't one.
function ipv4Octets(host) {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) {
    return null;
  }
  const octets = match.slice(1).map((n) => Number(n));
  return octets.every((n) => n >= 0 && n <= 255) ? octets : null;
}

function isPrivateIpv4([a, b]) {
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  return false;
}

// Tailscale hands out addresses from the CGNAT range 100.64.0.0/10.
function isTailscaleIpv4([a, b]) {
  return a === 100 && b >= 64 && b <= 127;
}

// Classify a hostname into a network context. Unknown/empty → DEFAULT_CONTEXT.
export function detectContext(hostname) {
  const host = String(hostname ?? "")
    .trim()
    .toLowerCase();
  if (!host) {
    return DEFAULT_CONTEXT;
  }
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return "lan";
  }
  if (host.endsWith(".ts.net")) {
    return "tailscale";
  }

  const octets = ipv4Octets(host);
  if (octets) {
    if (octets[0] === 127) return "lan";
    if (isTailscaleIpv4(octets)) return "tailscale";
    if (isPrivateIpv4(octets)) return "lan";
    return "public";
  }

  // A bare hostname without dots is almost always a LAN/mDNS name; a dotted
  // domain (example.com) is treated as public.
  return host.includes(".") ? "public" : "lan";
}

// True when a URL points at the public internet (not a private/Tailscale/local host).
export function isPublicUrl(url) {
  if (!url || typeof url !== "string") {
    return false;
  }
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return detectContext(host) === "public";
}

// Resolve the effective URL for a service given the current context. Returns
// { url, variant } where variant is the chosen urls key ("lan"/"tailscale"/
// "public") or "href" when falling back to the plain href.
export function resolveServiceUrl(service, context = DEFAULT_CONTEXT) {
  const urls = service?.urls;
  if (urls && typeof urls === "object") {
    const order = [context, "lan", "tailscale", "public"];
    for (const key of order) {
      const candidate = urls[key];
      if (typeof candidate === "string" && candidate.trim()) {
        return { url: candidate, variant: key };
      }
    }
  }
  return { url: service?.href, variant: "href" };
}

// Client hook: SSR-stable default, then refine to the real context after mount
// so only the (invisible) href attribute updates — no hydration mismatch.
export function useNetworkContext() {
  const [context, setContext] = useState(DEFAULT_CONTEXT);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setContext(detectContext(window.location.hostname));
    }
  }, []);
  return context;
}
