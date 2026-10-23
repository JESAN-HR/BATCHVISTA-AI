"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Cpu,
  FileText,
  FlaskConical,
  Focus,
  History,
  ImagePlus,
  Layers3,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  Moon,
  Package,
  Plus,
  ScanLine,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fields,
  labels,
  productSchema,
  sampleProduct,
  type Decision,
  type Field,
  type Inspection,
  type Product,
  type ProductInput,
} from "@/lib/domain";
import {
  AccountDialog,
  TeamSettings,
  BatchManager,
  CameraCapture,
  QualityPreview,
  StationEvidenceView,
} from "./station";
import type { Batch } from "@/lib/station-types";

type User = {
  name: string;
  role: "operator" | "guest";
  permission?: "admin" | "reviewer" | "inspector";
};
type Data = {
  user: User;
  products: Product[];
  inspections: Inspection[];
  cloudAvailable: boolean;
  batches: Batch[];
};
type View =
  | "overview"
  | "inspect"
  | "products"
  | "batches"
  | "history"
  | "settings"
  | "detail";
const nav = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "inspect", label: "New inspection", icon: ScanLine },
  { id: "products", label: "Product catalog", icon: Package },
  { id: "batches", label: "Batch stations", icon: Layers3 },
  { id: "history", label: "Inspection history", icon: History },
] as const;
const fixtureOptions = [
  {
    id: "missing-print",
    label: "Missing print",
    hint: "Measured reference difference",
    tone: "amber",
  },
  {
    id: "rotated",
    label: "Rotated label",
    hint: "Alignment uncertainty",
    tone: "gray",
  },
  {
    id: "correct",
    label: "Approved label",
    hint: "All expected fields",
    tone: "green",
  },
  {
    id: "wrong-batch",
    label: "Wrong batch",
    hint: "One printed mismatch",
    tone: "red",
  },
  {
    id: "wrong-expiry",
    label: "Wrong expiry",
    hint: "One printed mismatch",
    tone: "amber",
  },
  {
    id: "ambiguous",
    label: "Low resolution",
    hint: "Unreadable evidence",
    tone: "gray",
  },
];
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/${url}`, init);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
const json = (value: unknown) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(value),
});
const when = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
function Badge({ value }: { value: string }) {
  const tone = ["PASS", "ACCEPTED", "match"].includes(value)
    ? "green"
    : ["FAIL", "REJECTED", "mismatch"].includes(value)
      ? "red"
      : "amber";
  return (
    <span className={`badge ${tone}`}>
      <span />
      {(
        {
          PASS: "Checks passed",
          FAIL: "Mismatch found",
          REVIEW: "Needs review",
          ACCEPTED: "Accepted",
          REJECTED: "Rejected",
          HOLD: "On hold",
          match: "Match",
          mismatch: "Mismatch",
          uncertain: "Uncertain",
        } as Record<string, string>
      )[value] || value}
    </span>
  );
}
function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <ScanLine size={28} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Focus size={23} />
      </span>
      <span>
        BATCHVISTA<span className="brand-ai"> AI</span>
      </span>
    </div>
  );
}

export default function Workspace() {
  const [accountMode, setAccountMode] = useState<"login" | "setup" | null>(
    null,
  );
  const [data, setData] = useState<Data | null>(null);
  const [landing, setLanding] = useState(true);
  const [view, setView] = useState<View>("overview");
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [dark, setDark] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [guide, setGuide] = useState(false);
  const [walk, setWalk] = useState(0);
  const [editor, setEditor] = useState<Product | "new" | null>(null);
  const [defaultVisual, setDefaultVisual] = useState(false);
  const [auditRows, setAuditRows] = useState<
    { action: string; resource_id: string; created_at: string }[] | null
  >(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDark(localStorage.getItem("bv-theme") === "dark");
      setDefaultVisual(localStorage.getItem("bv-visual") === "true");
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  useEffect(() => {
    const save = () =>
      localStorage.setItem(
        "bv-theme",
        document.documentElement.dataset.theme || "light",
      );
    window.addEventListener("pagehide", save);
    return () => {
      save();
      window.removeEventListener("pagehide", save);
    };
  }, []);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 6500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  async function refresh() {
    const result = await api<Data>("workspace");
    setData(result);
    return result;
  }
  async function enter(mode: "operator" | "guest", guided = false) {
    setLoading(true);
    try {
      if (mode === "operator") {
        const status = await api<{ enabled: boolean }>("auth/status");
        if (status.enabled) {
          try {
            const current = await refresh();
            if (!current.user.permission) throw new Error("Sign in");
            setLanding(false);
            setGuide(guided);
            setView(guided ? "inspect" : "overview");
            return;
          } catch {
            setAccountMode("login");
            return;
          }
        }
      }
      await api("session", { method: "POST", ...json({ mode }) });
      await refresh();
      setLanding(false);
      setGuide(guided);
      setView(guided ? "inspect" : "overview");
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  function go(next: View) {
    setView(next);
    setMobile(false);
    setAuditRows(null);
  }
  function open(id: string) {
    setSelected(id);
    go("detail");
  }
  async function saveProduct(input: ProductInput) {
    try {
      await api(
        editor === "new" ? "products" : `products/${(editor as Product).id}`,
        { method: editor === "new" ? "POST" : "PUT", ...json(input) },
      );
      await refresh();
      setEditor(null);
      setToast("Product specifications saved.");
    } catch (e) {
      setToast((e as Error).message);
    }
  }
  async function remove(url: string, message: string) {
    if (!window.confirm(message)) return;
    try {
      await api(url, { method: "DELETE" });
      await refresh();
      setToast("Record deleted.");
      go(url.startsWith("products") ? "products" : "history");
    } catch (e) {
      setToast((e as Error).message);
    }
  }
  const inspection = data?.inspections.find((i) => i.id === selected);
  return (
    <>
      {accountMode && (
        <AccountDialog
          mode={accountMode}
          onClose={() => setAccountMode(null)}
          onDone={async () => {
            await refresh();
            setLanding(false);
            setView("overview");
          }}
        />
      )}
      {landing ? (
        <div className="landing">
          <nav className="landing-nav">
            <Brand />
            <div className="landing-links">
              <a href="#workflow">The workflow</a>
              <a href="#capabilities">Capabilities</a>
              <a href="#responsible">Responsible AI</a>
            </div>
            <button
              className="button small"
              disabled={loading}
              onClick={() => enter("operator")}
            >
              Open workspace <ArrowUpRight size={15} />
            </button>
          </nav>
          <main>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span className="live-dot" /> INDUSTRIAL VISUAL QUALITY
                  INTELLIGENCE
                </div>
                <h1>
                  Every label.
                  <br />
                  Every batch.
                  <br />
                  <span>Evidence that matters.</span>
                </h1>
                <p>
                  Turn packaging images into traceable quality checks. Extract
                  printed details, compare approved specifications, and put the
                  final decision in your team’s hands.
                </p>
                <div className="hero-actions">
                  <button
                    className="button primary"
                    disabled={loading}
                    onClick={() => enter("operator", true)}
                  >
                    {loading ? (
                      <LoaderCircle className="spin" size={18} />
                    ) : (
                      <ScanLine size={18} />
                    )}{" "}
                    Try a real inspection <ArrowRight size={17} />
                  </button>
                  <button
                    className="button"
                    disabled={loading}
                    onClick={() => enter("guest")}
                  >
                    Explore as guest
                  </button>
                </div>
                <div className="hero-proof">
                  <span>
                    <Check size={14} /> No API key
                  </span>
                  <span>
                    <Check size={14} /> Local OCR
                  </span>
                  <span>
                    <Check size={14} /> Your evidence stays local
                  </span>
                </div>
              </div>
              <div className="hero-preview">
                <div className="preview-bar">
                  <span className="live-dot" /> LIVE WORKFLOW PREVIEW{" "}
                  <span className="mini-label">SYNTHETIC EXAMPLE</span>
                </div>
                <div className="package-stage">
                  <div className="scan-corner tl" />
                  <div className="scan-corner tr" />
                  <img
                    src="/fixtures/correct.png"
                    alt="Synthetic Aster Oat Drink package label"
                  />
                  <div className="scan-corner bl" />
                  <div className="scan-corner br" />
                  <div className="scan-line" />
                </div>
                <div className="preview-bottom">
                  <div className="square-icon">
                    <ScanLine size={21} />
                  </div>
                  <div>
                    <strong>See the evidence. Own the decision.</strong>
                    <p>Actual OCR runs when you start an inspection.</p>
                  </div>
                </div>
              </div>
            </section>
            <section id="workflow" className="landing-section">
              <div className="section-kicker">FROM IMAGE TO AUDIT TRAIL</div>
              <h2>
                A repeatable check.
                <br />A reviewable decision.
              </h2>
              <div className="walkthrough">
                <div className="walk-tabs">
                  {[
                    "Define the standard",
                    "Inspect the label",
                    "Review & record",
                  ].map((s, i) => (
                    <button
                      key={s}
                      className={walk === i ? "active" : ""}
                      onClick={() => setWalk(i)}
                    >
                      <span>0{i + 1}</span>
                      {s}
                      <ChevronRight size={18} />
                    </button>
                  ))}
                </div>
                <div className="walk-body">
                  <span className="section-kicker">STEP 0{walk + 1}</span>
                  <h3>
                    {
                      [
                        "Your approved specification is the source of truth.",
                        "Real text extraction. Explicit verification rules.",
                        "Human judgment, with the evidence attached.",
                      ][walk]
                    }
                  </h3>
                  <p>
                    {
                      [
                        "Register product identity, batch, dates, quantity and mandatory text. Add a reference image for side-by-side review.",
                        "Tesseract reads image pixels on your workstation. Each expected field is compared with readable evidence; uncertainty is kept visible.",
                        "Inspect the original image, correct transcription, record your decision and print a report. The original machine findings stay in the audit trail.",
                      ][walk]
                    }
                  </p>
                  <button
                    className="text-button"
                    onClick={() => enter("operator", true)}
                  >
                    Run the guided demonstration <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </section>
            <section id="capabilities" className="landing-section">
              <div className="section-kicker">BUILT FOR THE QUALITY DESK</div>
              <h2>More than an image conversation.</h2>
              <div className="feature-grid">
                {[
                  {
                    icon: Layers3,
                    title: "Specifications, not prompts",
                    text: "A registered standard and deterministic checks make results repeatable.",
                  },
                  {
                    icon: Focus,
                    title: "Evidence at every step",
                    text: "Real OCR coordinates, source images and field-level comparisons stay together.",
                  },
                  {
                    icon: ClipboardCheck,
                    title: "Decisions with a history",
                    text: "Human review, correction records and printable reports create a useful inspection trail.",
                  },
                ].map(({ icon: Icon, title, text }) => (
                  <article key={title}>
                    <Icon size={25} />
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </article>
                ))}
              </div>
              <div className="industry-line">
                <span>DESIGNED FOR SME TEAMS</span>
                <strong>Food & beverage</strong>
                <strong>Consumer goods</strong>
                <strong>Packaging operations</strong>
              </div>
            </section>
            <section id="responsible" className="responsible">
              <ShieldCheck size={32} />
              <div>
                <span className="section-kicker">
                  PROTOTYPE. TRANSPARENT BY DESIGN.
                </span>
                <h2>
                  Assistance for people.
                  <br />
                  Not a certification of safety.
                </h2>
                <p>
                  OCR recognizes printed text. Rules compare it. Optional Gemini
                  adds separate visual observations on fictional test data. No
                  single image can establish safety, seal integrity or
                  manufacturing compliance.
                </p>
                <p>
                  Built for International AI Builders Congress 2026 · Idea to
                  Unicorn · IndustrySphere AI / Quality Vision. Subscription by
                  organization, inspection volume or station is a revenue
                  hypothesis; industrial validation and customer traction have
                  not been established.
                </p>
              </div>
            </section>
          </main>
          <footer>
            <Brand />
            <span>
              Local-first hackathon prototype · No mandatory paid services
            </span>
            <button className="text-button" onClick={() => enter("operator")}>
              Enter workspace <ArrowRight size={16} />
            </button>
          </footer>
        </div>
      ) : (
        <div className="app-shell">
          <aside className={`sidebar ${mobile ? "open" : ""}`}>
            <button
              className="brand-button"
              onClick={() => setLanding(true)}
              aria-label="BatchVista home"
            >
              <Brand />
            </button>
            <div className="workspace-label">
              <span className="workspace-icon">B</span>
              <div>
                <strong>Local workspace</strong>
                <small>
                  {data?.user.permission
                    ? "Authenticated station"
                    : "Local demonstration"}
                </small>
              </div>
              <span className="status-dot" />
            </div>
            <div className="nav-caption">WORKSPACE</div>
            <nav>
              {nav.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  className={view === id ? "nav-item active" : "nav-item"}
                  onClick={() => go(id)}
                >
                  <Icon size={19} />
                  {label}
                  {id === "inspect" && <span className="nav-plus">+</span>}
                </button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <div className="local-card">
                <div>
                  <Cpu size={17} />
                  <strong>Local processing</strong>
                  <span className="status-dot" />
                </div>
                <p>
                  Real OCR. No API key required.
                  <br />
                  Your images stay on this device.
                </p>
              </div>
              <button
                className={view === "settings" ? "nav-item active" : "nav-item"}
                onClick={() => go("settings")}
              >
                <Settings2 size={19} /> Settings
              </button>
              <button
                className="nav-item"
                onClick={() => {
                  setGuide(true);
                  go("inspect");
                }}
              >
                <CircleHelp size={19} /> Guided demonstration
              </button>
              <div className="profile">
                <span className="avatar">
                  {data?.user.role === "guest" ? "G" : "LO"}
                </span>
                <div>
                  <strong>{data?.user.name}</strong>
                  <small>
                    {data?.user.role === "guest"
                      ? "Read-only dispositions"
                      : "Local reviewer access"}
                  </small>
                </div>
                <button
                  aria-label="Switch appearance"
                  className="icon-button"
                  onClick={() => setDark(!dark)}
                >
                  {dark ? <Sun size={17} /> : <Moon size={17} />}
                </button>
              </div>
            </div>
          </aside>
          <div className="main-shell">
            <header className="topbar">
              <div>
                <button
                  className="icon-button mobile-menu"
                  aria-label="Toggle navigation"
                  onClick={() => setMobile(!mobile)}
                >
                  <Menu size={20} />
                </button>
                <span className="breadcrumb">
                  Workspace <ChevronRight size={13} />{" "}
                  <strong>
                    {view === "detail"
                      ? "Inspection evidence"
                      : nav.find((n) => n.id === view)?.label || "Settings"}
                  </strong>
                </span>
              </div>
              <div className="topbar-right">
                <span className="local-pill">
                  <span className="status-dot" /> Local mode
                </span>
                <span className="prototype-pill">PROTOTYPE</span>
                <span className="avatar small-avatar">BV</span>
              </div>
            </header>
            <main className="workspace-main">
              {view === "overview" && data && (
                <Dashboard
                  data={data}
                  go={go}
                  open={open}
                  startGuide={() => {
                    setGuide(true);
                    go("inspect");
                  }}
                />
              )}
              {view === "inspect" && data && (
                <Inspect
                  data={data}
                  guided={guide}
                  onComplete={async (id) => {
                    await refresh();
                    setGuide(false);
                    open(id);
                  }}
                  notify={setToast}
                />
              )}
              {view === "products" && data && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="section-kicker">
                        THE APPROVED STANDARD
                      </div>
                      <h1>Product catalog</h1>
                      <p>
                        Define what a correct label should say before you
                        inspect it.
                      </p>
                    </div>
                    <button
                      className="button primary"
                      onClick={() => setEditor("new")}
                    >
                      <Plus size={17} /> Register product
                    </button>
                  </div>
                  <div className="notice">
                    <FlaskConical size={18} />
                    <span>
                      Aster Oat Drink is a fictional starter product. Register
                      your own specifications for local inspection.
                    </span>
                  </div>
                  <div className="product-grid">
                    {data.products.map((p) => (
                      <article className="card product-card" key={p.id}>
                        <div className="product-card-top">
                          {p.referenceId ? (
                            <img
                              src={`/api/images/${p.referenceId}`}
                              alt={`Approved reference for ${p.name}`}
                            />
                          ) : (
                            <Package size={44} />
                          )}
                          <span className="sku">{p.sku}</span>
                        </div>
                        <div className="product-card-body">
                          <h3>{p.name}</h3>
                          <p>
                            {p.variant} · {p.quantity}
                          </p>
                          <dl>
                            <div>
                              <dt>Batch code</dt>
                              <dd>{p.batch}</dd>
                            </div>
                            <div>
                              <dt>Expiry date</dt>
                              <dd>{p.expiry || "Not configured"}</dd>
                            </div>
                            <div>
                              <dt>Mandatory text</dt>
                              <dd>{p.requiredText.length} requirements</dd>
                            </div>
                          </dl>
                          <div className="product-actions">
                            <button
                              className="button small"
                              onClick={() => setEditor(p)}
                            >
                              <SlidersHorizontal size={15} /> Edit
                              specifications
                            </button>
                            <button
                              className="icon-button danger"
                              aria-label={`Delete ${p.name}`}
                              onClick={() =>
                                remove(
                                  `products/${p.id}`,
                                  "Delete this product? Products with inspection records cannot be deleted.",
                                )
                              }
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <label className="reference-upload">
                            <ImagePlus size={15} />{" "}
                            {p.referenceId ? "Replace" : "Add"} approved
                            reference
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const form = new FormData();
                                form.set("image", file);
                                try {
                                  await api(`products/${p.id}/reference`, {
                                    method: "POST",
                                    body: form,
                                  });
                                  await refresh();
                                  setToast("Reference image saved.");
                                } catch (error) {
                                  setToast((error as Error).message);
                                }
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                      </article>
                    ))}
                  </div>
                  {!data.products.length && (
                    <Empty
                      title="Register your first product"
                      action={
                        <button
                          className="button primary"
                          onClick={() => setEditor("new")}
                        >
                          Register product
                        </button>
                      }
                    >
                      A specification gives every inspection a defined standard.
                    </Empty>
                  )}
                </>
              )}
              {view === "batches" && data && (
                <BatchManager
                  products={data.products}
                  batches={data.batches}
                  inspections={data.inspections}
                  onChanged={refresh}
                />
              )}
              {view === "history" && data && (
                <HistoryView data={data} open={open} go={go} />
              )}
              {view === "detail" && inspection && data && (
                <Detail
                  inspection={inspection}
                  role={data.user.role}
                  reviewerName={data.user.name}
                  nextInspection={() => go("inspect")}
                  onSaved={refresh}
                  notify={setToast}
                  onDelete={() =>
                    remove(
                      `inspections/${inspection.id}`,
                      "Delete this inspection, its reviews and uploaded image? A deletion audit event will remain.",
                    )
                  }
                  switchOperator={() => data.user.permission?setAccountMode('login'):enter("operator")}
                />
              )}
              {view === "settings" && data && (
                <>
                  <TeamSettings
                    permission={data.user.permission}
                    onSetup={() => setAccountMode("setup")}
                    onLogout={async () => {
                      await api("auth/logout", { method: "POST", ...json({}) });
                      setData(null);
                      setLanding(true);
                    }}
                  />
                  <div className="page-heading">
                    <div>
                      <div className="section-kicker">YOUR WORKSTATION</div>
                      <h1>Settings</h1>
                      <p>
                        Transparent capabilities and controls for your local
                        workspace.
                      </p>
                    </div>
                  </div>
                  <div className="settings-grid">
                    <section className="card settings-card">
                      <h2>
                        <Sun size={20} /> Appearance
                      </h2>
                      <p>
                        Choose the environment that works for your quality desk.
                      </p>
                      <div className="segmented">
                        <button
                          className={!dark ? "active" : ""}
                          onClick={() => setDark(false)}
                        >
                          <Sun size={16} /> Light
                        </button>
                        <button
                          className={dark ? "active" : ""}
                          onClick={() => setDark(true)}
                        >
                          <Moon size={16} /> Dark
                        </button>
                      </div>
                      <h2>
                        <SlidersHorizontal size={20} /> Product defaults
                      </h2>
                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={defaultVisual}
                          onChange={(e) => {
                            setDefaultVisual(e.target.checked);
                            localStorage.setItem(
                              "bv-visual",
                              String(e.target.checked),
                            );
                          }}
                        />{" "}
                        Require human physical / visual review for new products
                      </label>
                      <p className="muted small">
                        This requirement prevents an automatic PASS
                        recommendation until human review. Existing products are
                        unchanged.
                      </p>
                    </section>
                    <section className="card settings-card">
                      <h2>
                        <Cpu size={20} /> Processing providers
                      </h2>
                      <div className="provider-row">
                        <div>
                          <strong>Tesseract OCR · English</strong>
                          <p>
                            Local learned text recognition + deterministic
                            comparisons
                          </p>
                        </div>
                        <span className="badge green">Ready</span>
                      </div>
                      <div className="provider-row">
                        <div>
                          <strong>Gemini · optional cloud inference</strong>
                          <p>
                            {data.cloudAvailable
                              ? "Configured. Requires consent on each fictional test image."
                              : "Unavailable. No cloud API key is configured."}
                          </p>
                        </div>
                        <span
                          className={`badge ${data.cloudAvailable ? "green" : "gray"}`}
                        >
                          {data.cloudAvailable ? "Opt-in" : "Off"}
                        </span>
                      </div>
                      <p className="small muted">
                        Server environment only: GEMINI_API_KEY, GEMINI_MODEL
                        and GEMINI_FREE_TIER_ACK. Never use a billing-enabled
                        project. The application cannot independently verify
                        billing status.
                      </p>
                    </section>
                    <section className="card settings-card">
                      <h2>
                        <ShieldCheck size={20} /> Data & access
                      </h2>
                      <p>
                        Images, specifications and review history are stored in
                        SQLite and private files on this computer. No
                        third-party request runs in the default workflow.
                      </p>
                      <p>
                        Default demo access is local-only. Named accounts
                        protect shared phone stations when HTTPS is configured.
                        Guest sessions are isolated and cannot confirm
                        decisions. Account names are local credentials, not
                        externally verified corporate identities.
                      </p>
                      <button
                        className="button small"
                        onClick={() =>
                          enter(
                            data.user.role === "guest" ? "operator" : "guest",
                          )
                        }
                      >
                        Open{" "}
                        {data.user.role === "guest"
                          ? "local operator"
                          : "isolated guest"}{" "}
                        workspace
                      </button>
                      <p className="small muted">
                        Delete individual inspections from their evidence page.
                        To reset the workstation, stop the server and run the
                        documented backup-preserving reset command.
                      </p>
                    </section>
                    <section className="card settings-card">
                      <h2>
                        <History size={20} /> Audit history
                      </h2>
                      <p>
                        Product edits, inspections, decisions and deletions are
                        recorded locally.
                      </p>
                      <button
                        className="button small"
                        onClick={async () => {
                          try {
                            setAuditRows(await api("audit"));
                          } catch (e) {
                            setToast((e as Error).message);
                          }
                        }}
                      >
                        Load audit trail
                      </button>
                      {auditRows && (
                        <div className="audit-list">
                          {auditRows.length ? (
                            auditRows.map((row, i) => (
                              <div key={i}>
                                <strong>{row.action}</strong>
                                <small>
                                  {when(row.created_at)} ·{" "}
                                  {row.resource_id.slice(0, 8)}
                                </small>
                              </div>
                            ))
                          ) : (
                            <p>No audit events yet.</p>
                          )}
                        </div>
                      )}
                    </section>
                  </div>
                </>
              )}
            </main>
            <div className="workspace-footer">
              <span>
                <ShieldCheck size={13} /> Human-reviewed quality intelligence
              </span>
              <span>BatchVista AI · Prototype v0.1</span>
            </div>
          </div>
        </div>
      )}
      {editor && (
        <ProductEditor
          initial={
            editor === "new"
              ? {
                  ...sampleProduct,
                  name: "",
                  sku: "",
                  batch: "",
                  variant: "",
                  quantity: "",
                  manufactured: "",
                  expiry: "",
                  requiredText: [],
                  visualRequired: defaultVisual,
                }
              : editor
          }
          onClose={() => setEditor(null)}
          onSave={saveProduct}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <CircleHelp size={19} />
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}

function Dashboard({
  data,
  go,
  open,
  startGuide,
}: {
  data: Data;
  go: (v: View) => void;
  open: (id: string) => void;
  startGuide: () => void;
}) {
  const all = data.inspections,
    accepted = all.filter((i) => i.finalStatus === "ACCEPTED").length,
    rejected = all.filter((i) => i.finalStatus === "REJECTED").length,
    pending = all.filter(
      (i) => !i.finalStatus || i.finalStatus === "HOLD",
    ).length;
  const counts = new Map<string, number>();
  for (const i of all)
    for (const c of i.analysis.comparisons)
      if (c.status === "mismatch")
        counts.set(c.field, (counts.get(c.field) || 0) + 1);
  const chart = Array.from(counts, ([name, count]) => ({ name, count }));
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="section-kicker">
            YOUR QUALITY OPERATIONS, IN FOCUS
          </div>
          <h1>
            Inspection overview<span className="heading-dot">.</span>
          </h1>
          <p>A clear view of your products, findings and review queue.</p>
        </div>
        <button className="button primary" onClick={() => go("inspect")}>
          <Plus size={18} /> New inspection
        </button>
      </div>
      <div className="demo-banner">
        <div className="demo-symbol">
          <FlaskConical size={23} />
        </div>
        <div>
          <strong>A real workflow. A fictional product.</strong>
          <p>
            Inspect our synthetic labels to see local OCR and evidence-based
            checks in action.
          </p>
        </div>
        <button className="button small" onClick={startGuide}>
          Launch guided demo <ArrowRight size={16} />
        </button>
      </div>
      <div className="stats-grid">
        {[
          {
            label: "Total inspections",
            value: all.length,
            icon: ScanLine,
            tone: "blue",
            sub: "Saved in this workspace",
          },
          {
            label: "Accepted",
            value: accepted,
            icon: CheckCircle2,
            tone: "green",
            sub: "Confirmed by a human reviewer",
          },
          {
            label: "Rejected",
            value: rejected,
            icon: XCircle,
            tone: "red",
            sub: "Confirmed by a human reviewer",
          },
          {
            label: "Awaiting review",
            value: pending,
            icon: Clock3,
            tone: "amber",
            sub: "Includes inspections on hold",
          },
        ].map(({ label, value, icon: Icon, tone, sub }) => (
          <div className="card stat" key={label}>
            <div>
              <span>{label}</span>
              <Icon className={tone} size={19} />
            </div>
            <strong>{value.toString().padStart(2, "0")}</strong>
            <small>{sub}</small>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="card recent-card">
          <div className="card-heading">
            <div>
              <h2>Recent inspections</h2>
              <p>Your latest evidence and decisions</p>
            </div>
            <button className="text-button" onClick={() => go("history")}>
              View all <ArrowUpRight size={15} />
            </button>
          </div>
          {all.length ? (
            <InspectionTable inspections={all.slice(0, 5)} open={open} />
          ) : (
            <Empty
              title="Your next inspection starts here"
              action={
                <button className="button small" onClick={() => go("inspect")}>
                  <ScanLine size={16} /> Inspect a label
                </button>
              }
            >
              Upload a package image or choose a synthetic example.
              <br />
              Findings will appear here after real processing.
            </Empty>
          )}
        </section>
        <section className="card distribution">
          <div className="card-heading">
            <div>
              <h2>Mismatch categories</h2>
              <p>Machine findings from saved inspections</p>
            </div>
            <Activity size={18} />
          </div>
          {chart.length ? (
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={chart}
                  layout="vertical"
                  margin={{ left: 15, right: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={90}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    name="Findings"
                    fill="#10a89b"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="no-chart">
              <div className="chart-placeholder">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <strong>No mismatch data yet</strong>
              <p>
                Only actual saved findings are counted.
                <br />
                Missing OCR evidence is not a defect count.
              </p>
            </div>
          )}
        </section>
      </div>
      <div className="dashboard-bottom">
        <section className="card">
          <div className="card-heading">
            <div>
              <h2>Registered products</h2>
              <p>Standards ready for inspection</p>
            </div>
            <button className="text-button" onClick={() => go("products")}>
              Manage <ArrowUpRight size={15} />
            </button>
          </div>
          {data.products.map((p) => (
            <button
              key={p.id}
              className="product-summary"
              onClick={() => go("products")}
            >
              <span className="product-icon">
                <Package size={21} />
              </span>
              <span>
                <strong>{p.name}</strong>
                <small>
                  {p.sku} · {p.variant}
                </small>
              </span>
              <span className="product-count">
                {all.filter((i) => i.productId === p.id).length} inspections
              </span>
              <ChevronRight size={16} />
            </button>
          ))}
        </section>
        <section className="capability-card">
          <div className="capability-icon">
            <Cpu size={24} />
          </div>
          <h2>
            Powered locally.
            <br />
            Reviewed by you.
          </h2>
          <p>
            Text recognition is active. Physical damage detection and compliance
            certification are not supported.
          </p>
          <div>
            <span className="status-dot" /> Tesseract OCR + verification rules
          </div>
        </section>
      </div>
    </>
  );
}

function InspectionTable({
  inspections,
  open,
}: {
  inspections: Inspection[];
  open: (id: string) => void;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Product / inspection</th>
            <th>Machine finding</th>
            <th>Human disposition</th>
            <th>Inspected</th>
            <th>
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {inspections.map((i) => (
            <tr key={i.id}>
              <td>
                <button className="table-link" onClick={() => open(i.id)}>
                  {i.product.name}
                </button>
                <small className="mono">
                  {i.id.slice(0, 8).toUpperCase()} · {i.product.sku}
                </small>
              </td>
              <td>
                <Badge value={i.analysis.recommendation} />
              </td>
              <td>
                {i.finalStatus ? (
                  <Badge value={i.finalStatus} />
                ) : (
                  <span className="muted">Awaiting review</span>
                )}
              </td>
              <td className="muted small">{when(i.createdAt)}</td>
              <td>
                <button
                  className="icon-button"
                  aria-label={`Open inspection ${i.id.slice(0, 8)}`}
                  onClick={() => open(i.id)}
                >
                  <ArrowUpRight size={17} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryView({
  data,
  open,
  go,
}: {
  data: Data;
  open: (id: string) => void;
  go: (v: View) => void;
}) {
  const [search, setSearch] = useState(""),
    [product, setProduct] = useState(""),
    [status, setStatus] = useState(""),
    [sort, setSort] = useState("new");
  const results = data.inspections
    .filter(
      (i) =>
        (!product || i.productId === product) &&
        (!status ||
          (status === "pending" ? !i.finalStatus : i.finalStatus === status)) &&
        `${i.product.name} ${i.product.sku} ${i.id} ${i.product.batch}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "new"
        ? b.createdAt.localeCompare(a.createdAt)
        : a.createdAt.localeCompare(b.createdAt),
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="section-kicker">EVERY CHECK, ACCOUNTED FOR</div>
          <h1>Inspection history</h1>
          <p>Search saved evidence, machine findings and human decisions.</p>
        </div>
        <button className="button primary" onClick={() => go("inspect")}>
          <Plus size={17} /> New inspection
        </button>
      </div>
      <div className="filter-bar">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Search inspections"
            placeholder="Search product, batch or inspection…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter by product"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
        >
          <option value="">All products</option>
          {data.products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by disposition"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All dispositions</option>
          <option value="pending">Awaiting review</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="REJECTED">Rejected</option>
          <option value="HOLD">On hold</option>
        </select>
        <select
          aria-label="Sort by date"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="new">Newest first</option>
          <option value="old">Oldest first</option>
        </select>
      </div>
      <section className="card">
        <div className="card-heading">
          <h2>
            Saved inspections <span className="count">{results.length}</span>
          </h2>
          <span className="small muted">Local records</span>
        </div>
        {results.length ? (
          <InspectionTable inspections={results} open={open} />
        ) : (
          <Empty title="No matching inspections">
            Run an inspection or adjust your filters.
          </Empty>
        )}
      </section>
    </>
  );
}

