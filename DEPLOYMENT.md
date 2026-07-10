# Deployment — Free Cloud (GitHub Actions + Neon)

Jojo's News runs entirely for **$0/month**: a free always-on Postgres on
[Neon](https://neon.tech), and [GitHub Actions](https://docs.github.com/actions)
as the scheduler. There is **no server to run** — the daily pipeline
(aggregate → summarize → email) runs as one scheduled Action and exits.

```
GitHub Actions (cron, free)  ──runs──►  npm run task -- digest
                                          │
                    aggregate ► summarize (Gemini) ► email (Resend)
                                          │
                                     Neon Postgres (free)
```

---

## One-time setup (~15 min)

### 1. Create a free Neon Postgres

1. Sign up at https://neon.tech (free tier, no card).
2. Create a project (any name, e.g. `jojos-news`). A database is created for you.
3. On the project dashboard, click **Connect** and copy the **connection string**.
   It looks like:
   ```
   postgresql://USER:PASSWORD@ep-xxxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
   Use the **pooled** connection string (host contains `-pooler`) if offered.

### 2. Add GitHub secrets

In your repo: **Settings → Secrets and variables → Actions → New repository secret**.
Add these **secrets**:

| Secret | Value |
|--------|-------|
| `DATABASE_URL` | the Neon connection string from step 1 |
| `GEMINI_API_KEY` | your Google AI Studio key |
| `RESEND_API_KEY` | your Resend API key |
| `EMAIL_FROM` | `onboarding@resend.dev` (or your verified domain) |
| `EMAIL_TO` | the address to receive the digest |

Optional **variable** (Variables tab, not Secrets):

| Variable | Value | Effect |
|----------|-------|--------|
| `DRY_RUN_EMAIL` | `true` | Preview only — logs the email instead of sending. Leave unset to send for real. |

> ⚠️ **Resend free tier:** with `onboarding@resend.dev` and no verified domain,
> `EMAIL_TO` must be the email your Resend account is registered under. To send
> elsewhere, verify a real domain (see `EMAIL_SETUP_GUIDE.md`). Firebase/Vercel
> platform subdomains can't be verified for email.

### 3. Create the database schema

1. Go to the **Actions** tab → **DB Migrate (manual)** → **Run workflow**.
2. Wait for the green check. This creates all tables on Neon.
   (Re-running DROPs and recreates every table — only run it again to reset.)

### 4. Test the pipeline

1. Actions tab → **Daily Digest** → **Run workflow**.
2. Watch the logs: you should see aggregation, then a Gemini summary, then
   `✓ Daily email sent successfully`.
3. Check your inbox (and spam) — the digest should arrive within a minute.

Done. From now on it runs **automatically every day**.

---

## Schedule & timing

Defined in [.github/workflows/daily-digest.yml](.github/workflows/daily-digest.yml).
The digest is sent at **04:00 Berlin time, year-round**. GitHub cron is UTC with
no DST, so two candidate crons run (`0 2` and `0 3` UTC) and a runtime guard
(`RUN_ONLY_AT_BERLIN_HOUR`) lets only the one equal to 04:00 Berlin proceed — the
other exits in seconds. Manual (`workflow_dispatch`) runs are ungated, so you can
test any time.

To change the hour, edit both cron lines **and** the `'4'` in the
`RUN_ONLY_AT_BERLIN_HOUR` env (keep them one hour apart across the DST boundary).

- Scheduled Actions can be delayed a few minutes under load — fine for a digest.
- GitHub **disables scheduled workflows after 60 days of no repo activity**. Any
  commit re-arms them.

## Running tasks individually

`npm run task -- <name>` where name is `aggregate`, `summarize`, `email`, or
`digest` (default). Useful for debugging via **workflow_dispatch** or locally.

## Cost

| Component | Tier | Cost |
|-----------|------|------|
| GitHub Actions | Free (public repo unlimited; private ~2000 min/mo) | $0 |
| Neon Postgres | Free tier | $0 |
| Google Gemini | Free API tier (`gemini-flash-latest`) | $0 |
| Resend | Free tier (3,000 emails/mo) | $0 |

## Limitations

- **No live web dashboard** in this setup (there's no always-on backend). The
  email is the product. To view data, query Neon directly or add a serverless
  read API later.
- **Failures are logged, not alerted.** A failed run shows red in the Actions
  tab; check there if an email doesn't arrive. Add retry/alerting later if needed.
