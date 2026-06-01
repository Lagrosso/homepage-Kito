import { useEffect, useState } from "react";

import { parseLayout } from "utils/config/layout-preview";

// True when settings.yaml has a `layout:` block that assigns at least one group.
// In that case the dashboard renders groups in `layout:` order (see index.jsx),
// so reordering groups in the services/bookmarks file has no visible effect —
// group order must be managed in /admin/layout instead. The services/bookmarks
// editors use this to hide their (misleading) group-reorder controls and point
// the user to the layout manager.
export function useLayoutGoverns() {
  const [governs, setGoverns] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/config/raw/settings.yaml")
      .then((r) => (r.ok ? r.json() : { content: "" }))
      .catch(() => ({ content: "" }))
      .then((d) => {
        if (cancelled) return;
        try {
          setGoverns(parseLayout(d?.content ?? "").length > 0);
        } catch {
          setGoverns(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return governs;
}
