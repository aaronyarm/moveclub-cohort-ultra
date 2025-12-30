# 📋 Supabase Setup Checklist

Use this checklist to ensure everything is configured correctly.

## ☐ Step 1: Supabase Account Setup

- [ ] Created Supabase account at https://supabase.com
- [ ] Created new project named "wellness-analytics" (or similar)
- [ ] Chose region closest to your location
- [ ] Saved database password securely
- [ ] Waited for project provisioning (2-3 minutes)

## ☐ Step 2: Database Schema Setup

- [ ] Opened Supabase Dashboard
- [ ] Navigated to SQL Editor
- [ ] Copied contents from `supabase-schema.sql`
- [ ] Pasted into SQL Editor
- [ ] Clicked "RUN" button
- [ ] Verified "Success. No rows returned" message
- [ ] Checked Tables section - should see:
  - [ ] `stripe_transactions` table
  - [ ] `ad_spend_data` table
  - [ ] `user_settings` table

## ☐ Step 3: Get API Credentials

- [ ] Went to Project Settings > API
- [ ] Copied Project URL (format: https://xxxxx.supabase.co)
- [ ] Copied anon public key (long string starting with eyJ...)
- [ ] Saved both values somewhere safe

## ☐ Step 4: Configure Environment Variables

- [ ] Located `.env.local` file in project root
- [ ] Replaced `NEXT_PUBLIC_SUPABASE_URL` with your Project URL
- [ ] Replaced `NEXT_PUBLIC_SUPABASE_ANON_KEY` with your anon key
- [ ] (Optional) Updated `DATABASE_URL` with your password
- [ ] Saved the file
- [ ] Verified no trailing spaces or quotes

## ☐ Step 5: Install Dependencies

- [ ] Opened terminal in project directory
- [ ] Ran `npm install`
- [ ] Waited for installation to complete
- [ ] No error messages appeared
- [ ] `node_modules` folder created

## ☐ Step 6: Test Locally

- [ ] Ran `npm run dev`
- [ ] Opened http://localhost:3000 in browser
- [ ] Saw the dashboard upload screen
- [ ] No console errors in browser DevTools
- [ ] Clicked "Upload Stripe CSV" - file picker opened

## ☐ Step 7: Test Data Upload

- [ ] Prepared Stripe CSV export
- [ ] Uploaded CSV file
- [ ] Saw "Saving..." indicator
- [ ] Data appeared in dashboard
- [ ] Checked browser console - no errors
- [ ] Verified data in Supabase:
  - [ ] Went to Table Editor > stripe_transactions
  - [ ] Saw your uploaded data
  - [ ] Checked `user_session_id` column has values

## ☐ Step 8: Test Data Persistence

- [ ] Refreshed browser page
- [ ] Data still visible (loaded from Supabase)
- [ ] Made changes to ad spend
- [ ] Refreshed page
- [ ] Changes persisted

## ☐ Step 9: Deploy to Production (Optional)

### If deploying to Vercel:
- [ ] Pushed code to GitHub repository
- [ ] Created Vercel account
- [ ] Connected GitHub repo to Vercel
- [ ] Added environment variables in Vercel:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Clicked Deploy
- [ ] Verified production URL works
- [ ] Tested upload on production

### If deploying elsewhere:
- [ ] Set up environment variables in hosting platform
- [ ] Ran `npm run build`
- [ ] Deployed build output
- [ ] Tested production deployment

## ☐ Step 10: Security & Maintenance

- [ ] Verified RLS policies are enabled (Supabase Dashboard > Authentication > Policies)
- [ ] Tested that different browser sessions can't see each other's data
- [ ] Set up backup strategy (optional)
- [ ] Configured auto-cleanup cron job (optional, see README)
- [ ] Documented your setup for team members

---

## 🔧 Troubleshooting Checklist

If something isn't working:

### Upload Issues:
- [ ] Check browser console for errors
- [ ] Verify CSV has required columns (see README)
- [ ] Check Supabase dashboard logs (Logs section)
- [ ] Try with smaller CSV file first

### Connection Issues:
- [ ] Verify `.env.local` values are correct
- [ ] Check Supabase project status (not paused)
- [ ] Confirm project URL has `https://`
- [ ] No extra spaces in environment variables

### Data Not Persisting:
- [ ] Check LocalStorage has `wellness_session_id`
- [ ] Verify tables exist in Supabase
- [ ] Check RLS policies are not blocking inserts
- [ ] Look for errors in Supabase logs

### Performance Issues:
- [ ] Large files (10k+ rows) take time - this is normal
- [ ] Consider upgrading Supabase tier for better performance
- [ ] Check your internet connection
- [ ] Try batch uploads (split large files)

---

## ✅ Success Criteria

Your setup is complete when:

1. ✓ You can upload a CSV and see analytics
2. ✓ Data persists after browser refresh
3. ✓ Ad spend changes are saved
4. ✓ No console errors appear
5. ✓ Charts render correctly
6. ✓ (Optional) Production deployment works

---

## 📞 Getting Help

Still stuck? Check:
1. Full README.md documentation
2. Supabase documentation: https://supabase.com/docs
3. Browser DevTools Console tab
4. Supabase Dashboard Logs section

Common issues and solutions in README.md under "Troubleshooting"!
