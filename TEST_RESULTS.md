# Verification results

## Camera-first update — 23 October 2026

Executed on Windows with local processing only; no external AI calls or paid services.

| Command | Actual outcome |
| --- | --- |
| `npm test` | **43 passed across 6 files**, including actual OCR and pixel comparison, batch validation, account/password handling, login throttling and exact HTTPS-origin validation. Approved execution outside the sandbox was required for esbuild configuration access. |
| `npm run lint` | Passed. |
| `npm run typecheck` | Passed. |
| `npm run build` | Passed, including TypeScript and optimized production generation. |
| `npm run test:station` | **1 passed**, 13.7 seconds including setup, against the production build on port 3102 with a fresh isolated SQLite database. |
| `npm run test:e2e` | **3 passed**, 20.0 seconds, including photo-to-OCR-to-human-review-to-report, persistence/access controls and product editing. The approved rerun completed with exit code 0. |

The station test exercised administrator setup, production-batch creation, virtual-camera capture and track shutdown, actual missing-print fixture analysis, measured difference regions, a named HOLD review, repeat-inspection batch selection, inspector authorization failures, closed-batch upload rejection and no document overflow at 390×844. `test-results-station/mobile-evidence.png` was visually inspected. This is not physical-camera, Android/iOS or LAN TLS verification.

The earlier station selector expected “New inspection” while the sidebar's accessible name included “+”; the test locator was corrected. Sandboxed browser runs completed their assertions but hung during Windows server teardown and were interrupted. Both browser suites rerun outside the sandbox completed with exit code 0. These interrupted runs are not represented as clean passes.

## Original baseline — 22 October 2026

Executed locally on **22 October 2026**. Node.js 24.22, Next.js 16.4.2, Windows, Microsoft Edge via Playwright. No external AI service was called and no paid tier was activated.

| Command | Actual outcome |
| --- | --- |
| `npm install --no-audit --no-fund` | Dependencies installed; initial sandbox registry denial required approved execution outside the sandbox. |
| `npm run fixtures` | Four synthetic PNG labels generated. Fontconfig warned that user cache directories were unwritable; generated images were successfully decoded and OCR-tested. |
| `npm run lint` | Passed, no reported errors or warnings in the final run. |
| `npm run typecheck` | Passed. |
| `npm test` | **29 tests passed across 4 files.** Test runner required approved execution outside the sandbox after esbuild was denied access during config resolution. |
| `npm run test:e2e` | **3 browser/API integration tests passed**, 16.3 seconds in the final development-server run. |
| `npm run build` | Passed: optimized bundle compiled, TypeScript completed, pages generated. Final build had no reported warning. |
| `npm start -- --port 3100`, then `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 npm run test:e2e` | **The same 3 browser/API tests passed against the production build**, 11.5 seconds. In PowerShell the environment variable was set with `$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3100'`. |

## Real OCR results

These results were calculated by Tesseract from actual PNG pixels and then passed through the same verification function used by the application.

| Synthetic fixture | Actual recommendation | Actual extracted words |
| --- | --- | --- |
| `correct.png` | PASS | 39 |
| `wrong-batch.png` | FAIL | 39 |
| `wrong-expiry.png` | FAIL | 39 |
| `ambiguous.png` | REVIEW | 0 |

The readable fixtures had Tesseract recognition score 93; this is a text-recognition signal, **not** a probability of correctness or industrial safety. The low-resolution fixture returned no invented words or boxes. These synthetic tests are not an accuracy benchmark for real manufacturing photographs.

## Test coverage actually exercised

- Exact field matches, wrong batch and date, missing mandatory text, low recognition scores, no text, no coordinates, ambiguous dates, duplicate fields, substring false matches, unsupported physical checks, human corrections, invalid dates and decision validation.
- Optional cloud disabled without configuration or free-tier acknowledgment; HTTP 429, malformed structured output and validated output. Transport is mocked and no images leave the machine.
- Same-origin loopback checks, including NextURL's IP-to-localhost canonicalization; wrong ports, non-local hosts, foreign origins and missing Origin rejected.
- Browser upload of a synthetic wrong batch; real OCR; real word boxes; human rejection; saved audit entry; report; PDF output with a verified PDF signature; history after reload.
- Unauthenticated workspace access denied; guest organization cannot read operator inspections or images or approve decisions; invalid image decoding rejected; unconsented cloud submission rejected.
- Correct-label inspection persisted through the API; inspection deletion also makes its image unavailable.
- Product registration/editing, reference-image upload and product deletion through the UI.
- Mobile layout at 390×844 without document horizontal overflow. Desktop/mobile screenshots and the report screen were visually inspected.

## Defects found and fixed during verification

Initial checks found an incorrect partial-record schema, React effect lint errors, localhost origin normalization incompatibility, mobile screen-reader text overflow and a reference-upload route shadowed by product creation. Tests also exposed a duplicate-name locator race; it now waits for its uniquely identified product. Final successful runs above occurred after those fixes. Earlier failed runs are not counted as passes.

## Artifacts

Generated test evidence (ignored by Git) lives in `test-results/dashboard-desktop.png`, `dashboard-mobile.png`, `inspection-report.png`, and `inspection-report.pdf`. Playwright's HTML report is in `playwright-report/index.html`. Tests create real fictional records in the local workspace; failed earlier runs may leave fictional test products. Use the documented reset process for a clean demonstration.

Durable screenshot copies are included under `docs/screenshots/` and linked from README.md.

## Verification limits

No live Gemini key, Supabase deployment, public hosting, field-image benchmark, load test, physical camera test or cross-browser matrix was available or claimed. Named authentication is now tested locally; actual private-LAN HTTPS remains unverified. PDF generation succeeded; print pagination may vary by browser. Live camera and file/capture inputs are available. No industrial certification or performance claim follows from these software tests.
