import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const { getSession, store } = vi.hoisted(() => ({
  getSession: vi.fn(),
  store: {
    getUserPreferences: vi.fn(),
    toggleFavorite: vi.fn(),
    recordOpen: vi.fn(),
    setEnabled: vi.fn(),
    isValidPreferenceKey: vi.fn(() => true),
  },
}));

vi.mock("utils/config/session", () => ({
  getSession,
  isAuthenticatedSession: (session) => Boolean(session?.user?.username),
}));
vi.mock("utils/config/user-preferences", () => store);

import handler from "pages/api/user/preferences";

describe("pages/api/user/preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.isValidPreferenceKey.mockReturnValue(true);
    getSession.mockResolvedValue({ user: { username: "alice", role: "viewer" } });
  });

  it("returns 401 when not authenticated", async () => {
    getSession.mockResolvedValueOnce({});
    const res = createMockRes();
    await handler({ method: "GET" }, res);
    expect(res.statusCode).toBe(401);
  });

  it("GET returns the session user's preferences", async () => {
    store.getUserPreferences.mockReturnValue({ favorites: ["a"], usage: {}, enabled: true });
    const res = createMockRes();
    await handler({ method: "GET" }, res);
    expect(store.getUserPreferences).toHaveBeenCalledWith("alice");
    expect(res.statusCode).toBe(200);
    expect(res.body.preferences.favorites).toEqual(["a"]);
  });

  it("PATCH toggleFavorite acts only on the session user", async () => {
    store.toggleFavorite.mockReturnValue({ favorites: ["Media::Jellyfin"], usage: {}, enabled: true });
    const res = createMockRes();
    await handler({ method: "PATCH", body: { toggleFavorite: "Media::Jellyfin" } }, res);
    expect(store.toggleFavorite).toHaveBeenCalledWith("alice", "Media::Jellyfin");
    expect(res.statusCode).toBe(200);
  });

  it("PATCH recordOpen records for the session user", async () => {
    store.recordOpen.mockReturnValue({ favorites: [], usage: { "Media::Jellyfin": { count: 1 } }, enabled: true });
    const res = createMockRes();
    await handler({ method: "PATCH", body: { recordOpen: "Media::Jellyfin" } }, res);
    expect(store.recordOpen).toHaveBeenCalledWith("alice", "Media::Jellyfin");
    expect(res.statusCode).toBe(200);
  });

  it("PATCH enabled toggles the flag", async () => {
    store.setEnabled.mockReturnValue({ favorites: [], usage: {}, enabled: false });
    const res = createMockRes();
    await handler({ method: "PATCH", body: { enabled: false } }, res);
    expect(store.setEnabled).toHaveBeenCalledWith("alice", false);
    expect(res.body.preferences.enabled).toBe(false);
  });

  it("PATCH rejects an invalid key", async () => {
    store.isValidPreferenceKey.mockReturnValue(false);
    const res = createMockRes();
    await handler({ method: "PATCH", body: { toggleFavorite: "" } }, res);
    expect(res.statusCode).toBe(400);
    expect(store.toggleFavorite).not.toHaveBeenCalled();
  });

  it("PATCH with no valid action returns 400", async () => {
    const res = createMockRes();
    await handler({ method: "PATCH", body: {} }, res);
    expect(res.statusCode).toBe(400);
  });

  it("rejects other methods with 405", async () => {
    const res = createMockRes();
    await handler({ method: "DELETE" }, res);
    expect(res.statusCode).toBe(405);
  });
});
