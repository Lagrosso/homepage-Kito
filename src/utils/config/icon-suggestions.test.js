import { describe, expect, it, vi } from "vitest";

import {
  buildIconCandidateSlugs,
  extractFaviconUrls,
  normalizeIconSlug,
  suggestServiceIcons,
} from "./icon-suggestions";

function response({ ok = true, status = ok ? 200 : 404, text = "" } = {}) {
  return {
    ok,
    status,
    text: vi.fn().mockResolvedValue(text),
  };
}

describe("icon-suggestions", () => {
  it("normalizes service names into icon slugs", () => {
    expect(normalizeIconSlug("NGINX Proxy Manager")).toBe("nginx-proxy-manager");
    expect(normalizeIconSlug("Paperless-ngx.svg")).toBe("paperless-ngx");
  });

  it("builds candidates from aliases, widget type and hostname", () => {
    expect(
      buildIconCandidateSlugs({
        name: "AdGuard Home",
        href: "https://adguard.lan/admin",
        widgetType: "adguard",
      }),
    ).toEqual(expect.arrayContaining(["adguard-home", "adguard"]));
  });

  it("extracts favicon links from service HTML", () => {
    const html = `
      <html>
        <head>
          <link rel="shortcut icon" href="/favicon.ico">
          <link rel="apple-touch-icon" href="https://example.test/apple.png">
        </head>
      </html>
    `;

    expect(extractFaviconUrls(html, "https://service.test/app")).toEqual([
      "https://service.test/favicon.ico",
      "https://example.test/apple.png",
    ]);
  });

  it("returns dashboard-icons, syntax suggestions and favicons", async () => {
    const fetchImpl = vi.fn(async (url, options) => {
      if (url.includes("dashboard-icons/svg/jellyfin.svg") && options?.method === "HEAD") {
        return response();
      }
      if (url === "https://jellyfin.test/favicon.ico") {
        return response();
      }
      if (url === "https://jellyfin.test/" && options?.method === "GET") {
        return response({
          text: '<link rel="icon" href="/icon.png">',
        });
      }
      return response({ ok: false, status: 404 });
    });

    const suggestions = await suggestServiceIcons(
      { name: "Jellyfin", href: "https://jellyfin.test/" },
      { fetchImpl, timeoutMs: 50 },
    );

    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "dashboard-icons", icon: "jellyfin.svg" }),
        expect.objectContaining({ source: "selfh.st", icon: "sh-jellyfin" }),
        expect.objectContaining({ source: "simple-icons", icon: "si-jellyfin" }),
        expect.objectContaining({ source: "favicon", icon: "https://jellyfin.test/favicon.ico" }),
      ]),
    );
  });

  it("falls back to local syntax suggestions when fetch is unavailable", async () => {
    const suggestions = await suggestServiceIcons({ name: "Grafana" }, { fetchImpl: null });

    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "selfh.st", icon: "sh-grafana" }),
        expect.objectContaining({ source: "simple-icons", icon: "si-grafana" }),
      ]),
    );
  });
});
