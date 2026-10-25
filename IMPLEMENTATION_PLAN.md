# Implementation plan

Public demo extension: implemented a separate browser workspace for Vercel, real same-origin browser OCR, shared deterministic rules, atomic IndexedDB records, product/reference configuration, original evidence and corrections, self-declared human review, searchable history, export/printing and deletion. Workstation APIs are disabled in this mode. The existing workstation remains available locally. Browser and station tests cover both; remote redeployment remains the user's next step (BROWSER_DEMO.md).

1. Next.js App Router, strict TypeScript, accessible custom design system; local workstation deployment only.
2. SQLite migration with organizations, local users, sessions, products/specifications, private image assets, inspections, extracted fields, findings, human reviews, audit events. All resource reads scoped to session organization.
3. Server-side Tesseract English OCR with bundled trained data and real word coordinates. Conservative deterministic comparisons. A timeout or unreadable evidence yields REVIEW, never a manufactured result.
4. Product CRUD, image upload/capture, reference evidence, review correction and append-only decision history, printable reports, stored-data dashboard/history, guided synthetic fixtures.
5. Optional Gemini adapter gated by environment configuration, free-tier acknowledgment, and explicit per-image consent. Keep AI observations separate from OCR and rules.
6. Unit/integration tests, real OCR fixture tests, Playwright workflow, lint/typecheck/build, documentation of actual results.

Scope choice: prioritize a private offline workstation over unconfigured SaaS authentication. Local sessions are convenience access controls, not remote identity verification. Supabase and public multi-tenant deployment are deferred and must not be represented as implemented.

## Camera-first alignment update

Implemented live camera capture/retake, repeat inspection selection, separate production batches, named administrator/reviewer/inspector accounts, image-quality guidance and experimental aligned reference differences. Migration 002 preserves existing records and creates initial batches from existing specifications. All processing remains local by default. Private phone access has an exact HTTPS-origin configuration and documented local TLS setup; physical phone and LAN testing remain outstanding. See TEST_RESULTS.md for executed verification.
