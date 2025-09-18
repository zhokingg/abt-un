const { ethers } = require('ethers');
const { FlashbotsBundleProvider, FlashbotsBundleResolution } = require('@flashbots/ethers-provider-bundle');
const EventEmitter = require('events');
const config = require('../config/config');

/**
 * Flashbots Service for MEV Protection
 * Provides private mempool submission for high-value arbitrage opportunities
 */
class FlashbotsService extends EventEmitter {
  constructor(web3Provider) {
    super();
    this.web3Provider = web3Provider;
    this.provider = web3Provider?.provider;
    this.wallet = web3Provider?.wallet;
    
    // Flashbots configuration
    this.config = config.FLASHBOTS;
    this.flashbotsProvider = null;
    this.signerWallet = null;
    
    // Bundle tracking
    this.pendingBundles = new Map();
    this.bundleHistory = [];
    this.stats = {
      bundlesSubmitted: 0,
      bundlesIncluded: 0,
      bundlesFailed: 0,
      totalMevProtected: 0
    };
    
    this.initialized = false;
  }
  
  /**
   * Initialize Flashbots provider and signer
   */
  async initialize() {
    try {
      if (!this.config.enabled) {
        console.log('📝 Flashbots integration disabled');
        return false;
      }
      
      console.log('🚀 Initializing Flashbots MEV protection...');
      
      // Validate configuration
      if (!this.config.signerPrivateKey) {
        throw new Error('Flashbots signer private key not configured');
      }
      
      if (!this.provider) {
        throw new Error('Web3 provider not available');
      }
      
      // Create signer wallet for Flashbots authentication
      this.signerWallet = new ethers.Wallet(this.config.signerPrivateKey, this.provider);
      
      // Initialize Flashbots provider
      this.flashbotsProvider = await FlashbotsBundleProvider.create(
        this.provider,
        this.signerWallet,
        this.config.relayUrl
      );
      
      // Test Flashbots connection
      const stats = await this.flashbotsProvider.getUserStats();
      console.log('✅ Flashbots provider initialized successfully');
      console.log(`📊 Flashbots stats: ${JSON.stringify(stats)}`);
      
      this.initialized = true;
      this.emit('initialized');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Flashbots:', error.message);
      this.initialized = false;
      return false;
    }
  }
  
  /**
   * Determine if transaction should use private mempool
   */
  shouldUsePrivateMempool(arbitrageData, profitUSD) {
    if (!this.initialized || !this.config.enabled) {
      return false;
    }
    
    // Route high-value opportunities to private mempool
    if (profitUSD >= this.config.profitThresholdUSD) {
      console.log(`💎 High-value opportunity ($${profitUSD}) - routing to private mempool`);
      return true;
    }
    
    return false;
  }
  
  /**
   * Submit transaction bundle to Flashbots
   */
  async submitBundle(transactions, targetBlockNumber) {
    try {
      if (!this.initialized) {
        throw new Error('Flashbots not initialized');
      }
      
      console.log(`📦 Submitting bundle for block ${targetBlockNumber}...`);
      
      // Prepare bundle
      const bundle = transactions.map(tx => ({
        signer: this.wallet,
        transaction: tx
      }));
      
      // Submit bundle to Flashbots
      const bundleSubmission = await this.flashbotsProvider.sendBundle(
        bundle,
        targetBlockNumber
      );
      
      const bundleId = this.generateBundleId();
      this.pendingBundles.set(bundleId, {
        submission: bundleSubmission,
        transactions,
        targetBlockNumber,
        timestamp: Date.now(),
        status: 'pending'
      });
      
      this.stats.bundlesSubmitted++;
      
      console.log(`✅ Bundle submitted: ${bundleId}`);
      this.emit('bundleSubmitted', { bundleId, targetBlockNumber });
      
      // Monitor bundle status
      this.monitorBundle(bundleId, bundleSubmission, targetBlockNumber);
      
      return { bundleId, submission: bundleSubmission };
    } catch (error) {
      console.error('❌ Bundle submission failed:', error.message);
      this.stats.bundlesFailed++;
      this.emit('bundleError', error);
      throw error;
    }
  }
  
