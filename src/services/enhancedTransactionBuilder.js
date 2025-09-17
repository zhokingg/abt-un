const { ethers } = require('ethers');
const EventEmitter = require('events');
const config = require('../config/config');
const TransactionBuilder = require('./transactionBuilder');

/**
 * Enhanced Transaction Builder with Flashloan Support
 * Extends the existing TransactionBuilder with flashloan-specific functionality
 */
class EnhancedTransactionBuilder extends TransactionBuilder {
  constructor(web3Provider, flashloanService, contractManager) {
    super(web3Provider);
    
    this.flashloanService = flashloanService;
    this.contractManager = contractManager;
    
    // Enhanced gas strategies for flashloan transactions
    this.flashloanGasStrategies = {
      CONSERVATIVE: { multiplier: 1.3, priority: 'medium', buffer: 25 },
      STANDARD: { multiplier: 1.5, priority: 'high', buffer: 20 },
      AGGRESSIVE: { multiplier: 1.8, priority: 'urgent', buffer: 15 },
      ULTRA: { multiplier: 2.2, priority: 'ultra', buffer: 10 }
    };
    
    // MEV protection settings
    this.mevProtection = {
      enabled: true,
      maxPriorityFeeGwei: 50, // Maximum priority fee in gwei
      maxBaseFeeMultiplier: 2.0, // Maximum base fee multiplier
      flashbotsEnabled: false // Future: Flashbots integration
    };
    
    // Flashloan-specific transaction tracking
    this.flashloanTransactions = new Map();
  }
  
  /**
   * Build flashloan arbitrage transaction with enhanced gas optimization
   */
  async buildFlashloanArbitrageTransaction(arbitrageData, options = {}) {
    try {
      console.log('🔧 Building flashloan arbitrage transaction...');
      
      // Validate inputs
      this.validateArbitrageData(arbitrageData);
      
      // Get optimal gas strategy
      const gasStrategy = await this.getOptimalFlashloanGasStrategy(arbitrageData, options);
      
      // Estimate gas with enhanced accuracy
      const gasEstimate = await this.estimateFlashloanGas(arbitrageData);
      
      // Calculate optimal gas parameters
      const gasParams = await this.calculateOptimalGasParams(gasEstimate, gasStrategy);
      
      // Build transaction data
      const transactionData = {
        to: this.contractManager.addresses.flashloanArbitrage,
        data: this.encodeArbitrageCalldata(arbitrageData),
        value: '0',
        ...gasParams
      };
      
      // Add MEV protection if enabled
      if (this.mevProtection.enabled) {
        transactionData.maxPriorityFeePerGas = this.calculateMEVProtectedPriorityFee(gasParams.maxPriorityFeePerGas);
      }
      
      // Validate transaction before returning
      await this.validateFlashloanTransaction(transactionData, arbitrageData);
      
      console.log('✅ Flashloan arbitrage transaction built successfully');
      console.log(`📊 Gas parameters: limit=${gasParams.gasLimit}, maxFee=${ethers.formatUnits(gasParams.maxFeePerGas, 'gwei')}gwei`);
      
      return {
        transaction: transactionData,
        gasStrategy: gasStrategy.name,
        estimatedCost: await this.estimateTransactionCost(transactionData),
        mevProtected: this.mevProtection.enabled
      };
      
    } catch (error) {
      console.error('❌ Failed to build flashloan arbitrage transaction:', error.message);
      throw error;
    }
  }
  
  /**
   * Get optimal gas strategy for flashloan transactions
   */
  async getOptimalFlashloanGasStrategy(arbitrageData, options = {}) {
    try {
      // Get network congestion level
      const congestionLevel = await this.getNetworkCongestionLevel();
      
      // Calculate expected profit
      const profitCheck = await this.contractManager.checkProfitability(arbitrageData, await this.provider.getGasPrice());
      
      // Determine optimal strategy based on profit margin and congestion
      let strategyName = 'STANDARD';
      
      if (profitCheck.isProfitable) {
        const profitMargin = parseFloat(profitCheck.profitPercentage) / 100;
        
        if (profitMargin > 2.0 && congestionLevel === 'LOW') {
          strategyName = 'CONSERVATIVE';
        } else if (profitMargin > 1.0 && congestionLevel === 'MEDIUM') {
          strategyName = 'STANDARD';
        } else if (profitMargin > 0.5 && congestionLevel === 'HIGH') {
          strategyName = 'AGGRESSIVE';
        } else if (profitMargin > 0.2) {
          strategyName = 'ULTRA';
        }
      }
      
      // Override with user preference if provided
      if (options.gasStrategy && this.flashloanGasStrategies[options.gasStrategy]) {
        strategyName = options.gasStrategy;
      }
      
      const strategy = this.flashloanGasStrategies[strategyName];
      
      console.log(`⛽ Selected flashloan gas strategy: ${strategyName} (multiplier: ${strategy.multiplier}x)`);
      
      return {
        name: strategyName,
        ...strategy
      };
      
    } catch (error) {
      console.warn('⚠️ Error selecting gas strategy, using default:', error.message);
      return {
        name: 'STANDARD',
        ...this.flashloanGasStrategies.STANDARD
      };
    }
  }
  
