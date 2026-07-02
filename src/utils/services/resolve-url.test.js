import { describe, expect, it } from "vitest";

import { detectContext, isPublicUrl, resolveServiceUrl } from "./resolve-url";

describe("utils/services/resolve-url detectContext", () => {
  it("classifies localhost and .local as lan", () => {
    expect(detectContext("localhost")).toBe("lan");
    expect(detectContext("nas.local")).toBe("lan");
    expect(detectContext("127.0.0.1")).toBe("lan");
  });

  it("classifies private IPv4 ranges as lan", () => {
    expect(detectContext("192.168.14.2")).toBe("lan");
    expect(detectContext("10.1.2.3")).toBe("lan");
    expect(detectContext("172.16.0.5")).toBe("lan");
    expect(detectContext("172.31.255.255")).toBe("lan");
  });

  it("classifies Tailscale CGNAT and .ts.net as tailscale", () => {
    expect(detectContext("100.103.91.88")).toBe("tailscale");
    expect(detectContext("100.64.0.1")).toBe("tailscale");
    expect(detectContext("myhost.tailnet.ts.net")).toBe("tailscale");
  });

  it("classifies public IPs and domains as public", () => {
    expect(detectContext("service.kitohome.de")).toBe("public");
    expect(detectContext("8.8.8.8")).toBe("public");
    expect(detectContext("172.32.0.1")).toBe("public"); // just outside 172.16/12
  });

  it("falls back to lan for empty/bare hostnames", () => {
    expect(detectContext("")).toBe("lan");
    expect(detectContext(undefined)).toBe("lan");
    expect(detectContext("myserver")).toBe("lan");
  });
});

describe("utils/services/resolve-url resolveServiceUrl", () => {
  const service = {
    href: "http://192.168.14.2:8080",
    urls: {
      lan: "http://192.168.14.2:8080",
      tailscale: "http://100.103.91.88:8080",
      public: "https://svc.example.com",
    },
  };

  it("picks the URL for the active context", () => {
    expect(resolveServiceUrl(service, "tailscale")).toEqual({
      url: "http://100.103.91.88:8080",
      variant: "tailscale",
    });
    expect(resolveServiceUrl(service, "public")).toEqual({ url: "https://svc.example.com", variant: "public" });
  });

  it("falls back through lan → tailscale → public when the context URL is missing", () => {
    const publicOnly = { href: "x", urls: { public: "https://only.example.com" } };
    expect(resolveServiceUrl(publicOnly, "lan")).toEqual({ url: "https://only.example.com", variant: "public" });
  });

  it("uses href when no urls are defined", () => {
    expect(resolveServiceUrl({ href: "http://a.b" }, "public")).toEqual({ url: "http://a.b", variant: "href" });
  });

  it("ignores empty url strings", () => {
    const svc = { href: "http://fallback", urls: { lan: "   ", public: "https://p" } };
    expect(resolveServiceUrl(svc, "lan")).toEqual({ url: "https://p", variant: "public" });
  });
});

describe("utils/services/resolve-url isPublicUrl", () => {
  it("is true for public domains/IPs", () => {
    expect(isPublicUrl("https://svc.example.com")).toBe(true);
    expect(isPublicUrl("http://8.8.8.8")).toBe(true);
  });

  it("is false for lan/tailscale/local hosts", () => {
    expect(isPublicUrl("http://192.168.14.2:8080")).toBe(false);
    expect(isPublicUrl("http://100.103.91.88:8080")).toBe(false);
    expect(isPublicUrl("http://localhost:3000")).toBe(false);
  });

  it("is false for invalid input", () => {
    expect(isPublicUrl("")).toBe(false);
    expect(isPublicUrl("not a url")).toBe(false);
    expect(isPublicUrl(undefined)).toBe(false);
  });
});
