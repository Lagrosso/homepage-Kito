import { BADGE_BY_ID, NEUTRAL_BADGE_CLASS } from "utils/config/badge-registry";

// Context badges for a service (M13): a wrap of small colored pills below the
// service name/description. Curated ids (see badge-registry) get a fixed label +
// color; unknown/custom ids render neutral with the raw text as label. Purely
// informational — no interaction.
export default function ServiceBadges({ badges }) {
  const list = (Array.isArray(badges) ? badges : []).map((b) => String(b).trim()).filter(Boolean);
  if (list.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1 px-2 pb-1 -mt-1 z-10 service-badges">
      {list.map((id) => {
        const badge = BADGE_BY_ID[id];
        return (
          <span
            key={id}
            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${badge ? badge.className : NEUTRAL_BADGE_CLASS}`}
          >
            {badge ? badge.label : id}
          </span>
        );
      })}
    </div>
  );
}
