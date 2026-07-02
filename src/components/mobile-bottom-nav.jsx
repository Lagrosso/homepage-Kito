import classNames from "classnames";
import { useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MdArrowUpward, MdSearch } from "react-icons/md";
import { TabContext } from "utils/contexts/tab";

import { slugifyAndEncode } from "./tab";

// Scroll the page to the top. The dashboard scrolls inside #inner_wrapper
// (overflow-auto), not the window, so target that container first.
function scrollToTop() {
  if (typeof document === "undefined") {
    return;
  }
  const scroller = document.getElementById("inner_wrapper");
  (scroller ?? window).scrollTo({ top: 0, behavior: "smooth" });
}

// Fixed bottom navigation for phones (M16). Hidden on >= sm. Gives quick access to
// search (opens QuickLaunch), horizontal tab switching, and scroll-to-top without
// reaching for the top of the page. Additive — desktop layout is unchanged.
// (Admin/Home stay reachable from the always-visible top header.)
//
// Rendered through a portal into <body>: the dashboard's #inner_wrapper uses
// backdrop-filter, which would otherwise make `position: fixed` resolve against
// that container instead of the viewport (the bar would scroll with the page).
export default function MobileBottomNav({ tabs = [], onSearch }) {
  const { activeTab, setActiveTab } = useContext(TabContext);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectTab = (tab) => {
    const slug = slugifyAndEncode(tab);
    setActiveTab(slug);
    if (typeof window !== "undefined") {
      window.location.hash = `#${slug}`;
    }
  };

  const nav = (
    <nav
      className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-theme-300/30 dark:border-white/10 bg-theme-50/95 dark:bg-theme-900/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Mobile navigation"
    >
      <div className="flex items-stretch gap-1 px-2 py-1.5">
        <button
          type="button"
          onClick={onSearch}
          aria-label="Search"
          className="shrink-0 flex flex-col items-center justify-center rounded-md px-3 py-1.5 text-theme-700 dark:text-theme-200 hover:bg-theme-200/60 dark:hover:bg-white/10"
        >
          <MdSearch className="h-6 w-6" />
        </button>

        {tabs.length > 0 && (
          <ul className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar" role="tablist">
            {tabs.map((tab) => {
              const matches = decodeURIComponent(activeTab ?? "") === decodeURIComponent(slugifyAndEncode(tab));
              return (
                <li key={tab} className="shrink-0">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={matches ? "true" : "false"}
                    onClick={() => selectTab(tab)}
                    className={classNames(
                      "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      matches
                        ? "bg-theme-300/40 dark:bg-white/15 text-theme-800 dark:text-white"
                        : "text-theme-600 dark:text-theme-300 hover:bg-theme-200/60 dark:hover:bg-white/10",
                    )}
                  >
                    {tab}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Scroll to top"
          className="shrink-0 flex flex-col items-center justify-center rounded-md px-3 py-1.5 text-theme-700 dark:text-theme-200 hover:bg-theme-200/60 dark:hover:bg-white/10"
        >
          <MdArrowUpward className="h-6 w-6" />
        </button>
      </div>
    </nav>
  );

  if (!mounted) {
    return null;
  }

  return createPortal(nav, document.body);
}
