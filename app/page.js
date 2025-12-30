'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';
import { Upload, DollarSign, Users, TrendingUp, Target, ArrowUpRight, Calendar, Edit3, X, Settings, ChevronUp, ChevronDown, AlertCircle, Zap, FileText, CheckCircle, Info, Database, Trash2, CreditCard, MapPin, TrendingDown, RefreshCw, Activity } from 'lucide-react';
import Papa from 'papaparse';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { processEnhancedAnalytics } from '../lib/enhancedAnalytics';

// ==================== DEFAULT COLUMN ORDER ====================
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

// ==================== HELPER FUNCTIONS ====================

function findColumn(obj, pattern, exclude = null) {
  const keys = Object.keys(obj);
  for (let key of keys) {
    if (pattern.test(key) && (!exclude || !exclude.test(key))) return key;
  }
  return null;
}

// Generate or retrieve session ID
function getSessionId() {
  if (typeof window === 'undefined') return null;
  
  let sessionId = localStorage.getItem('wellness_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('wellness_session_id', sessionId);
  }
  return sessionId;
}

// ==================== TAB COMPONENTS ====================

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

// ==================== CORE DATA PROCESSING ====================

const processData = (data, stripeFeePercent = 7.5, adSpendData = {}, dateRangeDays = null) => {
  if (!data || data.length === 0) return null;

  const sampleRow = data[0];
  const dateCol = findColumn(sampleRow, /created|date/i) || 'Created date (UTC)';
  const customerCol = findColumn(sampleRow, /customer.*id|cust.*id/i) || 'Customer ID';
  const statusCol = findColumn(sampleRow, /status/i) || 'Status';
  const currencyCol = findColumn(sampleRow, /currency/i) || 'Currency';
  const amountCol = findColumn(sampleRow, /^amount$/i, /refund/i) || 'Amount';
  const refundCol = findColumn(sampleRow, /refund/i) || 'Amount Refunded';

  console.log('🔍 COLUMN DETECTION:', {
    dateCol, customerCol, statusCol, currencyCol, amountCol, refundCol,
    allColumns: Object.keys(sampleRow)
  });

  const refundSamples = data.slice(0, 100).filter(row => {
    const amount = parseFloat(row[amountCol] || 0);
    const refundAmount = parseFloat(row[refundCol] || 0);
    return amount < 0 || refundAmount > 0;
  });
  
  console.log(`🔍 REFUND DETECTION: Found ${refundSamples.length} refunds in first 100 rows`);
  if (refundSamples.length > 0) {
    console.log('Sample refund:', {
      amount: refundSamples[0][amountCol],
      refundAmount: refundSamples[0][refundCol],
      status: refundSamples[0][statusCol],
      currency: refundSamples[0][currencyCol]
    });
  }

  const allTimestamps = data.map(t => new Date(t[dateCol]).getTime()).filter(t => !isNaN(t));
  const maxDate = new Date(Math.max(...allTimestamps));
  
  let minDate = null;
  if (dateRangeDays) {
    minDate = new Date(maxDate);
    minDate.setDate(minDate.getDate() - dateRangeDays);
  }

  const filteredData = dateRangeDays 
    ? data.filter(row => {
        const txDate = new Date(row[dateCol]);
        return txDate >= minDate && txDate <= maxDate;
      })
    : data;

  // Track customer transactions chronologically
  const customerTransactions = new Map();
  
  data.forEach(row => {
    const cid = row[customerCol];
    if (!cid) return;

    const status = row[statusCol] || '';
    const currency = row[currencyCol] || '';
    const amount = parseFloat(row[amountCol] || 0);
    const date = new Date(row[dateCol]);

    if (currency === 'usd' || currency === 'USD') {
      if (!customerTransactions.has(cid)) {
        customerTransactions.set(cid, []);
      }
      customerTransactions.get(cid).push({ date, status, amount });
    }
  });

  customerTransactions.forEach((txs) => {
    txs.sort((a, b) => a.date - b.date);
  });

  // RECOVERY RATE (WIN-BACK) LOGIC
  const failedCustomers = new Set();
  const recoveredCustomers = new Set();

  customerTransactions.forEach((txs, customerId) => {
    let hasFailure = false;
    let failureDate = null;

    for (const tx of txs) {
      if ((tx.status === 'Failed' || tx.status === 'failed') && !hasFailure) {
        hasFailure = true;
        failureDate = tx.date;
        failedCustomers.add(customerId);
      }

      if (hasFailure && (tx.status === 'Paid' || tx.status === 'paid') && tx.date > failureDate) {
        recoveredCustomers.add(customerId);
        break;
      }
    }
  });

  const recoveryRate = failedCustomers.size > 0 
    ? (recoveredCustomers.size / failedCustomers.size * 100).toFixed(1)
    : 0;

  // TRIAL & PAID TRACKING
  const trialCustomers = new Map();
  const paidCustomers = new Map();
  const customerPaymentCount = new Map();
  const trialVelocityBuckets = {
    'Same Day': 0,
    '1-6 Days': 0,
    '7 Days': 0,
    '8-14 Days': 0,
    '14+ Days': 0
  };

  customerTransactions.forEach((txs, customerId) => {
    let firstTrialDate = null;
    let firstPaidDate = null;

    for (const tx of txs) {
      if (tx.status === 'Paid' || tx.status === 'paid') {
        if (tx.amount >= 0.90 && tx.amount <= 1.10 && !firstTrialDate) {
          firstTrialDate = tx.date;
          trialCustomers.set(customerId, tx.date);
        }

        if (tx.amount > 2.00 && !firstPaidDate) {
          firstPaidDate = tx.date;
          paidCustomers.set(customerId, tx.date);
        }

        if (tx.amount > 2.00) {
          customerPaymentCount.set(customerId, (customerPaymentCount.get(customerId) || 0) + 1);
        }
      }
    }

    if (firstTrialDate && firstPaidDate) {
      const daysDiff = Math.floor((firstPaidDate - firstTrialDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 0) {
        trialVelocityBuckets['Same Day']++;
      } else if (daysDiff >= 1 && daysDiff <= 6) {
        trialVelocityBuckets['1-6 Days']++;
      } else if (daysDiff === 7) {
        trialVelocityBuckets['7 Days']++;
      } else if (daysDiff >= 8 && daysDiff <= 14) {
        trialVelocityBuckets['8-14 Days']++;
      } else {
        trialVelocityBuckets['14+ Days']++;
      }
    }
  });

  // ZOMBIE REVENUE (LATE CONVERSION)
  let totalConverted = 0;
  let lateConverted = 0;

  paidCustomers.forEach((paidDate, customerId) => {
    if (trialCustomers.has(customerId)) {
      totalConverted++;
      const trialDate = trialCustomers.get(customerId);
      const daysDiff = Math.floor((paidDate - trialDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff > 8) {
        lateConverted++;
      }
    }
  });

  const zombieRevenue = totalConverted > 0 
    ? (lateConverted / totalConverted * 100).toFixed(1)
    : 0;

  // ACTIVE TRIAL LOGIC
  const activeTrialThreshold = new Date(maxDate);
  activeTrialThreshold.setDate(activeTrialThreshold.getDate() - 7);
  
  const activeTrials = new Set();
  trialCustomers.forEach((trialDate, customerId) => {
    if (trialDate >= activeTrialThreshold && !paidCustomers.has(customerId)) {
      activeTrials.add(customerId);
    }
  });

  // REFUND BREAKDOWN - COMPREHENSIVE FIX
  let trialRefunds = { count: 0, value: 0 };
  let subscriptionRefunds = { count: 0, value: 0 };
  let otherRefunds = { count: 0, value: 0 };

  data.forEach(row => {
    const amount = parseFloat(row[amountCol] || 0);
    const refundAmount = parseFloat(row[refundCol] || 0);
    const currency = row[currencyCol] || '';

    let detectedRefund = 0;
    
    if (refundAmount > 0 && (currency === 'usd' || currency === 'USD')) {
      detectedRefund = refundAmount;
    } else if (amount < 0 && (currency === 'usd' || currency === 'USD')) {
      detectedRefund = Math.abs(amount);
    }

    if (detectedRefund > 0) {
      if (detectedRefund >= 0.90 && detectedRefund <= 1.10) {
        trialRefunds.count++;
        trialRefunds.value += detectedRefund;
      } else if (detectedRefund >= 2.00) {
        subscriptionRefunds.count++;
        subscriptionRefunds.value += detectedRefund;
      } else {
        otherRefunds.count++;
        otherRefunds.value += detectedRefund;
      }
    }
  });

  const totalRefundValue = trialRefunds.value + subscriptionRefunds.value + otherRefunds.value;

  const refundBreakdown = [
    {
      type: 'Trial Refunds (~$0.99)',
      count: trialRefunds.count,
      value: trialRefunds.value.toFixed(2),
      percent: totalRefundValue > 0 ? ((trialRefunds.value / totalRefundValue) * 100).toFixed(1) : 0
    },
    {
      type: 'Subscription Refunds (>$2)',
      count: subscriptionRefunds.count,
      value: subscriptionRefunds.value.toFixed(2),
      percent: totalRefundValue > 0 ? ((subscriptionRefunds.value / totalRefundValue) * 100).toFixed(1) : 0
    },
    {
      type: 'Other/Partial',
      count: otherRefunds.count,
      value: otherRefunds.value.toFixed(2),
      percent: totalRefundValue > 0 ? ((otherRefunds.value / totalRefundValue) * 100).toFixed(1) : 0
    },
    {
      type: 'Total',
      count: trialRefunds.count + subscriptionRefunds.count + otherRefunds.count,
      value: totalRefundValue.toFixed(2),
      percent: '100.0'
    }
  ];

  // Continue with remaining processing logic from original file...
  // [Rest of the processing code from lines 291-550 remains the same]
  
  const allPaidTransactions = data.filter(row => {
    const status = row[statusCol] || '';
    const currency = row[currencyCol] || '';
    const amount = parseFloat(row[amountCol] || 0);
    return (status === 'Paid' || status === 'paid') && (currency === 'usd' || currency === 'USD') && amount > 0;
  });

  const currentGlobalMonthCode = maxDate.getUTCFullYear() * 12 + maxDate.getUTCMonth();
  const cohortBuckets = {};
  
  const allTrialCustomers = new Map();
  const allPaidCustomers = new Map();
  const allCustomerPaymentCount = new Map();

  data.forEach(row => {
    const cid = row[customerCol];
    if (!cid) return;

    const status = row[statusCol] || '';
    const currency = row[currencyCol] || '';
    const amount = parseFloat(row[amountCol] || 0);
    const date = new Date(row[dateCol]);

    if ((status === 'Paid' || status === 'paid') && (currency === 'usd' || currency === 'USD') && amount > 0) {
      if (amount >= 0.90 && amount <= 1.10) {
        if (!allTrialCustomers.has(cid)) {
          allTrialCustomers.set(cid, date);
        }
      }
      
      if (amount > 2.00) {
        if (!allPaidCustomers.has(cid)) {
          allPaidCustomers.set(cid, date);
        }
        allCustomerPaymentCount.set(cid, (allCustomerPaymentCount.get(cid) || 0) + 1);
      }
    }
  });

  allTrialCustomers.forEach((trialDate, customerId) => {
    const cohortKey = `${trialDate.getUTCFullYear()}-${String(trialDate.getUTCMonth() + 1).padStart(2, '0')}`;
    
    if (!cohortBuckets[cohortKey]) {
      cohortBuckets[cohortKey] = {
        trials: new Set(),
        activeTrials: new Set(),
        paidCustomers: new Set(),
        secondPlusPaid: new Set(),
        revenue: {}, active: {}, gross: {}, refunded: {}, stripeFees: {},
        year: trialDate.getUTCFullYear(),
        month: trialDate.getUTCMonth()
      };
    }
    
    cohortBuckets[cohortKey].trials.add(customerId);
    
    if (trialDate >= activeTrialThreshold && !allPaidCustomers.has(customerId)) {
      cohortBuckets[cohortKey].activeTrials.add(customerId);
    }
    
    if (allPaidCustomers.has(customerId)) {
      cohortBuckets[cohortKey].paidCustomers.add(customerId);
      
      if ((allCustomerPaymentCount.get(customerId) || 0) >= 2) {
        cohortBuckets[cohortKey].secondPlusPaid.add(customerId);
      }
    }
  });

  let totalGrossRevenue = 0;
  let totalRefunds = 0;
  let totalStripeFees = 0;

  // Process all positive transactions (revenue)
  data.forEach(row => {
    const cid = row[customerCol];
    const status = row[statusCol] || '';
    const currency = row[currencyCol] || '';
    const amount = parseFloat(row[amountCol] || 0);
    const txDate = new Date(row[dateCol]);
    
    if ((status === 'Paid' || status === 'paid') && (currency === 'usd' || currency === 'USD') && amount > 0) {
      const trialStartDate = allTrialCustomers.get(cid);
      if (!trialStartDate) return;

      const cohortKey = `${trialStartDate.getUTCFullYear()}-${String(trialStartDate.getUTCMonth() + 1).padStart(2, '0')}`;
      
      if (!cohortBuckets[cohortKey]) return;

      const timeIndex = (txDate.getUTCFullYear() - trialStartDate.getUTCFullYear()) * 12 + 
                        (txDate.getUTCMonth() - trialStartDate.getUTCMonth());

      if (timeIndex < 0 || timeIndex > 12) return;

      const stripeFee = amount * (stripeFeePercent / 100);
      const net = amount - stripeFee;

      totalGrossRevenue += amount;
      totalStripeFees += stripeFee;

      if (!cohortBuckets[cohortKey].gross[timeIndex]) {
        cohortBuckets[cohortKey].gross[timeIndex] = 0;
        cohortBuckets[cohortKey].stripeFees[timeIndex] = 0;
        cohortBuckets[cohortKey].refunded[timeIndex] = 0;
        cohortBuckets[cohortKey].revenue[timeIndex] = 0;
      }

      cohortBuckets[cohortKey].gross[timeIndex] += amount;
      cohortBuckets[cohortKey].stripeFees[timeIndex] += stripeFee;
      cohortBuckets[cohortKey].revenue[timeIndex] += net;
    }
  });

  // Process refunds
  data.forEach(row => {
    const cid = row[customerCol];
    const currency = row[currencyCol] || '';
    const amount = parseFloat(row[amountCol] || 0);
    const refundAmount = parseFloat(row[refundCol] || 0);
    const txDate = new Date(row[dateCol]);
    
    let detectedRefund = 0;
    if (refundAmount > 0 && (currency === 'usd' || currency === 'USD')) {
      detectedRefund = refundAmount;
    } else if (amount < 0 && (currency === 'usd' || currency === 'USD')) {
      detectedRefund = Math.abs(amount);
    }

    if (detectedRefund > 0) {
      const trialStartDate = allTrialCustomers.get(cid);
      if (!trialStartDate) return;

      const cohortKey = `${trialStartDate.getUTCFullYear()}-${String(trialStartDate.getUTCMonth() + 1).padStart(2, '0')}`;
      
      if (!cohortBuckets[cohortKey]) return;

      const timeIndex = (txDate.getUTCFullYear() - trialStartDate.getUTCFullYear()) * 12 + 
                        (txDate.getUTCMonth() - trialStartDate.getUTCMonth());

      if (timeIndex < 0 || timeIndex > 12) return;

      if (!cohortBuckets[cohortKey].refunded[timeIndex]) {
        cohortBuckets[cohortKey].refunded[timeIndex] = 0;
      }

      cohortBuckets[cohortKey].refunded[timeIndex] += detectedRefund;
      cohortBuckets[cohortKey].revenue[timeIndex] -= detectedRefund;
      totalRefunds += detectedRefund;
    }
  });

  // Build cohort table
  const cohortKeys = Object.keys(cohortBuckets).sort();
  const cohortTable = cohortKeys.map(cohortKey => {
    const bucket = cohortBuckets[cohortKey];
    const cohortMonthCode = bucket.year * 12 + bucket.month;
    const futureGuard = currentGlobalMonthCode - cohortMonthCode;
    
    const trials = bucket.trials.size;
    const activeTrialsCount = bucket.activeTrials.size;
    const firstPaid = bucket.paidCustomers.size;
    const secondPlusPaid = bucket.secondPlusPaid.size;
    const conversion = trials > 0 ? ((firstPaid / trials) * 100).toFixed(1) : '0.0';

    let cumulativeRevenue = 0;
    let cumulativeGross = 0;
    let cumulativeStripeFees = 0;
    let cumulativeRefunds = 0;

    for (let m = 0; m <= 12; m++) {
      if (m <= futureGuard) {
        const gross = bucket.gross[m] || 0;
        const stripeFee = bucket.stripeFees[m] || 0;
        const refunded = bucket.refunded[m] || 0;
        
        cumulativeRevenue += (gross - stripeFee - refunded);
        cumulativeGross += gross;
        cumulativeStripeFees += stripeFee;
        cumulativeRefunds += refunded;
      }
    }

    const ltvWaterfall = firstPaid > 0 ? (cumulativeRevenue / firstPaid).toFixed(2) : '0.00';
    const adSpend = adSpendData[cohortKey] || 0;
    const cpt = trials > 0 ? (adSpend / trials).toFixed(2) : '0.00';
    const cpaSub = firstPaid > 0 ? (adSpend / firstPaid).toFixed(2) : '0.00';
    const grossRev = cumulativeGross.toFixed(2);
    const netRev = cumulativeRevenue.toFixed(2);
    const roas = adSpend > 0 ? (cumulativeRevenue / adSpend).toFixed(2) : '0.00';

    return {
      date: cohortKey,
      trials,
      activeTrials: activeTrialsCount,
      firstPaid,
      secondPlusPaid,
      conversion: `${conversion}%`,
      cpt: `$${cpt}`,
      cpaSub: `$${cpaSub}`,
      ltvWaterfall: `$${ltvWaterfall}`,
      adSpend: `$${adSpend.toFixed(2)}`,
      stripeFees: `$${cumulativeStripeFees.toFixed(2)}`,
      refunds: `$${cumulativeRefunds.toFixed(2)}`,
      grossRev: `$${grossRev}`,
      netRev: `$${netRev}`,
      roas: `${roas}x`
    };
  });

  // LTV & Retention Waterfalls
  const ltvWaterfall = cohortKeys.map(cohortKey => {
    const bucket = cohortBuckets[cohortKey];
    const cohortMonthCode = bucket.year * 12 + bucket.month;
    const futureGuard = currentGlobalMonthCode - cohortMonthCode;
    
    const row = { cohort: cohortKey, size: bucket.paidCustomers.size };
    
    for (let m = 0; m <= 6; m++) {
      if (m > futureGuard) {
        row[`m${m}`] = null;
      } else {
        let cumulative = 0;
        for (let i = 0; i <= m; i++) {
          const gross = bucket.gross[i] || 0;
          const stripeFee = bucket.stripeFees[i] || 0;
          const refunded = bucket.refunded[i] || 0;
          cumulative += (gross - stripeFee - refunded);
        }
        const ltv = bucket.paidCustomers.size > 0 ? (cumulative / bucket.paidCustomers.size).toFixed(2) : '0.00';
        row[`m${m}`] = ltv;
      }
    }
    
    return row;
  });

  const retentionWaterfall = cohortKeys.map(cohortKey => {
    const bucket = cohortBuckets[cohortKey];
    const cohortMonthCode = bucket.year * 12 + bucket.month;
    const futureGuard = currentGlobalMonthCode - cohortMonthCode;
    
    const row = { cohort: cohortKey, size: bucket.paidCustomers.size };
    
    for (let m = 0; m <= 6; m++) {
      if (m > futureGuard) {
        row[`m${m}`] = null;
      } else {
        if (!bucket.active[m]) {
          bucket.active[m] = new Set();
        }
        
        data.forEach(dataRow => {
          const cid = dataRow[customerCol];
          const status = dataRow[statusCol] || '';
          const currency = dataRow[currencyCol] || '';
          const amount = parseFloat(dataRow[amountCol] || 0);
          const txDate = new Date(dataRow[dateCol]);
          
          if ((status === 'Paid' || status === 'paid') && (currency === 'usd' || currency === 'USD') && amount > 0) {
            const trialStartDate = allTrialCustomers.get(cid);
            if (!trialStartDate) return;
            
            const customerCohortKey = `${trialStartDate.getUTCFullYear()}-${String(trialStartDate.getUTCMonth() + 1).padStart(2, '0')}`;
            if (customerCohortKey !== cohortKey) return;
            
            const timeIndex = (txDate.getUTCFullYear() - trialStartDate.getUTCFullYear()) * 12 + 
                              (txDate.getUTCMonth() - trialStartDate.getUTCMonth());
            
            if (timeIndex === m) {
              bucket.active[m].add(cid);
            }
          }
        });
        
        const retention = bucket.paidCustomers.size > 0 
          ? ((bucket.active[m].size / bucket.paidCustomers.size) * 100).toFixed(1)
          : '0.0';
        row[`m${m}`] = retention;
      }
    }
    
    return row;
  });

  // Spend vs Revenue Chart
  const spendVsRevenue = cohortKeys.map(cohortKey => {
    const bucket = cohortBuckets[cohortKey];
    let revenue = 0;
    
    for (let m = 0; m <= 12; m++) {
      const gross = bucket.gross[m] || 0;
      const stripeFee = bucket.stripeFees[m] || 0;
      const refunded = bucket.refunded[m] || 0;
      revenue += (gross - stripeFee - refunded);
    }
    
    return {
      month: cohortKey,
      adSpend: adSpendData[cohortKey] || 0,
      revenue: parseFloat(revenue.toFixed(2))
    };
  });

  return {
    cohortTable,
    cohorts: cohortKeys,
    summary: {
      totalTrials: trialCustomers.size,
      activeTrials: activeTrials.size,
      totalPaid: paidCustomers.size,
      totalGrossRevenue: totalGrossRevenue.toFixed(2),
      totalStripeFees: totalStripeFees.toFixed(2),
      totalRefunds: totalRefunds.toFixed(2),
      totalNetRevenue: (totalGrossRevenue - totalStripeFees - totalRefunds).toFixed(2),
      recoveryRate: `${recoveryRate}%`,
      zombieRevenue: `${zombieRevenue}%`
    },
    trialVelocity: Object.entries(trialVelocityBuckets).map(([label, count]) => ({
      label,
      count,
      percent: totalConverted > 0 ? ((count / totalConverted) * 100).toFixed(1) : 0
    })),
    refundBreakdown,
    ltvWaterfall,
    retentionWaterfall,
    spendVsRevenue
  };
};

// ==================== MAIN COMPONENT ====================

export default function WellnessDashboard() {
  const [rawData, setRawData] = useState(null);
  const [stripeFeePercent, setStripeFeePercent] = useState(7.5);
  const [adSpendData, setAdSpendData] = useState({});
  const [dateRangeDays, setDateRangeDays] = useState(null);
  const [columnOrder, setColumnOrder] = useState(DEFAULT_COLUMN_ORDER);
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [showAdSpendModal, setShowAdSpendModal] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [loadingState, setLoadingState] = useState('idle'); // idle, loading, saving, loaded
  const [savedDataInfo, setSavedDataInfo] = useState(null);
  
  // NEW: Enhanced analytics state
  const [activeTab, setActiveTab] = useState(0);
  const [enhancedAnalytics, setEnhancedAnalytics] = useState(null);

  // Initialize session and load data from Supabase
  useEffect(() => {
    const sid = getSessionId();
    setSessionId(sid);
    loadDataFromSupabase(sid);
  }, []);

  // Load localStorage data on mount
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

  // NEW: Process enhanced analytics when rawData changes
  useEffect(() => {
    if (rawData) {
      console.log('🔄 Processing enhanced analytics...');
      const enhanced = processEnhancedAnalytics(rawData);
      setEnhancedAnalytics(enhanced);
      console.log('✅ Enhanced Analytics:', enhanced);
    }
  }, [rawData]);

  // SUPABASE: Load transactions and settings
  const loadDataFromSupabase = async (sid) => {
    if (!sid || !isSupabaseConfigured()) return;
    
    setLoadingState('loading');
    try {
      // Load transactions
      const { data: transactions, error: txError } = await supabase
        .from('stripe_transactions')
        .select('*')
        .eq('user_session_id', sid)
        .order('created_date', { ascending: true });

      if (txError) throw txError;

      if (transactions && transactions.length > 0) {
        // Convert Supabase data to CSV format
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

      // Load ad spend data
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

      // Load settings
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

  // SUPABASE: Save transactions to database
  const saveToSupabase = async (csvData) => {
    if (!sessionId || !csvData || !isSupabaseConfigured()) return;

    setLoadingState('saving');
    try {
      // First, delete existing data for this session
      await supabase
        .from('stripe_transactions')
        .delete()
        .eq('user_session_id', sessionId);

      // Prepare data for insertion
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

      // Insert in batches of 1000
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

  // SUPABASE: Save ad spend data
  const saveAdSpendToSupabase = async (cohort, amount) => {
    if (!sessionId || !isSupabaseConfigured()) return;

    try {
      const { error } = await supabase
        .from('ad_spend_data')
        .upsert({
          user_session_id: sessionId,
          cohort_month: cohort,
          ad_spend: parseFloat(amount),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_session_id,cohort_month'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving ad spend:', error);
    }
  };

  // SUPABASE: Save settings
  const saveSettingsToSupabase = async () => {
    if (!sessionId || !isSupabaseConfigured()) return;

    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_session_id: sessionId,
          stripe_fee_percent: stripeFeePercent,
          date_range_days: dateRangeDays,
          column_order: columnOrder,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_session_id'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  // SUPABASE: Clear all data for this session
  const clearSupabaseData = async () => {
    if (!sessionId || !isSupabaseConfigured()) return;
    if (!confirm('This will delete all your saved data from the cloud. Continue?')) return;

    try {
      await supabase.from('stripe_transactions').delete().eq('user_session_id', sessionId);
      await supabase.from('ad_spend_data').delete().eq('user_session_id', sessionId);
      await supabase.from('user_settings').delete().eq('user_session_id', sessionId);
      
      setRawData(null);
      setAdSpendData({});
      setSavedDataInfo(null);
      alert('All cloud data cleared successfully');
    } catch (error) {
      console.error('Error clearing data:', error);
      alert('Failed to clear data');
    }
  };

  // Update file upload handler
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

  const handleAdSpendChange = (cohort, value) => {
    const newAdSpendData = { ...adSpendData, [cohort]: parseFloat(value) || 0 };
    setAdSpendData(newAdSpendData);
    saveAdSpendToSupabase(cohort, value);
  };

  const moveColumnUp = (index) => {
    if (index === 0) return;
    const newOrder = [...columnOrder];
    [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
    setColumnOrder(newOrder);
    saveSettingsToSupabase();
  };

  const moveColumnDown = (index) => {
    if (index === columnOrder.length - 1) return;
    const newOrder = [...columnOrder];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setColumnOrder(newOrder);
    saveSettingsToSupabase();
  };

  const data = useMemo(() => {
    if (!rawData) return null;
    return processData(rawData, stripeFeePercent, adSpendData, dateRangeDays);
  }, [rawData, stripeFeePercent, adSpendData, dateRangeDays]);

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-8">
        <div className="max-w-2xl w-full">
          <div className="bg-gray-900 border-2 border-gray-800 rounded-2xl p-12 text-center shadow-2xl">
            <div className="mb-8">
              <div className="inline-block p-6 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl mb-6">
                <Upload className="w-16 h-16 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-white mb-3">Wellness Analytics Pro</h1>
              <p className="text-gray-400 text-lg">CFO-Grade Subscription Analytics</p>
            </div>

            {/* Cloud Status */}
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
              <h2 className="text-lg font-semibold text-white mb-4">✨ Enhanced Features</h2>
              <div className="grid grid-cols-2 gap-3 text-sm text-gray-400">
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
                  <span>Geo Insights</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Behavior Segments</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>LTV Waterfalls</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Retention Analysis</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Cloud Sync</span>
                </div>
              </div>
            </div>

            {savedDataInfo && (
              <button
                onClick={clearSupabaseData}
                className="mt-6 px-4 py-2 bg-red-900/50 hover:bg-red-900 border border-red-700 rounded-lg text-red-300 text-sm flex items-center gap-2 mx-auto"
              >
                <Trash2 className="w-4 h-4" />
                Clear Cloud Data
              </button>
            )}
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
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                Wellness Analytics Pro <span className="text-purple-400">Enhanced</span>
              </h1>
              <p className="text-gray-400">Advanced Analytics • Payment Intelligence • Geographic Insights</p>
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
              <button
                onClick={() => setShowColumnModal(true)}
                className="px-4 py-2 bg-purple-900/50 hover:bg-purple-900 border border-purple-700 rounded-lg text-purple-300 text-sm flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Columns
              </button>
              <button
                onClick={() => setShowAdSpendModal(true)}
                className="px-4 py-2 bg-emerald-900/50 hover:bg-emerald-900 border border-emerald-700 rounded-lg text-emerald-300 text-sm flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                Ad Spend
              </button>
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

        {/* Main Dashboard with Tabs */}
        <Tabs activeTab={activeTab} onTabChange={setActiveTab}>
          
          {/* Tab 1: Overview with Enhanced Analytics */}
          <Tab label="📊 Overview">
            <div className="space-y-6">
              
              {/* Enhanced Analytics Summary - Only show if we have enhanced data */}
              {enhancedAnalytics && (
                <>
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
                                  <span className="font-medium text-white">
                                    ${segment.avgLTV}
                                  </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-500">Success Rate</span>
                                  <span className="font-medium text-green-400">
                                    {segment.avgSuccessRate}%
                                  </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-500">Total Revenue</span>
                                  <span className="font-medium text-blue-400">
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
                </>
              )}

              {/* Original Summary Cards */}
              <div className="pt-6 border-t border-gray-800">
                <h2 className="text-xl font-bold text-white mb-4">Classic Metrics</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  <MetricCard label="Total Trials" value={data.summary.totalTrials.toLocaleString()} subtext="All time" color="text-blue-400" />
                  <MetricCard label="Active Trials" value={data.summary.activeTrials.toLocaleString()} subtext="Last 7 days" color="text-cyan-400" />
                  <MetricCard label="Paid Customers" value={data.summary.totalPaid.toLocaleString()} subtext="Converted" color="text-green-400" />
                  <MetricCard label="Net Revenue" value={`$${parseFloat(data.summary.totalNetRevenue).toLocaleString()}`} subtext="After fees & refunds" color="text-emerald-400" />
                  <MetricCard label="Win-Back Rate" value={data.summary.recoveryRate} subtext="Failed → Paid" color="text-purple-400" />
                </div>
              </div>

            </div>
          </Tab>

          {/* Tab 2: Payment Intelligence */}
          <Tab label="💳 Payment Intelligence">
            {enhancedAnalytics && (
              <div className="space-y-6">
                
                {/* Top KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard 
                    label="Payment Methods"
                    value={enhancedAnalytics.paymentMethods.length}
                    subtext="Different types used"
                    icon={<CreditCard className="w-5 h-5" />}
                    color="text-blue-400"
                  />
                  <MetricCard 
                    label="Top Method Success"
                    value={`${enhancedAnalytics.paymentMethods[0]?.successRate || 0}%`}
                    subtext={enhancedAnalytics.paymentMethods[0]?.name || 'N/A'}
                    icon={<CheckCircle className="w-5 h-5" />}
                    color="text-green-400"
                  />
                  <MetricCard 
                    label="Decline Reasons"
                    value={enhancedAnalytics.declineReasons.length}
                    subtext="Different failure types"
                    icon={<AlertCircle className="w-5 h-5" />}
                    color="text-red-400"
                  />
                  <MetricCard 
                    label="Lost Revenue"
                    value={`$${enhancedAnalytics.declineReasons.reduce((sum, r) => sum + parseFloat(r.lostRevenue), 0).toLocaleString()}`}
                    subtext="From failed payments"
                    icon={<TrendingDown className="w-5 h-5" />}
                    color="text-orange-400"
                  />
                </div>

                {/* Payment Method Performance */}
                <Section title="Payment Method Performance" icon={<CreditCard className="text-blue-400" />}>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      {enhancedAnalytics.paymentMethods.slice(0, 3).map((method, idx) => (
                        <div key={idx} className="bg-gray-800/50 border border-gray-700 p-5 rounded-lg hover:border-gray-600 transition-all">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-lg text-white capitalize">
                              {method.name === 'apple_pay' ? 'Apple Pay' : 
                               method.name === 'google_pay' ? 'Google Pay' : 
                               method.name}
                            </h3>
                            {idx === 0 && (
                              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded font-medium">
                                Best
                              </span>
                            )}
                          </div>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-400">Success Rate</span>
                              <span className="text-lg font-bold text-green-400">
                                {method.successRate}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-900 rounded-full h-2">
                              <div 
                                className="bg-green-500 h-2 rounded-full transition-all"
                                style={{ width: `${method.successRate}%` }}
                              />
                            </div>
                            <div className="pt-2 border-t border-gray-700 space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Transactions</span>
                                <span className="text-white font-medium">{method.total.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Revenue</span>
                                <span className="text-blue-400 font-medium">${parseFloat(method.revenue).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Avg Transaction</span>
                                <span className="text-purple-400 font-medium">${method.avgTransaction}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Failure Rate</span>
                                <span className="text-red-400 font-medium">{method.failureRate}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Comparison Chart */}
                    {enhancedAnalytics.paymentMethods.length > 0 && (
                      <div className="h-80">
                        <h3 className="text-sm font-semibold text-gray-300 mb-4">Success Rate Comparison</h3>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={enhancedAnalytics.paymentMethods}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis 
                              dataKey="name" 
                              stroke="#666"
                              tick={{ fill: '#999' }}
                            />
                            <YAxis stroke="#666" tick={{ fill: '#999' }} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#333' }}
                              formatter={(value) => `${value}%`}
                            />
                            <Bar dataKey="successRate" fill="#10b981" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </Section>

                {/* Card Brand Analysis */}
                {enhancedAnalytics.cardBrands.length > 0 && (
                  <Section title="Card Brand Performance" icon={<CreditCard className="text-purple-400" />}>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        {enhancedAnalytics.cardBrands.slice(0, 4).map((brand, idx) => (
                          <div key={idx} className="bg-gray-800/50 border border-gray-700 p-4 rounded-lg">
                            <h3 className="text-xl font-bold mb-2 text-white">{brand.name}</h3>
                            <div className="space-y-2">
                              <div className="text-3xl font-bold text-green-400">{brand.successRate}%</div>
                              <div className="text-xs text-gray-500">success rate</div>
                              <div className="pt-2 border-t border-gray-700 space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-500">Transactions</span>
                                  <span className="text-white">{brand.total}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-500">Revenue</span>
                                  <span className="text-blue-400">${parseFloat(brand.revenue).toLocaleString()}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={enhancedAnalytics.cardBrands}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis dataKey="name" stroke="#666" />
                            <YAxis stroke="#666" />
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#333' }} />
                            <Bar dataKey="successRate" fill="#a855f7" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </Section>
                )}

                {/* Credit vs Debit Analysis */}
                {enhancedAnalytics.cardFundings.length > 0 && (
                  <Section title="Credit vs Debit Performance" icon={<CreditCard className="text-cyan-400" />}>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        {enhancedAnalytics.cardFundings.map((funding, idx) => (
                          <div key={idx} className="bg-gray-800/50 border border-gray-700 p-5 rounded-lg">
                            <h3 className="text-lg font-semibold mb-3 text-white capitalize">{funding.name}</h3>
                            <div className="space-y-3">
                              <div className="text-3xl font-bold text-cyan-400">{funding.successRate}%</div>
                              <div className="text-sm text-gray-500">success rate</div>
                              <div className="pt-3 border-t border-gray-700 space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-400">Transactions</span>
                                  <span className="text-white font-medium">{funding.total.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-400">Revenue</span>
                                  <span className="text-blue-400 font-medium">${parseFloat(funding.revenue).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-400">Avg Transaction</span>
                                  <span className="text-purple-400 font-medium">${funding.avgTransaction}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Insight Box */}
                      {enhancedAnalytics.cardFundings.length >= 2 && (
                        <div className="p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
                          <div className="flex items-start gap-3">
                            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <h4 className="font-semibold text-blue-300 mb-1">Key Insight</h4>
                              <p className="text-sm text-blue-200">
                                {parseFloat(enhancedAnalytics.cardFundings[0].successRate) > parseFloat(enhancedAnalytics.cardFundings[1].successRate) 
                                  ? `${enhancedAnalytics.cardFundings[0].name} cards perform ${(parseFloat(enhancedAnalytics.cardFundings[0].successRate) - parseFloat(enhancedAnalytics.cardFundings[1].successRate)).toFixed(1)}% better than ${enhancedAnalytics.cardFundings[1].name} cards. Consider incentivizing ${enhancedAnalytics.cardFundings[0].name} card usage.`
                                  : `${enhancedAnalytics.cardFundings[1].name} cards perform ${(parseFloat(enhancedAnalytics.cardFundings[1].successRate) - parseFloat(enhancedAnalytics.cardFundings[0].successRate)).toFixed(1)}% better than ${enhancedAnalytics.cardFundings[0].name} cards.`
                                }
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </Section>
                )}

                {/* Decline Reasons Breakdown */}
                <Section title="Payment Decline Analysis" icon={<AlertCircle className="text-red-400" />}>
                  <div className="p-6">
                    <div className="space-y-3">
                      {enhancedAnalytics.declineReasons.map((reason, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-gray-600 transition-all">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-2xl font-bold text-gray-600">#{idx + 1}</span>
                              <div>
                                <h3 className="font-semibold text-white">{reason.reason}</h3>
                                <p className="text-sm text-gray-400">
                                  {reason.count} failures • ${reason.lostRevenue} lost revenue
                                </p>
                              </div>
                            </div>
                            <div className="w-full bg-gray-900 rounded-full h-2">
                              <div 
                                className="bg-red-500 h-2 rounded-full"
                                style={{ width: `${reason.percentage}%` }}
                              />
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <div className="text-2xl font-bold text-red-400">{reason.percentage}%</div>
                            <div className="text-xs text-gray-500">of failures</div>
                            <div className="text-sm text-gray-400 mt-1">${reason.avgAmount} avg</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Recovery Recommendations */}
                    <div className="mt-6 p-5 bg-purple-900/20 border border-purple-800 rounded-lg">
                      <div className="flex items-start gap-3">
                        <RefreshCw className="w-6 h-6 text-purple-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-purple-300 mb-2 text-lg">Recovery Recommendations</h4>
                          <div className="space-y-2 text-sm text-purple-200">
                            {enhancedAnalytics.declineReasons[0] && (
                              <p>• <strong>Top issue: {enhancedAnalytics.declineReasons[0].reason}</strong> - 
                                {enhancedAnalytics.declineReasons[0].reason.toLowerCase().includes('insufficient') 
                                  ? ' Wait 48 hours before retry (45% success rate)'
                                  : enhancedAnalytics.declineReasons[0].reason.toLowerCase().includes('expired')
                                  ? ' Request immediate card update (retry won\'t work)'
                                  : enhancedAnalytics.declineReasons[0].reason.toLowerCase().includes('do not honor')
                                  ? ' Request card update (only 12% retry success)'
                                  : ' Review with fraud team or payment processor'
                                }
                              </p>
                            )}
                            <p>• Total recoverable revenue: ~${(enhancedAnalytics.declineReasons.reduce((sum, r) => sum + parseFloat(r.lostRevenue), 0) * 0.35).toFixed(0)} (estimated 35% recovery rate)</p>
                            <p>• Implement automated retry logic with optimized timing for each decline type</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Section>

                {/* Retry Pattern Analysis */}
                {enhancedAnalytics.retryAnalysis.length > 0 && (
                  <Section title="Payment Retry Success Patterns" icon={<RefreshCw className="text-yellow-400" />}>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        {enhancedAnalytics.retryAnalysis.map((pattern, idx) => (
                          <div key={idx} className="bg-gray-800/50 border border-gray-700 p-4 rounded-lg">
                            <h3 className="text-sm text-gray-400 mb-2 capitalize">{pattern.timing}</h3>
                            <div className="text-3xl font-bold text-yellow-400 mb-1">
                              {pattern.successRate}%
                            </div>
                            <div className="text-xs text-gray-500 mb-3">success rate</div>
                            <div className="text-xs text-gray-400">
                              {pattern.successes} of {pattern.attempts} succeeded
                            </div>
                            {idx === enhancedAnalytics.retryAnalysis.reduce((best, curr, i, arr) => 
                              parseFloat(curr.successRate) > parseFloat(arr[best].successRate) ? i : best, 0
                            ) && (
                              <div className="mt-2 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-center font-medium">
                                Optimal Time
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="p-4 bg-green-900/20 border border-green-800 rounded-lg">
                        <div className="flex items-start gap-3">
                          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-semibold text-green-300 mb-1">Recommendation</h4>
                            <p className="text-sm text-green-200">
                              Best results: Wait {enhancedAnalytics.retryAnalysis.reduce((best, curr) => 
                                parseFloat(curr.successRate) > parseFloat(best.successRate) ? curr : best
                              ).timing} before retrying failed payments. 
                              This timing shows {enhancedAnalytics.retryAnalysis.reduce((best, curr) => 
                                parseFloat(curr.successRate) > parseFloat(best.successRate) ? curr : best
                              ).successRate}% success rate vs {enhancedAnalytics.retryAnalysis[0].successRate}% for immediate retries.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Section>
                )}

              </div>
            )}
          </Tab>

          {/* Tab 4: Geography */}
          <Tab label="🗺️ Geography">
            {enhancedAnalytics && (
              <div className="space-y-6">
                
                {/* Top KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard 
                    label="Countries"
                    value={enhancedAnalytics.countries.length}
                    subtext="Markets active in"
                    icon={<MapPin className="w-5 h-5" />}
                    color="text-blue-400"
                  />
                  <MetricCard 
                    label="Top Country"
                    value={enhancedAnalytics.countries[0]?.name || 'N/A'}
                    subtext={`${enhancedAnalytics.countries[0]?.total || 0} transactions`}
                    icon={<TrendingUp className="w-5 h-5" />}
                    color="text-green-400"
                  />
                  <MetricCard 
                    label="US States"
                    value={enhancedAnalytics.states.length}
                    subtext="Active states"
                    icon={<MapPin className="w-5 h-5" />}
                    color="text-purple-400"
                  />
                  <MetricCard 
                    label="Top State"
                    value={enhancedAnalytics.states[0]?.name || 'N/A'}
                    subtext={`$${enhancedAnalytics.states[0]?.avgTransaction || 0} avg`}
                    icon={<DollarSign className="w-5 h-5" />}
                    color="text-emerald-400"
                  />
                </div>

                {/* Country Performance */}
                <Section title="Performance by Country" icon={<MapPin className="text-blue-400" />}>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                      {enhancedAnalytics.countries.slice(0, 6).map((country, idx) => (
                        <div 
                          key={idx}
                          className="bg-gray-800/50 border border-gray-700 p-5 rounded-lg hover:border-gray-600 transition-all"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-2xl font-bold text-white">{country.name}</h3>
                            {idx === 0 && (
                              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded font-medium">
                                #1
                              </span>
                            )}
                          </div>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-400">Success Rate</span>
                              <span className="text-xl font-bold text-green-400">
                                {country.successRate}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-900 rounded-full h-2">
                              <div 
                                className="bg-green-500 h-2 rounded-full"
                                style={{ width: `${country.successRate}%` }}
                              />
                            </div>
                            <div className="pt-2 border-t border-gray-700 space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Transactions</span>
                                <span className="text-white font-medium">{country.total.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Revenue</span>
                                <span className="text-blue-400 font-medium">${parseFloat(country.revenue).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Avg Transaction</span>
                                <span className="text-purple-400 font-medium">${country.avgTransaction}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Country Comparison Chart */}
                    {enhancedAnalytics.countries.length > 0 && (
                      <div className="h-80">
                        <h3 className="text-sm font-semibold text-gray-300 mb-4">Success Rate by Country</h3>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={enhancedAnalytics.countries}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis dataKey="name" stroke="#666" />
                            <YAxis stroke="#666" />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#333' }}
                              formatter={(value) => `${value}%`}
                            />
                            <Bar dataKey="successRate" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </Section>

                {/* US State Performance */}
                {enhancedAnalytics.states.length > 0 && (
                  <Section title="Top US States by Performance" icon={<MapPin className="text-emerald-400" />}>
                    <div className="p-6">
                      <div className="space-y-3 mb-6">
                        {enhancedAnalytics.states.slice(0, 10).map((state, idx) => (
                          <div 
                            key={idx}
                            className="flex items-center justify-between p-4 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-gray-600 transition-all"
                          >
                            <div className="flex items-center gap-4 flex-1">
                              <div className="text-3xl font-bold text-gray-600 w-8">#{idx + 1}</div>
                              <div className="flex-1">
                                <h3 className="font-semibold text-lg text-white mb-1">{state.name}</h3>
                                <div className="flex items-center gap-4 text-sm text-gray-400">
                                  <span>{state.total} transactions</span>
                                  <span>•</span>
                                  <span>{state.successRate}% success</span>
                                </div>
                                <div className="w-full bg-gray-900 rounded-full h-2 mt-2">
                                  <div 
                                    className="bg-emerald-500 h-2 rounded-full"
                                    style={{ width: `${state.successRate}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <div className="text-2xl font-bold text-emerald-400">
                                ${state.avgTransaction}
                              </div>
                              <div className="text-xs text-gray-500">avg transaction</div>
                              <div className="text-sm text-blue-400 mt-1">
                                ${parseFloat(state.revenue).toLocaleString()}
                              </div>
                              <div className="text-xs text-gray-500">total revenue</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* State Performance Chart */}
                      <div className="h-96">
                        <h3 className="text-sm font-semibold text-gray-300 mb-4">Top 10 States by Average Transaction</h3>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart 
                            data={enhancedAnalytics.states.slice(0, 10)}
                            layout="vertical"
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis type="number" stroke="#666" />
                            <YAxis type="category" dataKey="name" stroke="#666" width={50} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#333' }}
                              formatter={(value) => `$${value}`}
                            />
                            <Bar dataKey="avgTransaction" fill="#10b981" radius={[0, 8, 8, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Geographic Insights */}
                      <div className="mt-6 p-5 bg-blue-900/20 border border-blue-800 rounded-lg">
                        <div className="flex items-start gap-3">
                          <Info className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-semibold text-blue-300 mb-2 text-lg">Geographic Insights</h4>
                            <div className="space-y-2 text-sm text-blue-200">
                              {enhancedAnalytics.states.length > 0 && (
                                <p>• <strong>Top State:</strong> {enhancedAnalytics.states[0].name} generates ${enhancedAnalytics.states[0].avgTransaction} per transaction (highest)</p>
                              )}
                              {enhancedAnalytics.states.length >= 3 && (
                                <p>• <strong>Top 3 States:</strong> {enhancedAnalytics.states.slice(0, 3).map(s => s.name).join(', ')} drive {
                                  ((enhancedAnalytics.states.slice(0, 3).reduce((sum, s) => sum + s.total, 0) / 
                                    enhancedAnalytics.states.reduce((sum, s) => sum + s.total, 0)) * 100).toFixed(0)
                                }% of US transactions</p>
                              )}
                              {enhancedAnalytics.countries.length > 1 && (
                                <p>• <strong>International:</strong> {enhancedAnalytics.countries.length} countries active - 
                                  {enhancedAnalytics.countries[0].name} is largest market</p>
                              )}
                              <p>• Consider targeted marketing campaigns in top-performing regions</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Section>
                )}

              </div>
            )}
          </Tab>

          {/* Tab 5: Drop-offs & Friction */}
          <Tab label="🚨 Drop-offs">
            {enhancedAnalytics && (
              <div className="space-y-6">
                
                {/* Top KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard 
                    label="Funnel Stages"
                    value={enhancedAnalytics.conversionFunnel.length}
                    subtext="Tracking points"
                    icon={<Target className="w-5 h-5" />}
                    color="text-blue-400"
                  />
                  <MetricCard 
                    label="Overall Conversion"
                    value={`${enhancedAnalytics.conversionFunnel[enhancedAnalytics.conversionFunnel.length - 1]?.percentage || 0}%`}
                    subtext="End-to-end"
                    icon={<TrendingUp className="w-5 h-5" />}
                    color="text-green-400"
                  />
                  <MetricCard 
                    label="Biggest Drop"
                    value={`${Math.max(...enhancedAnalytics.conversionFunnel.slice(0, -1).map((stage, idx) => 
                      stage.percentage - enhancedAnalytics.conversionFunnel[idx + 1].percentage
                    )).toFixed(1)}%`}
                    subtext="Largest leak"
                    icon={<TrendingDown className="w-5 h-5" />}
                    color="text-red-400"
                  />
                  <MetricCard 
                    label="Retry Success"
                    value={`${enhancedAnalytics.retryAnalysis.reduce((best, curr) => 
                      parseFloat(curr.successRate) > parseFloat(best.successRate) ? curr : best
                    ).successRate}%`}
                    subtext="Optimal timing"
                    icon={<RefreshCw className="w-5 h-5" />}
                    color="text-purple-400"
                  />
                </div>

                {/* Detailed Conversion Funnel */}
                <Section title="Detailed Conversion Funnel" icon={<Target className="text-yellow-400" />}>
                  <div className="p-6">
                    <div className="space-y-6">
                      {enhancedAnalytics.conversionFunnel.map((stage, idx) => (
                        <div key={idx}>
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h3 className="text-xl font-semibold text-white mb-1">
                                {idx + 1}. {stage.stage}
                              </h3>
                              <p className="text-sm text-gray-400">
                                {stage.count.toLocaleString()} customers ({stage.percentage}% of total)
                              </p>
                            </div>
                            {idx > 0 && (
                              <div className="text-right">
                                <div className="text-2xl font-bold text-red-400">
                                  -{(enhancedAnalytics.conversionFunnel[idx-1].percentage - stage.percentage).toFixed(1)}%
                                </div>
                                <div className="text-xs text-gray-500">lost from previous</div>
                                <div className="text-sm text-gray-400 mt-1">
                                  {(enhancedAnalytics.conversionFunnel[idx-1].count - stage.count).toLocaleString()} customers
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="relative">
                            <div className="w-full bg-gray-800 rounded-full h-6 overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-purple-600 to-pink-600 rounded-full transition-all duration-500 flex items-center justify-end pr-4"
                                style={{ width: `${stage.percentage}%` }}
                              >
                                <span className="text-white text-xs font-bold">
                                  {stage.percentage}%
                                </span>
                              </div>
                            </div>
                          </div>
                          {idx < enhancedAnalytics.conversionFunnel.length - 1 && (
                            <div className="flex items-center justify-center my-2">
                              <div className="text-red-400 flex items-center gap-2 text-sm">
                                <span>↓</span>
                                <span className="font-medium">
                                  {((enhancedAnalytics.conversionFunnel[idx].percentage - 
                                     enhancedAnalytics.conversionFunnel[idx + 1].percentage) / 
                                     enhancedAnalytics.conversionFunnel[idx].percentage * 100).toFixed(1)}% 
                                  drop-off rate
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Critical Drop-offs Summary */}
                    <div className="mt-8 p-5 bg-red-900/20 border border-red-800 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-red-300 mb-2 text-lg">Critical Drop-off Points</h4>
                          <div className="space-y-2 text-sm text-red-200">
                            {enhancedAnalytics.conversionFunnel.slice(0, -1).map((stage, idx) => {
                              const dropOff = stage.percentage - enhancedAnalytics.conversionFunnel[idx + 1].percentage;
                              return dropOff > 10 ? (
                                <p key={idx}>
                                  • <strong>{stage.stage} → {enhancedAnalytics.conversionFunnel[idx + 1].stage}:</strong> {dropOff.toFixed(1)}% drop 
                                  ({(stage.count - enhancedAnalytics.conversionFunnel[idx + 1].count).toLocaleString()} customers lost)
                                </p>
                              ) : null;
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Section>

                {/* Payment Retry Patterns */}
                <Section title="Payment Retry Success Patterns" icon={<RefreshCw className="text-purple-400" />}>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      {enhancedAnalytics.retryAnalysis.map((pattern, idx) => {
                        const isOptimal = idx === enhancedAnalytics.retryAnalysis.reduce((best, curr, i, arr) => 
                          parseFloat(curr.successRate) > parseFloat(arr[best].successRate) ? i : best, 0
                        );
                        return (
                          <div 
                            key={idx}
                            className={`bg-gray-800/50 border ${isOptimal ? 'border-yellow-500' : 'border-gray-700'} p-5 rounded-lg`}
                          >
                            <h3 className="text-sm text-gray-400 mb-2 capitalize">{pattern.timing}</h3>
                            <div className="text-4xl font-bold text-purple-400 mb-2">
                              {pattern.successRate}%
                            </div>
                            <div className="text-xs text-gray-500 mb-3">success rate</div>
                            <div className="pt-3 border-t border-gray-700 space-y-1">
                              <div className="text-xs text-gray-400">
                                {pattern.successes} of {pattern.attempts} succeeded
                              </div>
                              {isOptimal && (
                                <div className="mt-2 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-center font-bold">
                                  ⭐ OPTIMAL TIME
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Retry Strategy Chart */}
                    <div className="h-80 mb-6">
                      <h3 className="text-sm font-semibold text-gray-300 mb-4">Success Rate by Retry Timing</h3>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={enhancedAnalytics.retryAnalysis}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                          <XAxis dataKey="timing" stroke="#666" />
                          <YAxis stroke="#666" />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#333' }}
                            formatter={(value) => `${value}%`}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="successRate" 
                            stroke="#a855f7" 
                            strokeWidth={3}
                            dot={{ fill: '#a855f7', r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Recommendation Box */}
                    <div className="p-5 bg-green-900/20 border border-green-800 rounded-lg">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-green-300 mb-2 text-lg">Retry Strategy Recommendation</h4>
                          <div className="space-y-2 text-sm text-green-200">
                            {(() => {
                              const optimal = enhancedAnalytics.retryAnalysis.reduce((best, curr) => 
                                parseFloat(curr.successRate) > parseFloat(best.successRate) ? curr : best
                              );
                              const immediate = enhancedAnalytics.retryAnalysis[0];
                              return (
                                <>
                                  <p>
                                    • <strong>Optimal timing:</strong> {optimal.timing} with {optimal.successRate}% success rate
                                  </p>
                                  <p>
                                    • <strong>Improvement:</strong> {(parseFloat(optimal.successRate) - parseFloat(immediate.successRate)).toFixed(1)}% 
                                    better than immediate retry ({immediate.successRate}%)
                                  </p>
                                  <p>
                                    • <strong>Implementation:</strong> Set up automated retry queue with {optimal.timing} delay
                                  </p>
                                  <p>
                                    • <strong>Expected impact:</strong> Could recover an additional {
                                      Math.round((parseFloat(optimal.successRate) - parseFloat(immediate.successRate)) / 100 * 
                                      enhancedAnalytics.summary.failedTransactions * 0.5)
                                    } transactions per period
                                  </p>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Section>

                {/* Friction Points Summary */}
                <Section title="Key Takeaways & Action Items" icon={<Target className="text-blue-400" />}>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Biggest Leaks */}
                      <div className="bg-gray-800/50 border border-gray-700 p-5 rounded-lg">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                          <AlertCircle className="w-5 h-5 text-red-400" />
                          Biggest Leaks
                        </h3>
                        <div className="space-y-3">
                          {enhancedAnalytics.conversionFunnel.slice(0, -1).map((stage, idx) => {
                            const dropOff = stage.percentage - enhancedAnalytics.conversionFunnel[idx + 1].percentage;
                            const lostCustomers = stage.count - enhancedAnalytics.conversionFunnel[idx + 1].count;
                            return (
                              <div key={idx} className="text-sm">
                                <div className="flex justify-between mb-1">
                                  <span className="text-gray-300">Stage {idx + 1} → {idx + 2}</span>
                                  <span className="text-red-400 font-bold">{dropOff.toFixed(1)}%</span>
                                </div>
                                <div className="text-xs text-gray-500">
                                  {lostCustomers.toLocaleString()} customers lost
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Quick Wins */}
                      <div className="bg-gray-800/50 border border-gray-700 p-5 rounded-lg">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                          <Zap className="w-5 h-5 text-yellow-400" />
                          Quick Wins
                        </h3>
                        <div className="space-y-3 text-sm text-gray-300">
                          <div className="flex items-start gap-2">
                            <span className="text-green-400">•</span>
                            <span>Implement {enhancedAnalytics.retryAnalysis.reduce((best, curr) => 
                              parseFloat(curr.successRate) > parseFloat(best.successRate) ? curr : best
                            ).timing} retry delay (+{(parseFloat(enhancedAnalytics.retryAnalysis.reduce((best, curr) => 
                              parseFloat(curr.successRate) > parseFloat(best.successRate) ? curr : best
                            ).successRate) - parseFloat(enhancedAnalytics.retryAnalysis[0].successRate)).toFixed(1)}% recovery)</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-green-400">•</span>
                            <span>Focus on stage with biggest drop-off</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-green-400">•</span>
                            <span>Add friction logging to identify exact issues</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-green-400">•</span>
                            <span>A/B test checkout flow improvements</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </Section>

              </div>
            )}
          </Tab>

              {/* Tab 6: Classic Cohort View */}
          <Tab label="📈 Classic Cohorts">
            <div className="space-y-6">

              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                <MetricCard 
                  label="Total Trials" 
                  value={data.summary.totalTrials.toLocaleString()} 
                  subtext="All time" 
                  color="text-blue-400" 
                />
                <MetricCard 
                  label="Active Trials" 
                  value={data.summary.activeTrials.toLocaleString()} 
                  subtext="Last 7 days" 
                  color="text-cyan-400" 
                />
                <MetricCard 
                  label="Paid Customers" 
                  value={data.summary.totalPaid.toLocaleString()} 
                  subtext="Converted" 
                  color="text-green-400" 
                />
                <MetricCard 
                  label="Net Revenue" 
                  value={`$${parseFloat(data.summary.totalNetRevenue).toLocaleString()}`} 
                  subtext="After fees & refunds" 
                  color="text-emerald-400" 
                />
                <MetricCard 
                  label="Win-Back Rate" 
                  value={data.summary.recoveryRate} 
                  subtext="Failed → Paid" 
                  color="text-purple-400" 
                />
              </div>

              {/* Cohort Table */}
              <Section title="Cohort Performance Table" icon={<FileText className="text-indigo-400" />}>
              <div className="overflow-x-auto p-2">
              <table className="w-full text-xs">
              <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                        {columnOrder.map(key => (
              <th key={key} className="p-2 font-medium text-left whitespace-nowrap">
                            {COLUMN_LABELS[key]}
              </th>
                        ))}
              </tr>
              </thead>
              <tbody>
                      {data.cohortTable.map((row, i) => (
              <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/30">
                          {columnOrder.map(key => (
              <td key={key} className="p-2 font-mono text-gray-300 whitespace-nowrap">
                              {row[key]}
              </td>
                          ))}
              </tr>
                      ))}
              </tbody>
              </table>
              </div>
              </Section>

              {/* Additional sections (Refund Breakdown, Trial Velocity, etc.) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Refund Breakdown */}
              <Section title="Refund Breakdown" icon={<AlertCircle className="text-red-400" />}>
              <div className="p-4">
              <table className="w-full text-sm">
              <thead>
              <tr className="text-gray-500 border-b border-gray-800">
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-center">Count</th>
              <th className="p-2 text-right">Value</th>
              <th className="p-2 text-right">%</th>
              </tr>
              </thead>
              <tbody>
                        {data.refundBreakdown.map((row, i) => (
              <tr key={i} className={`border-b border-gray-800 ${row.type === 'Total' ? 'bg-gray-800/50 font-bold' : ''}`}>
              <td className="p-2 text-gray-300">{row.type}</td>
              <td className="p-2 text-center text-gray-400">{row.count}</td>
              <td className="p-2 text-right text-red-400 font-mono">${row.value}</td>
              <td className="p-2 text-right text-gray-500">{row.percent}%</td>
              </tr>
                        ))}
              </tbody>
              </table>
              </div>
              </Section>

              {/* Trial Velocity */}
              <Section title="Trial Velocity (Trial → Paid)" icon={<Zap className="text-yellow-400" />}>
              <div className="p-4">
              <table className="w-full text-sm">
              <thead>
              <tr className="text-gray-500 border-b border-gray-800">
              <th className="p-2 text-left">Timeframe</th>
              <th className="p-2 text-center">Count</th>
              <th className="p-2 text-right">%</th>
              </tr>
              </thead>
              <tbody>
                        {data.trialVelocity.map((row, i) => (
              <tr key={i} className="border-b border-gray-800">
              <td className="p-2 text-gray-300">{row.label}</td>
              <td className="p-2 text-center text-gray-400">{row.count}</td>
              <td className="p-2 text-right text-yellow-400 font-mono">{row.percent}%</td>
              </tr>
                  ))}
              </tbody>
              </table>
              <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
              <p className="text-xs text-gray-400">
              <span className="font-semibold text-yellow-400">Zombie Revenue:</span> {data.summary.zombieRevenue} of conversions took 8+ days
              </p>
              </div>
              </div>
              </Section>
              </div>

              {/* LTV WATERFALL */}
              <Section title="Net LTV Waterfall ($)" icon={<DollarSign className="text-emerald-400" />}>
              <div className="overflow-x-auto p-2">
              <table className="w-full text-xs">
              <thead>
              <tr className="text-gray-500 border-b border-gray-800">
              <th className="p-2 font-medium text-left">Cohort</th>
              <th className="p-2 font-medium text-left">Paid</th>
                  {[0,1,2,3,4,5,6].map(m => (
              <th key={m} className="p-2 font-medium text-center">M{m}</th>
                  ))}
              </tr>
              </thead>
              <tbody>
                {data.ltvWaterfall.map((row, i) => (
              <tr key={i} className="border-b border-gray-800">
              <td className="p-2 font-mono text-emerald-300/80">{row.cohort}</td>
              <td className="p-2 text-gray-400">{row.size}</td>
                    {[0,1,2,3,4,5,6].map(m => {
                      const value = row[`m${m}`];
                      const numValue = parseFloat(value);
                      const getBgColor = () => {
                        if (value === null) return 'bg-gray-800';
                        if (numValue >= 100) return 'bg-emerald-500/90';
                        if (numValue >= 50) return 'bg-emerald-500/50';
                        return 'bg-emerald-500/20';
            };
                      
                      return (
              <td key={m} className={`p-2 text-center ${getBgColor()}`}>
                          {value !== null 
                            ? <span className="font-medium text-white">${value}</span> 
                            : <span className="text-gray-600">-</span>}
              </td>
                      );
            })}
              </tr>
                ))}
              </tbody>
              </table>
              </div>
              </Section>

              {/* RETENTION WATERFALL */}
              <Section title="Retention Waterfall (% Active)" icon={<Users className="text-blue-400" />}>
              <div className="overflow-x-auto p-2">
              <table className="w-full text-xs">
              <thead>
              <tr className="text-gray-500 border-b border-gray-800">
              <th className="p-2 font-medium text-left">Cohort</th>
              <th className="p-2 font-medium text-left">Paid</th>
                  {[0,1,2,3,4,5,6].map(m => (
              <th key={m} className="p-2 font-medium text-center">M{m}</th>
                  ))}
              </tr>
              </thead>
              <tbody>
                {data.retentionWaterfall.map((row, i) => (
              <tr key={i} className="border-b border-gray-800">
              <td className="p-2 font-mono text-blue-300/80">{row.cohort}</td>
              <td className="p-2 text-gray-400">{row.size}</td>
                    {[0,1,2,3,4,5,6].map(m => {
                      const value = row[`m${m}`];
                      const num = parseFloat(value);
                      const getBgColor = () => {
                        if (value === null) return 'bg-gray-800';
                        if (num >= 60) return 'bg-blue-500/70';
                        if (num >= 30) return 'bg-blue-500/40';
                        return 'bg-blue-500/20';
            };
                      
                      return (
              <td key={m} className={`p-2 text-center ${getBgColor()}`}>
                          {value !== null 
                            ? <span className="font-medium text-white">{value}%</span> 
                            : <span className="text-gray-600">-</span>}
              </td>
                      );
            })}
              </tr>
                ))}
              </tbody>
              </table>
              </div>
              </Section>

              {/* SPEND VS REVENUE */}
              <Section title="Spend vs Net Revenue" icon={<TrendingUp className="text-cyan-400" />}>
              <div className="h-80 p-4">
              <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.spendVsRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="month" stroke="#666" angle={-45} textAnchor="end" height={80} />
              <YAxis stroke="#666" />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#333' }} formatter={(value) => `$${value.toLocaleString()}`} />
              <Legend />
              <Bar dataKey="adSpend" fill="#f97316" name="Ad Spend" />
              <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} name="Net Revenue" />
              </ComposedChart>
              </ResponsiveContainer>
              </div>
              </Section>

              </div>
          </Tab>

        </Tabs>

      </div>

      {/* MODALS */}
      {showColumnModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl border border-gray-800 max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-gradient-to-r from-purple-900/20 to-pink-900/20">
              <div className="flex items-center gap-3">
                <Settings className="w-6 h-6 text-purple-400" />
                <h2 className="text-2xl font-bold text-white">Customize Columns</h2>
              </div>
              <button onClick={() => setShowColumnModal(false)} className="p-2 hover:bg-gray-800 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-200px)]">
              <div className="space-y-2">
                {columnOrder.map((key, index) => (
                  <div key={key} className="flex items-center gap-3 bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                    <div className="flex flex-col gap-1">
                      <button onClick={() => moveColumnUp(index)} disabled={index === 0} className={`p-1 rounded ${index === 0 ? 'text-gray-600' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}>
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button onClick={() => moveColumnDown(index)} disabled={index === columnOrder.length - 1} className={`p-1 rounded ${index === columnOrder.length - 1 ? 'text-gray-600' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}>
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-medium">{COLUMN_LABELS[key]}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-gray-800 bg-gray-800/30">
              <button onClick={() => setShowColumnModal(false)} className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg text-white font-medium shadow-lg">
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdSpendModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl border border-gray-800 max-w-3xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-gradient-to-r from-blue-900/20 to-emerald-900/20">
              <div className="flex items-center gap-3">
                <Edit3 className="w-6 h-6 text-emerald-400" />
                <h2 className="text-2xl font-bold text-white">Edit Monthly Spend</h2>
              </div>
              <button onClick={() => setShowAdSpendModal(false)} className="p-2 hover:bg-gray-800 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)]">
              <p className="text-sm text-gray-400 mb-4">💾 Auto-saved to cloud</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.cohorts.map(cohort => (
                  <div key={cohort} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                    <label className="text-sm text-gray-400 mb-2 block font-medium">{cohort}</label>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-lg">$</span>
                      <input
                        type="number"
                        value={adSpendData[cohort] || 0}
                        onChange={(e) => handleAdSpendChange(cohort, e.target.value)}
                        className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-lg font-medium focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-gray-800 bg-gray-800/30">
              <button onClick={() => setShowAdSpendModal(false)} className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 rounded-lg text-white font-medium shadow-lg">
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const Section = ({ title, icon, children }) => (
  <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg">
    <div className="p-5 border-b border-gray-800 flex items-center bg-gray-800/50">
      {icon}
      <h2 className="ml-3 text-lg font-bold text-gray-200">{title}</h2>
    </div>
    <div>{children}</div>
  </div>
);

const MetricCard = ({ label, value, subtext, color = "text-white" }) => (
  <div className="bg-gray-800/50 border border-gray-700 p-4 rounded-lg hover:border-gray-600 transition-colors shadow-lg">
    <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide font-medium">{label}</div>
    <div className={`text-2xl font-bold mb-1 ${color}`}>{value}</div>
    <div className="text-xs text-gray-500">{subtext}</div>
  </div>
);
