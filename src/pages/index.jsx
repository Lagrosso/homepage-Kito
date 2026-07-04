/* eslint-disable react/no-array-index-key */
import classNames from "classnames";
import BookmarksGroup from "components/bookmarks/group";
import ErrorBoundary from "components/errorboundry";
import MobileBottomNav from "components/mobile-bottom-nav";
import QrButton from "components/qr-button";
import QuickLaunch from "components/quicklaunch";
import ServicesGroup from "components/services/group";
import Tab, { slugifyAndEncode } from "components/tab";
import Revalidate from "components/toggles/revalidate";
import Widget from "components/widgets/widget";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import dynamic from "next/dynamic";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import Script from "next/script";
import { useContext, useEffect, useMemo, useState } from "react";
import { BiError } from "react-icons/bi";
import { MdHome } from "react-icons/md";
import useSWR, { SWRConfig } from "swr";
import { ColorContext } from "utils/contexts/color";
import { SettingsContext } from "utils/contexts/settings";
import { TabContext } from "utils/contexts/tab";
import { ThemeContext } from "utils/contexts/theme";

import { widgetsResponse } from "utils/config/api-response";
import { getSettings } from "utils/config/config";
import useWindowFocus from "utils/hooks/window-focus";
import createLogger from "utils/logger";
import { buildGroupTargets } from "utils/quicklaunch/commands";
import { ALL_TAB_LABEL_KEY } from "utils/services/all-tab";
import { filterBookmarkGroupsForGroups, filterServiceGroupsForGroups, isTabVisibleForGroups } from "utils/services/preview-access";
import {
  buildFavoritesGroup,
  buildFrequentGroup,
  buildRecentGroup,
  filterServiceGroupForFavorites,
} from "utils/services/quick-access";
import { serviceKey } from "utils/services/service-key";
import { isTabVisibleForUser } from "utils/services/tab-access";
import { useFavorites } from "utils/services/use-favorites";
import { useServiceStatusReport } from "utils/services/use-service-status";
import themes from "utils/styles/themes";

const ThemeToggle = dynamic(() => import("components/toggles/theme"), {
  ssr: false,
});

const ColorToggle = dynamic(() => import("components/toggles/color"), {
  ssr: false,
});

const Version = dynamic(() => import("components/version"), {
  ssr: false,
});

const ConfigEditorLink = dynamic(() => import("components/admin/config-editor-link"), {
  ssr: false,
});

const AdminNavLink = dynamic(() => import("components/admin/admin-nav-link"), {
  ssr: false,
});

const PreviewProfileSwitcher = dynamic(() => import("components/admin/preview-profile-switcher"), {
  ssr: false,
});

const LogoutButton = dynamic(() => import("components/admin/logout-button"), {
  ssr: false,
});

const rightAlignedWidgets = ["weatherapi", "openweathermap", "weather", "openmeteo", "search", "datetime"];

// Normalize language codes so older config values like zh-CN still point to Crowdin-provided ones
const LANGUAGE_ALIASES = {
  "zh-cn": "zh-Hans",
};

const normalizeLanguage = (language) => {
  if (!language) return "en";
  const alias = LANGUAGE_ALIASES[language.toLowerCase()];
  return alias || language;
};

export async function getStaticProps() {
  let logger;
  try {
    logger = createLogger("index");
    const { providers, ...settings } = getSettings();

    const widgets = await widgetsResponse();
    const language = normalizeLanguage(settings.language);

    return {
      props: {
        initialSettings: settings,
        fallback: {
          "/api/services": [],
          "/api/bookmarks": [],
          "/api/widgets": widgets,
          "/api/hash": false,
        },
        ...(await serverSideTranslations(language)),
      },
    };
  } catch (e) {
    if (logger && e) {
      logger.error(e);
    }
    return {
      props: {
        initialSettings: {},
        fallback: {
          "/api/services": [],
          "/api/bookmarks": [],
          "/api/widgets": [],
          "/api/hash": false,
        },
        ...(await serverSideTranslations("en")),
      },
    };
  }
}

