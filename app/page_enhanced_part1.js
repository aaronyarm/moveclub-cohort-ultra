'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  ComposedChart, FunnelChart, Funnel, LabelList 
} from 'recharts';
import { 
  Upload, DollarSign, Users, TrendingUp, Target, ArrowUpRight, 
  Calendar, Edit3, X, Settings, ChevronUp, ChevronDown, AlertCircle, 
  Zap, FileText, CheckCircle, Info, Database, Trash2, 
  CreditCard, MapPin, TrendingDown, RefreshCw, Filter,
  BarChart3, PieChart as PieChartIcon, Activity, Shield
} from 'lucide-react';
import Papa from 'papaparse';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { processEnhancedAnalytics } from '../lib/enhancedAnalytics';

// Import existing processing logic
const DEFAULT_COLUMN_ORDER = [
  'date', 'trials', 'activeTrials', 'firstPaid', 'secondPlusPaid',
  'conversion', 'cpt', 'cpaSub', 'ltvWaterfall', 'adSpend',
  'stripeFees', 'refunds', 'grossRev', 'netRev', 'roas'
];

const COLUMN_LABELS = {
  date: 'Date', trials: 'Trials', activeTrials: 'Active Trials',
  firstPaid: 'First Paid', secondPlusPaid: '2nd+ Paid', conversion: 'Conversion',
  cpt: 'CPT', cpaSub: 'CPA Sub', ltvWaterfall: 'LTV (Waterfall)',
  adSpend: 'Ad Spend', stripeFees: 'Stripe Fees', refunds: 'Refunds',
  grossRev: 'Gross Rev', netRev: 'Net Rev', roas: 'ROAS'
};

const COLORS = {
  emerald: '#10b981',
  blue: '#3b82f6',
  orange: '#f97316',
  red: '#ef4444',
  purple: '#a855f7',
  cyan: '#06b6d4',
  pink: '#ec4899',
  yellow: '#eab308',
  gray: '#6b7280'
};

function findColumn(obj, pattern, exclude = null) {
  const keys = Object.keys(obj);
  for (let key of keys) {
    if (pattern.test(key) && (!exclude || !exclude.test(key))) return key;
  }
  return null;
}

function getSessionId() {
  if (typeof window === 'undefined') return null;
  let sessionId = localStorage.getItem('wellness_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('wellness_session_id', sessionId);
  }
  return sessionId;
}

