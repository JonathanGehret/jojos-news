# Setup Guide - Jojo's News Aggregator

This guide will help you get the news aggregator up and running from scratch.

## Step 1: Prerequisites

### Required Software
- **Node.js 18+** - Download from https://nodejs.org
- **npm** - Included with Node.js
- **Docker Desktop** - Download from https://docker.com/products/docker-desktop
- **Git** (optional) - For version control

### Required Accounts & Keys
1. **Resend API Key** (for email)
   - Sign up at https://resend.com
   - Get API key from dashboard
   
2. **Twitter/X API** (optional for real-time news)
   - Apply at https://developer.twitter.com/en/portal/dashboard
   - Requires elevated access (can take a few weeks)
   
3. **Reddit API** (optional for Reddit news)
   - Create app at https://www.reddit.com/prefs/apps
   - Note: client_id, client_secret, username, password

## Step 2: Clone & Initial Setup

```bash
# Navigate to your dev folder
cd d:\dev\jojos-news

# Copy environment template and edit it
copy backend\.env.example backend\.env

# Edit backend/.env in your favorite editor
# Update the following with your actual values:
#   - RESEND_API_KEY
#   - X_API_KEY, X_API_SECRET, X_BEARER_TOKEN (optional)
#   - REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, etc. (optional)
#   - EMAIL_TO (your email address)
```

## Step 3: Start Infrastructure

### Start PostgreSQL and Ollama

```bash
# Start Docker containers
docker-compose up -d

# Verify containers are running
docker ps

# Check if they're healthy
docker-compose logs
```

### Download Ollama Model

The first time Ollama runs, you need to download a language model.

**Option A: Using Ollama CLI (if installed locally)**
```bash
ollama pull mistral
```

**Option B: Inside Docker Container**
```bash
# Exec into container
docker exec -it jojos-news-ollama bash

# Pull model
ollama pull mistral

# Exit
exit
```

Wait for the model download to complete (~4GB for Mistral). You'll see output like:
```
pulling manifest
pulling 2c4db0e2f4ad... 100% ▕███████████████████████████████████████░░░░░ 5.0/5.4 GB
```

## Step 4: Setup Backend

```bash
# Navigate to backend folder
cd backend

# Install dependencies
npm install

# Run database migrations (creates tables)
npm run db:migrate

# Start development server
npm run dev
```

You should see output like:
```
✓ Server running on port 3001
✓ Daily email job scheduler started
```

**In a new terminal**, verify the server is healthy:
```bash
curl http://localhost:3001/health

# Should return something like:
# {
#   "status": "ok",
#   "database": "connected",
#   "ollama": "connected",
#   "timestamp": "..."
# }
```

## Step 5: Setup Frontend

```bash
# Open a new terminal
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

You should see:
```
  VITE v4.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

## Step 6: Verify Everything Works

### Test the Web Interface
1. Open http://localhost:5173 in your browser
2. You should see the "Jojo's News Digest" dashboard
3. Try clicking different tabs:
   - **Dashboard** - Should be empty (no summaries yet)
   - **Admin** - Configure preferences here
   - **Email Logs** - Should be empty

### Test Email Sending

```bash
# In another terminal, trigger an email manually
curl -X POST http://localhost:3001/api/test/send-email

# Check response (should say success)
```

Then check:
1. **Email Logs tab** - You should see an entry with status "sent"
2. **Check your email** - You should receive the test email (check spam if not in inbox)
3. **Dashboard** - Refresh and you should see today's summary

## Step 7: Configure Topics (Optional)

To customize what news topics are featured each day:

1. Edit `backend/src/config/topics.json`
2. For example, change Monday's keywords:
   ```json
   "monday": {
     "name": "Custom Topics",
     "keywords": ["your", "custom", "keywords"],
     "focus": "Your custom description"
   }
   ```
3. Restart backend: `npm run dev` in backend terminal
4. Next email send will use new topics

## Step 8: Schedule Daily Emails

The system will automatically send emails at **6 AM Berlin time** every day.

To test different times during development, edit `backend/.env`:

```env
# Test every 5 minutes during development
EMAIL_SEND_TIME=*/5 * * * *

# Back to daily at 6 AM when done testing
EMAIL_SEND_TIME=0 6 * * *
```

## Troubleshooting

### Port Already in Use
- Backend uses port 3001, Frontend uses 5173
- If in use, change `PORT` in backend/.env or modify Vite config

### Docker Container Won't Start
```bash
# Check logs
docker-compose logs postgres
docker-compose logs ollama

# Restart
docker-compose restart

# Or rebuild
docker-compose down
docker-compose up -d
```

### "Cannot connect to database"
```bash
# Ensure database migration ran
cd backend && npm run db:migrate

# Check PostgreSQL is running
docker ps | grep postgres
```

### "Ollama connection failed"
```bash
# Ensure Ollama is running and model is downloaded
docker exec jojos-news-ollama ollama list

# If no models, download one:
docker exec jojos-news-ollama ollama pull mistral

# Check connection
curl http://localhost:11434/api/tags
```

### Email Not Sending
1. Verify Resend API key in `.env` is correct
2. Check email address in `EMAIL_TO` is valid
3. Look at backend console for error messages
4. Set `DRY_RUN_EMAIL=true` temporarily to see mock behavior

### No News Items Appearing
- Twitter/RSS/Reddit integrations are placeholders
- They'll need to be implemented with actual API calls
- Currently the system will generate summaries from mock data

## Production Deployment

For deploying to production:

1. **Backend**: Deploy to Heroku, Railway, Fly.io, or your own VPS
   - Run migrations: `npm run db:migrate`
   - Set environment variables on hosting platform
   - Use proper database connection string

2. **Frontend**: Deploy to Vercel, Netlify, or GitHub Pages
   - Build: `npm run build`
   - Deploy `dist/` folder

3. **Ollama**: Run on separate GPU machine or use cloud API
   - Or use commercial LLM APIs (OpenAI, etc.)

## Next Steps

1. ✅ System is running - Verify everything works
2. 📰 **Optional**: Implement real Twitter/RSS/Reddit APIs (see Phase 2 in main README)
3. 👤 **Optional**: Add user authentication for per-user preferences
4. 🚀 **Optional**: Deploy to production

## Questions?

Check the main [README.md](../README.md) for more details on:
- Architecture overview
- API documentation
- Development guide
- Contributing guidelines

---

**Happy news aggregating!** 📰✨
