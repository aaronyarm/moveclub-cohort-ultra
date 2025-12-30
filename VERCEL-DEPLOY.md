# 🚀 Deploy to Vercel - Complete Guide

## ⚠️ GETTING "No Output Directory" ERROR?
**👉 [Click here for the complete fix](FIX-OUTPUT-DIRECTORY.md)**

---

## Common Errors & Fixes

### Error 1: "Missing Supabase environment variables"
### Error 2: "No Output Directory named 'public' found"

Both errors are easy to fix! Here's the complete solution:

---

## Prerequisites: Verify File Structure

Make sure your files are named correctly (with dots, not underscores):

```
✅ next.config.js     (NOT next_config.js)
✅ postcss.config.js  (NOT postcss_config.js)
✅ tailwind.config.js (NOT tailwind_config.js)
```

If you have underscore versions, rename them:
```bash
mv next_config.js next.config.js
mv postcss_config.js postcss.config.js
mv tailwind_config.js tailwind.config.js
```

---

## Step 1: Get Your Supabase Anon Key

1. Go to: https://supabase.com/dashboard/project/hlklekwtsysuhvjtsgzh/settings/api
2. Find the **"Project API keys"** section
3. Copy the **anon public** key (the long string starting with `eyJ...`)

**Don't use the service_role key** - only use the anon public key!

---

## Step 2: Add Environment Variables to Vercel

### Option A: During Initial Deployment

1. Go to [vercel.com](https://vercel.com)
2. Click "Import Project"
3. Select your GitHub repository
4. **IMPORTANT:** Vercel should auto-detect Next.js
   - If asked, select "Next.js" as the framework
   - Build Command: `next build` (auto-detected)
   - Output Directory: Leave blank (auto-detected as `.next`)
5. **Before clicking Deploy**, scroll down to "Environment Variables"
6. Add these two variables:

```
Name: NEXT_PUBLIC_SUPABASE_URL
Value: https://hlklekwtsysuhvjtsgzh.supabase.co

Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: [paste your anon key here - starts with eyJ...]
```

6. Click "Deploy"

### Option B: After Deployment (If Already Deployed)

1. Go to your Vercel project dashboard
2. Click **"Settings"** tab
3. Click **"Environment Variables"** in the sidebar
4. Add these two variables:

**Variable 1:**
- **Key:** `NEXT_PUBLIC_SUPABASE_URL`
- **Value:** `https://hlklekwtsysuhvjtsgzh.supabase.co`
- **Environment:** Production, Preview, Development (check all)

**Variable 2:**
- **Key:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Value:** `[your anon key - starts with eyJ...]`
- **Environment:** Production, Preview, Development (check all)

5. Click "Save"
6. Go to **"Deployments"** tab
7. Click the three dots on the latest deployment
8. Click **"Redeploy"**
9. Wait 1-2 minutes for rebuild

---

## Step 3: Verify It Works

1. Visit your Vercel URL (e.g., `https://your-project.vercel.app`)
2. You should see the upload screen
3. Look for **"Cloud Storage Active"** badge (blue) instead of yellow warning
4. Upload a CSV file
5. Check your Supabase dashboard - data should appear in `stripe_transactions` table

---

## ⚠️ Important Notes

### About Environment Variables:
- **MUST start with `NEXT_PUBLIC_`** - This makes them available in the browser
- **No quotes needed** - Just paste the raw values
- **Check all environments** - Production, Preview, and Development
- **Redeploy required** - Changes won't take effect until you redeploy

### Security:
- The anon key is safe to expose in client-side code
- Row Level Security (RLS) policies protect your data
- Never use the `service_role` key in client applications

---

## 🔧 Troubleshooting

### Error: "No Output Directory named 'public' found"

**This means:**
- Vercel thinks you're deploying a static site, not Next.js
- The framework wasn't auto-detected

**Fix:**
1. Go to your Vercel project → Settings → General
2. Under "Framework Preset", select **Next.js**
3. Under "Build & Development Settings":
   - Build Command: `next build` (or leave default)
   - Output Directory: **Leave blank** (Next.js uses `.next` automatically)
   - Install Command: `npm install` (or leave default)
4. Save changes
5. Go to Deployments → Redeploy

### Still getting "Missing environment variables"?

**Check:**
1. ✓ Variable names are exactly: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. ✓ No typos in the variable names (case-sensitive!)
3. ✓ Values have no extra spaces or quotes
4. ✓ You clicked "Redeploy" after adding variables
5. ✓ You're testing the correct deployment URL

### App loads but says "Cloud Storage Not Configured"?

**This means:**
- The app is working! ✅
- But environment variables aren't set
- Data will save locally only (localStorage)
- Follow Step 2 above to fix

### How to verify environment variables are set:

1. Open your deployed site
2. Open browser DevTools (F12)
3. Go to Console tab
4. Type: `console.log(process.env)`
5. Look for your variables in the output

If they're missing, redeploy after adding them in Vercel settings.

---

## 📋 Quick Checklist

Before deploying:
- [ ] Ran SQL schema in Supabase
- [ ] Got anon key from Supabase dashboard
- [ ] Saved both environment variables in Vercel
- [ ] Selected all environments (Production, Preview, Development)
- [ ] Clicked Deploy (or Redeploy)

After deployment:
- [ ] Visited production URL
- [ ] Saw "Cloud Storage Active" badge
- [ ] Uploaded test CSV
- [ ] Verified data in Supabase tables
- [ ] Refreshed page - data persisted

---

## 🎯 Example Environment Variables

Copy these templates:

```bash
# Variable 1
NEXT_PUBLIC_SUPABASE_URL=https://hlklekwtsysuhvjtsgzh.supabase.co

# Variable 2 (replace with your actual key)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsa2xla3d0c3lzdWhqdmpzdHd6aCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjg5MDg0ODAwLCJleHAiOjIwMDQ2NjA4MDB9.YOUR_ACTUAL_KEY_HERE
```

---

## 🆘 Still Need Help?

1. Check Vercel build logs for specific errors
2. Verify Supabase project is active (not paused)
3. Make sure you're using the correct anon key (not service_role)
4. Try deploying a test Next.js app first to verify Vercel setup

---

## ✅ Success!

Once configured, your dashboard will:
- ☁️ Automatically sync data to Supabase
- 🔄 Load data on every visit
- 💾 Persist across devices
- 🚀 Work from your Vercel URL anywhere

Happy analyzing! 📊
