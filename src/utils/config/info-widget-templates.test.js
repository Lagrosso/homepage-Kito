import { describe, expect, it } from "vitest";

import {
  INFO_WIDGET_TEMPLATE_BY_TYPE,
  INFO_WIDGET_TEMPLATES,
  INFO_WIDGET_TYPES,
  parseInfoWidgetValue,
} from "./info-widget-templates";

describe("info widget templates", () => {
  it("contains the structured v1 info widgets", () => {
    expect(INFO_WIDGET_TYPES).toEqual(["datetime", "greeting", "logo", "openmeteo", "resources", "search"]);
  });

  it("has unique types and populated labels", () => {
    expect(new Set(INFO_WIDGET_TYPES).size).toBe(INFO_WIDGET_TEMPLATES.length);
    INFO_WIDGET_TEMPLATES.forEach((template) => {
      expect(template.label).toBeTruthy();
      expect(INFO_WIDGET_TEMPLATE_BY_TYPE[template.type]).toBe(template);
    });
  });

  it("parses typed widget option values", () => {
    expect(parseInfoWidgetValue({ key: "cpu", type: "boolean" }, true)).toBe(true);
    expect(parseInfoWidgetValue({ key: "refresh", type: "number" }, "3000")).toBe(3000);
    expect(parseInfoWidgetValue({ key: "disk", type: "listOrString" }, "/a, /b")).toEqual(["/a", "/b"]);
    expect(parseInfoWidgetValue({ key: "disk", type: "listOrString" }, "/a")).toBe("/a");
    expect(parseInfoWidgetValue({ key: "target", type: "enum", options: ["_blank", "_self"] }, "_blank")).toBe(
      "_blank",
    );
    expect(() => parseInfoWidgetValue({ key: "target", type: "enum", options: ["_blank"] }, "_self")).toThrow(/target/);
  });
});
