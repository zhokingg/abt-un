import { EventEmitter } from 'events';
import PriceMonitor from './priceMonitor.js';
import ProfitCalculator from './profitCalculator.js';
import MempoolMonitor from './mempoolMonitor.js';
import TransactionBuilder from './transactionBuilder.js';
import ArbitrageDetector from './arbitrageDetector.js';
import Web3Provider from '../providers/web3Provider.js';
import config from '../config/config.js';

/**
 * Core Arbitrage Engine - Phase 2 Implementation
 * Orchestrates all arbitrage detection and execution components
 */
class CoreArbitrageEngine extends EventEmitter {
  constructor() {
    super();
    
    // Initialize providers and core services
    this.web3Provider = null;
    this.priceMonitor = null;
    this.profitCalculator = null;
    this.mempoolMonitor = null;
    this.transactionBuilder = null;
    this.arbitrageDetector = null;
    
    // Engine state
    this.isRunning = false;
    this.isPaused = false;
    
    // Opportunity tracking
    this.activeOpportunities = new Map();
    this.executedTrades = new Map();
    this.opportunityHistory = [];
    
    // Token pairs to monitor
    this.monitoredPairs = [
      { tokenA: config.TOKENS.WETH, tokenB: config.TOKENS.USDC, exchange: 'uniswap-v2' },
      { tokenA: config.TOKENS.WETH, tokenB: config.TOKENS.USDC, exchange: 'uniswap-v3' },
      { tokenA: config.TOKENS.WETH, tokenB: config.TOKENS.USDT, exchange: 'uniswap-v2' },
      { tokenA: config.TOKENS.WETH, tokenB: config.TOKENS.USDT, exchange: 'uniswap-v3' },
      { tokenA: config.TOKENS.USDC, tokenB: config.TOKENS.USDT, exchange: 'uniswap-v2' },
      { tokenA: config.TOKENS.USDC, tokenB: config.TOKENS.USDT, exchange: 'uniswap-v3' }
    ];
    
    // Performance metrics
    this.stats = {
      uptime: 0,
      startTime: null,
      totalOpportunities: 0,
      profitableOpportunities: 0,
      executedTrades: 0,
      totalProfit: 0,
      totalGasCost: 0,
      successRate: 0
    };
    
    // Configuration
    this.engineConfig = {
      maxSimultaneousOpportunities: 3,
      minProfitThreshold: config.MIN_PROFIT_THRESHOLD,
      maxTradeAmount: config.MAX_TRADE_AMOUNT,
      opportunityTimeout: 30000, // 30 seconds
      executionTimeout: 60000 // 1 minute
    };
  }

  /**
   * Initialize the core arbitrage engine
   */
  async initialize() {
    console.log('🚀 Initializing Core Arbitrage Engine (Phase 2)...');
    
    try {
      // 1. Initialize Web3 provider
      console.log('📡 Connecting to blockchain...');
      this.web3Provider = new Web3Provider();
      await this.web3Provider.connect();
      
      if (!this.web3Provider.isConnected()) {
        throw new Error('Failed to connect to blockchain');
      }
      
      // 2. Initialize core services
      console.log('🔧 Initializing core services...');
      await this.initializeServices();
      
      // 3. Set up event listeners
      console.log('📡 Setting up event system...');
      this.setupEventListeners();
      
      // 4. Validate configuration
      this.validateConfiguration();
      
      console.log('✅ Core Arbitrage Engine initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Core Arbitrage Engine:', error.message);
      throw error;
    }
  }

  /**
   * Initialize all core services
   */
  async initializeServices() {
    // Initialize price monitoring
    this.priceMonitor = new PriceMonitor(this.web3Provider);
    console.log('✅ Price Monitor initialized');
    
    // Initialize profit calculator
    this.profitCalculator = new ProfitCalculator(this.web3Provider);
    console.log('✅ Profit Calculator initialized');
    
    // Initialize mempool monitor
    this.mempoolMonitor = new MempoolMonitor(this.web3Provider);
    console.log('✅ Mempool Monitor initialized');
    
    // Initialize transaction builder
    this.transactionBuilder = new TransactionBuilder(this.web3Provider);
    console.log('✅ Transaction Builder initialized');
    
    // Initialize arbitrage detector (existing from Phase 1)
    this.arbitrageDetector = new ArbitrageDetector();
    console.log('✅ Arbitrage Detector initialized');
  }

