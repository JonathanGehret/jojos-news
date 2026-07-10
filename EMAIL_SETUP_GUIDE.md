# Email Setup Guide - How to Get Emails in Your Inbox

**Purpose**: Step-by-step guide to configure email delivery and start receiving daily news digests.

**Estimated Time**: 15-20 minutes  
**Status**: No coding required - just configuration!

---

## Overview

Your Jojo's News system is **ready to send emails**. All the backend code is done. You just need to:

1. ✅ **Create Resend account** (free tier available)
2. ✅ **Get API key** from Resend
3. ✅ **Verify email domain** in Resend console (or use default)
4. ✅ **Update `.env`** with credentials
5. ✅ **Test** that emails arrive

That's it! No coding needed. Let's do this.

---

## Step 1: Create Resend Account (2 minutes)

### 1.1 Go to Resend

Visit: https://resend.com

### 1.2 Sign Up

Click "Sign Up" and create account with:
- Email: `you@example.com` (your email)
- Password: Something secure
- Verify email

### 1.3 Your Dashboard

After signup, you'll see the Resend dashboard with:
- "API Keys" section
- "Domains" section  
- "Welcome" message

---

## Step 2: Get API Key (1 minute)

### 2.1 Navigate to API Keys

In Resend dashboard:
1. Click **"API Keys"** in the left sidebar
2. Or go to: https://resend.com/api-keys

### 2.2 Generate API Key

1. Click **"Create API Key"** button
2. Name it: `jojos-news` (or anything)
3. Click **"Create"**

### 2.3 Copy API Key

```
API Key: re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
                          ↑
                    (This is what you need)
```

⚠️ **Important**: Copy this immediately! You won't see it again.

---

## Step 3: Verify Email Domain (5-10 minutes)

### Option A: Use Default Domain (Easiest) ⭐

If you just want to test or don't have your own domain:

```env
# In backend/.env
EMAIL_FROM=onboarding@resend.dev
```

Resend provides a default domain `onboarding@resend.dev` for testing.

**Pros**: No setup needed, works immediately  
**Cons**: Default domain (not professional)

> ⚠️ **Free-tier restriction (important):** With `onboarding@resend.dev` and **no verified
> domain**, Resend only lets you deliver to the email address your Resend account is
> registered under. So `EMAIL_TO` must match your Resend signup email. To send to any
> other address, verify a real domain (Option B). Note: Firebase/Vercel platform
> subdomains (`*.web.app`, `*.vercel.app`) **cannot** be verified for email — you need a
> domain where you control DNS (DKIM/SPF records).

### Option B: Verify Your Domain (Professional) 🏢

If you own a domain (e.g., jojosnews.com, example.com):

#### 3.1 Add Domain in Resend

1. Go to https://resend.com/domains
2. Click **"Add Domain"**
3. Enter your domain (e.g., `jojosnews.com`)
4. Click **"Add"**

#### 3.2 Add DNS Records

Resend will show 3 DNS records you need to add:

```
Type     Name          Value
─────────────────────────────────────────────────────────
CNAME    default._domainkey.jojosnews.com  → xxxxx.dkim.resend.dev
MX       @             → mx.resend.dev (priority 10)
TXT      resend._domainkey  → xxxxx
```

**Where to add DNS records?**

Depends on your domain registrar:
- GoDaddy: Domain → DNS settings
- Cloudflare: DNS → Add record
- NameCheap: Advanced DNS
- etc.

#### 3.3 Wait for Verification

- DNS changes take 5-30 minutes to propagate
- Resend will auto-detect when verified
- You'll see "Verified" ✓ in Resend dashboard

#### 3.4 Update `.env`

```env
EMAIL_FROM=noreply@jojosnews.com  # Must match your verified domain
```

---

## Step 4: Update `.env` Configuration (2 minutes)

### 4.1 Open `.env` File

```bash
# In backend directory
nano .env    # Linux/macOS
code .env    # VS Code
# or edit with your editor
```

### 4.2 Add/Update These Variables

```env
# ===== EMAIL CONFIGURATION =====

# Resend API Key (from Step 2)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Email FROM address
# Option A (easiest, no setup):
EMAIL_FROM=onboarding@resend.dev

# Option B (if you verified a domain):
EMAIL_FROM=noreply@jojosnews.com

# Where to send emails (your email address)
EMAIL_TO=you@example.com

# IMPORTANT: Set to false to actually send emails
# Keep true for testing first!
DRY_RUN_EMAIL=true
```

### 4.3 Save File

**Linux/macOS**: Ctrl+X → Y → Enter (nano)  
**VS Code**: Ctrl+S

### 4.4 Verify Format

```bash
# Check it looks right
grep -E "RESEND|EMAIL" backend/.env
```

