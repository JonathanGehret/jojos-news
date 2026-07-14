# Jojo's News Aggregator

An AI-powered daily news ticker that aggregates from multiple sources (Twitter/X, RSS, Reddit), summarizes with Ollama, and sends curated emails daily at 6 AM Berlin time.

## Features

✨ **Core Features**
- 📰 Multi-source news aggregation (Twitter/X, RSS feeds, Reddit)
- 🤖 AI-powered summarization using Ollama (local, privacy-first)
- ✉️ Daily email delivery at 6 AM Berlin time via Resend
- 📊 Web dashboard to view summaries and email logs
- ⚙️ Admin panel for customizing topic focus and preferences
- 📅 **Full palette every day** — one summary per category, daily (10 categories):
  AI & Technology (incl. AI in games) · Elon Musk & US Politics ·
  Science, Nature & Physics · German & EU Politics · World News · Investing & Markets ·
  Space & Astronomy · Health & Medicine · Geopolitics & Defense · Energy
  - Categories are defined in [backend/src/config/topics.json](backend/src/config/topics.json)
  - Categories with no notable news are skipped and listed as "quiet" in the email footer

## Project Structure

```
jojos-news/
├── backend/                    # Node.js + Express backend
│   ├── src/
│   │   ├── index.ts           # Main Express app entry
│   │   ├── services/          # Business logic
│   │   │   ├── NewsAggregator.ts
│   │   │   ├── OllamaClient.ts
│   │   │   └── EmailSender.ts
│   │   ├── jobs/
│   │   │   └── dailyEmailJob.ts  # Cron scheduler
│   │   ├── database/
│   │   │   ├── connection.ts
│   │   │   ├── schema.sql
│   │   │   ├── migrate.ts
│   │   │   └── seed.ts
│   │   ├── config/
│   │   │   ├── topics.json    # Daily topic configuration
│   │   │   └── rssFeeds.json  # RSS feed URLs
│   │   ├── routes/
│   │   └── types/
│   │       └── index.ts       # TypeScript interfaces
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── frontend/                   # React + TypeScript frontend
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx   # View summaries
│   │   │   ├── Admin.tsx       # Configure preferences
│   │   │   └── EmailLogs.tsx   # Email delivery logs
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── package.json
│   └── tsconfig.json
│
├── docker-compose.yml         # PostgreSQL + Ollama containers
├── README.md                  # This file
└── .gitignore
```

## Tech Stack

**Backend**
- Node.js 18+
- Express.js
- TypeScript
- PostgreSQL 15
- Node-cron (task scheduling)
- Resend (email delivery)
- Ollama (local LLM)

**Frontend**
- React 18
- TypeScript
- Vite (build tool)
- Tailwind CSS
- Axios (HTTP client)
- Lucide React (icons)

