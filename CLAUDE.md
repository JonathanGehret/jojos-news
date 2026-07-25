# Jojo's News - Developer Guide (CLAUDE.md)

**Purpose**: Comprehensive documentation for Claude Code and future developers working on this project.

---

## Project Overview

**Jojo's News** is an AI-powered daily news aggregation and email delivery system.

**Core Function**:
1. Aggregate news from RSS, Twitter/X, and Reddit (every 6 hours)
2. Summarize using Google Gemini (free tier) — or local Ollama/Mistral — at 5 AM Berlin time
3. Send curated email digest (6 AM Berlin time)

**Status**: Email delivery working (Resend) — choosing summarization LLM for cloud, then Phase 5 deploy

---

## Architecture

### System Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     NEWS AGGREGATION                         │
│  Every 6h: RSS + Twitter + Reddit → news_items table       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   SUMMARIZATION (5 AM)                       │
│  Filter by daily topic → Ollama/Mistral → summaries table   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   EMAIL DELIVERY (6 AM)                      │
│  Format HTML → Resend API → email_logs table → USER INBOX   │
└─────────────────────────────────────────────────────────────┘
```

### Scheduled Jobs

**AggregationScheduler** (src/jobs/aggregationScheduler.ts)
- Cron: 0 0/6 * * * (UTC) = 00:00, 06:00, 12:00, 18:00 UTC
- Calls NewsAggregator.aggregate()
- Fetches from all 3 sources in parallel
- Stores ~150 items to news_items table

**SummarizationScheduler** (src/jobs/summarizationScheduler.ts)
- Cron: 0 3 * * * (UTC) = 5 AM Berlin time
- Calls SummarizationService.generateDailySummaries()
- Generates one summary per category (all categories, every day)
- Batches items for Ollama processing
- Stores ~2 summaries to summaries table

**DailyEmailJob** (src/jobs/dailyEmailJob.ts)
- Cron: 0 4 * * * (UTC) = 6 AM Berlin time
- Calls EmailSender.sendDailyEmail()
- Fetches today's summaries
- Formats HTML email
- Sends via Resend API
- Logs result to email_logs table

### Key Components

**Backend Services**

| Service | File | Purpose |
|---------|------|---------|
| NewsAggregator | src/services/NewsAggregator.ts | Orchestrates all 3 news sources |
| RSSParser | src/services/RSSParser.ts | Fetches and parses RSS feeds |
| TwitterClient | src/services/TwitterClient.ts | Twitter/X API integration |
| RedditClient | src/services/RedditClient.ts | Reddit API integration |
| Summarizer | src/services/Summarizer.ts | Selects the LLM provider (Gemini/Ollama) via `LLM_PROVIDER` |
| GeminiClient | src/services/GeminiClient.ts | Google Gemini (free-tier) LLM interface |
| OllamaClient | src/services/OllamaClient.ts | Local Ollama LLM interface (offline fallback) |
| SummarizationService | src/services/SummarizationService.ts | AI summarization logic |
| EmailSender | src/services/EmailSender.ts | Resend email delivery |

**Database**

| Table | Columns | Purpose |
|-------|---------|---------|
| news_items | id, title, url, source, author, published_at, topic_tags, fetched_at | Raw news |
| summaries | id, date, day_of_week, topic_name, content, generated_at | Daily summaries |
| email_logs | id, date, recipient, subject, status, sent_at | Email tracking |
| user_preferences | id, keywords, exclude_keywords, preferred_sources, style | User config |

**Frontend Pages** (React + Vite)

| Page | File | Purpose |
|------|------|---------|
| Dashboard | src/pages/Dashboard.tsx | View today's summaries |
| Admin | src/pages/Admin.tsx | Configure preferences |
| Email Logs | src/pages/EmailLogs.tsx | Track email delivery |

---

## Workflows

### Adding a New News Source

1. Create new service in `src/services/` (e.g., `LinkedInClient.ts`)
   - Implement same interface as TwitterClient/RedditClient
   - Return array of NewsItem objects

2. Update NewsAggregator:
   ```typescript
   // src/services/NewsAggregator.ts
   const linkedinItems = await linkedInClient.fetch(keywords);
   const allItems = [...rssItems, ...twitterItems, ...redditItems, ...linkedinItems];
   ```

3. Update aggregation config:
   ```typescript
   // src/index.ts, line 204
   sources: ['rss', 'twitter', 'reddit', 'linkedin']
   ```

4. Add env vars for credentials in `.env`

### Customizing Categories

Every category is summarized **every day**. Edit `backend/src/config/topics.json`:

```json
{
  "categories": [
    {
      "id": "ai-tech",
      "name": "AI & Technology",
      "keywords": ["AI", "OpenAI", "Anthropic", "Nvidia"],
      "focus": "What belongs in this category — the LLM uses this to filter out
                keyword-matched items that don't actually fit."
    }
  ]
}
```

- `keywords` select news items via **whole-word** matching (a bare substring match
  would let "AI" hit "said"/"Ukraine" and "war" hit "award").
- `focus` is passed to the LLM to discard off-topic matches; if nothing fits it
  returns `NO_RELEVANT_NEWS` and the category is reported as "quiet" instead of
  padding the email with noise.
- Adding a category usually means adding an RSS feed in `RSSParser.ts` that
  actually carries that content.

### Changing Email Send Time

Edit `backend/src/jobs/dailyEmailJob.ts`:

```typescript
// Current: 0 4 * * * (6 AM Berlin = 4 AM UTC)
// Format: minute hour day month dayOfWeek
// Examples:
// 0 7 * * *  = 7 AM Berlin (5 AM UTC)
// 0 8 * * *  = 8 AM Berlin (6 AM UTC)

