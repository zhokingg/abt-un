const { ethers } = require('ethers');
const EventEmitter = require('events');
const AdvancedGasManager = require('../services/advancedGasManager');
const GasOptimizedTransactionBuilder = require('../services/gasOptimizedTransactionBuilder');
const GasAnalytics = require('../services/gasAnalytics');

/**
 * Gas Optimization Engine - Centralized gas optimization logic
 * Coordinates all gas optimization strategies and provides unified interface
 */
class GasOptimizationEngine extends EventEmitter {
  constructor(web3Provider, contractManager) {
    super();
    
    this.web3Provider = web3Provider;
    this.contractManager = contractManager;
    
    // Initialize optimization components
    this.gasManager = new AdvancedGasManager(web3Provider);
    this.transactionBuilder = new GasOptimizedTransactionBuilder(web3Provider, contractManager);
    this.analytics = new GasAnalytics(web3Provider);
    
    // Optimization strategies
    this.strategies = {
      AGGRESSIVE_SAVINGS: {
        name: 'AGGRESSIVE_SAVINGS',
        priority: 'cost_minimization',
        riskTolerance: 'low',
        maxGasPrice: 50, // gwei
        profitThreshold: 0.001 // 0.1%
      },
      BALANCED_OPTIMIZATION: {
        name: 'BALANCED_OPTIMIZATION',
        priority: 'balanced',
        riskTolerance: 'medium',
        maxGasPrice: 100,
        profitThreshold: 0.005
      },
      SPEED_PRIORITIZED: {
        name: 'SPEED_PRIORITIZED',
        priority: 'execution_speed',
        riskTolerance: 'high',
        maxGasPrice: 200,
        profitThreshold: 0.01
      },
      PROFIT_MAXIMIZATION: {
        name: 'PROFIT_MAXIMIZATION',
        priority: 'profit_optimization',
        riskTolerance: 'medium',
        dynamicAdjustment: true,
        profitThreshold: 0.002
      }
    };
    
    // Optimization state
    this.state = {
      currentStrategy: 'BALANCED_OPTIMIZATION',
      networkConditions: 'MEDIUM',
      optimizationMode: 'AUTO',
      gasBudget: ethers.parseEther('0.1'), // 0.1 ETH gas budget
      savingsTarget: 0.3 // 30% savings target
    };
    
    // Performance tracking
    this.performance = {
      totalOptimizations: 0,
      successfulOptimizations: 0,
      totalGasSaved: 0n,
      totalCostSaved: 0,
      averageOptimization: 0,
      bestOptimization: 0
    };
    
    // Real-time optimization cache
    this.optimizationCache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
    
    this.initialize();
  }
  
