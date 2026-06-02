export const SERVICE_WIDGET_TEMPLATES = [
  {
    type: "adguard",
    label: "Adguard Home",
    fields: ["url", "username", "password"],
    displayFields: ["queries", "blocked", "filtered", "latency"],
  },
  { type: "audiobookshelf", label: "Audiobookshelf", fields: ["url", "key"] },
  { type: "authentik", label: "Authentik", fields: ["url", "key"] },
  { type: "beszel", label: "Beszel", fields: ["url", "username", "password"] },
  { type: "caddy", label: "Caddy", fields: ["url"] },
  { type: "calendar", label: "Calendar", fields: ["url", "timezone", "view"] },
  { type: "calibreweb", label: "Calibre-Web", fields: ["url", "username", "password"] },
  { type: "deluge", label: "Deluge", fields: ["url", "password"] },
  { type: "dockhand", label: "Dockhand", fields: ["url", "key"] },
  {
    type: "fritzbox",
    label: "Fritz!Box",
    fields: ["url", "username", "password"],
    displayFields: ["connectionStatus", "uptime", "maxDown", "maxUp"],
  },
  { type: "gitea", label: "Gitea", fields: ["url", "key"] },
  { type: "gitlab", label: "Gitlab", fields: ["url", "key"] },
  { type: "glances", label: "Glances", fields: ["url", "username", "password", "metric", "version"] },
  { type: "gotify", label: "Gotify", fields: ["url", "key"] },
  { type: "grafana", label: "Grafana", fields: ["url", "username", "password", "key"] },
  { type: "karakeep", label: "Karakeep", fields: ["url", "key"] },
  { type: "homeassistant", label: "Home Assistant", fields: ["url", "key"] },
  { type: "iframe", label: "iFrame", fields: ["src", "name", "classes", "allowScrolling", "refreshInterval"] },
  { type: "immich", label: "Immich", fields: ["url", "key"] },
  { type: "jdownloader", label: "JDownloader", fields: ["username", "password", "client"] },
  { type: "jellyfin", label: "Jellyfin", fields: ["url", "key"] },
  { type: "linkwarden", label: "Linkwarden", fields: ["url", "key"] },
  { type: "minecraft", label: "Minecraft", fields: ["url", "server", "port"] },
  { type: "nextcloud", label: "Nextcloud", fields: ["url", "username", "password"] },
  {
    type: "npm",
    label: "NGINX Proxy Manager",
    fields: ["url", "username", "password"],
    displayFields: ["enabled", "disabled", "total"],
  },
  { type: "paperlessngx", label: "PaperlessNGX", fields: ["url", "key"] },
  { type: "prometheus", label: "Prometheus", fields: ["url"] },
  { type: "prometheusmetric", label: "Prometheus Metric", fields: ["url", "refreshInterval", "metrics"] },
  { type: "proxmox", label: "Proxmox", fields: ["url", "username", "password", "node"] },
  { type: "proxmoxbackupserver", label: "Proxmox Backup Server", fields: ["url", "username", "password", "datastore"] },
  { type: "pterodactyl", label: "Pterodactyl", fields: ["url", "key"] },
  { type: "romm", label: "ROMM", fields: ["url", "username", "password"] },
  {
    type: "tailscale",
    label: "Tailscale",
    fields: ["deviceid", "key"],
    displayFields: ["address", "last_seen", "expires"],
  },
  { type: "tdarr", label: "TDarr", fields: ["url"] },
  { type: "traefik", label: "Traefik", fields: ["url"] },
  { type: "transmission", label: "Transmission", fields: ["url", "username", "password"] },
  { type: "trilium", label: "Trilium", fields: ["url", "key"] },
  { type: "uptimekuma", label: "Uptime Kuma", fields: ["url", "slug"] },
  { type: "uptimerobot", label: "UptimeRobot", fields: ["key"] },
  { type: "vikunja", label: "Vikunja", fields: ["url", "key"] },
];

export const SERVICE_WIDGET_TEMPLATE_BY_TYPE = Object.fromEntries(
  SERVICE_WIDGET_TEMPLATES.map((template) => [template.type, template]),
);

export const SERVICE_WIDGET_TYPES = SERVICE_WIDGET_TEMPLATES.map((template) => template.type);

export const SERVICE_WIDGET_SECRET_FIELDS = ["username", "password", "key", "apiKey", "token", "secret"];

export function isServiceWidgetSecretField(field) {
  return SERVICE_WIDGET_SECRET_FIELDS.includes(String(field));
}
