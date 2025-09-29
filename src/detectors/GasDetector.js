import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import config from '../config/config.js';

/**
 * GasDetector - Gas price monitoring and optimization for arbitrage trades
 * Tracks gas prices, estimates costs, and provides optimal gas strategies
 */
class GasDetector extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      updateInterval: options.updateInterval || 3000, // 3 seconds
      maxGasPrice: options.maxGasPrice || 200, // 200 gwei max
      targetGasPrice: options.targetGasPrice || 50, // 50 gwei target
      gasOptimizationEnabled: options.gasOptimizationEnabled !== false,
      profitMarginThreshold: options.profitMarginThreshold || 0.002, // 0.2% minimum profit after gas
      ...options
    };
    
    // Gas tracking
    this.gasHistory = [];
    this.currentGasPrice = null;
    this.gasEstimates = new Map();
    this.lastUpdate = null;
    
    // Gas strategies
    this.strategies = {
      CONSERVATIVE: {
        name: 'Conservative',
        gasMultiplier: 1.1, // 10% above current
        maxGasPrice: this.options.targetGasPrice,
        priority: 'low'
      },
      BALANCED: {
        name: 'Balanced',
        gasMultiplier: 1.25, // 25% above current
        maxGasPrice: this.options.maxGasPrice * 0.7,
        priority: 'medium'
      },
      AGGRESSIVE: {
        name: 'Aggressive',
        gasMultiplier: 1.5, // 50% above current
        maxGasPrice: this.options.maxGasPrice,
        priority: 'high'
      },
      RAPID: {
        name: 'Rapid',
        gasMultiplier: 2.0, // 100% above current
        maxGasPrice: this.options.maxGasPrice * 1.5,
        priority: 'urgent'
      }
    };
    
    // Transaction gas estimates
    this.transactionTypes = {
      SIMPLE_SWAP: { gasLimit: 150000, complexity: 'low' },
      FLASHLOAN_ARBITRAGE: { gasLimit: 350000, complexity: 'medium' },
      COMPLEX_ARBITRAGE: { gasLimit: 500000, complexity: 'high' },
      MEV_BUNDLE: { gasLimit: 750000, complexity: 'very_high' }
    };
    
    // Performance metrics
    this.metrics = {
      totalEstimations: 0,
      accurateEstimations: 0,
      averageGasPrice: 0,
      gasPrice24hLow: null,
      gasPrice24hHigh: null,
      lastOptimizationTime: null,
      optimizationsSaved: 0
    };
    
    this.isActive = false;
    this.updateTimer = null;
  }
  
  /**
   * Initialize the gas detector
   */
  async initialize(web3Provider) {
    try {
      this.web3Provider = web3Provider;
      
      if (!this.web3Provider || !this.web3Provider.isConnected()) {
        throw new Error('Web3 provider not connected');
      }
      
      console.log('⛽ Initializing Gas Detector...');
      console.log(`   Update interval: ${this.options.updateInterval}ms`);
      console.log(`   Max gas price: ${this.options.maxGasPrice} gwei`);
      console.log(`   Target gas price: ${this.options.targetGasPrice} gwei`);
      console.log(`   Optimization: ${this.options.gasOptimizationEnabled ? 'enabled' : 'disabled'}`);
      
      // Initial gas price fetch
      await this.updateGasPrice();
      
      this.isActive = true;
      this.startTime = Date.now();
      this.emit('initialized');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Gas Detector:', error.message);
      throw error;
    }
  }
  
  /**
   * Start gas monitoring
   */
  startMonitoring() {
    if (!this.isActive) {
      throw new Error('Gas detector not initialized');
    }
    
    console.log('⛽ Starting gas price monitoring...');
    
    // Start update timer
    this.updateTimer = setInterval(() => {
      this.updateGasPrice();
    }, this.options.updateInterval);
    
    this.emit('monitoringStarted');
  }
  
  /**
   * Stop gas monitoring
   */
  stopMonitoring() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    
    console.log('⛽ Gas monitoring stopped');
    this.emit('monitoringStopped');
  }
  
  /**
   * Update current gas price
   */
  async updateGasPrice() {
    try {
      const feeData = await this.web3Provider.getProvider().getFeeData();
      const currentTime = Date.now();
      
      const gasData = {
        gasPrice: feeData.gasPrice ? Number(ethers.formatUnits(feeData.gasPrice, 'gwei')) : null,
        maxFeePerGas: feeData.maxFeePerGas ? Number(ethers.formatUnits(feeData.maxFeePerGas, 'gwei')) : null,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? Number(ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei')) : null,
        timestamp: currentTime,
        blockNumber: await this.web3Provider.getBlockNumber()
      };
      
      // Use maxFeePerGas for EIP-1559 or gasPrice for legacy
      this.currentGasPrice = gasData.maxFeePerGas || gasData.gasPrice;
      this.lastUpdate = currentTime;
      
      // Store history (keep last 1000 entries)
      this.gasHistory.push(gasData);
      if (this.gasHistory.length > 1000) {
        this.gasHistory.shift();
      }
      
      // Update metrics
      this.updateMetrics();
      
      // Check for gas price alerts
      this.checkGasAlerts(gasData);
      
      this.emit('gasPriceUpdated', gasData);
      
    } catch (error) {
      console.warn('⚠️ Failed to update gas price:', error.message);
    }
  }
  
  /**
   * Update performance metrics
   */
  updateMetrics() {
    if (this.gasHistory.length === 0) return;
    
    const gasPrices = this.gasHistory.map(g => g.maxFeePerGas || g.gasPrice).filter(Boolean);
    
    if (gasPrices.length > 0) {
      this.metrics.averageGasPrice = gasPrices.reduce((sum, price) => sum + price, 0) / gasPrices.length;
      this.metrics.gasPrice24hLow = Math.min(...gasPrices);
      this.metrics.gasPrice24hHigh = Math.max(...gasPrices);
    }
  }
  
  /**
   * Check for gas price alerts
   */
  checkGasAlerts(gasData) {
    const currentPrice = gasData.maxFeePerGas || gasData.gasPrice;
    
    if (currentPrice > this.options.maxGasPrice) {
      this.emit('highGasAlert', {
        currentPrice,
        maxPrice: this.options.maxGasPrice,
        severity: currentPrice > this.options.maxGasPrice * 1.5 ? 'critical' : 'warning'
      });
    }
    
    if (currentPrice <= this.options.targetGasPrice) {
      this.emit('lowGasAlert', {
        currentPrice,
        targetPrice: this.options.targetGasPrice,
        opportunity: 'good_time_to_trade'
      });
    }
  }
  
  /**
   * Estimate gas cost for a transaction
   */
  async estimateGasCost(transactionType, tradeAmount = 0, customGasLimit = null) {
    if (!this.currentGasPrice) {
      await this.updateGasPrice();
    }
    
    const txConfig = this.transactionTypes[transactionType] || this.transactionTypes.SIMPLE_SWAP;
    const gasLimit = customGasLimit || txConfig.gasLimit;
    
    // Apply complexity multiplier based on trade amount
    let complexityMultiplier = 1.0;
    if (tradeAmount > 100000) complexityMultiplier = 1.3; // Large trades
    else if (tradeAmount > 50000) complexityMultiplier = 1.15; // Medium trades
    
    const adjustedGasLimit = Math.ceil(gasLimit * complexityMultiplier);
    const gasCostWei = BigInt(adjustedGasLimit) * BigInt(Math.ceil((this.currentGasPrice || 50) * 1e9));
    const gasCostETH = Number(ethers.formatEther(gasCostWei));
    
    // Estimate USD cost (assuming ETH price from config or estimation)
    const ethPriceUSD = 2000; // Simplified - in production, get from price feeds
    const gasCostUSD = gasCostETH * ethPriceUSD;
    
    const estimate = {
      transactionType,
      gasLimit: adjustedGasLimit,
      gasPrice: this.currentGasPrice,
      gasCostWei: gasCostWei.toString(),
      gasCostETH,
      gasCostUSD,
      complexityMultiplier,
      timestamp: Date.now()
    };
    
    this.metrics.totalEstimations++;
    
    // Cache estimate
    const cacheKey = `${transactionType}_${tradeAmount}_${this.currentGasPrice}`;
    this.gasEstimates.set(cacheKey, estimate);
    
    return estimate;
  }
  
  /**
   * Get optimal gas strategy for a trade
   */
  getOptimalGasStrategy(opportunity) {
    if (!this.currentGasPrice || !opportunity) {
      return this.strategies.BALANCED;
    }
    
    const profitMargin = opportunity.profitPercentage || 0;
    const tradeAmount = opportunity.tradeAmount || 0;
    const urgency = opportunity.urgency || 'medium';
    
    // Calculate gas cost impact on profit
    const estimatedGasCost = this.estimateGasCostSync(opportunity.type || 'SIMPLE_SWAP', tradeAmount);
    const gasCostPercentage = estimatedGasCost.gasCostUSD / tradeAmount;
    
    // Strategy selection logic
    let selectedStrategy;
    
    if (profitMargin > 0.05) { // High profit (>5%)
      selectedStrategy = urgency === 'high' ? this.strategies.RAPID : this.strategies.AGGRESSIVE;
    } else if (profitMargin > 0.02) { // Medium profit (2-5%)
      selectedStrategy = this.strategies.BALANCED;
    } else if (profitMargin > this.options.profitMarginThreshold) { // Low profit
      selectedStrategy = this.strategies.CONSERVATIVE;
    } else {
      // Profit too low after gas costs
      return {
        approved: false,
        reason: 'Insufficient profit margin after gas costs',
        gasCostPercentage,
        requiredMargin: this.options.profitMarginThreshold
      };
    }
    
    // Apply gas optimization if enabled
    if (this.options.gasOptimizationEnabled) {
      selectedStrategy = this.optimizeGasStrategy(selectedStrategy, opportunity);
      this.metrics.optimizationsSaved++;
      this.metrics.lastOptimizationTime = Date.now();
    }
    
    return {
      approved: true,
      strategy: selectedStrategy,
      estimatedGasCost,
      gasCostPercentage,
      recommendation: this.getGasRecommendation(selectedStrategy, opportunity)
    };
  }
  
  /**
   * Synchronous gas cost estimation for quick calculations
   */
  estimateGasCostSync(transactionType, tradeAmount = 0) {
    const txConfig = this.transactionTypes[transactionType] || this.transactionTypes.SIMPLE_SWAP;
    const gasPrice = this.currentGasPrice || 50; // Default fallback
    
    let complexityMultiplier = 1.0;
    if (tradeAmount > 100000) complexityMultiplier = 1.3;
    else if (tradeAmount > 50000) complexityMultiplier = 1.15;
    
    const adjustedGasLimit = Math.ceil(txConfig.gasLimit * complexityMultiplier);
    const gasCostWei = BigInt(adjustedGasLimit) * BigInt(Math.ceil(gasPrice * 1e9));
    const gasCostETH = Number(ethers.formatEther(gasCostWei));
    const gasCostUSD = gasCostETH * 2000; // Simplified ETH price
    
    return {
      gasLimit: adjustedGasLimit,
      gasPrice,
      gasCostETH,
      gasCostUSD
    };
  }
  
  /**
   * Optimize gas strategy based on current conditions
   */
  optimizeGasStrategy(baseStrategy, opportunity) {
    const currentGas = this.currentGasPrice;
    const recentHistory = this.gasHistory.slice(-10); // Last 10 updates
    
    if (recentHistory.length < 3) {
      return baseStrategy; // Not enough data
    }
    
    // Calculate gas price trend
    const prices = recentHistory.map(h => h.maxFeePerGas || h.gasPrice).filter(Boolean);
    const trend = this.calculateTrend(prices);
    
    const optimizedStrategy = { ...baseStrategy };
    
    if (trend < -0.1) { // Gas price dropping rapidly
      optimizedStrategy.gasMultiplier *= 0.9; // Reduce gas multiplier
      optimizedStrategy.name += ' (Optimized Down)';
    } else if (trend > 0.1) { // Gas price rising rapidly
      optimizedStrategy.gasMultiplier *= 1.1; // Increase gas multiplier
      optimizedStrategy.name += ' (Optimized Up)';
    }
    
    // Network congestion adjustment
    const networkCongestion = this.estimateNetworkCongestion();
    if (networkCongestion > 0.8) { // High congestion
      optimizedStrategy.gasMultiplier *= 1.2;
      optimizedStrategy.name += ' (Congestion Adjusted)';
    }
    
    return optimizedStrategy;
  }
  
  /**
   * Calculate price trend from recent data
   */
  calculateTrend(prices) {
    if (prices.length < 2) return 0;
    
    const first = prices[0];
    const last = prices[prices.length - 1];
    
    return (last - first) / first;
  }
  
  /**
   * Estimate network congestion level
   */
  estimateNetworkCongestion() {
    // Simplified congestion estimation based on gas price volatility
    if (this.gasHistory.length < 10) return 0.5; // Default medium
    
    const recentPrices = this.gasHistory.slice(-10).map(h => h.maxFeePerGas || h.gasPrice).filter(Boolean);
    const avg = recentPrices.reduce((sum, price) => sum + price, 0) / recentPrices.length;
    const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - avg, 2), 0) / recentPrices.length;
    const volatility = Math.sqrt(variance) / avg;
    
    return Math.min(volatility * 5, 1.0); // Normalize to 0-1 scale
  }
  
  /**
   * Get gas recommendation for UI/logging
   */
  getGasRecommendation(strategy, opportunity) {
    const currentGas = this.currentGasPrice || 50;
    const recommendedGas = Math.min(currentGas * strategy.gasMultiplier, strategy.maxGasPrice);
    
    return {
      currentGasPrice: currentGas,
      recommendedGasPrice: Math.ceil(recommendedGas),
      strategy: strategy.name,
      priority: strategy.priority,
      waitTime: this.estimateWaitTime(recommendedGas),
      confidenceLevel: this.calculateConfidence(recommendedGas, opportunity)
    };
  }
  
  /**
   * Estimate transaction wait time based on gas price
   */
  estimateWaitTime(gasPrice) {
    const currentGas = this.currentGasPrice || 50;
    const relativePrice = gasPrice / currentGas;
    
    if (relativePrice >= 2.0) return '< 1 block (~15s)';
    if (relativePrice >= 1.5) return '1-2 blocks (~30s)';
    if (relativePrice >= 1.2) return '2-3 blocks (~45s)';
    if (relativePrice >= 1.0) return '3-5 blocks (~1m)';
    if (relativePrice >= 0.8) return '5-10 blocks (~2m)';
    return '10+ blocks (>3m)';
  }
  
  /**
   * Calculate confidence level for gas price
   */
  calculateConfidence(gasPrice, opportunity) {
    let confidence = 0.7; // Base confidence
    
    // Adjust based on recent data availability
    if (this.gasHistory.length > 50) confidence += 0.2;
    else if (this.gasHistory.length > 20) confidence += 0.1;
    
    // Adjust based on gas price reasonableness
    const currentGas = this.currentGasPrice || 50;
    const ratio = gasPrice / currentGas;
    
    if (ratio >= 0.8 && ratio <= 2.0) confidence += 0.1; // Reasonable range
    if (ratio > 3.0 || ratio < 0.5) confidence -= 0.3; // Extreme values
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }
  
  /**
   * Get current gas status
   */
  getGasStatus() {
    return {
      currentGasPrice: this.currentGasPrice,
      lastUpdate: this.lastUpdate,
      networkCongestion: this.estimateNetworkCongestion(),
      recommendation: this.currentGasPrice <= this.options.targetGasPrice ? 'good_time' : 
                     this.currentGasPrice >= this.options.maxGasPrice ? 'wait' : 'normal',
      strategies: this.strategies
    };
  }
  
  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      currentGasPrice: this.currentGasPrice,
      historySize: this.gasHistory.length,
      uptime: this.isActive ? Date.now() - (this.startTime || Date.now()) : 0,
      estimationAccuracy: this.metrics.totalEstimations > 0 ? 
        (this.metrics.accurateEstimations / this.metrics.totalEstimations) * 100 : 0
    };
  }
  
  /**
   * Shutdown the detector
   */
  shutdown() {
    this.stopMonitoring();
    this.isActive = false;
    this.gasHistory = [];
    this.gasEstimates.clear();
    
    console.log('⛽ Gas Detector shutdown complete');
    this.emit('shutdown');
  }
}

export default GasDetector;