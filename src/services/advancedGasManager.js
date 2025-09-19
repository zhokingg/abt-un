const { ethers } = require('ethers');
const EventEmitter = require('events');
const config = require('../config/config');

/**
 * Advanced Gas Manager with Dynamic Pricing and Network Analysis
 * Provides intelligent gas optimization strategies for MEV arbitrage
 */
class AdvancedGasManager extends EventEmitter {
  constructor(web3Provider) {
    super();
    this.web3Provider = web3Provider;
    this.provider = web3Provider?.provider;
    
    // Network congestion tracking
    this.networkStats = {
      avgBlockTime: 12000, // 12 seconds
      pendingTransactions: 0,
      baseFee: 0n,
      priorityFee: 0n,
      congestionLevel: 'LOW' // LOW, MEDIUM, HIGH, CRITICAL
    };
    
    // Gas pool management
    this.gasPool = {
      reserveETH: 0n,
      minReserve: ethers.parseEther('0.1'), // 0.1 ETH minimum
      targetReserve: ethers.parseEther('0.5'), // 0.5 ETH target
      autoReplenish: true
    };
    
    // Dynamic gas strategies
    this.gasStrategies = {
      CONSERVATIVE: {
        baseFeeMultiplier: 1.1,
        priorityFeeGwei: 1.5,
        maxFeeCapGwei: 50,
        profitThreshold: 0.5 // 0.5% minimum profit
      },
      STANDARD: {
        baseFeeMultiplier: 1.25,
        priorityFeeGwei: 2.5,
        maxFeeCapGwei: 75,
        profitThreshold: 0.3
      },
      AGGRESSIVE: {
        baseFeeMultiplier: 1.5,
        priorityFeeGwei: 5.0,
        maxFeeCapGwei: 150,
        profitThreshold: 0.2
      },
      ULTRA: {
        baseFeeMultiplier: 2.0,
        priorityFeeGwei: 10.0,
        maxFeeCapGwei: 300,
        profitThreshold: 0.15
      }
    };
    
    // ML-based gas prediction (simplified)
    this.gasPredictor = {
      historicalData: [],
      maxHistory: 100,
      predictionAccuracy: 0.85,
      enabled: true
    };
    
    // Performance metrics
    this.metrics = {
      totalTransactions: 0,
      successfulTransactions: 0,
      totalGasSaved: 0n,
      averageGasPrice: 0n,
      profitProtectionEvents: 0
    };
    
    // Start monitoring
    this.startNetworkMonitoring();
  }
  
  /**
   * Get optimal gas parameters for arbitrage transaction
   */
  async getOptimalGasParams(arbitrageData, options = {}) {
    try {
      console.log('🧮 Calculating optimal gas parameters...');
      
      // Update network conditions
      await this.updateNetworkConditions();
      
      // Analyze profit potential
      const profitAnalysis = await this.analyzeProfitPotential(arbitrageData);
      
      // Select optimal strategy
      const strategy = this.selectOptimalStrategy(profitAnalysis, options);
      
      // Calculate gas parameters
      const gasParams = await this.calculateGasParameters(strategy, profitAnalysis);
      
      // Apply profit protection
      const protectedParams = this.applyProfitProtection(gasParams, profitAnalysis);
      
      console.log(`✅ Optimal gas strategy: ${strategy.name}`);
      console.log(`💰 Expected profit: $${profitAnalysis.expectedProfitUSD.toFixed(2)}`);
      console.log(`⛽ Gas price: ${ethers.formatUnits(protectedParams.maxFeePerGas, 'gwei')} gwei`);
      
      return {
        ...protectedParams,
        strategy: strategy.name,
        congestionLevel: this.networkStats.congestionLevel,
        profitProtected: true,
        estimatedCost: await this.estimateTransactionCost(protectedParams)
      };
      
    } catch (error) {
      console.error('❌ Failed to calculate optimal gas parameters:', error.message);
      return this.getFallbackGasParams();
    }
  }
  
