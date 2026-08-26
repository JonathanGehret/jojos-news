# Jojo's News

An AI-powered daily news digest. It aggregates news from RSS feeds, summarizes it per
category with Google Gemini, and emails one curated digest every morning — running
entirely on free cloud infrastructure, with no server to maintain.

```
GitHub Actions (daily cron)
        │
        ├─ 1. Aggregate   RSS feeds ──────────────► Neon Postgres
        ├─ 2. Summarize   one Gemini call per category
        └─ 3. Email       HTML digest via Resend ──► your inbox
```

## Features

- **Full palette every day** — one summary per category, daily (6 categories):
  AI & Technology (incl. Musk's tech ventures + AI in games) · Science & Research
  (incl. medical research) · World News & Geopolitics (world, US, German/EU, defense) ·
  Investing & Markets · Space & Astronomy (incl. SpaceX/Starlink) · Energy
- **No repeats** — each story is assigned to exactly one category, and stories already
  sent are marked so they never appear in a later digest
- **Quiet categories are honest** — a category with no real news is skipped and listed
  in the footer rather than padded with noise
- **Resilient LLM layer** — retries with backoff, falls through a chain of Gemini models,
  and optionally to any OpenAI-compatible provider if Google is unavailable
- **$0/month** — GitHub Actions + Neon + Gemini free tier + Resend free tier

## How it works

A single scheduled GitHub Actions job runs the whole pipeline once a day and exits —
there is no long-running server:

1. **Aggregate** — fetch ~35 RSS feeds, deduplicate by URL, store to Postgres
2. **Summarize** — assign each story to its single best-matching category (whole-word
   keyword scoring), then make one LLM call per category
3. **Email** — render the summaries as HTML and send via Resend

Categories are defined in [backend/src/config/topics.json](backend/src/config/topics.json);
feeds live in [backend/src/services/RSSParser.ts](backend/src/services/RSSParser.ts).

## Setup

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for the full runbook (Neon database, GitHub
secrets, first run). Email configuration is covered in
**[EMAIL_SETUP_GUIDE.md](EMAIL_SETUP_GUIDE.md)**.

Quick version:

1. Create a free [Neon](https://neon.tech) Postgres database and copy its connection string
2. Get a free [Google AI Studio](https://aistudio.google.com) API key and a
   [Resend](https://resend.com) API key
3. Add these repository secrets: `DATABASE_URL`, `GEMINI_API_KEY`, `RESEND_API_KEY`,
   `EMAIL_FROM`, `EMAIL_TO`
4. Run the **DB Migrate** workflow once, then the **Daily Digest** workflow

## Local development

```bash
cd backend
npm install
cp .env.example .env      # fill in your keys
npm run task -- digest    # run the whole pipeline once
```

Individual steps: `npm run task -- aggregate | summarize | email`.

There is also an Express API and a small React dashboard (`frontend/`) used during local
development; the deployed system does not need them.

## Tech stack

TypeScript · Node.js · PostgreSQL (Neon) · Google Gemini · Resend · GitHub Actions

## Documentation

| File | Purpose |
|------|---------|
| [DEPLOYMENT.md](DEPLOYMENT.md) | Cloud setup and scheduling runbook |
| [EMAIL_SETUP_GUIDE.md](EMAIL_SETUP_GUIDE.md) | Resend configuration and troubleshooting |
| [CLAUDE.md](CLAUDE.md) | Architecture and developer guide |

## License

MIT
