import cache from "memory-cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchDashboardIconIndex, parseIconIndex, searchDashboardIcons } from "./icon-search";

const METADATA = {
  jellyfin: { base: "svg", aliases: ["jellyfin media"], categories: ["media"] },
  jellyseerr: { base: "svg", aliases: [], categories: ["media"] },
  "home-assistant": { base: "png", aliases: ["hass", "homeassistant"], categories: ["home-automation"] },
  grafana: { base: "svg", aliases: [], categories: ["monitoring"] },
};

function jsonResponse(body, ok = true) {
  return { ok, status: ok ? 200 : 500, json: vi.fn().mockResolvedValue(body) };
}

beforeEach(() => {
  cache.del("dashboard-icon-index");
});

afterEach(() => {
  cache.del("dashboard-icon-index");
  vi.restoreAllMocks();
});

describe("parseIconIndex", () => {
  it("flattens the metadata map into slug/base/aliases/categories", () => {
    const index = parseIconIndex(METADATA);
    expect(index).toHaveLength(4);
    const jelly = index.find((e) => e.slug === "jellyfin");
    expect(jelly).toEqual({ slug: "jellyfin", base: "svg", aliases: ["jellyfin media"], categories: ["media"] });
  });

  it("defaults base to svg and tolerates junk", () => {
    expect(parseIconIndex({ foo: {} })[0]).toMatchObject({ slug: "foo", base: "svg", aliases: [], categories: [] });
    expect(parseIconIndex(null)).toEqual([]);
  });
});

describe("searchDashboardIcons", () => {
  const index = parseIconIndex(METADATA);

  it("returns nothing for a query shorter than 2 chars", () => {
    expect(searchDashboardIcons("j", index)).toEqual([]);
    expect(searchDashboardIcons("", index)).toEqual([]);
  });

  it("ranks exact/prefix/substring slug matches and shapes suggestions", () => {
    const results = searchDashboardIcons("jelly", index);
    expect(results.map((r) => r.icon)).toEqual(["jellyfin.svg", "jellyseerr.svg"]);
    expect(results[0]).toMatchObject({
      source: "dashboard-icons",
      icon: "jellyfin.svg",
      label: "jellyfin",
      previewUrl: "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/jellyfin.svg",
    });
  });

  it("matches on aliases (hass -> home-assistant, png base)", () => {
    const results = searchDashboardIcons("hass", index);
    expect(results.map((r) => r.icon)).toContain("home-assistant.png");
  });

  it("matches on categories", () => {
    expect(searchDashboardIcons("monitoring", index).map((r) => r.label)).toContain("grafana");
  });

  it("honors the limit", () => {
    expect(searchDashboardIcons("media", index, { limit: 1 })).toHaveLength(1);
  });
});

describe("fetchDashboardIconIndex", () => {
  it("fetches, parses and caches the index (second call skips fetch)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(METADATA));
    const first = await fetchDashboardIconIndex({ fetchImpl });
    expect(first).toHaveLength(4);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const second = await fetchDashboardIconIndex({ fetchImpl });
    expect(second).toHaveLength(4);
    expect(fetchImpl).toHaveBeenCalledTimes(1); // served from cache
  });

  it("returns an empty list on fetch failure", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network"));
    expect(await fetchDashboardIconIndex({ fetchImpl })).toEqual([]);
  });

  it("returns an empty list on a non-ok response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false));
    expect(await fetchDashboardIconIndex({ fetchImpl })).toEqual([]);
  });
});
