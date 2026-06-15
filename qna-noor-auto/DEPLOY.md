# Deploying to Vercel + Postgres

This guide takes you from a fresh Vercel account to a live URL at
`https://qnaautorepair-noorautorepair.vercel.app` in about 15 minutes.

---

## 1. Push your code to GitHub

Vercel deploys from a Git repo. If you haven't already:

1. Open https://github.com and sign in (or sign up — free).
2. Click the green **New** button (top left, under your profile) → name the
   repo `qna-noor-auto` → choose **Private** → click **Create repository**.
3. On your Windows machine, open a cmd window in the project folder and run:

   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-GITHUB-USERNAME/qna-noor-auto.git
   git push -u origin main
   ```

   (Replace `YOUR-GITHUB-USERNAME` with your actual GitHub username.)

If `git` isn't installed, download it from https://git-scm.com/download/win and
re-run the cmd window.

---

## 2. Create a Vercel Postgres database

This is the live database that holds your shop's data. The free tier is
plenty for a small shop.

1. Open https://vercel.com/dashboard — sign in with the account you made.
2. Click **Storage** in the left sidebar → **Create Database** → pick
   **Postgres (Neon)** → **Continue**.
3. Name the database anything (e.g. `qna-noor-auto-db`) → pick the region
   closest to Houston (probably `us-east-1` / Washington, D.C.).
4. Click **Create**.
5. Once it's ready, click the **.env.local** tab on the database page. You'll
   see something like:

   ```
   DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
   DATABASE_URL_UNPOOLED="postgres://user:pass@host-pooler:5432/db?sslmode=require"
   ```

   Leave this tab open — you'll copy from it in step 4.

---

## 3. Create the Vercel project

1. Back in the Vercel dashboard, click **Add New** → **Project**.
2. Find your `qna-noor-auto` repo → click **Import**.
3. **Project name**: `qnaautorepair-noorautorepair` (this becomes your URL).
4. **Framework preset**: Vercel will auto-detect **Next.js** — leave it.
5. **Build command**: leave blank (uses the `build` script in package.json,
   which runs `prisma migrate deploy && next build`).
6. **Root directory**: leave as `./`.
7. **Don't click Deploy yet** — first set the environment variables below.

---

## 4. Set environment variables

Still on the project's New Deployment page, scroll down to
**Environment Variables** and add these three:

| Name | Value | Where to get it |
|---|---|---|
| `DATABASE_URL` | copy the `DATABASE_URL` from your Postgres `.env.local` tab (step 2.5) | Vercel Postgres dashboard |
| `APP_PASSWORD` | your shop password (what your team will type to sign in) — pick something only your team knows. **Don't use `changeme`.** | you pick it |
| `SESSION_SECRET` | a random 64-character string. Easiest way: go to https://generate-secret.vercel.app/64 and copy the string. | generated |

Click **Add** after each one.

**Important**: In the "Environments" dropdown next to each variable, make sure
all three are checked — Production, Preview, Development.

---

## 5. Deploy

Click the big **Deploy** button. Wait ~2-3 minutes. You'll see build logs
streaming. The build runs:

```
pnpm install
pnpm build   # = prisma migrate deploy && next build
```

This creates all the database tables in your Postgres. On success you'll see
a preview of your live site at
`https://qnaautorepair-noorautorepair.vercel.app`.

---

## 6. First-time setup — seed defaults

Your live database is empty. You need to seed the shop defaults
(service intervals, default labor rate, tax rate, shop name) one time:

1. Back in Vercel → Settings → Environment Variables → find your `DATABASE_URL`
   → click the 3-dot menu → **Edit** → copy the value.
2. On your Windows machine, in cmd (still in the project folder):

   ```
   set DATABASE_URL=<paste-the-url-you-copied>
   set SEED_DEMO=false
   pnpm db:seed
   ```

   You should see:
   ```
   Seeded shop defaults only (SEED_DEMO=false). Skipping demo customers.
   ```

3. Visit `https://qnaautorepair-noorautorepair.vercel.app` → you'll be
   redirected to `/login`. Sign in with your `APP_PASSWORD`. Empty dashboard,
   ready to use.

---

## 7. Customize your shop settings

Once signed in, click the **Settings** tab in the sidebar and set:

- Shop name
- Address / phone / email
- Default labor rate
- Default tax rate

These show up on invoice PDFs, the customer portal, and the login page.

---

## Local development (optional — keep using SQLite or point at your own Postgres)

Your local installation on Windows uses a separate DB from the live site.

**Option A: local Postgres (matches production)**
You downloaded Postgres on your machine. Create a database for dev:

```
createdb noor_dev
```

Then in `.env` set:
```
DATABASE_URL="postgresql://postgres:YOUR-POSTGRES-PASSWORD@localhost:5432/noor_dev"
```

