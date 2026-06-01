import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const { servicesResponse, getSession, findUser } = vi.hoisted(() => ({
  findUser: vi.fn(),
  getSession: vi.fn(),
  servicesResponse: vi.fn(),
}));

vi.mock("utils/config/api-response", () => ({
  servicesResponse,
}));
vi.mock("utils/config/session", () => ({ getSession }));
vi.mock("utils/config/users", () => ({ findUser }));

import handler from "pages/api/services/index";

describe("pages/api/services/index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { username: "viewer", role: "viewer", groups: ["media"] } });
    findUser.mockReturnValue({ username: "viewer", role: "viewer", groups: ["media"] });
  });

  it("returns servicesResponse()", async () => {
    servicesResponse.mockResolvedValueOnce({ services: [] });

    const req = {};
    const res = createMockRes();

    await handler(req, res);

    expect(servicesResponse).toHaveBeenCalledWith({ username: "viewer", role: "viewer", groups: ["media"] });
    expect(res.body).toEqual({ services: [] });
  });
});
