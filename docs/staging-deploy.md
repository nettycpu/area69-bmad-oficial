# AREA69 Staging Deploy Guide

This guide prepares a staging launch using open-source-friendly infrastructure:

- Backend image: GitHub Container Registry (GHCR)
- Backend runtime: Coolify on a VPS
- Frontend: Cloudflare Pages
- Static/media storage: Cloudflare R2 with a custom domain
- DNS/SSL/WAF: Cloudflare

Use staging domains first:

```text
app-staging.yourdomain.com    -> frontend
api-staging.yourdomain.com    -> Rails backend
media-staging.yourdomain.com  -> Cloudflare R2 custom domain
```

## 1. Push the prepared code

From the repo root:

```bash
git push origin master
```

GitHub Actions will run:

- `.github/workflows/ci.yml`
- `.github/workflows/publish-backend-image.yml`

The backend image will be published as:

```text
ghcr.io/nettycpu/area69-backend:latest
```

If GHCR shows the package as private, make it visible to the Coolify deploy token or make the package public for staging.

## 2. Create staging secrets

Generate two different long secrets:

```bash
cd backend
bundle exec rails secret
bundle exec rails secret
```

Use one as `SECRET_KEY_BASE` and the other as `JWT_SECRET`.

Fill the backend envs from:

```text
backend/staging.env.example
```

Important staging values:

```text
FRONTEND_BASE_URL=https://app-staging.yourdomain.com
ALLOWED_ORIGINS=https://app-staging.yourdomain.com
R2_PUBLIC_URL_HOST=https://media-staging.yourdomain.com
```

Use Stripe test mode for staging:

```text
STRIPE_API_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_*_CREDITS=price_... from Stripe test mode
```

## 3. Create backend in Coolify

Recommended path:

1. Create a new Docker Compose resource.
2. Use `deploy/coolify-backend.compose.yml` as the compose file.
3. Set the domain to `api-staging.yourdomain.com`.
4. Add the backend env values from `backend/staging.env.example` in Coolify's environment variables UI.
5. Deploy.

After deploy, run the release migration once:

```bash
bundle exec rails db:migrate
```

Expected healthcheck:

```text
https://api-staging.yourdomain.com/up
```

## 4. Configure Stripe webhook

In Stripe test mode, create endpoint:

```text
https://api-staging.yourdomain.com/api/webhooks/stripe
```

Subscribe to:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.expired
```

Copy the endpoint signing secret into:

```text
STRIPE_WEBHOOK_SECRET
```

## 5. Configure Cloudflare R2

Create or reuse a staging bucket, then bind a custom domain:

```text
media-staging.yourdomain.com
```

Set backend env:

```text
R2_PUBLIC_URL_HOST=https://media-staging.yourdomain.com
R2_BUCKET=your-staging-bucket
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
```

Avoid relying on public `r2.dev` URLs for launch.

## 6. Deploy frontend to Cloudflare Pages

Create a Cloudflare Pages project from this repository.

Build settings:

```text
Build command: pnpm --filter @workspace/area69 run build
Build output directory: artifacts/area69/dist/public
Root directory: /
```

Environment variable:

```text
VITE_API_BASE_URL=https://api-staging.yourdomain.com/api
```

Set the custom domain:

```text
app-staging.yourdomain.com
```

## 7. Staging smoke test

Run these manually before production:

1. Open `https://app-staging.yourdomain.com`.
2. Register a new user.
3. Login and confirm `/api/user/me` works.
4. Confirm initial credits are correct.
5. Start Stripe checkout in test mode for each credit pack.
6. Confirm success redirects back to billing.
7. Confirm credits increase exactly once.
8. Refresh and confirm balance persists.
9. Generate an image with Wavespeed.
10. Generate a video with Wavespeed.
11. Train/generate with Higgsfield.
12. Confirm generated media URLs use `media-staging.yourdomain.com`.
13. Confirm history loads.
14. Confirm bad/expired token returns 401.
15. Confirm `https://api-staging.yourdomain.com/up` returns 200.

## 8. Production go/no-go checklist

Do not launch production until all items are true:

- CI passes on GitHub.
- GHCR image was published.
- Coolify backend deploy is green.
- `bundle exec rails db:migrate` ran successfully.
- Stripe webhook test event is delivered successfully.
- A real Stripe test checkout credits the account once.
- Wavespeed image and video jobs complete.
- Higgsfield job completes.
- Cloudflare R2 custom domain serves generated media.
- PostgreSQL backups are enabled and restore-tested.
- Cloudflare DNS is proxied where appropriate.
- `ALLOWED_ORIGINS` has only your real frontend domains.
- No live secrets are committed to Git.
- Terms, Privacy Policy, refund/support contact, and abuse/report flow are published.

## 9. Production differences

For production, switch domains and live Stripe keys:

```text
FRONTEND_BASE_URL=https://app.yourdomain.com
ALLOWED_ORIGINS=https://app.yourdomain.com
VITE_API_BASE_URL=https://api.yourdomain.com/api
R2_PUBLIC_URL_HOST=https://media.yourdomain.com
STRIPE_API_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_live_...
STRIPE_PRICE_*_CREDITS=live price IDs
```
