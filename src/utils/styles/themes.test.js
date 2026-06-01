import { describe, expect, it } from "vitest";

import { ALL_COLORS, THEME_PRESETS } from "utils/config/theme-presets";

import themes from "./themes";

describe("utils/styles/themes", () => {
  it("contains expected theme palettes", () => {
    expect(themes).toHaveProperty("slate");
    expect(themes.slate).toEqual(
      expect.objectContaining({
        light: expect.stringMatching(/^#[0-9a-f]{6}$/i),
        dark: expect.stringMatching(/^#[0-9a-f]{6}$/i),
        iconStart: expect.stringMatching(/^#[0-9a-f]{6}$/i),
        iconEnd: expect.stringMatching(/^#[0-9a-f]{6}$/i),
      }),
    );
  });

  // index.jsx looks up themes[settings.color][settings.theme] for the meta
  // theme-color tags; every color offered in the picker (ALL_COLORS) must
  // therefore exist here with light/dark values, or the dashboard crashes.
  it("has a palette for every color offered in the picker", () => {
    ALL_COLORS.forEach((color) => {
      expect(themes, `themes is missing color "${color}"`).toHaveProperty(color);
      expect(themes[color]).toEqual(
        expect.objectContaining({
          light: expect.stringMatching(/^#[0-9a-f]{6}$/i),
          dark: expect.stringMatching(/^#[0-9a-f]{6}$/i),
          iconStart: expect.stringMatching(/^#[0-9a-f]{6}$/i),
          iconEnd: expect.stringMatching(/^#[0-9a-f]{6}$/i),
        }),
      );
    });
  });

  it("only uses picker colors in theme presets", () => {
    THEME_PRESETS.forEach((preset) => {
      expect(ALL_COLORS, `${preset.id} uses unavailable color "${preset.color}"`).toContain(preset.color);
    });
  });
});