Should output:
```
RESEND_API_KEY=re_xxxx...
EMAIL_FROM=onboarding@resend.dev
EMAIL_TO=you@example.com
DRY_RUN_EMAIL=true
```

---

## Step 5: Test Email Sending (3 minutes)

### 5.1 Ensure Backend is Running

```bash
cd backend
npm run dev
```

Wait for:
```
✓ Server running on port 3001
✓ News aggregation scheduler started
✓ Summarization scheduler started
✓ Daily email job scheduler started
```

### 5.2 Trigger Test Email (Dry-Run)

In a new terminal:

```bash
curl -X POST http://localhost:3001/api/test/send-email
```

**Expected Output** (check backend logs):

```
[DRY_RUN] Would send email to: you@example.com
✓ Daily email sent successfully
```

✅ If you see this, your configuration is correct!

### 5.3 View Email Log

```bash
curl http://localhost:3001/api/logs?limit=1
```

Should show:
```json
{
  "logs": [
    {
      "id": "...",
      "date": "2026-07-10",
      "recipient": "you@example.com",
      "subject": "Jojo's News Digest - Friday, Jul 10",
      "status": "sent",
      "sent_at": "2026-07-10T14:25:00.000Z"
    }
  ]
}
```

---

## Step 6: Enable Real Email Sending (1 minute)

### 6.1 Update `.env`

```bash
# Change this line:
DRY_RUN_EMAIL=true

# To this:
DRY_RUN_EMAIL=false
```

**Save file** (Ctrl+S in VS Code)

### 6.2 Restart Backend

```bash
# In terminal running backend:
Ctrl+C  (stop)

# Start again:
npm run dev
```

### 6.3 Send Real Test Email

```bash
curl -X POST http://localhost:3001/api/test/send-email
```

**Expected**: Backend logs show:
```
✓ Daily email sent successfully
```

### 6.4 Check Your Inbox

⏱️ **Wait 10-30 seconds**

Check `you@example.com` inbox for:

**From**: onboarding@resend.dev (or noreply@jojosnews.com)  
**Subject**: Jojo's News Digest - Wednesday, July 10  
**Content**: News summaries in HTML format

---

## ✅ Success Checklist

After completing steps 1-6:

- [ ] Created Resend account
- [ ] Generated API key
- [ ] Verified email domain (or using onboarding@resend.dev)
- [ ] Updated `.env` with all credentials
- [ ] Tested dry-run email (saw log message)
- [ ] Enabled real email sending (DRY_RUN_EMAIL=false)
- [ ] Sent test email via curl
- [ ] **Email arrived in inbox** ✅

---

## 🎯 Automatic Daily Emails

Once everything is working, here's what happens automatically:

### Daily Schedule (Berlin Time)

| Time | What Happens |
|------|-------------|
| 00:00 | 🔄 Aggregation: Fetches news from RSS, Twitter, Reddit (~150 items) |
| 06:00 | 🔄 Aggregation: Fetches more news (~150 items) |
| 12:00 | 🔄 Aggregation: Fetches more news (~150 items) |
| 18:00 | 🔄 Aggregation: Fetches more news (~150 items) |
| 05:00 | 🤖 Summarization: AI generates summaries from collected news (~2 summaries) |
| **06:00** | **✉️ EMAIL SENT TO YOUR INBOX** 🎉 |

**You'll receive one email per day** with the day's news summaries.

---

## 🧪 Verification Commands

### Check Email Configuration

```bash
# View configured email settings
grep -E "EMAIL|RESEND" backend/.env
```

Should show:
```
RESEND_API_KEY=re_xxxxx...
EMAIL_FROM=onboarding@resend.dev (or your domain)
EMAIL_TO=you@example.com
DRY_RUN_EMAIL=false (after Step 6)
```

### Verify Backend Can Connect

```bash
curl http://localhost:3001/health
```

Should return:
```json
{
  "status": "ok",
  "database": "connected",
  "ollama": "connected"
}
```

### Manual Email Test

```bash
# Trigger email sending
curl -X POST http://localhost:3001/api/test/send-email

# Check logs
curl http://localhost:3001/api/logs?limit=1
```

### Check Resend API (Advanced)

```bash
# Test your API key with Resend directly
curl -H "Authorization: Bearer re_xxxxxxxxxxxx" \
  https://api.resend.com/audiences

# Should return your account info (not an error)
```

---

## ⚠️ Troubleshooting

### "Email not arriving"

**Check 1: Verify DRY_RUN_EMAIL is false**
```bash
grep DRY_RUN_EMAIL backend/.env
# Should show: DRY_RUN_EMAIL=false
```