  /**
   * Set up event listeners between components
   */
  setupEventListeners() {
    // Price monitoring events
    this.priceMonitor.on('priceChange', this.handlePriceChange.bind(this));
    this.priceMonitor.on('blockUpdate', this.handleBlockUpdate.bind(this));
    this.priceMonitor.on('monitoringTick', this.handleMonitoringTick.bind(this));
    
    // Mempool monitoring events
    this.mempoolMonitor.on('opportunityDetected', this.handleMempoolOpportunity.bind(this));
    this.mempoolMonitor.on('mevDetected', this.handleMEVDetection.bind(this));
    this.mempoolMonitor.on('highPriorityOpportunity', this.handleHighPriorityOpportunity.bind(this));
    
    // Transaction builder events
    this.transactionBuilder.on('transactionSent', this.handleTransactionSent.bind(this));
    this.transactionBuilder.on('transactionConfirmed', this.handleTransactionConfirmed.bind(this));
    this.transactionBuilder.on('transactionFailed', this.handleTransactionFailed.bind(this));
    
    console.log('✅ Event listeners configured');
  }

  /**
   * Start the arbitrage engine
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Engine is already running');
      return;
    }
    
    console.log('🚀 Starting Core Arbitrage Engine...');
    
    try {
      this.isRunning = true;
      this.stats.startTime = Date.now();
      
      // Start price monitoring
      console.log('📊 Starting price monitoring...');
      await this.priceMonitor.startMonitoring(this.monitoredPairs);
      
      // Start mempool monitoring
      console.log('🕵️ Starting mempool monitoring...');
      await this.mempoolMonitor.startMonitoring();
      
      // Start main engine loop
      console.log('🔄 Starting main engine loop...');
      this.startMainLoop();
      
      // Start performance monitoring
      this.startPerformanceMonitoring();
      
      console.log('✅ Core Arbitrage Engine started successfully');
      console.log(`💰 Monitoring ${this.monitoredPairs.length} token pairs`);
      console.log(`📈 Profit threshold: ${this.engineConfig.minProfitThreshold}%`);
      console.log(`💵 Max trade amount: $${this.engineConfig.maxTradeAmount}`);
      
      this.emit('engineStarted', {
        timestamp: Date.now(),
        monitoredPairs: this.monitoredPairs.length,
        config: this.engineConfig
      });
      
    } catch (error) {
      console.error('❌ Failed to start Core Arbitrage Engine:', error.message);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Main engine loop for opportunity detection and execution
   */
  startMainLoop() {
    setInterval(async () => {
      if (!this.isRunning || this.isPaused) return;
      
      try {
        // Scan for new arbitrage opportunities
        await this.scanForOpportunities();
        
        // Process active opportunities
        await this.processActiveOpportunities();
        
        // Clean up expired opportunities
        this.cleanupExpiredOpportunities();
        
        // Update performance metrics
        this.updateStats();
        
      } catch (error) {
        console.error('❌ Error in main engine loop:', error.message);
        this.emit('engineError', { error: error.message, timestamp: Date.now() });
      }
    }, 5000); // Run every 5 seconds
  }

  /**
   * Scan for new arbitrage opportunities
   */
  async scanForOpportunities() {
    const scanStart = Date.now();
    
    // Get current prices for all monitored pairs
    const priceData = new Map();
    
    for (const pair of this.monitoredPairs) {
      const pairId = this.getPairId(pair);
      const currentPrice = this.priceMonitor.getCurrentPrice(pairId);
      
      if (currentPrice) {
        priceData.set(pairId, currentPrice);
      }
    }
    
    // Look for arbitrage opportunities between exchanges
    await this.detectCrossExchangeOpportunities(priceData);
    
    const scanTime = Date.now() - scanStart;
    
    if (scanTime > 1000) { // Log if scan takes more than 1 second
      console.log(`⏱️  Opportunity scan took ${scanTime}ms`);
    }
  }

