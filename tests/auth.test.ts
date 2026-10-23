import { describe, it, expect, vi, afterEach } from "vitest";
import { checkLocal } from "../src/lib/auth";
const request = (host: string, origin?: string) =>
  new Request("http://localhost:3000/api/session", {
    method: "POST",
    headers: { host, ...(origin ? { origin } : {}) },
  });
describe("loopback origin validation", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("allows only the exact configured HTTPS station origin", () => {
    vi.stubEnv("BATCHVISTA_ORIGIN", "https://192.168.1.25:8443");
    expect(() =>
      checkLocal(request("192.168.1.25:8443", "https://192.168.1.25:8443")),
    ).not.toThrow();
    expect(() =>
      checkLocal(request("192.168.1.25:8443", "http://192.168.1.25:8443")),
    ).toThrow("Cross-origin");
    expect(() =>
      checkLocal(request("192.168.1.26:8443", "https://192.168.1.26:8443")),
    ).toThrow("Local workstation");
  });
  it("refuses an insecure configured phone origin", () => {
    vi.stubEnv("BATCHVISTA_ORIGIN", "http://192.168.1.25:8443");
    expect(() =>
      checkLocal(request("localhost:3000", "http://localhost:3000")),
    ).toThrow("exact HTTPS");
  });
  it("accepts the browser IP origin after NextURL canonicalization", () =>
    expect(() =>
      checkLocal(request("127.0.0.1:3000", "http://127.0.0.1:3000")),
    ).not.toThrow());
  it("accepts localhost", () =>
    expect(() =>
      checkLocal(request("localhost:3000", "http://localhost:3000")),
    ).not.toThrow());
  it("rejects a different port", () =>
    expect(() =>
      checkLocal(request("127.0.0.1:3000", "http://127.0.0.1:3001")),
    ).toThrow("Cross-origin"));
  it("rejects a malicious origin", () =>
    expect(() =>
      checkLocal(request("127.0.0.1:3000", "https://evil.example")),
    ).toThrow("Cross-origin"));
  it("rejects a non-local host", () =>
    expect(() =>
      checkLocal(request("example.com", "http://example.com")),
    ).toThrow("Local workstation"));
  it("rejects mutations without origin", () =>
    expect(() => checkLocal(request("localhost:3000"))).toThrow("same-origin"));
});
