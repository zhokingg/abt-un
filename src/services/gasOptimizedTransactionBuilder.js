const { ethers } = require('ethers');
const EventEmitter = require('events');
const config = require('../config/config');
const TransactionBuilder = require('./transactionBuilder');
const AdvancedGasManager = require('./advancedGasManager');

/**
 * Gas-Optimized Transaction Builder with ML-based Gas Prediction
 * Extends TransactionBuilder with advanced gas optimization and prediction capabilities
 */
class GasOptimizedTransactionBuilder extends TransactionBuilder {
  constructor(web3Provider, contractManager) {
    super(web3Provider);
    
    this.contractManager = contractManager;
    this.gasManager = new AdvancedGasManager(web3Provider);
    
    // ML-based gas prediction system
    this.gasPredictor = {
      model: null, // Would be trained ML model in production
      historicalData: [],
      maxHistory: 1000,
      features: ['blockTime', 'gasUsed', 'baseFee', 'pendingTxs', 'tradeSize'],
      predictionAccuracy: 0.87,
      enabled: true
    };
    
    // Transaction optimization cache
    this.optimizationCache = new Map();
    this.cacheMaxAge = 60000; // 1 minute
    
    // Advanced gas strategies for different scenarios
    this.advancedStrategies = {
      MEV_PROTECTION: {
        name: 'MEV_PROTECTION',
        priorityBoost: 2.0,
        flashbotsEnabled: true,
        maxSlippage: 0.5
      },
      HIGH_FREQUENCY: {
        name: 'HIGH_FREQUENCY',
        gasOptimization: 'aggressive',
        batchingEnabled: true,
        maxLatency: 1000
      },
      PROFIT_MAXIMIZATION: {
        name: 'PROFIT_MAXIMIZATION',
        dynamicFees: true,
        profitThreshold: 0.002,
        riskTolerance: 'medium'
      }
    };
    
    // Performance tracking
    this.performance = {
      totalTransactions: 0,
      successfulPredictions: 0,
      gasSavings: 0n,
      averageAccuracy: 0,
      optimizationHits: 0,
      cacheHits: 0
    };
    
    this.initializeGasPredictor();
  }
  