  /**
   * Detect arbitrage opportunities between different exchanges
   */
  async detectCrossExchangeOpportunities(priceData) {
    // Group prices by token pair across different exchanges
    const pairGroups = new Map();
    
    for (const [pairId, price] of priceData.entries()) {
      const [tokenA, tokenB, exchange] = pairId.split('_');
      const basePair = `${tokenA}_${tokenB}`;
      
      if (!pairGroups.has(basePair)) {
        pairGroups.set(basePair, new Map());
      }
      
      pairGroups.get(basePair).set(exchange, price);
    }
    
    // Check for arbitrage opportunities within each token pair group
    for (const [basePair, exchangePrices] of pairGroups.entries()) {
      if (exchangePrices.size < 2) continue; // Need at least 2 exchanges
      
      const exchanges = Array.from(exchangePrices.keys());
      
      // Compare all exchange combinations
      for (let i = 0; i < exchanges.length; i++) {
        for (let j = i + 1; j < exchanges.length; j++) {
          const exchange1 = exchanges[i];
          const exchange2 = exchanges[j];
          const price1 = exchangePrices.get(exchange1);
          const price2 = exchangePrices.get(exchange2);
          
          // Use existing arbitrage detector
          const opportunity = this.arbitrageDetector.detectArbitrage(
            price1, price2, basePair, {
              blockNumber: await this.web3Provider.provider.getBlockNumber(),
              gasPrice: await this.web3Provider.getGasPrice()
            }
          );
          
          if (opportunity && opportunity.profitable) {
            await this.evaluateOpportunity(opportunity);
          }
        }
      }
    }
  }

  /**
   * Evaluate and potentially execute an opportunity
   */
  async evaluateOpportunity(opportunity) {
    const opportunityId = opportunity.id;
    
    // Skip if already processing this opportunity
    if (this.activeOpportunities.has(opportunityId)) {
      return;
    }
    
    // Check if we've reached maximum simultaneous opportunities
    if (this.activeOpportunities.size >= this.engineConfig.maxSimultaneousOpportunities) {
      console.log('⚠️  Maximum simultaneous opportunities reached, skipping...');
      return;
    }
    
    console.log(`🔍 Evaluating opportunity: ${opportunityId}`);
    
    try {
      // Calculate detailed profit analysis
      const profitAnalysis = await this.profitCalculator.calculateProfit(
        opportunity, 
        this.engineConfig.maxTradeAmount
      );
      
      if (!profitAnalysis.profitable) {
        console.log(`❌ Opportunity ${opportunityId} not profitable after fees`);
        return;
      }
      
      // Simulate trade execution
      const simulation = await this.profitCalculator.simulateTrade(
        opportunity, 
        this.engineConfig.maxTradeAmount
      );
      
      if (!simulation.simulation.success) {
        console.log(`❌ Trade simulation failed for ${opportunityId}`);
        return;
      }
      
      // Add to active opportunities
      this.activeOpportunities.set(opportunityId, {
        ...opportunity,
        profitAnalysis,
        simulation,
        detectedAt: Date.now(),
        status: 'evaluated'
      });
      
      this.stats.totalOpportunities++;
      
      if (profitAnalysis.profitable) {
        this.stats.profitableOpportunities++;
        
        // Execute if conditions are met
        if (this.shouldExecuteOpportunity(profitAnalysis, simulation)) {
          await this.executeOpportunity(opportunityId);
        }
      }
      
      console.log(`✅ Opportunity ${opportunityId} evaluated - ROI: ${profitAnalysis.roi.toFixed(2)}%`);
      
    } catch (error) {
      console.error(`❌ Error evaluating opportunity ${opportunityId}:`, error.message);
    }
  }

  /**
   * Determine if opportunity should be executed
   */
  shouldExecuteOpportunity(profitAnalysis, simulation) {
    // Check if dry run mode is enabled
    if (config.DRY_RUN) {
      console.log('🧪 DRY RUN MODE: Would execute opportunity');
      return false;
    }
    
    // Check minimum profit threshold
    if (profitAnalysis.roi < this.engineConfig.minProfitThreshold) {
      return false;
    }
    
    // Check risk level
    if (profitAnalysis.riskLevel === 'VERY HIGH') {
      return false;
    }
    
    // Check simulation success probability
    if (simulation.simulation.successProbability < 80) {
      return false;
    }
    
    return true;
  }

  /**
   * Execute arbitrage opportunity
   */
  async executeOpportunity(opportunityId) {
    const opportunity = this.activeOpportunities.get(opportunityId);
    if (!opportunity) return;
    
    console.log(`⚡ Executing opportunity: ${opportunityId}`);
    
    try {
      opportunity.status = 'executing';
      opportunity.executionStarted = Date.now();
      
      // Build transaction
      const transaction = await this.transactionBuilder.buildArbitrageTransaction(
        opportunity,
        this.engineConfig.maxTradeAmount
      );
      
      // Send transaction
      const txResult = await this.transactionBuilder.sendTransaction(transaction);
      
      // Update opportunity with transaction details
      opportunity.transactionId = txResult.id;
      opportunity.transactionHash = txResult.hash;
      opportunity.status = 'pending';
      
      console.log(`📤 Transaction sent for ${opportunityId}: ${txResult.hash}`);
      
      this.emit('opportunityExecuted', {
        opportunityId,
        transactionHash: txResult.hash,
        expectedProfit: opportunity.profitAnalysis.netProfit
      });
      
    } catch (error) {
      console.error(`❌ Failed to execute opportunity ${opportunityId}:`, error.message);
      opportunity.status = 'failed';
      opportunity.error = error.message;
    }
  }

