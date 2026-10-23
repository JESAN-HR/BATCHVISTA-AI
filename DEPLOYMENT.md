# Running and deployment boundaries

## Supported: private local workstation

1. Install Node 22.13+ and run `npm ci` in the repository.
2. Run `npm run fixtures` if sample PNGs are absent.
3. No `.env.local` or API key is required. Optionally set `BATCHVISTA_DATA_DIR` to a private writable directory before starting.
4. Run `npm run build`, then `npm start`.
5. Open `http://127.0.0.1:3000`. Keep the loopback binding. Optional private-LAN phone access uses the named-account and trusted HTTPS proxy procedure in [PHONE_SETUP.md](PHONE_SETUP.md); do not expose the demo publicly.
6. Verify a synthetic wrong-batch inspection, human rejection and report.
7. Back up the data directory with the server stopped. Keep backups outside publicly served directories.

Keep Node dependencies and the migrations directory with the deployed checkout. The server explicitly loads Tesseract's worker/model from local `node_modules`; copying only `.next` is insufficient. Persistent SQLite and filesystem storage are required; ephemeral serverless hosting is unsuitable for this implementation.

## Public deployment: not enabled

The API rejects external hostnames except the exact HTTPS origin explicitly configured for a private station. See PHONE_SETUP.md for that setup. There is no claim that this app is deployed. Do not bypass this check to publish the local operator endpoint. Before any real public deployment:

- Extend the implemented local named-account roles with production identity recovery, organization membership and public-hosting security (e.g. configured Supabase Auth).
- Keep anonymous session bootstrap disabled after account setup; add and test Postgres migrations, organization RLS and private object-storage policies for public multi-tenancy.
- Replace filesystem assets with private authorized storage, signed bounded URLs and lifecycle deletion.
- Add upload streaming limits, rate limits, a durable OCR queue and resource quotas.
- Configure HTTPS, secure cookies, CSP appropriate to the hosting platform, operational monitoring, backups and retention.
- Keep server-only keys in secrets management; preserve explicit fictional-test-data consent for optional free-tier cloud AI.
- Repeat organization-isolation, privacy, browser and load tests against the actual deployment.

Supabase free plans may support a later prototype, but Supabase is not integrated here and no credentials are needed for the delivered local workflow. Hosting cost and free-tier terms must be verified before choosing infrastructure. No service with mandatory billing is needed for the local version.