function Index({ initialSettings, fallback }) {
  const windowFocused = useWindowFocus();
  const [stale, setStale] = useState(false);
  const { data: errorsData } = useSWR("/api/validate");
  const { error: validateError } = errorsData || {};
  const { data: hashData, mutate: mutateHash } = useSWR("/api/hash");

  useEffect(() => {
    if (windowFocused) {
      mutateHash();
    }
  }, [windowFocused, mutateHash]);

  useEffect(() => {
    if (hashData) {
      if (typeof window !== "undefined") {
        const previousHash = localStorage.getItem("hash");

        if (!previousHash) {
          localStorage.setItem("hash", hashData.hash);
        }

        if (previousHash && previousHash !== hashData.hash) {
          setStale(true);
          localStorage.setItem("hash", hashData.hash);

          fetch("/api/revalidate").then((res) => {
            if (res.ok) {
              window.location.reload();
            }
          });
        }
      }
    }
  }, [hashData]);

  if (validateError) {
    return (
      <div className="w-full h-screen container m-auto justify-center p-10 pointer-events-none">
        <div className="flex flex-col">
          <div className="basis-1/2 bg-theme-500 dark:bg-theme-600 text-theme-600 dark:text-theme-300 m-2 rounded-md font-mono shadow-md border-4 border-transparent">
            <div className="bg-rose-200 text-rose-800 dark:text-rose-200 dark:bg-rose-800 p-2 rounded-md font-bold">
              <BiError className="float-right w-6 h-6" />
              Error
            </div>
            <div className="p-2 text-theme-100 dark:text-theme-200">
              <pre className="opacity-50 font-bold pb-2">{validateError}</pre>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (stale) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-24 h-24 border-2 border-theme-400 border-solid rounded-full animate-spin border-t-transparent" />
      </div>
    );
  }

  if (errorsData && errorsData.length > 0) {
    return (
      <div className="w-full h-screen container m-auto justify-center p-10 pointer-events-none">
        <div className="flex flex-col">
          {errorsData.map((error, i) => (
            <div
              className="basis-1/2 bg-theme-500 dark:bg-theme-600 text-theme-600 dark:text-theme-300 m-2 rounded-md font-mono shadow-md border-4 border-transparent"
              key={i}
            >
              <div className="bg-amber-200 text-amber-800 dark:text-amber-200 dark:bg-amber-800 p-2 rounded-md font-bold">
                <BiError className="float-right w-6 h-6" />
                {error.config}
              </div>
              <div className="p-2 text-theme-100 dark:text-theme-200">
                <pre className="opacity-50 font-bold pb-2">{error.reason}</pre>
                <pre className="text-sm">{error.mark.snippet}</pre>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <SWRConfig value={{ fallback, fetcher: (resource, init) => fetch(resource, init).then((res) => res.json()) }}>
      <ErrorBoundary>
        <Home initialSettings={initialSettings} />
      </ErrorBoundary>
    </SWRConfig>
  );
}

const headerStyles = {
  boxed:
    "m-5 mb-0 sm:m-9 sm:mb-0 rounded-md shadow-md shadow-theme-900/10 dark:shadow-theme-900/20 bg-theme-100/20 dark:bg-white/5 p-3",
  underlined: "m-5 mb-0 sm:m-9 sm:mb-1 border-b-2 pb-4 border-theme-800 dark:border-theme-200/50",
  clean: "m-5 mb-0 sm:m-9 sm:mb-0",
  boxedWidgets: "m-5 mb-0 sm:m-9 sm:mb-0 sm:mt-1",
};

function getAllServices(services) {
  function getServices(group) {
    let nestedServices = [...group.services];
    if (group.groups.length > 0) {
      nestedServices = [...nestedServices, ...group.groups.map(getServices).flat()];
    }
    return nestedServices;
  }

  return [...services.map(getServices).flat()];
}

const buildServiceStatusKey = serviceKey;

function filterServiceGroupForProblematic(group, problematicServiceIds) {
  const services = (group.services ?? []).filter((service) =>
    problematicServiceIds.has(buildServiceStatusKey(group.name, service.name)),
  );
  const groups = (group.groups ?? [])
    .map((subgroup) => filterServiceGroupForProblematic(subgroup, problematicServiceIds))
    .filter(Boolean);

  if (services.length === 0 && groups.length === 0) {
    return null;
  }

  return {
    ...group,
    services,
    groups,
  };
}

function Home({ initialSettings }) {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useContext(ThemeContext);
  const { color, setColor } = useContext(ColorContext);
  const { settings, setSettings } = useContext(SettingsContext);
  const { activeTab, setActiveTab } = useContext(TabContext);
  const { asPath } = useRouter();

  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings, setSettings]);

  const { data: services } = useSWR("/api/services");
  const { data: bookmarks } = useSWR("/api/bookmarks");
  const { data: widgets } = useSWR("/api/widgets");
  const { data: serviceStatusReport } = useServiceStatusReport();
  const [serviceFilter, setServiceFilter] = useState("all");
  const { enabled: quickAccessEnabled, favorites, usage, setEnabled: setQuickAccessEnabled } = useFavorites();
  // Admin-only "view as profile" preview (M10b): a client-side re-filter of the
  // already-loaded, unfiltered (for admins) services/bookmarks/tabs — never
  // persisted, resets on reload. See utils/services/preview-access.js.
  const [previewProfile, setPreviewProfile] = useState(null);

  const servicesAndBookmarks = [...bookmarks.map((bg) => bg.bookmarks).flat(), ...getAllServices(services)].filter(
    (i) => i?.href,
  );

  const groupTargets = useMemo(
    () => buildGroupTargets({ services, bookmarks, layout: settings.layout }),
    [services, bookmarks, settings.layout],
  );

  const problematicServiceIds = useMemo(
    () =>
      new Set(
        (serviceStatusReport?.services ?? [])
          .filter((serviceStatus) => serviceStatus.severity === "critical" || serviceStatus.severity === "warning")
          .map((serviceStatus) => serviceStatus.id),
      ),
    [serviceStatusReport],
  );

  const favoriteKeySet = useMemo(() => new Set(favorites), [favorites]);

  // Synthetic quick-access groups (★ favorites / recently / frequently used),
  // shown above the tabs when the feature is enabled and non-empty.
  const quickAccessGroups = useMemo(() => {
    if (!quickAccessEnabled || !services) {
      return [];
    }
    return [
      buildFavoritesGroup(services, favorites, t("quickAccess.favorites")),
      buildRecentGroup(services, usage, 6, t("quickAccess.recent")),
      buildFrequentGroup(services, usage, 6, t("quickAccess.frequent")),
    ].filter(Boolean);
  }, [quickAccessEnabled, services, favorites, usage, t]);

  useEffect(() => {
    const language = normalizeLanguage(settings.language);
    if (language) {
      i18n.changeLanguage(language);
    }

    if (settings.theme && theme !== settings.theme) {
      setTheme(settings.theme);
    }

    if (settings.color && color !== settings.color) {
      setColor(settings.color);
    }
  }, [i18n, settings, color, setColor, theme, setTheme]);

  const [searching, setSearching] = useState(false);
  const [searchString, setSearchString] = useState("");
  const headerStyle = settings?.headerStyle || "underlined";

  useEffect(() => {
    function handleKeyDown(e) {
      // Ctrl/Cmd+K opens the command palette regardless of focus.
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setSearching(true);
        return;
      }

      const inEditable = e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable;

      // "/" opens the palette in command mode when not typing in a field.
      if (e.key === "/" && !inEditable && !(e.altKey || e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setSearchString("/");
        setSearching(true);
        return;
      }

      if (e.target.tagName === "BODY" || e.target.id === "inner_wrapper") {
        if (
          (e.key.length === 1 &&
            e.key.match(/(\w|\s|[à-ü]|[À-Ü]|[\w\u0430-\u044f])/gi) &&
            !(e.altKey || e.ctrlKey || e.metaKey || e.shiftKey)) ||
          // accented characters and the bang may require modifier keys
          e.key.match(/([à-ü]|[À-Ü]|!)/g) ||
          (e.key === "v" && (e.ctrlKey || e.metaKey))
        ) {
          setSearching(true);
        } else if (e.key === "Escape") {
          setSearchString("");
          setSearching(false);
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return function cleanup() {
      document.removeEventListener("keydown", handleKeyDown);
    };
  });

  const { data: authState } = useSWR("/api/auth/me");

  const tabs = useMemo(() => {
    const allTabs = [
      ...new Set(
        Object.keys(settings.layout ?? {})
          .map((groupName) => settings.layout[groupName]?.tab?.toString())
          .filter((group) => group),
      ),
    ];
    // Tab buttons are filtered by the session user's groups (settings.tabs.*.access.groups);
    // a tab with no assignment stays visible to everyone. The groups/bookmarks *within*
    // a visible tab are still filtered separately, server-side, as before.
    const visibleTabs = allTabs.filter((tab) => isTabVisibleForUser(settings.tabs?.[tab]?.access?.groups, authState?.user));
    // Admin-only synthetic "all groups" tab (M10a) — not backed by settings.yaml,
    // appended last so real tabs keep their configured order. It's filtered by
    // role here in `tabs`, and by role again where it's consumed below (defense
    // in depth against hash-based access from a non-admin session).
    const withAllTab = authState?.user?.role === "admin" ? [...visibleTabs, t(ALL_TAB_LABEL_KEY)] : visibleTabs;
    // Active preview (M10b) applies an additional client-side filter, on top of
    // the real session filter above — it can only ever hide tabs, never reveal
    // ones the real session couldn't already see.
    if (!previewProfile) {
      return withAllTab;
    }
    return withAllTab.filter((tab) => isTabVisibleForGroups(settings.tabs?.[tab]?.access?.groups, previewProfile.groups));
  }, [settings.layout, settings.tabs, authState, previewProfile, t]);

  useEffect(() => {
    if (!activeTab) {
      const initialTab = asPath.substring(asPath.indexOf("#") + 1);
      setActiveTab(initialTab === "/" ? slugifyAndEncode(tabs["0"]) : initialTab);
    }
  });

  const servicesAndBookmarksGroups = useMemo(() => {
    // The admin-only "all groups" tab (M10a) bypasses the normal tab/group
    // assignment entirely — every group matches, regardless of `layout[g].tab`.
    // Re-checking the admin role here (not just relying on `tabs` already being
    // filtered) means a non-admin session can't get the same effect through
    // URL-hash manipulation; server-side /api/services|bookmarks stay filtered
    // for them either way, so this is defense in depth, not the real boundary.
    const isAllGroupsTab = authState?.user?.role === "admin" && activeTab === slugifyAndEncode(t(ALL_TAB_LABEL_KEY));
    // `g` is transiently undefined for a layout entry whose group hasn't loaded
    // via SWR yet (or no longer exists) — keep that guard first so isAllGroupsTab
    // only ever widens which *defined* groups match, never lets undefined through.
    const tabGroupFilter = (g) =>
      g && (isAllGroupsTab || [activeTab, ""].includes(slugifyAndEncode(settings.layout?.[g.name]?.tab)));
    const undefinedGroupFilter = (g) => settings.layout?.[g.name] === undefined;

    const layoutGroups = Object.keys(settings.layout ?? {})
      .map((groupName) => services?.find((g) => g.name === groupName) ?? bookmarks?.find((b) => b.name === groupName))
      .filter(tabGroupFilter);

    if (!settings.layout && JSON.stringify(settings.layout) !== JSON.stringify(initialSettings.layout)) {
      // wait for settings to populate (if different from initial settings), otherwise all the widgets will be requested initially even if we are on a single tab
      return <div />;
    }

    // Reduce a service group according to the active filter (all / problematic /
    // favorites). Returns the group unchanged for "all".
    const applyServiceFilter = (group) => {
      if (serviceFilter === "problematic") {
        return filterServiceGroupForProblematic(group, problematicServiceIds);
      }
      if (serviceFilter === "favorites") {
        return filterServiceGroupForFavorites(group, favoriteKeySet);
      }
      return group;
    };
    const filteringServices = serviceFilter === "problematic" || serviceFilter === "favorites";

    const serviceGroupsFiltered = services
      ?.filter(tabGroupFilter)
      .filter(undefinedGroupFilter)
      .map(applyServiceFilter)
      .filter(Boolean);
    const bookmarkGroupsFiltered = filteringServices ? [] : bookmarks.filter(tabGroupFilter).filter(undefinedGroupFilter);
    const filteredLayoutGroupsBase = filteringServices
      ? layoutGroups.map((group) => (group?.services ? applyServiceFilter(group) : null)).filter(Boolean)
      : layoutGroups;

    // Active preview (M10b) re-filters by the chosen profile's groups, on top of
    // everything above — it only ever narrows further, never reveals more than
    // the real session already received from the server.
    const serviceGroups = previewProfile
      ? filterServiceGroupsForGroups(serviceGroupsFiltered ?? [], previewProfile.groups)
      : serviceGroupsFiltered;
    const bookmarkGroups = previewProfile
      ? filterBookmarkGroupsForGroups(bookmarkGroupsFiltered, previewProfile.groups)
      : bookmarkGroupsFiltered;
    const filteredLayoutGroups = previewProfile
      ? filteredLayoutGroupsBase
          .map((group) =>
            group?.services
              ? filterServiceGroupsForGroups([group], previewProfile.groups)[0]
              : filterBookmarkGroupsForGroups([group], previewProfile.groups)[0],
          )
          .filter(Boolean)
      : filteredLayoutGroupsBase;

    return (
      <>
        {quickAccessEnabled && quickAccessGroups.length > 0 && (
          <div key="quick-access" id="quick-access" className="flex flex-wrap m-4 sm:m-8 sm:mb-0 items-start">
            {quickAccessGroups.map((group) => (
              <ServicesGroup
                key={group.name}
                group={group}
                maxGroupColumns={settings.fiveColumns ? 5 : settings.maxGroupColumns}
                disableCollapse={settings.disableCollapse}
                useEqualHeights={settings.useEqualHeights}
                groupsInitiallyCollapsed={settings.groupsInitiallyCollapsed}
              />
            ))}
          </div>
        )}
        {tabs.length > 0 && (
          <div key="tabs" id="tabs" className="m-5 sm:m-9 sm:mt-4 sm:mb-0">
            <ul
              className={classNames(
                "sm:flex gap-1 overflow-hidden rounded-md bg-theme-100/20 dark:bg-white/5 p-1",
                settings.cardBlur !== undefined &&
                  `backdrop-blur${settings.cardBlur.length ? "-" : ""}${settings.cardBlur}`,
              )}
              id="myTab"
              data-tabs-toggle="#myTabContent"
              role="tablist"
            >
              {tabs.map((tab) => (
                <Tab key={tab} tab={tab} />
              ))}
            </ul>
          </div>
        )}
        {(serviceStatusReport?.summary?.total > 0 || quickAccessEnabled) && (
          <div key="service-filter" className="mx-5 sm:mx-9 mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setServiceFilter("all")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                serviceFilter === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-theme-200/70 dark:bg-theme-700 text-theme-700 dark:text-theme-200 hover:bg-theme-300 dark:hover:bg-theme-600"
              }`}
            >
              {t("serviceStatus.allServices")}
            </button>
            {serviceStatusReport?.summary?.total > 0 && (
              <button
                type="button"
                onClick={() => setServiceFilter("problematic")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  serviceFilter === "problematic"
                    ? "bg-blue-600 text-white"
                    : "bg-theme-200/70 dark:bg-theme-700 text-theme-700 dark:text-theme-200 hover:bg-theme-300 dark:hover:bg-theme-600"
                }`}
              >
                {t("serviceStatus.problematicOnly")}
              </button>
            )}
            {quickAccessEnabled && favorites.length > 0 && (
              <button
                type="button"
                onClick={() => setServiceFilter("favorites")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  serviceFilter === "favorites"
                    ? "bg-blue-600 text-white"
                    : "bg-theme-200/70 dark:bg-theme-700 text-theme-700 dark:text-theme-200 hover:bg-theme-300 dark:hover:bg-theme-600"
                }`}
              >
                {t("quickAccess.favoritesOnly")}
              </button>
            )}
            {serviceStatusReport?.summary?.total > 0 && (
              <span className="text-xs text-theme-500 dark:text-theme-400">
                {t("serviceStatus.summary", {
                  problematic: serviceStatusReport.summary.problematic,
                  noCheck: serviceStatusReport.summary.noCheck,
                })}
              </span>
            )}
            <button
              type="button"
              onClick={() => setQuickAccessEnabled(!quickAccessEnabled)}
              className="ml-auto rounded-md px-3 py-1.5 text-xs font-medium text-theme-500 dark:text-theme-400 hover:bg-theme-200/70 dark:hover:bg-theme-700"
            >
              {quickAccessEnabled ? t("quickAccess.hide") : t("quickAccess.show")}
            </button>
          </div>
        )}
        {filteredLayoutGroups.length > 0 && (
          <div key="layoutGroups" id="layout-groups" className="flex flex-wrap m-4 sm:m-8 sm:mt-4 items-start mb-2">
            {filteredLayoutGroups.map((group) =>
              group.services ? (
                <ServicesGroup
                  key={group.name}
                  group={group}
                  layout={settings.layout?.[group.name]}
                  maxGroupColumns={settings.fiveColumns ? 5 : settings.maxGroupColumns}
                  disableCollapse={settings.disableCollapse}
                  useEqualHeights={settings.useEqualHeights}
                  groupsInitiallyCollapsed={settings.groupsInitiallyCollapsed}
                />
              ) : (
                <BookmarksGroup
                  key={group.name}
                  bookmarks={group}
                  layout={settings.layout?.[group.name]}
                  disableCollapse={settings.disableCollapse}
                  maxGroupColumns={settings.maxBookmarkGroupColumns ?? settings.maxGroupColumns}
                  groupsInitiallyCollapsed={settings.groupsInitiallyCollapsed}
                />
              ),
            )}
          </div>
        )}
        {serviceGroups?.length > 0 && (
          <div key="services" id="services" className="flex flex-wrap m-4 sm:m-8 sm:mt-4 items-start mb-2">
            {serviceGroups.map((group) => (
              <ServicesGroup
                key={group.name}
                group={group}
                layout={settings.layout?.[group.name]}
                maxGroupColumns={settings.fiveColumns ? 5 : settings.maxGroupColumns}
                disableCollapse={settings.disableCollapse}
                groupsInitiallyCollapsed={settings.groupsInitiallyCollapsed}
              />
            ))}
          </div>
        )}
        {bookmarkGroups?.length > 0 && (
          <div key="bookmarks" id="bookmarks" className="flex flex-wrap m-4 sm:m-8 sm:mt-4 items-start mb-2">
            {bookmarkGroups.map((group) => (
              <BookmarksGroup
                key={group.name}
                bookmarks={group}
                layout={settings.layout?.[group.name]}
                disableCollapse={settings.disableCollapse}
                maxGroupColumns={settings.maxBookmarkGroupColumns ?? settings.maxGroupColumns}
                groupsInitiallyCollapsed={settings.groupsInitiallyCollapsed}
                bookmarksStyle={settings.bookmarksStyle}
              />
            ))}
          </div>
        )}
      </>
    );
  }, [
    tabs,
    activeTab,
    authState,
    services,
    bookmarks,
    serviceStatusReport,
    serviceFilter,
    problematicServiceIds,
    favoriteKeySet,
    favorites,
    previewProfile,
    quickAccessEnabled,
    quickAccessGroups,
    setQuickAccessEnabled,
    t,
    settings.layout,
    settings.fiveColumns,
    settings.maxGroupColumns,
    settings.maxBookmarkGroupColumns,
    settings.disableCollapse,
    settings.useEqualHeights,
    settings.cardBlur,
    settings.groupsInitiallyCollapsed,
    settings.bookmarksStyle,
    initialSettings.layout,
  ]);

  return (
    <>
      <Head>
        <title>{initialSettings.title || "Homepage"}</title>
        <meta
          name="description"
          content={
            initialSettings.description ||
            "A highly customizable homepage (or startpage / application dashboard) with Docker and service API integrations."
          }
        />
        {settings.disableIndexing && <meta name="robots" content="noindex, nofollow" />}
        {settings.base && <base href={settings.base} />}
        {settings.favicon ? (
          <>
            <link rel="icon" href={settings.favicon} />
            <link rel="apple-touch-icon" sizes="180x180" href={settings.favicon} />
          </>
        ) : (
          <>
            <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=4" />
            <link rel="shortcut icon" href="/homepage.ico" />
            <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v=4" />
            <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?v=4" />
            <link rel="mask-icon" href="/safari-pinned-tab.svg?v=4" color="#1e9cd7" />
          </>
        )}
        <meta name="msapplication-TileColor" content={themes[settings.color || "slate"][settings.theme || "dark"]} />
        <meta name="theme-color" content={themes[settings.color || "slate"][settings.theme || "dark"]} />
        <meta name="color-scheme" content="dark light"></meta>
      </Head>

      <Script src="/api/config/custom.js" />

      <div
        className={classNames(
          settings.fullWidth ? "" : "container",
          "relative m-auto flex flex-col justify-start z-10 h-full min-h-screen",
        )}
      >
        <QuickLaunch
          servicesAndBookmarks={servicesAndBookmarks}
          searchString={searchString}
          setSearchString={setSearchString}
          isOpen={searching}
          setSearching={setSearching}
          groupTargets={groupTargets}
          setActiveTab={setActiveTab}
        />
        <div id="header-nav" className="flex flex-row justify-between items-center w-full mb-2 z-20">
          <Link
            href="/"
            aria-label="Home"
            title="Home"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-theme-700 dark:text-theme-200 hover:bg-theme-200/60 dark:hover:bg-theme-700/60 transition-colors"
          >
            <MdHome className="w-5 h-5" />
            <span className="hidden sm:inline">Home</span>
          </Link>
          <div className="flex items-center gap-1">
            <PreviewProfileSwitcher
              profiles={settings.profiles}
              previewProfile={previewProfile}
              setPreviewProfile={setPreviewProfile}
            />
            <QrButton />
            <AdminNavLink />
            <LogoutButton />
          </div>
        </div>
        {previewProfile && (
          <div
            id="preview-banner"
            className="w-full mb-2 rounded-md bg-amber-500/90 text-white text-sm text-center py-1.5 flex items-center justify-center gap-2 z-20"
          >
            <span>Vorschau: Ansicht als &quot;{previewProfile.name}&quot;</span>
            <button
              type="button"
              onClick={() => setPreviewProfile(null)}
              className="underline underline-offset-2 hover:no-underline font-medium"
            >
              Beenden
            </button>
          </div>
        )}
        <div
          id="information-widgets"
          className={classNames(
            "flex flex-row flex-wrap justify-between z-20",
            headerStyles[headerStyle],
            settings.cardBlur !== undefined &&
              headerStyle === "boxed" &&
              `backdrop-blur${settings.cardBlur.length ? "-" : ""}${settings.cardBlur}`,
          )}
        >
          <div id="widgets-wrap" className={classNames("flex flex-row w-full flex-wrap justify-between gap-x-2")}>
            {widgets && (
              <>
                {widgets
                  .filter((widget) => !rightAlignedWidgets.includes(widget.type))
                  .map((widget, i) => (
                    <Widget
                      key={i}
                      widget={widget}
                      style={{ header: headerStyle, isRightAligned: false, cardBlur: settings.cardBlur }}
                    />
                  ))}

                <div
                  id="information-widgets-right"
                  className={classNames(
                    "m-auto flex flex-wrap grow sm:basis-auto justify-between md:justify-end",
                    "m-auto flex flex-wrap grow sm:basis-auto justify-between md:justify-end gap-x-2",
                  )}
                >
                  {widgets
                    .filter((widget) => rightAlignedWidgets.includes(widget.type))
                    .map((widget, i) => (
                      <Widget
                        key={i}
                        widget={widget}
                        style={{ header: headerStyle, isRightAligned: true, cardBlur: settings.cardBlur }}
                      />
                    ))}
                </div>
              </>
            )}
          </div>
        </div>

        {servicesAndBookmarksGroups}

        <div id="footer" className="flex flex-col mt-auto p-8 w-full">
          <div id="style" className="flex w-full justify-end">
            {!settings?.color && <ColorToggle />}
            <Revalidate />
            {!settings.theme && <ThemeToggle />}
          </div>

          <div id="version" className="flex mt-4 w-full justify-end items-center gap-3">
            <ConfigEditorLink />
            {!settings.hideVersion && <Version disableUpdateCheck={settings.disableUpdateCheck} />}
          </div>
        </div>
        {/* Spacer so the fixed mobile bottom nav doesn't cover the last content. */}
        <div className="sm:hidden h-16" aria-hidden="true" />
      </div>
      <MobileBottomNav tabs={tabs} onSearch={() => setSearching(true)} />
    </>
  );
}

export default function Wrapper({ initialSettings, fallback }) {
  const { theme } = useContext(ThemeContext);
  const { color } = useContext(ColorContext);
  let backgroundImage = "";
  let opacity = initialSettings?.backgroundOpacity ?? 0;
  let backgroundBlur = false;
  let backgroundSaturate = false;
  let backgroundBrightness = false;
  if (initialSettings?.background) {
    const bg = initialSettings.background;
    if (typeof bg === "object") {
      backgroundImage = bg.image || "";
      if (bg.opacity !== undefined) {
        opacity = 1 - bg.opacity / 100;
      }
      backgroundBlur = bg.blur !== undefined;
      backgroundSaturate = bg.saturate !== undefined;
      backgroundBrightness = bg.brightness !== undefined;
    } else {
      backgroundImage = bg;
    }
  }

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    html.classList.remove("dark", "scheme-dark", "scheme-light");
    html.classList.toggle("dark", theme === "dark");
    html.classList.add(theme === "dark" ? "scheme-dark" : "scheme-light");

    const desiredThemeClass = `theme-${color || initialSettings.color || "slate"}`;
    const themeClassesToRemove = Array.from(html.classList).filter(
      (cls) => cls.startsWith("theme-") && cls !== desiredThemeClass,
    );
    if (themeClassesToRemove.length) {
      html.classList.remove(...themeClassesToRemove);
    }
    if (!html.classList.contains(desiredThemeClass)) {
      html.classList.add(desiredThemeClass);
    }

    // Remove any previously applied inline styles
    body.style.backgroundImage = "";
    body.style.backgroundColor = "";
    body.style.backgroundAttachment = "";
  }, [backgroundImage, opacity, theme, color, initialSettings.color]);

  return (
    <>
      {backgroundImage && (
        <div
          id="background"
          aria-hidden="true"
          style={{
            backgroundImage: `linear-gradient(rgb(var(--bg-color) / ${opacity}), rgb(var(--bg-color) / ${opacity})), url('${backgroundImage}')`,
          }}
        />
      )}
      <div id="page_wrapper" className="relative h-full">
        <div
          id="inner_wrapper"
          tabIndex="-1"
          className={classNames(
            "w-full h-full overflow-auto",
            backgroundBlur &&
              `backdrop-blur${initialSettings.background.blur?.length ? `-${initialSettings.background.blur}` : ""}`,
            backgroundSaturate && `backdrop-saturate-${initialSettings.background.saturate}`,
            backgroundBrightness && `backdrop-brightness-${initialSettings.background.brightness}`,
          )}
        >
          <Index initialSettings={initialSettings} fallback={fallback} />
        </div>
      </div>
    </>
  );
}
