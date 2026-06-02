export const INFO_WIDGET_TEMPLATES = [
  {
    type: "datetime",
    label: "Date & Time",
    fields: [
      { key: "text_size", type: "enum", options: ["4xl", "3xl", "2xl", "xl", "md", "sm", "xs"] },
      { key: "locale", type: "string" },
    ],
    advancedFields: ["format"],
  },
  {
    type: "greeting",
    label: "Greeting",
    fields: [
      { key: "text_size", type: "enum", options: ["4xl", "3xl", "2xl", "xl", "md", "sm", "xs"] },
      { key: "text", type: "string" },
    ],
  },
  {
    type: "logo",
    label: "Logo",
    fields: [{ key: "icon", type: "string" }],
  },
  {
    type: "openmeteo",
    label: "Open-Meteo",
    fields: [
      { key: "label", type: "string" },
      { key: "latitude", type: "number" },
      { key: "longitude", type: "number" },
      { key: "timezone", type: "string" },
      { key: "units", type: "enum", options: ["metric", "imperial"] },
      { key: "cache", type: "number" },
    ],
    advancedFields: ["format"],
  },
  {
    type: "resources",
    label: "Resources",
    fields: [
      { key: "label", type: "string" },
      { key: "cpu", type: "boolean" },
      { key: "memory", type: "boolean" },
      { key: "disk", type: "listOrString" },
      { key: "cputemp", type: "boolean" },
      { key: "tempmin", type: "number" },
      { key: "tempmax", type: "number" },
      { key: "uptime", type: "boolean" },
      { key: "units", type: "enum", options: ["metric", "imperial"] },
      { key: "refresh", type: "number" },
      { key: "diskUnits", type: "enum", options: ["bytes", "bbytes"] },
      { key: "network", type: "boolean" },
      { key: "expanded", type: "boolean" },
    ],
  },
  {
    type: "search",
    label: "Search",
    fields: [
      { key: "provider", type: "listOrString", placeholder: "google or brave, google" },
      { key: "focus", type: "boolean" },
      { key: "showSearchSuggestions", type: "boolean" },
      { key: "target", type: "enum", options: ["_blank", "_self"] },
      { key: "url", type: "string" },
      { key: "suggestionUrl", type: "string" },
    ],
  },
];

export const INFO_WIDGET_TEMPLATE_BY_TYPE = Object.fromEntries(
  INFO_WIDGET_TEMPLATES.map((template) => [template.type, template]),
);

export const INFO_WIDGET_TYPES = INFO_WIDGET_TEMPLATES.map((template) => template.type);

export function parseInfoWidgetValue(field, raw) {
  if (raw === undefined) {
    return undefined;
  }
  if (field.type === "boolean") {
    if (raw === "") {
      return "";
    }
    return Boolean(raw);
  }
  const value = typeof raw === "string" ? raw.trim() : raw;
  if (value === "") {
    return "";
  }
  if (field.type === "number") {
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) {
      throw new Error(`${field.key} must be a number`);
    }
    return numericValue;
  }
  if (field.type === "listOrString") {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }
    const items = String(value)
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    return items.length > 1 ? items : items[0] || "";
  }
  if (field.type === "enum" && field.options?.length && !field.options.includes(value)) {
    throw new Error(`${field.key} must be one of ${field.options.join(", ")}`);
  }
  return value;
}
