// Static preset definitions for /admin/theme. Each preset maps to the settings.yaml
// fields: color, theme, cardBlur. Applied via yaml-edit updateSetting / deleteSetting.

export const THEME_PRESETS = [
  // --- Dark themes ---
  { id: "oled-dark",       label: "OLED Dark",       color: "zinc",     theme: "dark",  cardBlur: "" },
  { id: "homelab-neon",    label: "Homelab Neon",     color: "denim",    theme: "dark",  cardBlur: "sm" },
  { id: "glass",           label: "Glasoptik",        color: "slate",    theme: "dark",  cardBlur: "md" },
  { id: "dracula",         label: "Dracula",          color: "mauve",    theme: "dark",  cardBlur: "" },
  { id: "nord",            label: "Nord",             color: "dusk",     theme: "dark",  cardBlur: "" },
  { id: "tokyo-night",     label: "Tokyo Night",      color: "lavender", theme: "dark",  cardBlur: "sm" },
  { id: "midnight-blue",   label: "Midnight Blue",    color: "denim",    theme: "dark",  cardBlur: "sm" },
  { id: "ocean-depths",    label: "Ocean Depths",     color: "slate",    theme: "dark",  cardBlur: "sm" },
  { id: "gruvbox-dark",    label: "Gruvbox Dark",     color: "clay",     theme: "dark",  cardBlur: "" },
  { id: "rose-pine",       label: "Rosé Pine",        color: "blush",    theme: "dark",  cardBlur: "" },
  { id: "tech-angular",    label: "Tech / Angular",   color: "dust",     theme: "dark",  cardBlur: "" },
  { id: "cherry-dark",     label: "Cherry Dark",      color: "blush",    theme: "dark",  cardBlur: "" },
  { id: "forest-dark",     label: "Forest Dark",      color: "moss",     theme: "dark",  cardBlur: "" },
  { id: "matrix",          label: "Matrix",           color: "sage",     theme: "dark",  cardBlur: "" },
  { id: "homelab-pro",     label: "Homelab Pro",      color: "gray",     theme: "dark",  cardBlur: "" },
  // --- Light themes ---
  { id: "minimal-light",   label: "Minimal Light",    color: "stone",    theme: "light", cardBlur: "" },
  { id: "soft-blue",       label: "Soft Blue",        color: "denim",    theme: "light", cardBlur: "" },
  { id: "fresh-green",     label: "Fresh Green",      color: "sage",     theme: "light", cardBlur: "" },
  { id: "solarized-light", label: "Solarized Light",  color: "sand",     theme: "light", cardBlur: "" },
  { id: "rose-light",      label: "Rose Light",       color: "blush",    theme: "light", cardBlur: "sm" },
  { id: "lavender-dreams", label: "Lavender Dreams",  color: "lavender", theme: "light", cardBlur: "sm" },
  { id: "warm-amber",      label: "Warm Amber",       color: "clay",     theme: "light", cardBlur: "" },
  { id: "sage-garden",     label: "Sage Garden",      color: "sage",     theme: "light", cardBlur: "" },
  { id: "coral-reef",      label: "Coral Reef",       color: "dust",     theme: "light", cardBlur: "" },
  { id: "arctic-white",    label: "Arctic White",     color: "fog",      theme: "light", cardBlur: "" },
];

// Curated calm/muted palette offered in the color picker. Deliberately leaves
// out the loud, highly saturated tones to keep the choices restful (pastel /
// desaturated). The vivid colors stay defined in theme.css / themes.js, so
// existing configs and presets that use them still render — they are just no
// longer offered here.
export const ALL_COLORS = [
  "slate", "gray", "zinc", "neutral", "stone",
  "fog", "denim", "dusk", "fern", "moss",
  "sage", "sand", "clay", "dust", "mauve",
  "blush", "lavender",
];
