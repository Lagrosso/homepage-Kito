// @vitest-environment jsdom

import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

vi.mock("components/resolvedicon", () => ({
  default: function ResolvedIconMock() {
    return <div data-testid="resolved-icon" />;
  },
}));

vi.mock("widgets/docker/component", () => ({
  default: function DockerWidgetMock() {
    return <div data-testid="docker-widget" />;
  },
}));

vi.mock("widgets/kubernetes/component", () => ({
  default: function KubernetesWidgetMock() {
    return <div data-testid="kubernetes-widget" />;
  },
}));

vi.mock("widgets/proxmoxvm/component", () => ({
  default: function ProxmoxVMWidgetMock() {
    return <div data-testid="proxmoxvm-widget" />;
  },
}));

vi.mock("./ping", () => ({
  default: function PingMock() {
    return <div data-testid="ping" />;
  },
}));
vi.mock("./site-monitor", () => ({
  default: function SiteMonitorMock() {
    return <div data-testid="site-monitor" />;
  },
}));
vi.mock("./status", () => ({
  default: function StatusMock() {
    return <div data-testid="status" />;
  },
}));
vi.mock("./kubernetes-status", () => ({
  default: function KubernetesStatusMock() {
    return <div data-testid="kubernetes-status" />;
  },
}));
vi.mock("./proxmox-status", () => ({
  default: function ProxmoxStatusMock() {
    return <div data-testid="proxmox-status" />;
  },
}));
vi.mock("./service-docs-button", () => ({
  default: function ServiceDocsButtonMock({ docs, serviceName }) {
    return <div data-testid="service-docs-button">{serviceName}:{Object.keys(docs ?? {}).join(",")}</div>;
  },
}));
vi.mock("./service-badges", () => ({
  default: function ServiceBadgesMock({ badges }) {
    return <div data-testid="service-badges">{(badges ?? []).join(",")}</div>;
  },
}));
vi.mock("./widget", () => ({
  default: function ServiceWidgetMock({ widget }) {
    return <div data-testid="service-widget">idx:{widget.index}</div>;
  },
}));

const favoritesMock = vi.hoisted(() => ({
  isFavorite: vi.fn(() => false),
  toggleFavorite: vi.fn(),
}));
vi.mock("utils/services/use-favorites", () => ({ useFavorites: () => favoritesMock }));

import Item from "./item";

