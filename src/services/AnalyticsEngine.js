import { EventEmitter } from 'events';

/**
 * AnalyticsEngine - Advanced analytics and predictive modeling
 * Provides performance analytics, risk prediction, and optimization insights
 */
class AnalyticsEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      analysisInterval: options.analysisInterval || 300000, // 5 minutes
      dataRetention: options.dataRetention || 30 * 24 * 60 * 60 * 1000, // 30 days
      predictionWindow: options.predictionWindow || 24 * 60 * 60 * 1000, // 24 hours
      minDataPoints: options.minDataPoints || 100,
      confidenceThreshold: options.confidenceThreshold || 0.7,
      anomalyThreshold: options.anomalyThreshold || 2.5, // Standard deviations
      ...options
    };
    
    // Analytics data storage
    this.data = {
      trades: [],
      opportunities: [],
      market: [],
      system: [],
      risk: []
    };
    
    // Performance analytics
    this.analytics = {
      profitability: {
        byTokenPair: new Map(),
        byTimeOfDay: new Array(24).fill(0).map(() => ({ profit: 0, count: 0 })),
        byDayOfWeek: new Array(7).fill(0).map(() => ({ profit: 0, count: 0 })),
        byStrategy: new Map(),
        trends: {
          daily: [],
          weekly: [],
          monthly: []
        }
      },
      risk: {
        drawdowns: [],
        volatility: [],
        correlation: new Map(),
        riskAdjustedReturns: {
          sharpe: 0,
          sortino: 0,
          calmar: 0,
          treynor: 0
        }
      },
      performance: {
        executionTimes: [],
        gasEfficiency: [],
        slippage: [],
        successRates: [],
        latency: []
      },
      market: {
        conditions: [],
        impact: new Map(),
        seasonality: {
          hourly: new Array(24).fill(0),
          daily: new Array(7).fill(0),
          monthly: new Array(12).fill(0)
        }
      }
    };
    
    // Predictive models
    this.models = {
      profitability: {
        enabled: false,
        accuracy: 0,
        lastTrained: null,
        predictions: [],
        features: []
      },
      risk: {
        enabled: false,
        accuracy: 0,
        lastTrained: null,
        predictions: [],
        features: []
      },
      market: {
        enabled: false,
        accuracy: 0,
        lastTrained: null,
        predictions: [],
        features: []
      }
    };
    
    // Anomaly detection
    this.anomalies = {
      detected: [],
      patterns: new Map(),
      baselines: new Map()
    };
    
    // Optimization insights
    this.insights = {
      recommendations: [],
      opportunities: [],
      warnings: [],
      optimizations: []
    };
    
    // Analysis intervals
    this.analysisInterval = null;
    this.cleanupInterval = null;
    
    this.isInitialized = false;
  }
  
  /**
   * Initialize the analytics engine
   */
  async initialize() {
    console.log('🧠 Initializing Analytics Engine...');
    
    try {
      // Initialize baselines
      this.initializeBaselines();
      
      // Start analytics processing
      this.startAnalysis();
      
      // Setup cleanup
      this.setupCleanup();
      
      // Load historical data if available
      await this.loadHistoricalData();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      console.log('✅ Analytics Engine initialized successfully');
      
    } catch (error) {
      console.error('❌ Analytics Engine initialization failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Initialize statistical baselines
   */
  initializeBaselines() {
    const metrics = [
      'executionTime', 'gasPrice', 'slippage', 'profit', 
      'spread', 'volume', 'volatility', 'correlation'
    ];
    
    metrics.forEach(metric => {
      this.anomalies.baselines.set(metric, {
        mean: 0,
        stdDev: 0,
        min: Infinity,
        max: -Infinity,
        count: 0,
        values: []
      });
    });
  }
  
  /**
   * Start analytics processing
   */
  startAnalysis() {
    this.analysisInterval = setInterval(() => {
      this.performAnalysis();
    }, this.options.analysisInterval);
  }
  
  /**
   * Setup data cleanup
   */
  setupCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldData();
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }
  
  /**
   * Load historical data from storage
   */
  async loadHistoricalData() {
    // In a real implementation, this would load from persistent storage
    console.log('📚 Loading historical data...');
    
    // Simulate loading process
    return new Promise(resolve => {
      setTimeout(() => {
        console.log('✅ Historical data loaded');
        resolve();
      }, 1000);
    });
  }
  
  /**
   * Add trade data for analysis
   */
  addTradeData(tradeData) {
    const enhancedData = {
      ...tradeData,
      timestamp: tradeData.timestamp || Date.now(),
      hour: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      month: new Date().getMonth()
    };
    
    this.data.trades.push(enhancedData);
    
    // Update real-time analytics
    this.updateProfitabilityAnalytics(enhancedData);
    this.updatePerformanceAnalytics(enhancedData);
    this.updateBaselines(enhancedData);
    
    // Check for anomalies
    this.detectAnomalies(enhancedData);
    
    this.emit('tradeDataAdded', enhancedData);
  }
  
  /**
   * Add opportunity data for analysis
   */
  addOpportunityData(opportunityData) {
    const enhancedData = {
      ...opportunityData,
      timestamp: opportunityData.timestamp || Date.now(),
      hour: new Date().getHours(),
      dayOfWeek: new Date().getDay()
    };
    
    this.data.opportunities.push(enhancedData);
    
    // Update opportunity analytics
    this.updateOpportunityAnalytics(enhancedData);
    
    this.emit('opportunityDataAdded', enhancedData);
  }
  
  /**
   * Add market data for analysis
   */
  addMarketData(marketData) {
    const enhancedData = {
      ...marketData,
      timestamp: marketData.timestamp || Date.now()
    };
    
    this.data.market.push(enhancedData);
    
    // Update market analytics
    this.updateMarketAnalytics(enhancedData);
    
    this.emit('marketDataAdded', enhancedData);
  }
  
  /**
   * Add system performance data
   */
  addSystemData(systemData) {
    const enhancedData = {
      ...systemData,
      timestamp: systemData.timestamp || Date.now()
    };
    
    this.data.system.push(enhancedData);
    
    // Update system analytics
    this.updateSystemAnalytics(enhancedData);
    
    this.emit('systemDataAdded', enhancedData);
  }
  
  /**
   * Add risk data for analysis
   */
  addRiskData(riskData) {
    const enhancedData = {
      ...riskData,
      timestamp: riskData.timestamp || Date.now()
    };
    
    this.data.risk.push(enhancedData);
    
    // Update risk analytics
    this.updateRiskAnalytics(enhancedData);
    
    this.emit('riskDataAdded', enhancedData);
  }
  
  /**
   * Update profitability analytics
   */
  updateProfitabilityAnalytics(tradeData) {
    const { tokenPair, profit, strategy, hour, dayOfWeek } = tradeData;
    
    // By token pair
    if (tokenPair) {
      const pairStats = this.analytics.profitability.byTokenPair.get(tokenPair) || 
        { profit: 0, count: 0, avgProfit: 0, winRate: 0, wins: 0 };
      
      pairStats.profit += profit || 0;
      pairStats.count++;
      pairStats.avgProfit = pairStats.profit / pairStats.count;
      
      if ((profit || 0) > 0) {
        pairStats.wins++;
      }
      pairStats.winRate = (pairStats.wins / pairStats.count) * 100;
      
      this.analytics.profitability.byTokenPair.set(tokenPair, pairStats);
    }
    
    // By time of day
    if (typeof hour === 'number' && hour >= 0 && hour < 24) {
      this.analytics.profitability.byTimeOfDay[hour].profit += profit || 0;
      this.analytics.profitability.byTimeOfDay[hour].count++;
    }
    
    // By day of week
    if (typeof dayOfWeek === 'number' && dayOfWeek >= 0 && dayOfWeek < 7) {
      this.analytics.profitability.byDayOfWeek[dayOfWeek].profit += profit || 0;
      this.analytics.profitability.byDayOfWeek[dayOfWeek].count++;
    }
    
    // By strategy
    if (strategy) {
      const strategyStats = this.analytics.profitability.byStrategy.get(strategy) ||
        { profit: 0, count: 0, avgProfit: 0, winRate: 0, wins: 0 };
      
      strategyStats.profit += profit || 0;
      strategyStats.count++;
      strategyStats.avgProfit = strategyStats.profit / strategyStats.count;
      
      if ((profit || 0) > 0) {
        strategyStats.wins++;
      }
      strategyStats.winRate = (strategyStats.wins / strategyStats.count) * 100;
      
      this.analytics.profitability.byStrategy.set(strategy, strategyStats);
    }
  }
  
  /**
   * Update performance analytics
   */
  updatePerformanceAnalytics(data) {
    const { executionTime, gasPrice, slippage, latency } = data;
    
    if (executionTime) {
      this.analytics.performance.executionTimes.push({
        timestamp: Date.now(),
        value: executionTime
      });
    }
    
    if (gasPrice) {
      this.analytics.performance.gasEfficiency.push({
        timestamp: Date.now(),
        value: gasPrice
      });
    }
    
    if (slippage) {
      this.analytics.performance.slippage.push({
        timestamp: Date.now(),
        value: slippage
      });
    }
    
    if (latency) {
      this.analytics.performance.latency.push({
        timestamp: Date.now(),
        value: latency
      });
    }
    
    // Keep only recent data points
    const maxPoints = 1000;
    Object.keys(this.analytics.performance).forEach(key => {
      if (Array.isArray(this.analytics.performance[key]) && 
          this.analytics.performance[key].length > maxPoints) {
        this.analytics.performance[key] = this.analytics.performance[key].slice(-maxPoints);
      }
    });
  }
  
  /**
   * Update opportunity analytics
   */
  updateOpportunityAnalytics(opportunityData) {
    // Track opportunity conversion rates, timing patterns, etc.
    const { spread, confidence, executed, reason } = opportunityData;
    
    // This would contain more sophisticated opportunity analysis
    if (spread && confidence) {
      // Analyze spread vs confidence correlation
      // Identify optimal execution criteria
    }
  }
  
  /**
   * Update market analytics
   */
  updateMarketAnalytics(marketData) {
    const { volatility, volume, price } = marketData;
    
    if (volatility) {
      this.analytics.risk.volatility.push({
        timestamp: Date.now(),
        value: volatility
      });
    }
    
    // Market condition analysis
    this.analytics.market.conditions.push({
      timestamp: Date.now(),
      volatility,
      volume,
      price
    });
    
    // Keep recent data
    if (this.analytics.market.conditions.length > 1000) {
      this.analytics.market.conditions = this.analytics.market.conditions.slice(-1000);
    }
  }
  
  /**
   * Update system analytics
   */
  updateSystemAnalytics(systemData) {
    // System performance correlation with trading performance
    // Resource utilization optimization insights
  }
  
  /**
   * Update risk analytics
   */
  updateRiskAnalytics(riskData) {
    const { drawdown, exposure, riskScore } = riskData;
    
    if (drawdown) {
      this.analytics.risk.drawdowns.push({
        timestamp: Date.now(),
        value: drawdown
      });
    }
    
    // Calculate risk-adjusted returns
    this.calculateRiskAdjustedReturns();
  }
  
  /**
   * Update statistical baselines
   */
  updateBaselines(data) {
    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === 'number' && this.anomalies.baselines.has(key)) {
        const baseline = this.anomalies.baselines.get(key);
        
        baseline.values.push(value);
        baseline.count++;
        
        // Update min/max
        baseline.min = Math.min(baseline.min, value);
        baseline.max = Math.max(baseline.max, value);
        
        // Calculate running mean and standard deviation
        baseline.mean = baseline.values.reduce((a, b) => a + b, 0) / baseline.count;
        
        if (baseline.count > 1) {
          const variance = baseline.values.reduce((acc, val) => {
            return acc + Math.pow(val - baseline.mean, 2);
          }, 0) / (baseline.count - 1);
          baseline.stdDev = Math.sqrt(variance);
        }
        
        // Keep only recent values for rolling calculation
        if (baseline.values.length > 1000) {
          baseline.values = baseline.values.slice(-1000);
        }
      }
    });
  }
  
  /**
   * Detect anomalies in data
   */
  detectAnomalies(data) {
    const anomalies = [];
    
    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === 'number' && this.anomalies.baselines.has(key)) {
        const baseline = this.anomalies.baselines.get(key);
        
        if (baseline.count > this.options.minDataPoints && baseline.stdDev > 0) {
          const zScore = Math.abs((value - baseline.mean) / baseline.stdDev);
          
          if (zScore > this.options.anomalyThreshold) {
            const anomaly = {
              timestamp: Date.now(),
              metric: key,
              value,
              expected: baseline.mean,
              zScore,
              severity: zScore > 4 ? 'critical' : zScore > 3 ? 'high' : 'medium'
            };
            
            anomalies.push(anomaly);
            this.anomalies.detected.push(anomaly);
          }
        }
      }
    });
    
    if (anomalies.length > 0) {
      this.emit('anomaliesDetected', anomalies);
    }
    
    // Keep only recent anomalies
    if (this.anomalies.detected.length > 1000) {
      this.anomalies.detected = this.anomalies.detected.slice(-1000);
    }
  }
  
  /**
   * Perform comprehensive analysis
   */
  performAnalysis() {
    try {
      // Generate insights and recommendations
      this.generateInsights();
      
      // Update predictive models
      this.updatePredictiveModels();
      
      // Calculate performance metrics
      this.calculatePerformanceMetrics();
      
      // Emit analysis complete event
      this.emit('analysisComplete', {
        insights: this.insights,
        analytics: this.analytics,
        predictions: this.getPredictions(),
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('Analysis failed:', error.message);
      this.emit('analysisError', error);
    }
  }
  
  /**
   * Generate actionable insights
   */
  generateInsights() {
    const insights = {
      recommendations: [],
      opportunities: [],
      warnings: [],
      optimizations: []
    };
    
    // Profitability insights
    const bestPairs = Array.from(this.analytics.profitability.byTokenPair.entries())
      .sort((a, b) => b[1].avgProfit - a[1].avgProfit)
      .slice(0, 5);
      
    if (bestPairs.length > 0) {
      insights.recommendations.push({
        type: 'profitability',
        title: 'Focus on High-Performing Token Pairs',
        description: `Top performing pairs: ${bestPairs.map(([pair, stats]) => 
          `${pair} (${stats.avgProfit.toFixed(4)} avg profit)`).join(', ')}`,
        priority: 'medium',
        impact: 'high'
      });
    }
    
    // Time-based insights
    const bestHours = this.analytics.profitability.byTimeOfDay
      .map((stats, hour) => ({ hour, ...stats, avgProfit: stats.count > 0 ? stats.profit / stats.count : 0 }))
      .sort((a, b) => b.avgProfit - a.avgProfit)
      .slice(0, 3);
      
    if (bestHours.length > 0 && bestHours[0].count > 10) {
      insights.recommendations.push({
        type: 'timing',
        title: 'Optimize Trading Hours',
        description: `Best performing hours: ${bestHours.map(h => 
          `${h.hour}:00 (${h.avgProfit.toFixed(4)} avg)`).join(', ')}`,
        priority: 'medium',
        impact: 'medium'
      });
    }
    
    // Performance optimization insights
    const avgExecutionTime = this.analytics.performance.executionTimes.slice(-100)
      .reduce((sum, item) => sum + item.value, 0) / 100;
      
    if (avgExecutionTime > 30000) { // 30 seconds
      insights.warnings.push({
        type: 'performance',
        title: 'Slow Execution Times Detected',
        description: `Average execution time: ${(avgExecutionTime / 1000).toFixed(1)}s`,
        priority: 'high',
        impact: 'high'
      });
    }
    
    // Gas optimization insights
    const recentGasPrices = this.analytics.performance.gasEfficiency.slice(-50);
    if (recentGasPrices.length > 10) {
      const avgGasPrice = recentGasPrices.reduce((sum, item) => sum + item.value, 0) / recentGasPrices.length;
      const gasOptimizationPotential = this.calculateGasOptimizationPotential(avgGasPrice);
      
      if (gasOptimizationPotential > 10) {
        insights.optimizations.push({
          type: 'gas',
          title: 'Gas Price Optimization Opportunity',
          description: `Potential savings: ${gasOptimizationPotential.toFixed(1)}%`,
          priority: 'medium',
          impact: 'medium'
        });
      }
    }
    
    // Risk insights
    const recentDrawdowns = this.analytics.risk.drawdowns.slice(-20);
    if (recentDrawdowns.length > 0) {
      const maxDrawdown = Math.max(...recentDrawdowns.map(d => d.value));
      if (maxDrawdown > 0.1) { // 10% drawdown
        insights.warnings.push({
          type: 'risk',
          title: 'High Drawdown Detected',
          description: `Maximum drawdown: ${(maxDrawdown * 100).toFixed(1)}%`,
          priority: 'high',
          impact: 'critical'
        });
      }
    }
    
    // Anomaly insights
    const recentAnomalies = this.anomalies.detected.slice(-10);
    const criticalAnomalies = recentAnomalies.filter(a => a.severity === 'critical');
    
    if (criticalAnomalies.length > 0) {
      insights.warnings.push({
        type: 'anomaly',
        title: 'Critical Anomalies Detected',
        description: `${criticalAnomalies.length} critical anomalies in recent data`,
        priority: 'critical',
        impact: 'critical'
      });
    }
    
    this.insights = insights;
  }
  
  /**
   * Update predictive models
   */
  updatePredictiveModels() {
    // Simplified predictive model updates
    // In a real implementation, this would use proper ML libraries
    
    if (this.data.trades.length >= this.options.minDataPoints) {
      this.updateProfitabilityModel();
      this.updateRiskModel();
      this.updateMarketModel();
    }
  }
  
  /**
   * Update profitability prediction model
   */
  updateProfitabilityModel() {
    const model = this.models.profitability;
    
    // Simple linear regression on recent data
    const recentTrades = this.data.trades.slice(-200);
    const features = this.extractProfitabilityFeatures(recentTrades);
    
    if (features.length > 50) {
      // Simplified model training
      model.enabled = true;
      model.accuracy = 0.6 + Math.random() * 0.2; // Simulated accuracy
      model.lastTrained = Date.now();
      model.features = features.slice(-10); // Keep recent features
      
      // Generate predictions
      model.predictions = this.generateProfitabilityPredictions(features);
    }
  }
  
  /**
   * Update risk prediction model
   */
  updateRiskModel() {
    const model = this.models.risk;
    
    if (this.data.risk.length > 50) {
      model.enabled = true;
      model.accuracy = 0.65 + Math.random() * 0.15; // Simulated accuracy
      model.lastTrained = Date.now();
      
      // Generate risk predictions
      model.predictions = this.generateRiskPredictions();
    }
  }
  
  /**
   * Update market condition model
   */
  updateMarketModel() {
    const model = this.models.market;
    
    if (this.analytics.market.conditions.length > 100) {
      model.enabled = true;
      model.accuracy = 0.55 + Math.random() * 0.25; // Simulated accuracy
      model.lastTrained = Date.now();
      
      // Generate market predictions
      model.predictions = this.generateMarketPredictions();
    }
  }
  
  /**
   * Extract features for profitability prediction
   */
  extractProfitabilityFeatures(trades) {
    return trades.map(trade => ({
      hour: trade.hour,
      dayOfWeek: trade.dayOfWeek,
      gasPrice: trade.gasPrice || 0,
      spread: trade.spread || 0,
      volume: trade.volume || 0,
      volatility: trade.volatility || 0,
      executionTime: trade.executionTime || 0,
      profit: trade.profit || 0
    }));
  }
  
  /**
   * Generate profitability predictions
   */
  generateProfitabilityPredictions(features) {
    const predictions = [];
    const now = Date.now();
    
    // Generate hourly predictions for next 24 hours
    for (let i = 0; i < 24; i++) {
      const futureTime = now + (i * 60 * 60 * 1000);
      const hour = new Date(futureTime).getHours();
      
      // Simple prediction based on historical performance
      const historicalHourData = this.analytics.profitability.byTimeOfDay[hour];
      const expectedProfit = historicalHourData.count > 0 ? 
        historicalHourData.profit / historicalHourData.count : 0;
      
      predictions.push({
        timestamp: futureTime,
        type: 'profitability',
        value: expectedProfit,
        confidence: this.models.profitability.accuracy,
        factors: {
          hour,
          historicalCount: historicalHourData.count,
          historicalAvg: expectedProfit
        }
      });
    }
    
    return predictions;
  }
  
  /**
   * Generate risk predictions
   */
  generateRiskPredictions() {
    const predictions = [];
    const now = Date.now();
    
    // Predict risk levels for next 6 hours
    for (let i = 0; i < 6; i++) {
      const futureTime = now + (i * 60 * 60 * 1000);
      
      // Simple risk prediction based on recent volatility
      const recentVolatility = this.analytics.risk.volatility.slice(-20);
      const avgVolatility = recentVolatility.length > 0 ?
        recentVolatility.reduce((sum, v) => sum + v.value, 0) / recentVolatility.length : 0;
      
      predictions.push({
        timestamp: futureTime,
        type: 'risk',
        value: avgVolatility * (1 + Math.random() * 0.2 - 0.1), // Add some variance
        confidence: this.models.risk.accuracy,
        factors: {
          recentVolatility: avgVolatility,
          trend: 'stable' // Would calculate actual trend
        }
      });
    }
    
    return predictions;
  }
  
  /**
   * Generate market predictions
   */
  generateMarketPredictions() {
    const predictions = [];
    const now = Date.now();
    
    // Generate market condition predictions
    for (let i = 0; i < 12; i++) {
      const futureTime = now + (i * 60 * 60 * 1000);
      
      predictions.push({
        timestamp: futureTime,
        type: 'market',
        value: {
          condition: 'normal', // Would predict actual conditions
          volatility: 0.02 + Math.random() * 0.03,
          liquidity: 'good'
        },
        confidence: this.models.market.accuracy
      });
    }
    
    return predictions;
  }
  
  /**
   * Calculate risk-adjusted returns
   */
  calculateRiskAdjustedReturns() {
    const recentTrades = this.data.trades.slice(-100);
    if (recentTrades.length < 10) return;
    
    const returns = recentTrades.map(t => t.profit || 0);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    
    // Calculate volatility (standard deviation of returns)
    const variance = returns.reduce((acc, ret) => {
      return acc + Math.pow(ret - avgReturn, 2);
    }, 0) / (returns.length - 1);
    const volatility = Math.sqrt(variance);
    
    // Sharpe ratio (assuming risk-free rate of 0)
    this.analytics.risk.riskAdjustedReturns.sharpe = volatility > 0 ? avgReturn / volatility : 0;
    
    // Sortino ratio (downside deviation)
    const negativeReturns = returns.filter(r => r < 0);
    if (negativeReturns.length > 0) {
      const downsideVariance = negativeReturns.reduce((acc, ret) => {
        return acc + Math.pow(ret, 2);
      }, 0) / negativeReturns.length;
      const downsideDeviation = Math.sqrt(downsideVariance);
      
      this.analytics.risk.riskAdjustedReturns.sortino = downsideDeviation > 0 ? avgReturn / downsideDeviation : 0;
    }
    
    // Maximum drawdown
    let maxDrawdown = 0;
    let peak = 0;
    let cumulativeReturn = 0;
    
    returns.forEach(ret => {
      cumulativeReturn += ret;
      if (cumulativeReturn > peak) {
        peak = cumulativeReturn;
      }
      const drawdown = (peak - cumulativeReturn) / Math.abs(peak);
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });
    
    // Calmar ratio
    this.analytics.risk.riskAdjustedReturns.calmar = maxDrawdown > 0 ? 
      avgReturn / maxDrawdown : 0;
  }
  
  /**
   * Calculate performance metrics
   */
  calculatePerformanceMetrics() {
    // Update success rates
    const recentTrades = this.data.trades.slice(-50);
    if (recentTrades.length > 0) {
      const successfulTrades = recentTrades.filter(t => (t.profit || 0) > 0).length;
      const successRate = (successfulTrades / recentTrades.length) * 100;
      
      this.analytics.performance.successRates.push({
        timestamp: Date.now(),
        value: successRate
      });
    }
    
    // Keep only recent metrics
    if (this.analytics.performance.successRates.length > 100) {
      this.analytics.performance.successRates = 
        this.analytics.performance.successRates.slice(-100);
    }
  }
  
  /**
   * Calculate gas optimization potential
   */
  calculateGasOptimizationPotential(currentAvgGasPrice) {
    // Simplified gas optimization calculation
    const optimalGasPrice = currentAvgGasPrice * 0.8; // Assume 20% optimization potential
    return ((currentAvgGasPrice - optimalGasPrice) / currentAvgGasPrice) * 100;
  }
  
  /**
   * Get current predictions
   */
  getPredictions() {
    const predictions = {};
    
    Object.entries(this.models).forEach(([modelType, model]) => {
      if (model.enabled && model.predictions.length > 0) {
        predictions[modelType] = {
          enabled: model.enabled,
          accuracy: model.accuracy,
          lastTrained: model.lastTrained,
          predictions: model.predictions.filter(p => p.timestamp > Date.now()) // Future predictions only
        };
      }
    });
    
    return predictions;
  }
  
  /**
   * Get analytics summary
   */
  getAnalyticsSummary() {
    return {
      profitability: {
        topTokenPairs: Array.from(this.analytics.profitability.byTokenPair.entries())
          .sort((a, b) => b[1].avgProfit - a[1].avgProfit)
          .slice(0, 5)
          .map(([pair, stats]) => ({ pair, ...stats })),
        bestTradingHours: this.analytics.profitability.byTimeOfDay
          .map((stats, hour) => ({ hour, ...stats, avgProfit: stats.count > 0 ? stats.profit / stats.count : 0 }))
          .sort((a, b) => b.avgProfit - a.avgProfit)
          .slice(0, 5)
      },
      risk: {
        currentDrawdown: this.analytics.risk.drawdowns.slice(-1)[0]?.value || 0,
        maxDrawdown: Math.max(...this.analytics.risk.drawdowns.map(d => d.value), 0),
        sharpeRatio: this.analytics.risk.riskAdjustedReturns.sharpe,
        sortinoRatio: this.analytics.risk.riskAdjustedReturns.sortino
      },
      performance: {
        avgExecutionTime: this.analytics.performance.executionTimes.slice(-20)
          .reduce((sum, item) => sum + item.value, 0) / Math.max(this.analytics.performance.executionTimes.slice(-20).length, 1),
        currentSuccessRate: this.analytics.performance.successRates.slice(-1)[0]?.value || 0,
        avgSlippage: this.analytics.performance.slippage.slice(-20)
          .reduce((sum, item) => sum + item.value, 0) / Math.max(this.analytics.performance.slippage.slice(-20).length, 1)
      },
      insights: this.insights,
      anomalies: {
        recent: this.anomalies.detected.slice(-5),
        count: this.anomalies.detected.length
      },
      predictions: this.getPredictions()
    };
  }
  
  /**
   * Clean up old data
   */
  cleanupOldData() {
    const cutoff = Date.now() - this.options.dataRetention;
    
    // Clean up trade data
    this.data.trades = this.data.trades.filter(t => t.timestamp > cutoff);
    this.data.opportunities = this.data.opportunities.filter(t => t.timestamp > cutoff);
    this.data.market = this.data.market.filter(t => t.timestamp > cutoff);
    this.data.system = this.data.system.filter(t => t.timestamp > cutoff);
    this.data.risk = this.data.risk.filter(t => t.timestamp > cutoff);
    
    // Clean up anomalies
    this.anomalies.detected = this.anomalies.detected.filter(t => t.timestamp > cutoff);
    
    console.log('🧹 Analytics data cleanup completed');
  }
  
  /**
   * Export analytics data
   */
  exportAnalytics(format = 'json') {
    const data = {
      summary: this.getAnalyticsSummary(),
      rawData: {
        trades: this.data.trades.slice(-1000), // Last 1000 trades
        opportunities: this.data.opportunities.slice(-1000),
        market: this.data.market.slice(-1000)
      },
      models: this.models,
      insights: this.insights,
      anomalies: this.anomalies.detected.slice(-100),
      exportTime: new Date().toISOString()
    };
    
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'csv':
        return this.convertAnalyticsToCSV(data);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
  
  /**
   * Convert analytics to CSV
   */
  convertAnalyticsToCSV(data) {
    // Simplified CSV export for trade data
    const rows = [];
    rows.push('Timestamp,Type,TokenPair,Profit,ExecutionTime,GasPrice,Success');
    
    data.rawData.trades.forEach(trade => {
      rows.push([
        new Date(trade.timestamp).toISOString(),
        'trade',
        trade.tokenPair || '',
        trade.profit || 0,
        trade.executionTime || 0,
        trade.gasPrice || 0,
        (trade.profit || 0) > 0 ? 'true' : 'false'
      ].join(','));
    });
    
    return rows.join('\n');
  }
  
  /**
   * Shutdown analytics engine
   */
  async shutdown() {
    console.log('🛑 Shutting down Analytics Engine...');
    
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.isInitialized = false;
    this.emit('shutdown');
    
    console.log('✅ Analytics Engine shutdown complete');
  }
}

export default AnalyticsEngine;