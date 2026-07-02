// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TabContext } from "utils/contexts/tab";

import MobileBottomNav from "./mobile-bottom-nav";

function renderNav({ tabs = ["Home", "Media"], activeTab = "home", onSearch = vi.fn(), setActiveTab = vi.fn() } = {}) {
  render(
    <TabContext.Provider value={{ activeTab, setActiveTab }}>
      <MobileBottomNav tabs={tabs} onSearch={onSearch} />
    </TabContext.Provider>,
  );
  return { onSearch, setActiveTab };
}

describe("components/mobile-bottom-nav", () => {
  it("renders a tab chip per tab and marks the active one", () => {
    renderNav({ tabs: ["Home", "Media"], activeTab: "media" });

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    const media = tabs.find((t) => t.textContent === "Media");
    expect(media.getAttribute("aria-selected")).toBe("true");
  });

  it("calls onSearch when the search button is pressed", () => {
    const { onSearch } = renderNav();
    fireEvent.click(screen.getByLabelText("Search"));
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it("switches the active tab and updates the hash on chip click", () => {
    const { setActiveTab } = renderNav({ tabs: ["Home", "Media"], activeTab: "home" });
    fireEvent.click(screen.getByRole("tab", { name: "Media" }));
    expect(setActiveTab).toHaveBeenCalledWith("media");
    expect(window.location.hash).toBe("#media");
  });

  it("provides a scroll-to-top control", () => {
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo;
    renderNav();
    fireEvent.click(screen.getByLabelText("Scroll to top"));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("renders no tab list when there are no tabs", () => {
    renderNav({ tabs: [] });
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    // Search + scroll-to-top still present.
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
  });
});
