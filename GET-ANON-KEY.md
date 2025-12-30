# 🔑 Get Your Supabase Anon Key

Your database password is already configured: ✅
Now you need to get your **anon public key**.

## Step-by-Step Instructions

### 1. Go to Your Supabase Dashboard
Visit: https://supabase.com/dashboard/project/hlklekwtsysuhvjtsgzh

### 2. Navigate to API Settings
- Click on **"Settings"** (gear icon) in the left sidebar
- Click on **"API"** under Project Settings

### 3. Copy the Anon Key
Look for the section labeled **"Project API keys"**

You'll see two keys:
- **anon public** ← Copy this one! (starts with `eyJ...`)
- service_role (DON'T use this one for client apps)

### 4. Update .env.local
Open `.env.local` file and replace:
```bash
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

With:
```bash
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
(paste your actual anon key)

### 5. Save and Test
```bash
npm install
npm run dev
```

---

## ✅ Already Configured

- ✅ Supabase URL: `https://hlklekwtsysuhvjtsgzh.supabase.co`
- ✅ Database Password: `3q81d8tHGWjOgm9e`
- ⏳ Anon Key: Need to get from dashboard

---

## Quick Reference

**Your Supabase Project:**
- Project ID: `hlklekwtsysuhvjtsgzh`
- Region: (check your dashboard)
- Database: PostgreSQL 15

**Connection String:**
```
postgresql://postgres:3q81d8tHGWjOgm9e@db.hlklekwtsysuhvjtsgzh.supabase.co:5432/postgres
```

---

## Next Steps After Getting Anon Key

1. ✅ Update `.env.local` with anon key
2. ✅ Run SQL schema (`supabase-schema.sql`)
3. ✅ Run `npm install`
4. ✅ Run `npm run dev`
5. ✅ Upload your Stripe CSV
6. ✅ Data syncs to cloud automatically!

---

## Need the Anon Key Right Now?

I can't retrieve it for you (security reasons), but it takes 30 seconds:

1. Open: https://supabase.com/dashboard/project/hlklekwtsysuhvjtsgzh/settings/api
2. Look for "anon public" key
3. Click the copy icon
4. Paste into `.env.local`

Done! 🎉
