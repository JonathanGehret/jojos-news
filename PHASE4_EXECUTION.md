# Phase 4: Email Delivery - Execution Guide 🚀

**Status**: Ready for Testing  
**Last Updated**: 2024-07-10  
**Components**: Aggregation ✅ | Summarization ✅ | Email Service ✅ | Schedulers ✅

---

## Quick Start

### 1️⃣ Start Infrastructure

```bash
docker-compose up -d
docker-compose logs -f
```

**Wait for these messages:**
```
postgres_1     | database system is ready to accept connections
ollama_1       | listening on [::]:11434
```

### 2️⃣ Start Backend Server

```bash
cd backend
npm install
npm run dev
```

**Expected output:**
```
✓ Server running on port 3001
✓ News aggregation scheduler started
✓ Summarization scheduler started
✓ Daily email job scheduler started
```

### 3️⃣ Run Phase 4 Validator

**Option A: PowerShell (Windows)**
```powershell
.\scripts\phase4-test.ps1
```

**Option B: Bash (Linux/macOS/WSL)**
```bash
chmod +x scripts/phase4-test.sh
./scripts/phase4-test.sh
```

**Option C: Manual TypeScript Execution**
```bash
cd backend
npx ts-node ../scripts/phase4-validator.ts
```

---

## What Gets Tested

The validator runs 5 comprehensive tests:

### ✅ Test 1: News Aggregation
- Triggers aggregation from RSS, Twitter, Reddit
- Verifies items are stored in database
- Shows sample article

**Time**: ~2-5 seconds

### ✅ Test 2: Summarization Service
- Checks if Ollama is responding
- Generates summaries using Mistral model
- Verifies summaries stored in database

**Time**: ~15-30 seconds (Ollama processing)

### ✅ Test 3: Email Service Configuration
- Verifies email preferences are set
- Checks email logging system
- Confirms Resend API key (if configured)

**Time**: ~1-2 seconds

### ✅ Test 4: Full Pipeline Integration
1. Aggregates news
2. Generates summaries
3. Sends email (dry-run or real)
4. Verifies email log

**Time**: ~25-40 seconds total

### ✅ Test 5: Scheduler Health Check
- Verifies backend is running
- Checks database connectivity
- Confirms Ollama availability

**Time**: ~1 second

---

## Environment Configuration

Create/update `.env` in backend directory:

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/jojos_news
DB_HOST=localhost
DB_PORT=5432
DB_NAME=jojos_news
DB_USER=postgres
DB_PASSWORD=password

# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral

# Email Configuration (Optional - for real sending)
RESEND_API_KEY=re_xxxxxxxxxxxx  # Get from https://resend.com
EMAIL_FROM=noreply@jojosnews.com  # Must be verified in Resend
EMAIL_TO=your-email@example.com

# API Configuration
PORT=3001
NODE_ENV=development

# Dry Run (set to false for real emails)
DRY_RUN_EMAIL=true
```

### 🔑 Getting a Resend API Key

1. Go to https://resend.com (free tier available)
2. Create account and verify email
3. Go to "API Keys" in settings
4. Generate new API key
5. Add to `.env` as `RESEND_API_KEY`
6. **Important**: Verify your email domain in Resend console

### 📧 Verifying Email Domain in Resend

1. Login to Resend console
2. Go to "Domains"
3. Add your domain (or use default `noreply@yourdomain.com`)
4. Add DNS records shown
5. Wait for verification (usually 5-10 minutes)
6. Update `EMAIL_FROM` in `.env`

---

## Manual Testing Steps

### Test Aggregation Manually

```bash
curl -X POST http://localhost:3001/api/test/aggregate-news
```

**Response:**
```json
{
  "message": "News aggregation executed successfully",
  "itemsCollected": 150,
  "timestamp": "2024-07-10T14:23:45.123Z"
}
```

### Check Aggregated News

```bash
curl "http://localhost:3001/api/news-items?limit=5"
```

### Generate Summaries

```bash
curl -X POST http://localhost:3001/api/test/generate-summaries
```

**Response (may take 10-30 seconds):**
```json
{
  "message": "Summarization executed successfully",
  "summariesGenerated": 2,
  "dayOfWeek": "Thursday",
  "topicName": "Tech, Politics & Markets",
  "timestamp": "2024-07-10T14:24:30.456Z"
}
```

### Send Email

```bash
# Dry-run (default)
curl -X POST http://localhost:3001/api/test/send-email

# Response:
# [DRY_RUN] Would send email to: your-email@example.com
```

### Check Email Logs

```bash
curl "http://localhost:3001/api/logs?limit=5"
```

**Response:**
```json
{
  "logs": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "date": "2024-07-10",
      "recipient": "your-email@example.com",
      "subject": "Jojo's News Digest - Thursday, July 10",
      "status": "sent",
      "sent_at": "2024-07-10T14:25:00.000Z"
    }
  ]
}
```

### Check Database Directly

```bash
# Connect to PostgreSQL
psql -U postgres -d jojos_news

# Check tables exist
\dt

# Count news items
SELECT COUNT(*) FROM news_items WHERE fetched_at >= NOW() - INTERVAL '1 hour';

# Check summaries
SELECT id, date, day_of_week, topic_name FROM summaries ORDER BY generated_at DESC LIMIT 5;