private cronPattern = '0 4 * * *';  // Change this
```

### Changing Email Domain (Resend)

1. Verify domain in Resend console: https://resend.com/domains
2. Update `.env`:
   ```env
   EMAIL_FROM=noreply@yourdomain.com  # Must match verified domain
   EMAIL_TO=your-email@example.com
   RESEND_API_KEY=re_xxxxxxxxxxxx
   ```

### Testing Email Sending

**Dry-run (preview only)**:
```bash
echo "DRY_RUN_EMAIL=true" >> backend/.env
curl -X POST http://localhost:3001/api/test/send-email
# Check logs for [DRY_RUN] message
```

**Real sending**:
```bash
echo "DRY_RUN_EMAIL=false" >> backend/.env
echo "RESEND_API_KEY=re_xxxxxxxxxxxx" >> backend/.env
curl -X POST http://localhost:3001/api/test/send-email
# Email should arrive in inbox within 30 seconds
```

---

## Development Workflow

### Local Development

```bash
# 1. Start infrastructure
docker-compose up -d

# 2. Database migrations
cd backend
npm run db:migrate

# 3. Start backend (runs schedulers automatically)
npm run dev

# 4. Start frontend (new terminal)
cd frontend
npm run dev

# 5. Open http://localhost:5173
```

### Testing Changes

**Option 1: Automated Validator**
```bash
./scripts/phase4-test.ps1  # Windows
./scripts/phase4-test.sh   # Linux/macOS
```

**Option 2: Manual Testing**
```bash
# Test aggregation
curl -X POST http://localhost:3001/api/test/aggregate-news

# Test summarization
curl -X POST http://localhost:3001/api/test/generate-summaries

# Test email
curl -X POST http://localhost:3001/api/test/send-email

# View results
curl http://localhost:3001/api/news-items
curl http://localhost:3001/api/summaries
curl http://localhost:3001/api/logs
```

### Database Inspection

```bash
# Connect to PostgreSQL
psql -U postgres -d jojos_news

# Check tables
\dt

# View news items
SELECT COUNT(*), source FROM news_items GROUP BY source;

# View summaries
SELECT day_of_week, topic_name, LENGTH(content) FROM summaries;

# View email logs
SELECT date, status, COUNT(*) FROM email_logs GROUP BY date, status;
```

### Debugging

**Backend Logs**
```bash
# Terminal running `npm run dev` shows all logs
# Look for:
# - ✓ Server running on port 3001
# - ✓ News aggregation scheduler started
# - Manual aggregation triggered via API
# - Collected X news items
```

**Frontend Logs**
- Browser console (F12 → Console tab)
- Network tab for API requests

**Docker Logs**
```bash
docker-compose logs postgres   # Database
docker-compose logs ollama     # LLM service
docker-compose logs -f         # All containers
```

---

## Key Files & Their Purposes

### Backend Entry Point
- **src/index.ts**: Express app, all API routes, scheduler initialization

### Schedulers
- **src/jobs/aggregationScheduler.ts**: Every 6 hours
- **src/jobs/summarizationScheduler.ts**: 5 AM daily
- **src/jobs/dailyEmailJob.ts**: 6 AM daily

### Services (Business Logic)
- **src/services/NewsAggregator.ts**: Orchestrates 3 news sources
- **src/services/RSSParser.ts**: RSS feed parsing
- **src/services/TwitterClient.ts**: Twitter/X API
- **src/services/RedditClient.ts**: Reddit API
- **src/services/OllamaClient.ts**: Ollama LLM interface
- **src/services/SummarizationService.ts**: Summary generation
- **src/services/EmailSender.ts**: Resend email delivery

### Database
- **src/database/connection.ts**: PostgreSQL pool
- **src/database/schema.sql**: Database schema
- **src/database/migrate.ts**: Migration runner
- **src/database/seed.ts**: Seeding initial data

### Configuration
- **src/config/topics.json**: Daily topic definitions
- **src/config/rssFeeds.json**: RSS feed URLs

### Frontend
- **src/pages/Dashboard.tsx**: View summaries
- **src/pages/Admin.tsx**: Preferences
- **src/pages/EmailLogs.tsx**: Email tracking

---

## Environment Setup

### Required Variables

```env
# Server
PORT=3001
NODE_ENV=development