**Infrastructure**
- Docker & Docker Compose
- PostgreSQL database
- Ollama LLM service

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Docker & Docker Compose
- Resend API key (https://resend.com)
- X/Twitter API credentials (optional)
- Reddit API credentials (optional)

### 1. Clone & Setup

```bash
cd d:/dev/jojos-news

# Copy environment template
cp backend/.env.example backend/.env

# Edit .env with your credentials
nano backend/.env
```

### 2. Start Infrastructure (PostgreSQL + Ollama)

```bash
docker-compose up -d

# Wait for services to be healthy (check logs)
docker-compose logs -f
```

### 3. Download Ollama Model

```bash
# SSH into Ollama container or run on your machine if Ollama is installed locally
ollama pull mistral

# Or use another model (llama2, neural-chat, etc.)
```

### 4. Setup Backend

```bash
cd backend

# Install dependencies
npm install

# Run database migrations
npm run db:migrate

# Start development server (will run migrations and start cron job)
npm run dev
```

The backend will start on `http://localhost:3001`

### 5. Setup Frontend

```bash
# In another terminal
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

The frontend will start on `http://localhost:5173`

### 6. Test the System

1. Open http://localhost:5173 in your browser
2. Check the Dashboard tab (should be empty initially)
3. Go to Admin tab to configure topic keywords
4. Test email sending:
   ```bash
   curl -X POST http://localhost:3001/api/test/send-email
   ```
5. Check Email Logs tab for delivery status
6. View today's summary on Dashboard

## Environment Variables

### Backend (.env)

```env
# Server
PORT=3001
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=jojos_news
DB_USER=postgres
DB_PASSWORD=postgres

# News Source APIs
X_API_KEY=your_x_api_key
X_API_SECRET=your_x_api_secret
X_BEARER_TOKEN=your_x_bearer_token
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
REDDIT_USERNAME=your_reddit_username
REDDIT_PASSWORD=your_reddit_password

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral

# Email
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=noreply@jojos-news.com
EMAIL_TO=your-email@example.com

# Scheduling
EMAIL_SEND_TIME=0 6 * * *           # 6 AM daily (cron format)
EMAIL_TIMEZONE=Europe/Berlin
DRY_RUN_EMAIL=false                 # Set to true to preview emails without sending
```

## API Endpoints

### Dashboard
- `GET /api/summaries?date=2024-01-15` - Get summaries for a date

### News & Aggregation
- `GET /api/news-items?limit=50&offset=0&source=rss` - Get recent news items (RSS/Twitter/Reddit)
- `POST /api/test/aggregate-news` - Manually trigger news aggregation (testing)

### Admin
- `GET /api/preferences` - Get current preferences
- `PATCH /api/preferences` - Update preferences

### Logs
- `GET /api/logs?limit=20&offset=0` - Get email delivery logs

### Summarization
- `POST /api/test/generate-summaries` - Manually trigger summarization (testing)

### Testing
- `POST /api/test/send-email` - Manually trigger email job
- `POST /api/test/aggregate-news` - Manually trigger aggregation
- `POST /api/test/generate-summaries` - Manually trigger summarization

### Health
- `GET /health` - Check service health (database, Ollama)

## News Sources & APIs

### Aggregation Pipeline

The system uses a three-tier architecture for reliable news delivery:

**1. Aggregation (Every 6 Hours)**
- Fetches from RSS, Twitter, and Reddit in parallel
- Stores raw news items to `news_items` table
- Deduplicates by URL to avoid duplicates
- Keyword-based tagging

**2. Summarization (5 AM Daily)**
- Fetches last 24 hours of news and splits it per category by keyword (whole-word match)
- Generates one summary per category; categories with no relevant news are skipped
- Batches items to stay within Ollama's token limits (~50 items per batch)
- Generates neutral, unbiased summaries using Ollama
- Stores summaries to `summaries` table

**3. Email Delivery (6 AM Daily)**
- Fetches pre-generated summaries from `summaries` table
- Formats into HTML email with branding
- Sends via Resend email service
- Logs delivery status to `email_logs` table

### Twitter/X (API)
- Requires elevated access Twitter API v2 account
- Credentials: X_BEARER_TOKEN in .env
- Fetches recent tweets by keywords (excludes retweets, English only)

### RSS Feeds
- 8+ pre-configured feeds (TechCrunch, Reuters, BBC, DW, Science Daily, MarketWatch, etc.)
- No authentication required
- Parses both RSS 2.0 and Atom formats

### Reddit
- Requires Reddit API app credentials
- Credentials: REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD
- Fetches hot posts from 11 subreddits (r/technology, r/worldnews, r/germany, etc.)

### How Aggregation Works
1. **Scheduler**: Runs every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
2. **Fetching**: Fetches from RSS (first), Twitter, and Reddit in parallel
3. **Filtering**: Matches keywords from daily topic configuration
4. **Deduplication**: Removes duplicates by URL
5. **Storage**: Saves to `news_items` table with source metadata
6. **Tagged**: Each item tagged with matched keywords and source

### Services & Classes

**TwitterClient** (`src/services/TwitterClient.ts`)
- Calls Twitter API v2 `/tweets/search/recent`
- Returns 50 tweets per keyword
- Graceful fallback if API not configured

**RSSParser** (`src/services/RSSParser.ts`)
- Fetches all configured feeds concurrently
- Parses RSS 2.0 and Atom formats with xml2js
- Extracts title, description, URL, author, publication date

**RedditClient** (`src/services/RedditClient.ts`)
- OAuth2 authentication with Reddit API
- Fetches hot posts from 11 subreddits
- Returns title, content, score, comments count

**NewsAggregator** (`src/services/NewsAggregator.ts`)
- Orchestrates all three clients
- Deduplicates by URL + source
- Stores to PostgreSQL database

**AggregationScheduler** (`src/jobs/aggregationScheduler.ts`)
- Cron job (every 6 hours, configurable)
- Tracks aggregation status in logs

Edit [backend/src/config/topics.json](backend/src/config/topics.json) to customize daily topics:

```json
{
  "monday": {
    "name": "Musk, Trump & AI Tech",
    "keywords": ["Musk", "Elon", "Trump", "AI"],
    "focus": "..."
  },
  ...
}
```

## RSS Feeds Configuration

Add or modify RSS feeds in [backend/src/config/rssFeeds.json](backend/src/config/rssFeeds.json):

```json
{
  "techFeeds": [
    {"name": "TechCrunch", "url": "...", "category": "tech"},
    ...
  ],
  ...
}
```

## Deployment

### Build Production

```bash
# Backend
cd backend
npm run build
npm start

# Frontend
cd frontend
npm run build
npm preview
```

### Docker Deployment (Future)

Create a multi-stage Dockerfile for production deployment.

## Troubleshooting

### Database Connection Failed
- Ensure PostgreSQL is running: `docker-compose logs postgres`
- Check credentials in `.env`
- Run migrations: `npm run db:migrate`

### Ollama Connection Failed
- Ensure Ollama container is running: `docker-compose logs ollama`
- Check if model is downloaded: `ollama list`
- Pull model: `ollama pull mistral`

### Email Not Sending
- Check Resend API key is valid
- Verify `DRY_RUN_EMAIL=false` in `.env`
- Check email logs: http://localhost:5173 → Email Logs tab
- Test manually: `curl -X POST http://localhost:3001/api/test/send-email`

### No News Items Aggregated
- API credentials may be invalid or rate-limited
- Check service logs for errors
- Currently, Twitter/Reddit/RSS integration is a placeholder; implement these services to fetch real data

## Next Steps (Future Enhancements)

- [ ] Implement per-user account system with authentication
- [ ] Per-user topic customization and preferences
- [ ] SMS delivery option
- [ ] Slack integration
- [ ] Real-time news updates (WebSocket)
- [ ] Advanced NLP topic classification
- [ ] Sentiment analysis
- [ ] Multi-language support
- [ ] Mobile app (React Native)
- [ ] Caching layer for faster queries
- [ ] Search functionality across news items

## Daily Topic Configuration

## Contributing

Contributions welcome! Please follow TypeScript/ESLint standards.

## License

MIT

---

**Questions or Issues?** Check the [docs/](docs/) folder or open an issue.
