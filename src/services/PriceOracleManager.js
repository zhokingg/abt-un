import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import axios from 'axios';
import config from '../config/config.js';

/**
 * PriceOracleManager - Real-time price feed integration
 * Integrates Chainlink price feeds, Uniswap oracles, DEX aggregators, and WebSocket connections
 */
class PriceOracleManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      updateInterval: options.updateInterval || 5000, // 5 seconds
      priceValidityTime: options.priceValidityTime || 30000, // 30 seconds
      chainlinkEnabled: options.chainlinkEnabled !== false,
      uniswapEnabled: options.uniswapEnabled !== false,
      dexAggregatorEnabled: options.dexAggregatorEnabled !== false,
      websocketEnabled: options.websocketEnabled !== false,
      failoverThreshold: options.failoverThreshold || 3,
      anomalyThreshold: options.anomalyThreshold || 0.1, // 10% price deviation
      ...options
    };
    
    // Provider setup
    this.web3Provider = null;
    this.websocketProviders = new Map();
    this.activeConnections = new Set();
    
    // Price feed configurations
    this.chainlinkFeeds = new Map([
      ['ETH/USD', '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419'],
      ['BTC/USD', '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c'],
      ['USDC/USD', '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6'],
      ['DAI/USD', '0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9']
    ]);
    
    // DEX aggregator APIs
    this.dexAggregators = {
      '1inch': {
        baseUrl: 'https://api.1inch.io/v5.0/1',
        enabled: true,
        weight: 0.3
      },
      'paraswap': {
        baseUrl: 'https://apiv5.paraswap.io',
        enabled: true,
        weight: 0.3
      },
      '0x': {
        baseUrl: 'https://api.0x.org',
        enabled: true,
        weight: 0.2
      }
    };
    
    // WebSocket connections for exchanges
    this.exchangeConnections = {
      binance: {
        url: 'wss://stream.binance.com:9443/ws',
        enabled: true,
        weight: 0.4
      },
      coinbase: {
        url: 'wss://ws-feed.pro.coinbase.com',
        enabled: true,
        weight: 0.3
      },
      kraken: {
        url: 'wss://ws.kraken.com',
        enabled: true,
        weight: 0.3
      }
    };
    
    // Price data storage
    this.priceData = new Map();
    this.priceHistory = new Map();
    this.lastUpdate = new Map();
    
    // Source reliability tracking
    this.sourceReliability = new Map();
    this.failureCount = new Map();
    
    // Performance metrics
    this.metrics = {
      totalUpdates: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      averageLatency: 0,
      anomaliesDetected: 0,
      failovers: 0,
      lastUpdateTime: null
    };
    
    this.isActive = false;
    this.updateTimer = null;
  }
  
  /**
   * Initialize the price oracle manager
   */
  async initialize(web3Provider) {
    try {
      this.web3Provider = web3Provider;
      
      if (!this.web3Provider) {
        throw new Error('Web3 provider is required');
      }
      
      console.log('🔗 Initializing PriceOracleManager...');
      
      // Initialize source reliability tracking
      this.initializeReliabilityTracking();
      
      // Set up Chainlink feeds if enabled
      if (this.options.chainlinkEnabled) {
        await this.initializeChainlinkFeeds();
      }
      
      // Set up WebSocket connections if enabled
      if (this.options.websocketEnabled) {
        await this.initializeWebSocketConnections();
      }
      
      this.isActive = true;
      console.log('✅ PriceOracleManager initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize PriceOracleManager:', error);
      throw error;
    }
  }
  
  /**
   * Initialize reliability tracking for all sources
   */
  initializeReliabilityTracking() {
    // Initialize Chainlink reliability
    for (const [pair, address] of this.chainlinkFeeds) {
      this.sourceReliability.set(`chainlink-${pair}`, {
        successRate: 1.0,
        averageLatency: 0,
        lastSuccess: Date.now(),
        failureStreak: 0
      });
    }
    
    // Initialize DEX aggregator reliability
    for (const [name, config] of Object.entries(this.dexAggregators)) {
      this.sourceReliability.set(`dex-${name}`, {
        successRate: 1.0,
        averageLatency: 0,
        lastSuccess: Date.now(),
        failureStreak: 0
      });
    }
    
    // Initialize exchange WebSocket reliability
    for (const [name, config] of Object.entries(this.exchangeConnections)) {
      this.sourceReliability.set(`websocket-${name}`, {
        successRate: 1.0,
        averageLatency: 0,
        lastSuccess: Date.now(),
        failureStreak: 0
      });
    }
  }
  
  /**
   * Initialize Chainlink price feeds
   */
  async initializeChainlinkFeeds() {
    console.log('🔗 Setting up Chainlink price feeds...');
    
    for (const [pair, feedAddress] of this.chainlinkFeeds) {
      try {
        // Test connection to each feed
        await this.getChainlinkPrice(pair, feedAddress);
        console.log(`  ✅ Chainlink ${pair} feed initialized`);
      } catch (error) {
        console.log(`  ⚠️ Chainlink ${pair} feed failed to initialize:`, error.message);
        this.recordSourceFailure(`chainlink-${pair}`);
      }
    }
  }
  
  /**
   * Initialize WebSocket connections for exchanges
   */
  async initializeWebSocketConnections() {
    console.log('🌐 Setting up WebSocket connections...');
    
    for (const [exchange, config] of Object.entries(this.exchangeConnections)) {
      if (!config.enabled) continue;
      
      try {
        await this.connectToExchange(exchange, config);
        console.log(`  ✅ ${exchange} WebSocket connected`);
      } catch (error) {
        console.log(`  ⚠️ ${exchange} WebSocket failed to connect:`, error.message);
        this.recordSourceFailure(`websocket-${exchange}`);
      }
    }
  }
  
  /**
   * Connect to a specific exchange WebSocket
   */
  async connectToExchange(exchange, config) {
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(config.url);
        
        ws.onopen = () => {
          this.websocketProviders.set(exchange, ws);
          this.activeConnections.add(exchange);
          
          // Subscribe to relevant price feeds based on exchange
          this.subscribeToExchangeFeeds(exchange, ws);
          resolve();
        };
        
        ws.onmessage = (event) => {
          this.handleWebSocketMessage(exchange, JSON.parse(event.data));
        };
        
        ws.onerror = (error) => {
          console.error(`WebSocket error for ${exchange}:`, error);
          this.recordSourceFailure(`websocket-${exchange}`);
          reject(error);
        };
        
        ws.onclose = () => {
          this.activeConnections.delete(exchange);
          console.log(`WebSocket connection closed for ${exchange}`);
          
          // Auto-reconnect after delay
          setTimeout(() => {
            this.connectToExchange(exchange, config).catch(console.error);
          }, 5000);
        };
        
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Subscribe to price feeds for a specific exchange
   */
  subscribeToExchangeFeeds(exchange, ws) {
    switch (exchange) {
      case 'binance':
        // Subscribe to multiple symbol price streams
        ws.send(JSON.stringify({
          method: 'SUBSCRIBE',
          params: ['ethusdt@ticker', 'btcusdt@ticker', 'adausdt@ticker'],
          id: 1
        }));
        break;
        
      case 'coinbase':
        ws.send(JSON.stringify({
          type: 'subscribe',
          product_ids: ['ETH-USD', 'BTC-USD', 'ADA-USD'],
          channels: ['ticker']
        }));
        break;
        
      case 'kraken':
        ws.send(JSON.stringify({
          event: 'subscribe',
          pair: ['ETH/USD', 'BTC/USD', 'ADA/USD'],
          subscription: { name: 'ticker' }
        }));
        break;
    }
  }
  
  /**
   * Handle incoming WebSocket messages
   */
  handleWebSocketMessage(exchange, data) {
    try {
      const priceUpdate = this.parseExchangeMessage(exchange, data);
      
      if (priceUpdate) {
        this.updatePriceFromWebSocket(exchange, priceUpdate);
        this.recordSourceSuccess(`websocket-${exchange}`);
      }
    } catch (error) {
      console.error(`Error handling WebSocket message from ${exchange}:`, error);
      this.recordSourceFailure(`websocket-${exchange}`);
    }
  }
  
  /**
   * Parse exchange-specific WebSocket messages
   */
  parseExchangeMessage(exchange, data) {
    switch (exchange) {
      case 'binance':
        if (data.e === '24hrTicker') {
          return {
            symbol: this.normalizePair(data.s),
            price: parseFloat(data.c),
            timestamp: Date.now()
          };
        }
        break;
        
      case 'coinbase':
        if (data.type === 'ticker') {
          return {
            symbol: this.normalizePair(data.product_id),
            price: parseFloat(data.price),
            timestamp: Date.now()
          };
        }
        break;
        
      case 'kraken':
        if (data.channelName === 'ticker') {
          return {
            symbol: this.normalizePair(Object.keys(data)[1]),
            price: parseFloat(data[Object.keys(data)[1]].c[0]),
            timestamp: Date.now()
          };
        }
        break;
    }
    
    return null;
  }
  
  /**
   * Normalize pair symbols across exchanges
   */
  normalizePair(symbol) {
    // Convert exchange-specific symbols to standardized format
    const normalizations = {
      'ETHUSDT': 'ETH/USD',
      'BTCUSDT': 'BTC/USD',
      'ETH-USD': 'ETH/USD',
      'BTC-USD': 'BTC/USD',
      'ETH/USD': 'ETH/USD',
      'BTC/USD': 'BTC/USD'
    };
    
    return normalizations[symbol.toUpperCase()] || symbol;
  }
  
  /**
   * Update price data from WebSocket source
   */
  updatePriceFromWebSocket(exchange, priceUpdate) {
    const { symbol, price, timestamp } = priceUpdate;
    const sourceKey = `websocket-${exchange}`;
    
    // Store the price update
    if (!this.priceData.has(symbol)) {
      this.priceData.set(symbol, new Map());
    }
    
    this.priceData.get(symbol).set(sourceKey, {
      price,
      timestamp,
      source: sourceKey,
      weight: this.exchangeConnections[exchange].weight
    });
    
    // Update price history
    this.addToPriceHistory(symbol, price, sourceKey, timestamp);
    
    // Emit price update event
    this.emit('priceUpdate', {
      symbol,
      source: sourceKey,
      price,
      timestamp
    });
    
    // Check for anomalies
    this.detectPriceAnomaly(symbol, price, sourceKey);
  }
  
  /**
   * Get price from Chainlink feed
   */
  async getChainlinkPrice(pair, feedAddress) {
    if (!feedAddress) {
      feedAddress = this.chainlinkFeeds.get(pair);
    }
    
    if (!feedAddress) {
      throw new Error(`No Chainlink feed address for ${pair}`);
    }
    
    try {
      const startTime = Date.now();
      
      // Chainlink price feed ABI (minimal)
      const priceFeedABI = [
        'function latestRoundData() external view returns (uint80 roundId, int256 price, uint256 startedAt, uint256 timeStamp, uint80 answeredInRound)'
      ];
      
      const priceFeed = new ethers.Contract(feedAddress, priceFeedABI, this.web3Provider);
      const roundData = await priceFeed.latestRoundData();
      
      const price = parseFloat(ethers.formatUnits(roundData.price, 8));
      const timestamp = parseInt(roundData.timeStamp) * 1000;
      const latency = Date.now() - startTime;
      
      this.recordSourceSuccess(`chainlink-${pair}`, latency);
      
      return {
        price,
        timestamp,
        feedAddress,
        confidence: 0.95,
        latency
      };
    } catch (error) {
      this.recordSourceFailure(`chainlink-${pair}`);
      throw error;
    }
  }
  
  /**
   * Get price from DEX aggregator
   */
  async getDEXAggregatorPrice(tokenA, tokenB, aggregator) {
    const config = this.dexAggregators[aggregator];
    if (!config || !config.enabled) {
      throw new Error(`DEX aggregator ${aggregator} not available`);
    }
    
    try {
      const startTime = Date.now();
      let response;
      
      switch (aggregator) {
        case '1inch':
          response = await axios.get(`${config.baseUrl}/quote`, {
            params: {
              fromTokenAddress: tokenA,
              toTokenAddress: tokenB,
              amount: ethers.parseEther('1').toString()
            }
          });
          break;
          
        case 'paraswap':
          response = await axios.get(`${config.baseUrl}/prices`, {
            params: {
              srcToken: tokenA,
              destToken: tokenB,
              amount: ethers.parseEther('1').toString(),
              network: 1
            }
          });
          break;
          
        case '0x':
          response = await axios.get(`${config.baseUrl}/swap/v1/quote`, {
            params: {
              sellToken: tokenA,
              buyToken: tokenB,
              sellAmount: ethers.parseEther('1').toString()
            }
          });
          break;
          
        default:
          throw new Error(`Unknown aggregator: ${aggregator}`);
      }
      
      const latency = Date.now() - startTime;
      this.recordSourceSuccess(`dex-${aggregator}`, latency);
      
      return {
        price: this.extractPriceFromResponse(aggregator, response.data),
        timestamp: Date.now(),
        source: aggregator,
        latency
      };
      
    } catch (error) {
      this.recordSourceFailure(`dex-${aggregator}`);
      throw error;
    }
  }
  
  /**
   * Extract price from DEX aggregator response
   */
  extractPriceFromResponse(aggregator, data) {
    switch (aggregator) {
      case '1inch':
        return parseFloat(ethers.formatEther(data.toTokenAmount));
      case 'paraswap':
        return parseFloat(ethers.formatEther(data.priceRoute.destAmount));
      case '0x':
        return parseFloat(ethers.formatEther(data.buyAmount));
      default:
        throw new Error(`Unknown aggregator response format: ${aggregator}`);
    }
  }
  
  /**
   * Start real-time price updates
   */
  startPriceUpdates() {
    if (!this.isActive) {
      throw new Error('PriceOracleManager not initialized');
    }
    
    console.log('🚀 Starting real-time price updates...');
    
    this.updateTimer = setInterval(() => {
      this.updateAllPrices().catch(console.error);
    }, this.options.updateInterval);
    
    // Immediate first update
    this.updateAllPrices().catch(console.error);
  }
  
  /**
   * Stop price updates
   */
  stopPriceUpdates() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    
    // Close WebSocket connections
    for (const [exchange, ws] of this.websocketProviders) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
    
    console.log('🛑 Price updates stopped');
  }
  
  /**
   * Update all price feeds
   */
  async updateAllPrices() {
    const startTime = Date.now();
    this.metrics.totalUpdates++;
    
    try {
      const updatePromises = [];
      
      // Update Chainlink feeds
      if (this.options.chainlinkEnabled) {
        for (const [pair] of this.chainlinkFeeds) {
          updatePromises.push(
            this.updateChainlinkPrice(pair).catch(error => 
              console.error(`Chainlink ${pair} update failed:`, error.message)
            )
          );
        }
      }
      
      // Update DEX aggregator prices
      if (this.options.dexAggregatorEnabled) {
        // Example token pairs for testing
        const testPairs = [
          [config.TOKENS.WETH, config.TOKENS.USDC],
          [config.TOKENS.WETH, config.TOKENS.DAI]
        ];
        
        for (const [tokenA, tokenB] of testPairs) {
          for (const aggregator of Object.keys(this.dexAggregators)) {
            if (this.dexAggregators[aggregator].enabled) {
              updatePromises.push(
                this.updateDEXPrice(tokenA, tokenB, aggregator).catch(error =>
                  console.error(`DEX ${aggregator} update failed:`, error.message)
                )
              );
            }
          }
        }
      }
      
      await Promise.allSettled(updatePromises);
      
      this.metrics.successfulUpdates++;
      this.metrics.lastUpdateTime = Date.now();
      this.metrics.averageLatency = (this.metrics.averageLatency + (Date.now() - startTime)) / 2;
      
      this.emit('allPricesUpdated', {
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        sources: this.getActiveSources()
      });
      
    } catch (error) {
      this.metrics.failedUpdates++;
      console.error('Failed to update all prices:', error);
    }
  }
  
  /**
   * Update Chainlink price for a specific pair
   */
  async updateChainlinkPrice(pair) {
    try {
      const priceData = await this.getChainlinkPrice(pair);
      const sourceKey = `chainlink-${pair}`;
      
      // Store the price update
      if (!this.priceData.has(pair)) {
        this.priceData.set(pair, new Map());
      }
      
      this.priceData.get(pair).set(sourceKey, {
        price: priceData.price,
        timestamp: priceData.timestamp,
        source: sourceKey,
        weight: 0.5, // High weight for Chainlink
        confidence: priceData.confidence
      });
      
      this.addToPriceHistory(pair, priceData.price, sourceKey, priceData.timestamp);
      
      this.emit('priceUpdate', {
        symbol: pair,
        source: sourceKey,
        price: priceData.price,
        timestamp: priceData.timestamp
      });
      
    } catch (error) {
      throw new Error(`Chainlink ${pair} update failed: ${error.message}`);
    }
  }
  
  /**
   * Update DEX price for token pair
   */
  async updateDEXPrice(tokenA, tokenB, aggregator) {
    try {
      const priceData = await this.getDEXAggregatorPrice(tokenA, tokenB, aggregator);
      const pair = `${tokenA}/${tokenB}`;
      const sourceKey = `dex-${aggregator}`;
      
      if (!this.priceData.has(pair)) {
        this.priceData.set(pair, new Map());
      }
      
      this.priceData.get(pair).set(sourceKey, {
        price: priceData.price,
        timestamp: priceData.timestamp,
        source: sourceKey,
        weight: this.dexAggregators[aggregator].weight,
        confidence: 0.8
      });
      
      this.addToPriceHistory(pair, priceData.price, sourceKey, priceData.timestamp);
      
      this.emit('priceUpdate', {
        symbol: pair,
        source: sourceKey,
        price: priceData.price,
        timestamp: priceData.timestamp
      });
      
    } catch (error) {
      throw new Error(`DEX ${aggregator} update failed: ${error.message}`);
    }
  }
  
  /**
   * Add price data to history with size management
   */
  addToPriceHistory(symbol, price, source, timestamp) {
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }
    
    const history = this.priceHistory.get(symbol);
    history.push({ price, source, timestamp });
    
    // Keep only last 1000 entries
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
  }
  
  /**
   * Detect price anomalies
   */
  detectPriceAnomaly(symbol, price, source) {
    if (!this.priceHistory.has(symbol)) return;
    
    const history = this.priceHistory.get(symbol);
    if (history.length < 5) return;
    
    // Calculate recent average (last 5 prices from different sources)
    const recentPrices = history.slice(-10)
      .filter(h => h.source !== source)
      .map(h => h.price);
    
    if (recentPrices.length === 0) return;
    
    const avgPrice = recentPrices.reduce((sum, p) => sum + p, 0) / recentPrices.length;
    const deviation = Math.abs(price - avgPrice) / avgPrice;
    
    if (deviation > this.options.anomalyThreshold) {
      this.metrics.anomaliesDetected++;
      
      this.emit('priceAnomaly', {
        symbol,
        source,
        price,
        expectedPrice: avgPrice,
        deviation: deviation * 100, // percentage
        timestamp: Date.now()
      });
      
      console.warn(`🚨 Price anomaly detected for ${symbol} from ${source}: ${price} vs expected ${avgPrice.toFixed(4)} (${(deviation * 100).toFixed(2)}% deviation)`);
    }
  }
  
  /**
   * Record source success with latency tracking
   */
  recordSourceSuccess(sourceKey, latency = 0) {
    const reliability = this.sourceReliability.get(sourceKey) || {
      successRate: 0,
      averageLatency: 0,
      lastSuccess: 0,
      failureStreak: 0
    };
    
    reliability.lastSuccess = Date.now();
    reliability.failureStreak = 0;
    reliability.averageLatency = (reliability.averageLatency + latency) / 2;
    
    // Update success rate (moving average)
    reliability.successRate = Math.min(reliability.successRate * 0.99 + 0.01, 1.0);
    
    this.sourceReliability.set(sourceKey, reliability);
  }
  
  /**
   * Record source failure and handle failover
   */
  recordSourceFailure(sourceKey) {
    const reliability = this.sourceReliability.get(sourceKey) || {
      successRate: 1.0,
      averageLatency: 0,
      lastSuccess: Date.now(),
      failureStreak: 0
    };
    
    reliability.failureStreak++;
    reliability.successRate = Math.max(reliability.successRate * 0.95, 0.1);
    
    this.sourceReliability.set(sourceKey, reliability);
    
    // Trigger failover if threshold exceeded
    if (reliability.failureStreak >= this.options.failoverThreshold) {
      this.handleSourceFailover(sourceKey);
    }
  }
  
  /**
   * Handle source failover
   */
  handleSourceFailover(failedSource) {
    this.metrics.failovers++;
    
    this.emit('sourceFailover', {
      source: failedSource,
      timestamp: Date.now(),
      reliability: this.sourceReliability.get(failedSource)
    });
    
    console.warn(`⚠️ Source failover triggered for ${failedSource}`);
  }
  
  /**
   * Get aggregated price for a symbol
   */
  getAggregatedPrice(symbol) {
    const sources = this.priceData.get(symbol);
    if (!sources || sources.size === 0) {
      return null;
    }
    
    // Filter out stale prices
    const validSources = Array.from(sources.values()).filter(
      source => Date.now() - source.timestamp < this.options.priceValidityTime
    );
    
    if (validSources.length === 0) {
      return null;
    }
    
    // Calculate weighted average
    let totalWeight = 0;
    let weightedSum = 0;
    
    for (const source of validSources) {
      const reliability = this.sourceReliability.get(source.source);
      const adjustedWeight = source.weight * (reliability?.successRate || 0.5);
      
      weightedSum += source.price * adjustedWeight;
      totalWeight += adjustedWeight;
    }
    
    if (totalWeight === 0) {
      return null;
    }
    
    const aggregatedPrice = weightedSum / totalWeight;
    
    // Calculate confidence based on source agreement
    const confidence = this.calculatePriceConfidence(validSources);
    
    return {
      price: aggregatedPrice,
      confidence,
      sources: validSources.length,
      timestamp: Date.now(),
      spread: this.calculatePriceSpread(validSources)
    };
  }
  
  /**
   * Calculate price confidence based on source agreement
   */
  calculatePriceConfidence(sources) {
    if (sources.length <= 1) return 0.5;
    
    const prices = sources.map(s => s.price);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    
    // Calculate standard deviation
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / avgPrice;
    
    // Lower variation = higher confidence
    return Math.max(0.1, 1 - coefficientOfVariation * 5);
  }
  
  /**
   * Calculate price spread between highest and lowest sources
   */
  calculatePriceSpread(sources) {
    if (sources.length <= 1) return 0;
    
    const prices = sources.map(s => s.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    return ((maxPrice - minPrice) / minPrice) * 100; // percentage
  }
  
  /**
   * Get active sources
   */
  getActiveSources() {
    const activeSources = [];
    
    for (const [sourceKey, reliability] of this.sourceReliability) {
      if (Date.now() - reliability.lastSuccess < 60000) { // Active within last minute
        activeSources.push({
          source: sourceKey,
          successRate: reliability.successRate,
          averageLatency: reliability.averageLatency,
          lastSuccess: reliability.lastSuccess
        });
      }
    }
    
    return activeSources;
  }
  
  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeSources: this.getActiveSources().length,
      totalSources: this.sourceReliability.size,
      activeWebSockets: this.activeConnections.size,
      priceDataPoints: this.priceData.size
    };
  }
  
  /**
   * Get price history for a symbol
   */
  getPriceHistory(symbol, limit = 100) {
    const history = this.priceHistory.get(symbol);
    if (!history) return [];
    
    return history.slice(-limit);
  }
}

export default PriceOracleManager;