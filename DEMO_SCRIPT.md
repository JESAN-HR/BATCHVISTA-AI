# Three-minute competition demonstration

## Public browser-mode version

Use the deployed browser demo or `BATCHVISTA_MODE=browser` locally. Only fictional fixtures are needed. First OCR use downloads assets, so load a test once before recording; subsequent inspections still run genuine OCR.

- **0:00–0:30:** explain the packaging-label problem and open the browser workspace. State that this is a prototype for smaller manufacturing teams.
- **0:30–0:55:** show Product catalog with the expected product, batch, dates and mandatory text. Explain that the system checks an approved specification.
- **0:55–1:30:** New inspection → Wrong batch → Run real inspection. Show progress, actual text and OCR boxes. Explain that OCR runs on the visitor's device without a paid API.
- **1:30–2:10:** show the batch mismatch, enter a fictional reviewer name, choose Reject and explain the rationale. Confirm, then Open report and demonstrate PDF/JSON export.
- **2:10–2:40:** inspect Low resolution to show REVIEW and absent fabricated text/boxes. Explain uncertainty, manual reference review and the absence of physical-defect certification.
- **2:40–3:00:** show saved history. Explain that this public demo stores evidence in the browser, has no shared authenticated team records, and requires exports. The subscription/team product remains a business hypothesis, not paying traction.

## Workstation-mode version

Before recording: run `npm run dev`, open localhost, use the operator workspace. Use only the bundled fictional labels. If a completely clean dashboard is desired, stop the server and run the backup-preserving reset command first.

**0:00–0:25 — The problem**
Landing page: “A correct product can still leave a line with the wrong batch or expiry label. BatchVista turns that packaging image into a structured check with evidence and a human decision. We're building for small and medium manufacturers and quality-control teams.”

**0:25–0:50 — Define the standard**
Open workspace → Product catalog: show fictional Aster Oat Drink and its approved reference. Open Batch stations and point to batch BV-2026-042 and expiry 2027-04-01. “Unlike an image chatbot, this starts with a registered standard and a production batch. Our demo data is synthetic; the processing is real.”

**0:50–1:25 — Real extraction**
New inspection → select the open BV-2026-042 batch. Briefly open/cancel the live camera preview if hardware is available, then choose Wrong batch → Run inspection. “Capture from a camera or upload a photograph. Tesseract's trained OCR model runs on this computer. No API key or credit card is required, and no image is sent to a cloud service.” Allow the actual processing to finish. Point to the original image, real word boxes and expected/observed batch values.

**1:25–1:55 — Human review**
“The observed batch is BV-2026-099. An explicit comparison recommends failure. It does not certify safety or make the final decision.” Choose Reject and type: “Verified printed batch BV-2026-099 against approved BV-2026-042. Reject for relabeling.” Confirm. Show the audit entry and Open report → Print / Save PDF. Cancel the print dialog if recording.

**1:55–2:25 — Responsible uncertainty**
New inspection → Low resolution → Run inspection. “When pixels don't support a conclusion, we show REVIEW. Missing OCR is not proof of a defect.” Show the uncertainty note and lack of invented boxes. Mention optional Gemini observations are modular, off by default and limited to consented fictional test data.

**2:25–3:00 — Product and business**
Overview: show counts derived from the records just created. “Our value hypothesis is more consistent label checks, retained visual evidence and less manual reporting. Subscription pricing could be by organization, inspection volume or station. We have not claimed customers, measured savings or industrial validation. Next comes field evaluation, verified organization access and validated inspection models. Today, the full image-to-review-to-report workflow works locally.”

If OCR fails unexpectedly: show the recorded warning and REVIEW status. Improve the input and rerun. Never substitute a screenshot or predetermined result for processing.

Optional alternate demonstration: replace the low-resolution step with **Missing print**, enabling **Compare approved reference locally (experimental)**. Show the measured difference regions and explain: “This is pixel comparison, not a trained defect classifier. Lighting, layout and intended variable text can change pixels; a human determines their meaning.” Use the approved synthetic reference and the original open batch. Do not describe these fixtures as real factory validation.