# Database (docker-compose provides these)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=jojos_news
DB_USER=postgres
DB_PASSWORD=postgres

# Summarization LLM: "gemini" (cloud, free) or "ollama" (local).
# Auto-selects gemini when GEMINI_API_KEY is set, else ollama.
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key   # free key: https://aistudio.google.com
GEMINI_MODEL=gemini-flash-latest

# Ollama (local fallback; docker-compose provides this)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral

# Email - MUST SET THESE (see EMAIL_SETUP_GUIDE.md)
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=noreply@example.com
EMAIL_TO=your-email@example.com
DRY_RUN_EMAIL=true  # Start with true, change to false when verified
```

### Optional Variables

```env
# Twitter/X API (not blocking - system works without these)
X_BEARER_TOKEN=xxxxxxxx

# Reddit API (not blocking - system works without these)
REDDIT_CLIENT_ID=xxxxxxxx
REDDIT_CLIENT_SECRET=xxxxxxxx
REDDIT_USERNAME=xxxx
REDDIT_PASSWORD=xxxx
```

---

## Common Tasks

### Fix Database Schema Issues

```bash
# Reset database (CAREFUL - deletes all data)
psql -U postgres -c "DROP DATABASE jojos_news;"
psql -U postgres -c "CREATE DATABASE jojos_news;"

# Re-run migrations
npm run db:migrate

# Seed initial data
npm run db:seed
```

### Restart Services

```bash
# Stop everything
docker-compose down

# Start fresh
docker-compose up -d

# Restart backend
npm run dev
```

### Download Ollama Model

```bash
# If mistral model is missing
docker exec ollama ollama pull mistral

# List available models
docker exec ollama ollama list
```

### Check Service Health

```bash
# API health
curl http://localhost:3001/health

# Database
psql -U postgres -d jojos_news -c "SELECT 1;"

# Ollama
curl http://localhost:11434/api/tags

# Resend (requires valid API key)
curl -H "Authorization: Bearer $RESEND_API_KEY" https://api.resend.com/audiences
```

---

## Code Style & Standards

### TypeScript
- Use strict typing (no `any` unless absolutely necessary)
- Interfaces over type aliases for object shapes
- Use meaningful variable names
- Return types on all functions

### Error Handling
- Try-catch for async operations
- Meaningful error messages
- Log errors before throwing/returning
- Don't suppress errors unless intentional

### Comments
- Only comment WHY, not WHAT
- Keep comments up-to-date when code changes
- Remove commented-out code

### Git Commits
- Descriptive commit messages (reference phase/feature)
- Include Co-Author if pair programming
- Format: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`

---

## Troubleshooting Guide

### "Server is not responding"
```bash
# Check if backend is running
ps aux | grep "node\|ts-node"

# Check port 3001 is available
netstat -ano | findstr :3001

# Check backend logs
cd backend && npm run dev
```

### "Database connection failed"
```bash
docker-compose logs postgres
# Ensure PostgreSQL is running
docker-compose up -d postgres
```

### "Ollama not responding"
```bash
docker-compose logs ollama
docker exec ollama ollama list  # Check if mistral is installed
docker exec ollama ollama pull mistral  # Download if missing
```

### "Summaries not generating"
```bash
# Check news items exist
curl http://localhost:3001/api/news-items?limit=1

# Check Ollama logs
docker-compose logs ollama

# Test Ollama directly
curl -X POST http://localhost:11434/api/generate -d '{"model":"mistral","prompt":"Test"}'
```

### "Email not sending"
```bash
# Check if dry-run is interfering
grep DRY_RUN_EMAIL backend/.env

# Check Resend API key
grep RESEND_API_KEY backend/.env

# Check email domain is verified in Resend console
# https://resend.com/domains

# View email logs
curl http://localhost:3001/api/logs
```

---

## Testing

### Running Phase 4 Validator

```bash
# All-in-one test suite
./scripts/phase4-test.ps1        # Windows
./scripts/phase4-test.sh         # Linux/macOS

# What it tests:
# 1. News aggregation (2-5s)
# 2. Summarization (15-30s)
# 3. Email service config (1-2s)
# 4. Full pipeline (25-40s)
# 5. Scheduler health (1s)
```