  /**
   * Process active opportunities
   */
  async processActiveOpportunities() {
    for (const [opportunityId, opportunity] of this.activeOpportunities.entries()) {
      // Check for timeouts
      const age = Date.now() - opportunity.detectedAt;
      
      if (age > this.engineConfig.opportunityTimeout) {
        console.log(`⏰ Opportunity ${opportunityId} expired`);
        this.activeOpportunities.delete(opportunityId);
        continue;
      }
      
      // Check execution timeouts
      if (opportunity.status === 'executing' && opportunity.executionStarted) {
        const executionTime = Date.now() - opportunity.executionStarted;
        if (executionTime > this.engineConfig.executionTimeout) {
          console.log(`⏰ Execution timeout for ${opportunityId}`);
          opportunity.status = 'timeout';
        }
      }
    }
  }

  /**
   * Clean up expired opportunities
   */
  cleanupExpiredOpportunities() {
    const cutoff = Date.now() - (this.engineConfig.opportunityTimeout * 2);
    
    for (const [opportunityId, opportunity] of this.activeOpportunities.entries()) {
      if (opportunity.detectedAt < cutoff) {
        // Move to history
        this.opportunityHistory.push({
          ...opportunity,
          cleanedAt: Date.now()
        });
        
        this.activeOpportunities.delete(opportunityId);
      }
    }
    
    // Limit history size
    if (this.opportunityHistory.length > 1000) {
      this.opportunityHistory = this.opportunityHistory.slice(-1000);
    }
  }

  /**
   * Handle price change events
   */
  async handlePriceChange(event) {
    // Price changes might create new arbitrage opportunities
    console.log(`📈 Price change detected: ${event.pairId} (${event.percentageChange.toFixed(2)}%)`);
    
    // Trigger opportunity scan for affected pairs
    // This would be more sophisticated in production
  }

  /**
   * Handle block update events
   */
  async handleBlockUpdate(event) {
    // New blocks might affect pending opportunities
    // Update gas strategies if needed
  }

  /**
   * Handle monitoring tick events
   */
  async handleMonitoringTick(event) {
    // Regular monitoring updates
    // Could trigger additional opportunity scans or performance logging
  }

  /**
   * Handle mempool opportunity detection
   */
  async handleMempoolOpportunity(analysis) {
    console.log(`🕵️ Mempool opportunity detected: ${analysis.opportunityType}`);
    
    if (analysis.hasOpportunity && analysis.opportunityType === 'arbitrage') {
      // Convert mempool analysis to standard opportunity format
      const opportunity = {
        id: `mempool_${analysis.txHash}_${Date.now()}`,
        tokenPair: analysis.tokens.join('-'),
        triggeredBy: analysis.txHash,
        type: 'mempool_triggered',
        ...analysis.opportunity
      };
      
      await this.evaluateOpportunity(opportunity);
    }
  }

  /**
   * Handle MEV detection events
   */
  async handleMEVDetection(event) {
    console.log(`🎯 MEV pattern detected: ${event.type}`);
    
    // Log MEV opportunities for analysis
    this.emit('mevOpportunity', event);
  }

  /**
   * Handle high priority opportunities
   */
  async handleHighPriorityOpportunity(opportunity) {
    console.log(`🚨 High priority opportunity: ${opportunity.priority}`);
    
    // Fast-track high priority opportunities
    await this.evaluateOpportunity(opportunity);
  }

  /**
   * Handle transaction events
   */
  handleTransactionSent(event) {
    console.log(`📤 Transaction sent: ${event.hash}`);
  }

  handleTransactionConfirmed(event) {
    console.log(`✅ Transaction confirmed: ${event.hash}`);
    
    // Find associated opportunity
    for (const [opportunityId, opportunity] of this.activeOpportunities.entries()) {
      if (opportunity.transactionHash === event.hash) {
        opportunity.status = 'completed';
        opportunity.receipt = event.receipt;
        
        // Calculate actual profit
        // This would analyze the transaction receipt
        
        this.stats.executedTrades++;
        break;
      }
    }
  }