  /**
   * Enhanced gas estimation for flashloan transactions
   */
  async estimateFlashloanGas(arbitrageData) {
    try {
      let gasEstimate = 500000; // Default fallback
      
      if (this.contractManager.contracts.flashloanArbitrage) {
        // Try to get accurate estimate from contract
        const contractEstimate = await this.contractManager.estimateArbitrageGas(arbitrageData);
        if (contractEstimate.estimated) {
          gasEstimate = parseInt(contractEstimate.gasLimit);
        }
      }
      
      // Add complexity-based adjustments
      const complexityFactor = this.calculateTransactionComplexity(arbitrageData);
      gasEstimate = Math.floor(gasEstimate * complexityFactor);
      
      console.log(`📏 Estimated gas for flashloan arbitrage: ${gasEstimate}`);
      
      return gasEstimate;
      
    } catch (error) {
      console.warn('⚠️ Gas estimation failed, using conservative estimate:', error.message);
      return 600000; // Conservative fallback
    }
  }
  
  /**
   * Calculate transaction complexity factor
   */
  calculateTransactionComplexity(arbitrageData) {
    let complexity = 1.0;
    
    // Base complexity for flashloan
    complexity += 0.2;
    
    // Add complexity for V3 pools (higher gas usage)
    if (arbitrageData.feeA > 0) complexity += 0.1;
    if (arbitrageData.feeB > 0) complexity += 0.1;
    
    // Add complexity for large amounts (more validation)
    const amountUSD = parseFloat(arbitrageData.amountIn) / 1e6; // Assuming USDC-like decimals
    if (amountUSD > 10000) complexity += 0.05;
    if (amountUSD > 100000) complexity += 0.1;
    
    return Math.min(complexity, 1.5); // Cap at 50% increase
  }
  
  /**
   * Calculate MEV-protected priority fee
   */
  calculateMEVProtectedPriorityFee(basePriorityFee) {
    const maxPriorityFeeWei = ethers.parseUnits(this.mevProtection.maxPriorityFeeGwei.toString(), 'gwei');
    
    // Increase priority fee to compete with MEV bots, but cap it
    const protectedFee = (BigInt(basePriorityFee) * BigInt(120)) / BigInt(100); // 20% increase
    
    return protectedFee > maxPriorityFeeWei ? maxPriorityFeeWei : protectedFee;
  }
  
  /**
   * Enhanced transaction sending with flashloan-specific monitoring
   */
  async sendFlashloanTransaction(transaction, arbitrageData, options = {}) {
    try {
      console.log('📤 Sending flashloan arbitrage transaction...');
      
      // Pre-execution validation
      await this.preExecutionValidation(arbitrageData);
      
      // Send transaction with enhanced monitoring
      const txResponse = await this.sendTransactionWithRetry(transaction, options);
      
      // Track flashloan transaction
      this.flashloanTransactions.set(txResponse.hash, {
        arbitrageData,
        timestamp: Date.now(),
        status: 'pending',
        gasUsed: null,
        profit: null
      });
      
      console.log(`📤 Flashloan transaction sent: ${txResponse.hash}`);
      
      // Start monitoring
      this.monitorFlashloanTransaction(txResponse.hash, arbitrageData);
      
      return txResponse;
      
    } catch (error) {
      console.error('❌ Failed to send flashloan transaction:', error.message);
      throw error;
    }
  }
  
  /**
   * Pre-execution validation for flashloan arbitrage
   */
  async preExecutionValidation(arbitrageData) {
    // Check if contracts are not in emergency stop
    const emergencyStopped = await this.contractManager.isEmergencyStopped();
    if (emergencyStopped) {
      throw new Error('Contracts are in emergency stop mode');
    }
    
    // Validate flashloan availability
    const availability = await this.flashloanService.getFlashloanAvailability(
      arbitrageData.tokenA,
      arbitrageData.amountIn
    );
    
    if (availability.length === 0 || !availability[0].available) {
      throw new Error('Insufficient flashloan liquidity available');
    }
    
    // Final profitability check
    const profitCheck = await this.contractManager.checkProfitability(
      arbitrageData,
      await this.provider.getGasPrice()
    );
    
    if (!profitCheck.isProfitable) {
      throw new Error('Arbitrage is no longer profitable');
    }
    
    console.log('✅ Pre-execution validation passed');
  }
  
