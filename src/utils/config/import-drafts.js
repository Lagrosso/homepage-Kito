const STORAGE_KEY = "homepage-import-drafts";

function hasStorage() {
  return typeof window !== "undefined" && Boolean(window.sessionStorage);
}

function readStore() {
  if (!hasStorage()) {
    return {};
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(value) {
  if (!hasStorage()) {
    return;
  }
  if (!value || Object.keys(value).length === 0) {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function getImportDraft(filename) {
  const store = readStore();
  return store[filename] ?? null;
}

export function getImportDrafts() {
  return readStore();
}

export function setImportDrafts(drafts) {
  const next = {};
  Object.entries(drafts ?? {}).forEach(([filename, draft]) => {
    if (draft?.content) {
      next[filename] = {
        content: draft.content,
        sourceType: draft.sourceType ?? null,
        appliedAt: draft.appliedAt ?? new Date().toISOString(),
      };
    }
  });
  writeStore(next);
}

export function clearImportDraft(filename) {
  const store = readStore();
  if (!store[filename]) {
    return;
  }
  delete store[filename];
  writeStore(store);
}
