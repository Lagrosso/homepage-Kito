export const SERVICE_WIDGET_TEMPLATES = [
  {
    type: "adguard",
    label: "Adguard Home",
    fields: ["url", "username", "password"],
    allowedFields: ["queries", "blocked", "filtered", "latency"],
  },
  {
    type: "audiobookshelf",
    label: "Audiobookshelf",
    fields: ["url", "key"],
    allowedFields: ["podcasts", "podcastsDuration", "books", "booksDuration"],
  },
  {
    type: "authentik",
    label: "Authentik",
    fields: ["url", "key"],
    allowedFields: ["users", "loginsLast24H", "failedLoginsLast24H"],
  },
  {
    type: "beszel",
    label: "Beszel",
    fields: ["url", "username", "password", "systemId"],
    allowedFields: ["systems", "up", "name", "status", "updated", "cpu", "memory", "disk", "network"],
    supportsRawMode: true,
  },
  { type: "caddy", label: "Caddy", fields: ["url"], allowedFields: ["upstreams", "requests", "requests_failed"] },
  { type: "calendar", label: "Calendar", fields: ["url", "timezone", "view"] },
  {
    type: "calibreweb",
    label: "Calibre-Web",
    fields: ["url", "username", "password"],
    allowedFields: ["books", "authors", "categories", "series"],
  },
  {
    type: "deluge",
    label: "Deluge",
    fields: ["url", "password"],
    allowedFields: ["leech", "download", "seed", "upload"],
  },
  {
    type: "dockhand",
    label: "Dockhand",
    fields: ["url", "key"],
    allowedFields: [
      "running",
      "stopped",
      "paused",
      "total",
      "cpu",
      "memory",
      "images",
      "volumes",
      "events_today",
      "pending_updates",
      "stacks",
    ],
    defaultFields: ["running", "total", "cpu", "memory"],
    maxFields: 4,
  },
  {
    type: "fritzbox",
    label: "Fritz!Box",
    fields: ["url", "username", "password"],
    allowedFields: [
      "connectionStatus",
      "uptime",
      "maxDown",
      "maxUp",
      "down",
      "up",
      "received",
      "sent",
      "externalIPAddress",
      "externalIPv6Address",
      "externalIPv6Prefix",
    ],
    defaultFields: ["connectionStatus", "uptime", "maxDown", "maxUp"],
    maxFields: 4,
  },
  {
    type: "gitea",
    label: "Gitea",
    fields: ["url", "key"],
    allowedFields: ["repositories", "notifications", "issues", "pulls"],
  },
  {
    type: "gitlab",
    label: "Gitlab",
    fields: ["url", "key"],
    allowedFields: ["events", "issues", "merges", "projects"],
  },
  {
    type: "glances",
    label: "Glances",
    fields: [
      "url",
      "username",
      "password",
      "metric",
      "version",
      "diskUnits",
      "refreshInterval",
      "pointsLimit",
      "chart",
    ],
    supportsRawMode: true,
  },
  { type: "gotify", label: "Gotify", fields: ["url", "key"], allowedFields: ["apps", "clients", "messages"] },
  {
    type: "grafana",
    label: "Grafana",
    fields: ["url", "username", "password", "key"],
    allowedFields: ["dashboards", "datasources", "totalalerts", "alertstriggered"],
  },
  {
    type: "karakeep",
    label: "Karakeep",
    fields: ["url", "key"],
    allowedFields: ["bookmarks", "favorites", "archived", "highlights", "lists", "tags"],
    maxFields: 4,
  },
  { type: "homeassistant", label: "Home Assistant", fields: ["url", "key"], supportsRawMode: true },
  {
    type: "iframe",
    label: "iFrame",
    fields: ["src", "name", "classes", "allowScrolling", "refreshInterval"],
    supportsRawMode: true,
  },
  { type: "immich", label: "Immich", fields: ["url", "key"], allowedFields: ["users", "photos", "videos", "storage"] },
  {
    type: "jdownloader",
    label: "JDownloader",
    fields: ["username", "password", "client"],
    allowedFields: ["downloadCount", "downloadTotalBytes", "downloadBytesRemaining", "downloadSpeed"],
  },
  {
    type: "jellyfin",
    label: "Jellyfin",
    fields: [
      "url",
      "key",
      "version",
      "enableBlocks",
      "enableNowPlaying",
      "enableUser",
      "enableMediaControl",
      "showEpisodeNumber",
      "expandOneStreamToTwoRows",
    ],
    allowedFields: ["movies", "series", "episodes", "songs"],
    supportsRawMode: true,
  },
  { type: "linkwarden", label: "Linkwarden", fields: ["url", "key"], allowedFields: ["links", "collections", "tags"] },
  {
    type: "minecraft",
    label: "Minecraft",
    fields: ["url", "server", "port"],
    allowedFields: ["players", "version", "status"],
  },
  {
    type: "nextcloud",
    label: "Nextcloud",
    fields: ["url", "key", "username", "password"],
    allowedFields: ["cpuload", "memoryusage", "freespace", "activeusers", "numfiles", "numshares"],
    maxFields: 4,
  },
  {
    type: "npm",
    label: "NGINX Proxy Manager",
    fields: ["url", "username", "password"],
    allowedFields: ["enabled", "disabled", "total"],
  },
  { type: "paperlessngx", label: "PaperlessNGX", fields: ["url", "key"], allowedFields: ["total", "inbox"] },
  {
    type: "prometheus",
    label: "Prometheus",
    fields: ["url"],
    allowedFields: ["targets_up", "targets_down", "targets_total"],
  },
  {
    type: "prometheusmetric",
    label: "Prometheus Metric",
    fields: ["url", "refreshInterval", "metrics"],
    supportsRawMode: true,
  },
  {
    type: "proxmox",
    label: "Proxmox",
    fields: ["url", "username", "password", "node"],
    allowedFields: ["vms", "lxc", "resources.cpu", "resources.mem"],
  },
  {
    type: "proxmoxbackupserver",
    label: "Proxmox Backup Server",
    fields: ["url", "username", "password", "datastore"],
    allowedFields: ["datastore_usage", "failed_tasks_24h", "cpu_usage", "memory_usage"],
  },
  { type: "pterodactyl", label: "Pterodactyl", fields: ["url", "key"], allowedFields: ["nodes", "servers"] },
  {
    type: "romm",
    label: "ROMM",
    fields: ["url", "username", "password"],
    allowedFields: ["platforms", "totalRoms", "saves", "states", "screenshots", "totalfilesize"],
    maxFields: 4,
  },
  {
    type: "tailscale",
    label: "Tailscale",
    fields: ["deviceid", "key"],
    allowedFields: [
      "address",
      "last_seen",
      "expires",
      "user",
      "hostname",
      "name",
      "client_version",
      "os",
      "created",
      "authorized",
      "is_external",
      "update_available",
      "tags",
    ],
  },
  { type: "tdarr", label: "TDarr", fields: ["url"], allowedFields: ["queue", "processed", "errored", "saved"] },
  { type: "traefik", label: "Traefik", fields: ["url"], allowedFields: ["routers", "services", "middleware"] },
  {
    type: "transmission",
    label: "Transmission",
    fields: ["url", "username", "password"],
    allowedFields: ["leech", "download", "seed", "upload"],
  },
  { type: "trilium", label: "Trilium", fields: ["url", "key"], allowedFields: ["version", "notesCount", "dbSize"] },
  {
    type: "uptimekuma",
    label: "Uptime Kuma",
    fields: ["url", "slug"],
    allowedFields: ["up", "down", "uptime", "incident"],
  },
  {
    type: "uptimerobot",
    label: "UptimeRobot",
    fields: ["key", "url"],
    allowedFields: ["status", "uptime", "lastDown", "downDuration", "sitesUp", "sitesDown"],
  },
  {
    type: "vikunja",
    label: "Vikunja",
    fields: ["url", "key", "enableTaskList", "version"],
    allowedFields: ["projects", "tasks7d", "tasksOverdue", "tasksInProgress"],
    supportsRawMode: true,
  },
];

