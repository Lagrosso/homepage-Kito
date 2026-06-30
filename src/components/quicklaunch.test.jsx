// @vitest-environment jsdom

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { state, useSWR, getStoredProvider, routerPush } = vi.hoisted(() => ({
  state: {
    widgets: {},
    me: undefined,
  },
  useSWR: vi.fn((key) => {
    if (key === "/api/widgets") return { data: state.widgets, error: undefined };
    if (key === "/api/auth/me") return { data: state.me, error: undefined };
    return { data: undefined, error: undefined };
  }),
  getStoredProvider: vi.fn(() => null),
  routerPush: vi.fn(),
}));

vi.mock("swr", () => ({
  default: useSWR,
}));

vi.mock("next/router", () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock("./resolvedicon", () => ({
  default: function ResolvedIconMock() {
    return <div data-testid="resolved-icon" />;
  },
}));

vi.mock("./widgets/search/search", () => ({
  getStoredProvider,
  searchProviders: {
    duckduckgo: {
      name: "DuckDuckGo",
      url: "https://duckduckgo.example/?q=",
      suggestionUrl: "https://duckduckgo.example/ac/?q=",
      target: "_self",
    },
  },
}));

import QuickLaunch from "./quicklaunch";

function Wrapper({ servicesAndBookmarks = [], initialOpen = true, groupTargets = [], setActiveTab } = {}) {
  const [searchString, setSearchString] = useState("");
  const [isOpen, setSearching] = useState(initialOpen);

  return (
    <QuickLaunch
      servicesAndBookmarks={servicesAndBookmarks}
      searchString={searchString}
      setSearchString={setSearchString}
      isOpen={isOpen}
      setSearching={setSearching}
      groupTargets={groupTargets}
      setActiveTab={setActiveTab}
    />
  );
}

describe("components/quicklaunch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.widgets = {};
    state.me = undefined;
  });

  it("uses a custom provider from quicklaunch settings when configured", async () => {
    renderWithProviders(<Wrapper />, {
      settings: {
        quicklaunch: {
          provider: "custom",
          name: "MySearch",
          url: "https://custom.example/?q=",
          showSearchSuggestions: false,
        },
      },
    });

    const input = screen.getByPlaceholderText("Search");
    await waitFor(() => expect(input).toHaveFocus());

    fireEvent.change(input, { target: { value: "abc" } });

    expect(await screen.findByText("MySearch quicklaunch.search")).toBeInTheDocument();
  });

  it("uses the search widget's custom provider configuration when quicklaunch settings are not provided", async () => {
    state.widgets = {
      w: {
        type: "search",
        options: { provider: "custom", name: "WidgetSearch", url: "https://widget.example/?q=" },
      },
    };

    renderWithProviders(<Wrapper />, { settings: { quicklaunch: { showSearchSuggestions: false } } });

    const input = screen.getByPlaceholderText("Search");
    await waitFor(() => expect(input).toHaveFocus());

    fireEvent.change(input, { target: { value: "abc" } });

    expect(await screen.findByText("WidgetSearch quicklaunch.search")).toBeInTheDocument();
  });

  it("uses the search widget's provider setting when quicklaunch settings are not provided", async () => {
    state.widgets = {
      w: {
        type: "search",
        options: { provider: "duckduckgo" },
      },
    };

    renderWithProviders(<Wrapper />, { settings: { quicklaunch: { showSearchSuggestions: false } } });

    const input = screen.getByPlaceholderText("Search");
    await waitFor(() => expect(input).toHaveFocus());

    fireEvent.change(input, { target: { value: "abc" } });

    expect(await screen.findByText("DuckDuckGo quicklaunch.search")).toBeInTheDocument();
  });

  it("renders results for urls and opens the selected result on Enter", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    renderWithProviders(<Wrapper />, {
      settings: {
        target: "_self",
        quicklaunch: {
          provider: "duckduckgo",
          showSearchSuggestions: false,
        },
      },
    });

    const input = screen.getByPlaceholderText("Search");
    await waitFor(() => expect(input).toHaveFocus());

    fireEvent.change(input, { target: { value: "example.com" } });

    expect(await screen.findByText("quicklaunch.visit URL")).toBeInTheDocument();
    expect(screen.getByText("DuckDuckGo quicklaunch.search")).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "Enter" });

    await act(async () => {
      // Close/reset schedules timeouts (200ms + 300ms); flush them to avoid state updates after cleanup.
      await new Promise((r) => setTimeout(r, 350));
    });

    expect(openSpy).toHaveBeenCalledWith("https://example.com/", "_self", "noreferrer");

    openSpy.mockRestore();
  });

  it("closes on Escape and clears the search string after the timeout", async () => {
    renderWithProviders(<Wrapper />, {
      settings: {
        quicklaunch: {
          provider: "duckduckgo",
          showSearchSuggestions: false,
        },
      },
    });

    const input = screen.getByPlaceholderText("Search");
    await waitFor(() => expect(input).toHaveFocus());

    fireEvent.change(input, { target: { value: "abc" } });
    expect(input).toHaveValue("abc");

    fireEvent.keyDown(input, { key: "Escape" });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

    expect(input).toHaveValue("");
  });

  it("supports ArrowUp/ArrowDown navigation and opens a result on click", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    renderWithProviders(
      <Wrapper
        servicesAndBookmarks={[
          { name: "Alpha", href: "https://alpha.example", icon: "mdi:test" },
          { name: "Alpine", href: "https://alpine.example" },
        ]}
      />,
      { settings: { target: "_self", quicklaunch: { showSearchSuggestions: false } } },
    );

    const input = screen.getByPlaceholderText("Search");
    await waitFor(() => expect(input).toHaveFocus());

    fireEvent.change(input, { target: { value: "al" } });

    await waitFor(() => {
      expect(document.querySelector('button[data-index="0"]')).toBeTruthy();
      expect(document.querySelector('button[data-index="1"]')).toBeTruthy();
    });

    // Icon/abbr container renders when icon is present.
    expect(screen.getByTestId("resolved-icon")).toBeInTheDocument();

    const button0 = document.querySelector('button[data-index="0"]');
    const button1 = document.querySelector('button[data-index="1"]');
    expect(button0.className).toContain("bg-theme-300/50");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(button1.className).toContain("bg-theme-300/50");

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(button0.className).toContain("bg-theme-300/50");

    fireEvent.click(button0);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

    expect(openSpy).toHaveBeenCalledWith("https://alpha.example", "_self", "noreferrer");
    openSpy.mockRestore();
  });

  it("handles Escape on a result button (not just the input)", async () => {
    renderWithProviders(<Wrapper servicesAndBookmarks={[{ name: "Alpha", href: "https://alpha.example" }]} />, {
      settings: { quicklaunch: { showSearchSuggestions: false } },
    });

    const input = screen.getByPlaceholderText("Search");
    await waitFor(() => expect(input).toHaveFocus());

    fireEvent.change(input, { target: { value: "al" } });
    await waitFor(() => expect(document.querySelector('button[data-index="0"]')).toBeTruthy());
    const button0 = document.querySelector('button[data-index="0"]');

    button0.focus();
    fireEvent.keyDown(button0, { key: "Escape" });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

    expect(input).toHaveValue("");
  });

  it("highlights matching description text when searchDescriptions is enabled", async () => {
    renderWithProviders(
      <Wrapper
        servicesAndBookmarks={[
          { name: "Unrelated", description: "This has MatchMe inside", href: "https://example.com" },
        ]}
      />,
      {
        settings: {
          quicklaunch: {
            provider: "duckduckgo",
            searchDescriptions: true,
            showSearchSuggestions: false,
          },
        },
      },
    );

    const input = screen.getByPlaceholderText("Search");
    await waitFor(() => expect(input).toHaveFocus());

    fireEvent.change(input, { target: { value: "matchme" } });

    // A description-only match uses highlightText (bg-theme-300/10).
    const highlight = await screen.findByText(/matchme/i);
    expect(highlight.closest("span")?.className).toContain("bg-theme-300/10");
  });

  it("fetches search suggestions and ArrowRight autocompletes the selected suggestion", async () => {
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn(async () => ({
      json: async () => ["test", ["test 1", "test 2", "test 3", "test 4", "test 5"]],
    }));

    fetch = fetchSpy;

    renderWithProviders(<Wrapper />, {
      settings: {
        quicklaunch: {
          provider: "duckduckgo",
          showSearchSuggestions: true,
        },
      },
    });

    const input = screen.getByPlaceholderText("Search");
    await waitFor(() => expect(input).toHaveFocus());

    fireEvent.change(input, { target: { value: "test" } });

    // Suggestions are fetched via the API route.
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/api/search/searchSuggestion?query=test"),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    await waitFor(() => {
      expect(screen.getAllByText("quicklaunch.searchsuggestion").length).toBeGreaterThan(0);
    });

    const suggestionButton = Array.from(document.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("test 1"),
    );
    expect(suggestionButton).toBeTruthy();
    fireEvent.mouseEnter(suggestionButton);
    fireEvent.keyDown(input, { key: "ArrowRight" });

    expect(input).toHaveValue("test 1");

    fetch = originalFetch;
  });

  it("uses the stored provider when the search widget provides a provider list", async () => {
    state.widgets = {
      w: {
        type: "search",
        options: { provider: ["duckduckgo"] },
      },
    };
    getStoredProvider.mockReturnValue({
      name: "StoredProvider",
      url: "https://stored.example/?q=",
      suggestionUrl: "https://stored.example/ac/?q=",
    });

    renderWithProviders(<Wrapper />, { settings: { quicklaunch: { showSearchSuggestions: false } } });

    const input = screen.getByPlaceholderText("Search");
    await waitFor(() => expect(input).toHaveFocus());

    fireEvent.change(input, { target: { value: "abc" } });

    expect(await screen.findByText("StoredProvider quicklaunch.search")).toBeInTheDocument();
  });

  it("renders the mobile button when configured and opens the dialog when clicked", async () => {
    renderWithProviders(<Wrapper initialOpen={false} />, {
      settings: {
        quicklaunch: {
          mobileButtonPosition: "top-right",
          provider: "duckduckgo",
        },
      },
    });

    const mobileButton = screen.getByRole("button", { name: "" });
    expect(mobileButton.className).toContain("top-4 right-4");

    fireEvent.click(mobileButton);
    const input = await screen.findByPlaceholderText("Search");
    await waitFor(() => expect(input).toHaveFocus());
  });

  it("closes when the backdrop is clicked and clears the search string after the timeout", async () => {
    renderWithProviders(<Wrapper />, {
      settings: {
        quicklaunch: {
          provider: "duckduckgo",
          showSearchSuggestions: false,
        },
      },
    });

    const input = screen.getByPlaceholderText("Search");
    await waitFor(() => expect(input).toHaveFocus());

    fireEvent.change(input, { target: { value: "example.com" } });
    expect(input).toHaveValue("example.com");

    // The backdrop is a DIV; clicking it should close and schedule a reset.
    const backdrop = document.querySelector(".fixed.inset-0.bg-gray-500.opacity-50");
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

    expect(input).toHaveValue("");
  });

  it("matches with a non-contiguous fuzzy subsequence (beyond plain substring)", async () => {
    renderWithProviders(
      <Wrapper
        servicesAndBookmarks={[
          { name: "Portainer", href: "https://portainer.example" },
          { name: "Plex", href: "https://plex.example" },
        ]}
      />,
      { settings: { quicklaunch: { showSearchSuggestions: false } } },
    );

    const input = screen.getByPlaceholderText("Search");
    await waitFor(() => expect(input).toHaveFocus());

    // "ptr" is not a substring of either name, but is a subsequence of Portainer only.
    fireEvent.change(input, { target: { value: "ptr" } });

    expect(await screen.findByText("Portainer")).toBeInTheDocument();
    expect(screen.queryByText("Plex")).not.toBeInTheDocument();
  });

  it("shows only the Home command for non-admins in '/' command mode", async () => {
    renderWithProviders(<Wrapper />, { settings: { quicklaunch: { showSearchSuggestions: false } } });

    const input = screen.getByPlaceholderText("Search");
    await waitFor(() => expect(input).toHaveFocus());

    fireEvent.change(input, { target: { value: "/" } });

    await waitFor(() => {
      expect(document.querySelector('button[data-index="0"]')).toBeTruthy();
    });
    // Viewer sees exactly one command (Home) and no admin pages.
    expect(document.querySelectorAll("button[data-index]")).toHaveLength(1);
    expect(screen.getAllByText("quicklaunch.command").length).toBe(1);
  });

  it("exposes admin pages in '/' command mode and navigates via router.push", async () => {
    state.me = { user: { role: "admin" } };

    renderWithProviders(<Wrapper />, { settings: { quicklaunch: { showSearchSuggestions: false } } });

    const input = screen.getByPlaceholderText("Search");
    await waitFor(() => expect(input).toHaveFocus());

    fireEvent.change(input, { target: { value: "/" } });

    await waitFor(() => {
      expect(document.querySelectorAll("button[data-index]").length).toBeGreaterThan(1);
    });

    // First command is Home; selecting it navigates client-side instead of window.open.
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    fireEvent.click(document.querySelector('button[data-index="0"]'));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

    expect(routerPush).toHaveBeenCalledWith("/");
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it("jumps to a group target by switching the active tab", async () => {
    const setActiveTab = vi.fn();

    renderWithProviders(
      <Wrapper
        groupTargets={[{ id: "g1", name: "My Group", type: "group", slug: "my-group", tab: "home" }]}
        setActiveTab={setActiveTab}
      />,
      { settings: { quicklaunch: { showSearchSuggestions: false } } },
    );

    const input = screen.getByPlaceholderText("Search");
    await waitFor(() => expect(input).toHaveFocus());

    fireEvent.change(input, { target: { value: "my gr" } });

    const groupButton = await screen.findByText("My Group");
    fireEvent.click(groupButton.closest("button"));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(setActiveTab).toHaveBeenCalledWith("home");
  });
});
