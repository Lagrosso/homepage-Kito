// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { router } = vi.hoisted(() => ({
  router: { asPath: "/admin/config", pathname: "/admin/config", replace: vi.fn() },
}));

vi.mock("next/head", () => ({ default: ({ children }) => children }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("next/router", () => ({ useRouter: () => router }));
vi.mock("components/admin/logout-button", () => ({ default: () => <button type="button">Logout</button> }));

import ConfigEditor from "./config-editor";

function fetchResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

describe("ConfigEditor import drafts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    window.sessionStorage.clear();
  });

  it("loads an imported draft instead of the server copy and can discard it", async () => {
    window.sessionStorage.setItem(
      "homepage-import-drafts",
      JSON.stringify({
        "services.yaml": {
          content: "- Imported:\n    - Test:\n        href: http://draft.local\n",
          sourceType: "homepage",
        },
      }),
    );

    global.fetch
      .mockResolvedValueOnce(fetchResponse({ authenticated: true, user: { role: "admin", username: "admin" } }))
      .mockResolvedValueOnce(fetchResponse({ content: "- Existing: []\n", file: "services.yaml" }));

    render(<ConfigEditor configFile="services.yaml" title="Services" parse={() => []} Card={() => <div />} />);

    await screen.findByRole("button", { name: "Discard draft" });
    expect(screen.getByLabelText("YAML")).toHaveValue("- Imported:\n    - Test:\n        href: http://draft.local\n");

    fireEvent.click(screen.getByRole("button", { name: "Discard draft" }));

    await waitFor(() => expect(screen.getByLabelText("YAML")).toHaveValue("- Existing: []\n"));
  });
});
