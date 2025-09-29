import { EventEmitter } from 'events';

/**
 * SlippageManager - Advanced slippage protection and calculation
 * Provides dynamic slippage calculation, adaptive tolerance, and multi-hop slippage accumulation
 */
class SlippageManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      // Base slippage parameters
      baseSlippageTolerance: options.baseSlippageTolerance || 0.001, // 0.1% base
      maxSlippageTolerance: options.maxSlippageTolerance || 0.01, // 1% max
      minLiquidityThreshold: options.minLiquidityThreshold || 100000, // $100k
      
      // Dynamic adjustment parameters
      volatilityMultiplier: options.volatilityMultiplier || 2.0,
      liquidityMultiplier: options.liquidityMultiplier || 1.5,
      networkCongestionMultiplier: options.networkCongestionMultiplier || 1.2,
      
      // Multi-hop parameters
      hopSlippageMultiplier: options.hopSlippageMultiplier || 1.1,
      maxHopsForCalculation: options.maxHopsForCalculation || 5,
      
      // Time-based adjustments
      timeDecayFactor: options.timeDecayFactor || 0.0001, // Per second
      maxTimeAdjustment: options.maxTimeAdjustment || 0.005, // 0.5%
      
      // Market condition thresholds
      highVolatilityThreshold: options.highVolatilityThreshold || 0.05, // 5%
      lowLiquidityMultiplier: options.lowLiquidityMultiplier || 2.0,
      
      ...options
    };
    
    // Slippage calculation models
    this.slippageModels = {
      constant: this.calculateConstantSlippage.bind(this),
      linear: this.calculateLinearSlippage.bind(this),
      square_root: this.calculateSquareRootSlippage.bind(this),
      logarithmic: this.calculateLogarithmicSlippage.bind(this)
    };
    
    // Market data cache
    this.marketData = {
      volatilityCache: new Map(),
      liquidityCache: new Map(),
      networkCongestion: 'normal',
      gasPriceMultiplier: 1.0,
      lastUpdate: 0
    };
    
    // Historical slippage tracking
    this.slippageHistory = [];
    this.realizedSlippage = new Map();
    
    this.isInitialized = false;
  }
  
  /**
   * Initialize the slippage manager
   */
  async initialize() {
    if (this.isInitialized) return;
    
    console.log('📊 Initializing Slippage Manager...');
    
    try {
      // Load historical slippage data
      await this.loadSlippageHistory();
      
      // Setup market data monitoring
      this.setupMarketDataMonitoring();
      
      this.isInitialized = true;
      console.log('✅ Slippage Manager initialized');
      
      this.emit('initialized', {
        options: this.options,
        models: Object.keys(this.slippageModels)
      });
      
    } catch (error) {
      console.error('❌ Failed to initialize Slippage Manager:', error.message);
      throw error;
    }
  }
  
  /**
   * Calculate dynamic slippage for an opportunity
   */
  async calculateDynamicSlippage(opportunity, tradeAmount) {
    if (!this.isInitialized) await this.initialize();
    
    const startTime = performance.now();
    
    try {
      // Get base slippage calculation
      const baseSlippage = await this.calculateBaseSlippage(opportunity, tradeAmount);
      
      // Apply market condition adjustments
      const marketAdjustments = await this.calculateMarketAdjustments(opportunity);
      
      // Apply time-based adjustments
      const timeAdjustments = this.calculateTimeAdjustments(opportunity);
      
      // Apply multi-hop adjustments if applicable
      const hopAdjustments = this.calculateMultiHopAdjustments(opportunity);
      
      // Calculate final slippage
      const totalSlippage = this.combineSlippageFactors({
        base: baseSlippage,
        market: marketAdjustments,
        time: timeAdjustments,
        hops: hopAdjustments
      });
      
      // Apply maximum limits
      const finalSlippage = Math.min(totalSlippage, this.options.maxSlippageTolerance);
      
      const calculation = {
        opportunityId: opportunity.id,
        tradeAmount,
        slippage: {
          base: baseSlippage,
          market: marketAdjustments,
          time: timeAdjustments,
          hops: hopAdjustments,
          final: finalSlippage
        },
        costUSD: finalSlippage * tradeAmount,
        recommendation: this.getSlippageRecommendation(finalSlippage, opportunity),
        timestamp: Date.now(),
        calculationTime: performance.now() - startTime
      };
      
      // Cache calculation for performance tracking
      this.cacheSlippageCalculation(calculation);
      
      this.emit('slippageCalculated', calculation);
      
      return calculation;
      
    } catch (error) {
      console.error('Slippage calculation failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Calculate base slippage using liquidity data
   */
  async calculateBaseSlippage(opportunity, tradeAmount) {
    // Get liquidity data for both sides of the trade
    const buyLiquidity = await this.getLiquidityDepth(opportunity.buyFrom, opportunity.tokenA, opportunity.tokenB);
    const sellLiquidity = await this.getLiquidityDepth(opportunity.sellTo, opportunity.tokenA, opportunity.tokenB);
    
    // Calculate slippage for buy side
    const buySlippage = this.calculateSlippageForSide(tradeAmount, buyLiquidity, 'buy');
    
    // Calculate slippage for sell side
    const sellSlippage = this.calculateSlippageForSide(tradeAmount, sellLiquidity, 'sell');
    
    // Combine both sides
    return buySlippage + sellSlippage;
  }
  
  /**
   * Calculate slippage for one side of the trade
   */
  calculateSlippageForSide(tradeAmount, liquidity, side) {
    if (!liquidity || liquidity.totalUSD === 0) {
      return this.options.maxSlippageTolerance; // Max slippage for unknown liquidity
    }
    
    const liquidityRatio = tradeAmount / liquidity.totalUSD;
    
    // Choose slippage model based on liquidity characteristics
    const model = this.selectSlippageModel(liquidity);
    
    return this.slippageModels[model](liquidityRatio, liquidity, side);
  }
  
  /**
   * Select appropriate slippage model based on liquidity characteristics
   */
  selectSlippageModel(liquidity) {
    // Use logarithmic model for high liquidity (more realistic)
    if (liquidity.totalUSD > 1000000) {
      return 'logarithmic';
    }
    
    // Use square root model for medium liquidity
    if (liquidity.totalUSD > 100000) {
      return 'square_root';
    }
    
    // Use linear model for low liquidity (more conservative)
    return 'linear';
  }
  
  /**
   * Constant slippage model (simple percentage)
   */
  calculateConstantSlippage(liquidityRatio, liquidity, side) {
    return this.options.baseSlippageTolerance;
  }
  
  /**
   * Linear slippage model
   */
  calculateLinearSlippage(liquidityRatio, liquidity, side) {
    const baseSlippage = this.options.baseSlippageTolerance;
    const scalingFactor = side === 'buy' ? 1.0 : 1.2; // Selling typically has higher slippage
    
    return baseSlippage + (liquidityRatio * 0.5 * scalingFactor);
  }
  
  /**
   * Square root slippage model (sub-linear scaling)
   */
  calculateSquareRootSlippage(liquidityRatio, liquidity, side) {
    const baseSlippage = this.options.baseSlippageTolerance;
    const scalingFactor = side === 'buy' ? 0.3 : 0.36;
    
    return baseSlippage + (Math.sqrt(liquidityRatio) * scalingFactor);
  }
  
  /**
   * Logarithmic slippage model (realistic for AMMs)
   */
  calculateLogarithmicSlippage(liquidityRatio, liquidity, side) {
    if (liquidityRatio <= 0) return this.options.baseSlippageTolerance;
    
    const baseSlippage = this.options.baseSlippageTolerance;
    const scalingFactor = side === 'buy' ? 0.2 : 0.24;
    
    // Use natural logarithm for realistic AMM slippage curve
    return baseSlippage + (Math.log(1 + liquidityRatio) * scalingFactor);
  }
  
  /**
   * Calculate market condition adjustments
   */
  async calculateMarketAdjustments(opportunity) {
    let adjustments = {
      volatility: 0,
      networkCongestion: 0,
      gasPrice: 0,
      liquidityHealth: 0
    };
    
    // Volatility adjustment
    const tokenVolatility = await this.getTokenVolatility(opportunity.tokenA, opportunity.tokenB);
    if (tokenVolatility > this.options.highVolatilityThreshold) {
      adjustments.volatility = (tokenVolatility - this.options.highVolatilityThreshold) * this.options.volatilityMultiplier;
    }
    
    // Network congestion adjustment
    if (this.marketData.networkCongestion === 'high') {
      adjustments.networkCongestion = this.options.baseSlippageTolerance * (this.options.networkCongestionMultiplier - 1);
    }
    
    // Gas price volatility adjustment
    if (this.marketData.gasPriceMultiplier > 1.5) {
      adjustments.gasPrice = this.options.baseSlippageTolerance * 0.2;
    }
    
    return adjustments;
  }
  
  /**
   * Calculate time-based adjustments
   */
  calculateTimeAdjustments(opportunity) {
    const estimatedExecutionTime = opportunity.estimatedExecutionTime || 30000; // 30 seconds default
    const timeInSeconds = estimatedExecutionTime / 1000;
    
    // Time decay increases slippage linearly
    const timeAdjustment = Math.min(
      timeInSeconds * this.options.timeDecayFactor,
      this.options.maxTimeAdjustment
    );
    
    return {
      executionTime: timeAdjustment,
      timeInSeconds
    };
  }
  
  /**
   * Calculate multi-hop slippage adjustments
   */
  calculateMultiHopAdjustments(opportunity) {
    const hops = opportunity.path?.length || 2;
    
    if (hops <= 2) {
      return { hops: 0, hopCount: hops };
    }
    
    // Each additional hop increases slippage
    const additionalHops = hops - 2;
    const hopMultiplier = Math.pow(this.options.hopSlippageMultiplier, additionalHops);
    const hopAdjustment = this.options.baseSlippageTolerance * (hopMultiplier - 1);
    
    return {
      hops: hopAdjustment,
      hopCount: hops,
      multiplier: hopMultiplier
    };
  }
  
  /**
   * Combine all slippage factors
   */
  combineSlippageFactors(factors) {
    const { base, market, time, hops } = factors;
    
    // Base slippage
    let totalSlippage = base;
    
    // Add market adjustments
    if (market) {
      totalSlippage += Object.values(market).reduce((sum, adj) => sum + (adj || 0), 0);
    }
    
    // Add time adjustments
    if (time) {
      totalSlippage += time.executionTime || 0;
    }
    
    // Add hop adjustments
    if (hops) {
      totalSlippage += hops.hops || 0;
    }
    
    return totalSlippage;
  }
  
  /**
   * Get slippage recommendation based on calculated value
   */
  getSlippageRecommendation(slippage, opportunity) {
    const profitMargin = opportunity.expectedProfit / opportunity.tradeAmount;
    const slippageCostRatio = slippage / profitMargin;
    
    if (slippage > this.options.maxSlippageTolerance * 0.8) {
      return {
        action: 'REJECT',
        reason: 'Slippage too high',
        severity: 'critical'
      };
    }
    
    if (slippageCostRatio > 0.5) {
      return {
        action: 'REDUCE_SIZE',
        reason: 'Slippage cost too high relative to profit',
        severity: 'high',
        suggestedReduction: 0.5
      };
    }
    
    if (slippageCostRatio > 0.3) {
      return {
        action: 'PROCEED_CAUTION',
        reason: 'Moderate slippage impact',
        severity: 'medium'
      };
    }
    
    return {
      action: 'PROCEED',
      reason: 'Acceptable slippage',
      severity: 'low'
    };
  }
  
  /**
   * Pre-trade slippage simulation
   */
  async simulateSlippage(opportunity, tradeAmount, iterations = 100) {
    console.log(`🎯 Running slippage simulation (${iterations} iterations)...`);
    
    const simulations = [];
    
    for (let i = 0; i < iterations; i++) {
      // Add randomness to simulate market variability
      const variability = (Math.random() - 0.5) * 0.002; // ±0.1% variability
      const simulatedOpportunity = {
        ...opportunity,
        estimatedExecutionTime: opportunity.estimatedExecutionTime + (Math.random() - 0.5) * 10000
      };
      
      const calculation = await this.calculateDynamicSlippage(simulatedOpportunity, tradeAmount);
      simulations.push({
        iteration: i,
        slippage: calculation.slippage.final + variability,
        cost: (calculation.slippage.final + variability) * tradeAmount
      });
    }
    
    // Analyze simulation results
    const slippages = simulations.map(s => s.slippage);
    const costs = simulations.map(s => s.cost);
    
    slippages.sort((a, b) => a - b);
    costs.sort((a, b) => a - b);
    
    const analysis = {
      iterations,
      slippage: {
        mean: slippages.reduce((sum, s) => sum + s, 0) / slippages.length,
        median: slippages[Math.floor(slippages.length / 2)],
        p95: slippages[Math.floor(slippages.length * 0.95)],
        p99: slippages[Math.floor(slippages.length * 0.99)],
        min: slippages[0],
        max: slippages[slippages.length - 1]
      },
      cost: {
        mean: costs.reduce((sum, c) => sum + c, 0) / costs.length,
        median: costs[Math.floor(costs.length / 2)],
        p95: costs[Math.floor(costs.length * 0.95)],
        p99: costs[Math.floor(costs.length * 0.99)],
        min: costs[0],
        max: costs[costs.length - 1]
      },
      recommendation: this.getSimulationRecommendation(slippages, costs, tradeAmount)
    };
    
    this.emit('slippageSimulated', { opportunity, tradeAmount, analysis });
    
    return analysis;
  }
  
  /**
   * Get recommendation based on simulation results
   */
  getSimulationRecommendation(slippages, costs, tradeAmount) {
    const p95Slippage = slippages[Math.floor(slippages.length * 0.95)];
    const maxSlippage = slippages[slippages.length - 1];
    
    if (p95Slippage > this.options.maxSlippageTolerance) {
      return {
        action: 'REJECT',
        reason: '95th percentile slippage exceeds maximum tolerance',
        severity: 'critical'
      };
    }
    
    if (maxSlippage > this.options.maxSlippageTolerance * 1.5) {
      return {
        action: 'REDUCE_SIZE',
        reason: 'Maximum simulated slippage too high',
        severity: 'high',
        suggestedReduction: 0.3
      };
    }
    
    return {
      action: 'PROCEED',
      reason: 'Simulation results within acceptable range',
      severity: 'low'
    };
  }
  
  /**
   * Update realized slippage after trade execution
   */
  updateRealizedSlippage(tradeId, predictedSlippage, actualSlippage) {
    const slippageError = Math.abs(actualSlippage - predictedSlippage);
    const errorPercentage = slippageError / predictedSlippage;
    
    this.realizedSlippage.set(tradeId, {
      predicted: predictedSlippage,
      actual: actualSlippage,
      error: slippageError,
      errorPercentage,
      timestamp: Date.now()
    });
    
    // Update historical accuracy metrics
    this.updateAccuracyMetrics(predictedSlippage, actualSlippage);
    
    this.emit('slippageRealized', {
      tradeId,
      predicted: predictedSlippage,
      actual: actualSlippage,
      accuracy: 1 - errorPercentage
    });
  }
  
  /**
   * Get liquidity depth for a specific exchange and token pair
   */
  async getLiquidityDepth(exchange, tokenA, tokenB) {
    const cacheKey = `${exchange}_${tokenA}_${tokenB}`;
    const cached = this.marketData.liquidityCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 30000) { // 30 second cache
      return cached.data;
    }
    
    try {
      // This would integrate with actual exchange APIs
      const liquidityData = await this.fetchLiquidityFromExchange(exchange, tokenA, tokenB);
      
      this.marketData.liquidityCache.set(cacheKey, {
        data: liquidityData,
        timestamp: Date.now()
      });
      
      return liquidityData;
      
    } catch (error) {
      console.warn(`Failed to fetch liquidity for ${exchange}:`, error.message);
      
      // Return fallback data
      return {
        totalUSD: 100000, // Conservative fallback
        depth: { buy: [], sell: [] },
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Fetch actual liquidity from exchange (placeholder)
   */
  async fetchLiquidityFromExchange(exchange, tokenA, tokenB) {
    // This would be implemented with actual exchange integration
    // For now, return simulated data
    
    const baseLiquidity = Math.random() * 1000000 + 100000; // $100k - $1.1M
    
    return {
      totalUSD: baseLiquidity,
      depth: {
        buy: this.generateLiquidityDepth(baseLiquidity * 0.5),
        sell: this.generateLiquidityDepth(baseLiquidity * 0.5)
      },
      timestamp: Date.now(),
      exchange
    };
  }
  
  /**
   * Generate simulated liquidity depth
   */
  generateLiquidityDepth(totalLiquidity) {
    const depth = [];
    let remainingLiquidity = totalLiquidity;
    let priceLevel = 1.0;
    
    while (remainingLiquidity > 1000 && depth.length < 10) {
      const levelLiquidity = Math.min(remainingLiquidity * 0.2, remainingLiquidity);
      depth.push({
        price: priceLevel,
        liquidity: levelLiquidity,
        accumulated: totalLiquidity - remainingLiquidity + levelLiquidity
      });
      
      remainingLiquidity -= levelLiquidity;
      priceLevel += 0.001; // 0.1% price steps
    }
    
    return depth;
  }
  
  /**
   * Get token volatility
   */
  async getTokenVolatility(tokenA, tokenB) {
    const cacheKey = `volatility_${tokenA}_${tokenB}`;
    const cached = this.marketData.volatilityCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 60000) { // 1 minute cache
      return cached.volatility;
    }
    
    // Calculate or fetch volatility
    const volatility = await this.calculateTokenVolatility(tokenA, tokenB);
    
    this.marketData.volatilityCache.set(cacheKey, {
      volatility,
      timestamp: Date.now()
    });
    
    return volatility;
  }
  
  /**
   * Calculate token volatility (placeholder)
   */
  async calculateTokenVolatility(tokenA, tokenB) {
    // This would use historical price data to calculate actual volatility
    // For now, return simulated volatility
    return Math.random() * 0.1; // 0-10% volatility
  }
  
  /**
   * Cache slippage calculation for performance tracking
   */
  cacheSlippageCalculation(calculation) {
    this.slippageHistory.push(calculation);
    
    // Keep only last 1000 calculations
    if (this.slippageHistory.length > 1000) {
      this.slippageHistory = this.slippageHistory.slice(-1000);
    }
  }
  
  /**
   * Update accuracy metrics
   */
  updateAccuracyMetrics(predicted, actual) {
    // This would update internal accuracy tracking
    // Implementation would depend on specific accuracy requirements
  }
  
  /**
   * Load historical slippage data
   */
  async loadSlippageHistory() {
    // This would load historical data for accuracy calibration
    console.log('📈 Loading slippage history...');
  }
  
  /**
   * Setup market data monitoring
   */
  setupMarketDataMonitoring() {
    // Update market data every 30 seconds
    setInterval(() => {
      this.updateMarketData();
    }, 30000);
  }
  
  /**
   * Update market data
   */
  async updateMarketData() {
    try {
      // Update network congestion
      this.marketData.networkCongestion = await this.assessNetworkCongestion();
      
      // Update gas price multiplier
      this.marketData.gasPriceMultiplier = await this.getGasPriceMultiplier();
      
      this.marketData.lastUpdate = Date.now();
      
    } catch (error) {
      console.warn('Failed to update market data:', error.message);
    }
  }
  
  /**
   * Assess network congestion
   */
  async assessNetworkCongestion() {
    // This would integrate with network monitoring
    // For now, return simulated congestion
    const random = Math.random();
    if (random < 0.1) return 'high';
    if (random < 0.3) return 'medium';
    return 'normal';
  }
  
  /**
   * Get gas price multiplier
   */
  async getGasPriceMultiplier() {
    // This would get current gas price relative to average
    // For now, return simulated multiplier
    return 1.0 + (Math.random() - 0.5) * 0.5; // 0.75x to 1.25x
  }
  
  /**
   * Get comprehensive slippage report
   */
  getSlippageReport() {
    const recentCalculations = this.slippageHistory.slice(-100);
    
    return {
      summary: {
        totalCalculations: this.slippageHistory.length,
        averageSlippage: recentCalculations.reduce((sum, c) => sum + c.slippage.final, 0) / recentCalculations.length,
        averageCalculationTime: recentCalculations.reduce((sum, c) => sum + c.calculationTime, 0) / recentCalculations.length,
        marketConditions: this.marketData
      },
      accuracy: this.getAccuracyMetrics(),
      recommendations: this.getSlippageOptimizationRecommendations()
    };
  }
  
  /**
   * Get accuracy metrics
   */
  getAccuracyMetrics() {
    const realized = Array.from(this.realizedSlippage.values());
    
    if (realized.length === 0) {
      return { noData: true };
    }
    
    const accuracies = realized.map(r => 1 - r.errorPercentage);
    
    return {
      count: realized.length,
      averageAccuracy: accuracies.reduce((sum, a) => sum + a, 0) / accuracies.length,
      medianAccuracy: accuracies.sort()[Math.floor(accuracies.length / 2)],
      accuracyAbove95: accuracies.filter(a => a > 0.95).length / accuracies.length
    };
  }
  
  /**
   * Get slippage optimization recommendations
   */
  getSlippageOptimizationRecommendations() {
    const recommendations = [];
    
    const accuracy = this.getAccuracyMetrics();
    
    if (!accuracy.noData && accuracy.averageAccuracy < 0.9) {
      recommendations.push({
        priority: 'high',
        category: 'accuracy',
        title: 'Low Slippage Prediction Accuracy',
        description: 'Slippage predictions are less than 90% accurate',
        action: 'Recalibrate slippage models with recent data'
      });
    }
    
    if (this.marketData.networkCongestion === 'high') {
      recommendations.push({
        priority: 'medium',
        category: 'market',
        title: 'High Network Congestion',
        description: 'Network congestion is high, increasing slippage risk',
        action: 'Increase slippage tolerance temporarily'
      });
    }
    
    return recommendations;
  }
  
  /**
   * Shutdown slippage manager
   */
  async shutdown() {
    console.log('📊 Shutting down Slippage Manager...');
    this.emit('shutdown');
  }
}

export default SlippageManager;