# Quick Start Guide

## 🚀 5-Minute Setup

### 1. Set Up Supabase (2 minutes)

1. Go to https://supabase.com and create account
2. Click "New Project"
3. Fill in:
   - **Name:** wellness-analytics
   - **Database Password:** [choose a strong password]
   - **Region:** [closest to you]
4. Wait for provisioning (2-3 minutes)

### 2. Configure Database (1 minute)

1. In Supabase dashboard, go to **SQL Editor**
2. Open `supabase-schema.sql` from this project
3. Copy all contents
4. Paste into SQL Editor
5. Click **RUN**
6. Wait for "Success. No rows returned"

### 3. Get API Keys (30 seconds)

1. Go to **Project Settings > API**
2. Copy these two values:
   - **Project URL** (e.g., https://xxxxx.supabase.co)
   - **anon public key** (long string starting with "eyJ...")

### 4. Configure Project (30 seconds)

1. Open `.env.local` in this project
2. Replace the values:
```bash
NEXT_PUBLIC_SUPABASE_URL=YOUR_PROJECT_URL_HERE
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
```
3. Save file

### 5. Run Locally (1 minute)

```bash
npm install
npm run dev
```

Open http://localhost:3000 ✅

---

## 🌐 Deploy to Production

### Option A: Vercel (Recommended)

1. Push code to GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
git push
```

2. Go to https://vercel.com
3. Click "Import Project"
4. Select your GitHub repo
5. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Click "Deploy"
7. Done! 🎉

### Option B: Netlify

1. Build the project:
```bash
npm run build
```

2. Install Netlify CLI:
```bash
npm install -g netlify-cli
```

3. Deploy:
```bash
netlify deploy --prod
```

4. Follow prompts and add environment variables

---

## 📊 Using the Dashboard

### First Upload:
1. Export CSV from Stripe
2. Click "Upload Stripe CSV"
3. Wait for processing
4. Data automatically syncs to cloud ☁️

### Editing Ad Spend:
1. Click "Ad Spend" button
2. Enter monthly spend per cohort
3. Changes auto-save

### Customizing Columns:
1. Click "Columns" button
2. Reorder with up/down arrows
3. Changes auto-save

---

## 🔑 Important Notes

### Session IDs:
- Automatically generated per browser
- Stored in localStorage
- Used to isolate your data
- Delete localStorage to start fresh

### Data Limits:
- Free Supabase tier: 500MB storage
- ~50,000 transactions (estimate)
- Upgrade to Pro for unlimited

### Performance:
- First upload: May take 10-30 seconds for large files
- Subsequent loads: Instant (data cached)
- Charts: Real-time updates

---

## ❓ Troubleshooting

**Can't connect to Supabase?**
→ Check `.env.local` has correct values
→ Verify Supabase project isn't paused

**Data not saving?**
→ Check browser console for errors
→ Run `supabase-schema.sql` again

**Slow uploads?**
→ Normal for 5,000+ transactions
→ Consider upgrading Supabase tier

---

## 📞 Need Help?

Check the full README.md for detailed documentation!
