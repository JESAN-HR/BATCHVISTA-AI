import { afterEach, describe, it, expect, vi } from "vitest";
import { GeminiProvider } from "../src/lib/vision";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("optional cloud adapter (mocked transport, no external images sent)", () => {
  it("is disabled without configuration", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(
      new GeminiProvider().analyze(Buffer.from("fictional")),
    ).rejects.toThrow("not configured");
  });
  it("does not call cloud without free-tier acknowledgment", async () => {
    vi.stubEnv("GEMINI_API_KEY", "fictional-test-key");
    vi.stubEnv("GEMINI_FREE_TIER_ACK", "false");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      new GeminiProvider().analyze(Buffer.from("fictional")),
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("reports provider failures", async () => {
    vi.stubEnv("GEMINI_API_KEY", "fictional-test-key");
    vi.stubEnv("GEMINI_FREE_TIER_ACK", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 429 })),
    );
    await expect(
      new GeminiProvider().analyze(Buffer.from("fictional")),
    ).rejects.toThrow("HTTP 429");
  });
  it("rejects malformed output", async () => {
    vi.stubEnv("GEMINI_API_KEY", "fictional-test-key");
    vi.stubEnv("GEMINI_FREE_TIER_ACK", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          candidates: [
            { content: { parts: [{ text: '{"observations":"invented"}' }] } },
          ],
        }),
      ),
    );
    await expect(
      new GeminiProvider().analyze(Buffer.from("fictional")),
    ).rejects.toThrow("invalid observation format");
  });
  it("accepts validated observations", async () => {
    vi.stubEnv("GEMINI_API_KEY", "fictional-test-key");
    vi.stubEnv("GEMINI_FREE_TIER_ACK", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      observations: [
                        {
                          category: "text",
                          description: "Visible batch text",
                          evidence: "BATCH: DEMO",
                        },
                      ],
                      uncertaintyNotes: ["Seal not visible"],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      ),
    );
    expect(
      (await new GeminiProvider().analyze(Buffer.from("fictional")))
        .observations,
    ).toHaveLength(1);
  });
});