SERVICE_WIDGET_TEMPLATES.forEach((template) => {
  template.optionFields = template.optionFields ?? template.fields ?? [];
  template.displayFields = template.displayFields ?? template.allowedFields ?? [];
});

export const SERVICE_WIDGET_TEMPLATE_BY_TYPE = Object.fromEntries(
  SERVICE_WIDGET_TEMPLATES.map((template) => [template.type, template]),
);

export const SERVICE_WIDGET_TYPES = SERVICE_WIDGET_TEMPLATES.map((template) => template.type);

export const SERVICE_WIDGET_SECRET_FIELDS = ["username", "password", "key", "apiKey", "token", "secret"];

export function isServiceWidgetSecretField(field) {
  return SERVICE_WIDGET_SECRET_FIELDS.includes(String(field));
}

export function validateServiceWidgetFields(template, fields = []) {
  const selected = Array.isArray(fields) ? fields.filter(Boolean) : [];
  const allowed = template?.allowedFields;
  if (!allowed || allowed.length === 0) {
    return { valid: true, invalidFields: [], tooMany: false };
  }
  const invalidFields = selected.filter((field) => !allowed.includes(field));
  const tooMany = Number.isInteger(template.maxFields) && selected.length > template.maxFields;
  return { valid: invalidFields.length === 0 && !tooMany, invalidFields, tooMany };
}