// Tabs Component
const Tabs = ({ children, activeTab, onTabChange }) => {
  const tabs = React.Children.toArray(children);
  
  return (
    <div className="w-full">
      <div className="border-b border-gray-800 mb-6">
        <div className="flex space-x-1 overflow-x-auto">
          {tabs.map((tab, idx) => (
            <button
              key={idx}
              onClick={() => onTabChange(idx)}
              className={`px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === idx
                  ? 'border-b-2 border-purple-500 text-purple-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab.props.label}
            </button>
          ))}
        </div>
      </div>
      <div>{tabs[activeTab]}</div>
    </div>
  );
};

const Tab = ({ children }) => <div>{children}</div>;

// Section Component
const Section = ({ title, icon, children, className = '' }) => (
  <div className={`bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg ${className}`}>
    <div className="p-5 border-b border-gray-800 flex items-center bg-gray-800/50">
      {icon}
      <h2 className="ml-3 text-lg font-bold text-gray-200">{title}</h2>
    </div>
    <div>{children}</div>
  </div>
);

// Metric Card Component
const MetricCard = ({ label, value, subtext, color = "text-white", trend, icon }) => (
  <div className="bg-gray-800/50 border border-gray-700 p-4 rounded-lg hover:border-gray-600 transition-colors shadow-lg">
    <div className="flex items-center justify-between mb-2">
      <div className="text-xs text-gray-400 uppercase tracking-wide font-medium">{label}</div>
      {icon && <div className="text-gray-500">{icon}</div>}
    </div>
    <div className={`text-2xl font-bold mb-1 ${color}`}>{value}</div>
    {subtext && <div className="text-xs text-gray-500">{subtext}</div>}
    {trend && (
      <div className={`text-xs mt-2 flex items-center ${trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
        {trend > 0 ? '↗' : '↘'} {Math.abs(trend)}%
      </div>
    )}
  </div>
);

// Comparison Card Component  
const ComparisonCard = ({ title, items, bestLabel = "Best" }) => (
  <div className="bg-gray-800/50 border border-gray-700 p-4 rounded-lg">
    <h3 className="text-sm font-semibold text-gray-300 mb-3">{title}</h3>
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center justify-between">
          <span className="text-sm text-gray-400">{item.label}</span>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${idx === 0 ? 'text-green-400' : 'text-gray-300'}`}>
              {item.value}
            </span>
            {idx === 0 && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">{bestLabel}</span>}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default function EnhancedWellnessDashboard() {
  // State management
  const [rawData, setRawData] = useState(null);
  const [enhancedAnalytics, setEnhancedAnalytics] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [stripeFeePercent, setStripeFeePercent] = useState(7.5);
  const [adSpendData, setAdSpendData] = useState({});
  const [dateRangeDays, setDateRangeDays] = useState(null);
  const [columnOrder, setColumnOrder] = useState(DEFAULT_COLUMN_ORDER);
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [showAdSpendModal, setShowAdSpendModal] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [loadingState, setLoadingState] = useState('idle');
  const [savedDataInfo, setSavedDataInfo] = useState(null);

  // Initialize session and load data
  useEffect(() => {
    const sid = getSessionId();
    setSessionId(sid);
    loadDataFromSupabase(sid);
  }, []);

  // Load localStorage ad spend data
  useEffect(() => {
    const savedAdSpend = localStorage.getItem('adSpendData');
    if (savedAdSpend) {
      try {
        setAdSpendData(JSON.parse(savedAdSpend));
      } catch (e) {
        console.error('Failed to parse ad spend data:', e);
      }
    }
  }, []);

  // Save ad spend to localStorage
  useEffect(() => {
    localStorage.setItem('adSpendData', JSON.stringify(adSpendData));
  }, [adSpendData]);

  // Process enhanced analytics when data changes
  useEffect(() => {
    if (rawData) {
      const enhanced = processEnhancedAnalytics(rawData);
      setEnhancedAnalytics(enhanced);
    }
  }, [rawData]);

  // Supabase functions
  const loadDataFromSupabase = async (sid) => {
    if (!sid || !isSupabaseConfigured()) return;
    
    setLoadingState('loading');
    try {
      const { data: transactions, error: txError } = await supabase
        .from('stripe_transactions')
        .select('*')
        .eq('user_session_id', sid)
        .order('created_date', { ascending: true });

      if (txError) throw txError;

      if (transactions && transactions.length > 0) {
        const csvData = transactions.map(tx => ({
          'Created date (UTC)': tx.created_date,
          'Customer ID': tx.customer_id,
          'Status': tx.status,
          'Currency': tx.currency,
          'Amount': tx.amount,
          'Amount Refunded': tx.amount_refunded,
          'Fee': tx.fee,
          'Decline Reason': tx.decline_reason
        }));
        
        setRawData(csvData);
        setSavedDataInfo({
          count: transactions.length,
          lastUpdated: new Date(transactions[0].uploaded_at).toLocaleString()
        });
      }

      const { data: adSpend, error: adError } = await supabase
        .from('ad_spend_data')
        .select('*')
        .eq('user_session_id', sid);

      if (!adError && adSpend) {
        const adSpendObj = {};
        adSpend.forEach(item => {
          adSpendObj[item.cohort_month] = parseFloat(item.ad_spend);
        });
        setAdSpendData(adSpendObj);
      }

      const { data: settings, error: settingsError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_session_id', sid)
        .single();

      if (!settingsError && settings) {
        if (settings.stripe_fee_percent) setStripeFeePercent(settings.stripe_fee_percent);
        if (settings.date_range_days) setDateRangeDays(settings.date_range_days);
        if (settings.column_order) setColumnOrder(settings.column_order);
      }

      setLoadingState('loaded');
    } catch (error) {
      console.error('Error loading from Supabase:', error);
      setLoadingState('idle');
    }
  };

  const saveToSupabase = async (csvData) => {
    if (!sessionId || !csvData || !isSupabaseConfigured()) return;

    setLoadingState('saving');
    try {
      await supabase
        .from('stripe_transactions')
        .delete()
        .eq('user_session_id', sessionId);

      const transactions = csvData.map(row => {
        const dateCol = findColumn(row, /created|date/i) || 'Created date (UTC)';
        const customerCol = findColumn(row, /customer.*id|cust.*id/i) || 'Customer ID';
        const statusCol = findColumn(row, /status/i) || 'Status';
        const currencyCol = findColumn(row, /currency/i) || 'Currency';
        const amountCol = findColumn(row, /^amount$/i, /refund/i) || 'Amount';
        const refundCol = findColumn(row, /refund/i) || 'Amount Refunded';
        const feeCol = findColumn(row, /fee/i) || 'Fee';

        return {
          user_session_id: sessionId,
          created_date: new Date(row[dateCol]).toISOString(),
          customer_id: row[customerCol] || '',
          status: row[statusCol] || '',
          currency: (row[currencyCol] || 'usd').toLowerCase(),
          amount: parseFloat(row[amountCol] || 0),
          amount_refunded: parseFloat(row[refundCol] || 0),
          fee: parseFloat(row[feeCol] || 0),
          decline_reason: row['Decline Reason'] || null
        };
      });

      const batchSize = 1000;
      for (let i = 0; i < transactions.length; i += batchSize) {
        const batch = transactions.slice(i, i + batchSize);
        const { error } = await supabase
          .from('stripe_transactions')
          .insert(batch);

        if (error) throw error;
      }

      setSavedDataInfo({
        count: transactions.length,
        lastUpdated: new Date().toLocaleString()
      });

      setLoadingState('loaded');
      console.log('✅ Data saved to Supabase successfully');
    } catch (error) {
      console.error('Error saving to Supabase:', error);
      alert('Failed to save data to Supabase. Check console for details.');
      setLoadingState('idle');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        setRawData(result.data);
        await saveToSupabase(result.data);
      },
      error: (error) => {
        alert(`CSV Parse Error: ${error.message}`);
      }
    });
  };

  // Upload screen
  if (!rawData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-8">
        <div className="max-w-2xl w-full">
          <div className="bg-gray-900 border-2 border-gray-800 rounded-2xl p-12 text-center shadow-2xl">
            <div className="mb-8">
              <div className="inline-block p-6 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl mb-6">
                <Upload className="w-16 h-16 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-white mb-3">Wellness Analytics Pro</h1>
              <p className="text-gray-400 text-lg">Advanced Subscription Analytics & Insights</p>
            </div>

            {!isSupabaseConfigured() && (
              <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-800 rounded-lg">
                <div className="flex items-center justify-center gap-2 text-yellow-300 mb-2">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm font-semibold">Cloud Storage Not Configured</span>
                </div>
                <p className="text-xs text-yellow-400">
                  Data will only be saved locally. Add Supabase credentials to enable cloud sync.
                </p>
              </div>
            )}
            
            {sessionId && isSupabaseConfigured() && (
              <div className="mb-6 p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
                <div className="flex items-center justify-center gap-2 text-blue-300">
                  <Database className="w-5 h-5" />
                  <span className="text-sm">Cloud Storage Active</span>
                </div>
                {savedDataInfo && (
                  <div className="mt-2 text-xs text-blue-400">
                    Last saved: {savedDataInfo.lastUpdated} ({savedDataInfo.count} transactions)
                  </div>
                )}
              </div>
            )}

            {loadingState === 'loading' && (
              <div className="mb-6 text-blue-400">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-2"></div>
                <p>Loading your data...</p>
              </div>
            )}

            <label className="cursor-pointer">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl text-white font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200">
                Upload Stripe CSV
              </div>
            </label>

            <div className="mt-8 pt-8 border-t border-gray-800">
              <h2 className="text-lg font-semibold text-white mb-4">✨ New Features</h2>
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Payment Intelligence</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Decline Analysis</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Drop-off Tracking</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Geo Heatmaps</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Behavior Segments</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Recovery Patterns</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8">
      <div className="max-w-[1800px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900/30 via-pink-900/30 to-blue-900/30 border border-gray-800 rounded-2xl p-6 shadow-2xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Wellness Analytics Pro</h1>
              <p className="text-gray-400">Advanced Subscription Analytics & Business Intelligence</p>
              {savedDataInfo && (
                <div className="mt-2 flex items-center gap-2 text-sm text-blue-300">
                  <Database className="w-4 h-4" />
                  <span>Cloud synced • {savedDataInfo.count} transactions • {savedDataInfo.lastUpdated}</span>
                </div>
              )}
            </div>
            
            <div className="flex flex-wrap gap-3">
              {loadingState === 'saving' && (
                <div className="px-4 py-2 bg-blue-900/50 border border-blue-700 rounded-lg text-blue-300 text-sm flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-300"></div>
                  Saving...
                </div>
              )}
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg text-white text-sm flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  New Upload
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Main Dashboard Tabs */}
        <Tabs activeTab={activeTab} onTabChange={setActiveTab}>
          
          {/* Tab 1: Overview */}
          <Tab label="📊 Overview">
            {enhancedAnalytics && (
              <div className="space-y-6">
                {/* Summary Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard 
                    label="Total Customers"
                    value={enhancedAnalytics.summary.totalCustomers.toLocaleString()}
                    subtext="Unique customers"
                    icon={<Users className="w-5 h-5" />}
                    color="text-blue-400"
                  />
                  <MetricCard 
                    label="Success Rate"
                    value={`${enhancedAnalytics.summary.overallSuccessRate}%`}
                    subtext={`${enhancedAnalytics.summary.successfulTransactions} successful`}
                    icon={<CheckCircle className="w-5 h-5" />}
                    color="text-green-400"
                  />
                  <MetricCard 
                    label="Failed Payments"
                    value={enhancedAnalytics.summary.failedTransactions.toLocaleString()}
                    subtext={`${(100 - parseFloat(enhancedAnalytics.summary.overallSuccessRate)).toFixed(1)}% failure rate`}
                    icon={<AlertCircle className="w-5 h-5" />}
                    color="text-red-400"
                  />
                  <MetricCard 
                    label="Total Transactions"
                    value={enhancedAnalytics.summary.totalTransactions.toLocaleString()}
                    subtext="All payment attempts"
                    icon={<Activity className="w-5 h-5" />}
                    color="text-purple-400"
                  />
                </div>

                {/* Revenue Trend */}
                <Section title="Revenue Trend (Last 30 Days)" icon={<TrendingUp className="text-cyan-400" />}>
                  <div className="h-80 p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={enhancedAnalytics.revenueTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis 
                          dataKey="date" 
                          stroke="#666"
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis stroke="#666" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#333' }}
                          formatter={(value) => `$${value.toLocaleString()}`}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="revenue" 
                          stroke="#10b981" 
                          strokeWidth={3}
                          dot={{ fill: '#10b981', r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Section>

                {/* Conversion Funnel */}
                <Section title="Conversion Funnel" icon={<Target className="text-yellow-400" />}>
                  <div className="p-6">
                    <div className="space-y-4">
                      {enhancedAnalytics.conversionFunnel.map((stage, idx) => (
                        <div key={idx}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-300">{stage.stage}</span>
                            <span className="text-sm text-gray-400">
                              {stage.count.toLocaleString()} ({stage.percentage}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-500"
                              style={{ width: `${stage.percentage}%` }}
                            />
                          </div>
                          {idx < enhancedAnalytics.conversionFunnel.length - 1 && (
                            <div className="text-xs text-red-400 mt-1 ml-2">
                              ↓ {(stage.percentage - enhancedAnalytics.conversionFunnel[idx + 1].percentage).toFixed(1)}% drop-off
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </Section>

                {/* Behavior Segments */}
                <Section title="Customer Segments (Anonymous)" icon={<Users className="text-indigo-400" />}>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {enhancedAnalytics.behaviorSegments.map((segment, idx) => (
                        <div 
                          key={idx}
                          className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h3 className={`text-lg font-bold text-${segment.color}-400`}>
                              {segment.name}
                            </h3>
                            <span className={`text-xs bg-${segment.color}-500/20 text-${segment.color}-400 px-2 py-1 rounded`}>
                              {segment.percentage}%
                            </span>
                          </div>
                          <div className="space-y-2">
                            <div className="text-2xl font-bold text-white">
                              {segment.count.toLocaleString()}
                            </div>
                            <div className="text-sm text-gray-400">customers</div>
                            <div className="pt-2 border-t border-gray-700 space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Avg LTV</span>
                                <span className={`font-medium text-${segment.color}-400`}>
                                  ${segment.avgLTV}
                                </span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Success Rate</span>
                                <span className={`font-medium text-${segment.color}-400`}>
                                  {segment.avgSuccessRate}%
                                </span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Total Revenue</span>
                                <span className={`font-medium text-${segment.color}-400`}>
                                  ${parseFloat(segment.totalRevenue).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Section>
              </div>
            )}
          </Tab>

          {/* Tab 2: Payment Intelligence - Will add in next part */}
          <Tab label="💳 Payment Intelligence">
            {/* Payment intelligence content */}
            <div className="text-gray-400">Payment Intelligence features loading...</div>
          </Tab>

          {/* Tab 3: Drop-offs - Will add in next part */}
          <Tab label="🚨 Drop-offs">
            {/* Drop-off analysis content */}
            <div className="text-gray-400">Drop-off analysis loading...</div>
          </Tab>

          {/* Tab 4: Geography - Will add in next part */}
          <Tab label="🗺️ Geography">
            {/* Geographic analysis content */}
            <div className="text-gray-400">Geographic analysis loading...</div>
          </Tab>

          {/* Tab 5: Classic View - Will add in next part */}
          <Tab label="📈 Classic View">
            {/* Original cohort tables */}
            <div className="text-gray-400">Classic cohort view loading...</div>
          </Tab>

        </Tabs>
      </div>
    </div>
  );
}
