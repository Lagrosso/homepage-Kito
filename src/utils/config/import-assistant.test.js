import { describe, expect, it } from "vitest";

import { applyImport, previewImport } from "./import-assistant";

const existingRawConfigs = {
  "services.yaml": "---\n- Existing:\n    - Sonarr:\n        href: http://sonarr.local\n",
  "bookmarks.yaml": "---\n- Links:\n    - GitHub:\n        - abbr: GH\n          href: https://github.com/\n",
  "widgets.yaml": "---\n- search:\n    provider: duckduckgo\n",
  "settings.yaml": "---\ntitle: Existing\n",
  "docker.yaml": "---\nlocal:\n  socket: /var/run/docker.sock\n",
};

describe("import-assistant", () => {
  it("builds a Homepage preview with conflict metadata", () => {
    const preview = previewImport({
      sourceType: "homepage",
      existingRawConfigs,
      inputs: {
        "services.yaml": "---\n- Existing:\n    - Sonarr:\n        href: http://sonarr.local\n- Media:\n    - Radarr:\n        href: http://radarr.local\n",
        "bookmarks.yaml": "",
        "widgets.yaml": "",
        "settings.yaml": "",
        "docker.yaml": "",
      },
    });

    expect(preview.files["services.yaml"].incoming).toBe(2);
    expect(preview.files["services.yaml"].conflicts).toBe(1);
    expect(preview.files["services.yaml"].items.find((item) => item.label === "Existing / Sonarr")?.conflict?.kind).toBe(
      "name",
    );
    expect(preview.files["services.yaml"].items.find((item) => item.label === "Media / Radarr")?.defaultAction).toBe(
      "add",
    );
  });

  it("applies Homepage imports into drafts and replaces secret widget values with placeholders when requested", () => {
    const result = applyImport({
      sourceType: "homepage",
      existingRawConfigs,
      includeSecrets: false,
      decisions: { "setting:title": "replace" },
      inputs: {
        "services.yaml": "---\n- Media:\n    - AdGuard:\n        href: http://adguard.local\n        widget:\n          type: adguard\n          username: admin\n          password: supersecret\n",
        "bookmarks.yaml": "",
        "widgets.yaml": "",
        "settings.yaml": "title: Imported\ncolor: blue\nlayout:\n  - Hidden:\n      tab: Skip\n",
        "docker.yaml": "remote:\n  host: 10.0.0.2\n  port: 2375\n",
      },
    });

    expect(result.drafts["services.yaml"].content).toContain("AdGuard");
    expect(result.drafts["services.yaml"].content).toContain("{{HOMEPAGE_VAR_MEDIA_ADGUARD_PASSWORD}}");
    expect(result.drafts["settings.yaml"].content).toContain("title: Imported");
    expect(result.unsupported).toContain('settings.yaml: key "layout" is not imported in v1.');
    expect(result.drafts["docker.yaml"].content).toContain("remote:");
  });

  it("maps Muximux apps into service drafts", () => {
    const result = applyImport({
      sourceType: "muximux",
      existingRawConfigs,
      includeSecrets: false,
      decisions: {},
      inputs: {
        muximux: "apps:\n  - name: Jellyfin\n    group: Media\n    url: http://jellyfin.local\n    icon: jellyfin.png\nauth:\n  enabled: true\n",
      },
    });

    expect(result.drafts["services.yaml"].content).toContain("Jellyfin");
    expect(result.unsupported).toContain('Muximux key "auth" is not fully imported in v2 and must be reviewed manually.');
  });

  it("maps Muximux v2 metadata to services, settings layout, docker, access, icons and siteMonitor", () => {
    const result = applyImport({
      sourceType: "muximux",
      existingRawConfigs,
      includeSecrets: false,
      decisions: {
        "muximux-setting:title": "replace",
        "muximux-setting:layout": "replace",
      },
      inputs: {
        muximux: `
server:
  title: KitoHome Dashboard
  language: de
theme:
  variant: dark
  family: tobi
discovery:
  docker:
    enabled: true
    endpoint: unix:///var/run/docker.sock
groups:
  - name: Media
    order: 1
    expanded: false
  - name: Infra
    order: 0
    expanded: true
apps:
  - name: Disabled
    group: Media
    url: http://disabled.local
    enabled: false
  - name: Proxmox
    group: Infra
    url: https://proxmox.local:8006
    icon:
      type: dashboard
      name: proxmox
      variant: svg
    open_mode: new_tab
    health_check: true
    min_role: admin
    enabled: true
  - name: Jellyfin
    group: Media
    url: http://jellyfin.local
    icon:
      type: dashboard
      name: jellyfin
    open_mode: iframe
    health_check: true
    enabled: true
`,
      },
    });

    expect(result.drafts["services.yaml"].content).toContain("icon: proxmox.svg");
    expect(result.drafts["services.yaml"].content).toContain("target: _blank");
    expect(result.drafts["services.yaml"].content).toContain("siteMonitor: https://proxmox.local:8006");
    expect(result.drafts["services.yaml"].content).toContain("groups:\n            - Admin");
    expect(result.drafts["services.yaml"].content).toContain("icon: jellyfin.svg");
    expect(result.drafts["services.yaml"].content).toContain("target: _self");
    expect(result.drafts["services.yaml"].content).not.toContain("Disabled");
    expect(result.drafts["settings.yaml"].content).toContain("title: KitoHome Dashboard");
    expect(result.drafts["settings.yaml"].content).toContain("layout:");
    expect(result.drafts["settings.yaml"].content).toContain("initiallyCollapsed: true");
    expect(result.drafts["docker.yaml"].content).toContain("muximux-docker:");
    expect(result.warnings).toContain('Muximux app "Disabled" is disabled and was skipped.');
    expect(result.unsupported).toContain('Muximux key "discovery" was partially imported for Docker; remaining discovery options need manual review.');
    expect(result.unsupported).toContain('Muximux theme family "tobi" has no direct Homepage equivalent.');
  });
});
