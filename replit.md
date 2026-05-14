# Workspace

## Overview

pnpm workspace monorepo using TypeScript.

## AREA 69 - AI Models Studio

React + Vite frontend at `artifacts/area69` plus Ruby on Rails 8.1 API backend at `backend/`.
Brazilian Portuguese UI with i18n (`pt-BR`, `en`, `es`).

### Architecture

- **Frontend** (`artifacts/area69`): React + Vite SPA. JWT token is stored in `sessionStorage`.
- **Backend** (`backend`): Rails API-only app. PostgreSQL via `DATABASE_URL`. JWT auth via `jwt`. Password hashing via `bcrypt`.
- **API layer** (`artifacts/area69/src/lib/api.ts`): fetch helpers use `VITE_API_BASE_URL` or `/api` by default.
- **Dev proxy**: Vite proxies `/api/*` to `http://127.0.0.1:3000`.
- **Payments**: Stripe Checkout with webhook fulfillment and idempotent credit ledger.
- **Media storage**: Cloudflare R2-compatible S3 API.
- **AI providers**: Wavespeed and Higgsfield integrations.

### Backend

Location: `backend/`

Production Dockerfile:

```text
backend/Dockerfile.production
```

Important routes:

```text
POST   /api/auth/register
POST   /api/auth/login
GET    /api/user/me
GET    /api/credits
GET    /api/pricing
POST   /api/checkout/stripe
POST   /api/checkout/stripe/confirm
POST   /api/webhooks/stripe
POST   /api/generate/image
POST   /api/generate/video
POST   /api/generate/character
GET    /up
```

### Required Production Environment Variables

| Variable | Description |
|---|---|
| `SECRET_KEY_BASE` | Rails secret key base |
| `JWT_SECRET` | JWT signing secret, different from `SECRET_KEY_BASE` |
| `DATABASE_URL` | PostgreSQL connection string |
| `FRONTEND_BASE_URL` | Public frontend URL used for checkout redirects |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |
| `STRIPE_API_KEY` | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRICE_50_CREDITS` | Stripe Price ID for 50 credits |
| `STRIPE_PRICE_150_CREDITS` | Stripe Price ID for 150 credits |
| `STRIPE_PRICE_300_CREDITS` | Stripe Price ID for 300 credits |
| `STRIPE_PRICE_600_CREDITS` | Stripe Price ID for 600 credits |
| `HIGGSFIELD_API_KEY` | Higgsfield API key |
| `HIGGSFIELD_API_SECRET` | Higgsfield API secret |
| `WAVESPEED_API_KEY` | Wavespeed API key |
| `CREDITS_SECRET` | Secret for admin credit endpoints |
| `INTERNAL_SECRET` | Secret for internal generation history endpoint |
| `R2_PUBLIC_URL_HOST` | Public R2 custom domain |
| `R2_BUCKET` | R2 bucket |
| `R2_ENDPOINT` | R2 S3 endpoint |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |

Generate secrets:

```bash
cd backend
bundle exec rails secret
bundle exec rails secret
```

### Security Notes

- JWT tokens expire in 30 days.
- CORS is restricted by `ALLOWED_ORIGINS` in production.
- `force_ssl = true` is enabled in production; `/up` is excluded for container healthchecks.
- Credit accounting is ledger-backed and idempotent.
- Stripe fulfillment requires an existing local `CreditPurchase` before credits are granted.
- Production boot fails fast if required env vars are missing.
- `brakeman` and `bundler-audit` are included for backend security checks.

### Deployment Assets

- Backend production image workflow: `.github/workflows/publish-backend-image.yml`
- CI workflow: `.github/workflows/ci.yml`
- Coolify backend compose: `deploy/coolify-backend.compose.yml`
- Backend staging env template: `backend/staging.env.example`
- Frontend staging env template: `artifacts/area69/.env.staging.example`
- Staging guide: `docs/staging-deploy.md`

### Key Commands

```bash
pnpm run typecheck
pnpm run build
cd backend && bin/rails test
cd backend && bin/brakeman -q
cd backend && bin/bundler-audit check
docker build -f backend/Dockerfile.production -t area69-backend-prod-check backend
```
