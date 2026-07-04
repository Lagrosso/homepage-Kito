// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ServiceDocsButton from "./service-docs-button";

describe("components/services/service-docs-button", () => {
  it("renders nothing when docs is missing", () => {
    const { container } = render(<ServiceDocsButton docs={undefined} serviceName="Jellyfin" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when every docs field is empty", () => {
    const { container } = render(
      <ServiceDocsButton docs={{ purpose: "", note: "   " }} serviceName="Jellyfin" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the info button when at least one field is set", () => {
    render(<ServiceDocsButton docs={{ purpose: "Media server" }} serviceName="Jellyfin" />);
    expect(screen.getByLabelText("Show docs for Jellyfin")).toBeInTheDocument();
  });

  it("opens a dialog showing only the fields that are set", () => {
    render(
      <ServiceDocsButton
        docs={{ purpose: "Media server", admin: "", troubleshooting: "Restart the container" }}
        serviceName="Jellyfin"
      />,
    );

    expect(screen.queryByText("Jellyfin – Doku")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Show docs for Jellyfin"));

    expect(screen.getByText("Jellyfin – Doku")).toBeInTheDocument();
    expect(screen.getByText("Zweck")).toBeInTheDocument();
    expect(screen.getByText("Media server")).toBeInTheDocument();
    expect(screen.getByText("Was tun bei Fehler")).toBeInTheDocument();
    expect(screen.getByText("Restart the container")).toBeInTheDocument();
    expect(screen.queryByText("Admin-Kontakt")).not.toBeInTheDocument();
  });

  it("closes the dialog via the close button", () => {
    render(<ServiceDocsButton docs={{ purpose: "Media server" }} serviceName="Jellyfin" />);
    fireEvent.click(screen.getByLabelText("Show docs for Jellyfin"));
    expect(screen.getByText("Jellyfin – Doku")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Close"));
    expect(screen.queryByText("Jellyfin – Doku")).not.toBeInTheDocument();
  });
});
