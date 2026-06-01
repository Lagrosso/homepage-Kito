// Maps the settings.cardRadius keyword to a concrete CSS length used for the
// --card-radius variable. Shared by the dashboard, the admin shell and the
// theme editor so the corner rounding stays consistent everywhere.
export const CARD_RADIUS_MAP = {
  none: "0px",
  sm: "0.125rem",
  md: "0.375rem",
  lg: "0.5rem",
  xl: "0.75rem",
  "2xl": "1rem",
  "3xl": "1.5rem",
  full: "9999px",
};

export const CARD_RADIUS_DEFAULT = "0.375rem";

// Returns the CSS length for a cardRadius keyword, or null when unset/unknown
// (callers then fall back to the CSS default of rounded-md).
export function cardRadiusValue(keyword) {
  return CARD_RADIUS_MAP[keyword] ?? null;
}