  /**
   * Update network congestion conditions
   */
  async updateNetworkConditions() {
    try {
      // Get latest block and fee data
      const [block, feeData] = await Promise.all([
        this.provider.getBlock('latest'),
        this.provider.getFeeData()
      ]);
      
      // Update network stats
      this.networkStats.baseFee = feeData.gasPrice || 0n;
      this.networkStats.priorityFee = feeData.maxPriorityFeePerGas || 0n;
      
      // Estimate pending transactions (simplified)
      this.networkStats.pendingTransactions = await this.estimatePendingTransactions();
      
      // Calculate congestion level
      this.networkStats.congestionLevel = this.calculateCongestionLevel(block, feeData);
      
      // Update gas pool status
      await this.updateGasPoolStatus();
      
    } catch (error) {
      console.warn('⚠️ Failed to update network conditions:', error.message);
    }
  }
  
  /**
   * Analyze profit potential for gas optimization
   */
  async analyzeProfitPotential(arbitrageData) {
    const tradeAmountUSD = arbitrageData.amountIn || 10000; // Default $10k
    const expectedPriceImpact = arbitrageData.priceImpact || 0.001; // 0.1%
    
    // Calculate expected profit
    const grossProfitUSD = tradeAmountUSD * expectedPriceImpact;
    
    // Estimate transaction costs
    const currentGasPrice = this.networkStats.baseFee;
    const estimatedGas = arbitrageData.gasEstimate || 400000n;
    const gasCostETH = (currentGasPrice * estimatedGas) / 1e18;
    const gasCostUSD = Number(gasCostETH) * 2000; // Assume $2000 ETH
    
    // Calculate net profit
    const flashloanFee = tradeAmountUSD * 0.0009; // 0.09% Aave fee
    const netProfitUSD = grossProfitUSD - gasCostUSD - flashloanFee;
    
    return {
      tradeAmountUSD,
      grossProfitUSD,
      gasCostUSD,
      flashloanFee,
      netProfitUSD,
      expectedProfitUSD: Math.max(0, netProfitUSD),
      profitMargin: netProfitUSD / tradeAmountUSD,
      riskLevel: this.assessRiskLevel(netProfitUSD, tradeAmountUSD)
    };
  }
  
  /**
   * Select optimal gas strategy based on conditions
   */
  selectOptimalStrategy(profitAnalysis, options = {}) {
    // Force strategy if specified
    if (options.forceStrategy && this.gasStrategies[options.forceStrategy]) {
      return {
        name: options.forceStrategy,
        ...this.gasStrategies[options.forceStrategy]
      };
    }
    
    // Select based on profit margin and network conditions
    const profitMargin = Math.abs(profitAnalysis.profitMargin);
    const congestionLevel = this.networkStats.congestionLevel;
    
    let strategyName = 'STANDARD';
    
    if (profitMargin > 0.02) { // > 2% profit margin
      strategyName = congestionLevel === 'HIGH' ? 'AGGRESSIVE' : 'STANDARD';
    } else if (profitMargin > 0.01) { // > 1% profit margin
      strategyName = congestionLevel === 'CRITICAL' ? 'AGGRESSIVE' : 'STANDARD';
    } else if (profitMargin > 0.005) { // > 0.5% profit margin
      strategyName = 'CONSERVATIVE';
    } else {
      // Very low profit margin - be conservative
      strategyName = 'CONSERVATIVE';
    }
    
    // Upgrade strategy for high-value trades
    if (profitAnalysis.tradeAmountUSD > 100000 && strategyName === 'CONSERVATIVE') {
      strategyName = 'STANDARD';
    }
    
    return {
      name: strategyName,
      ...this.gasStrategies[strategyName]
    };
  }
  
