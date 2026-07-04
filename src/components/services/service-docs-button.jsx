import { Dialog } from "@headlessui/react";
import { useState } from "react";
import { MdClose, MdInfoOutline } from "react-icons/md";

// Structured per-service documentation (M15): purpose/location/backup/admin/
// note/troubleshooting, shown in a modal so long troubleshooting text never
// pushes neighboring cards around (unlike an inline <details> expansion).
const DOC_FIELD_LABELS = [
  ["purpose", "Zweck"],
  ["location", "Standort"],
  ["backup", "Backup"],
  ["admin", "Admin-Kontakt"],
  ["note", "Notiz"],
  ["troubleshooting", "Was tun bei Fehler"],
];

export default function ServiceDocsButton({ docs, serviceName }) {
  const [open, setOpen] = useState(false);
  const entries = DOC_FIELD_LABELS.filter(([key]) => docs?.[key]?.trim());

  if (entries.length === 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Show docs for ${serviceName}`}
        title="Doku anzeigen"
        className="shrink-0 flex items-center justify-center service-tag service-docs text-theme-400/50 hover:text-theme-600 dark:hover:text-theme-200"
      >
        <MdInfoOutline className="w-3.5 h-3.5" />
        <span className="sr-only">Doku verfügbar</span>
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-md max-h-[85vh] overflow-auto rounded-lg bg-theme-50 dark:bg-theme-800 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-sm font-semibold text-theme-800 dark:text-theme-100">
                {serviceName} – Doku
              </Dialog.Title>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded p-1 text-theme-500 hover:bg-theme-200/60 dark:hover:bg-white/10"
              >
                <MdClose className="h-4 w-4" />
              </button>
            </div>
            <dl className="space-y-3 text-left">
              {entries.map(([key, label]) => (
                <div key={key}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-theme-500">{label}</dt>
                  <dd className="text-sm whitespace-pre-wrap text-theme-700 dark:text-theme-200">{docs[key]}</dd>
                </div>
              ))}
            </dl>
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  );
}
