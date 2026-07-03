# Phase 4: Email Delivery - Complete Testing Guide ✅

## Overview

Phase 4 validates the complete end-to-end pipeline:
```
Aggregation → Summarization → Email Delivery
```

We'll test each component individually, then run the full pipeline.

---

## 📋 Pre-Test Checklist

### ✅ Infrastructure Running
```bash
docker-compose up -d
docker-compose logs -f
```

Expected output:
```
postgres_1     | database system is ready to accept connections
ollama_1       | listening on [::]:11434
```

### ✅ Backend Running
```bash
cd backend
npm run dev
```

Expected output:
```
✓ Server running on port 3001
✓ News aggregation scheduler started
✓ Summarization scheduler started
✓ Daily email job scheduler started
```

### ✅ Environment Setup
Verify `.env` has these variables:
```env
# Resend Configuration
RESEND_API_KEY=re_xxxxxxxxxxxx  # Get from https://resend.com/api-keys
EMAIL_FROM=noreply@yourdomain.com  # Must be verified in Resend
EMAIL_TO=your-email@example.com  # Where to send test emails

# Other Required
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral
```

### ✅ Database Schema
```bash
cd backend
npm run db:migrate
```

Check tables exist:
```sql
psql -U postgres -d jojos_news -c "\dt"
```

---

## 🧪 Test 1: Verify Aggregation Works

### Step 1: Trigger Aggregation Manually

```bash
curl -X POST http://localhost:3001/api/test/aggregate-news
```

**Expected Response**:
```json
{
  "message": "News aggregation executed successfully",
  "itemsCollected": 150,
  "timestamp": "2024-07-03T..."
}
```

### Step 2: Check Aggregated News

```bash
curl "http://localhost:3001/api/news-items?limit=5&offset=0"
```

**Expected Output**: 5 news items with titles, sources, URLs

### Step 3: Verify in Database

```bash
psql -U postgres -d jojos_news -c "
  SELECT COUNT(*), source 
  FROM news_items 
  WHERE fetched_at >= NOW() - INTERVAL '1 hour' 
  GROUP BY source;
"
```

**Expected Output**:
```
 count | source
-------+--------
    45 | rss
    30 | twitter
    25 | reddit
```

### ✅ Test 1 PASS if:
- ✓ API returns item count > 0
- ✓ GET /api/news-items shows articles
- ✓ Database query shows items from all sources

---

## 🧪 Test 2: Verify Summarization Works

### Step 1: Trigger Summarization Manually

```bash
curl -X POST http://localhost:3001/api/test/generate-summaries
```

**Expected Response**:
```json
{
  "message": "Summarization executed successfully",
  "summariesGenerated": 2,
  "dayOfWeek": "Wednesday",
  "topicName": "Musk, Trump & AI Tech",
  "timestamp": "2024-07-03T..."
}
```

**⏱️ Note**: This will take 10-30 seconds (Ollama processing)

### Step 2: Check Generated Summaries

```bash
curl "http://localhost:3001/api/summaries?date=2024-07-03"
```

**Expected Output**: Summaries with topic names and content

### Step 3: Verify in Database

```bash
psql -U postgres -d jojos_news -c "
  SELECT id, date, day_of_week, topic_name, LENGTH(content) as char_count
  FROM summaries
  WHERE date = CURRENT_DATE
  ORDER BY generated_at DESC;
"
```

**Expected Output**:
```
                  id                  |    date    | day_of_week |    topic_name    | char_count
--------------------------------------+------------+-------------+------------------+----------
 a1b2c3d4-e5f6-47g8-h9i0-j1k2l3m4n5o6 | 2024-07-03 | Wednesday   | Musk, Trump & AI | 1250
```

### ✅ Test 2 PASS if:
- ✓ API returns summariesGenerated > 0
- ✓ GET /api/summaries shows content
- ✓ Database has summaries for today

---

## 🧪 Test 3: Verify Email Service Ready

