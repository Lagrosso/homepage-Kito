import { Dialog } from "@headlessui/react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { MdClose, MdQrCode2 } from "react-icons/md";

// "Open on phone" QR button (M16). Shows a QR code of the current origin so the
// dashboard can be opened on a mobile device by scanning. Client-only (reads
// window.location), so the URL is resolved after mount.
export default function QrButton({ className = "" }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (open && typeof window !== "undefined") {
      setUrl(window.location.origin);
    }
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open on phone (QR code)"
        title="Open on phone"
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-theme-700 dark:text-theme-200 hover:bg-theme-200/60 dark:hover:bg-white/10 ${className}`}
      >
        <MdQrCode2 className="h-5 w-5" />
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-xs rounded-lg bg-theme-50 dark:bg-theme-800 p-6 text-center shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-sm font-semibold text-theme-800 dark:text-theme-100">
                Open on phone
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
            {url && (
              <div className="inline-block rounded-md bg-white p-3">
                <QRCodeSVG value={url} size={200} includeMargin={false} />
              </div>
            )}
            <p className="mt-4 break-all text-xs text-theme-500">{url}</p>
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  );
}
