const { ethers } = require('ethers');
const Web3Provider = require('./web3Provider');
const FlashbotsService = require('../services/FlashbotsService');
const config = require('../config/config');

/**
 * Enhanced RPC Provider with Flashbots Integration
 * Extends Web3Provider with MEV protection capabilities
 */
class EnhancedRpcProvider extends Web3Provider {
  constructor() {
    super();
    
    // Flashbots integration
    this.flashbotsService = null;
    this.flashbotsEnabled = false;
    
    // Provider endpoints for failover
    this.endpoints = config.PHASE4?.RPC_ENDPOINTS || [];
    this.currentEndpointIndex = 0;
    
    // Transaction routing
    this.routingStrategy = {
      highValue: 'flashbots', // Route high-value trades to Flashbots
      lowValue: 'public',     // Route low-value trades to public mempool
      fallback: 'public'      // Fallback when Flashbots fails
    };
    
    // Performance metrics
    this.metrics = {
      publicTransactions: 0,
      flashbotsTransactions: 0,
      flashbotsFallbacks: 0,
      averageLatency: 0
    };
  }
  
  /**
   * Enhanced connection with Flashbots setup
   */
  async connect() {
    try {
      // Connect to base Web3 provider first
      const connected = await super.connect();
      if (!connected) {
        return false;
      }
      
      // Initialize Flashbots service
      if (config.FLASHBOTS.enabled) {
        console.log('🔐 Setting up Flashbots MEV protection...');
        
        this.flashbotsService = new FlashbotsService(this);
        const flashbotsReady = await this.flashbotsService.initialize();
        
        if (flashbotsReady) {
          this.flashbotsEnabled = true;
          console.log('✅ Flashbots MEV protection enabled');
          
          // Set up event listeners
          this.setupFlashbotsEventListeners();
        } else {
          console.warn('⚠️ Flashbots initialization failed - using public mempool only');
        }
      }
      
      console.log('🚀 Enhanced RPC Provider ready');
      return true;
    } catch (error) {
      console.error('❌ Enhanced RPC Provider connection failed:', error.message);
      return false;
    }
  }
  
  /**
   * Setup Flashbots event listeners
   */
  setupFlashbotsEventListeners() {
    if (!this.flashbotsService) return;
    
    this.flashbotsService.on('bundleSubmitted', (data) => {
      console.log(`📦 Bundle submitted: ${data.bundleId} for block ${data.targetBlockNumber}`);
      this.metrics.flashbotsTransactions++;
    });
    
    this.flashbotsService.on('bundleIncluded', (data) => {
      console.log(`✅ Bundle included: ${data.bundleId} in block ${data.targetBlockNumber}`);
    });
    
    this.flashbotsService.on('bundleMissed', (data) => {
      console.log(`⏭️ Bundle missed: ${data.bundleId} for block ${data.targetBlockNumber}`);
    });
    
    this.flashbotsService.on('bundleError', (data) => {
      console.error(`❌ Bundle error: ${data.error || 'Unknown error'}`);
    });
    
    this.flashbotsService.on('emergencyDisabled', () => {
      console.log('🚨 Flashbots emergency disabled - switching to public mempool');
      this.flashbotsEnabled = false;
    });
  }
  
  /**
   * Smart transaction routing based on value and conditions
   */
  async routeTransaction(transactionData, arbitrageData = null) {
    try {
      const profitUSD = arbitrageData?.estimatedProfitUSD || 0;
      
      // Determine routing strategy
      const shouldUseFlashbots = this.shouldRouteToFlashbots(profitUSD, arbitrageData);
      
      if (shouldUseFlashbots) {
        console.log(`🔐 Routing high-value transaction ($${profitUSD}) to Flashbots`);
        return await this.submitViaFlashbots(transactionData, arbitrageData);
      } else {
        console.log(`🌐 Routing transaction ($${profitUSD}) to public mempool`);
        return await this.submitViaPublicMempool(transactionData);
      }
    } catch (error) {
      console.error('❌ Transaction routing failed:', error.message);
      
      // Fallback to public mempool
      if (this.routingStrategy.fallback === 'public') {
        console.log('🔄 Falling back to public mempool...');
        this.metrics.flashbotsFallbacks++;
        return await this.submitViaPublicMempool(transactionData);
      }
      
      throw error;
    }
  }
  
  /**
   * Determine if transaction should route to Flashbots
   */
  shouldRouteToFlashbots(profitUSD, arbitrageData) {
    // Check if Flashbots is available
    if (!this.flashbotsEnabled || !this.flashbotsService?.isReady()) {
      return false;
    }
    
    // Use Flashbots service logic
    return this.flashbotsService.shouldUsePrivateMempool(arbitrageData, profitUSD);
  }
  
