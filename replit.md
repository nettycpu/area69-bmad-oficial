# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## AREA 69 — AI Models Studio

React + Vite frontend at `artifacts/area69` + Ruby on Rails 8.1 API backend at `backend/`.
Brazilian Portuguese UI with i18n (pt-BR / en / es). Strict red (#C0001A) and white palette.
Frontend stack: Tailwind CSS v4, framer-motion, wouter, shadcn/ui.

### Architecture

- **Frontend** (`artifacts/area69`): React + Vite SPA. All state loaded from API on login. JWT token stored in `sessionStorage`. Mutations are optimistic (update local state, sync to API in background).
- **Backend** (`backend/`): Ruby on Rails 8.1 API-only app. PostgreSQL via `DATABASE_URL` env var. JWT auth via `jwt` gem. Password hashing via `bcrypt`.
- **API layer** (`artifacts/area69/src/lib/api.ts`): Typed fetch helpers for all endpoints at `/api/...`.
- **State** (`artifacts/area69/src/lib/StoreContext.tsx`): Fetches all user data from API on mount. Mutations call API in background with optimistic UI.
- **Dev proxy**: Vite proxies `/api/*` → `http://localhost:8080` in development.

### Backend — Ruby on Rails 8.1

Location: `backend/` (workspace root)

**Gems**: rails 8.1, pg, bcrypt, jwt, rack-cors

**Models**:
- `User` — has_secure_password, credits default 100, name, email (unique), avatar. Password min 8 chars enforced at model level.
- `AvatarModel` — belongs_to user, name, style, cover (text/base64), status (training/ready/failed), description, images_generated, videos_generated
- `Generation` — belongs_to user, model_name, generation_type (image/video), prompt, url, seed, width, height

**Routes** (all under `/api`):
```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/user/me
PATCH  /api/user/me
POST   /api/user/me/password
GET    /api/avatar_models
POST   /api/avatar_models
PATCH  /api/avatar_models/:id
DELETE /api/avatar_models/:id
GET    /api/generations
POST   /api/generations
DELETE /api/generations/:id
GET    /api/credits
POST   /api/credits/add        ← requires X-Credits-Secret header in production
POST   /api/credits/spend
GET    /api/healthz
```

### Required Environment Variables

| Variable | Required in Production | Description |
|---|---|---|
| `DATABASE_URL` | ✅ YES | PostgreSQL connection string |
| `JWT_SECRET` | ✅ YES | Stable secret for signing JWT tokens. Without it tokens are invalidated on every restart |
| `SECRET_KEY_BASE` | ✅ YES | Rails secret key base. Generate with `rails secret` |
| `ALLOWED_ORIGINS` | ✅ YES | Comma-separated allowed CORS origins (e.g. `https://myapp.replit.app`) |
| `CREDITS_SECRET` | ✅ YES | Secret header value required for `POST /credits/add`. Prevents users from self-issuing credits. Set same value in frontend env as `VITE_CREDITS_SECRET` |
| `RAILS_LOG_LEVEL` | optional | Defaults to `info` |
| `RAILS_MAX_THREADS` | optional | DB connection pool size, defaults to 5 |

**Generating secrets:**
```bash
cd backend && bundle exec rails secret   # for JWT_SECRET and SECRET_KEY_BASE
```

### Security Notes

- JWT tokens expire in 30 days
- All state requests require `Authorization: Bearer <token>` header
- CORS: `*` in development, restricted via `ALLOWED_ORIGINS` env var in production
- `force_ssl = true` enabled in production — HTTP redirects to HTTPS
- Passwords stored as bcrypt hashes, minimum 8 characters enforced at model + frontend level
- `credits/spend` uses atomic SQL `UPDATE WHERE credits >= ?` to prevent race conditions
- `credits/add` requires `X-Credits-Secret` header when `CREDITS_SECRET` env var is set

### Known Production Limitations (by design — require AI integration)

- **Image/video generation is mocked**: Returns static demo assets (`/images/showcase-*.png`, `/videos/demo*.mp4`). Real production requires integration with an AI image/video API (e.g. Replicate, Fal.ai). Generation URLs saved to DB will point to static dev assets.
- **Model training is simulated**: Progress animation is frontend-only. Backend creates the model as `status: "training"` and the frontend simulation + `PATCH /avatar_models/:id` updates it to `ready`. Real production requires a training job queue (Sidekiq + AI provider).
- **PIX payment is simulated**: QR code has valid CRC16/CCITT format but no real payment processor. A real integration requires Mercado Pago, Pagar.me, or similar, plus a webhook endpoint to call `credits/add` with the `CREDITS_SECRET`.

### Workflows

- **API Server**: `cd /home/runner/workspace/backend && PORT=8080 bundle exec rails server -b 0.0.0.0` (port 8080)
- **Start application**: `PORT=19902 BASE_PATH=/ pnpm --filter @workspace/area69 run dev` (port 19902)

### System Dependencies (Nix)

- `libyaml` — required by psych gem (installed via installSystemDependencies)

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Ruby on Rails 8.1 (API-only)
- **Database**: PostgreSQL (via DATABASE_URL)
- **Build**: Vite (frontend)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/area69 exec tsc --noEmit` — typecheck frontend only

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
