"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Focus,
  ScanLine,
  Package,
  History,
  Download,
  Sun,
  Moon,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import {
  fields,
  labels,
  productSchema,
  reviewSchema,
  verify,
  sampleProduct,
  type ProductInput,
  type Field,
  type Decision,
} from "@/lib/domain";
import {
  browserOCR,
  decodeBrowserImage,
  downloadJSON,
  loadBrowserState,
  saveBrowserState,
  type BrowserState,
  type BrowserProduct,
  type BrowserRecord,
} from "@/lib/browser-engine";
import { CameraCapture } from "./station";
import "./browser-workspace.css";

const fixtures = [
  ["correct", "Approved label"],
  ["wrong-batch", "Wrong batch"],
  ["wrong-expiry", "Wrong expiry"],
  ["ambiguous", "Low resolution"],
] as const;
type Screen = "inspect" | "products" | "history" | "detail" | "settings";
const timestamp = (s: string) => new Date(s).toLocaleString();
const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "Operation failed. Please retry.";

export default function BrowserWorkspace() {
  const [state, setState] = useState<BrowserState | null>(null);
  const [screen, setScreen] = useState<Screen>("inspect");
  const [entered, setEntered] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [productId, setProductId] = useState("aster-demo");
  const [input, setInput] = useState<Awaited<
    ReturnType<typeof decodeBrowserImage>
  > | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<BrowserProduct | "new" | null>(null);
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState("all");
  const [dark, setDark] = useState(false);
  const [report, setReport] = useState(false);
  const [boxes, setBoxes] = useState(true);
  const [reviewer, setReviewer] = useState("");
  const [decision, setDecision] = useState<Decision>("HOLD");
  const [note, setNote] = useState("");
  const [corrections, setCorrections] = useState<
    Partial<Record<Field, string>>
  >({});

  useEffect(() => {
    void loadBrowserState()
      .then(setState)
      .catch((e) => setError(errorMessage(e)));
  }, []);
  const product = state?.products.find((p) => p.id === productId);
  const selected = state?.inspections.find((i) => i.id === selectedId);
  async function commit(next: BrowserState) {
    const saved = await saveBrowserState(next);
    setState(saved);
    return saved;
  }
  function openRecord(i: BrowserRecord) {
    setSelectedId(i.id);
    setScreen("detail");
    setReport(false);
    setNote("");
    setCorrections({});
    setError("");
  }
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  async function chooseImage(file: Blob) {
    await action(async () => {
      setInput(await decodeBrowserImage(file));
    });
  }
  async function runInspection() {
    if (!input || !product || !state) return;
    await action(async () => {
      setProgress(
        "Loading browser OCR. First use downloads the English model from this site…",
      );
      const ocr = await browserOCR(input, setProgress);
      const record: BrowserRecord = {
        id: crypto.randomUUID(),
        productId: product.id,
        product: { ...product },
        imageId: crypto.randomUUID(),
        image: input.image,
        reference: product.reference,
        createdAt: new Date().toISOString(),
        ocr,
        analysis: verify(product, ocr),
        cloud: null,
        cloudError: null,
        processingMethod:
          "Browser Tesseract English OCR + deterministic rules (no cloud AI)",
        reviews: [],
        finalStatus: null,
      };
      await commit({ ...state, inspections: [record, ...state.inspections] });
      openRecord(record);
      setInput(null);
      setNotice(
        "Inspection saved in this browser. A human decision is still required.",
      );
    });
  }
  async function saveProduct(
    inputProduct: ProductInput,
    reference: string | null,
  ) {
    if (!state) return;
    await action(async () => {
      const validated = productSchema.parse(inputProduct);
      const id =
        editing && editing !== "new" ? editing.id : crypto.randomUUID();
      if (
        state.products.some(
          (p) =>
            p.id !== id && p.sku.toLowerCase() === validated.sku.toLowerCase(),
        )
      )
        throw new Error("This SKU already exists.");
      const p: BrowserProduct = {
        ...validated,
        id,
        createdAt:
          editing && editing !== "new"
            ? editing.createdAt
            : new Date().toISOString(),
        reference,
        referenceId: reference ? id : null,
      };
      await commit({
        ...state,
        products: [p, ...state.products.filter((old) => old.id !== id)],
      });
      setProductId(id);
      setEditing(null);
      setNotice(
        "Approved specification saved. Existing inspection snapshots are unchanged.",
      );
    });
  }
  async function review(e: FormEvent) {
    e.preventDefault();
    if (!state || !selected) return;
    await action(async () => {
      if (reviewer.trim().length < 2 || reviewer.trim().length > 80)
        throw new Error("Enter a reviewer name between 2 and 80 characters.");
      const parsed = reviewSchema.parse({ decision, note, corrections });
      const combined = {
        ...selected.reviews.at(-1)?.corrections,
        ...parsed.corrections,
      };
      const updated = {
        ...selected,
        finalStatus: parsed.decision,
        reviews: [
          ...selected.reviews,
          {
            id: crypto.randomUUID(),
            ...parsed,
            corrections: combined,
            reviewer: reviewer.trim(),
            createdAt: new Date().toISOString(),
            analysis: verify(selected.product, selected.ocr, combined),
          },
        ],
      };
      await commit({
        ...state,
        inspections: state.inspections.map((i) =>
          i.id === updated.id ? updated : i,
        ),
      });
      setNote("");
      setCorrections({});
      setNotice(
        "Human decision saved. This demo name is self-declared, not an authenticated identity.",
      );
    });
  }
  const analysis = selected?.reviews.at(-1)?.analysis || selected?.analysis;
  const navigate = (view: Screen) => {
    setScreen(view);
    setReport(false);
    setError("");
    setNotice("");
  };
  return (
    <div
      className={`browser-app ${report ? "browser-report" : ""}`}
      data-theme={dark ? "dark" : "light"}
    >
      <header className="browser-header no-print">
        <Link href="/" className="brand">
          <Focus size={27} />
          <strong>
            BATCHVISTA <span className="brand-ai">AI</span>
          </strong>
        </Link>
        <span className="badge green">Device-local demo</span>
        <button
          className="button icon"
          aria-label="Toggle appearance"
          onClick={() => setDark(!dark)}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>
      {!entered ? (
        <main className="browser-welcome">
          <p className="eyebrow">INDUSTRIAL VISUAL QUALITY INTELLIGENCE</p>
          <h1>
            Your camera.
            <br />A clearer quality decision.
          </h1>
          <p>
            Compare packaging photographs with approved label specifications.
            Real OCR, explicit checks, visible evidence and a human decision —
            directly in your browser.
          </p>
          <button
            className="button primary"
            disabled={!state}
            onClick={() => setEntered(true)}
          >
            Open browser workspace <ArrowRight size={18} />
          </button>
          {!state && !error && <p role="status">Opening device storage…</p>}
          {error && <p role="alert">{error}</p>}
          <div className="browser-feature-grid">
            <section>
              <ScanLine />
              <h3>Real extraction</h3>
              <p>
                Tesseract reads actual image pixels on your device. No API key
                or paid inference.
              </p>
            </section>
            <section>
              <ShieldCheck />
              <h3>Your evidence stays here</h3>
              <p>
                Products, photographs and decisions are stored in this browser.
                No shared accounts or team sync.
              </p>
            </section>
            <section>
              <Package />
              <h3>A practical prototype</h3>
              <p>
                For small manufacturing teams evaluating label checks. No
                industrial accuracy or compliance certification is claimed.
              </p>
            </section>
          </div>
          <p className="browser-disclosure">
            First use needs internet to load the app and OCR assets. Keep
            records exported: clearing site data, private browsing or storage
            eviction can erase them. Browser processing speed varies by device.
          </p>
        </main>
      ) : (
        <>
          <nav
            className="browser-nav no-print"
            aria-label="Workspace navigation"
          >
            {(
              [
                ["inspect", "New inspection"],
                ["products", "Product catalog"],
                ["history", "Inspection history"],
                ["settings", "Data & settings"],
              ] as const
            ).map(([id, title]) => (
              <button
                key={id}
                className={`button ${screen === id ? "primary" : ""}`}
                disabled={busy}
                onClick={() => navigate(id)}
              >
                {title}
              </button>
            ))}
          </nav>
          <main className="browser-main">
            <p className="browser-disclosure no-print">
              <strong>Browser demo · No account required.</strong> Images stay
              on this device. Records are not shared or backed up automatically.
              Reviewer names are self-declared. Export important evidence.
            </p>
            {error && (
              <div role="alert" className="browser-error no-print">
                {error}
              </div>
            )}
            {notice && (
              <div role="status" className="browser-notice no-print">
                {notice}
              </div>
            )}
            {busy && (
              <p role="status" className="browser-notice no-print">
                {progress || "Saving changes…"}
              </p>
            )}
            {!state ? (
              <p>
                Storage could not be opened. Reload or allow browser site
                storage.
              </p>
            ) : (
              <>
                {screen === "inspect" && (
                  <>
                    <p className="eyebrow">
                      01 / SELECT · 02 / CAPTURE · 03 / VERIFY
                    </p>
                    <h1>Inspect a package</h1>
                    <div className="browser-columns">
                      <section className="browser-card">
                        <h2>Approved specification</h2>
                        <label>
                          Product
                          <select
                            value={productId}
                            disabled={busy}
                            onChange={(e) => setProductId(e.target.value)}
                          >
                            <option value="">Select a product</option>
                            {state.products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} · {p.sku}
                              </option>
                            ))}
                          </select>
                        </label>
                        {product ? (
                          <>
                            <p>
                              <strong>Batch:</strong> {product.batch}
                              <br />
                              <strong>Expiry:</strong>{" "}
                              {product.expiry || "Not required"}
                              <br />
                              <strong>Quantity:</strong> {product.quantity}
                            </p>
                            <p className="small">
                              Change batch/date expectations in Product catalog
                              before inspecting a new run. Each inspection
                              retains its own approved snapshot.
                            </p>
                          </>
                        ) : (
                          <p>Create or select a product to inspect.</p>
                        )}
                        <h3>Try a synthetic label</h3>
                        <p className="small">
                          Fictional Aster examples. These images go through real
                          OCR; results are not preset.
                        </p>
                        <div className="browser-actions">
                          {fixtures.map(([id, name]) => (
                            <button
                              className="button"
                              disabled={busy}
                              key={id}
                              onClick={() =>
                                void action(async () => {
                                  const r = await fetch(`/fixtures/${id}.png`);
                                  if (!r.ok)
                                    throw new Error(
                                      "Example image unavailable. Upload a photograph instead.",
                                    );
                                  setInput(
                                    await decodeBrowserImage(await r.blob()),
                                  );
                                })
                              }
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      </section>
                      <section className="browser-card">
                        <h2>Capture or upload</h2>
                        <CameraCapture
                          disabled={busy}
                          onCapture={(f) => void chooseImage(f)}
                        />
                        <label>
                          Package photograph
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            disabled={busy}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void chooseImage(f);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        <p className="small">
                          PNG, JPEG or WebP · up to 10 MB / 24 MP. Frame the
                          complete label, face-on, with sharp focus and even
                          lighting.
                        </p>
                        {input && (
                          <>
                            <img
                              className="browser-preview"
                              src={input.image}
                              alt="Selected package photograph"
                            />
                            <p>
                              {input.width} × {input.height} pixels
                              {Math.min(input.width, input.height) < 400
                                ? " · Low resolution: recapture recommended"
                                : ""}
                            </p>
                            <button
                              className="button"
                              disabled={busy}
                              onClick={() => setInput(null)}
                            >
                              Remove photograph
                            </button>
                          </>
                        )}
                        <button
                          className="button primary browser-run"
                          disabled={busy || !input || !product}
                          onClick={() => void runInspection()}
                        >
                          <ScanLine size={18} /> Run real inspection
                        </button>
                        <p className="small">
                          English OCR + deterministic comparisons. Cloud AI,
                          automatic visual defect classification and
                          pixel-reference alignment are unavailable in this
                          browser mode. Review references manually.
                        </p>
                      </section>
                    </div>
                  </>
                )}
                {screen === "products" && (
                  <>
                    <div className="browser-title">
                      <h1>Product catalog</h1>
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() => setEditing("new")}
                      >
                        Register product
                      </button>
                    </div>
                    {editing && (
                      <ProductEditor
                        key={editing === "new" ? "new" : editing.id}
                        product={editing === "new" ? null : editing}
                        busy={busy}
                        onSave={saveProduct}
                        onCancel={() => setEditing(null)}
                      />
                    )}
                    <div className="browser-feature-grid">
                      {state.products.map((p) => (
                        <section className="browser-card" key={p.id}>
                          <Package />
                          <h2>{p.name}</h2>
                          <p>
                            {p.sku} · {p.variant}
                          </p>
                          <p>
                            Batch {p.batch}
                            <br />
                            Expiry {p.expiry || "Not required"}
                          </p>
                          {p.reference && (
                            <img
                              className="browser-preview"
                              src={p.reference}
                              alt={`Approved ${p.name}`}
                            />
                          )}
                          <div className="browser-actions">
                            <button
                              className="button"
                              disabled={busy}
                              onClick={() => setEditing(p)}
                            >
                              Edit specifications
                            </button>
                            <button
                              className="button"
                              disabled={busy}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    "Delete this product? Existing inspection snapshots remain.",
                                  )
                                )
                                  void action(async () => {
                                    await commit({
                                      ...state,
                                      products: state.products.filter(
                                        (x) => x.id !== p.id,
                                      ),
                                    });
                                  });
                              }}
                            >
                              Delete product
                            </button>
                          </div>
                        </section>
                      ))}
                    </div>
                  </>
                )}
                {screen === "history" && (
                  <>
                    <h1>Inspection history</h1>
                    <div className="browser-stats">
                      {[
                        ["Total", state.inspections.length],
                        [
                          "Accepted",
                          state.inspections.filter(
                            (i) => i.finalStatus === "ACCEPTED",
                          ).length,
                        ],
                        [
                          "Rejected",
                          state.inspections.filter(
                            (i) => i.finalStatus === "REJECTED",
                          ).length,
                        ],
                        [
                          "Awaiting / hold",
                          state.inspections.filter(
                            (i) => !i.finalStatus || i.finalStatus === "HOLD",
                          ).length,
                        ],
                      ].map(([label, value]) => (
                        <section key={label}>
                          <strong>{value}</strong>
                          <span>{label}</span>
                        </section>
                      ))}
                    </div>
                    <div className="browser-actions">
                      <label>
                        Search records
                        <input
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Product, SKU, batch or inspection ID"
                        />
                      </label>
                      <label>
                        Human outcome
                        <select
                          value={outcome}
                          onChange={(e) => setOutcome(e.target.value)}
                        >
                          <option value="all">All outcomes</option>
                          <option value="pending">Awaiting review</option>
                          <option value="ACCEPTED">Accepted</option>
                          <option value="REJECTED">Rejected</option>
                          <option value="HOLD">Hold</option>
                        </select>
                      </label>
                    </div>
                    <p className="small">
                      Newest first. Counts derive only from records saved in
                      this browser.
                    </p>
                    {state.inspections.length === 0 && (
                      <div className="browser-card">
                        <History />
                        <h2>No inspections yet</h2>
                        <p>
                          Capture a label to start building an evidence history.
                        </p>
                      </div>
                    )}
                    {state.inspections
                      .filter(
                        (i) =>
                          `${i.id} ${i.product.name} ${i.product.sku} ${i.product.batch}`
                            .toLowerCase()
                            .includes(query.toLowerCase()) &&
                          (outcome === "all" ||
                            (outcome === "pending"
                              ? !i.finalStatus
                              : i.finalStatus === outcome)),
                      )
                      .map((i) => (
                        <button
                          className="browser-history-item"
                          key={i.id}
                          onClick={() => openRecord(i)}
                        >
                          <span>
                            <strong>{i.product.name}</strong>
                            <br />
                            {i.product.batch} · {timestamp(i.createdAt)}
                          </span>
                          <span>
                            {i.finalStatus || "Awaiting review"}
                            <br />
                            Machine: {i.analysis.recommendation}
                          </span>
                        </button>
                      ))}
                  </>
                )}
                {screen === "detail" && selected && analysis && (
                  <>
                    <div className="browser-title">
                      <div>
                        <p className="eyebrow">{selected.id}</p>
                        <h1>
                          {report ? "Inspection report" : "Evidence & review"}
                        </h1>
                        <p>
                          {selected.product.name} · {selected.product.sku} ·{" "}
                          {timestamp(selected.createdAt)}
                        </p>
                      </div>
                      <div className="browser-actions no-print">
                        <button
                          className="button"
                          disabled={busy}
                          onClick={() => {
                            setReport(!report);
                          }}
                        >
                          {" "}
                          {report ? "Back to evidence" : "Open report"}
                        </button>
                        <button
                          className="button"
                          onClick={() =>
                            downloadJSON(
                              selected,
                              `batchvista-${selected.id}.json`,
                            )
                          }
                        >
                          <Download size={16} /> Export JSON
                        </button>
                        {report && (
                          <button
                            className="button primary"
                            onClick={() => window.print()}
                          >
                            Print / Save PDF
                          </button>
                        )}
                        <button
                          className="button"
                          disabled={busy}
                          onClick={() => {
                            setProductId(selected.productId);
                            setInput(null);
                            navigate("inspect");
                          }}
                        >
                          Inspect next package
                        </button>
                      </div>
                    </div>
                    <section className="browser-result">
                      <h2>Machine recommendation: {analysis.recommendation}</h2>
                      <p>
                        Final human decision:{" "}
                        <strong>
                          {selected.finalStatus || "Awaiting review"}
                        </strong>
                      </p>
                      <p>{selected.processingMethod}</p>
                      <p>
                        OCR recognition score:{" "}
                        {Math.round(selected.ocr.confidence)} — a
                        text-recognition signal, not a safety probability.
                      </p>
                    </section>
                    <div className="browser-columns">
                      <section className="browser-card">
                        <h2>Image evidence</h2>
                        <div className="browser-image-evidence">
                          <img src={selected.image} alt="Inspected package" />
                          {boxes &&
                            selected.ocr.words.map((w, index) => (
                              <span
                                key={index}
                                title={w.text}
                                style={{
                                  left: `${(w.bbox.x0 / selected.ocr.width) * 100}%`,
                                  top: `${(w.bbox.y0 / selected.ocr.height) * 100}%`,
                                  width: `${((w.bbox.x1 - w.bbox.x0) / selected.ocr.width) * 100}%`,
                                  height: `${((w.bbox.y1 - w.bbox.y0) / selected.ocr.height) * 100}%`,
                                }}
                              />
                            ))}
                        </div>
                        <label className="browser-check no-print">
                          <input
                            type="checkbox"
                            checked={boxes}
                            onChange={(e) => setBoxes(e.target.checked)}
                          />{" "}
                          Actual OCR word boxes
                        </label>
                        <h3>Approved reference · manual comparison</h3>
                        {selected.reference ? (
                          <img
                            className="browser-preview"
                            src={selected.reference}
                            alt="Approved reference"
                          />
                        ) : (
                          <p>
                            No approved reference was stored for this
                            inspection.
                          </p>
                        )}
                        <h3>Original extracted text</h3>
                        <pre>{selected.ocr.text || "No readable text"}</pre>
                      </section>
                      <section className="browser-card">
                        <h2>Specification comparisons</h2>
                        {analysis.comparisons.map((c, index) => (
                          <div className="browser-comparison" key={index}>
                            <div className="browser-title">
                              <strong>{c.field}</strong>
                              <span
                                className={`badge ${c.status === "match" ? "green" : c.status === "mismatch" ? "red" : "amber"}`}
                              >
                                {c.status}
                              </span>
                            </div>
                            <p>
                              Expected: {c.expected}
                              <br />
                              Observed: {c.observed || "Not reliably readable"}
                            </p>
                            <p className="small">
                              {c.source}: {c.evidence}
                            </p>
                          </div>
                        ))}
                        {analysis.uncertaintyNotes.map((n, index) => (
                          <p key={index} className="browser-disclosure">
                            {n}
                          </p>
                        ))}
                      </section>
                    </div>
                    {!report && (
                      <form className="browser-card no-print" onSubmit={review}>
                        <h2>Human quality-control review</h2>
                        <p>
                          A recommendation does not certify safety, compliance
                          or absence of defects. Inspect the photograph and
                          reference before deciding.
                        </p>
                        <label>
                          Reviewer name
                          <input
                            required
                            minLength={2}
                            maxLength={80}
                            value={reviewer}
                            onChange={(e) => setReviewer(e.target.value)}
                          />
                        </label>
                        <p className="small">
                          Self-declared demo identity. Anyone with access to
                          this browser can review its records.
                        </p>
                        <details>
                          <summary>Correct an OCR transcription</summary>
                          <p>
                            Only edited fields replace OCR; originals remain in
                            the record. Clear a field to record unreadable
                            evidence.
                          </p>
                          <div className="browser-form-grid">
                            {fields.map((f) => (
                              <label key={f}>
                                {labels[f]}
                                <input
                                  value={
                                    corrections[f] ??
                                    selected.reviews.at(-1)?.corrections[f] ??
                                    ""
                                  }
                                  maxLength={160}
                                  placeholder="Keep original OCR"
                                  onChange={(e) =>
                                    setCorrections({
                                      ...corrections,
                                      [f]: e.target.value,
                                    })
                                  }
                                />
                              </label>
                            ))}
                          </div>
                        </details>
                        <label>
                          Final disposition
                          <select
                            value={decision}
                            onChange={(e) =>
                              setDecision(e.target.value as Decision)
                            }
                          >
                            <option value="HOLD">
                              Hold for further review
                            </option>
                            <option value="ACCEPTED">Accept</option>
                            <option value="REJECTED">Reject</option>
                          </select>
                        </label>
                        <label>
                          Review rationale
                          <textarea
                            required
                            minLength={8}
                            maxLength={2000}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                          />
                        </label>
                        <button className="button primary" disabled={busy}>
                          Confirm human decision
                        </button>
                      </form>
                    )}
                    <section className="browser-card">
                      <h2>Review audit trail</h2>
                      <p>
                        Original machine recommendation:{" "}
                        {selected.analysis.recommendation}
                      </p>
                      {selected.reviews.length === 0 && (
                        <p>No human decision recorded.</p>
                      )}
                      {selected.reviews.map((r) => (
                        <article key={r.id}>
                          <h3>
                            {r.reviewer} · {r.decision}
                          </h3>
                          <p>
                            {timestamp(r.createdAt)} · Self-declared browser
                            reviewer
                          </p>
                          <p>{r.note}</p>
                          {Object.entries(r.corrections).map(
                            ([field, value]) => (
                              <p key={field}>
                                Correction — {labels[field as Field]}:{" "}
                                {value || "Unreadable"}
                              </p>
                            ),
                          )}
                        </article>
                      ))}
                    </section>
                    <p className="browser-disclosure">
                      Prototype limitations: English printed-label OCR and
                      deterministic checks only. Missing OCR text is
                      uncertainty, not proof of a missing label. No trained
                      physical-defect classifier or cloud AI is used. Records
                      and reviewer names are editable by someone with browser
                      access; this is not a tamper-proof or compliance-certified
                      audit.
                    </p>
                    {!report && (
                      <button
                        className="button no-print"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Permanently delete this inspection and its image from this browser?",
                            )
                          )
                            void action(async () => {
                              await commit({
                                ...state,
                                inspections: state.inspections.filter(
                                  (i) => i.id !== selected.id,
                                ),
                              });
                              navigate("history");
                            });
                        }}
                      >
                        Delete inspection
                      </button>
                    )}
                  </>
                )}
                {screen === "settings" && (
                  <>
                    <h1>Data & settings</h1>
                    <section className="browser-card">
                      <h2>Real processing, on this device</h2>
                      <p>
                        Trained Tesseract English OCR extracts text.
                        Deterministic rules compare it to your specification.
                        Canvas decodes and resizes images. These are distinct
                        capabilities; there is no multimodal generative AI in
                        browser mode.
                      </p>
                      <p>
                        Automatic reference alignment, advanced image-quality
                        metrics, named authentication, shared batches and team
                        synchronization are available only in the workstation
                        mode or remain outside this demo. Use the reference
                        image for manual comparison.
                      </p>
                      <h2>Device-local storage</h2>
                      <p>
                        Records live in IndexedDB for this browser and this site
                        address. Another device, browser profile or Vercel
                        preview URL has separate records. Clearing site data or
                        browser eviction can erase them. JSON exports include
                        photograph evidence; store them securely. Export files
                        are archival records; importing them back into the app
                        is not supported yet.
                      </p>
                      <div className="browser-actions">
                        <button
                          className="button"
                          onClick={() =>
                            downloadJSON(
                              state,
                              "batchvista-browser-records.json",
                            )
                          }
                        >
                          Export all records
                        </button>
                        <button
                          className="button"
                          disabled={busy}
                          onClick={() =>
                            void action(async () => {
                              const granted =
                                await navigator.storage?.persist?.();
                              setNotice(
                                granted
                                  ? "Browser granted persistent storage. Still keep exports."
                                  : "Persistent storage was not granted. Keep regular exports.",
                              );
                            })
                          }
                        >
                          Request persistent browser storage
                        </button>
                        <button
                          className="button"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Erase all products, inspections, photos and reviews in this browser? Export first.",
                              )
                            )
                              void action(async () => {
                                await commit({
                                  ...state,
                                  products: [],
                                  inspections: [],
                                });
                                setInput(null);
                                setSelectedId(null);
                                setEditing(null);
                                setNotice(
                                  "All workspace records erased from this browser. Downloaded exports are unaffected.",
                                );
                              });
                          }}
                        >
                          Erase browser records
                        </button>
                      </div>
                    </section>
                  </>
                )}
              </>
            )}
          </main>
        </>
      )}
      <footer className="browser-footer">
        BatchVista AI · Industrial Visual Quality Intelligence · Prototype ·
        Human authority retained
      </footer>
    </div>
  );
}