### Step 1: Check Resend Configuration (Optional)

If you have a Resend API key:

```bash
curl --request GET \
  --url https://api.resend.com/audiences \
  --header "Authorization: Bearer $RESEND_API_KEY"
```

Should return your Resend account info.

### Step 2: Verify Email Templates

Check the EmailSender code:
```bash
grep -n "buildEmailHTML\|generateTemplate" backend/src/services/EmailSender.ts | head -20
```

Should show email template functions exist.

### Step 3: Dry-Run Email (No Actual Send)

```bash
# Set this in .env temporarily to test without sending
export DRY_RUN_EMAIL=true
```

Then trigger email job:
```bash
curl -X POST http://localhost:3001/api/test/send-email
```

Check backend logs for:
```
[DRY_RUN] Would send email to: your-email@example.com
```

### ✅ Test 3 PASS if:
- ✓ No errors in backend logs
- ✓ Email template functions exist
- ✓ Dry-run shows email would be sent

---

## 🧪 Test 4: Full Pipeline (Aggregation → Summarization → Email)

### Step 1: Clear Today's Data (Fresh Start)

```bash
psql -U postgres -d jojos_news -c "
  DELETE FROM summaries WHERE date = CURRENT_DATE;
  DELETE FROM email_logs WHERE date = CURRENT_DATE;
  DELETE FROM news_items WHERE fetched_at >= NOW() - INTERVAL '2 hours';
"
```

### Step 2: Run Aggregation

```bash
curl -X POST http://localhost:3001/api/test/aggregate-news
```

Wait for response. Check logs for item count.

### Step 3: Run Summarization

```bash
curl -X POST http://localhost:3001/api/test/generate-summaries
```

Wait 20-30 seconds. Should see:
```
✓ Generated 2 summary(ies) for Wednesday: Musk, Trump & AI Tech
```

### Step 4: Run Email Job (DRY-RUN)

```bash
# Make sure dry-run is enabled first
curl -X POST http://localhost:3001/api/test/send-email
```

Check logs for:
```
Starting daily email generation and sending...
Sending email with 2 summary(ies)...
[DRY_RUN] Would send email to: your-email@example.com
✓ Daily email sent successfully
```

### Step 5: Verify Email Log

```bash
curl "http://localhost:3001/api/logs?limit=5"
```

**Expected Output**:
```json
{
  "items": [
    {
      "id": "...",
      "date": "2024-07-03",
      "recipient": "your-email@example.com",
      "subject": "Jojo's News Digest - Wednesday, July 3",
      "status": "sent",
      "sent_at": "2024-07-03T..."
    }
  ]
}
```

### ✅ Test 4 PASS if:
- ✓ Aggregation returns items > 0
- ✓ Summarization returns summaries > 0
- ✓ Email job completes without errors
- ✓ Email log shows "sent" status

---

## 🧪 Test 5: Real Email Delivery (If You Have Resend Key)

### ⚠️ Prerequisites
- Resend account: https://resend.com (free tier available)
- API key generated and added to `.env`
- Email domain verified in Resend console

### Step 1: Enable Real Email Sending

```bash
# In .env, set:
DRY_RUN_EMAIL=false
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com  # Must be verified
EMAIL_TO=your-email@example.com
```

### Step 2: Trigger Email Job

```bash
curl -X POST http://localhost:3001/api/test/send-email
```

Check logs:
```
✓ Daily email sent successfully
```

### Step 3: Check Your Inbox

Should receive email in 10-30 seconds with:
- Subject: "Jojo's News Digest - Wednesday, July 3"
- HTML content with summaries
- Professional formatting with Jojo's branding

### Step 4: Verify in Email Logs

```bash
curl "http://localhost:3001/api/logs?limit=1"
```

Status should be "sent" (not "pending" or "failed")

### ✅ Test 5 PASS if:
- ✓ Email arrives in inbox
- ✓ Email has correct subject and content
- ✓ Email_logs shows status "sent"