  handleTransactionFailed(event) {
    console.log(`❌ Transaction failed: ${event.hash || event.id}`);
    
    // Find associated opportunity
    for (const [opportunityId, opportunity] of this.activeOpportunities.entries()) {
      if (opportunity.transactionHash === event.hash || opportunity.transactionId === event.id) {
        opportunity.status = 'failed';
        opportunity.error = event.error;
        break;
      }
    }
  }

  /**
   * Start performance monitoring
   */
  startPerformanceMonitoring() {
    setInterval(() => {
      if (this.isRunning) {
        this.updateStats();
        this.logPerformanceMetrics();
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Update performance statistics
   */
  updateStats() {
    if (this.stats.startTime) {
      this.stats.uptime = Date.now() - this.stats.startTime;
    }
    
    // Calculate success rate
    if (this.stats.totalOpportunities > 0) {
      this.stats.successRate = (this.stats.executedTrades / this.stats.totalOpportunities) * 100;
    }
  }

  /**
   * Log performance metrics
   */
  logPerformanceMetrics() {
    console.log('\n📊 === PERFORMANCE METRICS ===');
    console.log(`⏱️  Uptime: ${Math.floor(this.stats.uptime / 1000)}s`);
    console.log(`🔍 Total Opportunities: ${this.stats.totalOpportunities}`);
    console.log(`💰 Profitable Opportunities: ${this.stats.profitableOpportunities}`);
    console.log(`⚡ Executed Trades: ${this.stats.executedTrades}`);
    console.log(`📈 Success Rate: ${this.stats.successRate.toFixed(1)}%`);
    console.log(`🎯 Active Opportunities: ${this.activeOpportunities.size}`);
    
    // Service-specific stats
    if (this.priceMonitor) {
      const priceStats = this.priceMonitor.getStats();
      console.log(`📊 Price Updates: ${priceStats.totalUpdates}`);
    }
    
    if (this.mempoolMonitor) {
      const mempoolStats = this.mempoolMonitor.getStats();
      console.log(`🕵️ Mempool Transactions: ${mempoolStats.totalTransactions}`);
    }
    
    if (this.transactionBuilder) {
      const txStats = this.transactionBuilder.getStats();
      console.log(`📤 Transactions Sent: ${txStats.totalTransactions}`);
    }
    
    console.log('=================================\n');
  }

  /**
   * Pause the engine
   */
  pause() {
    console.log('⏸️  Pausing Core Arbitrage Engine...');
    this.isPaused = true;
    this.emit('enginePaused', { timestamp: Date.now() });
  }

  /**
   * Resume the engine
   */
  resume() {
    console.log('▶️  Resuming Core Arbitrage Engine...');
    this.isPaused = false;
    this.emit('engineResumed', { timestamp: Date.now() });
  }

  /**
   * Stop the arbitrage engine
   */
  async stop() {
    console.log('🛑 Stopping Core Arbitrage Engine...');
    
    this.isRunning = false;
    
    // Stop all services
    if (this.priceMonitor) {
      await this.priceMonitor.stopMonitoring();
    }
    
    if (this.mempoolMonitor) {
      await this.mempoolMonitor.stopMonitoring();
    }
    
    if (this.transactionBuilder) {
      await this.transactionBuilder.cleanup();
    }
    
    if (this.web3Provider) {
      this.web3Provider.disconnect();
    }
    
    console.log('✅ Core Arbitrage Engine stopped');
    
    this.emit('engineStopped', { 
      timestamp: Date.now(),
      finalStats: this.stats
    });
  }

  /**
   * Get comprehensive engine status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      uptime: this.stats.uptime,
      stats: this.stats,
      activeOpportunities: this.activeOpportunities.size,
      services: {
        web3Connected: this.web3Provider?.isConnected() || false,
        priceMonitorActive: this.priceMonitor?.isMonitoring || false,
        mempoolMonitorActive: this.mempoolMonitor?.isMonitoring || false
      }
    };
  }

  /**
   * Validate engine configuration
   */
  validateConfiguration() {
    if (!config.RPC_URL || config.RPC_URL.includes('YOUR_INFURA_KEY')) {
      throw new Error('Invalid RPC URL configuration');
    }
    
    if (!config.PRIVATE_KEY && !config.DRY_RUN) {
      throw new Error('Private key required for live trading');
    }
    
    if (this.engineConfig.minProfitThreshold <= 0) {
      throw new Error('Invalid minimum profit threshold');
    }
    
    console.log('✅ Configuration validated');
  }

  /**
   * Utility function to generate pair ID
   */
  getPairId(pair) {
    return `${pair.tokenA}_${pair.tokenB}_${pair.exchange}`;
  }
}

export default CoreArbitrageEngine;