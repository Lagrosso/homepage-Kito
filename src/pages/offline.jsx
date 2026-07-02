import Head from "next/head";
import { MdCloudOff, MdRefresh } from "react-icons/md";

// Offline fallback served by the service worker (M16) when a navigation fails
// with no network. Self-contained: no data fetching, no i18n dependency.
export default function OfflinePage() {
  return (
    <>
      <Head>
        <title>Offline</title>
      </Head>
      <main className="min-h-screen bg-theme-50 dark:bg-theme-900 text-theme-800 dark:text-theme-200 flex items-center justify-center p-6">
        <section className="w-full max-w-sm text-center">
          <MdCloudOff className="mx-auto mb-4 h-12 w-12 text-theme-400" />
          <h1 className="text-2xl font-bold mb-2">You&apos;re offline</h1>
          <p className="text-sm text-theme-500 mb-6">
            The dashboard can&apos;t be reached right now. Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <MdRefresh className="h-4 w-4" />
            Retry
          </button>
        </section>
      </main>
    </>
  );
}
