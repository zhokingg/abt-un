const { ethers } = require('ethers');
const EventEmitter = require('events');
const config = require('../config/config');

/**
 * Real-time Price Monitoring System for Uniswap V2 and Sushiswap
 * Implements WebSocket connections and advanced price tracking
 */
class PriceMonitor extends EventEmitter {
  constructor(web3Provider) {
    super();
    this.web3Provider = web3Provider;
    this.provider = web3Provider.provider;
    this.priceHistory = new Map(); // Token pair -> price history
    this.currentPrices = new Map(); // Token pair -> current price data
    this.subscriptions = new Set(); // Active WebSocket subscriptions
    this.isMonitoring = false;
    this.monitoringInterval = null;
    
    // Price tracking configuration
    this.maxHistorySize = 1000; // Keep last 1000 price points per pair
    this.priceCheckInterval = config.PRICE_CHECK_INTERVAL || 5000; // 5 seconds
    
    // Performance metrics
    this.stats = {
      totalUpdates: 0,
      priceChanges: 0,
      lastUpdate: null,
      averageUpdateTime: 0
    };
  }

  /**
   * Initialize and start real-time price monitoring
   */
  async startMonitoring(tokenPairs = []) {
    console.log('🚀 Starting real-time price monitoring...');
    
    if (!this.provider) {
      throw new Error('Web3 provider not available');
    }

    this.isMonitoring = true;
    
    // Set up WebSocket connection for real-time block updates
    await this.setupWebSocketConnection();
    
    // Initialize price history for token pairs
    this.initializePriceHistory(tokenPairs);
    
    // Start continuous price monitoring
    this.startContinuousMonitoring();
    
    console.log(`✅ Price monitoring started for ${tokenPairs.length} token pairs`);
    
    return true;
  }

  /**
   * Set up WebSocket connection for real-time data
   */
  async setupWebSocketConnection() {
    try {
      // Listen for new blocks to trigger price updates
      this.provider.on('block', async (blockNumber) => {
        if (this.isMonitoring) {
          await this.onNewBlock(blockNumber);
        }
      });

      console.log('🔌 WebSocket connection established for block monitoring');
    } catch (error) {
      console.error('❌ Failed to setup WebSocket connection:', error.message);
      // Fallback to polling mode
      this.setupPollingMode();
    }
  }

  /**
   * Fallback polling mode when WebSocket fails
   */
  setupPollingMode() {
    console.log('🔄 Falling back to polling mode for price updates');
    
    this.monitoringInterval = setInterval(async () => {
      if (this.isMonitoring) {
        const blockNumber = await this.provider.getBlockNumber();
        await this.onNewBlock(blockNumber);
      }
    }, this.priceCheckInterval);
  }

  /**
   * Handle new block events for price updates
   */
  async onNewBlock(blockNumber) {
    const startTime = Date.now();
    
    try {
      // Update prices for all monitored pairs
      await this.updateAllPrices(blockNumber);
      
      // Update performance metrics
      const updateTime = Date.now() - startTime;
      this.updateStats(updateTime);
      
      // Emit block update event
      this.emit('blockUpdate', {
        blockNumber,
        timestamp: Date.now(),
        updateTime
      });
      
    } catch (error) {
      console.error(`❌ Error processing block ${blockNumber}:`, error.message);
    }
  }

  /**
   * Initialize price history tracking for token pairs
   */
  initializePriceHistory(tokenPairs) {
    tokenPairs.forEach(pair => {
      const pairId = this.getPairId(pair);
      
      if (!this.priceHistory.has(pairId)) {
        this.priceHistory.set(pairId, []);
        this.currentPrices.set(pairId, null);
      }
    });
  }

  /**
   * Update prices for all monitored token pairs
   */
  async updateAllPrices(blockNumber) {
    const promises = [];
    
    for (const [pairId, history] of this.priceHistory.entries()) {
      promises.push(this.updatePairPrice(pairId, blockNumber));
    }
    
    await Promise.allSettled(promises);
  }

  /**
   * Update price for a specific token pair
   */
  async updatePairPrice(pairId, blockNumber) {
    try {
      // Parse pair ID to get token addresses
      const [tokenA, tokenB, exchange] = pairId.split('_');
      
      // Fetch current prices from both V2 and V3 (or Sushiswap)
      const priceData = await this.fetchPriceData(tokenA, tokenB, exchange);
      
      if (priceData) {
        // Store in price history
        this.addToPriceHistory(pairId, priceData, blockNumber);
        
        // Update current price
        this.currentPrices.set(pairId, priceData);
        
        // Detect significant price changes
        await this.detectPriceChange(pairId, priceData);
      }
      
    } catch (error) {
      console.error(`❌ Error updating price for ${pairId}:`, error.message);
    }
  }