  /**
   * Calculate gas parameters using selected strategy
   */
  async calculateGasParameters(strategy, profitAnalysis) {
    const baseFee = this.networkStats.baseFee;
    const priorityFeeGwei = strategy.priorityFeeGwei;
    
    // Calculate max fee per gas
    const baseFeeNumber = Number(baseFee);
    const maxBaseFee = BigInt(Math.floor(baseFeeNumber * strategy.baseFeeMultiplier));
    const priorityFee = ethers.parseUnits(priorityFeeGwei.toString(), 'gwei');
    const maxFeePerGas = maxBaseFee + priorityFee;
    
    // Apply fee cap
    const feeCapWei = ethers.parseUnits(strategy.maxFeeCapGwei.toString(), 'gwei');
    const cappedMaxFee = maxFeePerGas > feeCapWei ? feeCapWei : maxFeePerGas;
    
    // Estimate gas limit with buffer
    const baseGasEstimate = 400000n; // Base estimate for flashloan arbitrage
    const complexityMultiplier = this.calculateComplexityMultiplier(profitAnalysis);
    const gasLimit = (baseGasEstimate * BigInt(Math.floor(complexityMultiplier * 100))) / 100n;
    
    return {
      gasLimit,
      maxFeePerGas: cappedMaxFee,
      maxPriorityFeePerGas: priorityFee,
      gasPrice: cappedMaxFee // For legacy transactions
    };
  }
  
  /**
   * Apply profit protection to gas parameters
   */
  applyProfitProtection(gasParams, profitAnalysis) {
    const maxGasCostUSD = profitAnalysis.expectedProfitUSD * 0.3; // Max 30% of profit on gas
    const maxGasCostETH = maxGasCostUSD / 2000; // Assume $2000 ETH
    const maxGasCostWei = ethers.parseEther(maxGasCostETH.toString());
    
    // Calculate current gas cost
    const currentGasCost = gasParams.maxFeePerGas * gasParams.gasLimit;
    
    if (currentGasCost > maxGasCostWei) {
      // Reduce gas price to protect profit
      const protectedMaxFee = maxGasCostWei / gasParams.gasLimit;
      
      console.log('🛡️ Applying profit protection - reducing gas fees');
      this.metrics.profitProtectionEvents++;
      
      return {
        ...gasParams,
        maxFeePerGas: protectedMaxFee,
        maxPriorityFeePerGas: protectedMaxFee / 2n, // Reduce priority fee proportionally
        profitProtected: true
      };
    }
    
    return { ...gasParams, profitProtected: false };
  }
  
  /**
   * Start network monitoring for dynamic adjustments
   */
  startNetworkMonitoring() {
    // Update network conditions every 30 seconds
    setInterval(() => {
      this.updateNetworkConditions().catch(console.error);
    }, 30000);
    
    // Update gas pool every 5 minutes
    setInterval(() => {
      this.manageGasPool().catch(console.error);
    }, 300000);
    
    console.log('📡 Network monitoring started');
  }
  
  /**
   * Estimate pending transactions (simplified)
   */
  async estimatePendingTransactions() {
    try {
      // This is a simplified estimation
      // In production, you'd query mempool data from specialized services
      const latestBlock = await this.provider.getBlock('latest');
      const gasUsed = latestBlock.gasUsed;
      const gasLimit = latestBlock.gasLimit;
      
      // Estimate congestion based on block utilization
      const utilization = Number(gasUsed * 100n / gasLimit);
      
      if (utilization > 95) return 10000; // High congestion
      if (utilization > 80) return 5000;  // Medium congestion
      if (utilization > 60) return 2000;  // Low congestion
      return 500; // Very low congestion
      
    } catch (error) {
      return 1000; // Default estimate
    }
  }
  
  /**
   * Calculate network congestion level
   */
  calculateCongestionLevel(block, feeData) {
    const baseFeeGwei = Number(ethers.formatUnits(feeData.gasPrice || 0n, 'gwei'));
    const gasUtilization = Number(block.gasUsed * 100n / block.gasLimit);
    
    if (baseFeeGwei > 100 || gasUtilization > 95) return 'CRITICAL';
    if (baseFeeGwei > 50 || gasUtilization > 85) return 'HIGH';
    if (baseFeeGwei > 20 || gasUtilization > 70) return 'MEDIUM';
    return 'LOW';
  }
  
