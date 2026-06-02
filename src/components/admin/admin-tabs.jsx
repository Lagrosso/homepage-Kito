import { Menu, Transition } from "@headlessui/react";
import classNames from "classnames";
import Link from "next/link";
import { Fragment } from "react";
import { MdKeyboardArrowDown, MdMoreHoriz } from "react-icons/md";

const MOBILE_PRIMARY_HREFS = ["/admin/config", "/admin/bookmarks", "/admin/widgets", "/admin/settings"];

function linkClass(isActive, compact = false) {
  return classNames(
    compact
      ? "flex min-w-0 items-center justify-center rounded-md px-2 py-2 text-xs font-medium"
      : "px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
    isActive
      ? compact
        ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
        : "border-blue-500 text-blue-600 dark:text-blue-400"
      : compact
        ? "text-theme-500 dark:text-theme-400 hover:bg-theme-100 dark:hover:bg-theme-800 hover:text-theme-700 dark:hover:text-theme-200"
        : "border-transparent text-theme-500 dark:text-theme-400 hover:text-theme-700 dark:hover:text-theme-200",
  );
}

export default function AdminTabs({ tabs, activeHref }) {
  const primaryTabs = tabs.filter((tab) => MOBILE_PRIMARY_HREFS.includes(tab.href));
  const secondaryTabs = tabs.filter((tab) => !MOBILE_PRIMARY_HREFS.includes(tab.href));
  const activeSecondary = secondaryTabs.find((tab) => tab.href === activeHref);

  return (
    <nav className="border-b border-theme-200 dark:border-theme-700 bg-white dark:bg-theme-900 px-2">
      <div data-testid="admin-tabs-mobile" className="grid grid-cols-5 gap-1 py-1.5 md:hidden">
        {primaryTabs.map((tab) => {
          const isActive = tab.href === activeHref;
          return (
            <Link key={tab.href} href={tab.href} className={linkClass(isActive, true)} title={tab.label}>
              <span className="truncate">{tab.label}</span>
            </Link>
          );
        })}

        <Menu as="div" className="relative">
          {({ open }) => (
            <>
              <Menu.Button
                className={classNames(
                  "flex w-full items-center justify-center gap-1 rounded-md px-2 py-2 text-xs font-medium transition-colors",
                  activeSecondary
                    ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                    : "text-theme-500 dark:text-theme-400 hover:bg-theme-100 dark:hover:bg-theme-800 hover:text-theme-700 dark:hover:text-theme-200",
                )}
                aria-label="More admin tabs"
              >
                {activeSecondary ? (
                  <span className="truncate">{activeSecondary.label}</span>
                ) : (
                  <>
                    <MdMoreHoriz className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>More</span>
                  </>
                )}
                <MdKeyboardArrowDown
                  className={classNames("h-4 w-4 shrink-0 transition-transform", open ? "rotate-180" : "")}
                  aria-hidden="true"
                />
              </Menu.Button>

              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="absolute right-0 z-20 mt-2 w-44 origin-top-right rounded-md border border-theme-200 bg-white shadow-lg focus:outline-hidden dark:border-theme-700 dark:bg-theme-900">
                  <div className="py-1">
                    {secondaryTabs.map((tab) => {
                      const isActive = tab.href === activeHref;
                      return (
                        <Menu.Item key={tab.href} as={Fragment}>
                          <Link
                            href={tab.href}
                            className={classNames(
                              "block px-3 py-2 text-sm",
                              isActive
                                ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                                : "text-theme-600 dark:text-theme-300 hover:bg-theme-100 dark:hover:bg-theme-800 hover:text-theme-800 dark:hover:text-theme-100",
                            )}
                          >
                            {tab.label}
                          </Link>
                        </Menu.Item>
                      );
                    })}
                  </div>
                </Menu.Items>
              </Transition>
            </>
          )}
        </Menu>
      </div>

      <div data-testid="admin-tabs-desktop" className="hidden md:flex">
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} className={linkClass(tab.href === activeHref)}>
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