**Check 2: Verify API key is correct**
```bash
grep RESEND_API_KEY backend/.env
# Should show: RESEND_API_KEY=re_xxxxxxxxxxxxx
# Format: starts with "re_", 40+ characters
```

**Check 3: Verify EMAIL_FROM domain is verified**
- If using `onboarding@resend.dev`: No setup needed ✓
- If using custom domain:
  1. Go to https://resend.com/domains
  2. Check if domain shows "Verified" ✓
  3. If not verified, add DNS records (see Step 3)

**Check 4: Check backend logs**
```bash
# Terminal running `npm run dev` should show:
✓ Daily email sent successfully

# If you see an error, copy it and search the Resend docs
```

**Check 5: Check email logs**
```bash
curl http://localhost:3001/api/logs?limit=1
```

Look for:
- `"status": "sent"` ✓ (email was sent)
- `"status": "failed"` ✗ (email failed - check reason)

### "API key rejected"

**Solution**:
1. Go to https://resend.com/api-keys
2. Generate a **new** API key
3. Copy it immediately (won't see it again)
4. Update `.env` with new key
5. Restart backend: `Ctrl+C` then `npm run dev`
6. Test again

### "Domain verification pending"

If you added a custom domain, it needs DNS verification:

1. Go to https://resend.com/domains
2. Find your domain
3. Copy the DNS records shown
4. Add them to your domain registrar's DNS settings:
   - GoDaddy, Cloudflare, NameCheap, etc.
5. Wait 5-30 minutes for DNS to update
6. Resend will auto-verify when ready

### "Backend keeps crashing"

Check `npm run dev` output for errors:

```
Error: RESEND_API_KEY not found
```

**Solution**: Add RESEND_API_KEY to `.env`

```
Error: Cannot find module 'resend'
```

**Solution**: Run `npm install` in backend directory

### "Test email arrives, but daily email doesn't"

This could be because:

1. **No news items yet**: 
   - Aggregation runs every 6 hours
   - First aggregation might not have fetched anything
   - Wait 6 hours or manually trigger:
     ```bash
     curl -X POST http://localhost:3001/api/test/aggregate-news
     ```

2. **Summarization hasn't run yet**:
   - Runs at 5 AM Berlin time
   - You can manually trigger:
     ```bash
     curl -X POST http://localhost:3001/api/test/generate-summaries
     ```

3. **Backend wasn't running at email time**:
   - Make sure `npm run dev` is always running
   - For production, use process manager (pm2, forever, etc.)

---

## 🎁 Next Steps

### Immediate
✅ Emails are now working!

### Short Term (Phase 5)
- Monitor emails arriving daily
- Check email logs in dashboard
- Adjust preferences in Admin panel if needed

### Medium Term (Phase 6)
- Deploy backend to production server
- Set up monitoring/alerting
- Configure automatic restarts

### Long Term (Phase 7)
- Add user authentication
- Per-user topic preferences
- SMS delivery option
- Slack integration

---

## 📞 Quick Reference

### Configuration Complete?

```bash
# One command to verify everything:
backend $ grep -E "RESEND_API_KEY=re_|EMAIL_FROM=|EMAIL_TO=|DRY_RUN_EMAIL=false" .env
```

Should show all 4 lines with correct values.

### Resend Dashboard Quick Links

- Dashboard: https://resend.com
- API Keys: https://resend.com/api-keys
- Domains: https://resend.com/domains
- Documentation: https://resend.com/docs

### Jojo's News Quick Links

- Local Dashboard: http://localhost:5173
- API Health: http://localhost:3001/health
- Email Logs: http://localhost:3001/api/logs
- Summaries: http://localhost:3001/api/summaries

### Emergency Commands

```bash
# Test if backend is running
curl http://localhost:3001/health

# Send test email immediately
curl -X POST http://localhost:3001/api/test/send-email

# Check if email was delivered
curl http://localhost:3001/api/logs?limit=1

# Trigger full pipeline manually
curl -X POST http://localhost:3001/api/test/aggregate-news  # Get news
curl -X POST http://localhost:3001/api/test/generate-summaries  # Make summaries
curl -X POST http://localhost:3001/api/test/send-email  # Send email
```

---

## 🎉 You're Done!

Your Jojo's News system is now fully operational and **sending emails to your inbox every day at 6 AM Berlin time**.

**What happens daily**:
1. 00:00, 06:00, 12:00, 18:00 - News aggregation (runs 4 times)
2. 05:00 - AI summarization generates summaries
3. **06:00 - Email sent to your inbox** ✉️

No more manual work needed. The system runs completely automatically.

---

**Email Setup Complete!** ✅

Next: See [CURRENT_STATE.md](CURRENT_STATE.md) for project status or [CLAUDE.md](CLAUDE.md) for developer docs.