  /**
   * Calculate transaction complexity multiplier
   */
  calculateComplexityMultiplier(profitAnalysis) {
    let multiplier = 1.0;
    
    // Higher complexity for larger trades
    if (profitAnalysis.tradeAmountUSD > 100000) multiplier += 0.1;
    if (profitAnalysis.tradeAmountUSD > 500000) multiplier += 0.1;
    
    // Higher complexity for low-margin trades (need more precision)
    if (profitAnalysis.profitMargin < 0.005) multiplier += 0.15;
    
    // Network congestion adds complexity
    switch (this.networkStats.congestionLevel) {
      case 'HIGH': multiplier += 0.1; break;
      case 'CRITICAL': multiplier += 0.2; break;
    }
    
    return Math.min(multiplier, 1.5); // Cap at 50% increase
  }
  
  /**
   * Assess risk level for trade
   */
  assessRiskLevel(netProfitUSD, tradeAmountUSD) {
    const profitMargin = netProfitUSD / tradeAmountUSD;
    
    if (profitMargin < 0.001) return 'CRITICAL'; // < 0.1% margin
    if (profitMargin < 0.005) return 'HIGH';     // < 0.5% margin
    if (profitMargin < 0.01) return 'MEDIUM';    // < 1% margin
    return 'LOW';
  }
  
  /**
   * Get fallback gas parameters if optimization fails
   */
  getFallbackGasParams() {
    return {
      gasLimit: 500000n,
      maxFeePerGas: ethers.parseUnits('50', 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
      gasPrice: ethers.parseUnits('50', 'gwei'),
      strategy: 'FALLBACK',
      congestionLevel: 'UNKNOWN',
      profitProtected: false
    };
  }
  
  /**
   * Estimate transaction cost in USD
   */
  async estimateTransactionCost(gasParams) {
    const gasCostETH = Number(ethers.formatEther(gasParams.maxFeePerGas * gasParams.gasLimit));
    const ethPriceUSD = 2000; // Simplified - would get from price oracle
    return gasCostETH * ethPriceUSD;
  }
  
  /**
   * Update gas pool status
   */
  async updateGasPoolStatus() {
    try {
      if (this.web3Provider.wallet) {
        const balance = await this.provider.getBalance(this.web3Provider.wallet.address);
        this.gasPool.reserveETH = balance;
        
        // Auto-replenish if enabled and below minimum
        if (this.gasPool.autoReplenish && balance < this.gasPool.minReserve) {
          console.log('⚠️ Gas pool below minimum reserve, replenishment needed');
          this.emit('gasPoolLow', { current: balance, minimum: this.gasPool.minReserve });
        }
      }
    } catch (error) {
      console.warn('Failed to update gas pool status:', error.message);
    }
  }
  
  /**
   * Manage gas pool optimization
   */
  async manageGasPool() {
    // This would implement automated gas pool management
    // For now, just emit status
    this.emit('gasPoolStatus', {
      reserve: this.gasPool.reserveETH,
      target: this.gasPool.targetReserve,
      utilizationPercent: Number(this.gasPool.reserveETH * 100n / this.gasPool.targetReserve)
    });
  }
  
  /**
   * Get gas manager statistics
   */
  getStats() {
    return {
      networkStats: this.networkStats,
      gasPool: {
        ...this.gasPool,
        reserveETH: ethers.formatEther(this.gasPool.reserveETH),
        minReserve: ethers.formatEther(this.gasPool.minReserve),
        targetReserve: ethers.formatEther(this.gasPool.targetReserve)
      },
      metrics: {
        ...this.metrics,
        totalGasSaved: ethers.formatEther(this.metrics.totalGasSaved),
        averageGasPrice: ethers.formatUnits(this.metrics.averageGasPrice, 'gwei')
      }
    };
  }
}

module.exports = AdvancedGasManager;