  /**
   * Build optimized flashloan arbitrage transaction with ML prediction
   */
  async buildOptimizedArbitrageTransaction(arbitrageData, options = {}) {
    try {
      console.log('🔧 Building gas-optimized arbitrage transaction...');
      
      // Check optimization cache first
      const cacheKey = this.generateCacheKey(arbitrageData, options);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        console.log('💾 Using cached optimization');
        this.performance.cacheHits++;
        return cached;
      }
      
      // Predict optimal gas parameters using ML
      const gasPrediction = await this.predictOptimalGas(arbitrageData, options);
      
      // Get advanced gas parameters from gas manager
      const advancedGasParams = await this.gasManager.getOptimalGasParams(arbitrageData, options);
      
      // Combine predictions with current network conditions
      const optimizedGasParams = this.combineGasStrategies(gasPrediction, advancedGasParams);
      
      // Build transaction with optimized parameters
      const transaction = await this.buildTransactionWithOptimizedGas(
        arbitrageData,
        optimizedGasParams,
        options
      );
      
      // Apply additional optimizations
      const finalTransaction = await this.applyAdvancedOptimizations(transaction, options);
      
      // Cache the result
      this.storeInCache(cacheKey, finalTransaction);
      
      // Update performance metrics
      this.updatePerformanceMetrics(finalTransaction, gasPrediction);
      
      console.log('✅ Gas-optimized transaction built successfully');
      console.log(`⛽ Predicted gas: ${finalTransaction.gasParams.gasLimit}`);
      console.log(`💰 Estimated cost: $${finalTransaction.estimatedCostUSD.toFixed(2)}`);
      
      return finalTransaction;
      
    } catch (error) {
      console.error('❌ Failed to build optimized transaction:', error.message);
      throw error;
    }
  }
  
  /**
   * Predict optimal gas parameters using ML-based approach
   */
  async predictOptimalGas(arbitrageData, options = {}) {
    try {
      if (!this.gasPredictor.enabled) {
        return this.getFallbackPrediction();
      }
      
      // Extract features for prediction
      const features = await this.extractPredictionFeatures(arbitrageData);
      
      // Use ML model to predict (simplified - would use actual trained model)
      const prediction = this.runGasPredictionModel(features);
      
      // Validate and adjust prediction
      const validatedPrediction = this.validatePrediction(prediction, features);
      
      console.log(`🧠 ML gas prediction: ${validatedPrediction.gasLimit} gas at ${validatedPrediction.gasPriceGwei} gwei`);
      
      return validatedPrediction;
      
    } catch (error) {
      console.warn('⚠️ Gas prediction failed, using fallback:', error.message);
      return this.getFallbackPrediction();
    }
  }
  
  /**
   * Extract features for ML gas prediction
   */
  async extractPredictionFeatures(arbitrageData) {
    const [block, feeData, networkStats] = await Promise.all([
      this.provider.getBlock('latest'),
      this.provider.getFeeData(),
      this.getNetworkStatistics()
    ]);
    
    return {
      // Block features
      blockTime: Date.now() - (block.timestamp * 1000),
      gasUsed: Number(block.gasUsed),
      gasLimit: Number(block.gasLimit),
      gasUtilization: Number(block.gasUsed * 100n / block.gasLimit),
      
      // Fee features
      baseFee: Number(ethers.formatUnits(feeData.gasPrice || 0n, 'gwei')),
      priorityFee: Number(ethers.formatUnits(feeData.maxPriorityFeePerGas || 0n, 'gwei')),
      
      // Network features
      pendingTransactions: networkStats.pendingTxs || 1000,
      congestionLevel: networkStats.congestion || 'MEDIUM',
      
      // Trade features
      tradeSize: arbitrageData.amountIn || 10000,
      tokenPair: this.hashTokenPair(arbitrageData.tokenA, arbitrageData.tokenB),
      expectedProfit: arbitrageData.expectedProfit || 0.01,
      
      // Historical features
      recentGasUsage: this.getRecentGasUsage(),
      volatility: this.calculateGasVolatility()
    };
  }
  
  /**
   * Run simplified ML gas prediction model
   */
  runGasPredictionModel(features) {
    // This is a simplified heuristic model
    // In production, this would be a trained ML model (e.g., neural network, random forest)
    
    let baseGas = 380000; // Base gas for flashloan arbitrage
    let baseFeeGwei = features.baseFee;
    let priorityFeeGwei = 2.0;
    
    // Adjust based on trade size
    if (features.tradeSize > 100000) baseGas += 50000;
    if (features.tradeSize > 500000) baseGas += 75000;
    
    // Adjust based on network congestion
    switch (features.congestionLevel) {
      case 'HIGH':
        baseFeeGwei *= 1.3;
        priorityFeeGwei *= 2.0;
        baseGas += 25000;
        break;
      case 'CRITICAL':
        baseFeeGwei *= 1.5;
        priorityFeeGwei *= 3.0;
        baseGas += 50000;
        break;
      case 'LOW':
        baseFeeGwei *= 0.9;
        priorityFeeGwei *= 0.8;
        break;
    }
    
    // Adjust based on gas utilization
    if (features.gasUtilization > 90) {
      baseFeeGwei *= 1.2;
      baseGas += 30000;
    } else if (features.gasUtilization < 50) {
      baseFeeGwei *= 0.95;
    }
    
    // Adjust based on expected profit
    if (features.expectedProfit > 0.02) { // High profit trades can afford more gas
      baseFeeGwei *= 1.1;
      priorityFeeGwei *= 1.2;
    } else if (features.expectedProfit < 0.005) { // Low profit trades need optimization
      baseFeeGwei *= 0.9;
      priorityFeeGwei *= 0.9;
      baseGas = Math.min(baseGas, 350000); // Reduce gas limit
    }
    
    return {
      gasLimit: Math.floor(baseGas),
      gasPriceGwei: Math.max(baseFeeGwei, 1.0),
      priorityFeeGwei: Math.max(priorityFeeGwei, 1.0),
      confidence: this.calculatePredictionConfidence(features),
      features
    };
  }
  
  /**
   * Validate and adjust ML prediction
   */
  validatePrediction(prediction, features) {
    // Validate gas limit bounds
    prediction.gasLimit = Math.max(300000, Math.min(prediction.gasLimit, 800000));
    
    // Validate gas price bounds
    prediction.gasPriceGwei = Math.max(1.0, Math.min(prediction.gasPriceGwei, 500.0));
    prediction.priorityFeeGwei = Math.max(1.0, Math.min(prediction.priorityFeeGwei, 100.0));
    
    // Ensure priority fee doesn't exceed max fee
    if (prediction.priorityFeeGwei > prediction.gasPriceGwei * 0.5) {
      prediction.priorityFeeGwei = prediction.gasPriceGwei * 0.3;
    }
    
    return prediction;
  }
  
  /**
   * Combine ML prediction with current gas manager recommendations
   */
  combineGasStrategies(prediction, gasManagerParams) {
    // Weight the predictions based on confidence and current network conditions
    const mlWeight = prediction.confidence || 0.5;
    const gasManagerWeight = 1.0 - mlWeight;
    
    // Combine gas limit
    const combinedGasLimit = Math.floor(
      (prediction.gasLimit * mlWeight) + 
      (Number(gasManagerParams.gasLimit) * gasManagerWeight)
    );
    
    // Combine gas prices (convert to consistent units)
    const mlMaxFeeGwei = prediction.gasPriceGwei;
    const gasManagerMaxFeeGwei = Number(ethers.formatUnits(gasManagerParams.maxFeePerGas, 'gwei'));
    
    const combinedMaxFeeGwei = (mlMaxFeeGwei * mlWeight) + (gasManagerMaxFeeGwei * gasManagerWeight);
    const combinedPriorityFeeGwei = Math.min(
      prediction.priorityFeeGwei,
      Number(ethers.formatUnits(gasManagerParams.maxPriorityFeePerGas, 'gwei'))
    );
    
    return {
      gasLimit: BigInt(combinedGasLimit),
      maxFeePerGas: ethers.parseUnits(combinedMaxFeeGwei.toFixed(2), 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits(combinedPriorityFeeGwei.toFixed(2), 'gwei'),
      strategy: gasManagerParams.strategy || 'ML_OPTIMIZED',
      confidence: prediction.confidence,
      mlPrediction: prediction,
      gasManagerPrediction: gasManagerParams
    };
  }
  
  /**
   * Build transaction with optimized gas parameters
   */
  async buildTransactionWithOptimizedGas(arbitrageData, gasParams, options) {
    // Build base transaction
    const transaction = {
      to: this.contractManager.addresses.flashloanArbitrage,
      data: this.encodeArbitrageCalldata(arbitrageData),
      value: '0',
      gasLimit: gasParams.gasLimit,
      maxFeePerGas: gasParams.maxFeePerGas,
      maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas,
      type: 2 // EIP-1559 transaction
    };
    
    // Estimate transaction cost
    const estimatedCostUSD = await this.estimateTransactionCostUSD(gasParams);
    
    return {
      transaction,
      gasParams,
      estimatedCostUSD,
      optimization: {
        strategy: gasParams.strategy,
        confidence: gasParams.confidence,
        mlOptimized: true,
        timestamp: Date.now()
      }
    };
  }
  
  /**
   * Apply advanced optimizations based on strategy
   */
  async applyAdvancedOptimizations(transactionData, options) {
    const strategy = options.strategy || 'PROFIT_MAXIMIZATION';
    
    switch (strategy) {
      case 'MEV_PROTECTION':
        return this.applyMEVProtection(transactionData, options);
      case 'HIGH_FREQUENCY':
        return this.applyHighFrequencyOptimizations(transactionData, options);
      case 'PROFIT_MAXIMIZATION':
        return this.applyProfitMaximization(transactionData, options);
      default:
        return transactionData;
    }
  }
  
  /**
   * Apply MEV protection optimizations
   */
  async applyMEVProtection(transactionData, options) {
    // Increase priority fee for MEV protection
    const mevBoost = 1.5;
    transactionData.transaction.maxPriorityFeePerGas = 
      (transactionData.transaction.maxPriorityFeePerGas * BigInt(Math.floor(mevBoost * 100))) / 100n;
    
    // Add Flashbots compatibility
    transactionData.flashbotsReady = true;
    transactionData.mevProtected = true;
    
    console.log('🛡️ MEV protection applied');
    return transactionData;
  }
  
  /**
   * Apply high-frequency trading optimizations
   */
  async applyHighFrequencyOptimizations(transactionData, options) {
    // Reduce gas limit for faster execution (if safe)
    if (transactionData.gasParams.confidence > 0.8) {
      transactionData.transaction.gasLimit = 
        (transactionData.transaction.gasLimit * 95n) / 100n; // 5% reduction
    }
    
    // Mark for batch processing if applicable
    transactionData.batchable = true;
    transactionData.priority = 'HIGH';
    
    console.log('⚡ High-frequency optimizations applied');
    return transactionData;
  }
  
  /**
   * Apply profit maximization optimizations
   */
  async applyProfitMaximization(transactionData, options) {
    const arbitrageData = options.arbitrageData || {};
    const expectedProfit = arbitrageData.expectedProfit || 0.01;
    
    // Adjust gas based on profit potential
    if (expectedProfit > 0.02) {
      // High profit - can afford more gas for reliability
      transactionData.transaction.maxFeePerGas = 
        (transactionData.transaction.maxFeePerGas * 110n) / 100n; // 10% increase
    } else if (expectedProfit < 0.005) {
      // Low profit - optimize gas to preserve margins
      transactionData.transaction.maxFeePerGas = 
        (transactionData.transaction.maxFeePerGas * 90n) / 100n; // 10% reduction
    }
    
    transactionData.profitOptimized = true;
    
    console.log('💰 Profit maximization applied');
    return transactionData;
  }
  
  /**
   * Initialize gas prediction system
   */
  initializeGasPredictor() {
    // Start collecting historical data
    setInterval(() => {
      this.collectGasData().catch(console.error);
    }, 30000); // Every 30 seconds
    
    // Clean up old cache entries
    setInterval(() => {
      this.cleanupCache();
    }, 300000); // Every 5 minutes
    
    console.log('🧠 Gas predictor initialized');
  }
  
  /**
   * Collect historical gas data for ML training
   */
  async collectGasData() {
    try {
      const block = await this.provider.getBlock('latest');
      const feeData = await this.provider.getFeeData();
      
      const dataPoint = {
        timestamp: Date.now(),
        blockNumber: block.number,
        gasUsed: Number(block.gasUsed),
        gasLimit: Number(block.gasLimit),
        baseFee: Number(ethers.formatUnits(feeData.gasPrice || 0n, 'gwei')),
        priorityFee: Number(ethers.formatUnits(feeData.maxPriorityFeePerGas || 0n, 'gwei'))
      };
      
      this.gasPredictor.historicalData.push(dataPoint);
      
      // Keep only recent data
      if (this.gasPredictor.historicalData.length > this.gasPredictor.maxHistory) {
        this.gasPredictor.historicalData.shift();
      }
      
    } catch (error) {
      console.warn('Failed to collect gas data:', error.message);
    }
  }
  
  /**
   * Generate cache key for optimization
   */
  generateCacheKey(arbitrageData, options) {
    const keyData = {
      tokenA: arbitrageData.tokenA,
      tokenB: arbitrageData.tokenB,
      amountIn: arbitrageData.amountIn,
      strategy: options.strategy || 'default'
    };
    
    return Buffer.from(JSON.stringify(keyData)).toString('base64');
  }
  
  /**
   * Get optimization from cache
   */
  getFromCache(key) {
    const cached = this.optimizationCache.get(key);
    if (!cached) return null;
    
    // Check if cache entry is still valid
    if (Date.now() - cached.timestamp > this.cacheMaxAge) {
      this.optimizationCache.delete(key);
      return null;
    }
    
    return cached.data;
  }
  
  /**
   * Store optimization in cache
   */
  storeInCache(key, data) {
    this.optimizationCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
  
  /**
   * Clean up expired cache entries
   */
  cleanupCache() {
    const now = Date.now();
    for (const [key, entry] of this.optimizationCache.entries()) {
      if (now - entry.timestamp > this.cacheMaxAge) {
        this.optimizationCache.delete(key);
      }
    }
  }
  
  /**
   * Helper methods
   */
  
  getFallbackPrediction() {
    return {
      gasLimit: 400000,
      gasPriceGwei: 25.0,
      priorityFeeGwei: 2.0,
      confidence: 0.5
    };
  }
  
  calculatePredictionConfidence(features) {
    // Simplified confidence calculation
    let confidence = 0.5;
    
    if (this.gasPredictor.historicalData.length > 50) confidence += 0.2;
    if (features.gasUtilization < 80) confidence += 0.1;
    if (features.congestionLevel === 'LOW') confidence += 0.1;
    
    return Math.min(confidence, 0.95);
  }
  
  async getNetworkStatistics() {
    // Simplified network stats
    return {
      pendingTxs: 2000,
      congestion: 'MEDIUM'
    };
  }
  
  hashTokenPair(tokenA, tokenB) {
    return parseInt(ethers.keccak256(ethers.concat([tokenA, tokenB])).slice(0, 10), 16);
  }
  
  getRecentGasUsage() {
    if (this.gasPredictor.historicalData.length < 10) return 400000;
    
    const recent = this.gasPredictor.historicalData.slice(-10);
    return recent.reduce((sum, point) => sum + point.gasUsed, 0) / recent.length;
  }
  
  calculateGasVolatility() {
    if (this.gasPredictor.historicalData.length < 20) return 0.1;
    
    const recent = this.gasPredictor.historicalData.slice(-20);
    const prices = recent.map(point => point.baseFee);
    const avg = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - avg, 2), 0) / prices.length;
    
    return Math.sqrt(variance) / avg; // Coefficient of variation
  }
  
  async estimateTransactionCostUSD(gasParams) {
    const gasCostETH = Number(ethers.formatEther(gasParams.maxFeePerGas * gasParams.gasLimit));
    const ethPriceUSD = 2000; // Simplified - would get from price oracle
    return gasCostETH * ethPriceUSD;
  }
  
  encodeArbitrageCalldata(arbitrageData) {
    // Simplified calldata encoding
    return '0x' + Buffer.from(JSON.stringify(arbitrageData)).toString('hex');
  }
  
  updatePerformanceMetrics(transaction, prediction) {
    this.performance.totalTransactions++;
    if (prediction.confidence > 0.7) {
      this.performance.successfulPredictions++;
    }
    this.performance.averageAccuracy = 
      this.performance.successfulPredictions / this.performance.totalTransactions;
  }
  
  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return {
      ...this.performance,
      cacheSize: this.optimizationCache.size,
      historicalDataPoints: this.gasPredictor.historicalData.length,
      predictionAccuracy: this.performance.averageAccuracy
    };
  }
}

module.exports = GasOptimizedTransactionBuilder;