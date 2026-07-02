// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import QrButton from "./qr-button";

describe("components/qr-button", () => {
  it("opens a dialog with a QR code for the current origin", () => {
    render(<QrButton />);

    // Dialog is closed initially.
    expect(screen.queryByText("Open on phone")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Open on phone (QR code)"));

    expect(screen.getByText("Open on phone")).toBeInTheDocument();
    // qrcode.react renders an <svg>; the origin URL is shown as text.
    expect(document.querySelector("svg")).toBeTruthy();
    expect(screen.getByText(window.location.origin)).toBeInTheDocument();
  });

  it("closes the dialog via the close button", () => {
    render(<QrButton />);
    fireEvent.click(screen.getByLabelText("Open on phone (QR code)"));
    expect(screen.getByText("Open on phone")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Close"));
    expect(screen.queryByText("Open on phone")).not.toBeInTheDocument();
  });
});