  /**
   * Monitor bundle inclusion and handle results
   */
  async monitorBundle(bundleId, bundleSubmission, targetBlockNumber) {
    try {
      // Wait for bundle resolution
      const resolution = await bundleSubmission.wait();
      const bundleData = this.pendingBundles.get(bundleId);
      
      if (!bundleData) return;
      
      if (resolution === FlashbotsBundleResolution.BundleIncluded) {
        console.log(`✅ Bundle included in block ${targetBlockNumber}: ${bundleId}`);
        bundleData.status = 'included';
        this.stats.bundlesIncluded++;
        this.emit('bundleIncluded', { bundleId, targetBlockNumber });
      } else if (resolution === FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
        console.log(`⏭️ Bundle not included in block ${targetBlockNumber}: ${bundleId}`);
        bundleData.status = 'missed';
        this.emit('bundleMissed', { bundleId, targetBlockNumber });
      } else if (resolution === FlashbotsBundleResolution.AccountNonceTooHigh) {
        console.log(`⚠️ Bundle nonce too high: ${bundleId}`);
        bundleData.status = 'nonce_error';
        this.stats.bundlesFailed++;
        this.emit('bundleError', { bundleId, error: 'Nonce too high' });
      }
      
      // Move to history
      this.bundleHistory.push({
        ...bundleData,
        bundleId,
        resolvedAt: Date.now()
      });
      
      this.pendingBundles.delete(bundleId);
    } catch (error) {
      console.error(`❌ Bundle monitoring failed for ${bundleId}:`, error.message);
      const bundleData = this.pendingBundles.get(bundleId);
      if (bundleData) {
        bundleData.status = 'error';
        this.stats.bundlesFailed++;
      }
    }
  }
  
  /**
   * Calculate MEV protection fee for bundle
   */
  calculateMevProtectionFee(baseFeePerGas, gasUsed) {
    // Add priority fee for MEV protection
    const priorityFeeWei = ethers.parseUnits(this.config.priorityFeeGwei.toString(), 'gwei');
    const maxBaseFeeWei = ethers.parseUnits(this.config.maxBaseFeeGwei.toString(), 'gwei');
    
    // Cap the base fee
    const cappedBaseFee = baseFeePerGas > maxBaseFeeWei ? maxBaseFeeWei : baseFeePerGas;
    
    // Calculate total fee
    const totalFeePerGas = cappedBaseFee + priorityFeeWei;
    const totalFee = totalFeePerGas * BigInt(gasUsed);
    
    return {
      totalFee,
      totalFeePerGas,
      priorityFeePerGas: priorityFeeWei,
      maxFeePerGas: totalFeePerGas
    };
  }
  
  /**
   * Get optimal target block for bundle submission
   */
  async getOptimalTargetBlock() {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      // Target next block for immediate inclusion
      return currentBlock + 1;
    } catch (error) {
      console.error('Error getting optimal target block:', error.message);
      throw error;
    }
  }
  
  /**
   * Check if Flashbots is healthy and available
   */
  async checkHealth() {
    try {
      if (!this.initialized) {
        return { healthy: false, reason: 'Not initialized' };
      }
      
      // Try to get user stats to verify connection
      const stats = await this.flashbotsProvider.getUserStats();
      
      return {
        healthy: true,
        stats: this.stats,
        flashbotsStats: stats
      };
    } catch (error) {
      return {
        healthy: false,
        reason: error.message,
        stats: this.stats
      };
    }
  }
  
  /**
   * Get bundle statistics
   */
  getStats() {
    const successRate = this.stats.bundlesSubmitted > 0 
      ? (this.stats.bundlesIncluded / this.stats.bundlesSubmitted) * 100 
      : 0;
      
    return {
      ...this.stats,
      successRate: successRate.toFixed(2) + '%',
      pendingBundles: this.pendingBundles.size,
      historicalBundles: this.bundleHistory.length
    };
  }
  
  /**
   * Generate unique bundle ID
   */
  generateBundleId() {
    return `bundle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Clean up old bundle history
   */
  cleanupHistory() {
    const maxHistoryAge = 24 * 60 * 60 * 1000; // 24 hours
    const cutoff = Date.now() - maxHistoryAge;
    
    this.bundleHistory = this.bundleHistory.filter(
      bundle => bundle.resolvedAt > cutoff
    );
  }
  
  /**
   * Get recent bundle history
   */
  getRecentHistory(limit = 10) {
    return this.bundleHistory
      .slice(-limit)
      .reverse();
  }
  
  /**
   * Emergency disable Flashbots
   */
  emergencyDisable() {
    console.log('🚨 Emergency disabling Flashbots...');
    this.initialized = false;
    this.emit('emergencyDisabled');
  }
  
  /**
   * Check if initialized and ready
   */
  isReady() {
    return this.initialized && this.config.enabled;
  }
}

module.exports = FlashbotsService;