const STORAGE_KEY = "homepage-import-drafts";

function normalizeDraft(draft) {
  if (!draft?.content) {
    return null;
  }

  return {
    content: draft.content,
    sourceType: draft.sourceType ?? null,
    appliedAt: draft.appliedAt ?? new Date().toISOString(),
    kind: draft.kind ?? "import",
    file: draft.file ?? null,
    route: draft.route ?? null,
    sourceBackupId: draft.sourceBackupId ?? null,
    comment: draft.comment ?? "",
    actor: draft.actor ?? null,
  };
}

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

export function getEditorDraft(filename) {
  const store = readStore();
  return store[filename] ?? null;
}

export function getEditorDrafts() {
  return readStore();
}

export function setEditorDrafts(drafts) {
  const next = {};
  Object.entries(drafts ?? {}).forEach(([filename, draft]) => {
    const normalized = normalizeDraft(draft);
    if (normalized) {
      next[filename] = normalized;
    }
  });
  writeStore(next);
}

export function setEditorDraft(filename, draft) {
  const normalized = normalizeDraft(draft);
  if (!normalized) {
    return;
  }
  const store = readStore();
  store[filename] = normalized;
  writeStore(store);
}

export function clearEditorDraft(filename) {
  const store = readStore();
  if (!store[filename]) {
    return;
  }
  delete store[filename];
  writeStore(store);
}

export function getImportDraft(filename) {
  return getEditorDraft(filename);
}

export function getImportDrafts() {
  return getEditorDrafts();
}

export function setImportDrafts(drafts) {
  setEditorDrafts(drafts);
}

export function clearImportDraft(filename) {
  clearEditorDraft(filename);
}
