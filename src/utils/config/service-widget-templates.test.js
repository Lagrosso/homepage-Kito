import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import {
  isServiceWidgetSecretField,
  SERVICE_WIDGET_SECRET_FIELDS,
  SERVICE_WIDGET_TEMPLATE_BY_TYPE,
  SERVICE_WIDGET_TEMPLATES,
  SERVICE_WIDGET_TYPES,
} from "./service-widget-templates";

const componentsSource = fs.readFileSync(path.join(process.cwd(), "src/widgets/components.js"), "utf8");

function registeredWidgetTypes() {
  return [...componentsSource.matchAll(/^  ([a-zA-Z0-9_]+):/gm)].map((match) => match[1]);
}

describe("service widget templates", () => {
  it("contains the curated set of 40 service widgets", () => {
    expect(SERVICE_WIDGET_TYPES).toEqual([
      "adguard",
      "audiobookshelf",
      "authentik",
      "beszel",
      "caddy",
      "calendar",
      "calibreweb",
      "deluge",
      "dockhand",
      "fritzbox",
      "gitea",
      "gitlab",
      "glances",
      "gotify",
      "grafana",
      "karakeep",
      "homeassistant",
      "iframe",
      "immich",
      "jdownloader",
      "jellyfin",
      "linkwarden",
      "minecraft",
      "nextcloud",
      "npm",
      "paperlessngx",
      "prometheus",
      "prometheusmetric",
      "proxmox",
      "proxmoxbackupserver",
      "pterodactyl",
      "romm",
      "tailscale",
      "tdarr",
      "traefik",
      "transmission",
      "trilium",
      "uptimekuma",
      "uptimerobot",
      "vikunja",
    ]);
  });

  it("maps every template type to an existing widget component", () => {
    const registered = registeredWidgetTypes();
    SERVICE_WIDGET_TYPES.forEach((type) => expect(registered).toContain(type));
  });

  it("has unique types and populated labels", () => {
    expect(new Set(SERVICE_WIDGET_TYPES).size).toBe(SERVICE_WIDGET_TEMPLATES.length);
    SERVICE_WIDGET_TEMPLATES.forEach((template) => {
      expect(template.label).toBeTruthy();
      expect(SERVICE_WIDGET_TEMPLATE_BY_TYPE[template.type]).toBe(template);
    });
  });

  it("marks known secret fields", () => {
    SERVICE_WIDGET_SECRET_FIELDS.forEach((field) => expect(isServiceWidgetSecretField(field)).toBe(true));
    expect(isServiceWidgetSecretField("url")).toBe(false);
  });
});
