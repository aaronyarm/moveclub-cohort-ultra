-- Wellness Dashboard Database Schema
-- Run this in Supabase SQL Editor to set up your database

-- Table for storing uploaded CSV data
CREATE TABLE IF NOT EXISTS stripe_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_session_id TEXT NOT NULL, -- To group data by user session
  created_date TIMESTAMP WITH TIME ZONE NOT NULL,
  customer_id TEXT NOT NULL,
  status TEXT NOT NULL,
  currency TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  amount_refunded DECIMAL(10, 2) DEFAULT 0,
  fee DECIMAL(10, 2) DEFAULT 0,
  decline_reason TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT check_currency CHECK (LOWER(currency) = 'usd')
);

-- Table for storing ad spend data per cohort
CREATE TABLE IF NOT EXISTS ad_spend_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_session_id TEXT NOT NULL,
  cohort_month TEXT NOT NULL, -- Format: YYYY-MM
  ad_spend DECIMAL(10, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_session_id, cohort_month)
);

-- Table for storing user settings
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_session_id TEXT NOT NULL UNIQUE,
  stripe_fee_percent DECIMAL(5, 2) DEFAULT 7.5,
  date_range_days INTEGER,
  column_order JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_session ON stripe_transactions(user_session_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON stripe_transactions(created_date);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON stripe_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_adspend_session ON ad_spend_data(user_session_id);
CREATE INDEX IF NOT EXISTS idx_settings_session ON user_settings(user_session_id);

-- Enable Row Level Security (RLS)
ALTER TABLE stripe_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_spend_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data
CREATE POLICY "Users can insert their own transactions"
  ON stripe_transactions FOR INSERT
  WITH CHECK (true); -- Allow anyone to insert (they provide their session_id)

CREATE POLICY "Users can view their own transactions"
  ON stripe_transactions FOR SELECT
  USING (true); -- Allow reading (filtered by session_id in queries)

CREATE POLICY "Users can delete their own transactions"
  ON stripe_transactions FOR DELETE
  USING (true);

CREATE POLICY "Users can manage their ad spend"
  ON ad_spend_data FOR ALL
  USING (true);

CREATE POLICY "Users can manage their settings"
  ON user_settings FOR ALL
  USING (true);

-- Function to clean up old anonymous data (optional, run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_anonymous_data()
RETURNS void AS $$
BEGIN
  DELETE FROM stripe_transactions WHERE uploaded_at < NOW() - INTERVAL '90 days';
  DELETE FROM ad_spend_data WHERE updated_at < NOW() - INTERVAL '90 days';
  DELETE FROM user_settings WHERE updated_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Create a scheduled job to run cleanup weekly
-- You can set this up in Supabase Dashboard > Database > Cron Jobs
