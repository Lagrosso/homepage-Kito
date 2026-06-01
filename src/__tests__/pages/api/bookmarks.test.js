import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const { bookmarksResponse, getSession, findUser } = vi.hoisted(() => ({
  bookmarksResponse: vi.fn(),
  findUser: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("utils/config/api-response", () => ({
  bookmarksResponse,
}));
vi.mock("utils/config/session", () => ({ getSession }));
vi.mock("utils/config/users", () => ({ findUser }));

import handler from "pages/api/bookmarks";

describe("pages/api/bookmarks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { username: "viewer", role: "viewer", groups: ["media"] } });
    findUser.mockReturnValue({ username: "viewer", role: "viewer", groups: ["media"] });
  });

  it("returns bookmarksResponse()", async () => {
    bookmarksResponse.mockResolvedValueOnce({ ok: true });

    const req = { query: {} };
    const res = createMockRes();

    await handler(req, res);

    expect(bookmarksResponse).toHaveBeenCalledWith({ username: "viewer", role: "viewer", groups: ["media"] });
    expect(res.body).toEqual({ ok: true });
  });
});
