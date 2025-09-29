import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import config from '../config/config.js';

/**
 * GasOptimizer - Dynamic gas pricing strategies for optimal transaction execution
 * Provides intelligent gas optimization beyond the existing gasOptimizationEngine
 */
class GasOptimizer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      updateInterval: options.updateInterval || 2000, // 2 seconds
      maxGasPrice: options.maxGasPrice || 300, // 300 gwei max
      targetConfirmationTime: options.targetConfirmationTime || 30, // 30 seconds
      aggressiveThreshold: options.aggressiveThreshold || 0.05, // 5% profit threshold for aggressive gas
      enableMLPrediction: options.enableMLPrediction !== false,
      enableBatchOptimization: options.enableBatchOptimization !== false,
      ...options
    };
    
    // Gas strategies with dynamic pricing
    this.strategies = {
      ECONOMY: {
        name: 'Economy',
        description: 'Lowest cost, slower confirmation',
        priority: 1,
        targetConfirmation: 300, // 5 minutes
        gasMultiplier: 0.8,
        maxGasPrice: 50
      },
      STANDARD: {
        name: 'Standard',
        description: 'Balanced cost and speed',
        priority: 2,
        targetConfirmation: 60, // 1 minute
        gasMultiplier: 1.0,
        maxGasPrice: 100
      },
      FAST: {
        name: 'Fast',
        description: 'Higher cost, faster confirmation',
        priority: 3,
        targetConfirmation: 30, // 30 seconds
        gasMultiplier: 1.2,
        maxGasPrice: 150
      },
      URGENT: {
        name: 'Urgent',
        description: 'Highest cost, immediate confirmation',
        priority: 4,
        targetConfirmation: 15, // 15 seconds
        gasMultiplier: 1.5,
        maxGasPrice: this.options.maxGasPrice
      },
      ADAPTIVE: {
        name: 'Adaptive',
        description: 'AI-driven dynamic pricing',
        priority: 5,
        targetConfirmation: this.options.targetConfirmationTime,
        gasMultiplier: 1.0, // Will be dynamically adjusted
        maxGasPrice: this.options.maxGasPrice
      }
    };
    
    // Gas data tracking
    this.gasHistory = [];
    this.confirmationTimes = [];
    this.networkMetrics = {
      congestion: 0.5, // 0-1 scale
      volatility: 0.3,
      averageBlockTime: 13.5,
      pendingTransactions: 0
    };
    
    // ML-like prediction model (simplified)
    this.predictionModel = {
      weights: {
        congestion: 0.4,
        volatility: 0.3,
        timeOfDay: 0.2,
        dayOfWeek: 0.1
      },
      learningRate: 0.01,
      accuracy: 0.7
    };
    
    // Batch optimization
    this.pendingBatch = [];
    this.batchTimer = null;
    
    // Performance metrics
    this.metrics = {
      totalOptimizations: 0,
      gasOptimizationsSaved: 0,
      averageGasSavings: 0,
      confirmationAccuracy: 0,
      mlPredictionAccuracy: 0,
      batchOptimizations: 0,
      lastOptimizationTime: null
    };
    
    this.isActive = false;
    this.updateTimer = null;
  }
  
  /**
   * Initialize the gas optimizer
   */
  async initialize(web3Provider, gasDetector = null) {
    try {
      this.web3Provider = web3Provider;
      this.gasDetector = gasDetector;
      
      if (!this.web3Provider || !this.web3Provider.isConnected()) {
        throw new Error('Web3 provider not connected');
      }
      
      console.log('⚡ Initializing Gas Optimizer...');
      console.log(`   Update interval: ${this.options.updateInterval}ms`);
      console.log(`   Target confirmation: ${this.options.targetConfirmationTime}s`);
      console.log(`   ML prediction: ${this.options.enableMLPrediction ? 'enabled' : 'disabled'}`);
      console.log(`   Batch optimization: ${this.options.enableBatchOptimization ? 'enabled' : 'disabled'}`);
      
      // Initialize with current gas data
      await this.updateNetworkMetrics();
      
      this.isActive = true;
      this.startTime = Date.now();
      this.emit('initialized');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Gas Optimizer:', error.message);
      throw error;
    }
  }
  
  /**
   * Start gas optimization monitoring
   */
  startOptimization() {
    if (!this.isActive) {
      throw new Error('Gas optimizer not initialized');
    }
    
    console.log('⚡ Starting gas optimization...');
    
    // Start network metrics updates
    this.updateTimer = setInterval(() => {
      this.updateNetworkMetrics();
    }, this.options.updateInterval);
    
    // Initialize batch optimization if enabled
    if (this.options.enableBatchOptimization) {
      this.initializeBatchOptimization();
    }
    
    this.emit('optimizationStarted');
  }
  
  /**
   * Stop gas optimization
   */
  stopOptimization() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
    
    console.log('⚡ Gas optimization stopped');
    this.emit('optimizationStopped');
  }
  
  /**
   * Update network metrics for optimization
   */
  async updateNetworkMetrics() {
    try {
      const feeData = await this.web3Provider.getProvider().getFeeData();
      const blockNumber = await this.web3Provider.getBlockNumber();
      const currentTime = Date.now();
      
      // Get current gas prices
      const gasPrice = feeData.maxFeePerGas || feeData.gasPrice;
      const currentGasGwei = gasPrice ? Number(ethers.formatUnits(gasPrice, 'gwei')) : 50;
      
      // Store gas history
      this.gasHistory.push({
        gasPrice: currentGasGwei,
        blockNumber,
        timestamp: currentTime
      });
      
      // Keep only last 100 entries
      if (this.gasHistory.length > 100) {
        this.gasHistory.shift();
      }
      
      // Calculate network congestion
      this.networkMetrics.congestion = this.calculateCongestion();
      this.networkMetrics.volatility = this.calculateVolatility();
      this.networkMetrics.averageBlockTime = this.calculateAverageBlockTime();
      
      // Update ML model if enabled
      if (this.options.enableMLPrediction) {
        this.updateMLModel();
      }
      
      this.emit('metricsUpdated', this.networkMetrics);
      
    } catch (error) {
      console.warn('⚠️ Failed to update network metrics:', error.message);
    }
  }
  
  /**
   * Calculate network congestion level
   */
  calculateCongestion() {
    if (this.gasHistory.length < 10) return 0.5;
    
    const recentPrices = this.gasHistory.slice(-10).map(h => h.gasPrice);
    const average = recentPrices.reduce((sum, price) => sum + price, 0) / recentPrices.length;
    
    // Normalize based on typical gas price ranges
    const normalizedCongestion = Math.min(average / 100, 2.0); // 100 gwei = moderate congestion
    return Math.max(0, Math.min(1, normalizedCongestion - 0.3)); // Adjust baseline
  }
  
  /**
   * Calculate gas price volatility
   */
  calculateVolatility() {
    if (this.gasHistory.length < 5) return 0.3;
    
    const recentPrices = this.gasHistory.slice(-20).map(h => h.gasPrice);
    const average = recentPrices.reduce((sum, price) => sum + price, 0) / recentPrices.length;
    const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - average, 2), 0) / recentPrices.length;
    
    return Math.min(Math.sqrt(variance) / average, 1.0);
  }
  
  /**
   * Calculate average block time
   */
  calculateAverageBlockTime() {
    if (this.gasHistory.length < 5) return 13.5;
    
    const recentBlocks = this.gasHistory.slice(-10);
    const timeDiffs = [];
    
    for (let i = 1; i < recentBlocks.length; i++) {
      const timeDiff = (recentBlocks[i].timestamp - recentBlocks[i-1].timestamp) / 1000;
      if (timeDiff > 0 && timeDiff < 60) { // Reasonable block time range
        timeDiffs.push(timeDiff);
      }
    }
    
    return timeDiffs.length > 0 ? timeDiffs.reduce((sum, time) => sum + time, 0) / timeDiffs.length : 13.5;
  }
  
  /**
   * Optimize gas price for a transaction
   */
  async optimizeGasPrice(transaction, strategy = 'ADAPTIVE', priority = 'medium') {
    this.metrics.totalOptimizations++;
    const startTime = Date.now();
    
    try {
      console.log(`⚡ Optimizing gas for ${strategy} strategy...`);
      
      // Get base gas price
      const feeData = await this.web3Provider.getProvider().getFeeData();
      const baseGasPrice = feeData.maxFeePerGas || feeData.gasPrice;
      const baseGwei = baseGasPrice ? Number(ethers.formatUnits(baseGasPrice, 'gwei')) : 50;
      
      let optimizedGasPrice;
      
      if (strategy === 'ADAPTIVE' && this.options.enableMLPrediction) {
        optimizedGasPrice = this.predictOptimalGasPrice(transaction, priority);
      } else {
        optimizedGasPrice = this.calculateStrategyGasPrice(baseGwei, strategy);
      }
      
      // Apply constraints
      optimizedGasPrice = Math.max(baseGwei * 0.8, optimizedGasPrice); // Don't go too low
      optimizedGasPrice = Math.min(this.options.maxGasPrice, optimizedGasPrice); // Respect max limit
      
      // Calculate optimization metrics
      const gasSaved = baseGwei - optimizedGasPrice;
      const savingsPercentage = (gasSaved / baseGwei) * 100;
      
      // Update metrics
      if (gasSaved > 0) {
        this.metrics.gasOptimizationsSaved++;
        this.metrics.averageGasSavings = (this.metrics.averageGasSavings + savingsPercentage) / 2;
      }
      
      this.metrics.lastOptimizationTime = Date.now();
      
      const result = {
        success: true,
        originalGasPrice: baseGwei,
        optimizedGasPrice: Math.ceil(optimizedGasPrice),
        gasSaved,
        savingsPercentage,
        strategy,
        estimatedConfirmationTime: this.estimateConfirmationTime(optimizedGasPrice),
        confidence: this.calculateOptimizationConfidence(optimizedGasPrice, strategy),
        optimizationTime: Date.now() - startTime,
        networkMetrics: { ...this.networkMetrics }
      };
      
      console.log(`✅ Gas optimized: ${baseGwei.toFixed(1)} → ${optimizedGasPrice.toFixed(1)} gwei (${savingsPercentage.toFixed(1)}% ${gasSaved > 0 ? 'saved' : 'increased'})`);
      
      this.emit('gasOptimized', result);
      return result;
      
    } catch (error) {
      console.error('❌ Gas optimization failed:', error.message);
      return {
        success: false,
        error: error.message,
        fallbackGasPrice: 50 // Safe fallback
      };
    }
  }
  
  /**
   * Calculate gas price using strategy
   */
  calculateStrategyGasPrice(baseGwei, strategy) {
    const strategyConfig = this.strategies[strategy];
    if (!strategyConfig) {
      return baseGwei;
    }
    
    let multiplier = strategyConfig.gasMultiplier;
    
    // Adjust multiplier based on network conditions
    if (this.networkMetrics.congestion > 0.8) {
      multiplier *= 1.2; // Increase for high congestion
    } else if (this.networkMetrics.congestion < 0.3) {
      multiplier *= 0.9; // Decrease for low congestion
    }
    
    if (this.networkMetrics.volatility > 0.6) {
      multiplier *= 1.1; // Increase for high volatility
    }
    
    const calculatedPrice = baseGwei * multiplier;
    return Math.min(calculatedPrice, strategyConfig.maxGasPrice);
  }
  
  /**
   * Predict optimal gas price using ML-like approach
   */
  predictOptimalGasPrice(transaction, priority) {
    if (this.gasHistory.length < 10) {
      return this.calculateStrategyGasPrice(50, 'STANDARD');
    }
    
    const features = this.extractFeatures(transaction, priority);
    const prediction = this.runPredictionModel(features);
    
    // Update ML accuracy tracking
    this.updateMLAccuracy(prediction);
    
    return prediction;
  }
  
  /**
   * Extract features for ML prediction
   */
  extractFeatures(transaction, priority) {
    const currentTime = new Date();
    const hourOfDay = currentTime.getHours();
    const dayOfWeek = currentTime.getDay();
    
    return {
      congestion: this.networkMetrics.congestion,
      volatility: this.networkMetrics.volatility,
      timeOfDay: hourOfDay / 24, // Normalize to 0-1
      dayOfWeek: dayOfWeek / 7, // Normalize to 0-1
      priorityScore: this.getPriorityScore(priority),
      transactionComplexity: this.getTransactionComplexity(transaction),
      recentGasPrice: this.gasHistory.length > 0 ? this.gasHistory[this.gasHistory.length - 1].gasPrice : 50
    };
  }
  
  /**
   * Run simplified prediction model
   */
  runPredictionModel(features) {
    const weights = this.predictionModel.weights;
    
    let prediction = features.recentGasPrice;
    
    // Apply weighted features
    prediction *= (1 + features.congestion * weights.congestion);
    prediction *= (1 + features.volatility * weights.volatility);
    prediction *= (1 + Math.sin(features.timeOfDay * 2 * Math.PI) * 0.1 * weights.timeOfDay);
    prediction *= (1 + (features.dayOfWeek > 0.7 ? -0.1 : 0.1) * weights.dayOfWeek); // Weekend adjustment
    
    // Apply priority and complexity adjustments
    prediction *= (1 + features.priorityScore * 0.2);
    prediction *= (1 + features.transactionComplexity * 0.1);
    
    return Math.max(10, Math.min(this.options.maxGasPrice, prediction));
  }
  
  /**
   * Get priority score for ML model
   */
  getPriorityScore(priority) {
    const scores = {
      'low': 0.2,
      'medium': 0.5,
      'high': 0.8,
      'urgent': 1.0
    };
    return scores[priority] || 0.5;
  }
  
  /**
   * Get transaction complexity score
   */
  getTransactionComplexity(transaction) {
    if (!transaction) return 0.5;
    
    let complexity = 0.3; // Base complexity
    
    if (transaction.gasLimit && transaction.gasLimit > 200000) complexity += 0.3;
    if (transaction.data && transaction.data.length > 1000) complexity += 0.2;
    if (transaction.value && Number(transaction.value) > 0) complexity += 0.2;
    
    return Math.min(1.0, complexity);
  }
  
  /**
   * Estimate confirmation time for gas price
   */
  estimateConfirmationTime(gasPrice) {
    // Simplified estimation based on network conditions
    const baseTime = this.networkMetrics.averageBlockTime;
    const congestionMultiplier = 1 + this.networkMetrics.congestion * 2;
    
    // Current gas price influence
    const recentGasPrice = this.gasHistory.length > 0 ? this.gasHistory[this.gasHistory.length - 1].gasPrice : 50;
    const gasPriceRatio = gasPrice / recentGasPrice;
    
    let estimatedBlocks;
    if (gasPriceRatio >= 1.5) estimatedBlocks = 1;
    else if (gasPriceRatio >= 1.2) estimatedBlocks = 2;
    else if (gasPriceRatio >= 1.0) estimatedBlocks = 3;
    else if (gasPriceRatio >= 0.8) estimatedBlocks = 5;
    else estimatedBlocks = 10;
    
    return Math.ceil(estimatedBlocks * baseTime * congestionMultiplier);
  }
  
  /**
   * Calculate optimization confidence
   */
  calculateOptimizationConfidence(gasPrice, strategy) {
    let confidence = 0.7; // Base confidence
    
    // Adjust based on data availability
    if (this.gasHistory.length > 50) confidence += 0.2;
    else if (this.gasHistory.length > 20) confidence += 0.1;
    
    // Adjust based on network stability
    if (this.networkMetrics.volatility < 0.3) confidence += 0.1;
    else if (this.networkMetrics.volatility > 0.7) confidence -= 0.2;
    
    // Adjust based on strategy
    if (strategy === 'ADAPTIVE' && this.options.enableMLPrediction) {
      confidence += this.predictionModel.accuracy * 0.2;
    }
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }
  
  /**
   * Initialize batch optimization
   */
  initializeBatchOptimization() {
    console.log('⚡ Initializing batch optimization...');
    
    this.batchTimer = setInterval(() => {
      if (this.pendingBatch.length > 0) {
        this.processBatch();
      }
    }, 5000); // Process batches every 5 seconds
  }
  
  /**
   * Add transaction to batch for optimization
   */
  addToBatch(transaction, callback) {
    if (!this.options.enableBatchOptimization) {
      return this.optimizeGasPrice(transaction);
    }
    
    this.pendingBatch.push({
      transaction,
      callback,
      timestamp: Date.now()
    });
    
    // Process immediately if batch is full
    if (this.pendingBatch.length >= 10) {
      this.processBatch();
    }
  }
  
  /**
   * Process batch of transactions for optimization
   */
  async processBatch() {
    if (this.pendingBatch.length === 0) return;
    
    console.log(`⚡ Processing batch of ${this.pendingBatch.length} transactions...`);
    
    const batch = [...this.pendingBatch];
    this.pendingBatch = [];
    
    try {
      // Analyze batch for optimization opportunities
      const batchOptimization = await this.optimizeBatch(batch);
      
      // Apply optimizations to each transaction
      for (let i = 0; i < batch.length; i++) {
        const item = batch[i];
        const optimization = batchOptimization.optimizations[i];
        
        if (item.callback) {
          item.callback(optimization);
        }
      }
      
      this.metrics.batchOptimizations++;
      this.emit('batchProcessed', { size: batch.length, savings: batchOptimization.totalSavings });
      
    } catch (error) {
      console.error('❌ Batch processing failed:', error.message);
      
      // Fallback: process individually
      for (const item of batch) {
        if (item.callback) {
          const fallback = await this.optimizeGasPrice(item.transaction);
          item.callback(fallback);
        }
      }
    }
  }
  
  /**
   * Optimize a batch of transactions
   */
  async optimizeBatch(batch) {
    const optimizations = [];
    let totalSavings = 0;
    
    // Group similar transactions
    const groups = this.groupSimilarTransactions(batch);
    
    for (const group of groups) {
      const groupOptimization = await this.optimizeTransactionGroup(group);
      optimizations.push(...groupOptimization.optimizations);
      totalSavings += groupOptimization.savings;
    }
    
    return { optimizations, totalSavings };
  }
  
  /**
   * Group similar transactions for batch optimization
   */
  groupSimilarTransactions(batch) {
    const groups = [];
    const processed = new Set();
    
    for (let i = 0; i < batch.length; i++) {
      if (processed.has(i)) continue;
      
      const group = [batch[i]];
      processed.add(i);
      
      // Find similar transactions
      for (let j = i + 1; j < batch.length; j++) {
        if (processed.has(j)) continue;
        
        if (this.areTransactionsSimilar(batch[i].transaction, batch[j].transaction)) {
          group.push(batch[j]);
          processed.add(j);
        }
      }
      
      groups.push(group);
    }
    
    return groups;
  }
  
  /**
   * Check if two transactions are similar for batching
   */
  areTransactionsSimilar(tx1, tx2) {
    if (!tx1 || !tx2) return false;
    
    // Similar gas limits
    const gasLimit1 = tx1.gasLimit || 21000;
    const gasLimit2 = tx2.gasLimit || 21000;
    const gasRatio = Math.max(gasLimit1, gasLimit2) / Math.min(gasLimit1, gasLimit2);
    
    if (gasRatio > 1.5) return false;
    
    // Similar data patterns (simplified)
    const data1 = tx1.data || '0x';
    const data2 = tx2.data || '0x';
    
    if (data1.length !== data2.length) return false;
    if (data1.slice(0, 10) !== data2.slice(0, 10)) return false; // Same method signature
    
    return true;
  }
  
  /**
   * Optimize a group of similar transactions
   */
  async optimizeTransactionGroup(group) {
    const optimizations = [];
    let totalSavings = 0;
    
    // Calculate optimal gas price for the group
    const representative = group[0].transaction;
    const groupOptimization = await this.optimizeGasPrice(representative, 'ADAPTIVE', 'medium');
    
    // Apply same optimization to all transactions in group
    for (const item of group) {
      const optimization = {
        ...groupOptimization,
        batchOptimized: true,
        groupSize: group.length
      };
      
      optimizations.push(optimization);
      totalSavings += optimization.gasSaved || 0;
    }
    
    return { optimizations, savings: totalSavings };
  }
  
  /**
   * Update ML model accuracy tracking
   */
  updateMLAccuracy(prediction) {
    // Simplified accuracy tracking
    // In production, this would compare predictions with actual confirmation times
    
    if (this.gasHistory.length > 5) {
      const recentActual = this.gasHistory[this.gasHistory.length - 1].gasPrice;
      const error = Math.abs(prediction - recentActual) / recentActual;
      const accuracy = Math.max(0, 1 - error);
      
      this.predictionModel.accuracy = (this.predictionModel.accuracy + accuracy) / 2;
      this.metrics.mlPredictionAccuracy = this.predictionModel.accuracy;
    }
  }
  
  /**
   * Update ML model weights (simplified online learning)
   */
  updateMLModel() {
    // Simplified model update
    // In production, this would use proper ML algorithms
    
    if (this.gasHistory.length < 20) return;
    
    const recentData = this.gasHistory.slice(-10);
    const gasTrend = this.calculateGasTrend(recentData);
    
    // Adjust weights based on recent performance
    if (gasTrend > 0.1) { // Gas prices rising
      this.predictionModel.weights.congestion *= 1.01;
      this.predictionModel.weights.volatility *= 1.01;
    } else if (gasTrend < -0.1) { // Gas prices falling
      this.predictionModel.weights.congestion *= 0.99;
      this.predictionModel.weights.volatility *= 0.99;
    }
    
    // Normalize weights
    const totalWeight = Object.values(this.predictionModel.weights).reduce((sum, w) => sum + w, 0);
    for (const key in this.predictionModel.weights) {
      this.predictionModel.weights[key] /= totalWeight;
    }
  }
  
  /**
   * Calculate gas price trend
   */
  calculateGasTrend(data) {
    if (data.length < 2) return 0;
    
    const first = data[0].gasPrice;
    const last = data[data.length - 1].gasPrice;
    
    return (last - first) / first;
  }
  
  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      networkMetrics: { ...this.networkMetrics },
      predictionAccuracy: this.predictionModel.accuracy,
      batchSize: this.pendingBatch.length,
      uptime: this.isActive ? Date.now() - (this.startTime || Date.now()) : 0
    };
  }
  
  /**
   * Get current strategies
   */
  getStrategies() {
    return { ...this.strategies };
  }
  
  /**
   * Shutdown the optimizer
   */
  shutdown() {
    this.stopOptimization();
    this.isActive = false;
    this.gasHistory = [];
    this.confirmationTimes = [];
    this.pendingBatch = [];
    
    console.log('⚡ Gas Optimizer shutdown complete');
    this.emit('shutdown');
  }
}

export default GasOptimizer;