function ProductEditor({
  product,
  busy,
  onSave,
  onCancel,
}: {
  product: BrowserProduct | null;
  busy: boolean;
  onSave: (p: ProductInput, reference: string | null) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<ProductInput>(
    product || { ...sampleProduct, name: "", sku: "" },
  );
  const [reference, setReference] = useState<string | null>(
    product?.reference || null,
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <form
      className="browser-card"
      onSubmit={(e) => {
        e.preventDefault();
        const result = productSchema.safeParse({
          ...draft,
          requiredText: draft.requiredText.map((s) => s.trim()).filter(Boolean),
        });
        if (!result.success) {
          setError(result.error.issues.map((i) => i.message).join(" "));
          return;
        }
        setError("");
        void onSave(result.data, reference);
      }}
    >
      <h2>{product ? "Edit approved specification" : "Register product"}</h2>
      <p>
        Set the expected production batch and dates for the next inspection.
        Saved inspections preserve the earlier specification.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="browser-form-grid">
        {(["sku", ...fields] as const).map((f) => (
          <label key={f}>
            {f === "sku" ? "SKU" : labels[f]}
            <input
              required={["sku", "name", "batch", "quantity"].includes(f)}
              maxLength={f === "sku" ? 50 : 100}
              type={["manufactured", "expiry"].includes(f) ? "date" : "text"}
              value={draft[f]}
              onChange={(e) => setDraft({ ...draft, [f]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <label>
        Mandatory label text (one phrase per line)
        <textarea
          value={draft.requiredText.join("\n")}
          onChange={(e) =>
            setDraft({ ...draft, requiredText: e.target.value.split("\n") })
          }
        />
      </label>
      <label className="browser-check">
        <input
          type="checkbox"
          checked={draft.visualRequired}
          onChange={(e) =>
            setDraft({ ...draft, visualRequired: e.target.checked })
          }
        />{" "}
        Require human visual inspection (forces REVIEW)
      </label>
      <label>
        Approved reference image
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={loading || busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setLoading(true);
              void decodeBrowserImage(f)
                .then((v) => setReference(v.image))
                .catch((e) => setError(errorMessage(e)))
                .finally(() => setLoading(false));
            }
            e.target.value = "";
          }}
        />
      </label>
      {reference && (
        <>
          <img
            src={reference}
            alt="Reference preview"
            className="browser-preview"
          />
          <button
            type="button"
            className="button"
            onClick={() => setReference(null)}
          >
            Remove reference
          </button>
        </>
      )}
      <div className="browser-actions">
        <button className="button primary" disabled={busy || loading}>
          Save specification
        </button>
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