  /**
   * Main optimization entry point - optimize transaction for gas efficiency
   */
  async optimizeTransaction(arbitrageData, options = {}) {
    try {
      console.log('🚀 Starting gas optimization process...');
      
      const startTime = Date.now();
      
      // Analyze current conditions
      const conditions = await this.analyzeCurrentConditions();
      
      // Select optimal strategy
      const strategy = this.selectOptimalStrategy(arbitrageData, conditions, options);
      
      // Generate optimization plan
      const optimizationPlan = await this.createOptimizationPlan(
        arbitrageData, 
        strategy, 
        conditions, 
        options
      );
      
      // Execute optimization
      const optimizedTransaction = await this.executeOptimization(optimizationPlan);
      
      // Record results
      const optimizationTime = Date.now() - startTime;
      await this.recordOptimizationResult(optimizedTransaction, optimizationTime);
      
      console.log(`✅ Gas optimization completed in ${optimizationTime}ms`);
      console.log(`💰 Estimated savings: ${optimizedTransaction.savings.percentage.toFixed(1)}%`);
      
      return optimizedTransaction;
      
    } catch (error) {
      console.error('❌ Gas optimization failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Analyze current network and market conditions
   */
  async analyzeCurrentConditions() {
    const [networkStats, gasStats, marketConditions] = await Promise.all([
      this.getNetworkConditions(),
      this.getGasMarketConditions(),
      this.getMarketConditions()
    ]);
    
    return {
      network: networkStats,
      gas: gasStats,
      market: marketConditions,
      timestamp: Date.now(),
      
      // Derived conditions
      congestionLevel: this.calculateCongestionLevel(networkStats, gasStats),
      volatilityLevel: this.calculateVolatilityLevel(gasStats),
      competitionLevel: this.calculateCompetitionLevel(marketConditions),
      
      // Optimization recommendations
      recommendedStrategy: this.recommendStrategy(networkStats, gasStats, marketConditions),
      urgencyLevel: this.calculateUrgencyLevel(networkStats, gasStats)
    };
  }
  
  /**
   * Select optimal optimization strategy based on conditions
   */
  selectOptimalStrategy(arbitrageData, conditions, options = {}) {
    // Use forced strategy if specified
    if (options.forceStrategy && this.strategies[options.forceStrategy]) {
      return this.strategies[options.forceStrategy];
    }
    
    // Use recommended strategy from conditions
    if (conditions.recommendedStrategy && this.strategies[conditions.recommendedStrategy]) {
      return this.strategies[conditions.recommendedStrategy];
    }
    
    // Intelligent strategy selection based on trade characteristics
    const tradeValue = arbitrageData.amountIn || 10000;
    const expectedProfit = arbitrageData.expectedProfit || 0.01;
    const profitMargin = expectedProfit / tradeValue;
    
    // High-value, high-margin trades - prioritize speed
    if (tradeValue > 100000 && profitMargin > 0.02) {
      return this.strategies.SPEED_PRIORITIZED;
    }
    
    // Low-margin trades - prioritize cost savings
    if (profitMargin < 0.005) {
      return this.strategies.AGGRESSIVE_SAVINGS;
    }
    
    // High-margin trades - prioritize profit maximization
    if (profitMargin > 0.015) {
      return this.strategies.PROFIT_MAXIMIZATION;
    }
    
    // Default to balanced approach
    return this.strategies.BALANCED_OPTIMIZATION;
  }
  
  /**
   * Create comprehensive optimization plan
   */
  async createOptimizationPlan(arbitrageData, strategy, conditions, options) {
    const plan = {
      id: this.generateOptimizationId(),
      timestamp: Date.now(),
      strategy: strategy.name,
      
      // Input data
      arbitrageData,
      conditions,
      options,
      
      // Optimization targets
      targets: {
        maxGasCost: this.calculateMaxGasCost(arbitrageData, strategy),
        minProfitMargin: strategy.profitThreshold,
        maxExecutionTime: this.calculateMaxExecutionTime(strategy, conditions),
        savingsTarget: this.state.savingsTarget
      },
      
      // Optimization steps
      steps: [
        { step: 'gas_estimation', priority: 1 },
        { step: 'price_optimization', priority: 2 },
        { step: 'limit_optimization', priority: 3 },
        { step: 'timing_optimization', priority: 4 },
        { step: 'batch_analysis', priority: 5 },
        { step: 'mev_protection', priority: 6 }
      ],
      
      // Fallback strategies
      fallbacks: this.generateFallbackStrategies(strategy, conditions)
    };
    
    return plan;
  }
  
  /**
   * Execute the optimization plan
   */
  async executeOptimization(plan) {
    console.log(`🎯 Executing optimization plan: ${plan.id}`);
    
    let result = {
      planId: plan.id,
      strategy: plan.strategy,
      transaction: null,
      gasParams: null,
      savings: { absolute: 0, percentage: 0 },
      optimizations: [],
      warnings: [],
      fallbackUsed: false
    };
    
    try {
      // Step 1: Gas Estimation Optimization
      const gasEstimation = await this.optimizeGasEstimation(plan);
      result.optimizations.push(gasEstimation);
      
      // Step 2: Price Optimization
      const priceOptimization = await this.optimizeGasPrice(plan, gasEstimation);
      result.optimizations.push(priceOptimization);
      
      // Step 3: Limit Optimization
      const limitOptimization = await this.optimizeGasLimit(plan, gasEstimation);
      result.optimizations.push(limitOptimization);
      
      // Step 4: Build optimized transaction
      const optimizedTx = await this.transactionBuilder.buildOptimizedArbitrageTransaction(
        plan.arbitrageData,
        {
          strategy: plan.strategy,
          gasEstimation,
          priceOptimization,
          limitOptimization
        }
      );
      
      result.transaction = optimizedTx.transaction;
      result.gasParams = optimizedTx.gasParams;
      
      // Step 5: Calculate savings
      result.savings = await this.calculateOptimizationSavings(plan, optimizedTx);
      
      // Step 6: Apply additional optimizations
      const additionalOptimizations = await this.applyAdditionalOptimizations(
        result, 
        plan
      );
      
      result.optimizations.push(...additionalOptimizations);
      
      console.log(`✅ Optimization plan executed successfully`);
      
    } catch (error) {
      console.warn(`⚠️ Primary optimization failed, trying fallback: ${error.message}`);
      result = await this.executeFallbackOptimization(plan, error);
      result.fallbackUsed = true;
    }
    
    return result;
  }
  
  /**
   * Optimize gas estimation using multiple methods
   */
  async optimizeGasEstimation(plan) {
    const methods = [
      { name: 'contract_estimation', weight: 0.4 },
      { name: 'ml_prediction', weight: 0.3 },
      { name: 'historical_analysis', weight: 0.2 },
      { name: 'network_analysis', weight: 0.1 }
    ];
    
    const estimations = [];
    
    // Contract-based estimation
    try {
      const contractEstimate = await this.contractManager.estimateArbitrageGas(
        plan.arbitrageData
      );
      estimations.push({
        method: 'contract_estimation',
        gasLimit: parseInt(contractEstimate.gasLimit),
        confidence: contractEstimate.estimated ? 0.8 : 0.5
      });
    } catch (error) {
      console.warn('Contract estimation failed:', error.message);
    }
    
    // ML-based estimation
    try {
      const mlEstimate = await this.transactionBuilder.predictOptimalGas(
        plan.arbitrageData,
        { strategy: plan.strategy }
      );
      estimations.push({
        method: 'ml_prediction',
        gasLimit: mlEstimate.gasLimit,
        confidence: mlEstimate.confidence
      });
    } catch (error) {
      console.warn('ML estimation failed:', error.message);
    }
    
    // Historical analysis
    const historicalEstimate = this.getHistoricalGasEstimate(plan.arbitrageData);
    estimations.push({
      method: 'historical_analysis',
      gasLimit: historicalEstimate.gasLimit,
      confidence: historicalEstimate.confidence
    });
    
    // Combine estimations using weighted average
    const combinedEstimate = this.combineGasEstimations(estimations, methods);
    
    return {
      step: 'gas_estimation',
      result: combinedEstimate,
      methods: estimations,
      confidence: combinedEstimate.confidence,
      optimization: combinedEstimate.gasLimit < 500000 ? 'OPTIMIZED' : 'STANDARD'
    };
  }
  
  /**
   * Optimize gas price using dynamic strategies
   */
  async optimizeGasPrice(plan, gasEstimation) {
    const currentMarket = await this.gasManager.updateNetworkConditions();
    const strategy = this.strategies[plan.strategy];
    
    // Get base gas parameters
    const baseParams = await this.gasManager.getOptimalGasParams(
      plan.arbitrageData,
      { strategy: plan.strategy }
    );
    
    // Apply strategy-specific optimizations
    let optimizedParams = { ...baseParams };
    
    switch (strategy.priority) {
      case 'cost_minimization':
        optimizedParams = this.applyCostMinimizationStrategy(baseParams, plan);
        break;
      case 'execution_speed':
        optimizedParams = this.applySpeedOptimizationStrategy(baseParams, plan);
        break;
      case 'profit_optimization':
        optimizedParams = this.applyProfitOptimizationStrategy(baseParams, plan);
        break;
      default:
        optimizedParams = this.applyBalancedStrategy(baseParams, plan);
    }
    
    // Validate against constraints
    optimizedParams = this.validateGasParams(optimizedParams, strategy);
    
    return {
      step: 'price_optimization',
      result: optimizedParams,
      baseParams,
      strategy: strategy.priority,
      savings: this.calculatePriceSavings(baseParams, optimizedParams)
    };
  }
  
  /**
   * Optimize gas limit with safety margins
   */
  async optimizeGasLimit(plan, gasEstimation) {
    const baseLimit = gasEstimation.result.gasLimit;
    const strategy = this.strategies[plan.strategy];
    
    // Calculate optimal buffer based on strategy and conditions
    let bufferPercent = 0.15; // Default 15% buffer
    
    switch (strategy.riskTolerance) {
      case 'low':
        bufferPercent = 0.25; // 25% buffer
        break;
      case 'medium':
        bufferPercent = 0.15; // 15% buffer
        break;
      case 'high':
        bufferPercent = 0.08; // 8% buffer
        break;
    }
    
    // Adjust buffer based on network conditions
    if (plan.conditions.congestionLevel === 'HIGH') {
      bufferPercent += 0.05;
    } else if (plan.conditions.congestionLevel === 'LOW') {
      bufferPercent -= 0.03;
    }
    
    // Adjust buffer based on transaction complexity
    const complexity = this.calculateTransactionComplexity(plan.arbitrageData);
    bufferPercent += complexity * 0.1;
    
    const optimizedLimit = Math.floor(baseLimit * (1 + bufferPercent));
    
    return {
      step: 'limit_optimization',
      result: { gasLimit: optimizedLimit, buffer: bufferPercent },
      baseLimit,
      optimization: optimizedLimit < baseLimit * 1.2 ? 'OPTIMIZED' : 'CONSERVATIVE'
    };
  }
  
  /**
   * Apply additional optimizations
   */
  async applyAdditionalOptimizations(baseResult, plan) {
    const additionalOpts = [];
    
    // Batch processing analysis
    const batchAnalysis = await this.analyzeBatchOpportunity(plan);
    if (batchAnalysis.beneficial) {
      additionalOpts.push({
        type: 'batch_processing',
        description: 'Transaction can be batched for additional savings',
        savings: batchAnalysis.savings,
        recommendation: batchAnalysis.recommendation
      });
    }
    
    // MEV protection analysis
    const mevAnalysis = await this.analyzeMEVProtectionNeed(plan, baseResult);
    if (mevAnalysis.recommended) {
      additionalOpts.push({
        type: 'mev_protection',
        description: 'MEV protection recommended',
        costIncrease: mevAnalysis.costIncrease,
        protection: mevAnalysis.protection
      });
    }
    
    // Timing optimization
    const timingAnalysis = await this.analyzeOptimalTiming(plan);
    if (timingAnalysis.betterTiming) {
      additionalOpts.push({
        type: 'timing_optimization',
        description: 'Better execution timing available',
        delay: timingAnalysis.optimalDelay,
        savings: timingAnalysis.potentialSavings
      });
    }
    
    return additionalOpts;
  }
  
  /**
   * Calculate optimization savings
   */
  async calculateOptimizationSavings(plan, optimizedTx) {
    // Get baseline cost (unoptimized)
    const baselineCost = await this.calculateBaselineCost(plan.arbitrageData);
    
    // Get optimized cost
    const optimizedCost = optimizedTx.estimatedCostUSD || 0;
    
    // Calculate savings
    const absoluteSavings = Math.max(0, baselineCost - optimizedCost);
    const percentageSavings = baselineCost > 0 ? (absoluteSavings / baselineCost) * 100 : 0;
    
    return {
      baseline: baselineCost,
      optimized: optimizedCost,
      absolute: absoluteSavings,
      percentage: percentageSavings,
      target: this.state.savingsTarget * 100,
      achieved: percentageSavings >= (this.state.savingsTarget * 100)
    };
  }
  
  /**
   * Record optimization results for analytics
   */
  async recordOptimizationResult(result, executionTime) {
    this.performance.totalOptimizations++;
    
    if (result.savings.percentage > 5) { // > 5% savings considered successful
      this.performance.successfulOptimizations++;
    }
    
    this.performance.totalGasSaved += BigInt(Math.floor(result.savings.absolute * 1e18));
    this.performance.totalCostSaved += result.savings.absolute;
    this.performance.averageOptimization = 
      this.performance.totalCostSaved / this.performance.totalOptimizations;
    
    if (result.savings.percentage > this.performance.bestOptimization) {
      this.performance.bestOptimization = result.savings.percentage;
    }
    
    // Record in analytics
    await this.analytics.recordTransaction(
      {
        ...result.transaction,
        strategy: result.strategy,
        mlOptimized: true,
        estimatedCostUSD: result.savings.optimized,
        gasSavings: result.savings.absolute
      },
      {
        status: 'optimized',
        executionTime,
        gasSavings: result.savings.absolute
      }
    );
    
    this.emit('optimizationCompleted', {
      result,
      executionTime,
      performance: this.performance
    });
  }
  
  /**
   * Initialize the optimization engine
   */
  initialize() {
    // Set up event listeners
    this.gasManager.on('gasPoolLow', (data) => {
      this.emit('gasPoolAlert', data);
    });
    
    this.analytics.on('analysisCompleted', (analysis) => {
      this.adaptStrategyFromAnalysis(analysis);
    });
    
    // Start periodic optimization of engine itself
    setInterval(() => {
      this.optimizeEngine().catch(console.error);
    }, 300000); // Every 5 minutes
    
    console.log('🚀 Gas optimization engine initialized');
  }
  
  /**
   * Get optimization engine statistics
   */
  getStats() {
    return {
      performance: {
        ...this.performance,
        successRate: this.performance.totalOptimizations > 0 ? 
          this.performance.successfulOptimizations / this.performance.totalOptimizations : 0,
        totalGasSaved: ethers.formatEther(this.performance.totalGasSaved),
        averageOptimization: this.performance.averageOptimization.toFixed(2)
      },
      
      state: this.state,
      
      strategies: Object.keys(this.strategies),
      
      componentStats: {
        gasManager: this.gasManager.getStats(),
        transactionBuilder: this.transactionBuilder.getPerformanceStats(),
        analytics: this.analytics.getDashboardData()
      }
    };
  }
  
  // Helper methods (simplified implementations)
  async getNetworkConditions() { return { congestion: 'MEDIUM', blockTime: 12 }; }
  async getGasMarketConditions() { return { baseFee: 25, volatility: 0.1 }; }
  async getMarketConditions() { return { competition: 'MEDIUM', volume: 'HIGH' }; }
  
  calculateCongestionLevel() { return 'MEDIUM'; }
  calculateVolatilityLevel() { return 'LOW'; }
  calculateCompetitionLevel() { return 'MEDIUM'; }
  recommendStrategy() { return 'BALANCED_OPTIMIZATION'; }
  calculateUrgencyLevel() { return 'MEDIUM'; }
  
  calculateMaxGasCost(arbitrageData, strategy) {
    const tradeValue = arbitrageData.amountIn || 10000;
    return tradeValue * 0.02; // Max 2% of trade value
  }
  
  calculateMaxExecutionTime() { return 30000; } // 30 seconds
  generateFallbackStrategies() { return []; }
  generateOptimizationId() { 
    return `opt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }
  
  getHistoricalGasEstimate() { 
    return { gasLimit: 400000, confidence: 0.6 }; 
  }
  
  combineGasEstimations(estimations) {
    if (estimations.length === 0) return { gasLimit: 400000, confidence: 0.5 };
    
    const totalWeight = estimations.reduce((sum, est) => sum + est.confidence, 0);
    const weightedGasLimit = estimations.reduce((sum, est) => 
      sum + (est.gasLimit * est.confidence), 0) / totalWeight;
    
    return {
      gasLimit: Math.floor(weightedGasLimit),
      confidence: totalWeight / estimations.length
    };
  }
  
  applyCostMinimizationStrategy(params) { return params; }
  applySpeedOptimizationStrategy(params) { return params; }
  applyProfitOptimizationStrategy(params) { return params; }
  applyBalancedStrategy(params) { return params; }
  
  validateGasParams(params) { return params; }
  calculatePriceSavings() { return { absolute: 0, percentage: 0 }; }
  calculateTransactionComplexity() { return 0.1; }
  
  async analyzeBatchOpportunity() { return { beneficial: false }; }
  async analyzeMEVProtectionNeed() { return { recommended: false }; }
  async analyzeOptimalTiming() { return { betterTiming: false }; }
  
  async calculateBaselineCost() { return 50; } // $50 baseline
  
  async executeFallbackOptimization(plan, error) {
    return {
      planId: plan.id,
      strategy: 'FALLBACK',
      fallbackUsed: true,
      error: error.message,
      transaction: null,
      savings: { absolute: 0, percentage: 0 }
    };
  }
  
  adaptStrategyFromAnalysis() { /* Adapt strategy based on analytics */ }
  async optimizeEngine() { /* Self-optimization of the engine */ }
}

module.exports = GasOptimizationEngine;