Run:
```
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

**Option B: point local dev at your live Vercel Postgres**
Not recommended — you'd share demo data with your live site.

---

## Future deploys

Every time you push to the `main` branch on GitHub, Vercel auto-deploys.
Database migrations run automatically (from `prisma migrate deploy` in the
build command). You don't need to do anything.

If you want to test changes before deploying, push to a different branch
(e.g. `dev`) — Vercel gives you a preview URL like
`qnaautorepair-noorautorepair-git-dev-yourname.vercel.app`.

---

## Troubleshooting

**Build fails with "Can't reach database"**
- Your `DATABASE_URL` env var isn't set correctly in Vercel. Check Settings →
  Environment Variables. Make sure it ends with `?sslmode=require`.

**Login page accepts any password / rejects valid password**
- `APP_PASSWORD` isn't set in Vercel env vars, or `SESSION_SECRET` changed
  between deploys (invalidates all existing cookies). Sign in again.

**Customers/Vehicles tab is empty after deploy**
- You haven't run `SEED_DEMO=false pnpm db:seed` yet (step 6). Do that.

**Want to reset the live database (wipe everything)**
- From your Windows machine with the production `DATABASE_URL` set:
  ```
  pnpm prisma migrate reset --force
  set SEED_DEMO=false
  pnpm db:seed
  ```
  **This deletes all customers, vehicles, ROs, payments — everything.**

**Want to use a custom domain (e.g. qnaauto.com)**
- In Vercel project → Settings → Domains → add your domain. Vercel gives
  you DNS records to add at your registrar.

---

## Billing (Stripe subscriptions)

Self-serve sign-up and recurring billing are powered by Stripe. They stay
dormant until the Stripe env vars below are set, so the app runs fine without
them (businesses you create from the **Manage businesses** admin screen don't
need a subscription).

### Environment variables

| Name | Value | Where to get it |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_…` to start, `sk_live_…` for real money) | https://dashboard.stripe.com/apikeys |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the webhook endpoint (`whsec_…`) | created in step 2 below |
| `CRON_SECRET` | A random string; protects the daily billing cron | you generate (e.g. https://generate-secret.vercel.app/32) |
| `STRIPE_PRICE_ID` | *(optional)* an existing recurring Price id to use | Stripe → Products. If omitted, the app auto-creates a $`BILLING_PRICE_USD`/month price |
| `BILLING_PRICE_USD` | *(optional)* monthly price in dollars (default `35`) | you pick |
| `BILLING_TRIAL_DAYS` | *(optional)* free-trial length in days (default `14`) | you pick |
| `BILLING_GRACE_DAYS` | *(optional)* days unpaid before auto-suspend (default `3`) | you pick |
| `NEXT_PUBLIC_BASE_URL` | *(optional)* canonical site URL for Stripe redirects; auto-derived from the request if unset | e.g. `https://yourdomain.com` |

### 1. Get your Stripe key

Create a free account at https://dashboard.stripe.com/register, then copy your
**Secret key** from https://dashboard.stripe.com/test/apikeys. Start in **test
mode** (toggle top-right) to verify everything with Stripe's test cards before
switching to live keys.

### 2. Add the webhook

1. Go to https://dashboard.stripe.com/test/webhooks → **Add endpoint**.
2. Endpoint URL: `https://YOUR-DOMAIN/api/stripe/webhook`.
3. Subscribe to these events: `checkout.session.completed`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.paid`.
4. After creating it, copy the **Signing secret** (`whsec_…`) into
   `STRIPE_WEBHOOK_SECRET`.

### 3. The daily grace-period check

`vercel.json` defines a cron that hits `/api/cron/billing` once a day. It puts
on hold any business whose payment has been failing for more than
`BILLING_GRACE_DAYS` days (Stripe retries the card during that window; a
successful payment auto-reactivates them). Set `CRON_SECRET` so only Vercel Cron
can trigger it.

### How it flows

1. A new shop visits `/signup`, enters their details + card on Stripe's hosted
   checkout, and starts a `BILLING_TRIAL_DAYS`-day free trial.
2. On success they're signed in and their business is **ACTIVE**.
3. If a renewal payment fails, the grace timer starts; after
   `BILLING_GRACE_DAYS` days the business is **SUSPENDED** (its logins are
   blocked) until they pay. Owners manage their card at `/billing` (Stripe
   portal).
4. You can always override status manually from the **Manage businesses** admin
   screen.

### Going live

Swap the test keys for live keys (`sk_live_…`), recreate the webhook in live
mode for the same URL, and update `STRIPE_WEBHOOK_SECRET`. Test cards stop
working in live mode — use a real card.

---

## Security notes

- The **session cookie** is `httpOnly` and `secure` in production (only sent
  over HTTPS). Stays valid for 30 days.
- **Customer-facing URLs** (`/e/TOKEN`, `/p/TOKEN`, `/a/TOKEN`) work without
  login. Tokens are non-guessable (32+ random chars).
- **Internal data** (costs, suppliers, markups, technician names, internal
  notes) never appears on customer-facing pages or PDFs. Verified across 27
  internal keywords on every release.
- **No secrets in git**: `.env` is gitignored. Only set env vars in Vercel.