describe("components/services/item", () => {
  beforeEach(() => {
    favoritesMock.isFavorite.mockReturnValue(false);
    favoritesMock.toggleFavorite.mockClear();
  });

  it("renders the service title as a link when href is provided", () => {
    renderWithProviders(
      <Item
        groupName="G"
        useEqualHeights={false}
        service={{
          id: "svc1",
          name: "My Service",
          description: "Desc",
          href: "https://example.com",
          icon: "mdi:test",
          widgets: [],
        }}
      />,
      { settings: { target: "_self", showStats: false, statusStyle: "basic" } },
    );

    const links = screen.getAllByRole("link");
    expect(links.some((l) => l.getAttribute("href") === "https://example.com")).toBe(true);
    expect(screen.getByText("My Service")).toBeInTheDocument();
  });

  it("renders the icon without a link when href is missing or '#'", () => {
    renderWithProviders(
      <Item
        groupName="G"
        useEqualHeights={false}
        service={{
          id: "svc1",
          name: "My Service",
          description: "Desc",
          href: "#",
          icon: "mdi:test",
          widgets: [],
        }}
      />,
      { settings: { target: "_self", showStats: false, statusStyle: "basic" } },
    );

    // The title area should not create a clickable href="#" link.
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByTestId("resolved-icon")).toBeInTheDocument();
  });

  it("toggles container stats on click when stats are hidden by default", () => {
    renderWithProviders(
      <Item
        groupName="G"
        useEqualHeights={false}
        service={{
          id: "svc1",
          name: "My Service",
          description: "Desc",
          href: "https://example.com",
          container: "c",
          server: "s",
          ping: true,
          siteMonitor: true,
          widgets: [{ index: 1 }, { index: 2 }],
        }}
      />,
      { settings: { showStats: false, statusStyle: "basic" } },
    );

    expect(screen.queryByTestId("docker-widget")).not.toBeInTheDocument();
    expect(screen.getByTestId("ping")).toBeInTheDocument();
    expect(screen.getByTestId("site-monitor")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View container stats" }));
    expect(screen.getByTestId("docker-widget")).toBeInTheDocument();

    expect(screen.getAllByTestId("service-widget")).toHaveLength(2);
  });

  it("shows stats by default when settings.showStats is enabled, unless overridden by the service", () => {
    const baseService = {
      id: "svc1",
      name: "My Service",
      description: "Desc",
      container: "c",
      server: "s",
      widgets: [],
    };

    renderWithProviders(<Item groupName="G" useEqualHeights={false} service={baseService} />, {
      settings: { showStats: true, statusStyle: "basic" },
    });
    expect(screen.getByTestId("docker-widget")).toBeInTheDocument();

    renderWithProviders(
      <Item groupName="G" useEqualHeights={false} service={{ ...baseService, id: "svc2", showStats: false }} />,
      {
        settings: { showStats: true, statusStyle: "basic" },
      },
    );
    expect(screen.getAllByTestId("docker-widget")).toHaveLength(1);
  });

  it("closes stats after a short delay when toggled closed", async () => {
    vi.useFakeTimers();

    renderWithProviders(
      <Item
        groupName="G"
        useEqualHeights={false}
        service={{
          id: "svc1",
          name: "My Service",
          description: "Desc",
          container: "c",
          server: "s",
          widgets: [],
        }}
      />,
      { settings: { showStats: false, statusStyle: "basic" } },
    );

    const btn = screen.getByRole("button", { name: "View container stats" });
    fireEvent.click(btn);
    expect(screen.getByTestId("docker-widget")).toBeInTheDocument();

    fireEvent.click(btn);
    // Still rendered while the close animation runs.
    expect(screen.getByTestId("docker-widget")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByTestId("docker-widget")).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("toggles app and proxmox stats using their respective status tags", () => {
    renderWithProviders(
      <Item
        groupName="G"
        useEqualHeights={false}
        service={{
          id: "svc1",
          name: "My Service",
          description: "Desc",
          app: "app",
          namespace: "default",
          proxmoxNode: "pve",
          proxmoxVMID: "100",
          proxmoxType: "qemu",
          widgets: [],
        }}
      />,
      { settings: { showStats: false, statusStyle: "basic" } },
    );

    const appBtn = screen.getByTestId("kubernetes-status").closest("button");
    expect(appBtn).toBeTruthy();
    fireEvent.click(appBtn);
    expect(screen.getByTestId("kubernetes-widget")).toBeInTheDocument();

    const proxmoxBtn = screen.getByTestId("proxmox-status").closest("button");
    expect(proxmoxBtn).toBeTruthy();
    fireEvent.click(proxmoxBtn);
    expect(screen.getByTestId("proxmoxvm-widget")).toBeInTheDocument();
  });

  it("does not render the app status tag when the service is marked external", () => {
    renderWithProviders(
      <Item
        groupName="G"
        useEqualHeights={false}
        service={{
          id: "svc1",
          name: "My Service",
          description: "Desc",
          app: "app",
          external: true,
          widgets: [],
        }}
      />,
      { settings: { showStats: false, statusStyle: "basic" } },
    );

    expect(screen.queryByTestId("kubernetes-status")).not.toBeInTheDocument();
  });

  it("resolves the LAN url when accessed from a private network (jsdom localhost)", () => {
    renderWithProviders(
      <Item
        groupName="G"
        useEqualHeights={false}
        service={{
          id: "svc1",
          name: "My Service",
          href: "https://public.example.com",
          urls: { lan: "http://192.168.14.2:8080", public: "https://public.example.com" },
          icon: "mdi:test",
          widgets: [],
        }}
      />,
      { settings: { target: "_self", showStats: false, statusStyle: "basic" } },
    );

    const links = screen.getAllByRole("link");
    expect(links.some((l) => l.getAttribute("href") === "http://192.168.14.2:8080")).toBe(true);
    // LAN url is private → no public-link warning.
    expect(screen.queryByText("Public link (goes over the internet)")).not.toBeInTheDocument();
  });

  it("shows a public-link warning when the resolved url is public", () => {
    renderWithProviders(
      <Item
        groupName="G"
        useEqualHeights={false}
        service={{
          id: "svc1",
          name: "My Service",
          href: "https://public.example.com",
          icon: "mdi:test",
          widgets: [],
        }}
      />,
      { settings: { target: "_self", showStats: false, statusStyle: "basic" } },
    );

    expect(screen.getByText("Public link (goes over the internet)")).toBeInTheDocument();
  });

  it("does not warn for a private-only service", () => {
    renderWithProviders(
      <Item
        groupName="G"
        useEqualHeights={false}
        service={{
          id: "svc1",
          name: "My Service",
          href: "http://192.168.14.2:8080",
          icon: "mdi:test",
          widgets: [],
        }}
      />,
      { settings: { target: "_self", showStats: false, statusStyle: "basic" } },
    );

    expect(screen.queryByText("Public link (goes over the internet)")).not.toBeInTheDocument();
  });

  it("does not render the docs button when the service has no docs", () => {
    renderWithProviders(
      <Item
        groupName="G"
        useEqualHeights={false}
        service={{ id: "svc1", name: "My Service", href: "http://localhost/", widgets: [] }}
      />,
      { settings: { target: "_self", showStats: false, statusStyle: "basic" } },
    );

    expect(screen.queryByTestId("service-docs-button")).not.toBeInTheDocument();
  });

  it("renders the docs button with the service's docs when present", () => {
    renderWithProviders(
      <Item
        groupName="G"
        useEqualHeights={false}
        service={{
          id: "svc1",
          name: "My Service",
          href: "http://localhost/",
          widgets: [],
          docs: { purpose: "Media server" },
        }}
      />,
      { settings: { target: "_self", showStats: false, statusStyle: "basic" } },
    );

    expect(screen.getByTestId("service-docs-button")).toHaveTextContent("My Service:purpose");
  });

  it("does not render the badges row when the service has no badges", () => {
    renderWithProviders(
      <Item
        groupName="G"
        useEqualHeights={false}
        service={{ id: "svc1", name: "My Service", href: "http://localhost/", widgets: [] }}
      />,
      { settings: { target: "_self", showStats: false, statusStyle: "basic" } },
    );

    expect(screen.queryByTestId("service-badges")).not.toBeInTheDocument();
  });

  it("renders the badges row with the service's badges when present", () => {
    renderWithProviders(
      <Item
        groupName="G"
        useEqualHeights={false}
        service={{ id: "svc1", name: "My Service", href: "http://localhost/", widgets: [], badges: ["lan", "critical"] }}
      />,
      { settings: { target: "_self", showStats: false, statusStyle: "basic" } },
    );

    expect(screen.getByTestId("service-badges")).toHaveTextContent("lan,critical");
  });

  it("toggles a favorite with the group::name key when the pin star is clicked", () => {
    renderWithProviders(
      <Item
        groupName="Media"
        useEqualHeights={false}
        service={{ id: "svc1", name: "Jellyfin", href: "http://jf", icon: "mdi:test", widgets: [] }}
      />,
      { settings: { target: "_self", showStats: false, statusStyle: "basic" } },
    );

    fireEvent.click(screen.getByLabelText("Pin Jellyfin"));
    expect(favoritesMock.toggleFavorite).toHaveBeenCalledWith("Media::Jellyfin");
  });

  it("uses the original favoriteKey when shown in a quick-access section", () => {
    renderWithProviders(
      <Item
        groupName="Favorites"
        useEqualHeights={false}
        service={{ id: "svc1", name: "Jellyfin", favoriteKey: "Media::Jellyfin", href: "http://jf", widgets: [] }}
      />,
      { settings: { target: "_self", showStats: false, statusStyle: "basic" } },
    );

    fireEvent.click(screen.getByLabelText("Pin Jellyfin"));
    expect(favoritesMock.toggleFavorite).toHaveBeenCalledWith("Media::Jellyfin");
  });

  it("always shows the pin star", () => {
    renderWithProviders(
      <Item
        groupName="Media"
        useEqualHeights={false}
        service={{ id: "svc1", name: "Jellyfin", href: "http://jf", icon: "mdi:test", widgets: [] }}
      />,
      { settings: { target: "_self", showStats: false, statusStyle: "basic" } },
    );

    expect(screen.getByLabelText("Pin Jellyfin")).toBeInTheDocument();
  });
});
