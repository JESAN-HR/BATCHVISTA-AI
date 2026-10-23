import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (key: string) => (jar.has(key) ? { value: jar.get(key) } : undefined),
    set: (key: string, value: string) => jar.set(key, value),
    delete: (key: string) => jar.delete(key),
  }),
}));
let database: typeof import("../src/lib/db");
let accounts: typeof import("../src/lib/accounts");
let auth: typeof import("../src/lib/auth");
beforeAll(async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "batchvista-test-"));
  process.env.BATCHVISTA_DATA_DIR = directory;
  const legacy = new DatabaseSync(path.join(directory, "batchvista.sqlite"));
  legacy.exec(readFileSync("migrations/001_initial.sql", "utf8"));
  legacy.close();
  database = await import("../src/lib/db");
  accounts = await import("../src/lib/accounts");
  auth = await import("../src/lib/auth");
});
afterAll(() => {
  database.db().close();
  delete process.env.BATCHVISTA_DATA_DIR;
});
describe("named local identity and migration", () => {
  it("migrates version 1 without destructive reset", () =>
    expect(
      database
        .db()
        .prepare("SELECT version FROM migration WHERE version=2")
        .get(),
    ).toBeTruthy());
  it("hashes passwords with per-user salts", () => {
    const a = accounts.hashPassword("fictional-password"),
      b = accounts.hashPassword("fictional-password");
    expect(a).not.toBe(b);
    expect(accounts.passwordMatches("fictional-password", a)).toBe(true);
    expect(accounts.passwordMatches("wrong-password", a)).toBe(false);
  });
  it("bootstraps once, revokes anonymous operator access, and records named reviews capability", async () => {
    accounts.createAccount(
      {
        name: "Fictional Admin",
        username: "fictional-admin",
        password: "fictional-password",
        permission: "admin",
      },
      true,
    );
    expect(() =>
      accounts.createAccount(
        {
          name: "Another Admin",
          username: "other-admin",
          password: "fictional-password",
          permission: "admin",
        },
        true,
      ),
    ).toThrow("already");
    await expect(auth.openSession("operator")).rejects.toThrow("Sign in");
    const req = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
    });
    const user = await accounts.login(req, {
      username: "fictional-admin",
      password: "fictional-password",
    });
    expect(user.name).toBe("Fictional Admin");
    expect((await auth.identity(req, true)).permission).toBe("admin");
    accounts.createAccount(
      {
        name: "Fictional Inspector",
        username: "inspector",
        password: "fictional-password",
        permission: "inspector",
      },
      false,
      user,
    );
    await accounts.login(req, {
      username: "inspector",
      password: "fictional-password",
    });
    await expect(auth.identity(req, true)).rejects.toThrow("cannot confirm");
    expect(() =>
      auth.requireManager({
        id: "x",
        organization_id: "local-workstation",
        role: "guest",
        name: "Inspector",
        permission: "inspector",
      }),
    ).toThrow("cannot modify");
  });
  it("throttles repeated incorrect credentials", async () => {
    const req = new Request("http://localhost:3000", {
      headers: { host: "localhost:3000" },
    });
    for (let n = 0; n < 5; n++)
      await expect(
        accounts.login(req, {
          username: "missing",
          password: "incorrect-password",
        }),
      ).rejects.toThrow("Incorrect");
    await expect(
      accounts.login(req, {
        username: "missing",
        password: "incorrect-password",
      }),
    ).rejects.toThrow("Too many");
  });
});
