# Public browser demo — Vercel

Real English OCR and deterministic verification run on the visitor's device. IndexedDB stores products, reference images, inspection photographs, original extraction and human reviews. No database, authentication provider, Gemini key or billing-enabled API is required.

## Update your existing Vercel deployment

1. Upload/commit **this updated source** to the repository connected to Vercel, or deploy this folder using your existing deployment method. Redeploying an older commit will not include the fix. Do not upload `.env.local`, `data`, `node_modules` or `.next`.
2. Keep the framework preset **Next.js**. The included `vercel.json` sets **`npm run build`**. Do not override it with `next build`: the npm prebuild hook copies the bundled worker, WASM and English model into `public/ocr`.
3. Under Project Settings → Environment Variables, set **`BATCHVISTA_MODE=browser`** for Production and Preview, then redeploy. `VERCEL=1` also selects this mode when Vercel system environment variables are exposed; the explicit setting makes your intention clear. No `NEXT_PUBLIC_` prefix is needed.
4. Use Node **22.13 or newer** (24 recommended). No other environment values are required. Do not set `BATCHVISTA_ORIGIN` to bypass the workstation restriction. Cloud keys are unused in browser mode.
5. Open the new deployment URL. Look for **Device-local demo** and **Open browser workspace**. If the old workstation appears, verify the deployed source commit, environment and URL.
6. Open workspace → Aster product → Wrong batch → Run real inspection. Allow the actual model download/processing to finish. Review evidence, enter a fictional reviewer name and rationale, reject, then Open report → Print / Save PDF.

See Vercel's [system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables) and [environment configuration](https://vercel.com/docs/environment-variables). This change was tested with a local production build; the remote Vercel URL has not been provided or verified. No deployment or paid service activation was performed by the agent.

## Run browser mode locally

Windows PowerShell:

```powershell
$env:BATCHVISTA_MODE = 'browser'
npm.cmd run dev -- --port 3002
```

Ubuntu Bash:

```bash
BATCHVISTA_MODE=browser npm run dev -- --port 3002
```

Open `http://127.0.0.1:3002`. For production, build normally then start with this variable in the server environment. To return to workstation mode, unset the variable and restart (`Remove-Item Env:BATCHVISTA_MODE` in PowerShell; `unset BATCHVISTA_MODE` in Bash). Vercel always selects browser mode when `VERCEL=1` is present.

## First-time operation

- **Product catalog:** register/edit SKU, name, variant, expected batch/dates, quantity, required phrases and reference photograph. Browser mode keeps batch expectations on the product. Edit them for the next run; saved inspections preserve earlier snapshots. Independent batch management remains in workstation mode.
- **New inspection:** select a product, capture with the live camera or upload PNG/JPEG/WebP (10 MB, 24 MP maximum). Review the preview. Use clear, face-on, evenly lit English labels. Camera access needs HTTPS/localhost and browser permission; upload remains available.
- **Run real inspection:** first use downloads OCR assets from this same site. Photos are processed locally, not uploaded. Progress shows OCR stages. Keep the page open. Failures are shown as errors; no successful inspection is fabricated.
- **Evidence & review:** inspect actual OCR word boxes, original text, expected/observed fields and the reference. Missing OCR text remains uncertain. Correct mistaken OCR fields if necessary and record Accept, Reject or Hold with a rationale. Original evidence and successive reviews remain recorded.
- **Report:** Open report → Print / Save PDF or Export JSON (includes photograph evidence). Reviewer names are self-declared, not authenticated staff identities.
- **History:** search product/SKU/batch/ID and filter human outcomes. Counts derive from actual saved records, newest first.
- **Data & settings:** export all records, request persistent browser storage or erase local records after confirmation. Individual products/inspections can also be deleted. Appearance toggles in the header.

## Boundaries and privacy

The browser fetches application code, fixtures and OCR assets from the host. It does not send uploaded photographs, extracted text or saved records to application APIs or third-party AI providers. Hosting still receives ordinary page/asset requests. This mode adds no analytics or cloud inference.

Records belong to one browser profile and site origin. Other devices, private windows and preview domains have separate records. Browser cleanup, storage eviction, private-session closure or a domain change can remove access. Export regularly; persistent-storage permission does not replace backups. JSON exports are archival; importing/restoring them is not implemented. Large histories can exhaust memory/storage because the prototype loads its workspace into memory.

There is no login, trusted reviewer identity, shared database or tamper-proof audit in this public demo. Anyone using the same browser profile can read/change records. Workstation password accounts and SQLite records are separate; they are neither exposed nor automatically migrated. Workstation `/api/*` routes return 404 in browser mode, including on localhost.

Trained English OCR and rules are real. Canvas decoding/resizing and a resolution warning are image processing. Multimodal AI, automatic reference alignment, advanced quality metrics, calibrated defect confidence and physical-defect classification are unavailable in browser mode. References are compared manually. Workstation mode retains experimental pixel comparison.

Local processing does not mean a guaranteed fully offline website: initial assets need internet and reloading the page/worker can need the host. No service-worker offline installation is provided. OCR has a 90-second deadline; improve the crop or use a faster device if necessary. Reload before retrying stalled model initialization. Physical Android/iOS cameras, Safari, Ubuntu and a live Vercel deployment remain unverified.

## Troubleshooting

- **Old localhost-only error:** ensure deployed source includes `browser-workspace.tsx`, set `BATCHVISTA_MODE=browser`, and redeploy. Do not delete the workstation access guard.
- **OCR assets missing:** build with `npm run build`. Check `/ocr/worker.min.js` and `/ocr/eng.traineddata.gz` on your deployment. `public/ocr` is generated from npm dependencies and intentionally ignored by Git.
- **Storage unavailable/full:** allow site storage, leave private browsing, export existing records and free space. Failed saves are explicitly reported.
- **Another tab changed records:** reload the stale tab. Revision checks prevent overwriting newer records.
- **Unclear result:** improve crop, focus, framing and lighting. PASS means supported readable checks matched, not safety/compliance.

## Verification

```sh
npm run build
npm run test:browser
```

The tests use installed Edge, port 3103 and isolated browser profiles; they do not modify your browser profile or workstation SQLite records. See TEST_RESULTS.md for executed outcomes. Ubuntu users without Edge can remove `channel: 'msedge'` in `playwright.browser.config.ts` and install Chromium using README instructions; that platform remains unverified.
