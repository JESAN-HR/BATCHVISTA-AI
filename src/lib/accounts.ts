import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { db, transaction, seed, audit, type Identity } from "./db";
import { HttpError } from "./auth";
export const credentials = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_.-]{3,50}$/),
  password: z.string().min(12).max(128),
});
export const accountSchema = credentials.extend({
  name: z.string().trim().min(2).max(80),
  permission: z.enum(["admin", "reviewer", "inspector"]),
});
export const accountsEnabled = () =>
  !!db().prepare("SELECT user_id FROM account LIMIT 1").get();
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function passwordMatches(password: string, encoded: string) {
  const [salt, hash] = encoded.split(":");
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
export function createAccount(
  input: z.infer<typeof accountSchema>,
  bootstrap = false,
  admin?: Identity,
) {
  const hash = hashPassword(input.password);
  return transaction(() => {
    if (bootstrap && accountsEnabled())
      throw new HttpError(409, "The administrator has already been created.");
    if (!bootstrap && admin?.permission !== "admin")
      throw new HttpError(403, "Administrator access required.");
    const org = "local-workstation";
    const id = randomUUID();
    db()
      .prepare("INSERT OR IGNORE INTO organization VALUES (?,?)")
      .run(org, "Production workstation");
    const user: Identity = {
      id,
      organization_id: org,
      name: input.name,
      role: input.permission === "inspector" ? "guest" : "operator",
      permission: input.permission,
    };
    db()
      .prepare("INSERT INTO app_user VALUES (?,?,?,?)")
      .run(id, org, user.name, user.role);
    db()
      .prepare("INSERT INTO account VALUES (?,?,?,?)")
      .run(id, input.username, hash, input.permission);
    if (bootstrap) {
      db()
        .prepare(
          "DELETE FROM session WHERE user_id IN (SELECT id FROM app_user WHERE organization_id=?)",
        )
        .run(org);
      seed(user);
    }
    audit(
      admin || user,
      bootstrap ? "account.bootstrap" : "account.created",
      id,
    );
    return user;
  });
}
export async function login(
  request: Request,
  input: z.infer<typeof credentials>,
) {
  const now = Date.now();
  for (const key of [input.username, "*"]) {
    const row = db()
      .prepare("SELECT failures,retry_at FROM login_attempt WHERE username=?")
      .get(key);
    if (
      row &&
      Number(row.retry_at) > now &&
      Number(row.failures) >= (key === "*" ? 60 : 5)
    )
      throw new HttpError(429, "Too many sign-in attempts. Wait 15 minutes.");
  }
  const row = db()
    .prepare(
      "SELECT u.*,a.permission,a.password_hash FROM account a JOIN app_user u ON u.id=a.user_id WHERE a.username=?",
    )
    .get(input.username);
  // Equal-cost password derivation for an unknown username.
  const valid = passwordMatches(
    input.password,
    row
      ? String(row.password_hash)
      : `00000000000000000000000000000000:${"00".repeat(64)}`,
  );
  if (!row || !valid) {
    for (const key of [input.username, "*"])
      db()
        .prepare(
          "INSERT INTO login_attempt VALUES (?,1,?) ON CONFLICT(username) DO UPDATE SET failures=CASE WHEN retry_at<? THEN 1 ELSE failures+1 END,retry_at=?",
        )
        .run(key, now + 900000, now, now + 900000);
    throw new HttpError(401, "Incorrect username or password.");
  }
  db()
    .prepare("DELETE FROM login_attempt WHERE username=?")
    .run(input.username);
  const jar = await cookies();
  const old = jar.get("bv-session")?.value;
  if (old) db().prepare("DELETE FROM session WHERE token=?").run(old);
  const token = randomBytes(32).toString("hex");
  db()
    .prepare("INSERT INTO session VALUES (?,?,?)")
    .run(token, String(row.id), now + 86400000);
  const secure =
    !!process.env.BATCHVISTA_ORIGIN &&
    new URL(process.env.BATCHVISTA_ORIGIN).host === request.headers.get("host");
  jar.set("bv-session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure,
    path: "/",
    maxAge: 86400,
  });
  const user: Identity = {
    id: String(row.id),
    organization_id: String(row.organization_id),
    name: String(row.name),
    role: row.role as Identity["role"],
    permission: row.permission as Identity["permission"],
  };
  audit(user, "account.login", user.id);
  return user;
}
export async function logout() {
  const jar = await cookies();
  const token = jar.get("bv-session")?.value;
  if (token) db().prepare("DELETE FROM session WHERE token=?").run(token);
  jar.delete("bv-session");
}
