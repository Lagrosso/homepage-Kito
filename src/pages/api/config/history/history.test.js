import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const mocks = vi.hoisted(() => ({
  buildHistoryDiff: vi.fn(() => ({ currentContent: "current", entry: { file: "services.yaml", id: "one" }, patch: "@@" })),
  getHistoryDraftRoute: vi.fn(() => "/admin/config"),
  getHistoryDownloadName: vi.fn(() => "services.yaml.2026-06-03.bak"),
  getHistoryEntry: vi.fn((id) =>
    id === "missing"
      ? null
      : { action: "save", actor: { role: "admin", username: "admin" }, backupPath: "/tmp/backup", file: "services.yaml", id },
  ),
  getSession: vi.fn(),
  isAdminSession: vi.fn((session) => session?.user?.role === "admin"),
  isAuthenticatedSession: vi.fn((session) => Boolean(session?.user)),
  listHistoryEntries: vi.fn(() => [{ action: "save", backupPath: "/tmp/backup", file: "services.yaml", id: "one" }]),
  readHistoryContent: vi.fn(() => "- Backup: []\n"),
}));

vi.mock("utils/config/backup-history", () => ({
  buildHistoryDiff: mocks.buildHistoryDiff,
  getHistoryDraftRoute: mocks.getHistoryDraftRoute,
  getHistoryDownloadName: mocks.getHistoryDownloadName,
  getHistoryEntry: mocks.getHistoryEntry,
  listHistoryEntries: mocks.listHistoryEntries,
  readHistoryContent: mocks.readHistoryContent,
}));

vi.mock("utils/config/session", () => ({
  getSession: mocks.getSession,
  isAdminSession: mocks.isAdminSession,
  isAuthenticatedSession: mocks.isAuthenticatedSession,
}));

import detailHandler from "./[id]";
import diffHandler from "./[id]/diff";
import downloadHandler from "./[id]/download";
import restoreHandler from "./[id]/restore";
import listHandler from "./index";

function req(method, extra = {}) {
  return {
    body: extra.body,
    headers: {},
    method,
    query: extra.query ?? {},
  };
}

describe("/api/config/history/*", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 on list without a session", async () => {
    mocks.getSession.mockResolvedValue({});
    const res = createMockRes();

    await listHandler(req("GET"), res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("lists history entries for admins", async () => {
    mocks.getSession.mockResolvedValue({ user: { role: "admin", username: "admin" } });
    const res = createMockRes();

    await listHandler(req("GET", { query: { action: "save", file: "services.yaml" } }), res);

    expect(mocks.listHistoryEntries).toHaveBeenCalledWith({ action: "save", file: "services.yaml" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.entries[0].restorable).toBe(true);
  });

  it("returns detail content for admins", async () => {
    mocks.getSession.mockResolvedValue({ user: { role: "admin", username: "admin" } });
    const res = createMockRes();

    await detailHandler(req("GET", { query: { id: "one" } }), res);

    expect(mocks.readHistoryContent).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.content).toContain("Backup");
  });

  it("returns a diff patch for admins", async () => {
    mocks.getSession.mockResolvedValue({ user: { role: "admin", username: "admin" } });
    const res = createMockRes();

    await diffHandler(req("GET", { query: { id: "one" } }), res);

    expect(mocks.buildHistoryDiff).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.patch).toBe("@@");
  });

  it("downloads snapshot content for admins", async () => {
    mocks.getSession.mockResolvedValue({ user: { role: "admin", username: "admin" } });
    const res = createMockRes();

    await downloadHandler(req("GET", { query: { id: "one" } }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.headers["Content-Disposition"]).toContain("services.yaml.2026-06-03.bak");
    expect(res.body).toContain("Backup");
  });

  it("restores a snapshot as a client draft payload", async () => {
    mocks.getSession.mockResolvedValue({ user: { role: "admin", username: "admin" } });
    const res = createMockRes();

    await restoreHandler(req("POST", { query: { id: "one" } }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.draft).toMatchObject({
      content: "- Backup: []\n",
      filename: "services.yaml",
      kind: "restore",
      route: "/admin/config",
      sourceBackupId: "one",
    });
  });

  it("returns 404 for missing history entries", async () => {
    mocks.getSession.mockResolvedValue({ user: { role: "admin", username: "admin" } });
    const res = createMockRes();

    await restoreHandler(req("POST", { query: { id: "missing" } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