### Manual API Testing

```bash
# Check health
curl http://localhost:3001/health

# Get today's summaries
curl http://localhost:3001/api/summaries

# Get recent news
curl http://localhost:3001/api/news-items?limit=5

# Get email logs
curl http://localhost:3001/api/logs?limit=10

# Get preferences
curl http://localhost:3001/api/preferences
```

### Frontend Testing

```bash
# Start dev server
cd frontend && npm run dev

# Open http://localhost:5173

# Test each page:
# 1. Dashboard - should show today's summaries
# 2. Admin - should show preference form
# 3. Email Logs - should show delivery history
```

---

## Performance Considerations

### News Aggregation
- Fetches 3 sources in parallel (RSS fastest, Twitter/Reddit slower)
- Stores ~150 items per run
- Deduplicates by URL (prevents duplicates)
- Indexes: source, fetched_at for query performance

### Summarization
- Batches items (~50 per batch) to stay within Ollama token limits
- Ollama runs locally (no API latency)
- Mistral model ~15-30s per batch
- Generates one summary per category per day (6 categories, one Gemini call each)
- Thinking is kept minimal via `thinkingConfig: { thinkingLevel: 'low' }`. Thinking
  tokens bill against `maxOutputTokens` and were truncating summaries mid-sentence.
  Do **not** use `thinkingBudget: 0` — Gemini 3.x rejects it with a 400, which silently
  killed every summary when the `gemini-flash-latest` alias rolled forward. The client
  falls back to omitting `thinkingConfig` on any 400 so a future roll-forward degrades
  instead of breaking the digest.
- Each story is assigned to exactly **one** category (highest keyword-match score, ties
  to the earlier category in `topics.json`), so nothing is summarized twice in an email.
  Summarized stories get `news_items.digested_at` set so they can't return in a later one.

### Email Delivery
- Single email per day to one recipient
- Resend API typically completes in <1s
- Email arrives within 30 seconds

### Database
- PostgreSQL on localhost (no network latency)
- News items: 600-1000 per week (~150 per 6h aggregation)
- Summaries: 2 per day (~60 per month)
- Email logs: 1 per day (~30 per month)

---

## Security Notes

### Current State
- No user authentication (all endpoints public)
- Email credentials in .env (git-ignored)
- Ollama runs on localhost only
- Database password in .env (git-ignored)

### Before Production
- [ ] Implement user authentication
- [ ] Add API key validation
- [ ] Use secrets manager (not .env files)
- [ ] Enable HTTPS
- [ ] Rate limit public endpoints
- [ ] Audit database access logs

---

## Future Enhancements

### Phase 5: Cloud Deployment ⭐ (PRIORITY)
Deploy to production cloud server - system will run 24/7 without local PC

**Infrastructure Options**:
- AWS EC2 + RDS + Docker
- DigitalOcean + Managed Postgres
- Heroku (easiest, ~$50/month)
- Railway.app or Render (alternative PaaS)

**Required Work**:
- Set up cloud server & database
- Create production Dockerfile
- Configure environment for production
- Set up monitoring & alerting
- Enable automatic restarts
- Configure SSL/TLS

**Estimated Time**: 1-2 weeks (includes testing)

### Phase 6: Dashboard Enhancement
- Real-time summary updates
- Email preference UI
- Aggregation trend analytics
- Email delivery statistics
- Add charts with recharts/D3.js

### Phase 7: Advanced Features
- User authentication system
- Per-user topic customization
- SMS delivery option (Twilio)
- Slack integration
- Real-time news updates (WebSocket)

---

## Quick Reference

### Start All Services
```bash
docker-compose up -d && cd backend && npm run dev
```

### Run Tests
```bash
./scripts/phase4-test.ps1  # Windows
./scripts/phase4-test.sh   # Linux/macOS
```

### View Logs
```bash
docker-compose logs -f        # All containers
npm run dev                   # Backend logs
curl http://localhost:3001/api/logs  # Email logs
```

### Emergency Stop
```bash
docker-compose down           # Stop all containers
pkill -f "npm run dev"       # Kill backend process
```

---

## Getting Help

1. Check `CURRENT_STATE.md` for project status
2. Check `EMAIL_SETUP_GUIDE.md` for email configuration
3. Check `HANDOFF.md` for the Phase 5+ roadmap
4. Review backend logs: `npm run dev` output
5. Check database: `psql -d jojos_news -c "SELECT ..."`

---

**Last Updated**: 2026-07-10  
**Status**: Email delivery working (Resend) — choosing summarization LLM for cloud, then Phase 5 deploy
