import { EventEmitter } from 'events';

// Legacy components
import PriceMonitor from './priceMonitor.js';
import ProfitCalculator from './profitCalculator.js';
import TransactionBuilder from './transactionBuilder.js';
import ArbitrageDetector from './arbitrageDetector.js';

// New real-time components
import PriceOracleManager from './PriceOracleManager.js';
import PriceAggregator from './PriceAggregator.js';
import MempoolMonitor from './mempoolMonitor.js';
import EventListenerManager from './EventListenerManager.js';
import WebSocketManager from './WebSocketManager.js';
import DataRouter from './DataRouter.js';
import CacheManager from './CacheManager.js';
import OpportunityPipeline from './OpportunityPipeline.js';
import AlertManager from './AlertManager.js';

import Web3Provider from '../providers/web3Provider.js';
import config from '../config/config.js';

/**
 * Enhanced Core Arbitrage Engine - Real-time Data Integration
 * Orchestrates all arbitrage detection and execution components with real-time capabilities
 */
class CoreArbitrageEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      enableRealTimeFeatures: options.enableRealTimeFeatures !== false,
      enableCaching: options.enableCaching !== false,
      enableAlerts: options.enableAlerts !== false,
      enableMEVProtection: options.enableMEVProtection !== false,
      multiProviderWebSocket: options.multiProviderWebSocket !== false,
      ...options
    };
    
    // Initialize providers and core services
    this.web3Provider = null;
    
    // Legacy components (maintained for compatibility)
    this.priceMonitor = null;
    this.profitCalculator = null;
    this.transactionBuilder = null;
    this.arbitrageDetector = null;
    
    // New real-time components
    this.priceOracleManager = null;
    this.priceAggregator = null;
    this.mempoolMonitor = null;
    this.eventListenerManager = null;
    this.webSocketManager = null;
    this.dataRouter = null;
    this.cacheManager = null;
    this.opportunityPipeline = null;
    this.alertManager = null;
    
    // Engine state
    this.isRunning = false;
    this.isPaused = false;
    this.initializationComplete = false;
    
    // Opportunity tracking (enhanced)
    this.activeOpportunities = new Map();
    this.executedTrades = new Map();
    this.opportunityHistory = [];
    this.realTimeOpportunities = new Map();
    
    // Token pairs to monitor (expanded)
    this.monitoredPairs = [
      { tokenA: config.TOKENS.WETH, tokenB: config.TOKENS.USDC, exchange: 'uniswap-v2' },
      { tokenA: config.TOKENS.WETH, tokenB: config.TOKENS.USDC, exchange: 'uniswap-v3' },
      { tokenA: config.TOKENS.WETH, tokenB: config.TOKENS.USDT, exchange: 'uniswap-v2' },
      { tokenA: config.TOKENS.WETH, tokenB: config.TOKENS.USDT, exchange: 'uniswap-v3' },
      { tokenA: config.TOKENS.USDC, tokenB: config.TOKENS.USDT, exchange: 'uniswap-v2' },
      { tokenA: config.TOKENS.USDC, tokenB: config.TOKENS.USDT, exchange: 'uniswap-v3' },
      { tokenA: config.TOKENS.WETH, tokenB: config.TOKENS.DAI, exchange: 'uniswap-v2' },
      { tokenA: config.TOKENS.WETH, tokenB: config.TOKENS.DAI, exchange: 'uniswap-v3' }
    ];
    
    // WebSocket providers configuration
    this.wsProviders = [
      { id: 'infura-ws', url: config.RPC_URL?.replace('https', 'wss'), priority: 1 },
      { id: 'alchemy-ws', url: process.env.ALCHEMY_WS_URL, priority: 2 },
      { id: 'quicknode-ws', url: process.env.QUICKNODE_WS_URL, priority: 3 }
    ].filter(provider => provider.url);
    
    // Performance metrics (enhanced)
    this.stats = {
      uptime: 0,
      startTime: null,
      totalOpportunities: 0,
      profitableOpportunities: 0,
      executedTrades: 0,
      totalProfit: 0,
      totalGasCost: 0,
      successRate: 0,
      
      // Real-time metrics
      realTimeOpportunities: 0,
      mevOpportunities: 0,
      priceUpdateLatency: 0,
      eventProcessingLatency: 0,
      cacheHitRate: 0,
      alertsSent: 0
    };
    
    // Configuration (enhanced)
    this.engineConfig = {
      maxSimultaneousOpportunities: 5,
      minProfitThreshold: config.MIN_PROFIT_THRESHOLD,
      maxTradeAmount: config.MAX_TRADE_AMOUNT,
      opportunityTimeout: 30000, // 30 seconds
      executionTimeout: 60000, // 1 minute
      
      // Real-time configuration
      priceUpdateInterval: 5000, // 5 seconds
      eventProcessingBatchSize: 100,
      cacheExpirationTime: 300000, // 5 minutes
      alertPriority: 'high',
      enableMEVProtection: true
    };
  }

  /**
   * Initialize the enhanced core arbitrage engine
   */
  async initialize() {
    console.log('🚀 Initializing Enhanced Core Arbitrage Engine...');
    
    try {
      // 1. Initialize Web3 provider
      console.log('📡 Connecting to blockchain...');
      this.web3Provider = new Web3Provider();
      await this.web3Provider.connect();
      
      if (!this.web3Provider.isConnected()) {
        throw new Error('Failed to connect to blockchain');
      }
      
      // 2. Initialize caching layer (if enabled)
      if (this.options.enableCaching) {
        console.log('💾 Initializing cache manager...');
        this.cacheManager = new CacheManager({
          redisUrl: config.REDIS_URL,
          keyPrefix: 'arbitrage:',
          defaultTTL: this.engineConfig.cacheExpirationTime / 1000
        });
        await this.cacheManager.initialize();
      }
      
      // 3. Initialize WebSocket manager (if enabled)
      if (this.options.multiProviderWebSocket && this.wsProviders.length > 0) {
        console.log('🌐 Initializing WebSocket manager...');
        this.webSocketManager = new WebSocketManager(this.wsProviders, {
          maxReconnectAttempts: 10,
          healthCheckInterval: 30000
        });
        await this.webSocketManager.initialize();
      }
      
      // 4. Initialize real-time components
      if (this.options.enableRealTimeFeatures) {
        await this.initializeRealTimeComponents();
      }
      
      // 5. Initialize legacy core services
      console.log('🔧 Initializing core services...');
      await this.initializeServices();
      
      // 6. Set up event listeners
      console.log('📡 Setting up event system...');
      this.setupEventListeners();
      
      // 7. Validate configuration
      this.validateConfiguration();
      
      // 8. Setup opportunity pipeline integration
      if (this.options.enableRealTimeFeatures) {
        this.setupOpportunityPipelineIntegration();
      }
      
      this.initializationComplete = true;
      console.log('✅ Enhanced Core Arbitrage Engine initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced Core Arbitrage Engine:', error.message);
      throw error;
    }
  }
  
  /**
   * Initialize real-time components
   */
  async initializeRealTimeComponents() {
    console.log('⚡ Initializing real-time components...');
    
    // Initialize Price Oracle Manager
    this.priceOracleManager = new PriceOracleManager({
      updateInterval: this.engineConfig.priceUpdateInterval,
      chainlinkEnabled: true,
      uniswapEnabled: true,
      dexAggregatorEnabled: true,
      websocketEnabled: true
    });
    await this.priceOracleManager.initialize(this.web3Provider);
    console.log('  ✅ Price Oracle Manager initialized');
    
    // Initialize Price Aggregator
    this.priceAggregator = new PriceAggregator({
      minSources: 2,
      outlierThreshold: 0.05,
      maxPriceAge: 30000
    });
    await this.priceAggregator.initialize();
    console.log('  ✅ Price Aggregator initialized');
    
    // Initialize Event Listener Manager
    this.eventListenerManager = new EventListenerManager({
      batchSize: this.engineConfig.eventProcessingBatchSize,
      blockConfirmations: 1
    });
    
    const wsProvider = this.webSocketManager ? 
      this.webSocketManager.primaryProvider?.connection : 
      this.web3Provider;
      
    await this.eventListenerManager.initialize(this.web3Provider, wsProvider);
    console.log('  ✅ Event Listener Manager initialized');
    
    // Initialize Data Router
    this.dataRouter = new DataRouter({
      maxCacheSize: 10000,
      batchSize: this.engineConfig.eventProcessingBatchSize,
      enableCaching: this.options.enableCaching
    });
    await this.dataRouter.initialize();
    console.log('  ✅ Data Router initialized');
    
    // Initialize Alert Manager (if enabled)
    if (this.options.enableAlerts) {
      this.alertManager = new AlertManager({
        enableDiscord: !!process.env.DISCORD_WEBHOOK,
        enableTelegram: !!process.env.TELEGRAM_BOT_TOKEN,
        enableSlack: !!process.env.SLACK_WEBHOOK,
        discordWebhook: process.env.DISCORD_WEBHOOK,
        telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
        telegramChatIds: process.env.TELEGRAM_CHAT_IDS?.split(',') || [],
        slackWebhook: process.env.SLACK_WEBHOOK
      });
      await this.alertManager.initialize();
      console.log('  ✅ Alert Manager initialized');
    }
    
    // Initialize Opportunity Pipeline
    this.opportunityPipeline = new OpportunityPipeline({
      minProfitThreshold: this.engineConfig.minProfitThreshold,
      maxConcurrentOpportunities: this.engineConfig.maxSimultaneousOpportunities,
      opportunityTimeout: this.engineConfig.opportunityTimeout
    });
    
    await this.opportunityPipeline.initialize({
      priceOracleManager: this.priceOracleManager,
      priceAggregator: this.priceAggregator,
      mempoolMonitor: this.mempoolMonitor,
      cacheManager: this.cacheManager
    });
    console.log('  ✅ Opportunity Pipeline initialized');
    
    // Setup real-time event routing
    this.setupRealTimeEventRouting();
  }
  
  /**
   * Setup real-time event routing
   */
  setupRealTimeEventRouting() {
    // Add data transformation handlers
    this.dataRouter.addHandler('priceHandler', async (events) => {
      for (const event of events) {
        await this.handleRealTimePriceEvent(event);
      }
    });
    
    this.dataRouter.addHandler('arbitrageHandler', async (events) => {
      for (const event of events) {
        await this.handleRealTimeArbitrageEvent(event);
      }
    });
    
    this.dataRouter.addHandler('mevHandler', async (events) => {
      for (const event of events) {
        await this.handleRealTimeMEVEvent(event);
      }
    });
    
    // Add event transformers
    this.dataRouter.addTransformer('priceTransformer', (data) => {
      return {
        ...data,
        normalized: true,
        processedAt: Date.now(),
        source: 'real_time_pipeline'
      };
    });
  }
  
  /**
   * Setup opportunity pipeline integration
   */
  setupOpportunityPipelineIntegration() {
    if (!this.opportunityPipeline) return;
    
    // Listen for ready opportunities
    this.opportunityPipeline.on('opportunityReady', (opportunity) => {
      this.handleOpportunityReady(opportunity);
    });
    
    // Listen for execution requests
    this.opportunityPipeline.on('executeOpportunity', (opportunity) => {
      this.executeRealTimeOpportunity(opportunity);
    });
    
    // Forward our opportunity events to the pipeline
    this.on('opportunityDetected', (opportunity) => {
      if (this.opportunityPipeline) {
        this.opportunityPipeline.routeEvent(opportunity, {
          source: 'core_engine',
          priority: 'high'
        });
      }
    });
  }

  /**
   * Initialize all core services (legacy)
   */
  async initializeServices() {
    // Initialize price monitoring
    this.priceMonitor = new PriceMonitor(this.web3Provider);
    console.log('✅ Price Monitor initialized');
    
    // Initialize profit calculator
    this.profitCalculator = new ProfitCalculator(this.web3Provider);
    console.log('✅ Profit Calculator initialized');
    
    // Initialize enhanced mempool monitor
    const mempoolOptions = {
      enableGasAnalysis: true,
      enableMEVDetection: this.options.enableMEVProtection,
      enableFlashbotIntegration: this.options.enableMEVProtection
    };
    this.mempoolMonitor = new MempoolMonitor(this.web3Provider, mempoolOptions);
    console.log('✅ Enhanced Mempool Monitor initialized');
    
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
    // Legacy price monitoring events
    this.priceMonitor.on('priceChange', this.handlePriceChange.bind(this));
    this.priceMonitor.on('blockUpdate', this.handleBlockUpdate.bind(this));
    this.priceMonitor.on('monitoringTick', this.handleMonitoringTick.bind(this));
    
    // Enhanced mempool monitoring events
    this.mempoolMonitor.on('opportunityDetected', this.handleMempoolOpportunity.bind(this));
    this.mempoolMonitor.on('mevDetected', this.handleMEVDetection.bind(this));
    this.mempoolMonitor.on('highPriorityOpportunity', this.handleHighPriorityOpportunity.bind(this));
    this.mempoolMonitor.on('sandwichAttackDetected', this.handleSandwichAttack.bind(this));
    this.mempoolMonitor.on('frontRunningDetected', this.handleFrontRunning.bind(this));
    
    // Transaction builder events
    this.transactionBuilder.on('transactionSent', this.handleTransactionSent.bind(this));
    this.transactionBuilder.on('transactionConfirmed', this.handleTransactionConfirmed.bind(this));
    this.transactionBuilder.on('transactionFailed', this.handleTransactionFailed.bind(this));
    
    // Real-time component events
    if (this.options.enableRealTimeFeatures) {
      this.setupRealTimeEventListeners();
    }
    
    console.log('✅ Event listeners configured');
  }
  
  /**
   * Setup real-time event listeners
   */
  setupRealTimeEventListeners() {
    // Price Oracle Manager events
    if (this.priceOracleManager) {
      this.priceOracleManager.on('priceUpdate', this.handleRealTimePriceUpdate.bind(this));
      this.priceOracleManager.on('priceAnomaly', this.handlePriceAnomaly.bind(this));
      this.priceOracleManager.on('sourceFailover', this.handlePriceSourceFailover.bind(this));
    }
    
    // Price Aggregator events
    if (this.priceAggregator) {
      this.priceAggregator.on('arbitrageOpportunitiesFound', this.handleArbitrageOpportunities.bind(this));
      this.priceAggregator.on('outliersDetected', this.handlePriceOutliers.bind(this));
    }
    
    // Event Listener Manager events
    if (this.eventListenerManager) {
      this.eventListenerManager.on('event:arbitrage', this.handleBlockchainArbitrageEvent.bind(this));
      this.eventListenerManager.on('newBlock', this.handleNewBlock.bind(this));
      this.eventListenerManager.on('missedBlocks', this.handleMissedBlocks.bind(this));
    }
    
    // WebSocket Manager events
    if (this.webSocketManager) {
      this.webSocketManager.on('providerConnected', this.handleProviderConnected.bind(this));
      this.webSocketManager.on('providerDisconnected', this.handleProviderDisconnected.bind(this));
      this.webSocketManager.on('failover', this.handleProviderFailover.bind(this));
    }
    
    console.log('✅ Real-time event listeners configured');
  }
  
  /**
   * Handle real-time price update
   */
  async handleRealTimePriceUpdate(data) {
    try {
      this.stats.realTimeOpportunities++;
      
      // Route through data router for processing
      if (this.dataRouter) {
        await this.dataRouter.routeEvent(data, {
          source: 'price_oracle',
          priority: 'high',
          type: 'price_update'
        });
      }
      
      // Update price update latency metric
      const latency = Date.now() - data.timestamp;
      this.stats.priceUpdateLatency = (this.stats.priceUpdateLatency + latency) / 2;
      
    } catch (error) {
      console.error('Error handling real-time price update:', error);
    }
  }
  
  /**
   * Handle price anomaly detection
   */
  async handlePriceAnomaly(data) {
    try {
      console.warn(`🚨 Price anomaly detected: ${data.symbol} - ${data.deviation.toFixed(2)}% deviation`);
      
      // Send alert if enabled
      if (this.alertManager) {
        await this.alertManager.sendAlert('opportunity', {
          type: 'price_anomaly',
          symbol: data.symbol,
          deviation: data.deviation,
          expectedPrice: data.expectedPrice,
          actualPrice: data.price,
          source: data.source
        }, { priority: 'critical' });
      }
      
      // Create high-priority opportunity
      const opportunity = {
        type: 'price_anomaly',
        symbol: data.symbol,
        profitPotential: Math.abs(data.deviation),
        confidence: 0.8,
        urgency: 'critical',
        timestamp: Date.now()
      };
      
      this.emit('opportunityDetected', opportunity);
      
    } catch (error) {
      console.error('Error handling price anomaly:', error);
    }
  }
  
  /**
   * Handle arbitrage opportunities from aggregator
   */
  async handleArbitrageOpportunities(data) {
    try {
      this.stats.realTimeOpportunities += data.opportunities.length;
      
      for (const opportunity of data.opportunities) {
        if (opportunity.netProfitPercentage >= this.engineConfig.minProfitThreshold * 100) {
          // Store in real-time opportunities
          const opportunityId = `rt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          this.realTimeOpportunities.set(opportunityId, {
            id: opportunityId,
            ...opportunity,
            symbol: data.symbol,
            detectedAt: Date.now(),
            status: 'detected'
          });
          
          this.emit('opportunityDetected', opportunity);
          
          // Send alert for high-value opportunities
          if (this.alertManager && opportunity.netProfitPercentage > 1) { // > 1% profit
            await this.alertManager.sendAlert('opportunity', {
              type: 'arbitrage',
              symbol: data.symbol,
              profit: opportunity.netProfitPercentage,
              confidence: opportunity.confidence,
              buyFrom: opportunity.buyFrom,
              sellTo: opportunity.sellTo
            });
          }
        }
      }
      
    } catch (error) {
      console.error('Error handling arbitrage opportunities:', error);
    }
  }
  
  /**
   * Handle sandwich attack detection
   */
  async handleSandwichAttack(data) {
    try {
      console.warn('🥪 Sandwich attack detected:', data.poolAddress);
      
      this.stats.mevOpportunities++;
      
      if (this.alertManager) {
        await this.alertManager.sendAlert('mev', {
          type: 'sandwich_attack',
          poolAddress: data.poolAddress,
          estimatedProfit: data.estimatedProfit?.estimatedProfit || 0,
          risk: 'high'
        }, { priority: 'critical' });
      }
      
    } catch (error) {
      console.error('Error handling sandwich attack:', error);
    }
  }
  
  /**
   * Handle front-running detection
   */
  async handleFrontRunning(data) {
    try {
      console.warn('🏃 Front-running detected:', data.transaction.hash);
      
      this.stats.mevOpportunities++;
      
      if (this.alertManager) {
        await this.alertManager.sendAlert('mev', {
          type: 'front_running',
          txHash: data.transaction.hash,
          gasPrice: data.gasPrice,
          gasPremium: data.gasPremium,
          suspicionLevel: data.suspicionLevel
        });
      }
      
    } catch (error) {
      console.error('Error handling front-running:', error);
    }
  }
  
  /**
   * Handle opportunity ready for execution
   */
  async handleOpportunityReady(opportunity) {
    try {
      console.log(`⚡ Opportunity ready for execution: ${opportunity.id}`);
      
      // Add to active opportunities for tracking
      this.activeOpportunities.set(opportunity.id, {
        ...opportunity,
        status: 'ready',
        readyAt: Date.now()
      });
      
    } catch (error) {
      console.error('Error handling opportunity ready:', error);
    }
  }
  
  /**
   * Execute real-time opportunity
   */
  async executeRealTimeOpportunity(opportunity) {
    try {
      console.log(`🚀 Executing real-time opportunity: ${opportunity.id}`);
      
      // Update opportunity status
      if (this.activeOpportunities.has(opportunity.id)) {
        const activeOpp = this.activeOpportunities.get(opportunity.id);
        activeOpp.status = 'executing';
        activeOpp.executionStarted = Date.now();
      }
      
      // Execute through existing transaction builder
      // This integrates with the legacy execution system
      await this.executeOpportunity(opportunity.id);
      
    } catch (error) {
      console.error('Error executing real-time opportunity:', error);
      
      if (this.alertManager) {
        await this.alertManager.sendAlert('error', {
          service: 'CoreArbitrageEngine',
          error: error.message,
          opportunityId: opportunity.id,
          timestamp: Date.now()
        });
      }
    }
  }
  
  /**
   * Handle real-time price event
   */
  async handleRealTimePriceEvent(event) {
    // Process price event through existing price change handler
    await this.handlePriceChange({
      pair: event.data.symbol,
      price: event.data.price,
      source: event.data.source,
      timestamp: event.data.timestamp,
      realTime: true
    });
  }
  
  /**
   * Handle real-time arbitrage event
   */
  async handleRealTimeArbitrageEvent(event) {
    // Create opportunity from event data
    const opportunity = {
      type: 'blockchain_event',
      data: event.data,
      confidence: 0.7,
      timestamp: event.data.timestamp || Date.now()
    };
    
    this.emit('opportunityDetected', opportunity);
  }
  
  /**
   * Handle real-time MEV event
   */
  async handleRealTimeMEVEvent(event) {
    this.stats.mevOpportunities++;
    
    // Send immediate alert for MEV events
    if (this.alertManager) {
      await this.alertManager.sendAlert('mev', {
        type: event.data.type,
        details: event.data,
        timestamp: Date.now()
      }, { priority: 'critical' });
    }
  }

  /**
   * Start the enhanced arbitrage engine
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Engine is already running');
      return;
    }
    
    if (!this.initializationComplete) {
      throw new Error('Engine must be initialized before starting');
    }
    
    console.log('🚀 Starting Enhanced Core Arbitrage Engine...');
    
    try {
      this.isRunning = true;
      this.stats.startTime = Date.now();
      
      // Start legacy components
      console.log('🔧 Starting core services...');
      
      // Start price monitoring
      console.log('📊 Starting price monitoring...');
      if (this.priceMonitor) {
        await this.priceMonitor.startMonitoring(this.monitoredPairs);
      }
      
      // Start mempool monitoring
      console.log('🕵️ Starting mempool monitoring...');
      if (this.mempoolMonitor) {
        await this.mempoolMonitor.startMonitoring();
      }
      
      // Start real-time components
      if (this.options.enableRealTimeFeatures) {
        await this.startRealTimeComponents();
      }
      
      // Start main engine loop
      console.log('🔄 Starting main engine loop...');
      this.startMainLoop();
      
      // Start performance monitoring
      this.startPerformanceMonitoring();
      
      console.log('✅ Enhanced Core Arbitrage Engine started successfully');
      console.log(`💰 Monitoring ${this.monitoredPairs.length} token pairs`);
      console.log(`📈 Profit threshold: ${this.engineConfig.minProfitThreshold}%`);
      console.log(`💵 Max trade amount: $${this.engineConfig.maxTradeAmount}`);
      
      if (this.options.enableRealTimeFeatures) {
        console.log('⚡ Real-time features: ENABLED');
        console.log(`📡 WebSocket providers: ${this.wsProviders.length}`);
        console.log(`💾 Caching: ${this.options.enableCaching ? 'ENABLED' : 'DISABLED'}`);
        console.log(`🚨 Alerts: ${this.options.enableAlerts ? 'ENABLED' : 'DISABLED'}`);
      }
      
      // Send startup alert
      if (this.alertManager) {
        await this.alertManager.sendAlert('performance', {
          metric: 'engine_startup',
          value: 'successful',
          features: {
            realTime: this.options.enableRealTimeFeatures,
            caching: this.options.enableCaching,
            mevProtection: this.options.enableMEVProtection,
            multiProvider: this.options.multiProviderWebSocket
          },
          timestamp: Date.now()
        });
      }
      
      this.emit('engineStarted', {
        timestamp: Date.now(),
        monitoredPairs: this.monitoredPairs.length,
        config: this.engineConfig,
        realTimeEnabled: this.options.enableRealTimeFeatures
      });
      
    } catch (error) {
      console.error('❌ Failed to start Enhanced Core Arbitrage Engine:', error.message);
      this.isRunning = false;
      
      if (this.alertManager) {
        await this.alertManager.sendAlert('error', {
          service: 'CoreArbitrageEngine',
          error: error.message,
          timestamp: Date.now()
        });
      }
      
      throw error;
    }
  }
  
  /**
   * Start real-time components
   */
  async startRealTimeComponents() {
    console.log('⚡ Starting real-time components...');
    
    // Start price oracle manager
    if (this.priceOracleManager) {
      this.priceOracleManager.startPriceUpdates();
      console.log('  ✅ Price Oracle Manager started');
    }
    
    // Start event listener manager
    if (this.eventListenerManager) {
      await this.eventListenerManager.startBlockMonitoring();
      await this.eventListenerManager.monitorPoolCreation();
      console.log('  ✅ Event Listener Manager started');
    }
    
    // Start opportunity pipeline processing
    if (this.opportunityPipeline) {
      // Pipeline starts automatically during initialization
      console.log('  ✅ Opportunity Pipeline running');
    }
    
    console.log('✅ Real-time components started');
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
   * Stop the enhanced arbitrage engine
   */
  async stop() {
    console.log('🛑 Stopping Enhanced Core Arbitrage Engine...');
    
    this.isRunning = false;
    
    // Stop real-time components first
    if (this.options.enableRealTimeFeatures) {
      await this.stopRealTimeComponents();
    }
    
    // Stop legacy services
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
    
    // Send shutdown alert
    if (this.alertManager) {
      await this.alertManager.sendAlert('performance', {
        metric: 'engine_shutdown',
        value: 'graceful',
        finalStats: this.getStats(),
        timestamp: Date.now()
      });
    }
    
    console.log('✅ Enhanced Core Arbitrage Engine stopped');
    
    this.emit('engineStopped', { 
      timestamp: Date.now(),
      finalStats: this.getStats()
    });
  }
  
  /**
   * Stop real-time components
   */
  async stopRealTimeComponents() {
    console.log('⚡ Stopping real-time components...');
    
    // Stop in reverse order of initialization
    if (this.opportunityPipeline) {
      await this.opportunityPipeline.stop();
      console.log('  ✅ Opportunity Pipeline stopped');
    }
    
    if (this.alertManager) {
      await this.alertManager.stop();
      console.log('  ✅ Alert Manager stopped');
    }
    
    if (this.dataRouter) {
      await this.dataRouter.stop();
      console.log('  ✅ Data Router stopped');
    }
    
    if (this.eventListenerManager) {
      await this.eventListenerManager.stopMonitoring();
      console.log('  ✅ Event Listener Manager stopped');
    }
    
    if (this.priceAggregator) {
      // PriceAggregator doesn't have async cleanup, just clear caches
      this.priceAggregator.clearCache?.();
      console.log('  ✅ Price Aggregator stopped');
    }
    
    if (this.priceOracleManager) {
      this.priceOracleManager.stopPriceUpdates();
      console.log('  ✅ Price Oracle Manager stopped');
    }
    
    if (this.webSocketManager) {
      await this.webSocketManager.shutdown();
      console.log('  ✅ WebSocket Manager stopped');
    }
    
    if (this.cacheManager) {
      await this.cacheManager.shutdown();
      console.log('  ✅ Cache Manager stopped');
    }
    
    console.log('✅ Real-time components stopped');
  }
  
  /**
   * Get comprehensive engine statistics
   */
  getStats() {
    const uptime = this.stats.startTime ? Date.now() - this.stats.startTime : 0;
    
    const baseStats = {
      ...this.stats,
      uptime: uptime,
      uptimeHours: (uptime / (1000 * 60 * 60)).toFixed(2),
      activeOpportunities: this.activeOpportunities.size,
      realTimeActiveOpportunities: this.realTimeOpportunities.size,
      successRate: this.stats.totalOpportunities > 0 ? 
        (this.stats.profitableOpportunities / this.stats.totalOpportunities) * 100 : 0
    };
    
    // Add real-time component stats if available
    if (this.options.enableRealTimeFeatures) {
      baseStats.realTimeComponents = {};
      
      if (this.priceOracleManager) {
        baseStats.realTimeComponents.priceOracle = this.priceOracleManager.getMetrics();
      }
      
      if (this.priceAggregator) {
        baseStats.realTimeComponents.priceAggregator = this.priceAggregator.getMetrics();
      }
      
      if (this.eventListenerManager) {
        baseStats.realTimeComponents.eventListener = this.eventListenerManager.getMetrics();
      }
      
      if (this.webSocketManager) {
        baseStats.realTimeComponents.webSocket = this.webSocketManager.getStats();
      }
      
      if (this.cacheManager) {
        baseStats.realTimeComponents.cache = this.cacheManager.getStats();
      }
      
      if (this.opportunityPipeline) {
        baseStats.realTimeComponents.opportunityPipeline = this.opportunityPipeline.getStats();
      }
      
      if (this.alertManager) {
        baseStats.realTimeComponents.alerts = this.alertManager.getStats();
      }
      
      if (this.dataRouter) {
        baseStats.realTimeComponents.dataRouter = this.dataRouter.getStats();
      }
    }
    
    // Legacy component stats
    baseStats.legacyComponents = {};
    
    if (this.priceMonitor) {
      baseStats.legacyComponents.priceMonitor = this.priceMonitor.getStats?.() || {};
    }
    
    if (this.mempoolMonitor) {
      baseStats.legacyComponents.mempoolMonitor = this.mempoolMonitor.getStats();
    }
    
    if (this.transactionBuilder) {
      baseStats.legacyComponents.transactionBuilder = this.transactionBuilder.getStats?.() || {};
    }
    
    return baseStats;
  }
  
  /**
   * Get detailed analytics
   */
  getAnalytics() {
    const stats = this.getStats();
    
    return {
      performance: {
        uptime: stats.uptime,
        opportunitiesPerHour: stats.uptimeHours > 0 ? 
          (stats.totalOpportunities / parseFloat(stats.uptimeHours)).toFixed(2) : 0,
        profitabilityRate: stats.successRate.toFixed(2) + '%',
        averageProcessingTime: stats.averageProcessingTime || 0
      },
      realTimeMetrics: stats.realTimeComponents || {},
      opportunities: {
        total: stats.totalOpportunities,
        profitable: stats.profitableOpportunities,
        realTime: stats.realTimeOpportunities,
        mev: stats.mevOpportunities,
        active: stats.activeOpportunities
      },
      system: {
        initializationComplete: this.initializationComplete,
        featuresEnabled: {
          realTime: this.options.enableRealTimeFeatures,
          caching: this.options.enableCaching,
          alerts: this.options.enableAlerts,
          mevProtection: this.options.enableMEVProtection,
          multiProvider: this.options.multiProviderWebSocket
        }
      }
    };
  }

  /**
   * Get comprehensive engine status
   */
  getStatus() {
    const stats = this.getStats();
    
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      initializationComplete: this.initializationComplete,
      uptime: stats.uptime,
      stats: stats,
      activeOpportunities: this.activeOpportunities.size,
      realTimeActiveOpportunities: this.realTimeOpportunities.size,
      services: {
        web3Connected: this.web3Provider?.isConnected() || false,
        priceMonitorActive: this.priceMonitor?.isMonitoring || false,
        mempoolMonitorActive: this.mempoolMonitor?.isMonitoring || false,
        
        // Real-time service status
        priceOracleActive: this.priceOracleManager?.isActive || false,
        eventListenerActive: this.eventListenerManager?.isActive || false,
        webSocketManagerConnected: this.webSocketManager?.isActive || false,
        cacheManagerConnected: this.cacheManager?.isConnected || false,
        opportunityPipelineActive: this.opportunityPipeline?.isActive || false,
        alertManagerActive: this.alertManager?.isActive || false
      },
      configuration: {
        monitoredPairs: this.monitoredPairs.length,
        minProfitThreshold: this.engineConfig.minProfitThreshold,
        maxTradeAmount: this.engineConfig.maxTradeAmount,
        maxSimultaneousOpportunities: this.engineConfig.maxSimultaneousOpportunities,
        realTimeFeaturesEnabled: this.options.enableRealTimeFeatures
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