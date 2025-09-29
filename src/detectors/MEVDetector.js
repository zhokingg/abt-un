import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import config from '../config/config.js';

/**
 * MEVDetector - MEV (Maximal Extractable Value) opportunity identification
 * Monitors mempool for arbitrage opportunities and frontrunning detection
 */
class MEVDetector extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      mempoolMonitoring: options.mempoolMonitoring !== false,
      frontrunningDetection: options.frontrunningDetection !== false,
      backrunningDetection: options.backrunningDetection !== false,
      sandwichDetection: options.sandwichDetection !== false,
      minMEVValue: options.minMEVValue || 50, // $50 minimum MEV opportunity
      maxBlocksAhead: options.maxBlocksAhead || 3, // Look 3 blocks ahead
      updateInterval: options.updateInterval || 1000, // 1 second
      ...options
    };
    
    // MEV opportunity tracking
    this.detectedOpportunities = new Map();
    this.mempoolTransactions = new Map();
    this.blockHistory = [];
    this.lastProcessedBlock = 0;
    
    // MEV strategy types
    this.mevTypes = {
      ARBITRAGE: {
        name: 'Arbitrage',
        description: 'Price differences between exchanges',
        priority: 'high',
        timeWindow: 30000 // 30 seconds
      },
      FRONTRUNNING: {
        name: 'Frontrunning',
        description: 'Execute before large trades',
        priority: 'urgent',
        timeWindow: 15000 // 15 seconds
      },
      BACKRUNNING: {
        name: 'Backrunning',
        description: 'Execute after large trades',
        priority: 'medium',
        timeWindow: 45000 // 45 seconds
      },
      SANDWICH: {
        name: 'Sandwich Attack',
        description: 'Front and back run target transaction',
        priority: 'high',
        timeWindow: 30000 // 30 seconds
      },
      LIQUIDATION: {
        name: 'Liquidation',
        description: 'Liquidate undercollateralized positions',
        priority: 'high',
        timeWindow: 60000 // 60 seconds
      }
    };
    
    // DEX signature patterns for transaction analysis
    this.dexSignatures = new Map([
      // Uniswap V2
      ['0x38ed1739', 'swapExactTokensForTokens'],
      ['0x7ff36ab5', 'swapExactETHForTokens'],
      ['0x18cbafe5', 'swapExactTokensForETH'],
      // Uniswap V3
      ['0x414bf389', 'exactInputSingle'],
      ['0xc04b8d59', 'exactInput'],
      ['0xdb3e2198', 'exactOutputSingle'],
      // Sushiswap
      ['0x38ed1739', 'swapExactTokensForTokens'],
      ['0xb6f9de95', 'swapExactETHForTokensSupportingFeeOnTransferTokens']
    ]);
    
    // Performance metrics
    this.metrics = {
      totalOpportunities: 0,
      profitableOpportunities: 0,
      averageMEVValue: 0,
      successfulExtractions: 0,
      frontrunningDetections: 0,
      arbitrageDetections: 0,
      lastDetectionTime: null
    };
    
    this.isActive = false;
    this.monitoringTimer = null;
  }
  
  /**
   * Initialize the MEV detector
   */
  async initialize(web3Provider, mempoolMonitor = null) {
    try {
      this.web3Provider = web3Provider;
      this.mempoolMonitor = mempoolMonitor;
      
      if (!this.web3Provider || !this.web3Provider.isConnected()) {
        throw new Error('Web3 provider not connected');
      }
      
      console.log('🎯 Initializing MEV Detector...');
      console.log(`   Mempool monitoring: ${this.options.mempoolMonitoring ? 'enabled' : 'disabled'}`);
      console.log(`   Frontrunning detection: ${this.options.frontrunningDetection ? 'enabled' : 'disabled'}`);
      console.log(`   Sandwich detection: ${this.options.sandwichDetection ? 'enabled' : 'disabled'}`);
      console.log(`   Min MEV value: $${this.options.minMEVValue}`);
      
      // Get current block for initialization
      this.lastProcessedBlock = await this.web3Provider.getBlockNumber();
      
      this.isActive = true;
      this.startTime = Date.now();
      this.emit('initialized');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize MEV Detector:', error.message);
      throw error;
    }
  }
  
  /**
   * Start MEV monitoring
   */
  startMonitoring() {
    if (!this.isActive) {
      throw new Error('MEV detector not initialized');
    }
    
    console.log('🎯 Starting MEV monitoring...');
    
    // Set up block listener for new blocks
    if (this.web3Provider && this.web3Provider.getProvider()) {
      this.web3Provider.getProvider().on('block', (blockNumber) => {
        this.processNewBlock(blockNumber);
      });
    }
    
    // Set up mempool monitoring if available and enabled
    if (this.options.mempoolMonitoring && this.mempoolMonitor) {
      this.mempoolMonitor.on('newTransaction', (tx) => {
        this.analyzeTransaction(tx);
      });
    }
    
    // Start periodic analysis
    this.monitoringTimer = setInterval(() => {
      this.performPeriodicAnalysis();
    }, this.options.updateInterval);
    
    this.emit('monitoringStarted');
  }
  
  /**
   * Stop MEV monitoring
   */
  stopMonitoring() {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    
    // Remove block listener
    if (this.web3Provider && this.web3Provider.getProvider()) {
      this.web3Provider.getProvider().removeAllListeners('block');
    }
    
    console.log('🎯 MEV monitoring stopped');
    this.emit('monitoringStopped');
  }
  
  /**
   * Process new block for MEV opportunities
   */
  async processNewBlock(blockNumber) {
    if (blockNumber <= this.lastProcessedBlock) {
      return;
    }
    
    try {
      const block = await this.web3Provider.getProvider().getBlock(blockNumber, true);
      if (!block || !block.transactions) {
        return;
      }
      
      // Store block in history
      this.blockHistory.push({
        number: blockNumber,
        timestamp: block.timestamp,
        transactionCount: block.transactions.length,
        gasUsed: block.gasUsed ? Number(block.gasUsed) : 0
      });
      
      // Keep only last 100 blocks
      if (this.blockHistory.length > 100) {
        this.blockHistory.shift();
      }
      
      // Analyze block transactions for MEV opportunities
      await this.analyzeBlockTransactions(block);
      
      this.lastProcessedBlock = blockNumber;
      this.emit('blockProcessed', { blockNumber, transactionCount: block.transactions.length });
      
    } catch (error) {
      console.warn(`⚠️ Error processing block ${blockNumber}:`, error.message);
    }
  }
  
  /**
   * Analyze block transactions for MEV patterns
   */
  async analyzeBlockTransactions(block) {
    const mevTransactions = [];
    const dexTransactions = [];
    
    for (const tx of block.transactions) {
      if (typeof tx === 'string') continue; // Skip if not full transaction object
      
      // Check if transaction interacts with known DEXs
      if (this.isDEXTransaction(tx)) {
        dexTransactions.push(tx);
      }
      
      // Look for MEV patterns
      const mevPattern = await this.identifyMEVPattern(tx, block);
      if (mevPattern) {
        mevTransactions.push({ tx, pattern: mevPattern });
      }
    }
    
    // Analyze for complex MEV strategies
    if (dexTransactions.length > 1) {
      await this.analyzeCrossTransactionMEV(dexTransactions, block);
    }
    
    if (mevTransactions.length > 0) {
      this.emit('mevTransactionsDetected', {
        blockNumber: block.number,
        mevTransactions: mevTransactions.length,
        dexTransactions: dexTransactions.length
      });
    }
  }
  
  /**
   * Check if transaction is a DEX transaction
   */
  isDEXTransaction(tx) {
    if (!tx.data || tx.data.length < 10) return false;
    
    const methodId = tx.data.slice(0, 10);
    return this.dexSignatures.has(methodId);
  }
  
  /**
   * Identify MEV pattern in transaction
   */
  async identifyMEVPattern(tx, block) {
    try {
      // Arbitrage detection
      if (this.isArbitrageTransaction(tx)) {
        return await this.analyzeArbitrageOpportunity(tx, block);
      }
      
      // Liquidation detection
      if (this.isLiquidationTransaction(tx)) {
        return this.analyzeLiquidationOpportunity(tx, block);
      }
      
      // Large trade detection (potential frontrunning target)
      if (this.isLargeTradeTransaction(tx)) {
        return this.analyzeFrontrunningOpportunity(tx, block);
      }
      
      return null;
    } catch (error) {
      console.warn('⚠️ Error analyzing MEV pattern:', error.message);
      return null;
    }
  }
  
  /**
   * Check if transaction is an arbitrage
   */
  isArbitrageTransaction(tx) {
    // Simplified detection: multiple DEX interactions in single transaction
    if (!tx.data) return false;
    
    // Look for multiple swap calls or flash loan patterns
    const data = tx.data.toLowerCase();
    const swapCount = (data.match(/38ed1739|414bf389|c04b8d59/g) || []).length;
    
    return swapCount >= 2 || data.includes('flash') || tx.gasLimit > 300000;
  }
  
  /**
   * Analyze arbitrage opportunity
   */
  async analyzeArbitrageOpportunity(tx, block) {
    const estimatedValue = this.estimateTransactionValue(tx);
    
    if (estimatedValue >= this.options.minMEVValue) {
      this.metrics.arbitrageDetections++;
      this.metrics.totalOpportunities++;
      
      const opportunity = {
        type: 'ARBITRAGE',
        transactionHash: tx.hash,
        blockNumber: block.number,
        estimatedValue,
        gasPrice: tx.gasPrice ? Number(ethers.formatUnits(tx.gasPrice, 'gwei')) : 0,
        gasLimit: tx.gasLimit ? Number(tx.gasLimit) : 0,
        timestamp: Date.now(),
        confidence: 0.7
      };
      
      this.detectedOpportunities.set(tx.hash, opportunity);
      this.emit('mevOpportunity', opportunity);
      
      return opportunity;
    }
    
    return null;
  }
  
  /**
   * Check if transaction is a liquidation
   */
  isLiquidationTransaction(tx) {
    if (!tx.data) return false;
    
    const data = tx.data.toLowerCase();
    return data.includes('liquidat') || 
           data.includes('seize') ||
           (tx.gasLimit > 200000 && tx.value && Number(tx.value) > 0);
  }
  
  /**
   * Analyze liquidation opportunity
   */
  analyzeLiquidationOpportunity(tx, block) {
    const estimatedValue = this.estimateTransactionValue(tx) * 1.2; // Liquidations often more profitable
    
    if (estimatedValue >= this.options.minMEVValue) {
      const opportunity = {
        type: 'LIQUIDATION',
        transactionHash: tx.hash,
        blockNumber: block.number,
        estimatedValue,
        gasPrice: tx.gasPrice ? Number(ethers.formatUnits(tx.gasPrice, 'gwei')) : 0,
        timestamp: Date.now(),
        confidence: 0.8
      };
      
      this.detectedOpportunities.set(tx.hash, opportunity);
      this.emit('mevOpportunity', opportunity);
      
      return opportunity;
    }
    
    return null;
  }
  
  /**
   * Check if transaction is a large trade
   */
  isLargeTradeTransaction(tx) {
    // Simplified: high gas limit and value suggests large trade
    const gasLimit = tx.gasLimit ? Number(tx.gasLimit) : 0;
    const value = tx.value ? Number(ethers.formatEther(tx.value)) : 0;
    
    return gasLimit > 150000 || value > 10; // >10 ETH or high gas
  }
  
  /**
   * Analyze frontrunning opportunity
   */
  analyzeFrontrunningOpportunity(tx, block) {
    if (!this.options.frontrunningDetection) return null;
    
    const estimatedValue = this.estimateTransactionValue(tx) * 0.3; // Conservative estimate
    
    if (estimatedValue >= this.options.minMEVValue) {
      this.metrics.frontrunningDetections++;
      
      const opportunity = {
        type: 'FRONTRUNNING',
        targetTransaction: tx.hash,
        blockNumber: block.number,
        estimatedValue,
        targetGasPrice: tx.gasPrice ? Number(ethers.formatUnits(tx.gasPrice, 'gwei')) : 0,
        requiredGasPrice: tx.gasPrice ? Number(ethers.formatUnits(tx.gasPrice, 'gwei')) * 1.1 : 0,
        timeWindow: 15000, // 15 seconds
        timestamp: Date.now(),
        confidence: 0.6
      };
      
      this.emit('mevOpportunity', opportunity);
      return opportunity;
    }
    
    return null;
  }
  
  /**
   * Analyze cross-transaction MEV opportunities
   */
  async analyzeCrossTransactionMEV(dexTransactions, block) {
    if (!this.options.sandwichDetection) return;
    
    // Look for sandwich attack patterns
    for (let i = 0; i < dexTransactions.length - 1; i++) {
      const tx1 = dexTransactions[i];
      const tx2 = dexTransactions[i + 1];
      
      if (this.isSandwichPattern(tx1, tx2)) {
        const opportunity = {
          type: 'SANDWICH',
          frontTransaction: tx1.hash,
          backTransaction: tx2.hash,
          blockNumber: block.number,
          estimatedValue: this.estimateTransactionValue(tx1) * 0.4,
          timestamp: Date.now(),
          confidence: 0.7
        };
        
        if (opportunity.estimatedValue >= this.options.minMEVValue) {
          this.emit('mevOpportunity', opportunity);
        }
      }
    }
  }
  
  /**
   * Check if two transactions form a sandwich pattern
   */
  isSandwichPattern(tx1, tx2) {
    // Simplified: same method calls, different gas prices
    if (!tx1.data || !tx2.data) return false;
    
    const method1 = tx1.data.slice(0, 10);
    const method2 = tx2.data.slice(0, 10);
    
    return method1 === method2 && 
           tx1.gasPrice && tx2.gasPrice &&
           Math.abs(Number(tx1.gasPrice) - Number(tx2.gasPrice)) > 1000000000; // 1 gwei difference
  }
  
  /**
   * Process mempool transaction for MEV opportunities
   */
  analyzeTransaction(tx) {
    if (!this.options.mempoolMonitoring) return;
    
    try {
      // Store transaction in mempool tracking
      this.mempoolTransactions.set(tx.hash, {
        ...tx,
        receivedAt: Date.now()
      });
      
      // Clean old transactions (>5 minutes)
      const cutoff = Date.now() - 300000;
      for (const [hash, transaction] of this.mempoolTransactions.entries()) {
        if (transaction.receivedAt < cutoff) {
          this.mempoolTransactions.delete(hash);
        }
      }
      
      // Analyze for immediate MEV opportunities
      const mevPattern = this.identifyMempoolMEV(tx);
      if (mevPattern) {
        this.emit('mempoolMEVOpportunity', mevPattern);
      }
      
    } catch (error) {
      console.warn('⚠️ Error analyzing mempool transaction:', error.message);
    }
  }
  
  /**
   * Identify MEV opportunities in mempool
   */
  identifyMempoolMEV(tx) {
    // Look for high-value transactions that can be frontrun
    if (this.isLargeTradeTransaction(tx)) {
      return {
        type: 'FRONTRUNNING',
        targetTransaction: tx.hash,
        estimatedValue: this.estimateTransactionValue(tx) * 0.2,
        urgency: 'high',
        timeWindow: 30000, // 30 seconds before likely inclusion
        requiredGasPrice: tx.gasPrice ? Number(ethers.formatUnits(tx.gasPrice, 'gwei')) * 1.15 : 0
      };
    }
    
    return null;
  }
  
  /**
   * Estimate transaction value for MEV calculation
   */
  estimateTransactionValue(tx) {
    if (!tx) return 0;
    
    // Base estimate on gas limit and value
    const gasLimit = tx.gasLimit ? Number(tx.gasLimit) : 21000;
    const value = tx.value ? Number(ethers.formatEther(tx.value)) : 0;
    
    // Simple heuristic: complex transactions often have higher MEV potential
    let estimate = value * 2000; // Convert ETH to USD (simplified)
    
    if (gasLimit > 300000) estimate += 100; // Complex transaction bonus
    if (gasLimit > 500000) estimate += 200; // Very complex transaction bonus
    
    // Random factor for simulation (remove in production)
    estimate += Math.random() * 50;
    
    return Math.max(estimate, 10); // Minimum $10
  }
  
  /**
   * Perform periodic analysis of accumulated data
   */
  performPeriodicAnalysis() {
    // Clean up old opportunities
    const cutoff = Date.now() - 3600000; // 1 hour
    for (const [hash, opportunity] of this.detectedOpportunities.entries()) {
      if (opportunity.timestamp < cutoff) {
        this.detectedOpportunities.delete(hash);
      }
    }
    
    // Update metrics
    this.updateMetrics();
    
    // Emit periodic status
    this.emit('periodicAnalysis', {
      activeOpportunities: this.detectedOpportunities.size,
      mempoolTransactions: this.mempoolTransactions.size,
      lastProcessedBlock: this.lastProcessedBlock
    });
  }
  
  /**
   * Update performance metrics
   */
  updateMetrics() {
    const opportunities = Array.from(this.detectedOpportunities.values());
    
    if (opportunities.length > 0) {
      this.metrics.averageMEVValue = opportunities.reduce((sum, opp) => sum + opp.estimatedValue, 0) / opportunities.length;
      this.metrics.lastDetectionTime = Math.max(...opportunities.map(opp => opp.timestamp));
      this.metrics.profitableOpportunities = opportunities.filter(opp => opp.estimatedValue >= this.options.minMEVValue).length;
    }
  }
  
  /**
   * Get detected MEV opportunities
   */
  getOpportunities(type = null, minValue = 0) {
    const opportunities = Array.from(this.detectedOpportunities.values());
    
    return opportunities.filter(opp => 
      (!type || opp.type === type) &&
      opp.estimatedValue >= minValue
    ).sort((a, b) => b.estimatedValue - a.estimatedValue);
  }
  
  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeOpportunities: this.detectedOpportunities.size,
      mempoolSize: this.mempoolTransactions.size,
      blockHistory: this.blockHistory.length,
      lastProcessedBlock: this.lastProcessedBlock,
      uptime: this.isActive ? Date.now() - (this.startTime || Date.now()) : 0
    };
  }
  
  /**
   * Shutdown the detector
   */
  shutdown() {
    this.stopMonitoring();
    this.isActive = false;
    this.detectedOpportunities.clear();
    this.mempoolTransactions.clear();
    this.blockHistory = [];
    
    console.log('🎯 MEV Detector shutdown complete');
    this.emit('shutdown');
  }
}

export default MEVDetector;