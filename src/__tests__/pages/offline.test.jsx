// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import OfflinePage from "pages/offline";

describe("pages/offline", () => {
  it("renders the offline fallback with a retry control", () => {
    render(<OfflinePage />);

    expect(screen.getByText("You're offline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
