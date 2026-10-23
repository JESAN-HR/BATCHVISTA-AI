# AI usage and zero-cost operation

## Three distinct processing layers

**Local learned OCR:** Tesseract.js 6 uses Tesseract's trained English LSTM recognition model and a local WASM engine. It performs actual inference on uploaded pixels. This is specialized text recognition, not general visual reasoning. Language data is bundled in the npm package, not fetched from a CDN at runtime. Word recognition scores come from Tesseract; they are never presented as confidence that a package is safe or compliant.

**Deterministic rules:** Explicit English field extraction, normalized equality, ISO date parsing and required-phrase checks. These are algorithms, not generative AI. Evidence thresholds are conservative heuristics, not calibrated defect probabilities. Missing evidence requires review. A readable wrong field produces a failure recommendation. An operator always sets final disposition.

**Optional generative inference:** The modular Gemini adapter sends the normalized image only after server configuration and per-image consent. Its output is Zod-validated `{ observations, uncertaintyNotes }`. The model name is stored. Outputs are displayed in their own section and do not determine machine recommendations. Errors preserve local results with an explanatory warning. Requests time out after 30 seconds; there are no automatic paid fallbacks.

## Privacy and budget controls

The default has no external API calls, mandatory account, billing activation or card entry. Free-tier availability varies by model, country and account and may change. The optional key must belong to a project without billing. `GEMINI_FREE_TIER_ACK` is an operator assertion, not a billing verification API. The application cannot prevent a user from supplying a paid-project key, so users must not do so. This limitation is visible in Settings and `.env.example`.

Use only fictional, non-sensitive images for cloud testing. A checkbox explicitly warns of third-party transmission and free-tier data use. Industrial photographs should use local OCR. Keys are read only on the server and never returned in API responses.

Google's [pricing page](https://ai.google.dev/gemini-api/docs/pricing) documents free and paid tiers. The [Gemini 2.5 Flash model page](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash) documents image input and structured outputs. These were consulted during implementation; verify availability before configuring a key. No Gemini credentials were provided, no live Gemini request was made, and no paid service was activated.

## Prompt injection and uncertainty

Image text is always untrusted data. The provider's system instruction prohibits following label instructions or claiming compliance. No provider tool calls or code execution are enabled. JSON shape and field lengths are validated; strings render as text. This reduces injection consequences but does not prove model correctness. Human review remains mandatory.

Local OCR cannot establish seal integrity, safety, hidden damage, geometry, authenticity or regulatory compliance. Reference images support opt-in translation-aligned grayscale comparison. Highlighted regions are measured pixel-difference blocks, not classified defects. Unreliable alignment produces uncertainty and no regions. No trained industrial defect detector is claimed.
