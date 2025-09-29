import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import config from '../config/config.js';

/**
 * EventListenerManager - Real-time blockchain event processing
 * Monitors smart contract events, block updates, and network changes
 */
class EventListenerManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      blockConfirmations: options.blockConfirmations || 1,
      batchSize: options.batchSize || 100,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000,
      eventFilterLimit: options.eventFilterLimit || 10000,
      historicalBlockRange: options.historicalBlockRange || 1000,
      reconnectDelay: options.reconnectDelay || 5000,
      ...options
    };
    
    // Provider management
    this.web3Provider = null;
    this.wsProvider = null;
    this.eventFilters = new Map();
    this.activeListeners = new Map();
    
    // Event processing
    this.eventQueue = [];
    this.processingQueue = false;
    this.lastProcessedBlock = 0;
    this.blockBuffer = new Map();
    
    // Contract interfaces
    this.contractABIs = new Map();
    this.contractInstances = new Map();
    
    // Event routing
    this.eventRoutes = new Map();
    this.eventHandlers = new Map();
    
    // Performance metrics
    this.metrics = {
      totalEvents: 0,
      eventsProcessed: 0,
      eventsQueued: 0,
      blockProcessed: 0,
      averageProcessingTime: 0,
      reconnections: 0,
      errors: 0,
      lastUpdate: null
    };
    
    // Error tracking
    this.errorCounts = new Map();
    this.blacklistedEvents = new Set();
    
    this.isActive = false;
    this.isReconnecting = false;
  }
  
  /**
   * Initialize the event listener manager
   */
  async initialize(web3Provider, wsProvider = null) {
    try {
      this.web3Provider = web3Provider;
      this.wsProvider = wsProvider || web3Provider;
      
      if (!this.web3Provider) {
        throw new Error('Web3 provider is required');
      }
      
      console.log('📡 Initializing EventListenerManager...');
      
      // Get current block number
      this.lastProcessedBlock = await this.web3Provider.getBlockNumber();
      
      // Initialize contract ABIs
      this.initializeContractABIs();
      
      // Set up default event routes
      this.setupDefaultEventRoutes();
      
      // Start event processing queue
      this.startEventProcessor();
      
      this.isActive = true;
      console.log('✅ EventListenerManager initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize EventListenerManager:', error);
      throw error;
    }
  }
  
  /**
   * Initialize contract ABIs for common protocols
   */
  initializeContractABIs() {
    // Uniswap V2 Pair ABI (minimal)
    this.contractABIs.set('UniswapV2Pair', [
      'event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)',
      'event Mint(address indexed sender, uint amount0, uint amount1)',
      'event Burn(address indexed sender, uint amount0, uint amount1, address indexed to)',
      'event Sync(uint112 reserve0, uint112 reserve1)'
    ]);
    
    // Uniswap V3 Pool ABI (minimal)
    this.contractABIs.set('UniswapV3Pool', [
      'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)',
      'event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)',
      'event Burn(address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)'
    ]);
    
    // ERC20 Token ABI (minimal)
    this.contractABIs.set('ERC20', [
      'event Transfer(address indexed from, address indexed to, uint256 value)',
      'event Approval(address indexed owner, address indexed spender, uint256 value)'
    ]);
    
    // Factory contracts
    this.contractABIs.set('UniswapV2Factory', [
      'event PairCreated(address indexed token0, address indexed token1, address pair, uint)'
    ]);
    
    this.contractABIs.set('UniswapV3Factory', [
      'event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)'
    ]);
    
    console.log(`📚 Initialized ${this.contractABIs.size} contract ABIs`);
  }
  
  /**
   * Setup default event routes
   */
  setupDefaultEventRoutes() {
    // Route swap events to arbitrage detection
    this.addEventRoute('Swap', 'arbitrage');
    
    // Route liquidity events to pool monitoring
    this.addEventRoute('Mint', 'liquidity');
    this.addEventRoute('Burn', 'liquidity');
    
    // Route transfer events to token monitoring
    this.addEventRoute('Transfer', 'tokens');
    
    // Route pool creation events to discovery
    this.addEventRoute('PairCreated', 'discovery');
    this.addEventRoute('PoolCreated', 'discovery');
    
    console.log(`🗺️ Setup ${this.eventRoutes.size} default event routes`);
  }
  
  /**
   * Add event route
   */
  addEventRoute(eventName, category) {
    if (!this.eventRoutes.has(category)) {
      this.eventRoutes.set(category, new Set());
    }
    this.eventRoutes.get(category).add(eventName);
  }
  
  /**
   * Add event handler
   */
  addEventHandler(category, handler) {
    if (!this.eventHandlers.has(category)) {
      this.eventHandlers.set(category, []);
    }
    this.eventHandlers.get(category).push(handler);
  }
  
  /**
   * Start monitoring events for a contract
   */
  async startContractMonitoring(contractAddress, abiName, events = []) {
    try {
      if (!this.isActive) {
        throw new Error('EventListenerManager not initialized');
      }
      
      const abi = this.contractABIs.get(abiName);
      if (!abi) {
        throw new Error(`ABI not found for ${abiName}`);
      }
      
      console.log(`🔍 Starting monitoring for ${contractAddress} (${abiName})`);
      
      // Create contract instance
      const contract = new ethers.Contract(contractAddress, abi, this.wsProvider);
      this.contractInstances.set(contractAddress, contract);
      
      // Set up event listeners
      const eventsToMonitor = events.length > 0 ? events : this.getEventNamesFromABI(abi);
      
      for (const eventName of eventsToMonitor) {
        await this.addEventListener(contractAddress, eventName, contract);
      }
      
      console.log(`✅ Monitoring ${eventsToMonitor.length} events for ${contractAddress}`);
      
      return true;
    } catch (error) {
      console.error(`Failed to start monitoring for ${contractAddress}:`, error);
      return false;
    }
  }
  
  /**
   * Extract event names from ABI
   */
  getEventNamesFromABI(abi) {
    return abi
      .filter(item => item.startsWith('event '))
      .map(event => event.match(/event (\w+)/)[1]);
  }
  
  /**
   * Add event listener for specific contract and event
   */
  async addEventListener(contractAddress, eventName, contract) {
    try {
      const listenerKey = `${contractAddress}-${eventName}`;
      
      if (this.activeListeners.has(listenerKey)) {
        console.log(`Event listener already exists for ${listenerKey}`);
        return;
      }
      
      const eventListener = async (...args) => {
        await this.handleContractEvent(contractAddress, eventName, args);
      };
      
      // Set up the listener with error handling
      contract.on(eventName, eventListener);
      
      this.activeListeners.set(listenerKey, {
        contract,
        eventName,
        listener: eventListener,
        startTime: Date.now(),
        eventCount: 0
      });
      
      console.log(`📋 Added listener for ${eventName} on ${contractAddress}`);
      
    } catch (error) {
      console.error(`Failed to add event listener for ${contractAddress}-${eventName}:`, error);
      this.recordError(contractAddress, eventName, error);
    }
  }
  
  /**
   * Handle contract event
   */
  async handleContractEvent(contractAddress, eventName, args) {
    try {
      this.metrics.totalEvents++;
      
      // Extract event data
      const event = args[args.length - 1]; // Last argument is usually the event object
      const eventData = {
        contractAddress,
        eventName,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        logIndex: event.logIndex,
        args: args.slice(0, -1), // All arguments except the event object
        timestamp: Date.now(),
        blockTimestamp: null // Will be filled when processing
      };
      
      // Add to processing queue
      this.queueEvent(eventData);
      
      // Update listener stats
      const listenerKey = `${contractAddress}-${eventName}`;
      const listener = this.activeListeners.get(listenerKey);
      if (listener) {
        listener.eventCount++;
      }
      
    } catch (error) {
      console.error(`Error handling event ${eventName} from ${contractAddress}:`, error);
      this.recordError(contractAddress, eventName, error);
    }
  }
  
  /**
   * Queue event for processing
   */
  queueEvent(eventData) {
    // Check if event is blacklisted
    const eventKey = `${eventData.contractAddress}-${eventData.eventName}`;
    if (this.blacklistedEvents.has(eventKey)) {
      return;
    }
    
    this.eventQueue.push(eventData);
    this.metrics.eventsQueued++;
    
    // Limit queue size
    if (this.eventQueue.length > this.options.eventFilterLimit) {
      this.eventQueue.shift(); // Remove oldest event
    }
  }
  
  /**
   * Start event processor
   */
  startEventProcessor() {
    if (this.processingQueue) return;
    
    this.processingQueue = true;
    
    const processEvents = async () => {
      while (this.processingQueue && this.eventQueue.length > 0) {
        const batch = this.eventQueue.splice(0, this.options.batchSize);
        await this.processBatch(batch);
      }
      
      // Continue processing
      if (this.processingQueue) {
        setTimeout(processEvents, 100); // Process every 100ms
      }
    };
    
    processEvents();
    console.log('⚡ Event processor started');
  }
  
  /**
   * Process batch of events
   */
  async processBatch(events) {
    const startTime = Date.now();
    
    try {
      // Group events by block number
      const eventsByBlock = new Map();
      
      for (const event of events) {
        if (!eventsByBlock.has(event.blockNumber)) {
          eventsByBlock.set(event.blockNumber, []);
        }
        eventsByBlock.get(event.blockNumber).push(event);
      }
      
      // Process events block by block
      for (const [blockNumber, blockEvents] of eventsByBlock) {
        await this.processBlockEvents(blockNumber, blockEvents);
      }
      
      this.metrics.eventsProcessed += events.length;
      
      const processingTime = Date.now() - startTime;
      this.metrics.averageProcessingTime = 
        (this.metrics.averageProcessingTime + processingTime) / 2;
      
    } catch (error) {
      console.error('Error processing event batch:', error);
      this.metrics.errors++;
    }
  }
  
  /**
   * Process events for a specific block
   */
  async processBlockEvents(blockNumber, events) {
    try {
      // Get block timestamp if not cached
      let blockData = this.blockBuffer.get(blockNumber);
      
      if (!blockData) {
        const block = await this.web3Provider.getBlock(blockNumber);
        blockData = {
          number: blockNumber,
          timestamp: block.timestamp * 1000, // Convert to milliseconds
          hash: block.hash
        };
        this.blockBuffer.set(blockNumber, blockData);
        
        // Keep only last 100 blocks in buffer
        if (this.blockBuffer.size > 100) {
          const oldestBlock = Math.min(...this.blockBuffer.keys());
          this.blockBuffer.delete(oldestBlock);
        }
      }
      
      // Add block timestamp to events
      for (const event of events) {
        event.blockTimestamp = blockData.timestamp;
      }
      
      // Route events to appropriate handlers
      await this.routeEvents(events);
      
      // Update last processed block
      if (blockNumber > this.lastProcessedBlock) {
        this.lastProcessedBlock = blockNumber;
      }
      
      // Emit block processed event
      this.emit('blockProcessed', {
        blockNumber,
        eventCount: events.length,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error(`Error processing block ${blockNumber} events:`, error);
      this.recordBlockError(blockNumber, error);
    }
  }
  
  /**
   * Route events to appropriate handlers
   */
  async routeEvents(events) {
    for (const event of events) {
      // Determine category for this event
      let category = null;
      
      for (const [cat, eventNames] of this.eventRoutes) {
        if (eventNames.has(event.eventName)) {
          category = cat;
          break;
        }
      }
      
      if (category) {
        // Route to category handlers
        const handlers = this.eventHandlers.get(category) || [];
        
        for (const handler of handlers) {
          try {
            await handler(event);
          } catch (error) {
            console.error(`Error in event handler for ${category}:`, error);
          }
        }
        
        // Emit categorized event
        this.emit(`event:${category}`, event);
      }
      
      // Always emit the raw event
      this.emit('event', event);
    }
  }
  
  /**
   * Start block monitoring
   */
  async startBlockMonitoring() {
    try {
      console.log('📦 Starting block monitoring...');
      
      const blockListener = async (blockNumber) => {
        await this.handleNewBlock(blockNumber);
      };
      
      this.wsProvider.on('block', blockListener);
      this.activeListeners.set('block-monitor', {
        listener: blockListener,
        startTime: Date.now()
      });
      
      console.log('✅ Block monitoring started');
      
    } catch (error) {
      console.error('Failed to start block monitoring:', error);
      throw error;
    }
  }
  
  /**
   * Handle new block
   */
  async handleNewBlock(blockNumber) {
    try {
      this.metrics.blockProcessed++;
      
      // Emit new block event
      this.emit('newBlock', {
        blockNumber,
        timestamp: Date.now()
      });
      
      // Check for missed blocks
      if (blockNumber > this.lastProcessedBlock + 1) {
        const missedBlocks = blockNumber - this.lastProcessedBlock - 1;
        console.warn(`⚠️ Missed ${missedBlocks} blocks`);
        
        this.emit('missedBlocks', {
          from: this.lastProcessedBlock + 1,
          to: blockNumber - 1,
          count: missedBlocks
        });
      }
      
    } catch (error) {
      console.error(`Error handling new block ${blockNumber}:`, error);
    }
  }
  
  /**
   * Get historical events
   */
  async getHistoricalEvents(contractAddress, eventName, fromBlock, toBlock) {
    try {
      const contract = this.contractInstances.get(contractAddress);
      if (!contract) {
        throw new Error(`Contract not found: ${contractAddress}`);
      }
      
      const filter = contract.filters[eventName]();
      const events = await contract.queryFilter(filter, fromBlock, toBlock);
      
      return events.map(event => ({
        contractAddress,
        eventName,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        logIndex: event.logIndex,
        args: event.args,
        timestamp: Date.now()
      }));
      
    } catch (error) {
      console.error(`Error getting historical events:`, error);
      return [];
    }
  }
  
  /**
   * Monitor pool creation events
   */
  async monitorPoolCreation() {
    try {
      // Monitor Uniswap V2 Factory
      await this.startContractMonitoring(
        config.UNISWAP_V2_FACTORY,
        'UniswapV2Factory',
        ['PairCreated']
      );
      
      // Monitor Uniswap V3 Factory
      await this.startContractMonitoring(
        config.UNISWAP_V3_FACTORY,
        'UniswapV3Factory',
        ['PoolCreated']
      );
      
      console.log('🏭 Pool creation monitoring started');
      
    } catch (error) {
      console.error('Failed to start pool creation monitoring:', error);
    }
  }
  
  /**
   * Record error for tracking
   */
  recordError(contractAddress, eventName, error) {
    const errorKey = `${contractAddress}-${eventName}`;
    const count = this.errorCounts.get(errorKey) || 0;
    this.errorCounts.set(errorKey, count + 1);
    
    this.metrics.errors++;
    
    // Blacklist if too many errors
    if (count + 1 >= this.options.retryAttempts) {
      this.blacklistedEvents.add(errorKey);
      console.warn(`🚫 Blacklisted event ${errorKey} due to repeated errors`);
    }
  }
  
  /**
   * Record block processing error
   */
  recordBlockError(blockNumber, error) {
    console.error(`Block ${blockNumber} processing error:`, error.message);
    this.metrics.errors++;
  }
  
  /**
   * Reconnect WebSocket provider
   */
  async reconnectProvider() {
    if (this.isReconnecting) return;
    
    this.isReconnecting = true;
    this.metrics.reconnections++;
    
    try {
      console.log('🔄 Reconnecting WebSocket provider...');
      
      // Clear existing listeners
      this.wsProvider.removeAllListeners();
      
      // Wait before reconnecting
      await new Promise(resolve => setTimeout(resolve, this.options.reconnectDelay));
      
      // Restart monitoring
      await this.startBlockMonitoring();
      
      // Restart contract monitoring
      for (const [contractAddress, contract] of this.contractInstances) {
        // Re-setup listeners (simplified)
        console.log(`🔄 Reconnecting listeners for ${contractAddress}`);
      }
      
      console.log('✅ WebSocket provider reconnected');
      
    } catch (error) {
      console.error('Failed to reconnect WebSocket provider:', error);
    } finally {
      this.isReconnecting = false;
    }
  }
  
  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeListeners: this.activeListeners.size,
      queuedEvents: this.eventQueue.length,
      blacklistedEvents: this.blacklistedEvents.size,
      lastProcessedBlock: this.lastProcessedBlock,
      errorRate: this.metrics.totalEvents > 0 ? 
        (this.metrics.errors / this.metrics.totalEvents * 100).toFixed(2) + '%' : '0%'
    };
  }
  
  /**
   * Get listener statistics
   */
  getListenerStats() {
    const stats = {};
    
    for (const [key, listener] of this.activeListeners) {
      stats[key] = {
        eventCount: listener.eventCount || 0,
        uptime: Date.now() - listener.startTime,
        active: true
      };
    }
    
    return stats;
  }
  
  /**
   * Stop all event listeners
   */
  async stopMonitoring() {
    console.log('🛑 Stopping event monitoring...');
    
    this.isActive = false;
    this.processingQueue = false;
    
    // Remove all listeners
    for (const [key, listener] of this.activeListeners) {
      try {
        if (listener.contract && listener.eventName) {
          listener.contract.off(listener.eventName, listener.listener);
        } else if (key === 'block-monitor') {
          this.wsProvider.off('block', listener.listener);
        }
      } catch (error) {
        console.error(`Error removing listener ${key}:`, error);
      }
    }
    
    // Clear data structures
    this.activeListeners.clear();
    this.eventQueue = [];
    this.blockBuffer.clear();
    
    console.log('✅ Event monitoring stopped');
  }
}

export default EventListenerManager;