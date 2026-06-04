// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import {
  clearEditorDraft,
  clearImportDraft,
  getEditorDraft,
  getEditorDrafts,
  getImportDraft,
  getImportDrafts,
  setEditorDraft,
  setEditorDrafts,
  setImportDrafts,
} from "./import-drafts";

const STORAGE_KEY = "homepage-import-drafts";

describe("utils/config/import-drafts", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("stores and reads a single draft, defaulting optional fields", () => {
    setEditorDraft("services.yaml", { content: "a: 1" });

    const draft = getEditorDraft("services.yaml");
    expect(draft).toMatchObject({
      content: "a: 1",
      sourceType: null,
      kind: "import",
      file: null,
      route: null,
      sourceBackupId: null,
      comment: "",
      actor: null,
    });
    expect(typeof draft.appliedAt).toBe("string");
  });

  it("returns null for a missing draft", () => {
    expect(getEditorDraft("widgets.yaml")).toBeNull();
  });

  it("ignores drafts without content", () => {
    setEditorDraft("services.yaml", { sourceType: "homepage" });
    expect(getEditorDraft("services.yaml")).toBeNull();
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("overwrites an existing draft for the same file", () => {
    setEditorDraft("services.yaml", { content: "a: 1" });
    setEditorDraft("services.yaml", { content: "a: 2", comment: "second" });

    const draft = getEditorDraft("services.yaml");
    expect(draft.content).toBe("a: 2");
    expect(draft.comment).toBe("second");
  });

  it("preserves restore metadata fields", () => {
    setEditorDraft("settings.yaml", {
      content: "title: Home",
      sourceType: "restore",
      kind: "restore",
      file: "settings.yaml",
      route: "/admin/settings",
      sourceBackupId: "backup-123",
      comment: "rollback",
      actor: "admin",
    });

    expect(getEditorDraft("settings.yaml")).toMatchObject({
      sourceType: "restore",
      kind: "restore",
      file: "settings.yaml",
      route: "/admin/settings",
      sourceBackupId: "backup-123",
      comment: "rollback",
      actor: "admin",
    });
  });

  it("clears only the targeted draft", () => {
    setEditorDraft("services.yaml", { content: "a: 1" });
    setEditorDraft("bookmarks.yaml", { content: "b: 2" });

    clearEditorDraft("services.yaml");

    expect(getEditorDraft("services.yaml")).toBeNull();
    expect(getEditorDraft("bookmarks.yaml")?.content).toBe("b: 2");
  });

  it("removes the storage key once the last draft is cleared", () => {
    setEditorDraft("services.yaml", { content: "a: 1" });
    clearEditorDraft("services.yaml");
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("clearEditorDraft is a no-op for an unknown file", () => {
    setEditorDraft("services.yaml", { content: "a: 1" });
    clearEditorDraft("does-not-exist.yaml");
    expect(getEditorDraft("services.yaml")?.content).toBe("a: 1");
  });

  it("setEditorDrafts replaces the whole store and drops invalid entries", () => {
    setEditorDraft("services.yaml", { content: "old" });

    setEditorDrafts({
      "bookmarks.yaml": { content: "b: 2" },
      "widgets.yaml": { sourceType: "homepage" }, // invalid: no content
    });

    expect(getEditorDraft("services.yaml")).toBeNull();
    expect(getEditorDraft("bookmarks.yaml")?.content).toBe("b: 2");
    expect(getEditorDraft("widgets.yaml")).toBeNull();
  });

  it("recovers from corrupted storage by treating it as empty", () => {
    window.sessionStorage.setItem(STORAGE_KEY, "{not valid json");
    expect(getEditorDrafts()).toEqual({});
  });

  it("exposes import* aliases that delegate to the editor draft store", () => {
    setImportDrafts({ "services.yaml": { content: "a: 1" } });

    expect(getImportDraft("services.yaml")?.content).toBe("a: 1");
    expect(getImportDrafts()).toEqual(getEditorDrafts());

    clearImportDraft("services.yaml");
    expect(getImportDraft("services.yaml")).toBeNull();
  });
});
