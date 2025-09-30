import { EventEmitter } from 'events';

/**
 * CircuitBreakerManager - Multi-level circuit breaker system
 * Implements market condition, system performance, and loss protection circuit breakers
 */
class CircuitBreakerManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      // Market condition thresholds
      extremeVolatilityThreshold: options.extremeVolatilityThreshold || 0.15, // 15%
      lowLiquidityThreshold: options.lowLiquidityThreshold || 50000, // $50k
      highGasPriceMultiplier: options.highGasPriceMultiplier || 3.0, // 3x normal
      marketCrashThreshold: options.marketCrashThreshold || -0.1, // -10% market drop
      
      // System performance thresholds
      maxErrorRate: options.maxErrorRate || 0.2, // 20% error rate
      maxExecutionDelay: options.maxExecutionDelay || 60000, // 60 seconds
      maxRpcFailures: options.maxRpcFailures || 5, // 5 consecutive failures
      maxMemoryUsage: options.maxMemoryUsage || 0.9, // 90% memory usage
      
      // Loss protection thresholds
      maxDailyLoss: options.maxDailyLoss || 1000, // $1000 daily loss
      maxConsecutiveLosses: options.maxConsecutiveLosses || 5,
      maxDrawdown: options.maxDrawdown || 0.15, // 15% drawdown
      maxHourlyLoss: options.maxHourlyLoss || 500, // $500 hourly loss
      
      // Circuit breaker durations (milliseconds)
      shortBreakDuration: options.shortBreakDuration || 300000, // 5 minutes
      mediumBreakDuration: options.mediumBreakDuration || 1800000, // 30 minutes
      longBreakDuration: options.longBreakDuration || 3600000, // 1 hour
      emergencyBreakDuration: options.emergencyBreakDuration || 14400000, // 4 hours
      
      // Monitoring intervals
      monitoringInterval: options.monitoringInterval || 10000, // 10 seconds
      metricsWindowSize: options.metricsWindowSize || 100, // Last 100 operations
      
      ...options
    };
    
    // Circuit breaker states
    this.circuitBreakers = {
      // Market condition breakers
      extremeVolatility: this.createCircuitBreaker('extremeVolatility', 'medium'),
      lowLiquidity: this.createCircuitBreaker('lowLiquidity', 'short'),
      highGasPrice: this.createCircuitBreaker('highGasPrice', 'short'),
      marketCrash: this.createCircuitBreaker('marketCrash', 'long'),
      unusualSpread: this.createCircuitBreaker('unusualSpread', 'short'),
      
      // System performance breakers
      highErrorRate: this.createCircuitBreaker('highErrorRate', 'medium'),
      rpcFailure: this.createCircuitBreaker('rpcFailure', 'medium'),
      executionDelay: this.createCircuitBreaker('executionDelay', 'short'),
      memoryPressure: this.createCircuitBreaker('memoryPressure', 'medium'),
      networkCongestion: this.createCircuitBreaker('networkCongestion', 'short'),
      
      // Loss protection breakers
      dailyLoss: this.createCircuitBreaker('dailyLoss', 'long'),
      consecutiveLoss: this.createCircuitBreaker('consecutiveLoss', 'medium'),
      drawdown: this.createCircuitBreaker('drawdown', 'long'),
      hourlyLoss: this.createCircuitBreaker('hourlyLoss', 'medium'),
      
      // Emergency breaker
      emergency: this.createCircuitBreaker('emergency', 'emergency')
    };
    
    // Monitoring data
    this.monitoringData = {
      errors: [],
      executionTimes: [],
      rpcFailures: [],
      memoryUsage: [],
      trades: [],
      lastMarketCheck: 0,
      lastSystemCheck: 0,
      lastLossCheck: 0
    };
    
    // System metrics
    this.systemMetrics = {
      errorRate: 0,
      averageExecutionTime: 0,
      rpcFailureCount: 0,
      memoryUsagePercentage: 0,
      networkLatency: 0
    };
    
    // Loss tracking
    this.lossTracking = {
      dailyPnL: 0,
      hourlyPnL: 0,
      consecutiveLosses: 0,
      currentDrawdown: 0,
      peakValue: 0,
      lastResetTime: Date.now()
    };
    
    // Active monitoring intervals
    this.monitoringIntervals = new Map();
    
    this.isInitialized = false;
  }
  
  /**
   * Initialize circuit breaker manager
   */
  async initialize() {
    if (this.isInitialized) return;
    
    console.log('🔌 Initializing Circuit Breaker Manager...');
    
    try {
      // Load historical data
      await this.loadHistoricalData();
      
      // Start monitoring
      this.startMonitoring();
      
      // Setup auto-recovery
      this.setupAutoRecovery();
      
      this.isInitialized = true;
      console.log('✅ Circuit Breaker Manager initialized');
      
      this.emit('initialized', {
        circuitBreakers: Object.keys(this.circuitBreakers),
        options: this.options
      });
      
    } catch (error) {
      console.error('❌ Failed to initialize Circuit Breaker Manager:', error.message);
      throw error;
    }
  }
  
  /**
   * Create a circuit breaker with specified duration type
   */
  createCircuitBreaker(name, durationType) {
    const durations = {
      short: this.options.shortBreakDuration,
      medium: this.options.mediumBreakDuration,
      long: this.options.longBreakDuration,
      emergency: this.options.emergencyBreakDuration
    };
    
    return {
      name,
      isTriggered: false,
      triggeredAt: null,
      duration: durations[durationType],
      triggerCount: 0,
      lastTriggerReason: null,
      autoRecovery: durationType !== 'emergency',
      metrics: {
        totalTriggers: 0,
        averageDuration: 0,
        lastRecovery: null
      }
    };
  }
  
  /**
   * Check if trading should be allowed
   */
  isTradingAllowed() {
    if (!this.isInitialized) return false;
    
    // Check if any circuit breaker is active
    for (const [name, breaker] of Object.entries(this.circuitBreakers)) {
      if (this.isCircuitBreakerActive(breaker)) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Get current trading restrictions
   */
  getTradingRestrictions() {
    const restrictions = [];
    
    for (const [name, breaker] of Object.entries(this.circuitBreakers)) {
      if (this.isCircuitBreakerActive(breaker)) {
        const remainingTime = this.getRemainingTime(breaker);
        
        restrictions.push({
          type: name,
          reason: breaker.lastTriggerReason || `${name} circuit breaker active`,
          remainingTime,
          severity: this.getCircuitBreakerSeverity(name),
          canOverride: name !== 'emergency'
        });
      }
    }
    
    return restrictions;
  }
  
  /**
   * Check if a circuit breaker is currently active
   */
  isCircuitBreakerActive(breaker) {
    if (!breaker.isTriggered) return false;
    
    const elapsed = Date.now() - breaker.triggeredAt;
    return elapsed < breaker.duration;
  }
  
  /**
   * Get remaining time for a circuit breaker
   */
  getRemainingTime(breaker) {
    if (!breaker.isTriggered) return 0;
    
    const elapsed = Date.now() - breaker.triggeredAt;
    return Math.max(0, breaker.duration - elapsed);
  }
  
  /**
   * Get circuit breaker severity level
   */
  getCircuitBreakerSeverity(name) {
    const severityMap = {
      extremeVolatility: 'high',
      lowLiquidity: 'medium',
      highGasPrice: 'low',
      marketCrash: 'critical',
      unusualSpread: 'low',
      highErrorRate: 'high',
      rpcFailure: 'medium',
      executionDelay: 'low',
      memoryPressure: 'medium',
      networkCongestion: 'low',
      dailyLoss: 'critical',
      consecutiveLoss: 'high',
      drawdown: 'critical',
      hourlyLoss: 'high',
      emergency: 'critical'
    };
    
    return severityMap[name] || 'medium';
  }
  
  /**
   * Trigger a circuit breaker
   */
  triggerCircuitBreaker(name, reason, data = {}) {
    const breaker = this.circuitBreakers[name];
    
    if (!breaker) {
      console.warn(`Unknown circuit breaker: ${name}`);
      return;
    }
    
    // Update breaker state
    breaker.isTriggered = true;
    breaker.triggeredAt = Date.now();
    breaker.triggerCount++;
    breaker.lastTriggerReason = reason;
    breaker.metrics.totalTriggers++;
    
    const severity = this.getCircuitBreakerSeverity(name);
    const duration = breaker.duration;
    
    console.log(`🚨 Circuit Breaker Triggered: ${name}`);
    console.log(`   Reason: ${reason}`);
    console.log(`   Severity: ${severity}`);
    console.log(`   Duration: ${duration / 1000}s`);
    
    // Emit event
    this.emit('circuitBreakerTriggered', {
      name,
      reason,
      severity,
      duration,
      data,
      timestamp: Date.now()
    });
    
    // Special handling for critical breakers
    if (severity === 'critical') {
      this.handleCriticalBreaker(name, reason, data);
    }
  }
  
  /**
   * Handle critical circuit breaker triggers
   */
  handleCriticalBreaker(name, reason, data) {
    console.log('🚨 CRITICAL CIRCUIT BREAKER ACTIVATED');
    console.log(`   Breaker: ${name}`);
    console.log(`   Reason: ${reason}`);
    
    // Notify all monitoring systems
    this.emit('criticalBreaker', {
      name,
      reason,
      data,
      timestamp: Date.now(),
      action: 'immediate_shutdown_required'
    });
    
    // If this is a loss protection breaker, also trigger emergency
    if (['dailyLoss', 'drawdown'].includes(name)) {
      this.triggerCircuitBreaker('emergency', `Triggered by ${name}: ${reason}`);
    }
  }
  
  /**
   * Manually reset a circuit breaker
   */
  resetCircuitBreaker(name, reason = 'Manual reset') {
    const breaker = this.circuitBreakers[name];
    
    if (!breaker) {
      throw new Error(`Unknown circuit breaker: ${name}`);
    }
    
    if (!breaker.isTriggered) {
      console.log(`Circuit breaker ${name} is not active`);
      return;
    }
    
    // Calculate duration for metrics
    const duration = Date.now() - breaker.triggeredAt;
    breaker.metrics.averageDuration = 
      (breaker.metrics.averageDuration * (breaker.metrics.totalTriggers - 1) + duration) / 
      breaker.metrics.totalTriggers;
    
    // Reset breaker
    breaker.isTriggered = false;
    breaker.triggeredAt = null;
    breaker.lastTriggerReason = null;
    breaker.metrics.lastRecovery = Date.now();
    
    console.log(`✅ Circuit Breaker Reset: ${name} (${reason})`);
    
    this.emit('circuitBreakerReset', {
      name,
      reason,
      duration,
      timestamp: Date.now()
    });
  }
  
  /**
   * Start monitoring all conditions
   */
  startMonitoring() {
    // Market condition monitoring
    this.monitoringIntervals.set('market', setInterval(() => {
      this.checkMarketConditions();
    }, this.options.monitoringInterval));
    
    // System performance monitoring
    this.monitoringIntervals.set('system', setInterval(() => {
      this.checkSystemPerformance();
    }, this.options.monitoringInterval));
    
    // Loss protection monitoring
    this.monitoringIntervals.set('loss', setInterval(() => {
      this.checkLossProtection();
    }, this.options.monitoringInterval / 2)); // Check twice as often
    
    console.log('📊 Started circuit breaker monitoring');
  }
  
  /**
   * Check market conditions for circuit breaker triggers
   */
  async checkMarketConditions() {
    try {
      this.monitoringData.lastMarketCheck = Date.now();
      
      // Check extreme volatility
      await this.checkExtremeVolatility();
      
      // Check low liquidity
      await this.checkLowLiquidity();
      
      // Check high gas prices
      await this.checkHighGasPrices();
      
      // Check market crash
      await this.checkMarketCrash();
      
      // Check unusual spreads
      await this.checkUnusualSpreads();
      
    } catch (error) {
      console.error('Market condition check failed:', error.message);
    }
  }
  
  /**
   * Check for extreme volatility
   */
  async checkExtremeVolatility() {
    // This would integrate with market data sources
    const volatility = await this.getCurrentMarketVolatility();
    
    if (volatility > this.options.extremeVolatilityThreshold) {
      if (!this.circuitBreakers.extremeVolatility.isTriggered) {
        this.triggerCircuitBreaker(
          'extremeVolatility',
          `Extreme volatility detected: ${(volatility * 100).toFixed(1)}%`,
          { volatility }
        );
      }
    }
  }
  
  /**
   * Check for low liquidity conditions
   */
  async checkLowLiquidity() {
    const avgLiquidity = await this.getAverageLiquidity();
    
    if (avgLiquidity < this.options.lowLiquidityThreshold) {
      if (!this.circuitBreakers.lowLiquidity.isTriggered) {
        this.triggerCircuitBreaker(
          'lowLiquidity',
          `Low liquidity detected: $${avgLiquidity.toFixed(0)}`,
          { liquidity: avgLiquidity }
        );
      }
    }
  }
  
  /**
   * Check for high gas prices
   */
  async checkHighGasPrices() {
    const gasMultiplier = await this.getCurrentGasMultiplier();
    
    if (gasMultiplier > this.options.highGasPriceMultiplier) {
      if (!this.circuitBreakers.highGasPrice.isTriggered) {
        this.triggerCircuitBreaker(
          'highGasPrice',
          `High gas prices: ${gasMultiplier.toFixed(1)}x normal`,
          { gasMultiplier }
        );
      }
    }
  }
  
  /**
   * Check for market crash
   */
  async checkMarketCrash() {
    const marketChange = await this.getMarketChange();
    
    if (marketChange < this.options.marketCrashThreshold) {
      if (!this.circuitBreakers.marketCrash.isTriggered) {
        this.triggerCircuitBreaker(
          'marketCrash',
          `Market crash detected: ${(marketChange * 100).toFixed(1)}%`,
          { marketChange }
        );
      }
    }
  }
  
  /**
   * Check for unusual price spreads
   */
  async checkUnusualSpreads() {
    const spreadAnalysis = await this.analyzeCurrentSpreads();
    
    if (spreadAnalysis.unusualActivity) {
      if (!this.circuitBreakers.unusualSpread.isTriggered) {
        this.triggerCircuitBreaker(
          'unusualSpread',
          'Unusual price spread activity detected',
          spreadAnalysis
        );
      }
    }
  }
  
  /**
   * Check system performance conditions
   */
  checkSystemPerformance() {
    this.monitoringData.lastSystemCheck = Date.now();
    
    // Check error rate
    this.checkErrorRate();
    
    // Check execution delays
    this.checkExecutionDelay();
    
    // Check RPC failures
    this.checkRpcFailures();
    
    // Check memory usage
    this.checkMemoryUsage();
    
    // Check network congestion
    this.checkNetworkCongestion();
  }
  
  /**
   * Check error rate
   */
  checkErrorRate() {
    const recentErrors = this.monitoringData.errors.slice(-this.options.metricsWindowSize);
    const errorRate = recentErrors.length / this.options.metricsWindowSize;
    
    this.systemMetrics.errorRate = errorRate;
    
    if (errorRate > this.options.maxErrorRate) {
      if (!this.circuitBreakers.highErrorRate.isTriggered) {
        this.triggerCircuitBreaker(
          'highErrorRate',
          `High error rate: ${(errorRate * 100).toFixed(1)}%`,
          { errorRate, recentErrors: recentErrors.length }
        );
      }
    }
  }
  
  /**
   * Check execution delays
   */
  checkExecutionDelay() {
    const recentTimes = this.monitoringData.executionTimes.slice(-10);
    
    if (recentTimes.length > 0) {
      const avgTime = recentTimes.reduce((sum, time) => sum + time, 0) / recentTimes.length;
      this.systemMetrics.averageExecutionTime = avgTime;
      
      if (avgTime > this.options.maxExecutionDelay) {
        if (!this.circuitBreakers.executionDelay.isTriggered) {
          this.triggerCircuitBreaker(
            'executionDelay',
            `High execution delay: ${(avgTime / 1000).toFixed(1)}s`,
            { averageTime: avgTime }
          );
        }
      }
    }
  }
  
  /**
   * Check RPC failures
   */
  checkRpcFailures() {
    const recentFailures = this.monitoringData.rpcFailures.slice(-this.options.maxRpcFailures);
    
    if (recentFailures.length >= this.options.maxRpcFailures) {
      // Check if all recent failures were consecutive
      const now = Date.now();
      const consecutiveFailures = recentFailures.filter(failure => 
        now - failure < 300000 // Within last 5 minutes
      );
      
      if (consecutiveFailures.length >= this.options.maxRpcFailures) {
        if (!this.circuitBreakers.rpcFailure.isTriggered) {
          this.triggerCircuitBreaker(
            'rpcFailure',
            `Multiple RPC failures: ${consecutiveFailures.length}`,
            { failures: consecutiveFailures.length }
          );
        }
      }
    }
  }
  
  /**
   * Check memory usage
   */
  checkMemoryUsage() {
    const memoryUsage = process.memoryUsage();
    const usagePercentage = memoryUsage.heapUsed / memoryUsage.heapTotal;
    
    this.systemMetrics.memoryUsagePercentage = usagePercentage;
    
    if (usagePercentage > this.options.maxMemoryUsage) {
      if (!this.circuitBreakers.memoryPressure.isTriggered) {
        this.triggerCircuitBreaker(
          'memoryPressure',
          `High memory usage: ${(usagePercentage * 100).toFixed(1)}%`,
          { memoryUsage: usagePercentage }
        );
      }
    }
  }
  
  /**
   * Check network congestion
   */
  checkNetworkCongestion() {
    // This would integrate with network monitoring
    // For now, use placeholder logic based on execution times
    const avgExecutionTime = this.systemMetrics.averageExecutionTime;
    
    if (avgExecutionTime > 30000) { // 30 seconds
      if (!this.circuitBreakers.networkCongestion.isTriggered) {
        this.triggerCircuitBreaker(
          'networkCongestion',
          'High network congestion detected',
          { executionTime: avgExecutionTime }
        );
      }
    }
  }
  
  /**
   * Check loss protection conditions
   */
  checkLossProtection() {
    this.monitoringData.lastLossCheck = Date.now();
    
    // Check daily loss
    this.checkDailyLoss();
    
    // Check hourly loss
    this.checkHourlyLoss();
    
    // Check consecutive losses
    this.checkConsecutiveLosses();
    
    // Check drawdown
    this.checkDrawdown();
  }
  
  /**
   * Check daily loss limit
   */
  checkDailyLoss() {
    if (Math.abs(this.lossTracking.dailyPnL) >= this.options.maxDailyLoss) {
      if (!this.circuitBreakers.dailyLoss.isTriggered) {
        this.triggerCircuitBreaker(
          'dailyLoss',
          `Daily loss limit exceeded: $${Math.abs(this.lossTracking.dailyPnL).toFixed(2)}`,
          { dailyPnL: this.lossTracking.dailyPnL }
        );
      }
    }
  }
  
  /**
   * Check hourly loss limit
   */
  checkHourlyLoss() {
    if (Math.abs(this.lossTracking.hourlyPnL) >= this.options.maxHourlyLoss) {
      if (!this.circuitBreakers.hourlyLoss.isTriggered) {
        this.triggerCircuitBreaker(
          'hourlyLoss',
          `Hourly loss limit exceeded: $${Math.abs(this.lossTracking.hourlyPnL).toFixed(2)}`,
          { hourlyPnL: this.lossTracking.hourlyPnL }
        );
      }
    }
  }
  
  /**
   * Check consecutive losses
   */
  checkConsecutiveLosses() {
    if (this.lossTracking.consecutiveLosses >= this.options.maxConsecutiveLosses) {
      if (!this.circuitBreakers.consecutiveLoss.isTriggered) {
        this.triggerCircuitBreaker(
          'consecutiveLoss',
          `Consecutive loss limit: ${this.lossTracking.consecutiveLosses}`,
          { consecutiveLosses: this.lossTracking.consecutiveLosses }
        );
      }
    }
  }
  
  /**
   * Check drawdown limit
   */
  checkDrawdown() {
    if (this.lossTracking.currentDrawdown >= this.options.maxDrawdown) {
      if (!this.circuitBreakers.drawdown.isTriggered) {
        this.triggerCircuitBreaker(
          'drawdown',
          `Maximum drawdown exceeded: ${(this.lossTracking.currentDrawdown * 100).toFixed(1)}%`,
          { drawdown: this.lossTracking.currentDrawdown }
        );
      }
    }
  }
  
  /**
   * Record an error for monitoring
   */
  recordError(error, context) {
    this.monitoringData.errors.push({
      error: error.message,
      context,
      timestamp: Date.now()
    });
    
    // Keep only recent errors
    if (this.monitoringData.errors.length > this.options.metricsWindowSize * 2) {
      this.monitoringData.errors = this.monitoringData.errors.slice(-this.options.metricsWindowSize);
    }
  }
  
  /**
   * Record execution time
   */
  recordExecutionTime(duration) {
    this.monitoringData.executionTimes.push(duration);
    
    // Keep only recent times
    if (this.monitoringData.executionTimes.length > 50) {
      this.monitoringData.executionTimes = this.monitoringData.executionTimes.slice(-50);
    }
  }
  
  /**
   * Record RPC failure
   */
  recordRpcFailure(provider, error) {
    this.monitoringData.rpcFailures.push({
      provider,
      error: error.message,
      timestamp: Date.now()
    });
    
    // Keep only recent failures
    if (this.monitoringData.rpcFailures.length > 100) {
      this.monitoringData.rpcFailures = this.monitoringData.rpcFailures.slice(-100);
    }
  }
  
  /**
   * Record trade result for loss tracking
   */
  recordTradeResult(tradeResult) {
    const { pnl, success } = tradeResult;
    
    // Update P&L tracking
    this.lossTracking.dailyPnL += pnl;
    this.lossTracking.hourlyPnL += pnl;
    
    // Update consecutive losses
    if (success && pnl > 0) {
      this.lossTracking.consecutiveLosses = 0;
    } else if (pnl < 0) {
      this.lossTracking.consecutiveLosses++;
    }
    
    // Update drawdown tracking
    if (pnl > 0) {
      this.lossTracking.peakValue = Math.max(this.lossTracking.peakValue, this.lossTracking.peakValue + pnl);
    }
    
    const currentValue = this.lossTracking.peakValue + this.lossTracking.dailyPnL;
    this.lossTracking.currentDrawdown = Math.max(0, (this.lossTracking.peakValue - currentValue) / this.lossTracking.peakValue);
    
    // Record trade
    this.monitoringData.trades.push({
      ...tradeResult,
      timestamp: Date.now()
    });
    
    // Reset daily/hourly tracking if needed
    this.resetPeriodTracking();
  }
  
  /**
   * Reset daily and hourly P&L tracking
   */
  resetPeriodTracking() {
    const now = Date.now();
    const oneHour = 3600000;
    const oneDay = 86400000;
    
    // Reset hourly tracking
    if (now - this.lossTracking.lastResetTime > oneHour) {
      this.lossTracking.hourlyPnL = 0;
    }
    
    // Reset daily tracking
    if (now - this.lossTracking.lastResetTime > oneDay) {
      this.lossTracking.dailyPnL = 0;
      this.lossTracking.lastResetTime = now;
    }
  }
  
  /**
   * Setup automatic recovery for circuit breakers
   */
  setupAutoRecovery() {
    setInterval(() => {
      for (const [name, breaker] of Object.entries(this.circuitBreakers)) {
        if (breaker.isTriggered && breaker.autoRecovery) {
          const elapsed = Date.now() - breaker.triggeredAt;
          
          if (elapsed >= breaker.duration) {
            this.resetCircuitBreaker(name, 'Automatic recovery');
          }
        }
      }
    }, 10000); // Check every 10 seconds
  }
  
  // Market data placeholder methods (would integrate with actual data sources)
  
  async getCurrentMarketVolatility() {
    // Placeholder - would integrate with market data
    return Math.random() * 0.2; // 0-20% volatility
  }
  
  async getAverageLiquidity() {
    // Placeholder - would integrate with liquidity data
    return Math.random() * 500000 + 50000; // $50k-$550k
  }
  
  async getCurrentGasMultiplier() {
    // Placeholder - would integrate with gas price data
    return 1 + Math.random() * 2; // 1x-3x multiplier
  }
  
  async getMarketChange() {
    // Placeholder - would integrate with market data
    return (Math.random() - 0.5) * 0.2; // ±10% change
  }
  
  async analyzeCurrentSpreads() {
    // Placeholder - would analyze actual spread data
    return {
      unusualActivity: Math.random() < 0.1, // 10% chance of unusual activity
      averageSpread: Math.random() * 0.01,
      maxSpread: Math.random() * 0.05
    };
  }
  
  /**
   * Load historical data for calibration
   */
  async loadHistoricalData() {
    // This would load historical performance and market data
    console.log('📊 Loading historical data for circuit breaker calibration...');
  }
  
  /**
   * Get comprehensive circuit breaker status
   */
  getCircuitBreakerStatus() {
    const status = {};
    
    for (const [name, breaker] of Object.entries(this.circuitBreakers)) {
      status[name] = {
        isActive: this.isCircuitBreakerActive(breaker),
        isTriggered: breaker.isTriggered,
        remainingTime: this.getRemainingTime(breaker),
        triggerCount: breaker.triggerCount,
        lastReason: breaker.lastTriggerReason,
        metrics: breaker.metrics,
        severity: this.getCircuitBreakerSeverity(name)
      };
    }
    
    return {
      tradingAllowed: this.isTradingAllowed(),
      activeBreakers: Object.keys(status).filter(name => status[name].isActive),
      breakerStatus: status,
      systemMetrics: this.systemMetrics,
      lossTracking: this.lossTracking,
      monitoringData: {
        lastMarketCheck: this.monitoringData.lastMarketCheck,
        lastSystemCheck: this.monitoringData.lastSystemCheck,
        lastLossCheck: this.monitoringData.lastLossCheck
      }
    };
  }
  
  /**
   * Get circuit breaker recommendations
   */
  getCircuitBreakerRecommendations() {
    const recommendations = [];
    const status = this.getCircuitBreakerStatus();
    
    // Check for frequently triggering breakers
    for (const [name, breaker] of Object.entries(this.circuitBreakers)) {
      if (breaker.triggerCount > 5) {
        recommendations.push({
          priority: 'high',
          category: 'stability',
          title: `Frequent ${name} Circuit Breaker`,
          description: `${name} has triggered ${breaker.triggerCount} times`,
          action: 'Consider adjusting thresholds or addressing root cause'
        });
      }
    }
    
    // Check system health
    if (this.systemMetrics.errorRate > 0.1) {
      recommendations.push({
        priority: 'medium',
        category: 'system',
        title: 'High Error Rate',
        description: `Current error rate: ${(this.systemMetrics.errorRate * 100).toFixed(1)}%`,
        action: 'Investigate error patterns and improve error handling'
      });
    }
    
    // Check loss patterns
    if (this.lossTracking.consecutiveLosses > 2) {
      recommendations.push({
        priority: 'high',
        category: 'risk',
        title: 'Multiple Consecutive Losses',
        description: `${this.lossTracking.consecutiveLosses} consecutive losses`,
        action: 'Review trading strategy and risk parameters'
      });
    }
    
    return recommendations;
  }
  
  /**
   * Emergency shutdown - triggers all critical breakers
   */
  emergencyShutdown(reason) {
    console.log('🚨 EMERGENCY SHUTDOWN INITIATED');
    console.log(`   Reason: ${reason}`);
    
    // Trigger emergency breaker
    this.triggerCircuitBreaker('emergency', `Emergency shutdown: ${reason}`);
    
    // Trigger all critical loss protection breakers
    this.triggerCircuitBreaker('dailyLoss', 'Emergency shutdown protection');
    this.triggerCircuitBreaker('drawdown', 'Emergency shutdown protection');
    
    this.emit('emergencyShutdown', {
      reason,
      timestamp: Date.now(),
      activeBreakers: this.getTradingRestrictions()
    });
  }
  
  /**
   * Shutdown circuit breaker manager
   */
  async shutdown() {
    console.log('🔌 Shutting down Circuit Breaker Manager...');
    
    // Clear all monitoring intervals
    for (const [name, interval] of this.monitoringIntervals) {
      clearInterval(interval);
    }
    
    this.emit('shutdown');
  }
}

export default CircuitBreakerManager;module.exports = CircuitBreakerManager;
