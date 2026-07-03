// Stable identifier for a service across the dashboard: its group + name. Used by
// the problematic-status filter and by M12 favorites/usage. Kept in one place so
// the pin state, click tracking and filters all agree on the same key.
export function serviceKey(group, name) {
  return `${group}::${name}`;
}
