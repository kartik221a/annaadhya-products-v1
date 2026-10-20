# Environment setup

Every integration works in an explicit mock mode without credentials and upgrades to the real
service purely by adding environment variables. Nothing falls back silently.

## 1. Prerequisites

- Node.js ≥ 20.9 (tested on Node 24)
- pnpm 9 (`npm i -g pnpm@9` or `corepack enable`)

```bash
pnpm install
pnpm -r build        # compiles shared packages (required before running node dist)
```

## 2. Zero-credential development (mock mode)

Copy the example files and start:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/storefront/.env.example apps/storefront/.env.local
cp apps/admin/.env.example apps/admin/.env.local

pnpm dev:api          # :4000 — in-memory data, mock auth, mock payments; auto-seeds demo data
pnpm dev:storefront   # :3000
pnpm dev:admin        # :3001
```

In mock mode: data lives in memory (auto-seeded with the 20-product demo catalogue), sign-in uses
dev tokens (`POST /api/v1/auth/dev/token`), and payments complete through the signed mock adapter.
The storefront and admin show honest mode notices instead of pretending integrations work.

## 3. Firebase Authentication + Firestore

Create a Firebase project (start with a **test** project), then:

1. **Authentication** → enable Google, Email/Password and Phone providers.
   Phone SMS has per-verification cost — review Firebase pricing before enabling in production.
2. **Firestore** → create a Native-mode database. Start in production mode (locked) — the API
   writes with the Admin SDK; client access stays denied by `firestore.rules`.
3. **Service account** → Project settings → Service accounts → Generate new private key.
   Store the JSON outside Git.

API env (`apps/api/.env`):

```
DATA_PROVIDER=firestore
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----\n"
# FIRESTORE_DATABASE_ID=   # optional named database
```

Storefront env (`apps/storefront/.env.local`) — the *public* client config:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIza…
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_APP_ID=1:…:web:…
```

Load rules and indexes:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Seed real data (writes go to Firestore):

> **Flag form matters:** pnpm forwards arguments to the script directly — do **not** put `--`
> before the flag. Everything after `--` becomes positional to `parseArgs`, the `--firestore`
> option is silently dropped, and the seed would run against in-memory storage instead of
> Firestore (no error raised, nothing persisted).

```bash
pnpm --filter @annaadhya/seed-demo-data seed --firestore
pnpm --filter @annaadhya/seed-demo-data reset-demo --firestore --i-understand-demo-reset
```

**Verify before claiming it works:** sign in with Google, email and phone on the storefront; check
`GET /api/v1/health` shows `provider: "firestore"` and `auth: "firebase"`.

## 4. Cloudinary (product media)

Create a Cloudinary project and note Cloud name + API key + API secret.

```
CLOUDINARY_CLOUD_NAME=…
CLOUDINARY_API_KEY=…
CLOUDINARY_API_SECRET=…   # server-side only, never exposed to browsers
```

Flow implemented: admin requests `POST /admin/media/upload-signature` → browser uploads directly
to Cloudinary with the signed params → `POST /admin/media/register` validates the asset → attach
the URL to a product via the product editor. Restricted to `annaadhya/*` folders, images ≤ 10 MB,
jpg/png/webp/avif.

## 5. Razorpay (payments)

1. Create a Razorpay account → Dashboard → Settings → API keys → generate **Test mode** keys.
2. Configure a webhook to `https://<api-host>/api/v1/payments/webhook/razorpay` with events
   `payment.captured`, `payment.failed`, `refund.processed`, and set a webhook secret.

```
PAYMENT_PROVIDER=razorpay
RAZORPAY_KEY_ID=rzp_test_…
RAZORPAY_KEY_SECRET=…
RAZORPAY_WEBHOOK_SECRET=…
```

The adapter registers only when all three exist. **Keep `settings.payments.sandboxMode = true`
until the owner explicitly approves production launch** — the API also refuses mock payment
simulation whenever Razorpay/Firebase is configured. Test with Razorpay's standard test cards and
verify a webhook appears in the dashboard before flipping anything live.

## 6. Admin bootstrap (first owner)

```
ADMIN_SETUP_KEY=choose-a-long-random-value
```

```bash
curl -X POST $API/api/v1/auth/bootstrap-owner \
  -H 'content-type: application/json' \
  -d '{"uid":"<firebase-uid-of-owner>","displayName":"Owner","email":"owner@…","setupKey":"…"}'
```

Then invite additional staff from the admin Team page.

## 7. Full variable reference

| Variable | Apps | Purpose |
|---|---|---|
| `PORT` | api | listen port (default 4000) |
| `CORS_ORIGINS` | api | allowed browser origins, comma-separated |
| `DATA_PROVIDER` | api | `memory` (dev) or `firestore` (production requires it) |
| `FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY` | api | Admin SDK credentials |
| `FIRESTORE_DATABASE_ID` | api | optional named database |
| `DEV_TOKEN_SECRET` | api | mock-mode token signing (default dev value; never production) |
| `ADMIN_SETUP_KEY` | api | one-time owner bootstrap guard |
| `PAYMENT_PROVIDER` | api | `mock` or `razorpay` |
| `RAZORPAY_KEY_ID/KEY_SECRET/WEBHOOK_SECRET` | api | gateway credentials |
| `CLOUDINARY_*` | api | media credentials |
| `CHECKOUT_QUOTE_TTL_MINUTES` | api | quote lifetime (default 15) |
| `STOCK_RESERVATION_TTL_MINUTES` | api | reservation lifetime (default 30) |
| `EXPORT_SYNC_ROW_LIMIT` | api | sync export cap (default 20000) |
| `RATE_LIMIT_WINDOW_SECONDS` / `RATE_LIMIT_MAX_REQUESTS` | api | limiter tuning |
| `API_URL` | storefront | server-side fetch base for the API |
| `NEXT_PUBLIC_API_URL` | storefront/admin | browser fetch base |
| `NEXT_PUBLIC_SITE_URL` | storefront | canonical/OG/sitemap base |
| `NEXT_PUBLIC_FIREBASE_*` | storefront | public Firebase client config |

## 8. Verification checklist

- [ ] `curl $API/api/v1/health` → expected `provider` and `auth`
- [ ] `pnpm --filter @annaadhya/seed-demo-data dry-run` prints the planned dataset
- [ ] Storefront home lists products; product page shows correct pack prices
- [ ] Checkout completes in the configured payment mode
- [ ] `pnpm --filter @annaadhya/export-validation start` reports all checks PASS
