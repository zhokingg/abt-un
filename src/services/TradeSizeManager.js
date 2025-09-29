import { EventEmitter } from 'events';

/**
 * TradeSizeManager - Dynamic trade sizing system
 * Implements liquidity-based sizing, risk-adjusted position sizing, and capital allocation
 */
class TradeSizeManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      // Base sizing parameters
      maxTradeAmount: options.maxTradeAmount || 10000, // $10k max
      minTradeAmount: options.minTradeAmount || 100, // $100 min
      maxPortfolioPercentage: options.maxPortfolioPercentage || 0.1, // 10% max per trade
      
      // Kelly Criterion parameters
      useKellyCriterion: options.useKellyCriterion !== false,
      kellyMultiplier: options.kellyMultiplier || 0.25, // 25% of Kelly optimal
      minKellyFraction: options.minKellyFraction || 0.01, // 1% minimum
      maxKellyFraction: options.maxKellyFraction || 0.2, // 20% maximum
      
      // Liquidity-based sizing
      maxLiquidityImpact: options.maxLiquidityImpact || 0.01, // 1% max impact
      liquidityBufferFactor: options.liquidityBufferFactor || 0.8, // Use 80% of available
      
      // Volatility adjustments
      volatilityThreshold: options.volatilityThreshold || 0.05, // 5%
      highVolatilityReduction: options.highVolatilityReduction || 0.5, // 50% reduction
      
      // Consecutive loss management
      maxConsecutiveLosses: options.maxConsecutiveLosses || 3,
      lossReductionFactor: options.lossReductionFactor || 0.7, // 30% reduction per loss
      
      // Capital allocation
      reserveCapitalPercentage: options.reserveCapitalPercentage || 0.2, // 20% reserve
      maxConcurrentTrades: options.maxConcurrentTrades || 5,
      
      // Correlation management
      maxCorrelatedExposure: options.maxCorrelatedExposure || 0.3, // 30% max in correlated assets
      correlationThreshold: options.correlationThreshold || 0.7, // 70% correlation threshold
      
      ...options
    };
    
    // Portfolio state
    this.portfolio = {
      totalCapital: options.initialCapital || 10000,
      availableCapital: options.initialCapital || 10000,
      reserveCapital: 0,
      allocatedCapital: 0,
      positions: new Map(),
      maxValue: options.initialCapital || 10000
    };
    
    // Risk metrics
    this.riskMetrics = {
      consecutiveLosses: 0,
      winRate: 0.5, // Default 50% win rate
      averageWin: 0,
      averageLoss: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      volatility: 0
    };
    
    // Trade history for performance calculations
    this.tradeHistory = [];
    this.performanceHistory = [];
    
    // Active trades tracking
    this.activeTrades = new Map();
    
    // Correlation matrix
    this.correlationMatrix = new Map();
    
    // Liquidity cache
    this.liquidityCache = new Map();
    
    this.isInitialized = false;
  }
  
  /**
   * Initialize the trade size manager
   */
  async initialize() {
    if (this.isInitialized) return;
    
    console.log('💰 Initializing Trade Size Manager...');
    
    try {
      // Load historical performance data
      await this.loadPerformanceHistory();
      
      // Calculate initial metrics
      this.updateRiskMetrics();
      
      // Initialize capital allocation
      this.initializeCapitalAllocation();
      
      // Setup correlation monitoring
      this.setupCorrelationMonitoring();
      
      this.isInitialized = true;
      console.log('✅ Trade Size Manager initialized');
      
      this.emit('initialized', {
        portfolio: this.portfolio,
        metrics: this.riskMetrics
      });
      
    } catch (error) {
      console.error('❌ Failed to initialize Trade Size Manager:', error.message);
      throw error;
    }
  }
  
  /**
   * Calculate optimal trade size for an opportunity
   */
  async calculateOptimalTradeSize(opportunity, maxAmount = null) {
    if (!this.isInitialized) await this.initialize();
    
    const startTime = performance.now();
    
    try {
      // Get base size constraints
      const constraints = await this.getTradeConstraints(opportunity, maxAmount);
      
      // Calculate Kelly optimal size if enabled
      const kellySize = this.options.useKellyCriterion ? 
        this.calculateKellyOptimalSize(opportunity) : null;
      
      // Calculate liquidity-based size
      const liquiditySize = await this.calculateLiquidityBasedSize(opportunity);
      
      // Calculate volatility-adjusted size
      const volatilitySize = await this.calculateVolatilityAdjustedSize(opportunity);
      
      // Calculate correlation-adjusted size
      const correlationSize = this.calculateCorrelationAdjustedSize(opportunity);
      
      // Apply consecutive loss adjustment
      const lossAdjustedSize = this.applyConsecutiveLossAdjustment(opportunity);
      
      // Combine all sizing factors
      const optimalSize = this.combineSizingFactors({
        constraints,
        kelly: kellySize,
        liquidity: liquiditySize,
        volatility: volatilitySize,
        correlation: correlationSize,
        lossAdjustment: lossAdjustedSize
      });
      
      const sizing = {
        opportunityId: opportunity.id,
        optimal: optimalSize,
        factors: {
          constraints,
          kelly: kellySize,
          liquidity: liquiditySize,
          volatility: volatilitySize,
          correlation: correlationSize,
          lossAdjustment: lossAdjustedSize
        },
        recommendation: this.getSizingRecommendation(optimalSize, opportunity),
        timestamp: Date.now(),
        calculationTime: performance.now() - startTime
      };
      
      this.emit('sizingCalculated', sizing);
      
      return sizing;
      
    } catch (error) {
      console.error('Trade sizing calculation failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Get trade constraints (maximum possible sizes)
   */
  async getTradeConstraints(opportunity, maxAmount) {
    const constraints = {
      maxTradeAmount: maxAmount || this.options.maxTradeAmount,
      minTradeAmount: this.options.minTradeAmount,
      availableCapital: this.portfolio.availableCapital,
      maxPortfolioPercentage: this.portfolio.totalCapital * this.options.maxPortfolioPercentage,
      maxConcurrentLimit: this.getMaxConcurrentTradeSize()
    };
    
    // Apply the most restrictive constraint
    const maxPossible = Math.min(
      constraints.maxTradeAmount,
      constraints.availableCapital,
      constraints.maxPortfolioPercentage,
      constraints.maxConcurrentLimit
    );
    
    return {
      ...constraints,
      maxPossible,
      feasible: maxPossible >= constraints.minTradeAmount
    };
  }
  
  /**
   * Calculate Kelly optimal size
   */
  calculateKellyOptimalSize(opportunity) {
    const winRate = this.riskMetrics.winRate;
    const averageWin = this.riskMetrics.averageWin || opportunity.expectedProfit;
    const averageLoss = this.riskMetrics.averageLoss || (opportunity.expectedProfit * 0.5); // Assume 50% loss on failures
    
    if (averageLoss === 0 || winRate === 0 || winRate === 1) {
      return {
        fraction: this.options.minKellyFraction,
        amount: this.portfolio.totalCapital * this.options.minKellyFraction,
        reason: 'Insufficient data for Kelly calculation'
      };
    }
    
    // Kelly formula: f = (bp - q) / b
    // where b = odds (averageWin/averageLoss), p = winRate, q = 1-winRate
    const b = averageWin / averageLoss;
    const p = winRate;
    const q = 1 - winRate;
    
    const kellyFraction = (b * p - q) / b;
    
    // Apply safety constraints
    const safeFraction = Math.max(
      this.options.minKellyFraction,
      Math.min(kellyFraction * this.options.kellyMultiplier, this.options.maxKellyFraction)
    );
    
    return {
      fraction: safeFraction,
      amount: this.portfolio.totalCapital * safeFraction,
      rawKelly: kellyFraction,
      winRate,
      averageWin,
      averageLoss,
      oddsRatio: b
    };
  }
  
  /**
   * Calculate liquidity-based trade size
   */
  async calculateLiquidityBasedSize(opportunity) {
    // Get liquidity data for both exchanges
    const buyLiquidity = await this.getLiquidityData(opportunity.buyFrom, opportunity.tokenA, opportunity.tokenB);
    const sellLiquidity = await this.getLiquidityData(opportunity.sellTo, opportunity.tokenA, opportunity.tokenB);
    
    // Find minimum liquidity (bottleneck)
    const minLiquidity = Math.min(buyLiquidity.effectiveLiquidity, sellLiquidity.effectiveLiquidity);
    
    // Calculate max size with acceptable price impact
    const maxSizeForImpact = minLiquidity * this.options.maxLiquidityImpact;
    
    // Apply liquidity buffer
    const liquidityBasedSize = maxSizeForImpact * this.options.liquidityBufferFactor;
    
    return {
      amount: liquidityBasedSize,
      buyLiquidity: buyLiquidity.effectiveLiquidity,
      sellLiquidity: sellLiquidity.effectiveLiquidity,
      minLiquidity,
      maxImpactSize: maxSizeForImpact,
      priceImpact: this.estimatePriceImpact(liquidityBasedSize, minLiquidity)
    };
  }
  
  /**
   * Calculate volatility-adjusted trade size
   */
  async calculateVolatilityAdjustedSize(opportunity) {
    const tokenVolatility = await this.getTokenPairVolatility(opportunity.tokenA, opportunity.tokenB);
    
    let adjustmentFactor = 1.0;
    
    if (tokenVolatility > this.options.volatilityThreshold) {
      // Reduce size for high volatility
      const excessVolatility = tokenVolatility - this.options.volatilityThreshold;
      adjustmentFactor = Math.max(
        this.options.highVolatilityReduction,
        1.0 - (excessVolatility * 2) // 2x impact
      );
    }
    
    const baseSize = this.portfolio.totalCapital * this.options.maxPortfolioPercentage;
    
    return {
      amount: baseSize * adjustmentFactor,
      volatility: tokenVolatility,
      adjustmentFactor,
      reason: tokenVolatility > this.options.volatilityThreshold ? 'High volatility reduction' : 'Normal volatility'
    };
  }
  
  /**
   * Calculate correlation-adjusted trade size
   */
  calculateCorrelationAdjustedSize(opportunity) {
    const tokenPair = `${opportunity.tokenA}_${opportunity.tokenB}`;
    
    // Calculate current exposure to correlated assets
    let correlatedExposure = 0;
    
    for (const [positionPair, position] of this.portfolio.positions) {
      const correlation = this.getTokenPairCorrelation(tokenPair, positionPair);
      
      if (Math.abs(correlation) > this.options.correlationThreshold) {
        correlatedExposure += position.amount * Math.abs(correlation);
      }
    }
    
    const correlatedExposurePercentage = correlatedExposure / this.portfolio.totalCapital;
    
    let adjustmentFactor = 1.0;
    
    if (correlatedExposurePercentage > this.options.maxCorrelatedExposure) {
      // Reduce size based on over-correlation
      adjustmentFactor = Math.max(
        0.2, // Minimum 20% of normal size
        1.0 - (correlatedExposurePercentage - this.options.maxCorrelatedExposure) * 2
      );
    }
    
    const baseSize = this.portfolio.totalCapital * this.options.maxPortfolioPercentage;
    
    return {
      amount: baseSize * adjustmentFactor,
      correlatedExposure,
      correlatedExposurePercentage,
      adjustmentFactor,
      reason: correlatedExposurePercentage > this.options.maxCorrelatedExposure ? 
        'High correlation adjustment' : 'Normal correlation'
    };
  }
  
  /**
   * Apply consecutive loss adjustment
   */
  applyConsecutiveLossAdjustment(opportunity) {
    let adjustmentFactor = 1.0;
    
    if (this.riskMetrics.consecutiveLosses > 0) {
      // Reduce size based on consecutive losses
      adjustmentFactor = Math.pow(
        this.options.lossReductionFactor,
        Math.min(this.riskMetrics.consecutiveLosses, this.options.maxConsecutiveLosses)
      );
    }
    
    const baseSize = this.portfolio.totalCapital * this.options.maxPortfolioPercentage;
    
    return {
      amount: baseSize * adjustmentFactor,
      consecutiveLosses: this.riskMetrics.consecutiveLosses,
      adjustmentFactor,
      reason: this.riskMetrics.consecutiveLosses > 0 ? 
        `Consecutive loss reduction (${this.riskMetrics.consecutiveLosses} losses)` : 'No recent losses'
    };
  }
  
  /**
   * Combine all sizing factors to get optimal size
   */
  combineSizingFactors(factors) {
    const { constraints, kelly, liquidity, volatility, correlation, lossAdjustment } = factors;
    
    if (!constraints.feasible) {
      return {
        amount: 0,
        reason: 'Trade constraints not feasible',
        rejected: true
      };
    }
    
    // Start with the most restrictive constraint
    let optimalSize = constraints.maxPossible;
    
    // Apply Kelly sizing if enabled and beneficial
    if (kelly && kelly.amount > 0) {
      optimalSize = Math.min(optimalSize, kelly.amount);
    }
    
    // Apply liquidity constraints
    if (liquidity) {
      optimalSize = Math.min(optimalSize, liquidity.amount);
    }
    
    // Apply volatility adjustments
    if (volatility) {
      optimalSize = Math.min(optimalSize, volatility.amount);
    }
    
    // Apply correlation adjustments
    if (correlation) {
      optimalSize = Math.min(optimalSize, correlation.amount);
    }
    
    // Apply loss adjustments
    if (lossAdjustment) {
      optimalSize = Math.min(optimalSize, lossAdjustment.amount);
    }
    
    // Ensure minimum trade size
    if (optimalSize < constraints.minTradeAmount) {
      return {
        amount: 0,
        reason: 'Optimal size below minimum trade amount',
        rejected: true
      };
    }
    
    return {
      amount: optimalSize,
      limitingFactor: this.identifyLimitingFactor(factors, optimalSize),
      accepted: true
    };
  }
  
  /**
   * Identify which factor was most limiting
   */
  identifyLimitingFactor(factors, finalAmount) {
    const { constraints, kelly, liquidity, volatility, correlation, lossAdjustment } = factors;
    
    const sizes = [
      { name: 'constraints', amount: constraints.maxPossible },
      { name: 'kelly', amount: kelly?.amount || Infinity },
      { name: 'liquidity', amount: liquidity?.amount || Infinity },
      { name: 'volatility', amount: volatility?.amount || Infinity },
      { name: 'correlation', amount: correlation?.amount || Infinity },
      { name: 'lossAdjustment', amount: lossAdjustment?.amount || Infinity }
    ];
    
    // Find the factor with the smallest amount that equals final amount
    const limitingFactor = sizes.find(s => Math.abs(s.amount - finalAmount) < 1);
    
    return limitingFactor?.name || 'unknown';
  }
  
  /**
   * Get sizing recommendation
   */
  getSizingRecommendation(sizing, opportunity) {
    if (sizing.rejected) {
      return {
        action: 'REJECT',
        reason: sizing.reason,
        severity: 'high'
      };
    }
    
    const sizePercentage = sizing.amount / this.portfolio.totalCapital;
    
    if (sizePercentage < 0.01) { // Less than 1% of portfolio
      return {
        action: 'PROCEED_SMALL',
        reason: 'Very small position size',
        severity: 'low'
      };
    }
    
    if (sizePercentage > 0.05) { // More than 5% of portfolio
      return {
        action: 'PROCEED_LARGE',
        reason: 'Large position size - monitor closely',
        severity: 'medium'
      };
    }
    
    return {
      action: 'PROCEED',
      reason: 'Optimal size within normal range',
      severity: 'low'
    };
  }
  
  /**
   * Allocate capital for a trade
   */
  allocateCapital(tradeId, amount, opportunity) {
    if (amount > this.portfolio.availableCapital) {
      throw new Error('Insufficient available capital');
    }
    
    // Allocate capital
    this.portfolio.availableCapital -= amount;
    this.portfolio.allocatedCapital += amount;
    
    // Track active trade
    this.activeTrades.set(tradeId, {
      amount,
      opportunity,
      allocatedAt: Date.now(),
      status: 'active'
    });
    
    // Update position tracking
    const tokenPair = `${opportunity.tokenA}_${opportunity.tokenB}`;
    const currentPosition = this.portfolio.positions.get(tokenPair) || { amount: 0, count: 0 };
    
    this.portfolio.positions.set(tokenPair, {
      amount: currentPosition.amount + amount,
      count: currentPosition.count + 1
    });
    
    this.emit('capitalAllocated', {
      tradeId,
      amount,
      remainingCapital: this.portfolio.availableCapital,
      allocation: this.getCapitalAllocation()
    });
    
    return {
      allocated: amount,
      remaining: this.portfolio.availableCapital,
      success: true
    };
  }
  
  /**
   * Release capital after trade completion
   */
  releaseCapital(tradeId, actualPnL) {
    const trade = this.activeTrades.get(tradeId);
    
    if (!trade) {
      throw new Error(`Trade ${tradeId} not found in active trades`);
    }
    
    // Release allocated capital
    this.portfolio.allocatedCapital -= trade.amount;
    this.portfolio.availableCapital += trade.amount + actualPnL;
    this.portfolio.totalCapital += actualPnL;
    
    // Update max value tracking
    if (this.portfolio.totalCapital > this.portfolio.maxValue) {
      this.portfolio.maxValue = this.portfolio.totalCapital;
    }
    
    // Update position tracking
    const tokenPair = `${trade.opportunity.tokenA}_${trade.opportunity.tokenB}`;
    const position = this.portfolio.positions.get(tokenPair);
    
    if (position) {
      position.amount -= trade.amount;
      position.count -= 1;
      
      if (position.count <= 0) {
        this.portfolio.positions.delete(tokenPair);
      }
    }
    
    // Record trade in history
    this.recordTradeResult(tradeId, trade, actualPnL);
    
    // Remove from active trades
    this.activeTrades.delete(tradeId);
    
    this.emit('capitalReleased', {
      tradeId,
      pnl: actualPnL,
      newCapital: this.portfolio.totalCapital,
      allocation: this.getCapitalAllocation()
    });
    
    return {
      released: trade.amount + actualPnL,
      newTotal: this.portfolio.totalCapital,
      success: true
    };
  }
  
  /**
   * Record trade result for performance tracking
   */
  recordTradeResult(tradeId, trade, actualPnL) {
    const result = {
      tradeId,
      timestamp: Date.now(),
      amount: trade.amount,
      pnl: actualPnL,
      success: actualPnL > 0,
      returnPercentage: actualPnL / trade.amount,
      opportunity: trade.opportunity
    };
    
    this.tradeHistory.push(result);
    
    // Keep only last 1000 trades
    if (this.tradeHistory.length > 1000) {
      this.tradeHistory = this.tradeHistory.slice(-1000);
    }
    
    // Update risk metrics
    this.updateRiskMetrics();
  }
  
  /**
   * Update risk metrics based on recent performance
   */
  updateRiskMetrics() {
    if (this.tradeHistory.length === 0) return;
    
    const recentTrades = this.tradeHistory.slice(-100); // Last 100 trades
    
    // Calculate win rate
    const wins = recentTrades.filter(t => t.success);
    this.riskMetrics.winRate = wins.length / recentTrades.length;
    
    // Calculate average win/loss
    const winPnLs = wins.map(t => t.pnl);
    const lossPnLs = recentTrades.filter(t => !t.success).map(t => Math.abs(t.pnl));
    
    this.riskMetrics.averageWin = winPnLs.length > 0 ? 
      winPnLs.reduce((sum, pnl) => sum + pnl, 0) / winPnLs.length : 0;
    
    this.riskMetrics.averageLoss = lossPnLs.length > 0 ? 
      lossPnLs.reduce((sum, pnl) => sum + pnl, 0) / lossPnLs.length : 0;
    
    // Calculate consecutive losses
    this.riskMetrics.consecutiveLosses = this.getConsecutiveLosses();
    
    // Calculate Sharpe ratio
    const returns = recentTrades.map(t => t.returnPercentage);
    this.riskMetrics.sharpeRatio = this.calculateSharpeRatio(returns);
    
    // Calculate max drawdown
    this.riskMetrics.maxDrawdown = this.calculateMaxDrawdown();
    
    // Calculate volatility
    this.riskMetrics.volatility = this.calculateVolatility(returns);
  }
  
  /**
   * Get consecutive losses count
   */
  getConsecutiveLosses() {
    let count = 0;
    
    for (let i = this.tradeHistory.length - 1; i >= 0; i--) {
      if (this.tradeHistory[i].success) {
        break;
      }
      count++;
    }
    
    return count;
  }
  
  /**
   * Calculate Sharpe ratio
   */
  calculateSharpeRatio(returns) {
    if (returns.length < 2) return 0;
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev > 0 ? mean / stdDev : 0;
  }
  
  /**
   * Calculate maximum drawdown
   */
  calculateMaxDrawdown() {
    let maxDrawdown = 0;
    let peak = this.portfolio.maxValue;
    const current = this.portfolio.totalCapital;
    
    const drawdown = (peak - current) / peak;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
    
    return maxDrawdown;
  }
  
  /**
   * Calculate volatility
   */
  calculateVolatility(returns) {
    if (returns.length < 2) return 0;
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }
  
  /**
   * Get liquidity data for exchange/token pair
   */
  async getLiquidityData(exchange, tokenA, tokenB) {
    const cacheKey = `${exchange}_${tokenA}_${tokenB}`;
    const cached = this.liquidityCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 30000) {
      return cached.data;
    }
    
    // Fetch liquidity data (placeholder)
    const liquidityData = {
      totalLiquidity: Math.random() * 1000000 + 100000,
      effectiveLiquidity: Math.random() * 500000 + 50000,
      depth: Math.random() * 10 + 1,
      timestamp: Date.now()
    };
    
    this.liquidityCache.set(cacheKey, {
      data: liquidityData,
      timestamp: Date.now()
    });
    
    return liquidityData;
  }
  
  /**
   * Estimate price impact
   */
  estimatePriceImpact(tradeSize, liquidity) {
    if (liquidity === 0) return 1.0; // 100% impact for zero liquidity
    
    const impact = tradeSize / liquidity;
    return Math.min(impact, 1.0);
  }
  
  /**
   * Get token pair volatility
   */
  async getTokenPairVolatility(tokenA, tokenB) {
    // This would integrate with price data services
    // For now, return simulated volatility
    return Math.random() * 0.1; // 0-10% volatility
  }
  
  /**
   * Get token pair correlation
   */
  getTokenPairCorrelation(pair1, pair2) {
    const key = `${pair1}_${pair2}`;
    return this.correlationMatrix.get(key) || 0.3; // Default 30% correlation
  }
  
  /**
   * Get maximum concurrent trade size
   */
  getMaxConcurrentTradeSize() {
    const activeTrades = Array.from(this.activeTrades.values());
    
    if (activeTrades.length >= this.options.maxConcurrentTrades) {
      return 0; // No more concurrent trades allowed
    }
    
    const remainingSlots = this.options.maxConcurrentTrades - activeTrades.length;
    const averageTradeSize = this.portfolio.totalCapital * this.options.maxPortfolioPercentage;
    
    return averageTradeSize * remainingSlots;
  }
  
  /**
   * Initialize capital allocation
   */
  initializeCapitalAllocation() {
    this.portfolio.reserveCapital = this.portfolio.totalCapital * this.options.reserveCapitalPercentage;
    this.portfolio.availableCapital = this.portfolio.totalCapital - this.portfolio.reserveCapital;
  }
  
  /**
   * Setup correlation monitoring
   */
  setupCorrelationMonitoring() {
    // This would setup periodic correlation updates
    setInterval(() => {
      this.updateCorrelationMatrix();
    }, 300000); // Every 5 minutes
  }
  
  /**
   * Update correlation matrix
   */
  async updateCorrelationMatrix() {
    // This would calculate correlations between token pairs
    // For now, use placeholder logic
  }
  
  /**
   * Load performance history
   */
  async loadPerformanceHistory() {
    // This would load historical performance data
    console.log('📊 Loading performance history...');
  }
  
  /**
   * Get capital allocation summary
   */
  getCapitalAllocation() {
    return {
      total: this.portfolio.totalCapital,
      available: this.portfolio.availableCapital,
      allocated: this.portfolio.allocatedCapital,
      reserve: this.portfolio.reserveCapital,
      utilizationPercentage: this.portfolio.allocatedCapital / (this.portfolio.totalCapital - this.portfolio.reserveCapital),
      activeTrades: this.activeTrades.size
    };
  }
  
  /**
   * Get comprehensive sizing report
   */
  getSizingReport() {
    return {
      portfolio: this.portfolio,
      metrics: this.riskMetrics,
      activeTrades: Array.from(this.activeTrades.entries()),
      recentPerformance: this.tradeHistory.slice(-20),
      capitalAllocation: this.getCapitalAllocation(),
      recommendations: this.getSizingRecommendations()
    };
  }
  
  /**
   * Get sizing recommendations
   */
  getSizingRecommendations() {
    const recommendations = [];
    
    if (this.riskMetrics.consecutiveLosses > 2) {
      recommendations.push({
        priority: 'high',
        category: 'risk',
        title: 'Multiple Consecutive Losses',
        description: `${this.riskMetrics.consecutiveLosses} consecutive losses detected`,
        action: 'Consider reducing trade sizes further or taking a break'
      });
    }
    
    if (this.riskMetrics.maxDrawdown > 0.1) {
      recommendations.push({
        priority: 'high',
        category: 'risk',
        title: 'High Drawdown',
        description: `Current drawdown: ${(this.riskMetrics.maxDrawdown * 100).toFixed(1)}%`,
        action: 'Implement more conservative sizing'
      });
    }
    
    const allocation = this.getCapitalAllocation();
    if (allocation.utilizationPercentage > 0.8) {
      recommendations.push({
        priority: 'medium',
        category: 'capital',
        title: 'High Capital Utilization',
        description: `${(allocation.utilizationPercentage * 100).toFixed(1)}% of capital allocated`,
        action: 'Consider reducing concurrent positions'
      });
    }
    
    return recommendations;
  }
  
  /**
   * Shutdown trade size manager
   */
  async shutdown() {
    console.log('💰 Shutting down Trade Size Manager...');
    this.emit('shutdown');
  }
}

export default TradeSizeManager;module.exports = TradeSizeManager;