function ProductEditor({
  initial,
  onClose,
  onSave,
}: {
  initial: ProductInput;
  onClose: () => void;
  onSave: (p: ProductInput) => Promise<void>;
}) {
  const [form, setForm] = useState(initial),
    [text, setText] = useState(initial.requiredText.join("\n")),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const result = productSchema.safeParse({
      ...form,
      requiredText: text
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    if (!result.success) {
      setError(result.error.issues.map((i) => i.message).join("; "));
      return;
    }
    setSaving(true);
    await onSave(result.data);
    setSaving(false);
  }
  return (
    <dialog ref={ref} className="modal" onCancel={onClose}>
      <form onSubmit={submit}>
        <div className="modal-heading">
          <div>
            <div className="section-kicker">APPROVED SPECIFICATIONS</div>
            <h2>{initial.name ? "Edit product" : "Register product"}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close product editor"
          >
            <X size={20} />
          </button>
        </div>
        <p className="muted">
          Use exact label values. Dates use YYYY-MM-DD; ambiguous formats need
          review.
        </p>
        <div className="form-grid">
          {(
            [
              "name",
              "sku",
              "variant",
              "batch",
              "manufactured",
              "expiry",
              "quantity",
            ] as const
          ).map((key) => (
            <label key={key}>
              {key === "sku" ? "SKU" : labels[key]}
              <input
                required={["name", "sku", "batch", "quantity"].includes(key)}
                type={
                  ["manufactured", "expiry"].includes(key) ? "date" : "text"
                }
                value={form[key]}
                maxLength={120}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <label>
          Mandatory label text{" "}
          <span className="muted">(one phrase per line)</span>
          <textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={form.visualRequired}
            onChange={(e) =>
              setForm({ ...form, visualRequired: e.target.checked })
            }
          />{" "}
          Require human physical / visual inspection
        </label>
        {error && (
          <div className="inline-error" role="alert">
            {error}
          </div>
        )}
        <div className="modal-actions">
          <button className="button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={saving}>
            {saving ? "Saving…" : "Save specifications"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function Inspect({
  data,
  guided,
  onComplete,
  notify,
}: {
  data: Data;
  guided: boolean;
  onComplete: (id: string) => Promise<void>;
  notify: (s: string) => void;
}) {
  const [productId, setProductId] = useState(
    (guided
      ? data.products.find((p) => p.sku === "AST-OAT-250")?.id
      : undefined) ||
      data.inspections[0]?.productId ||
      data.products[0]?.id ||
      "",
  );
  const [file, setFile] = useState<File | null>(null);
  const [batchId, setBatchId] = useState(
    data.inspections[0]?.batchSnapshot?.id || "",
  );
  const availableBatches = data.batches.filter(
    (b) => b.productId === productId && b.status === "OPEN",
  );
  const selectedBatch =
    availableBatches.find((b) => b.id === batchId) || availableBatches[0];
  const [compare, setCompare] = useState(false);
  const [preview, setPreview] = useState("");
  const [fixture, setFixture] = useState("");
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [cloud, setCloud] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const timer = setTimeout(() => setPreview(url), 0);
    return () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
    };
  }, [file]);
  useEffect(() => {
    if (running) {
      const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
      return () => clearInterval(timer);
    }
  }, [running]);
  function choose(file: File) {
    setError("");
    setFixture("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Choose a PNG, JPEG or WebP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image exceeds the 10 MB limit.");
      return;
    }
    setFile(file);
  }
  async function loadFixture(id: string) {
    try {
      const r = await fetch(`/fixtures/${id}.png`);
      if (!r.ok) throw new Error("Fixtures are missing. Run npm run fixtures.");
      const blob = await r.blob();
      choose(new File([blob], `${id}-synthetic.png`, { type: "image/png" }));
      setFixture(id);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function run() {
    if (!file || !productId) return;
    setSeconds(0);
    setRunning(true);
    setError("");
    const form = new FormData();
    form.set("image", file);
    form.set("productId", productId);
    if (selectedBatch) form.set("batchId", selectedBatch.id);
    form.set("compareReference", String(compare));
    form.set("cloud", String(cloud));
    form.set("fictionalConsent", String(consent));
    try {
      const inspection = await api<Inspection>("inspections", {
        method: "POST",
        body: form,
      });
      await onComplete(inspection.id);
      notify(
        "Inspection saved. Review the evidence before confirming a disposition.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }
  const registered = data.products.find((p) => p.id === productId);
  const product =
    registered && selectedBatch
      ? {
          ...registered,
          batch: selectedBatch.code,
          manufactured: selectedBatch.manufactured,
          expiry: selectedBatch.expiry,
        }
      : registered;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="section-kicker">FROM PIXELS TO EVIDENCE</div>
          <h1>New inspection</h1>
          <p>
            Compare a real package image against your approved specification.
          </p>
        </div>
        <span className="local-pill">
          <Cpu size={15} /> Real local OCR
        </span>
      </div>
      {guided && (
        <div className="guide-steps">
          {[
            "Select product",
            "Choose image",
            "Run OCR",
            "Review evidence",
            "Confirm decision",
            "Print report",
          ].map((s, i) => (
            <span key={s} className={i < 2 ? "active" : ""}>
              <b>{i + 1}</b>
              {s}
            </span>
          ))}
        </div>
      )}
      <div className="inspection-layout">
        <div>
          <section className="card inspection-section">
            <div className="card-heading">
              <h2>
                <span className="step-number">1</span> Select the approved
                product
              </h2>
            </div>
            <div className="card-body">
              <label>
                Product specification
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  disabled={running}
                >
                  <option value="" disabled>
                    Choose a product
                  </option>
                  {data.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.sku}
                    </option>
                  ))}
                </select>
              </label>
              {product && (
                <div className="spec-strip">
                  <div>
                    <span>EXPECTED BATCH</span>
                    <strong>{product.batch}</strong>
                  </div>
                  <div>
                    <span>EXPIRY DATE</span>
                    <strong>{product.expiry || "Not required"}</strong>
                  </div>
                  <div>
                    <span>NET QUANTITY</span>
                    <strong>{product.quantity}</strong>
                  </div>
                </div>
              )}
              <label className="batch-selector">
                Production batch
                <select
                  aria-label="Production batch"
                  disabled={running}
                  value={selectedBatch?.id || ""}
                  onChange={(e) => setBatchId(e.target.value)}
                >
                  <option value="" disabled>
                    No open batch — create one in Batch stations
                  </option>
                  {availableBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} · expires {b.expiry || "not specified"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
          <section className="card inspection-section">
            <div className="card-heading">
              <h2>
                <span className="step-number">2</span> Add a package image
              </h2>
              <span className="small muted">PNG, JPG, WebP · 10 MB max</span>
            </div>
            <div className="card-body">
              <CameraCapture onCapture={choose} disabled={running} />
              {preview ? (
                <div className="upload-preview">
                  <img src={preview} alt="Selected package image" />
                  <div>
                    <span>{file?.name}</span>
                    <button
                      className="button small"
                      disabled={running}
                      onClick={() => {
                        setFile(null);
                        setPreview("");
                        setFixture("");
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <label
                  className="dropzone"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) choose(file);
                  }}
                >
                  <span className="upload-icon">
                    <Upload size={27} />
                  </span>
                  <strong>Drop your package image here</strong>
                  <span>or click to browse files</span>
                  <small>
                    Use a well-lit, in-focus photograph of the complete label.
                  </small>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    aria-label="Upload package image"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) choose(file);
                    }}
                  />
                </label>
              )}
              {file && (
                <QualityPreview
                  key={`${file.name}-${file.lastModified}`}
                  file={file}
                />
              )}
              <label className="camera-control">
                <ImagePlus size={16} /> Capture with device camera
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={running}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) choose(file);
                  }}
                />
              </label>
              <div className="fixture-heading">
                <span>OR TRY A SYNTHETIC TEST LABEL</span>
                <FlaskConical size={14} />
              </div>
              <div className="fixture-grid">
                {fixtureOptions.map((f) => (
                  <button
                    key={f.id}
                    disabled={running}
                    className={`fixture-option ${fixture === f.id ? "selected" : ""}`}
                    onClick={() => loadFixture(f.id)}
                  >
                    <span className={`fixture-dot ${f.tone}`} />
                    <strong>{f.label}</strong>
                    <small>{f.hint}</small>
                  </button>
                ))}
              </div>
              <p className="small muted">
                Fictional Aster Oat Drink labels. Each image goes through the
                same OCR pipeline as your uploads.
              </p>
            </div>
          </section>
        </div>
        <aside>
          <section className="card run-card">
            <div className="card-heading">
              <h2>Inspection plan</h2>
              <ShieldCheck size={19} />
            </div>
            <div className="card-body">
              <div className="plan-item">
                <CheckCircle2 size={19} />
                <div>
                  <strong>Text recognition</strong>
                  <p>Tesseract reads the actual image locally.</p>
                </div>
              </div>
              <div className="plan-item">
                <CheckCircle2 size={19} />
                <div>
                  <strong>Specification checks</strong>
                  <p>Exact normalized comparisons with evidence.</p>
                </div>
              </div>
              <div className="plan-item muted">
                <CircleHelp size={19} />
                <div>
                  <strong>Physical defect detection</strong>
                  <p>Not supported. Requires human assessment.</p>
                </div>
              </div>
              <div className="provider-opt">
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={compare}
                    onChange={(e) => setCompare(e.target.checked)}
                    disabled={!product?.referenceId || running}
                  />{" "}
                  Compare approved reference locally (experimental)
                </label>
                <p className="small muted">
                  Same complete label, framing and orientation required. Pixel
                  differences are review hints, not classified defects. Add a
                  reference in Product catalog to enable.
                </p>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={cloud}
                    disabled={!data.cloudAvailable || running}
                    onChange={(e) => setCloud(e.target.checked)}
                  />{" "}
                  Add optional Gemini observations
                </label>
                <small>
                  {data.cloudAvailable
                    ? "Cloud inference is separate from local verification."
                    : "Unavailable without server-side free-tier configuration."}
                </small>
                {cloud && (
                  <label className="check-label consent">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />{" "}
                    This is fictional, non-sensitive test data. I consent to
                    sending this image to Google Gemini, whose free-tier terms
                    may allow use to improve products.
                  </label>
                )}
              </div>
              {error && (
                <div className="inline-error" role="alert">
                  {error}
                </div>
              )}
              <button
                className="button primary run-button"
                disabled={
                  !file ||
                  !productId ||
                  !selectedBatch ||
                  running ||
                  (cloud && !consent)
                }
                onClick={run}
              >
                {running ? (
                  <LoaderCircle size={18} className="spin" />
                ) : (
                  <ScanLine size={18} />
                )}{" "}
                {running ? "Reading image…" : "Run inspection"}{" "}
                {!running && <ArrowRight size={17} />}
              </button>
              {running && (
                <div className="processing" role="status">
                  <div className="indeterminate" />
                  <p>
                    Local OCR in progress · {seconds}s<br />
                    Processing can take up to 90 seconds.
                  </p>
                </div>
              )}
              <p className="run-note">
                <ShieldCheck size={13} />{" "}
                {cloud
                  ? "Only this consented image is sent to Gemini."
                  : "No image is sent to a third-party service."}
              </p>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

