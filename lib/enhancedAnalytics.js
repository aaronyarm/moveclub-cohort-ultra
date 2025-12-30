// Enhanced Analytics Processing Module
// Adds: Payment method analysis, decline reasons, geographic data, behavior segments, drop-offs

export const processEnhancedAnalytics = (data) => {
  if (!data || data.length === 0) return null;

  // Column detection
  const getCol = (pattern, exclude = null) => {
    const keys = Object.keys(data[0]);
    for (let key of keys) {
      if (pattern.test(key) && (!exclude || !exclude.test(key))) return key;
    }
    return null;
  };

  const cols = {
    date: getCol(/created|date/i) || 'Created date (UTC)',
    customerId: getCol(/customer.*id/i) || 'Customer ID',
    status: getCol(/status/i) || 'Status',
    amount: getCol(/^amount$/i, /refund/i) || 'Amount',
    declineReason: getCol(/decline.*reason/i) || 'Decline Reason',
    cardBrand: getCol(/card.*brand/i) || 'Card Brand',
    cardFunding: getCol(/card.*funding/i) || 'Card Funding',
    paymentMethod: getCol(/tokenization.*method/i) || 'Card Tokenization Method',
    country: getCol(/card.*issue.*country/i) || 'Card Issue Country',
    state: getCol(/card.*address.*state/i) || 'Card Address State',
    currency: getCol(/currency/i) || 'Currency',
    refunded: getCol(/refund/i) || 'Amount Refunded',
    fee: getCol(/fee/i) || 'Fee',
    description: getCol(/description/i) || 'Description',
    metadata: getCol(/metadata/i)
  };

  // ==================== PAYMENT METHOD ANALYSIS ====================
  
  const paymentMethodStats = {};
  const cardBrandStats = {};
  const cardFundingStats = {};
  
  data.forEach(row => {
    const amount = parseFloat(row[cols.amount] || 0);
    const status = row[cols.status];
    const isPaid = status === 'Paid' || status === 'paid';
    
    // Payment method (Apple Pay, Google Pay, card)
    const method = row[cols.paymentMethod] || 'card';
    if (!paymentMethodStats[method]) {
      paymentMethodStats[method] = {
        total: 0,
        paid: 0,
        failed: 0,
        revenue: 0,
        amounts: []
      };
    }
    paymentMethodStats[method].total++;
    if (isPaid) {
      paymentMethodStats[method].paid++;
      paymentMethodStats[method].revenue += amount;
      paymentMethodStats[method].amounts.push(amount);
    } else {
      paymentMethodStats[method].failed++;
    }

    // Card brand
    const brand = row[cols.cardBrand];
    if (brand) {
      if (!cardBrandStats[brand]) {
        cardBrandStats[brand] = { total: 0, paid: 0, failed: 0, revenue: 0, amounts: [] };
      }
      cardBrandStats[brand].total++;
      if (isPaid) {
        cardBrandStats[brand].paid++;
        cardBrandStats[brand].revenue += amount;
        cardBrandStats[brand].amounts.push(amount);
      } else {
        cardBrandStats[brand].failed++;
      }
    }

    // Card funding (credit/debit)
    const funding = row[cols.cardFunding];
    if (funding) {
      if (!cardFundingStats[funding]) {
        cardFundingStats[funding] = { total: 0, paid: 0, failed: 0, revenue: 0, amounts: [] };
      }
      cardFundingStats[funding].total++;
      if (isPaid) {
        cardFundingStats[funding].paid++;
        cardFundingStats[funding].revenue += amount;
        cardFundingStats[funding].amounts.push(amount);
      } else {
        cardFundingStats[funding].failed++;
      }
    }
  });

  // Calculate success rates and avg LTV
  const calculateStats = (stats) => {
    return Object.entries(stats).map(([key, val]) => ({
      name: key,
      total: val.total,
      successRate: val.total > 0 ? ((val.paid / val.total) * 100).toFixed(1) : 0,
      revenue: val.revenue.toFixed(2),
      avgTransaction: val.amounts.length > 0 ? (val.amounts.reduce((a, b) => a + b, 0) / val.amounts.length).toFixed(2) : 0,
      failureRate: val.total > 0 ? ((val.failed / val.total) * 100).toFixed(1) : 0
    })).sort((a, b) => b.total - a.total);
  };

  const paymentMethods = calculateStats(paymentMethodStats);
  const cardBrands = calculateStats(cardBrandStats);
  const cardFundings = calculateStats(cardFundingStats);

  // ==================== DECLINE REASON ANALYSIS ====================
  
  const declineReasons = {};
  const failedTransactions = data.filter(row => 
    row[cols.status] === 'Failed' || row[cols.status] === 'failed'
  );

  failedTransactions.forEach(row => {
    const reason = row[cols.declineReason] || 'unknown';
    const amount = parseFloat(row[cols.amount] || 0);
    
    if (!declineReasons[reason]) {
      declineReasons[reason] = {
        count: 0,
        lostRevenue: 0,
        amounts: []
      };
    }
    declineReasons[reason].count++;
    declineReasons[reason].lostRevenue += amount;
    declineReasons[reason].amounts.push(amount);
  });

  const declineReasonsArray = Object.entries(declineReasons).map(([reason, stats]) => ({
    reason: reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    count: stats.count,
    lostRevenue: stats.lostRevenue.toFixed(2),
    avgAmount: (stats.lostRevenue / stats.count).toFixed(2),
    percentage: ((stats.count / failedTransactions.length) * 100).toFixed(1)
  })).sort((a, b) => b.count - a.count).slice(0, 10);

  // ==================== GEOGRAPHIC ANALYSIS ====================
  
  const geographicStats = {
    byCountry: {},
    byState: {}
  };

  data.forEach(row => {
    const country = row[cols.country];
    const state = row[cols.state];
    const amount = parseFloat(row[cols.amount] || 0);
    const isPaid = row[cols.status] === 'Paid' || row[cols.status] === 'paid';

    if (country) {
      if (!geographicStats.byCountry[country]) {
        geographicStats.byCountry[country] = {
          total: 0, paid: 0, failed: 0, revenue: 0, amounts: []
        };
      }
      geographicStats.byCountry[country].total++;
      if (isPaid) {
        geographicStats.byCountry[country].paid++;
        geographicStats.byCountry[country].revenue += amount;
        geographicStats.byCountry[country].amounts.push(amount);
      } else {
        geographicStats.byCountry[country].failed++;
      }
    }

    if (state && country === 'US') {
      if (!geographicStats.byState[state]) {
        geographicStats.byState[state] = {
          total: 0, paid: 0, failed: 0, revenue: 0, amounts: []
        };
      }
      geographicStats.byState[state].total++;
      if (isPaid) {
        geographicStats.byState[state].paid++;
        geographicStats.byState[state].revenue += amount;
        geographicStats.byState[state].amounts.push(amount);
      } else {
        geographicStats.byState[state].failed++;
      }
    }
  });

  const countries = calculateStats(geographicStats.byCountry).slice(0, 10);
  const states = calculateStats(geographicStats.byState).slice(0, 15);

  // ==================== CONVERSION FUNNEL ====================
  
  const customerJourneys = new Map();
  
  data.forEach(row => {
    const customerId = row[cols.customerId];
    if (!customerId) return;
    
    if (!customerJourneys.has(customerId)) {
      customerJourneys.set(customerId, {
        attempts: [],
        firstSuccess: null,
        totalRevenue: 0,
        isActive: false
      });
    }
    
    const journey = customerJourneys.get(customerId);
    const amount = parseFloat(row[cols.amount] || 0);
    const status = row[cols.status];
    const date = new Date(row[cols.date]);
    
    journey.attempts.push({
      date,
      amount,
      status,
      success: status === 'Paid' || status === 'paid'
    });
    
    if ((status === 'Paid' || status === 'paid') && !journey.firstSuccess) {
      journey.firstSuccess = date;
      journey.totalRevenue += amount;
    } else if (status === 'Paid' || status === 'paid') {
      journey.totalRevenue += amount;
    }
  });

  // Funnel metrics
  const totalCustomers = customerJourneys.size;
  const customersWithAttempts = Array.from(customerJourneys.values()).filter(j => j.attempts.length > 0).length;
  const customersWithSuccess = Array.from(customerJourneys.values()).filter(j => j.firstSuccess !== null).length;
  const customersWithMultiple = Array.from(customerJourneys.values()).filter(j => 
    j.attempts.filter(a => a.success).length >= 2
  ).length;

  const conversionFunnel = [
    { stage: 'Total Customers', count: totalCustomers, percentage: 100 },
    { stage: 'Payment Attempted', count: customersWithAttempts, percentage: ((customersWithAttempts / totalCustomers) * 100).toFixed(1) },
    { stage: 'First Success', count: customersWithSuccess, percentage: ((customersWithSuccess / totalCustomers) * 100).toFixed(1) },
    { stage: 'Multiple Payments', count: customersWithMultiple, percentage: ((customersWithMultiple / totalCustomers) * 100).toFixed(1) }
  ];

  // ==================== RETRY ANALYSIS ====================
  
  const retryPatterns = {
    immediate: { attempts: 0, successes: 0 },
    within24h: { attempts: 0, successes: 0 },
    within48h: { attempts: 0, successes: 0 },
    beyond48h: { attempts: 0, successes: 0 }
  };

  customerJourneys.forEach(journey => {
    const failures = journey.attempts.filter(a => !a.success);
    
    failures.forEach((failure, idx) => {
      const nextAttempts = journey.attempts.slice(journey.attempts.indexOf(failure) + 1);
      if (nextAttempts.length === 0) return;
      
      const nextSuccess = nextAttempts.find(a => a.success);
      if (!nextSuccess) return;
      
      const hoursDiff = (nextSuccess.date - failure.date) / (1000 * 60 * 60);
      
      if (hoursDiff < 1) {
        retryPatterns.immediate.attempts++;
        retryPatterns.immediate.successes++;
      } else if (hoursDiff <= 24) {
        retryPatterns.within24h.attempts++;
        retryPatterns.within24h.successes++;
      } else if (hoursDiff <= 48) {
        retryPatterns.within48h.attempts++;
        retryPatterns.within48h.successes++;
      } else {
        retryPatterns.beyond48h.attempts++;
        retryPatterns.beyond48h.successes++;
      }
    });
  });

  const retryAnalysis = Object.entries(retryPatterns).map(([timing, stats]) => ({
    timing: timing.replace(/([A-Z])/g, ' $1').trim(),
    attempts: stats.attempts,
    successes: stats.successes,
    successRate: stats.attempts > 0 ? ((stats.successes / stats.attempts) * 100).toFixed(1) : 0
  }));

  // ==================== BEHAVIOR SEGMENTS ====================
  
  const customerMetrics = Array.from(customerJourneys.entries()).map(([customerId, journey]) => {
    const successfulPayments = journey.attempts.filter(a => a.success);
    const failedPayments = journey.attempts.filter(a => !a.success);
    const successRate = journey.attempts.length > 0 
      ? (successfulPayments.length / journey.attempts.length) * 100 
      : 0;
    
    return {
      customerId,
      totalAttempts: journey.attempts.length,
      successfulPayments: successfulPayments.length,
      failedPayments: failedPayments.length,
      successRate,
      totalRevenue: journey.totalRevenue,
      avgPayment: successfulPayments.length > 0 ? journey.totalRevenue / successfulPayments.length : 0
    };
  });

  // Segment customers
  const champions = customerMetrics.filter(c => c.successRate >= 90 && c.successfulPayments >= 3);
  const reliable = customerMetrics.filter(c => c.successRate >= 70 && c.successRate < 90 && c.successfulPayments >= 2);
  const strugglers = customerMetrics.filter(c => c.successRate < 70 && c.totalAttempts >= 2);
  const oneTimers = customerMetrics.filter(c => c.successfulPayments === 1);

  const behaviorSegments = [
    {
      name: 'Champions',
      count: champions.length,
      percentage: ((champions.length / customerMetrics.length) * 100).toFixed(1),
      avgLTV: champions.length > 0 ? (champions.reduce((sum, c) => sum + c.totalRevenue, 0) / champions.length).toFixed(2) : 0,
      avgSuccessRate: champions.length > 0 ? (champions.reduce((sum, c) => sum + c.successRate, 0) / champions.length).toFixed(1) : 0,
      totalRevenue: champions.reduce((sum, c) => sum + c.totalRevenue, 0).toFixed(2),
      color: 'emerald'
    },
    {
      name: 'Reliable',
      count: reliable.length,
      percentage: ((reliable.length / customerMetrics.length) * 100).toFixed(1),
      avgLTV: reliable.length > 0 ? (reliable.reduce((sum, c) => sum + c.totalRevenue, 0) / reliable.length).toFixed(2) : 0,
      avgSuccessRate: reliable.length > 0 ? (reliable.reduce((sum, c) => sum + c.successRate, 0) / reliable.length).toFixed(1) : 0,
      totalRevenue: reliable.reduce((sum, c) => sum + c.totalRevenue, 0).toFixed(2),
      color: 'blue'
    },
    {
      name: 'Strugglers',
      count: strugglers.length,
      percentage: ((strugglers.length / customerMetrics.length) * 100).toFixed(1),
      avgLTV: strugglers.length > 0 ? (strugglers.reduce((sum, c) => sum + c.totalRevenue, 0) / strugglers.length).toFixed(2) : 0,
      avgSuccessRate: strugglers.length > 0 ? (strugglers.reduce((sum, c) => sum + c.successRate, 0) / strugglers.length).toFixed(1) : 0,
      totalRevenue: strugglers.reduce((sum, c) => sum + c.totalRevenue, 0).toFixed(2),
      color: 'orange'
    },
    {
      name: 'One-Timers',
      count: oneTimers.length,
      percentage: ((oneTimers.length / customerMetrics.length) * 100).toFixed(1),
      avgLTV: oneTimers.length > 0 ? (oneTimers.reduce((sum, c) => sum + c.totalRevenue, 0) / oneTimers.length).toFixed(2) : 0,
      avgSuccessRate: 100,
      totalRevenue: oneTimers.reduce((sum, c) => sum + c.totalRevenue, 0).toFixed(2),
      color: 'gray'
    }
  ];

  // ==================== REVENUE TRENDS ====================
  
  const dailyRevenue = {};
  data.forEach(row => {
    const date = row[cols.date];
    const amount = parseFloat(row[cols.amount] || 0);
    const isPaid = row[cols.status] === 'Paid' || row[cols.status] === 'paid';
    
    if (isPaid && date) {
      const dayKey = date.split(' ')[0]; // Get YYYY-MM-DD
      if (!dailyRevenue[dayKey]) {
        dailyRevenue[dayKey] = 0;
      }
      dailyRevenue[dayKey] += amount;
    }
  });

  const revenueTrend = Object.entries(dailyRevenue)
    .map(([date, revenue]) => ({
      date,
      revenue: parseFloat(revenue.toFixed(2))
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-30); // Last 30 days

  return {
    paymentMethods,
    cardBrands,
    cardFundings,
    declineReasons: declineReasonsArray,
    countries,
    states,
    conversionFunnel,
    retryAnalysis,
    behaviorSegments,
    revenueTrend,
    summary: {
      totalCustomers: customerMetrics.length,
      totalTransactions: data.length,
      successfulTransactions: data.filter(r => r[cols.status] === 'Paid' || r[cols.status] === 'paid').length,
      failedTransactions: failedTransactions.length,
      overallSuccessRate: ((data.filter(r => r[cols.status] === 'Paid' || r[cols.status] === 'paid').length / data.length) * 100).toFixed(1)
    }
  };
};
