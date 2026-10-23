# Architecture

## Implemented stack

Next.js App Router, React, strict TypeScript, accessible custom CSS components, Lucide, Recharts, Zod, Node SQLite, Sharp, Tesseract.js, Vitest and Playwright. Exact package versions are locked in `package-lock.json`. No runtime font/CDN requests are required.

## Data flow

1. A same-origin loopback request opens a demo operator session or isolated guest organization. Once named accounts are enabled, operator access requires a salted-scrypt password login; remote station access always requires a named account and an exact configured HTTPS origin. An HTTP-only SameSite=Strict random token cookie expires after 24 hours.
2. Product specifications are validated by Zod and stored relationally. Each inspection captures an immutable product/specification snapshot, including its reference image identifier.
3. Uploads are checked for declared type/size, then decoded with Sharp's pixel limit. EXIF orientation is applied, metadata stripped, dimensions capped at 2400 and normalized PNG stored under a generated filename outside `public/`.
4. Tesseract runs server-side with a packaged English model, local Node worker and WASM core. Each result includes real text, recognition scores and word coordinates in the normalized image's coordinate system. A 90-second deadline and single active OCR worker limit resource consumption. Busy/failed OCR saves a REVIEW result with explicit warnings.
5. `src/lib/domain.ts` extracts explicit labeled fields or exact expected phrases, then compares normalized text. Low recognition scores, absent words, duplicate candidates and ambiguous dates remain uncertain. Missing mandatory text is REVIEW, never automatically FAIL. A clear readable mismatch produces FAIL recommendation. All required supported checks must match for PASS.
6. Optional `VisionProvider` runs separately. Gemini receives no expected specification, reducing answer anchoring. Its schema-validated observations never silently replace OCR or affect deterministic disposition.
7. SQLite writes original inspection, extracted-field rows, findings and audit event atomically. Human reviews append separately with a rationale, corrections and recomputed comparison. The original result remains unchanged. Latest review supplies final disposition.
8. Dashboard aggregates actual stored records. Reports display the snapshot, image, text, findings, human decision, timestamps, method and limits.

## Modules

- `src/lib/domain.ts`: schemas, types, conservative rules and fictional seed specification.
- `src/lib/db.ts`, `migrations/001_initial.sql`: SQLite access, transactional records, migration ledger.
- `src/lib/auth.ts`: loopback/origin checks, local sessions, reviewer authorization, safe errors.
- `src/lib/accounts.ts`, `migrations/002_stations.sql`: named staff, salted password hashes, login throttling, production batches and migration of existing defaults.
- `src/lib/local-vision.ts`, `station-types.ts`: capture-quality measurements, conservative translation alignment and measured reference differences, with uncertainty handling.
- `src/components/station.tsx`: live camera lifecycle, batch management, staff settings and local image-processing evidence.
- `src/lib/images.ts`, `ocr.ts`, `vision.ts`: image decoding, offline OCR and optional cloud adapter.
- `src/app/api/[...route]/route.ts`: session, product, image, inspection, human review and audit APIs.
- `src/components/workspace.tsx`: landing/workspace screens, form state and review UI.
- `src/app/globals.css`: responsive tokens, light/dark themes, keyboard focus, print layout.
- `scripts/fixtures.mjs`: reproducible synthetic image generation.
- `tests/`, `e2e/`: rules, actual OCR, mocked cloud and browser/API integration verification.

## Relational model

Organization → AppUser → Session. Organization → Product → ProductSpecification. Product optionally references Image. Inspection belongs to Organization and Product, references an Image, and owns ExtractedField, InspectionFinding and HumanReview rows. AuditEvent references the organization and local user. Foreign keys, unique organization/SKU constraints and cascade/restrict deletion rules are applied. Images serve both reference-image and inspection-image roles through separate foreign keys.

Original extraction and specification snapshots are also stored as JSON payloads to retain the exact version of evidence used. Structured extracted-field/finding tables support future queries. Migrations are applied on first DB access; version 1 is idempotent. Migration 002 adds production batches, accounts and login throttling in a transaction, records version 2, and backfills existing product defaults into initial production batches.

## Security boundary

All private resource reads are scoped to the authenticated local session's organization. Reviews require `operator`. Guest data cannot access operator images or inspections. Mutations require a matching Origin; cross-site fetches and external hosts are rejected. Image filenames never come from users. React escapes OCR/AI text; provider instructions explicitly treat image text as untrusted. There are no model tools or arbitrary actions.

Anonymous demo mode remains local-only until the first administrator is created. Account setup then revokes anonymous operator sessions and requires named login. Host/origin checks are defense in depth, not protection against a malicious local process or incorrectly configured public reverse proxy. No remote production claim is made.

## Deliberate scope decisions

SQLite replaces unconfigured Supabase to meet zero-credential local operation. Supabase Auth/RLS/storage, public SaaS deployment, multi-station job queues, background jobs, analytics pagination, calibrated visual anomaly models and automated PDF generation are deferred. Named station accounts, batch records, browser camera capture and basic local visual algorithms are implemented. Forms use native accessible controls plus Zod rather than adding a form library. Custom CSS provides the design system rather than requiring a UI generator. These choices keep P0 functional without service accounts.
