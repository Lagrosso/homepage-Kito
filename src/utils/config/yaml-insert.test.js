import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

import { buildBookmarkEntry, buildServiceEntry, insertBookmark, insertService, quoteScalar } from "./yaml-insert";

describe("quoteScalar", () => {
  it("leaves simple values unquoted", () => {
    expect(quoteScalar("Sonarr")).toBe("Sonarr");
    expect(quoteScalar("My Service")).toBe("My Service");
  });

  it("quotes values with YAML-significant characters", () => {
    expect(quoteScalar("http://localhost:8080/")).toBe('"http://localhost:8080/"');
    expect(quoteScalar("a: b")).toBe('"a: b"');
  });

  it("escapes embedded quotes and backslashes", () => {
    expect(quoteScalar('say "hi"')).toBe('"say \\"hi\\""');
  });

  it("quotes empty strings", () => {
    expect(quoteScalar("")).toBe('""');
  });
});

describe("buildServiceEntry", () => {
  it("includes only provided fields", () => {
    const entry = buildServiceEntry({ name: "Sonarr", href: "http://localhost/" });
    expect(entry).toBe(['    - Sonarr:', '        href: "http://localhost/"'].join("\n"));
  });

  it("includes icon, server and container when present", () => {
    const entry = buildServiceEntry({
      name: "Radarr",
      href: "http://radarr/",
      icon: "radarr.png",
      server: "my-docker",
      container: "radarr",
    });
    expect(entry).toContain("icon: radarr.png");
    expect(entry).toContain("server: my-docker");
    expect(entry).toContain("container: radarr");
  });

  it("includes the description after href when present", () => {
    const entry = buildServiceEntry({
      name: "Sonarr",
      href: "http://sonarr/",
      description: "Series manager",
      icon: "sonarr.png",
    });
    expect(entry).toContain("description: Series manager");
    expect(entry.indexOf("href:")).toBeLessThan(entry.indexOf("description:"));
    expect(entry.indexOf("description:")).toBeLessThan(entry.indexOf("icon:"));
  });

  it("includes access groups when present", () => {
    const entry = buildServiceEntry({
      name: "Jellyfin",
      href: "http://jellyfin/",
      accessGroups: "family, media, family",
    });
    expect(entry).toContain("access:");
    expect(entry).toContain("groups: [family, media]");
  });
});

describe("insertService", () => {
  const base = ["---", "# top comment", "", "- Media:", "    - Plex:", "        href: http://plex/", ""].join("\n");

  it("inserts into an existing group and keeps comments", () => {
    const result = insertService(base, { group: "Media", name: "Sonarr", href: "http://sonarr/" });
    expect(result).toContain("# top comment");
    const parsed = yaml.load(result);
    const media = parsed.find((g) => g.Media);
    const names = media.Media.map((s) => Object.keys(s)[0]);
    expect(names).toEqual(["Plex", "Sonarr"]);
  });

  it("appends a new group block when the group does not exist", () => {
    const result = insertService(base, { group: "Tools", name: "Pihole", href: "http://pi/" });
    const parsed = yaml.load(result);
    expect(parsed.some((g) => g.Tools)).toBe(true);
    expect(parsed.some((g) => g.Media)).toBe(true);
  });

  it("preserves {{HOMEPAGE_VAR_*}} placeholders verbatim", () => {
    const withPlaceholder = ["- Media:", "    - Plex:", "        href: {{HOMEPAGE_VAR_PLEX_URL}}"].join("\n");
    const result = insertService(withPlaceholder, { group: "Media", name: "Sonarr", href: "http://sonarr/" });
    expect(result).toContain("{{HOMEPAGE_VAR_PLEX_URL}}");
  });

  it("produces valid YAML for tricky URLs", () => {
    const result = insertService(base, {
      group: "Media",
      name: "Jellyfin",
      href: "http://localhost:8096/web/#/home",
    });
    expect(() => yaml.load(result)).not.toThrow();
  });

  it("handles empty input by creating the first group", () => {
    const result = insertService("", { group: "New", name: "First", href: "http://x/" });
    const parsed = yaml.load(result);
    expect(parsed[0].New[0].First.href).toBe("http://x/");
  });
});

describe("buildBookmarkEntry", () => {
  it("nests properties in a single-item list with the first as the marker", () => {
    const entry = buildBookmarkEntry({ name: "Github", abbr: "GH", href: "https://github.com/" });
    expect(entry).toBe(
      ["    - Github:", "        - abbr: GH", '          href: "https://github.com/"'].join("\n"),
    );
  });

  it("falls back to href as the list marker when no abbr is given", () => {
    const entry = buildBookmarkEntry({ name: "Github", href: "https://github.com/", icon: "github.png" });
    expect(entry).toContain('        - href: "https://github.com/"');
    expect(entry).toContain("          icon: github.png");
  });

  it("includes access groups under bookmark props", () => {
    const entry = buildBookmarkEntry({ name: "School", href: "https://example.test", accessGroups: ["kids"] });
    expect(entry).toContain("          access:");
    expect(entry).toContain("            groups: [kids]");
  });
});

describe("insertBookmark", () => {
  const base = ["---", "# bm comment", "", "- Developer:", "    - Github:", "        - abbr: GH", "          href: https://github.com/", ""].join("\n");

  it("inserts a valid bookmark into an existing group and keeps comments", () => {
    const result = insertBookmark(base, {
      group: "Developer",
      name: "GitLab",
      abbr: "GL",
      href: "https://gitlab.com/",
    });
    expect(result).toContain("# bm comment");
    const parsed = yaml.load(result);
    const dev = parsed.find((g) => g.Developer);
    const names = dev.Developer.map((b) => Object.keys(b)[0]);
    expect(names).toEqual(["Github", "GitLab"]);
    const gitlab = dev.Developer.find((b) => b.GitLab);
    expect(gitlab.GitLab[0]).toEqual({ abbr: "GL", href: "https://gitlab.com/" });
  });

  it("appends a new group block when the group does not exist", () => {
    const result = insertBookmark(base, { group: "Social", name: "Reddit", abbr: "RE", href: "https://reddit.com/" });
    const parsed = yaml.load(result);
    expect(parsed.some((g) => g.Social)).toBe(true);
    expect(parsed.some((g) => g.Developer)).toBe(true);
  });
});
