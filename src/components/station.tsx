"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, CheckCircle2, ScanLine, Users, X } from "lucide-react";
import type {
  Batch,
  CaptureQuality,
  StationEvidence,
} from "@/lib/station-types";
import type { Product, Inspection } from "@/lib/domain";

async function request<T>(
  route: string,
  body?: unknown,
  method = "POST",
): Promise<T> {
  const r = await fetch(
    `/api/${route}`,
    body === undefined
      ? {}
      : {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Request failed");
  return data;
}
export function AccountDialog({
  mode,
  onClose,
  onDone,
}: {
  mode: "login" | "setup";
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError("");
    try {
      await request(`auth/${mode}`, values);
      await onDone();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog className="modal" ref={ref} onCancel={onClose}>
      <div className="modal-heading">
        <h2>
          {mode === "setup"
            ? "Secure this workstation"
            : "Sign in to BatchVista"}
        </h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close account dialog"
        >
          <X />
        </button>
      </div>
      <p>
        {mode === "setup"
          ? "Create the first administrator on this computer. This disables anonymous operator access and revokes existing operator sessions. Existing records are retained."
          : "Use the account created by your workstation administrator. No cloud account is needed."}
      </p>
      <form onSubmit={submit}>
        {mode === "setup" && (
          <label>
            Your name
            <input name="name" required minLength={2} autoComplete="name" />
          </label>
        )}
        <label>
          Username
          <input
            name="username"
            required
            minLength={3}
            maxLength={50}
            pattern="[a-z0-9_.-]+"
            autoComplete="username"
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            required
            minLength={12}
            maxLength={128}
            autoComplete={
              mode === "setup" ? "new-password" : "current-password"
            }
          />
        </label>
        <p className="small muted">
          Use at least 12 characters. Usernames use lowercase letters, numbers,
          dots, underscores or hyphens.
        </p>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          {busy
            ? "Please wait…"
            : mode === "setup"
              ? "Create administrator"
              : "Sign in"}
        </button>
      </form>
    </dialog>
  );
}
export function TeamSettings({
  permission,
  onSetup,
  onLogout,
}: {
  permission?: string;
  onSetup: () => void;
  onLogout: () => Promise<void>;
}) {
  const [rows, setRows] = useState<
      { username: string; name: string; permission: string }[]
    >([]),
    [message, setMessage] = useState("");
  async function load() {
    try {
      setRows(await request("auth/users"));
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      await request("auth/users", Object.fromEntries(new FormData(form)));
      form.reset();
      setMessage(
        "Named account created. Share its credentials privately with that person.",
      );
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <section className="card settings-card">
      <h2>
        <Users size={20} /> Team & phone access
      </h2>
      <p>
        {permission
          ? `Signed-in permission: ${permission}. Reviewer names are attached to decisions.`
          : "Local demo access is active. Create an administrator before connecting phones."}
      </p>
      {!permission ? (
        <button className="button" onClick={onSetup}>
          Set up named accounts
        </button>
      ) : (
        <button className="button" onClick={onLogout}>
          Sign out
        </button>
      )}
      {permission === "admin" && (
        <>
          <form className="team-form" onSubmit={add}>
            <label>
              Staff name
              <input name="name" required minLength={2} />
            </label>
            <label>
              Staff username
              <input name="username" required pattern="[a-z0-9_.-]{3,50}" />
            </label>
            <label>
              Temporary password
              <input
                type="password"
                name="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>
            <label>
              Permission
              <select name="permission">
                <option value="inspector">Inspector — capture only</option>
                <option value="reviewer">
                  Reviewer — standards and decisions
                </option>
                <option value="admin">
                  Administrator — also manages accounts
                </option>
              </select>
            </label>
            <button className="button primary">Create staff account</button>
          </form>
          <button className="text-button" onClick={load}>
            Load account list
          </button>
          {rows.map((r) => (
            <p key={r.username}>
              {r.name} · {r.username} · {r.permission}
            </p>
          ))}
        </>
      )}
      {message && <p role="status">{message}</p>}
      <p className="small muted">
        Phone cameras require a trusted HTTPS origin. Follow PHONE_SETUP.md for
        a free local-network setup. This does not require a cloud API. Password
        reset and account removal are not yet available through the UI.
      </p>
    </section>
  );
}
export function BatchManager({
  products,
  batches,
  inspections,
  onChanged,
}: {
  products: Product[];
  batches: Batch[];
  inspections: Inspection[];
  onChanged: () => Promise<unknown>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    try {
      await request("batches", Object.fromEntries(new FormData(form)));
      await onChanged();
      form.reset();
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function toggle(b: Batch) {
    try {
      await request(
        `batches/${b.id}`,
        { status: b.status === "OPEN" ? "CLOSED" : "OPEN" },
        "PUT",
      );
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="section-kicker">PRODUCTION RUNS</div>
          <h1>Batch stations</h1>
          <p>
            Keep product design stable. Select batch-specific printed codes and
            dates for each run.
          </p>
        </div>
      </div>
      <section className="card settings-card">
        <h2>Open a production batch</h2>
        <form className="batch-form" onSubmit={create}>
          <label>
            Batch product
            <select name="productId" required>
              {products.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Production code
            <input name="code" required maxLength={60} />
          </label>
          <label>
            Manufactured
            <input name="manufactured" type="date" />
          </label>
          <label>
            Expiry
            <input name="expiry" type="date" />
          </label>
          <button
            className="button primary"
            disabled={busy || !products.length}
          >
            Create batch
          </button>
        </form>
        {error && (
          <p role="alert" className="inline-error">
            {error}
          </p>
        )}
      </section>
      <div className="product-grid station-batches">
        {batches.map((b) => {
          const records = inspections.filter(
            (i) => i.batchSnapshot?.id === b.id,
          );
          return (
            <section className="card settings-card" key={b.id}>
              <span className="section-kicker">{b.status}</span>
              <h2>{b.code}</h2>
              <p>{products.find((p) => p.id === b.productId)?.name}</p>
              <p>
                Manufactured: {b.manufactured || "Not required"}
                <br />
                Expiry: {b.expiry || "Not required"}
              </p>
              <p>
                {records.length} inspections ·{" "}
                {records.filter((i) => i.finalStatus === "ACCEPTED").length}{" "}
                accepted ·{" "}
                {records.filter((i) => i.finalStatus === "REJECTED").length}{" "}
                rejected ·{" "}
                {
                  records.filter(
                    (i) => !i.finalStatus || i.finalStatus === "HOLD",
                  ).length
                }{" "}
                pending/hold
              </p>
              <button className="button small" onClick={() => toggle(b)}>
                {b.status === "OPEN" ? "Close batch" : "Reopen batch"}
              </button>
            </section>
          );
        })}
      </div>
    </>
  );
}
export function CameraCapture({
  onCapture,
  disabled,
}: {
  onCapture: (file: File) => void;
  disabled: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null);
  const mounted = useRef(true);
  const [active, setActive] = useState(false),
    [error, setError] = useState(""),
    [starting, setStarting] = useState(false);
  function stop() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setActive(false);
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(() => {
    if (active && video.current) {
      video.current.srcObject = stream.current;
      void video.current
        .play()
        .catch(() => setError("Tap the video play control to start preview."));
    }
  }, [active]);
  async function start() {
    setError("");
    setStarting(true);
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Live camera needs localhost or trusted HTTPS. Use file upload, or follow the phone setup guide.",
        );
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      if (!mounted.current) {
        stream.current.getTracks().forEach((t) => t.stop());
        return;
      }
      setActive(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }
  function capture() {
    const v = video.current;
    if (!v?.videoWidth) return;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 2000 / v.videoWidth);
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob && mounted.current) {
          onCapture(
            new File([blob], `capture-${Date.now()}.jpg`, {
              type: "image/jpeg",
            }),
          );
          stop();
        }
      },
      "image/jpeg",
      0.92,
    );
  }
  return (
    <div className="camera-station">
      {active ? (
        <>
          <div className="camera-frame">
            <video ref={video} playsInline muted autoPlay controls />
            <div className="camera-guide" aria-hidden="true" />
          </div>
          <p className="small">
            Fill the frame with the complete label. Keep it flat, square to the
            camera and evenly lit. The guide is framing assistance, not detected
            evidence.
          </p>
          <div className="heading-actions">
            <button className="button primary" onClick={capture}>
              <ScanLine size={17} /> Capture photograph
            </button>
            <button className="button" onClick={stop}>
              Cancel camera
            </button>
          </div>
        </>
      ) : (
        <button
          className="button"
          onClick={start}
          disabled={disabled || starting}
        >
          <Camera size={17} />
          {starting ? "Opening camera…" : "Open live camera"}
        </button>
      )}
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
    </div>
  );
}
export function QualityPreview({ file }: { file: File }) {
  const [quality, setQuality] = useState<CaptureQuality | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const form = new FormData();
    form.set("image", file);
    fetch("/api/quality", {
      method: "POST",
      body: form,
      signal: controller.signal,
    })
      .then(async (r) => {
        const result = await r.json();
        if (!r.ok) throw new Error(result.error);
        setQuality(result);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [file]);
  return (
    <div className="capture-quality" role="status">
      {error ||
        (!quality ? (
          "Checking image quality locally…"
        ) : quality.usable ? (
          <>
            <CheckCircle2 size={16} /> Basic capture checks passed. This does
            not guarantee readable text.
          </>
        ) : (
          quality.warnings.join(" ")
        ))}
      <p className="small muted">
        Heuristic resolution, contrast and sharpness checks; no confidence
        score. Retake if the image is unclear.
      </p>
    </div>
  );
}
export function StationEvidenceView({
  evidence,
  imageId,
}: {
  evidence: StationEvidence;
  imageId: string;
}) {
  const v = evidence.visual;
  return (
    <section className="card settings-card station-evidence">
      <h2>Local image-processing evidence</h2>
      <p>
        Capture: {evidence.quality.width} × {evidence.quality.height}px ·{" "}
        {evidence.quality.usable
          ? "basic quality checks passed"
          : "capture concerns"}
      </p>
      {evidence.quality.warnings.map((w) => (
        <p key={w}>{w}</p>
      ))}
      {v && (
        <>
          <h3>Reference comparison — {v.status}</h3>
          <p>{v.reason}</p>
          {v.offset && (
            <p className="small">
              Translation alignment only · changed pixels:{" "}
              {((v.changedFraction || 0) * 100).toFixed(2)}% of evaluated area.
              This percentage is a measurement, not defect confidence.
            </p>
          )}
          {v.regions.length > 0 && (
            <div className="visual-map">
              <img
                src={`/api/images/${imageId}`}
                alt="Measured image differences for human review"
              />
              {v.regions.map((r, i) => (
                <span
                  key={i}
                  style={{
                    left: `${r.x * 100}%`,
                    top: `${r.y * 100}%`,
                    width: `${r.width * 100}%`,
                    height: `${r.height * 100}%`,
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
      <p className="small muted">
        Experimental algorithms, not generative AI. Intended variable text,
        shadows and lighting can trigger differences. No perspective correction,
        damage classification, seal verification or safety certification.
      </p>
    </section>
  );
}