# Check email logs
SELECT * FROM email_logs ORDER BY date DESC LIMIT 5;
```

---

## Troubleshooting

### 🔴 "Server is not responding"

**Solution:**
```bash
# 1. Check if backend is running
ps aux | grep "node\|ts-node"

# 2. Check backend logs for errors
cd backend && npm run dev

# 3. Verify port 3001 is not in use
netstat -ano | findstr :3001  # Windows
lsof -i :3001                # Linux/macOS
```

### 🔴 "Docker containers not running"

**Solution:**
```bash
# Start containers
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs postgres
docker-compose logs ollama
```

### 🔴 "Ollama connection failed"

**Solution:**
```bash
# Check Ollama container
docker-compose logs ollama

# Verify Ollama is listening
curl http://localhost:11434/api/tags

# Download model if missing
docker exec ollama ollama pull mistral
```

### 🔴 "No news items collected"

**Solution:**
```bash
# Check if RSS feeds are accessible
curl https://news.ycombinator.com/rss

# Check for network issues in backend logs
# Ensure RSS feed URLs are correct in NewsAggregator.ts
```

### 🔴 "Summaries not generating"

**Solution:**
```bash
# Check news items exist first
curl "http://localhost:3001/api/news-items?limit=1"

# Check Ollama model
docker exec ollama ollama list | grep mistral

# If missing, pull it:
docker exec ollama ollama pull mistral
```

### 🔴 "Email send fails"

**Solution - Resend Not Configured:**
```bash
# Set to dry-run mode
echo "DRY_RUN_EMAIL=true" >> backend/.env

# Test again
curl -X POST http://localhost:3001/api/test/send-email
```

**Solution - Resend API Error:**
```bash
# Verify API key
echo $RESEND_API_KEY

# Check domain verification in Resend console
# https://resend.com/domains

# Check EMAIL_FROM matches verified domain
grep EMAIL_FROM backend/.env
```

---

## Success Indicators

You'll know Phase 4 is successful when you see:

### ✅ From Validator Output
```
Test 1: News Aggregation ................ ✓ (2.3s)
Test 2: Summarization Service ........... ✓ (22.1s)
Test 3: Email Service Configuration ..... ✓ (1.2s)
Test 4: Full Pipeline Integration ....... ✓ (28.4s)
Test 5: Scheduler Health Check .......... ✓ (0.8s)

Passed: 5/5
Failed: 0/5
Total time: 54.8s

🎉 All tests passed! Phase 4 validation complete!
```

### ✅ From Backend Logs
```
✓ Server running on port 3001
✓ News aggregation scheduler started
✓ Summarization scheduler started
✓ Daily email job scheduler started
Manual aggregation triggered via API
Collected 150 news items
Manual summarization triggered via API
Generated 2 summaries for Thursday
Starting daily email generation and sending...
✓ Daily email sent successfully
```

### ✅ From Database
```sql
jojos_news=# SELECT COUNT(*) FROM news_items WHERE fetched_at >= NOW() - INTERVAL '1 hour';
 count
-------
   150
(1 row)

jojos_news=# SELECT day_of_week, topic_name FROM summaries ORDER BY generated_at DESC LIMIT 2;
 day_of_week |      topic_name
-------------+--------------------
 Thursday    | Tech, Politics & AI
 Thursday    | Markets & Business
(2 rows)

jojos_news=# SELECT status, COUNT(*) FROM email_logs GROUP BY status;
 status | count
--------+-------
 sent   |    42
(1 row)
```

---

## Next Steps After Phase 4

Once all tests pass:

### 📊 Phase 5: Dashboard Enhancement
- Create admin dashboard to view logs
- Monitor aggregation trends
- Adjust email preferences
- Track email delivery stats

### 🚀 Phase 6: Deployment
- Deploy backend to production
- Set up SSL/TLS
- Configure production email domain
- Set up monitoring and alerting

### 🔄 Phase 7: Continuous Operation
- Monitor email delivery
- Track engagement metrics
- Adjust topics based on performance
- Scale infrastructure if needed

---

## Quick Reference

| Action | Command |
|--------|---------|
| Start Docker | `docker-compose up -d` |
| Start Backend | `cd backend && npm run dev` |
| Run Validator | `./scripts/phase4-test.ps1` or `./scripts/phase4-test.sh` |
| Check Health | `curl http://localhost:3001/health` |
| Get News Items | `curl http://localhost:3001/api/news-items?limit=5` |
| Get Summaries | `curl http://localhost:3001/api/summaries` |
| Trigger Aggregation | `curl -X POST http://localhost:3001/api/test/aggregate-news` |
| Trigger Summarization | `curl -X POST http://localhost:3001/api/test/generate-summaries` |
| Send Email | `curl -X POST http://localhost:3001/api/test/send-email` |
| View Email Logs | `curl http://localhost:3001/api/logs?limit=10` |
| Stop Docker | `docker-compose down` |

---

## Support

If you encounter issues:

1. **Check logs**: Backend logs will show detailed error messages
2. **Verify environment**: All variables in `.env` are correct
3. **Test components individually**: Run manual tests to isolate issues
4. **Check database**: Verify tables and data exist
5. **Docker health**: Ensure containers are running: `docker-compose ps`

---

**Phase 4 is complete when all 5 tests pass! 🎯**
