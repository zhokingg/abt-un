import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import config from '../config/config.js';

/**
 * FlashLoanProvider - Flash loan provider abstractions for arbitrage
 * Supports multiple flash loan providers (Aave, dYdX, Uniswap V3, etc.)
 */
class FlashLoanProvider extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      preferredProvider: options.preferredProvider || 'aave',
      maxLoanAmount: options.maxLoanAmount || 1000000, // $1M max
      minLoanAmount: options.minLoanAmount || 1000, // $1k min
      gasBuffer: options.gasBuffer || 50000, // Extra gas for execution
      ...options
    };
    
    // Flash loan providers
    this.providers = {
      aave: {
        name: 'Aave V3',
        poolAddress: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
        fee: 0.0009, // 0.09%
        maxLoan: 1000000,
        gasLimit: 300000,
        enabled: true
      },
      dydx: {
        name: 'dYdX',
        soloMarginAddress: '0x1E0447b19BB6EcFdAe1e4AE1694b0C3659614e4e',
        fee: 0.0002, // 0.02%
        maxLoan: 500000,
        gasLimit: 250000,
        enabled: true
      },
      uniswapv3: {
        name: 'Uniswap V3',
        factoryAddress: config.UNISWAP_V3_FACTORY,
        fee: 0, // No fee, but must pay back within same transaction
        maxLoan: 10000000,
        gasLimit: 350000,
        enabled: true
      }
    };
    
    this.metrics = {
      totalLoans: 0,
      successfulLoans: 0,
      totalVolume: 0,
      averageLoanSize: 0,
      providerUsage: {},
      lastLoanTime: null
    };
    
    this.isInitialized = false;
  }
  
  async initialize(web3Provider) {
    try {
      this.web3Provider = web3Provider;
      
      console.log('⚡ Initializing Flash Loan Provider...');
      console.log(`   Preferred provider: ${this.options.preferredProvider}`);
      console.log(`   Loan range: $${this.options.minLoanAmount.toLocaleString()} - $${this.options.maxLoanAmount.toLocaleString()}`);
      
      // Initialize provider usage metrics
      for (const providerId of Object.keys(this.providers)) {
        this.metrics.providerUsage[providerId] = { count: 0, volume: 0 };
      }
      
      this.isInitialized = true;
      this.emit('initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Flash Loan Provider:', error.message);
      throw error;
    }
  }
  
  async getOptimalProvider(asset, amount) {
    const enabledProviders = Object.entries(this.providers)
      .filter(([_, provider]) => provider.enabled && amount <= provider.maxLoan);
    
    if (enabledProviders.length === 0) {
      throw new Error('No suitable flash loan provider found');
    }
    
    // Score providers based on fee, max loan, and reliability
    const scoredProviders = enabledProviders.map(([id, provider]) => ({
      id,
      provider,
      score: this.calculateProviderScore(provider, amount)
    }));
    
    // Sort by score (higher is better)
    scoredProviders.sort((a, b) => b.score - a.score);
    
    return {
      providerId: scoredProviders[0].id,
      provider: scoredProviders[0].provider,
      alternatives: scoredProviders.slice(1)
    };
  }
  
  calculateProviderScore(provider, amount) {
    let score = 100;
    
    // Lower fees = higher score
    score -= provider.fee * 10000; // Convert to basis points
    
    // Higher max loan = higher score
    score += Math.min(provider.maxLoan / 100000, 10);
    
    // Usage success rate (simplified)
    const usage = this.metrics.providerUsage[provider.name] || { count: 0, volume: 0 };
    if (usage.count > 0) {
      score += 5; // Bonus for tested providers
    }
    
    return score;
  }
  
  async estimateFlashLoanCost(asset, amount, providerId = null) {
    const optimal = providerId ? 
      { providerId, provider: this.providers[providerId] } :
      await this.getOptimalProvider(asset, amount);
    
    const provider = optimal.provider;
    const loanFee = amount * provider.fee;
    const gasCost = await this.estimateGasCost(provider.gasLimit);
    
    return {
      providerId: optimal.providerId,
      providerName: provider.name,
      loanAmount: amount,
      loanFee,
      gasCost: gasCost.costUSD,
      totalCost: loanFee + gasCost.costUSD,
      costPercentage: ((loanFee + gasCost.costUSD) / amount) * 100,
      gasLimit: provider.gasLimit,
      gasPrice: gasCost.gasPrice
    };
  }
  
  async estimateGasCost(gasLimit) {
    try {
      const feeData = await this.web3Provider.getProvider().getFeeData();
      const gasPrice = feeData.maxFeePerGas || feeData.gasPrice;
      const gasCostWei = BigInt(gasLimit) * gasPrice;
      const gasCostETH = Number(ethers.formatEther(gasCostWei));
      const gasCostUSD = gasCostETH * 2000; // Simplified ETH price
      
      return {
        gasLimit,
        gasPrice: Number(ethers.formatUnits(gasPrice, 'gwei')),
        costETH: gasCostETH,
        costUSD: gasCostUSD
      };
    } catch (error) {
      return { gasLimit, gasPrice: 50, costETH: 0.01, costUSD: 20 };
    }
  }
  
  async executeFlashLoan(asset, amount, callback, providerId = null) {
    if (!this.isInitialized) {
      throw new Error('Flash loan provider not initialized');
    }
    
    this.metrics.totalLoans++;
    const startTime = Date.now();
    
    try {
      const optimal = providerId ? 
        { providerId, provider: this.providers[providerId] } :
        await this.getOptimalProvider(asset, amount);
      
      console.log(`⚡ Executing flash loan:`);
      console.log(`   Provider: ${optimal.provider.name}`);
      console.log(`   Asset: ${asset}`);
      console.log(`   Amount: $${amount.toLocaleString()}`);
      console.log(`   Fee: ${(optimal.provider.fee * 100).toFixed(4)}%`);
      
      // Simulate flash loan execution
      const result = await this.simulateFlashLoan(optimal, asset, amount, callback);
      
      // Update metrics
      this.metrics.successfulLoans++;
      this.metrics.totalVolume += amount;
      this.metrics.averageLoanSize = this.metrics.totalVolume / this.metrics.totalLoans;
      this.metrics.providerUsage[optimal.providerId].count++;
      this.metrics.providerUsage[optimal.providerId].volume += amount;
      this.metrics.lastLoanTime = Date.now();
      
      const duration = Date.now() - startTime;
      console.log(`✅ Flash loan completed in ${duration}ms`);
      
      this.emit('flashLoanExecuted', result);
      return result;
      
    } catch (error) {
      console.error('❌ Flash loan execution failed:', error.message);
      throw error;
    }
  }
  
  async simulateFlashLoan(optimal, asset, amount, callback) {
    // Simulate the flash loan process
    const loanFee = amount * optimal.provider.fee;
    const totalRepayment = amount + loanFee;
    
    try {
      // Execute the callback with the borrowed funds
      const callbackResult = await callback({
        asset,
        amount,
        fee: loanFee,
        repaymentAmount: totalRepayment
      });
      
      // Check if we have enough to repay
      if (callbackResult.finalAmount < totalRepayment) {
        throw new Error(`Insufficient funds to repay flash loan. Need: ${totalRepayment}, Have: ${callbackResult.finalAmount}`);
      }
      
      const profit = callbackResult.finalAmount - totalRepayment;
      
      return {
        success: true,
        provider: optimal.provider.name,
        providerId: optimal.providerId,
        asset,
        loanAmount: amount,
        loanFee,
        repaymentAmount: totalRepayment,
        finalAmount: callbackResult.finalAmount,
        profit,
        profitPercentage: (profit / amount) * 100,
        transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
        gasUsed: optimal.provider.gasLimit,
        executionTime: Date.now(),
        callbackResult
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        provider: optimal.provider.name,
        providerId: optimal.providerId,
        asset,
        loanAmount: amount,
        loanFee
      };
    }
  }
  
  getProviders() {
    return Object.entries(this.providers).map(([id, provider]) => ({
      id,
      ...provider,
      available: provider.enabled
    }));
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalLoans > 0 ? 
        (this.metrics.successfulLoans / this.metrics.totalLoans) * 100 : 0,
      uptime: this.isInitialized ? Date.now() - (this.startTime || Date.now()) : 0
    };
  }
  
  shutdown() {
    this.isInitialized = false;
    console.log('⚡ Flash Loan Provider shutdown complete');
    this.emit('shutdown');
  }
}

export default FlashLoanProvider;