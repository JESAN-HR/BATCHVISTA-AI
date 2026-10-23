import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { db, type Identity, seed, transaction } from "./db";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function checkLocal(request: Request) {
  const url = new URL(request.url);
  const authority = request.headers.get("host");
  const configured = process.env.BATCHVISTA_ORIGIN;
  if (configured) {
    const allowed = new URL(configured);
    if (allowed.protocol !== "https:" || allowed.origin !== configured)
      throw new HttpError(
        503,
        "BATCHVISTA_ORIGIN must be an exact HTTPS origin without a trailing slash.",
      );
    if (authority === allowed.host) {
      const origin = request.headers.get("origin");
      if (
        (origin && origin !== configured) ||
        (!origin && request.method !== "GET") ||
        request.headers.get("sec-fetch-site") === "cross-site"
      )
        throw new HttpError(403, "Cross-origin requests are blocked.");
      return;
    }
  }
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    !authority ||
    !/^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(authority)
  )
    throw new HttpError(
      403,
      "Local workstation only. Public hosting requires a real authentication adapter.",
    );
  const origin = request.headers.get("origin");
  // NextURL canonicalizes 127.0.0.1 to localhost. Compare against the validated
  // browser-facing Host (including port), never an untrusted forwarded header.
  if (origin && origin !== `${url.protocol}//${authority}`)
    throw new HttpError(403, "Cross-origin requests are blocked.");
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new HttpError(403, "Cross-site requests are blocked.");
  if (request.method !== "GET" && !origin)
    throw new HttpError(403, "A same-origin request is required.");
}
export async function identity(
  request: Request,
  reviewer = false,
): Promise<Identity> {
  checkLocal(request);
  const token = (await cookies()).get("bv-session")?.value;
  const user = token
    ? (db()
        .prepare(
          "SELECT u.*,a.permission FROM app_user u JOIN session s ON s.user_id=u.id LEFT JOIN account a ON a.user_id=u.id WHERE s.token=? AND s.expires_at>?",
        )
        .get(token, Date.now()) as Identity | undefined)
    : undefined;
  if (!user) throw new HttpError(401, "Open a local workspace to continue.");
  if (
    !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(
      request.headers.get("host") || "",
    ) &&
    !user.permission
  )
    throw new HttpError(403, "A named account is required for phone access.");
  if (reviewer && user.role !== "operator")
    throw new HttpError(
      403,
      "Reviewer or administrator access is required to confirm dispositions.",
    );
  return user;
}
export async function openSession(mode: "operator" | "guest") {
  if (
    mode === "operator" &&
    db().prepare("SELECT user_id FROM account LIMIT 1").get()
  )
    throw new HttpError(401, "Sign in with your named account.");
  const user = transaction(() => {
    const org = mode === "operator" ? "local-workstation" : randomUUID();
    const id = mode === "operator" ? "local-operator" : randomUUID();
    db()
      .prepare("INSERT OR IGNORE INTO organization VALUES (?,?)")
      .run(
        org,
        mode === "operator" ? "Local workstation" : "Fictional guest workspace",
      );
    db()
      .prepare("INSERT OR IGNORE INTO app_user VALUES (?,?,?,?)")
      .run(
        id,
        org,
        mode === "operator" ? "Local operator" : "Guest observer",
        mode,
      );
    const user: Identity = {
      id,
      organization_id: org,
      name: mode === "operator" ? "Local operator" : "Guest observer",
      role: mode,
    };
    seed(user);
    return user;
  });
  const token = randomBytes(32).toString("hex");
  db()
    .prepare("INSERT INTO session VALUES (?,?,?)")
    .run(token, user.id, Date.now() + 86400000);
  (await cookies()).set("bv-session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: false,
    path: "/",
    maxAge: 86400,
  });
  return user;
}
export function requireManager(user: Identity) {
  if (user.permission === "inspector")
    throw new HttpError(
      403,
      "Inspectors can capture images, but cannot modify standards or delete evidence.",
    );
}
export function errorResponse(error: unknown) {
  if (error instanceof HttpError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof Error && error.message.includes("UNIQUE"))
    return Response.json(
      {
        error:
          "This SKU, batch code or username already exists. Choose a unique value.",
      },
      { status: 409 },
    );
  console.error(error);
  return Response.json(
    {
      error:
        "The operation could not be completed. Please retry or check the local server log.",
    },
    { status: 500 },
  );
}
