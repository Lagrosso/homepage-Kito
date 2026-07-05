// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ServiceBadges from "./service-badges";

describe("components/services/service-badges", () => {
  it("renders nothing for an empty or missing list", () => {
    const { container: a } = render(<ServiceBadges badges={undefined} />);
    expect(a).toBeEmptyDOMElement();
    const { container: b } = render(<ServiceBadges badges={[]} />);
    expect(b).toBeEmptyDOMElement();
    const { container: c } = render(<ServiceBadges badges={["   "]} />);
    expect(c).toBeEmptyDOMElement();
  });

  it("shows the registry label for a curated badge", () => {
    render(<ServiceBadges badges={["critical"]} />);
    // "critical" maps to the label "Kritisch" in the registry.
    expect(screen.getByText("Kritisch")).toBeInTheDocument();
  });

  it("shows the raw text for an unknown/custom badge", () => {
    render(<ServiceBadges badges={["mein-eigenes"]} />);
    expect(screen.getByText("mein-eigenes")).toBeInTheDocument();
  });

  it("renders multiple badges", () => {
    render(<ServiceBadges badges={["lan", "backup"]} />);
    expect(screen.getByText("LAN")).toBeInTheDocument();
    expect(screen.getByText("Backup")).toBeInTheDocument();
  });
});
