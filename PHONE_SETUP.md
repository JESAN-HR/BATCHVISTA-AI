# Connect a phone to a private BatchVista station

BatchVista now supports live camera preview/capture, named accounts, production batches, image-quality checks and optional local reference comparison. The phone sends its image to your workstation for local processing. No paid API, domain purchase or cloud subscription is required.

## 1. Secure the workstation first

Start normally with `npm run dev`, open `http://127.0.0.1:3000`, enter the operator workspace, then go to **Settings → Set up named accounts**. Create the administrator using a unique username and a password of at least 12 characters.

This upgrades the existing workspace without deleting records. It revokes old anonymous operator sessions and disables password-free operator access. The administrator can create staff under **Team & phone access**:

- **Inspector:** capture and read inspections; cannot edit standards, create/close batches, delete evidence or confirm dispositions.
- **Reviewer:** manage products/batches and confirm decisions.
- **Administrator:** reviewer capabilities plus account creation/listing.

Names in the audit trail now come from signed-in accounts. These are local authenticated identities, not externally verified corporate identities. Protect the workstation: someone with filesystem access can still alter its database. Account reset, password change and account removal UI are not yet implemented; keep the initial administrator credentials safely.

## 2. Choose your private-network address

Connect the workstation and phone to the same trusted Wi-Fi/LAN. Find the workstation's LAN IPv4 address (`ipconfig` on Windows; `hostname -I` on Ubuntu). The example below uses **192.168.1.25**; replace it with your own address everywhere. A DHCP reservation helps keep it stable. Do not configure router port forwarding.

In `.env.local`, add the exact origin, with no trailing slash:

```dotenv
BATCHVISTA_ORIGIN=https://192.168.1.25:8443
```

Stop development mode, then run:

```sh
npm run build
npm start
```

Windows PowerShell can use `npm.cmd` in place of `npm`. Keep Next.js bound to `127.0.0.1`; do not change it to listen on every interface. The next step exposes only a TLS proxy on your LAN. Use production mode for phone access, avoiding development-origin/hot-reload complications.

## 3. Add free local HTTPS with Caddy

Install the open-source Caddy binary for your OS using its [official installation instructions](https://caddyserver.com/docs/install). This is additional setup for phone access, not a dependency of ordinary local inspection.

Copy `Caddyfile.example` to `Caddyfile`, replace the sample IP, and run:

```sh
caddy run --config Caddyfile
```

The example uses `tls internal` to issue a local certificate, then proxies to the loopback server. Keep both processes running. Permit inbound TCP **8443** only on the intended private network in your OS firewall. Never open a firewall rule to all public networks merely to make a phone connect. Caddy's certificate storage is separate from BatchVista's `data` folder.

The phone must trust the local CA before camera capture will work reliably. Caddy documents [local certificate authority behavior and trust installation](https://caddyserver.com/docs/automatic-https#local-https). Its `caddy environ` output identifies the application data directory; the public root certificate is under `pki/authorities/local/root.crt` there. Transfer **only `root.crt`**, through a trusted channel, to each authorized device and install/enable trust according to that device's certificate settings. Never transfer `root.key` or expose the CA directory. Some managed phones restrict user-added CAs; consult the device administrator instead of disabling browser security.

Certificate installation differs by Android/iOS version. Merely clicking through a browser certificate warning is not a reliable camera setup. Remove the local CA from devices when the station is retired.

## 4. Capture and inspect

1. On the phone, open `https://192.168.1.25:8443` using your real IP. There should be no certificate warning.
2. Tap **Open workspace** and sign in with a named account. Remote anonymous/guest session creation is blocked.
3. Select **New inspection**, the product, and an open production batch.
4. Tap **Open live camera**, allow camera access, and frame the whole label. The app requests the rear camera when available.
5. Tap **Capture photograph**. The camera stops; inspect the preview and local quality messages. Remove/retake if needed.
6. Optionally enable **Compare approved reference locally (experimental)** when a product has a reference. Use similarly cropped, front-facing images.
7. Run inspection. Review OCR and measured differences. Reviewers/admins can confirm a disposition; inspectors cannot.
8. **Inspect next package** returns to the last inspected product and batch for repeated capture.

Live camera requires a secure browser context, such as trusted HTTPS or localhost; this is a browser requirement described in [MDN's getUserMedia documentation](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia). File upload and the device file/camera picker remain alternatives. The framing rectangle is guidance, not detected defect evidence.

## Troubleshooting and boundaries

- **No connection:** check both server processes, LAN address, firewall and Wi-Fi client isolation. Phone localhost refers to the phone, not your workstation.
- **403:** the browser host/port and `.env.local` origin must match exactly; restart Next.js after environment changes. Do not configure a proxy to rewrite the incoming Host to localhost.
- **Camera denied:** check trusted HTTPS and browser camera permission. Reload after changing permissions. Other apps may have the camera in use.
- **No open batch:** a reviewer must create or reopen one in Batch stations.
- **Reference unavailable:** upload it in Product catalog before inspection; older inspection snapshots do not change.
- **Visual result uncertain:** this version supports translation alignment only. Reframe both images; rotation, perspective, curved labels and glare are not corrected automatically.

Mobile viewport, capture lifecycle with a virtual browser camera, named authentication and API authorization are automated-test targets. Physical Android/iOS devices, actual LAN TLS configuration and device certificate installation have **not** been tested here. This is private-station access, not a validated public SaaS deployment. A single OCR worker still serializes work; simultaneous capture stations may receive a busy warning and need to retry.