  /**
   * Submit transaction via Flashbots private mempool
   */
  async submitViaFlashbots(transactionData, arbitrageData) {
    try {
      if (!this.flashbotsService) {
        throw new Error('Flashbots service not available');
      }
      
      // Get optimal target block
      const targetBlock = await this.flashbotsService.getOptimalTargetBlock();
      
      // Calculate MEV protection fees
      const gasEstimate = await this.provider.estimateGas(transactionData);
      const feeData = await this.provider.getFeeData();
      
      const mevFees = this.flashbotsService.calculateMevProtectionFee(
        feeData.maxFeePerGas,
        gasEstimate
      );
      
      // Update transaction with MEV protection fees
      const enhancedTransaction = {
        ...transactionData,
        maxFeePerGas: mevFees.maxFeePerGas,
        maxPriorityFeePerGas: mevFees.priorityFeePerGas,
        gasLimit: gasEstimate
      };
      
      // Submit bundle
      const result = await this.flashbotsService.submitBundle(
        [enhancedTransaction],
        targetBlock
      );
      
      return {
        hash: result.bundleId, // Use bundle ID as transaction identifier
        bundleId: result.bundleId,
        targetBlock,
        mevProtected: true,
        submission: result.submission
      };
    } catch (error) {
      console.error('❌ Flashbots submission failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Submit transaction via public mempool
   */
  async submitViaPublicMempool(transactionData) {
    try {
      if (!this.wallet) {
        throw new Error('Wallet not available for transaction submission');
      }
      
      console.log('📤 Submitting transaction to public mempool...');
      
      // Submit transaction normally
      const txResponse = await this.wallet.sendTransaction(transactionData);
      this.metrics.publicTransactions++;
      
      return {
        hash: txResponse.hash,
        mevProtected: false,
        response: txResponse
      };
    } catch (error) {
      console.error('❌ Public mempool submission failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Get transaction status (works for both public and Flashbots)
   */
  async getTransactionStatus(identifier) {
    try {
      // Check if it's a bundle ID (Flashbots)
      if (identifier.startsWith('bundle_')) {
        return await this.getFlashbotsBundleStatus(identifier);
      }
      
      // Regular transaction hash
      const receipt = await this.provider.getTransactionReceipt(identifier);
      return {
        status: receipt ? 'confirmed' : 'pending',
        receipt,
        mevProtected: false
      };
    } catch (error) {
      console.error('Error getting transaction status:', error.message);
      return { status: 'error', error: error.message };
    }
  }
  
  /**
   * Get Flashbots bundle status
   */
  async getFlashbotsBundleStatus(bundleId) {
    if (!this.flashbotsService) {
      return { status: 'error', error: 'Flashbots not available' };
    }
    
    // Check pending bundles
    const pendingBundle = this.flashbotsService.pendingBundles.get(bundleId);
    if (pendingBundle) {
      return {
        status: pendingBundle.status,
        targetBlock: pendingBundle.targetBlockNumber,
        mevProtected: true
      };
    }
    
    // Check history
    const historicalBundle = this.flashbotsService.bundleHistory.find(
      bundle => bundle.bundleId === bundleId
    );
    
    if (historicalBundle) {
      return {
        status: historicalBundle.status,
        targetBlock: historicalBundle.targetBlockNumber,
        mevProtected: true,
        resolvedAt: historicalBundle.resolvedAt
      };
    }
    
    return { status: 'not_found', mevProtected: true };
  }
  
  /**
   * Get enhanced provider statistics
   */
  getProviderStats() {
    const baseStats = {
      connected: this.connected,
      currentBlock: this.lastBlockNumber,
      ...this.metrics
    };
    
    if (this.flashbotsService) {
      baseStats.flashbots = this.flashbotsService.getStats();
    }
    
    return baseStats;
  }
  
  /**
   * Get Flashbots service instance
   */
  getFlashbotsService() {
    return this.flashbotsService;
  }
  
  /**
   * Check if Flashbots is enabled and ready
   */
  isFlashbotsReady() {
    return this.flashbotsEnabled && this.flashbotsService?.isReady();
  }
  
  /**
   * Emergency disable Flashbots
   */
  emergencyDisableFlashbots() {
    if (this.flashbotsService) {
      this.flashbotsService.emergencyDisable();
    }
    this.flashbotsEnabled = false;
  }
  
  /**
   * Enhanced disconnect with Flashbots cleanup
   */
  disconnect() {
    // Clean up Flashbots service
    if (this.flashbotsService) {
      this.flashbotsService.removeAllListeners();
    }
    
    // Call parent disconnect
    super.disconnect();
    
    console.log('🔌 Enhanced RPC Provider disconnected');
  }
}

module.exports = EnhancedRpcProvider;