  /**
   * Fetch price data from DEX
   */
  async fetchPriceData(tokenA, tokenB, exchange) {
    // This would integrate with existing V2/V3 fetchers
    // For now, return mock data structure
    return {
      tokenA,
      tokenB,
      exchange,
      price: Math.random() * 2000 + 1000, // Mock price
      timestamp: Date.now(),
      liquidity: Math.random() * 1000000,
      volume24h: Math.random() * 100000
    };
  }

  /**
   * Add price data to history with size management
   */
  addToPriceHistory(pairId, priceData, blockNumber) {
    const history = this.priceHistory.get(pairId);
    
    const pricePoint = {
      ...priceData,
      blockNumber,
      timestamp: Date.now()
    };
    
    history.push(pricePoint);
    
    // Maintain maximum history size
    if (history.length > this.maxHistorySize) {
      history.shift(); // Remove oldest entry
    }
    
    this.priceHistory.set(pairId, history);
  }

  /**
   * Detect significant price changes and emit events
   */
  async detectPriceChange(pairId, newPriceData) {
    const history = this.priceHistory.get(pairId);
    
    if (history.length < 2) return;
    
    const previousPrice = history[history.length - 2];
    const priceDifference = Math.abs(newPriceData.price - previousPrice.price);
    const percentageChange = (priceDifference / previousPrice.price) * 100;
    
    // Emit price change event if significant
    if (percentageChange >= 0.1) { // 0.1% threshold
      this.stats.priceChanges++;
      
      this.emit('priceChange', {
        pairId,
        previousPrice: previousPrice.price,
        newPrice: newPriceData.price,
        percentageChange,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get price trend analysis for a token pair
   */
  getPriceTrend(pairId, timeWindow = 300000) { // 5 minutes default
    const history = this.priceHistory.get(pairId);
    if (!history || history.length < 10) return null;
    
    const cutoffTime = Date.now() - timeWindow;
    const recentHistory = history.filter(point => point.timestamp >= cutoffTime);
    
    if (recentHistory.length < 2) return null;
    
    const startPrice = recentHistory[0].price;
    const endPrice = recentHistory[recentHistory.length - 1].price;
    const priceChange = ((endPrice - startPrice) / startPrice) * 100;
    
    // Calculate volatility
    const prices = recentHistory.map(p => p.price);
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / prices.length;
    const volatility = Math.sqrt(variance) / avgPrice * 100;
    
    return {
      pairId,
      timeWindow,
      priceChange,
      volatility,
      dataPoints: recentHistory.length,
      startPrice,
      endPrice,
      avgPrice
    };
  }

  /**
   * Get current price for a token pair
   */
  getCurrentPrice(pairId) {
    return this.currentPrices.get(pairId);
  }

  /**
   * Get price history for a token pair
   */
  getPriceHistory(pairId, limit = 100) {
    const history = this.priceHistory.get(pairId) || [];
    return history.slice(-limit);
  }

  /**
   * Start continuous monitoring with interval checks
   */
  startContinuousMonitoring() {
    // Additional monitoring for opportunities detection
    setInterval(() => {
      if (this.isMonitoring) {
        this.emit('monitoringTick', {
          timestamp: Date.now(),
          activePairs: this.priceHistory.size,
          stats: this.getStats()
        });
      }
    }, 10000); // Every 10 seconds
  }

  /**
   * Update performance statistics
   */
  updateStats(updateTime) {
    this.stats.totalUpdates++;
    this.stats.lastUpdate = Date.now();
    
    // Calculate rolling average update time
    this.stats.averageUpdateTime = 
      (this.stats.averageUpdateTime * 0.9) + (updateTime * 0.1);
  }

  /**
   * Get monitoring statistics
   */
  getStats() {
    return {
      ...this.stats,
      activePairs: this.priceHistory.size,
      totalPricePoints: Array.from(this.priceHistory.values())
        .reduce((sum, history) => sum + history.length, 0)
    };
  }

  /**
   * Generate pair ID from token addresses and exchange
   */
  getPairId(pair) {
    return `${pair.tokenA}_${pair.tokenB}_${pair.exchange}`;
  }

  /**
   * Stop monitoring and cleanup
   */
  async stopMonitoring() {
    console.log('🛑 Stopping price monitoring...');
    
    this.isMonitoring = false;
    
    // Clear interval monitoring
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    // Remove all listeners
    if (this.provider) {
      this.provider.removeAllListeners('block');
    }
    
    // Clear subscriptions
    this.subscriptions.clear();
    
    console.log('✅ Price monitoring stopped');
  }
}

module.exports = PriceMonitor;