---

## 🧪 Test 6: Verify Scheduling (Optional)

### Monitor Aggregation Scheduler

Leave backend running and watch logs:
```bash
npm run dev 2>&1 | grep "aggregation\|news"
```

Should see automatic aggregation every 6 hours at:
- 00:00, 06:00, 12:00, 18:00 UTC

### Monitor Summarization Scheduler

Watch logs for 5 AM Berlin time:
```bash
npm run dev 2>&1 | grep "summarization\|Generating"
```

### Monitor Email Scheduler

Watch logs for 6 AM Berlin time:
```bash
npm run dev 2>&1 | grep "email\|Running daily"
```

### ✅ Test 6 PASS if:
- ✓ Logs show automatic job execution
- ✓ Jobs run at configured times
- ✓ No errors in scheduler execution

---

## 📊 Testing Summary Checklist

Run these in order and mark as complete:

- [ ] **Test 1**: Aggregation works - News items collected
- [ ] **Test 2**: Summarization works - Summaries generated
- [ ] **Test 3**: Email service ready - Templates and config verified
- [ ] **Test 4**: Full pipeline - Aggregation → Summarization → Email
- [ ] **Test 5** (Optional): Real email delivery - Email received in inbox
- [ ] **Test 6** (Optional): Scheduling - Automatic jobs running

---

## 🔴 Troubleshooting

### Issue: "No news items found"
```bash
# Check if aggregation ran
curl "http://localhost:3001/api/news-items?limit=1"

# If empty, check backend logs for aggregation errors
# Ensure RSS feeds are accessible (no auth needed)
# Check OLLAMA_BASE_URL in .env
```

### Issue: "Ollama connection failed"
```bash
# Check Ollama container
docker-compose logs ollama

# Verify model is downloaded
docker exec ollama ollama list

# Should show "mistral" in the list
```

### Issue: "Email send failed"
```bash
# Check Resend credentials
echo $RESEND_API_KEY

# Verify EMAIL_FROM domain is verified in Resend console
# Check backend logs for Resend API errors
```

### Issue: "Summaries table empty"
```bash
# Check if news items exist first
SELECT COUNT(*) FROM news_items WHERE fetched_at >= NOW() - INTERVAL '24 hours';

# If yes, trigger summarization again:
curl -X POST http://localhost:3001/api/test/generate-summaries

# Check backend logs for Ollama errors
```

---

## ✨ Success Criteria

Phase 4 is **COMPLETE** when:

✅ **Aggregation**: Fetches 50+ news items from multiple sources
✅ **Summarization**: Generates 2+ summaries without errors
✅ **Email (Dry-run)**: Processes email job successfully
✅ **Email (Real)**: Email arrives in inbox (if Resend configured)
✅ **Logging**: All actions tracked in database
✅ **No Errors**: Backend logs show clean execution

---

## 📚 Reference

| Component | Status | Command |
|-----------|--------|---------|
| News Items | GET | `curl http://localhost:3001/api/news-items?limit=5` |
| Summaries | GET | `curl http://localhost:3001/api/summaries` |
| Email Logs | GET | `curl http://localhost:3001/api/logs` |
| Aggregate | Trigger | `curl -X POST http://localhost:3001/api/test/aggregate-news` |
| Summarize | Trigger | `curl -X POST http://localhost:3001/api/test/generate-summaries` |
| Send Email | Trigger | `curl -X POST http://localhost:3001/api/test/send-email` |
| Health | Check | `curl http://localhost:3001/health` |

---

## 🚀 Next Steps

Once Phase 4 is complete:
- ✅ All core systems tested and working
- ✅ Email delivery verified (dry-run or real)
- ✅ Ready for continuous operation

Next: **Phase 5 (Dashboard Enhancement)** or **Phase 6 (Deployment)**

---

**Ready to test? Let's go! 🎯**