  /**
   * Monitor flashloan transaction execution
   */
  async monitorFlashloanTransaction(txHash, arbitrageData) {
    try {
      console.log(`🔍 Monitoring flashloan transaction: ${txHash}`);
      
      const receipt = await this.provider.waitForTransaction(txHash);
      
      // Update tracking
      const trackingData = this.flashloanTransactions.get(txHash);
      if (trackingData) {
        trackingData.status = receipt.status === 1 ? 'success' : 'failed';
        trackingData.gasUsed = receipt.gasUsed.toString();
        
        if (receipt.status === 1) {
          // Parse profit from logs if successful
          const results = await this.contractManager.parseArbitrageResults(receipt);
          trackingData.profit = results.profit;
        }
      }
      
      // Emit events
      this.emit('flashloanTransactionComplete', {
        txHash,
        success: receipt.status === 1,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber,
        arbitrageData
      });
      
      console.log(`${receipt.status === 1 ? '✅' : '❌'} Flashloan transaction ${receipt.status === 1 ? 'succeeded' : 'failed'}: ${txHash}`);
      
      return receipt;
      
    } catch (error) {
      console.error('❌ Error monitoring flashloan transaction:', error.message);
      
      // Update tracking with error
      const trackingData = this.flashloanTransactions.get(txHash);
      if (trackingData) {
        trackingData.status = 'error';
        trackingData.error = error.message;
      }
      
      throw error;
    }
  }
  
  /**
   * Get network congestion level
   */
  async getNetworkCongestionLevel() {
    try {
      const gasPrice = await this.provider.getGasPrice();
      const gasPriceGwei = parseFloat(ethers.formatUnits(gasPrice, 'gwei'));
      
      if (gasPriceGwei < 20) return 'LOW';
      if (gasPriceGwei < 50) return 'MEDIUM';
      if (gasPriceGwei < 100) return 'HIGH';
      return 'EXTREME';
      
    } catch (error) {
      console.warn('⚠️ Error getting network congestion:', error.message);
      return 'MEDIUM';
    }
  }
  
  /**
   * Validate arbitrage data structure
   */
  validateArbitrageData(arbitrageData) {
    const required = ['tokenA', 'tokenB', 'amountIn', 'routerA', 'routerB', 'deadline'];
    
    for (const field of required) {
      if (!arbitrageData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    if (BigInt(arbitrageData.amountIn) <= 0) {
      throw new Error('Invalid amount');
    }
    
    if (arbitrageData.deadline <= Math.floor(Date.now() / 1000)) {
      throw new Error('Deadline has passed');
    }
    
    console.log('✅ Arbitrage data validated');
  }
  
  /**
   * Encode arbitrage calldata
   */
  encodeArbitrageCalldata(arbitrageData) {
    const flashloanArbitrageInterface = new ethers.Interface(this.contractManager.abis.flashloanArbitrage);
    
    return flashloanArbitrageInterface.encodeFunctionData('executeArbitrage', [arbitrageData]);
  }
  
  /**
   * Validate flashloan transaction before sending
   */
  async validateFlashloanTransaction(transactionData, arbitrageData) {
    // Check gas parameters are reasonable
    if (BigInt(transactionData.gasLimit) > BigInt(1000000)) {
      console.warn('⚠️ Very high gas limit detected:', transactionData.gasLimit);
    }
    
    // Check gas price is not excessive
    const gasPriceGwei = parseFloat(ethers.formatUnits(transactionData.maxFeePerGas, 'gwei'));
    if (gasPriceGwei > 200) {
      console.warn('⚠️ Very high gas price detected:', gasPriceGwei, 'gwei');
    }
    
    // Validate wallet has sufficient ETH for gas
    const balance = await this.provider.getBalance(this.wallet.address);
    const estimatedCost = BigInt(transactionData.gasLimit) * BigInt(transactionData.maxFeePerGas);
    
    if (balance < estimatedCost) {
      throw new Error('Insufficient ETH balance for gas fees');
    }
    
    console.log('✅ Flashloan transaction validated');
  }
  
  /**
   * Get flashloan transaction statistics
   */
  getFlashloanTransactionStats() {
    const transactions = Array.from(this.flashloanTransactions.values());
    
    return {
      total: transactions.length,
      successful: transactions.filter(tx => tx.status === 'success').length,
      failed: transactions.filter(tx => tx.status === 'failed').length,
      pending: transactions.filter(tx => tx.status === 'pending').length,
      totalProfit: transactions
        .filter(tx => tx.profit)
        .reduce((sum, tx) => sum + parseFloat(tx.profit), 0),
      averageGasUsed: transactions
        .filter(tx => tx.gasUsed)
        .reduce((sum, tx, _, arr) => sum + parseInt(tx.gasUsed) / arr.length, 0)
    };
  }
  
  /**
   * Clear old transaction history
   */
  clearOldTransactionHistory(olderThanHours = 24) {
    const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
    
    for (const [txHash, data] of this.flashloanTransactions.entries()) {
      if (data.timestamp < cutoffTime) {
        this.flashloanTransactions.delete(txHash);
      }
    }
    
    console.log(`🧹 Cleared old transaction history (older than ${olderThanHours}h)`);
  }
}

module.exports = EnhancedTransactionBuilder;