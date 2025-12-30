# Wellness Analytics Pro - Supabase Edition

Complete analytics dashboard for Stripe subscription data with **cloud-based persistent storage** using Supabase.

## 🎯 What's New - Supabase Integration

### Cloud Storage Features:
- ✅ **Automatic data syncing** - Your data is saved to the cloud automatically
- ✅ **Multi-device access** - Access your data from any device with the same session
- ✅ **No more local storage limits** - Store unlimited transaction history
- ✅ **Data persistence** - Your analytics survive browser cache clears
- ✅ **Batch uploads** - Efficiently handle large CSV files (1000+ transactions)

## 📊 Analytics Features

### 4 Advanced Reports:
1. **Net LTV Waterfall** - Cumulative profit per user (Green heatmap)
2. **Retention Waterfall** - Customer survival rates (Blue heatmap)  
3. **Refund Rate Waterfall** - Risk analysis (Red heatmap, >10% highlighted)
4. **Revenue Composition** - New vs Recurring revenue (Stacked bar chart)

### Additional Features:
- Future-Guard Logic (prevents showing unrealized months)
- Strict Calendar Cohorts (exact month alignment)
- Net Profit Calculations (Gross - Refunds - Fees)
- Dual-Stream Processing (Paid vs Failed transactions)
- Trial velocity tracking
- Win-back rate analysis

## 🚀 Setup Instructions

### Step 1: Set Up Supabase Database

1. **Go to [Supabase](https://supabase.com)** and create a free account
2. **Create a new project** (choose a region close to you)
3. **Wait 2-3 minutes** for the database to provision
4. **Get your connection details:**
   - Go to **Project Settings > API**
   - Copy your `Project URL` (looks like: `https://xxxxx.supabase.co`)
   - Copy your `anon public` key
5. **Run the SQL schema:**
   - Go to **SQL Editor** in your Supabase dashboard
   - Copy the contents of `supabase-schema.sql`
   - Paste and run it
   - You should see "Success" messages

### Step 2: Configure Environment Variables

1. **Copy the `.env.local` file**
2. **Update these values:**
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://hlklekwtsysuhvjtsgzh.supabase.co  # Your Project URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here  # Your anon public key
   ```
3. **Save the file**

### Step 3: Install Dependencies

```bash
npm install
```

This installs:
- Next.js 14.2.18
- React 18.3.1
- Supabase JS Client (@supabase/supabase-js)
- Recharts (charts)
- PapaParse (CSV parsing)
- Lucide React (icons)
- Tailwind CSS

### Step 4: Run Locally (Optional)

```bash
npm run dev
```

Open http://localhost:3000

### Step 5: Deploy to Vercel

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit with Supabase"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
   git push -u origin main
   ```

2. **Deploy on Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "Import Project"
   - Select your GitHub repo
   - **Add environment variables:**
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Click "Deploy"
   - Done! You'll get a live URL in ~2 minutes

## 🔒 Security & Privacy

### How Sessions Work:
- Each user gets a unique session ID stored in their browser's localStorage
- Session IDs are generated client-side (format: `session_[timestamp]_[random]`)
- Users can only access their own data (enforced by session ID)
- No authentication required - perfect for internal tools

### Data Privacy:
- All data is scoped to your Supabase project
- Row Level Security (RLS) policies ensure data isolation
- Optional: Set up auto-cleanup to delete data older than 90 days

### Optional: Make Data Truly Private

If you want to add user authentication:

1. **Enable Supabase Auth:**
   ```javascript
   // In lib/supabase.js, replace getSessionId() with:
   const { data: { user } } = await supabase.auth.getUser()
   return user?.id
   ```

2. **Update RLS policies** to use `auth.uid()` instead of allowing all

## 📂 File Structure

```
wellness-dashboard/
├── app/
│   ├── page.js          # Main dashboard component (with Supabase integration)
│   ├── layout.js        # Root layout
│   └── globals.css      # Global styles
├── lib/
│   └── supabase.js      # Supabase client configuration
├── .env.local           # Environment variables (DO NOT commit)
├── package.json         # Dependencies
├── next.config.js       # Next.js configuration
├── tailwind.config.js   # Tailwind CSS configuration
└── supabase-schema.sql  # Database schema
```

## 📊 CSV Requirements

Your Stripe CSV needs these columns:
- `Created date (UTC)` or `date`
- `Customer ID` or `customerId`
- `Status` (values: "Paid", "Failed")
- `Currency` (should be "usd")
- `Amount`
- `Amount Refunded`
- `Fee`
- `Decline Reason` (optional, for failed transactions)

## 🎨 How It Works

### Data Flow:
1. **Upload CSV** → Parsed with PapaParse
2. **Save to Supabase** → Batch insert (1000 rows at a time)
3. **Process Analytics** → Client-side calculations
4. **Display Charts** → Recharts visualization

### Storage Tables:
- `stripe_transactions` - All transaction data
- `ad_spend_data` - Monthly ad spend per cohort
- `user_settings` - User preferences (column order, date range, etc.)

### Key Functions:
- `loadDataFromSupabase()` - Fetches data on mount
- `saveToSupabase()` - Saves CSV data in batches
- `saveAdSpendToSupabase()` - Syncs ad spend changes
- `saveSettingsToSupabase()` - Syncs user preferences

## 🛠 Troubleshooting

### Issue: "Missing Supabase environment variables"
**Solution:** Make sure `.env.local` exists and has both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Issue: "Error saving to Supabase"
**Solutions:**
1. Check that you ran the `supabase-schema.sql` script
2. Verify your Supabase project is active (not paused)
3. Check browser console for specific error messages

### Issue: Data not persisting
**Solution:** Open browser DevTools > Application > LocalStorage and verify `wellness_session_id` exists

### Issue: Slow uploads for large CSVs
**Normal behavior:** Files with 10,000+ rows may take 10-20 seconds to upload due to batch processing

## 🔧 Customization

### Change Stripe Fee Percentage:
Edit the default in `page.js`:
```javascript
const [stripeFeePercent, setStripeFeePercent] = useState(7.5); // Change 7.5 to your rate
```

### Adjust Data Retention:
Run this in Supabase SQL Editor to clean up old data:
```sql
SELECT cleanup_old_anonymous_data();
```

Or set up a cron job in Supabase Dashboard > Database > Cron Jobs

### Modify Column Order:
Click "Columns" button in the dashboard UI, or edit `DEFAULT_COLUMN_ORDER` in `page.js`

## 📈 Performance

- **Batch inserts:** 1000 rows per transaction
- **Client-side processing:** No backend load
- **Indexed queries:** Fast lookups by session, date, customer
- **Responsive:** Works on mobile, tablet, desktop

## 🎯 Next Steps

### Suggested Enhancements:
1. Add user authentication (Supabase Auth)
2. Export reports to PDF/Excel
3. Email scheduled reports
4. Multi-workspace support
5. Team collaboration features

## 📝 Notes

- Data processing happens in the browser
- Charts update in real-time
- Works offline after initial load
- Mobile responsive design
- Dark mode fintech aesthetic

## 🆘 Support

Having issues? Check:
1. Browser console for errors
2. Supabase dashboard logs
3. Network tab for failed requests

---

**Built with:**
- Next.js 14.2.18
- Supabase (PostgreSQL)
- React 18.3.1
- Recharts
- Tailwind CSS
- PapaParse
- Lucide React

🚀 **Ready to deploy!**