function Detail({
  inspection: i,
  role,
  onSaved,
  notify,
  onDelete,
  switchOperator,
  reviewerName,
  nextInspection,
}: {
  inspection: Inspection;
  role: User["role"];
  onSaved: () => Promise<unknown>;
  notify: (s: string) => void;
  onDelete: () => void;
  switchOperator: () => void;
  reviewerName: string;
  nextInspection: () => void;
}) {
  const [tab, setTab] = useState<"image" | "reference" | "text">("image");
  const [highlight, setHighlight] = useState(true);
  const [corrections, setCorrections] = useState<
    Partial<Record<Field, string>>
  >({});
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState<Decision>("HOLD");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState(false);
  async function review(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api(`inspections/${i.id}/review`, {
        method: "POST",
        ...json({ decision, note, corrections }),
      });
      await onSaved();
      setNote("");
      setCorrections({});
      notify("Human decision recorded with an audit entry.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const latest = i.reviews.at(-1);
  const analysis = latest?.analysis || i.analysis;
  function download() {
    const blob = new Blob([JSON.stringify(i, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `batchvista-${i.id.slice(0, 8)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className={report ? "report-mode" : ""}>
      <div className="page-heading no-print">
        <div>
          <div className="section-kicker">
            INSPECTION / {i.id.slice(0, 8).toUpperCase()}
          </div>
          <h1>{report ? "Inspection report" : "Evidence & review"}</h1>
          <p>
            {i.product.name} · {i.product.sku} · {when(i.createdAt)}
          </p>
        </div>
        <div className="heading-actions">
          <button className="button" onClick={nextInspection}>
            Inspect next package
          </button>
          <button className="button" onClick={() => setReport(!report)}>
            <FileText size={17} />
            {report ? "Back to evidence" : "Open report"}
          </button>
          {report ? (
            <button className="button primary" onClick={() => window.print()}>
              <ArrowDownToLine size={17} /> Print / Save PDF
            </button>
          ) : (
            <button className="button small" onClick={download}>
              <ArrowDownToLine size={16} /> Export JSON
            </button>
          )}
        </div>
      </div>
      {report && (
        <section className="report-header">
          <Brand />
          <h1>Inspection report</h1>
          <p>
            Industrial Visual Quality Intelligence · Local workstation prototype
          </p>
          <dl>
            <div>
              <dt>Inspection ID</dt>
              <dd className="mono">{i.id}</dd>
            </div>
            <div>
              <dt>Product / SKU</dt>
              <dd>
                {i.product.name} / {i.product.sku}
              </dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{new Date(i.createdAt).toISOString()}</dd>
            </div>
            <div>
              <dt>Processing method</dt>
              <dd>{i.processingMethod}</dd>
            </div>
            <div>
              <dt>Final human decision</dt>
              <dd>{i.finalStatus || "NOT YET REVIEWED"}</dd>
            </div>
          </dl>
        </section>
      )}
      <div className="finding-summary">
        <div
          className={`finding-icon ${i.analysis.recommendation === "PASS" ? "green" : i.analysis.recommendation === "FAIL" ? "red" : "amber"}`}
        >
          {i.analysis.recommendation === "PASS" ? <CheckCircle2 /> : <Focus />}
        </div>
        <div>
          <strong>
            {i.analysis.recommendation === "PASS"
              ? "Supported label checks passed"
              : i.analysis.recommendation === "FAIL"
                ? "A readable specification mismatch was found"
                : "This image needs closer review"}
          </strong>
          <p>
            Original machine recommendation: <b>{i.analysis.recommendation}</b>.
            This is not a safety or compliance certification.
          </p>
        </div>
        <div>
          {i.finalStatus ? (
            <Badge value={i.finalStatus} />
          ) : (
            <span className="badge amber">Awaiting human review</span>
          )}
        </div>
      </div>
      <div className="evidence-layout">
        <section className="card evidence-card">
          <div className="evidence-tabs no-print">
            {(["image", "reference", "text"] as const).map((t) => (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {t === "image"
                  ? "Inspection image"
                  : t === "reference"
                    ? "Approved reference"
                    : "OCR text"}
              </button>
            ))}
          </div>
          {tab === "text" && !report ? (
            <pre className="ocr-text">
              {i.ocr.text || "No readable text extracted."}
            </pre>
          ) : tab === "reference" && !report ? (
            i.product.referenceId ? (
              <div className="image-canvas">
                <img
                  src={`/api/images/${i.product.referenceId}`}
                  alt="Approved reference at inspection time"
                />
              </div>
            ) : (
              <Empty title="No reference image registered">
                Add an approved reference to the product for future inspections.
              </Empty>
            )
          ) : (
            <>
              <div className="image-canvas">
                <div className="evidence-image">
                  <img
                    src={`/api/images/${i.imageId}`}
                    alt="Normalized original inspection image"
                  />
                  {highlight && (
                    <svg
                      viewBox={`0 0 ${i.ocr.width} ${i.ocr.height}`}
                      aria-label="Actual OCR word coordinates"
                      className="evidence-boxes"
                    >
                      {i.ocr.words.map((w, n) => (
                        <rect
                          key={n}
                          x={w.bbox.x0}
                          y={w.bbox.y0}
                          width={w.bbox.x1 - w.bbox.x0}
                          height={w.bbox.y1 - w.bbox.y0}
                        >
                          <title>
                            {w.text} · OCR recognition score{" "}
                            {w.confidence.toFixed(0)}
                          </title>
                        </rect>
                      ))}
                    </svg>
                  )}
                </div>
              </div>
              <div className="image-toolbar no-print">
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={highlight}
                    onChange={(e) => setHighlight(e.target.checked)}
                  />{" "}
                  Actual OCR word boxes
                </label>
                <span>
                  {i.ocr.width} × {i.ocr.height}px
                </span>
              </div>
            </>
          )}
          {report && (
            <>
              <h3 className="report-subheading">Original OCR text</h3>
              <pre className="ocr-text">
                {i.ocr.text || "No readable text extracted."}
              </pre>
            </>
          )}
        </section>
        <section className="card comparisons-card">
          <div className="card-heading">
            <div>
              <h2>Specification comparison</h2>
              <p>
                {latest
                  ? "Latest reviewed transcription"
                  : "Original OCR evidence"}{" "}
                · {analysis.comparisons.length} checks
              </p>
            </div>
            <ClipboardCheck size={19} />
          </div>
          <div className="comparison-list">
            {analysis.comparisons.map((c, n) => (
              <div className="comparison" key={`${c.field}-${n}`}>
                <div>
                  <strong>{c.field}</strong>
                  <Badge value={c.status} />
                </div>
                <dl>
                  <div>
                    <dt>Expected</dt>
                    <dd>{c.expected}</dd>
                  </div>
                  <div>
                    <dt>Observed</dt>
                    <dd>{c.observed || "Not reliably readable"}</dd>
                  </div>
                </dl>
                <p className="evidence-quote">
                  {c.source === "human" ? "Human correction" : "OCR evidence"}:{" "}
                  {c.evidence}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
      {(i.analysis.uncertaintyNotes.length > 0 || i.cloudError) && (
        <div className="notice warning">
          <CircleHelp size={20} />
          <div>
            <strong>Uncertainty is part of the record</strong>
            {i.analysis.uncertaintyNotes.map((n, index) => (
              <p key={index}>{n}</p>
            ))}
            {i.cloudError && <p>{i.cloudError}</p>}
          </div>
        </div>
      )}
      {i.cloud && (
        <section className="card cloud-observations">
          <h2>Optional AI observations · {i.cloud.model}</h2>
          <p className="muted">
            Generative inference, separate from OCR and deterministic checks.
            These observations do not determine the recommendation.
          </p>
          {i.cloud.observations.map((o, n) => (
            <div key={n}>
              <strong>
                {o.category}: {o.description}
              </strong>
              <p>Evidence: {o.evidence}</p>
            </div>
          ))}
          {i.cloud.uncertaintyNotes.map((n, j) => (
            <p key={j}>{n}</p>
          ))}
        </section>
      )}
      {i.batchSnapshot && (
        <div className="notice">
          Production batch: {i.batchSnapshot.code} · snapshot{" "}
          {i.batchSnapshot.id}
        </div>
      )}
      {i.stationEvidence && (
        <StationEvidenceView evidence={i.stationEvidence} imageId={i.imageId} />
      )}
      {!report && (
        <section className="card review-card no-print">
          <div className="card-heading">
            <div>
              <h2>Human quality-control review</h2>
              <p>
                The machine recommends. An operator confirms the disposition.
              </p>
            </div>
            <ShieldCheck size={21} />
          </div>
          {role === "guest" ? (
            <div className="card-body">
              <p>
                This account cannot confirm decisions. Sign in as a reviewer or administrator. Demo guest records remain separate from the operator workspace.
              </p>
              <button className="button" onClick={switchOperator}>
                Open reviewer workspace
              </button>
            </div>
          ) : (
            <form className="card-body" onSubmit={review}>
              <details>
                <summary>
                  Correct a transcription{" "}
                  <span className="muted">
                    · original OCR is always preserved
                  </span>
                </summary>
                <div className="form-grid correction-grid">
                  {fields.map((field) => (
                    <label key={field}>
                      {labels[field]}
                      <input
                        placeholder="Leave unchanged"
                        value={corrections[field] || ""}
                        maxLength={160}
                        onChange={(e) =>
                          setCorrections((previous) => {
                            const next = { ...previous };
                            if (e.target.value) next[field] = e.target.value;
                            else delete next[field];
                            return next;
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              </details>
              <div className="review-form-grid">
                <label>
                  Final disposition
                  <select
                    value={decision}
                    onChange={(e) => setDecision(e.target.value as Decision)}
                  >
                    <option value="HOLD">Hold for further review</option>
                    <option value="ACCEPTED">Accept after human review</option>
                    <option value="REJECTED">Reject</option>
                  </select>
                </label>
                <label>
                  Review rationale <span className="muted">(required)</span>
                  <textarea
                    minLength={8}
                    maxLength={2000}
                    required
                    placeholder="Record what you checked and why you made this decision…"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
              </div>
              <p className="small muted">
                Reviewer: {reviewerName}. Acceptance can override machine
                findings; explain the evidence in your rationale. This prototype
                does not verify corporate reviewer identity.
              </p>
              {error && (
                <div className="inline-error" role="alert">
                  {error}
                </div>
              )}
              <button className="button primary" disabled={saving}>
                {saving ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <ClipboardCheck size={17} />
                )}{" "}
                Confirm human decision
              </button>
            </form>
          )}
        </section>
      )}
      <section className="card audit-card">
        <div className="card-heading">
          <h2>Review audit trail</h2>
          <span className="small muted">
            {i.reviews.length} decisions recorded
          </span>
        </div>
        <div className="card-body">
          <div className="audit-event">
            <span className="timeline-dot" />
            <div>
              <strong>
                Original machine recommendation: {i.analysis.recommendation}
              </strong>
              <p>
                {when(i.createdAt)} · {i.processingMethod}
              </p>
            </div>
          </div>
          {i.reviews.map((r) => (
            <div className="audit-event" key={r.id}>
              <span className="timeline-dot" />
              <div>
                <strong>
                  {r.reviewer} · {r.decision}
                </strong>
                <p>
                  {when(r.createdAt)} · {r.note}
                </p>
                {Object.entries(r.corrections).map(([f, v]) => (
                  <p key={f} className="mono">
                    Corrected {labels[f as Field]}: {v}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <div className="limitations">
        <ShieldCheck size={17} />
        <p>
          <strong>Inspection limitations.</strong> English printed-text OCR
          only. A mismatch is a recommendation, not a final disposition.
          Unreadable text is not proof of a missing label. Physical damage, seal
          integrity, counterfeit detection, regulatory compliance and package
          safety are not verified. Reference images support human comparison
          only. Uploaded images are orientation-corrected and metadata-stripped.
        </p>
      </div>
      <div className="no-print detail-footer">
        <button className="text-button danger" onClick={onDelete}>
          <Trash2 size={15} /> Delete inspection & image
        </button>
        <span className="small muted">Saved locally · {i.id}</span>
      </div>
    </div>
  );
}
