import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import config from '../config/config.js';

/**
 * PriceDetector - Real-time price difference detection across exchanges
 * Monitors price variations and detects arbitrage opportunities
 */
class PriceDetector extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      priceThreshold: options.priceThreshold || 0.005, // 0.5% minimum price difference
      updateInterval: options.updateInterval || 1000, // 1 second update interval
      maxSlippage: options.maxSlippage || 0.01, // 1% max slippage
      enableV2: options.enableV2 !== false, // Enable Uniswap V2 by default
      enableV3: options.enableV3 !== false, // Enable Uniswap V3 by default
      ...options
    };
    
    // Price tracking
    this.priceCache = new Map();
    this.priceHistory = new Map();
    this.lastUpdate = new Map();
    
    // Exchange configurations
    this.exchanges = {
      'uniswap-v2': {
        name: 'Uniswap V2',
        factoryAddress: config.UNISWAP_V2_FACTORY,
        enabled: this.options.enableV2
      },
      'uniswap-v3': {
        name: 'Uniswap V3',
        factoryAddress: config.UNISWAP_V3_FACTORY,
        enabled: this.options.enableV3
      }
    };
    
    // Performance metrics
    this.metrics = {
      totalDetections: 0,
      validOpportunities: 0,
      averagePriceDifference: 0,
      lastDetectionTime: null,
      detectionsPerSecond: 0
    };
    
    this.isActive = false;
    this.updateTimer = null;
  }
  
  /**
   * Initialize the price detector
   */
  async initialize(web3Provider) {
    try {
      this.web3Provider = web3Provider;
      
      if (!this.web3Provider || !this.web3Provider.isConnected()) {
        throw new Error('Web3 provider not connected');
      }
      
      console.log('📊 Initializing Price Detector...');
      console.log(`   Threshold: ${this.options.priceThreshold * 100}%`);
      console.log(`   Update interval: ${this.options.updateInterval}ms`);
      console.log(`   Exchanges: ${Object.keys(this.exchanges).filter(k => this.exchanges[k].enabled).join(', ')}`);
      
      this.isActive = true;
      this.emit('initialized');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Price Detector:', error.message);
      throw error;
    }
  }
  
  /**
   * Start price monitoring
   */
  startMonitoring(tokenPairs = []) {
    if (!this.isActive) {
      throw new Error('Price detector not initialized');
    }
    
    console.log(`📊 Starting price monitoring for ${tokenPairs.length} pairs...`);
    
    // Store token pairs to monitor
    this.monitoredPairs = tokenPairs;
    
    // Start update timer
    this.updateTimer = setInterval(() => {
      this.updatePrices();
    }, this.options.updateInterval);
    
    // Initial price update
    this.updatePrices();
    
    this.emit('monitoringStarted', { pairs: tokenPairs.length });
  }
  
  /**
   * Stop price monitoring
   */
  stopMonitoring() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    
    console.log('📊 Price monitoring stopped');
    this.emit('monitoringStopped');
  }
  
  /**
   * Update prices for all monitored pairs
   */
  async updatePrices() {
    if (!this.monitoredPairs || this.monitoredPairs.length === 0) {
      return;
    }
    
    const updatePromises = this.monitoredPairs.map(pair => 
      this.updatePairPrices(pair).catch(error => {
        console.warn(`⚠️ Failed to update prices for ${pair.tokenA}-${pair.tokenB}:`, error.message);
        return null;
      })
    );
    
    const results = await Promise.allSettled(updatePromises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
    
    this.emit('pricesUpdated', { successful, total: this.monitoredPairs.length });
  }
  
  /**
   * Update prices for a specific token pair
   */
  async updatePairPrices(pair) {
    const pairKey = `${pair.tokenA}-${pair.tokenB}`;
    const currentTime = Date.now();
    
    try {
      // Get prices from enabled exchanges
      const pricePromises = Object.entries(this.exchanges)
        .filter(([_, exchange]) => exchange.enabled)
        .map(([exchangeId, exchange]) => 
          this.getPairPrice(pair, exchangeId).then(price => ({
            exchangeId,
            exchange: exchange.name,
            price,
            timestamp: currentTime
          }))
        );
      
      const prices = await Promise.all(pricePromises);
      const validPrices = prices.filter(p => p.price && p.price > 0);
      
      if (validPrices.length < 2) {
        return null; // Need at least 2 prices to compare
      }
      
      // Update price cache
      this.priceCache.set(pairKey, validPrices);
      this.lastUpdate.set(pairKey, currentTime);
      
      // Store price history
      if (!this.priceHistory.has(pairKey)) {
        this.priceHistory.set(pairKey, []);
      }
      
      const history = this.priceHistory.get(pairKey);
      history.push({ prices: validPrices, timestamp: currentTime });
      
      // Keep only last 100 entries
      if (history.length > 100) {
        history.splice(0, history.length - 100);
      }
      
      // Detect arbitrage opportunities
      this.detectArbitrageOpportunities(pair, validPrices);
      
      return validPrices;
    } catch (error) {
      console.error(`❌ Error updating prices for ${pairKey}:`, error.message);
      return null;
    }
  }
  
  /**
   * Get price for a token pair on a specific exchange
   */
  async getPairPrice(pair, exchangeId) {
    // This is a simplified implementation
    // In a real implementation, you would call the actual exchange contracts
    
    try {
      if (exchangeId === 'uniswap-v2') {
        return this.getUniswapV2Price(pair);
      } else if (exchangeId === 'uniswap-v3') {
        return this.getUniswapV3Price(pair);
      }
      
      return null;
    } catch (error) {
      console.warn(`⚠️ Failed to get ${exchangeId} price for ${pair.tokenA}-${pair.tokenB}:`, error.message);
      return null;
    }
  }
  
  /**
   * Get Uniswap V2 price (simplified)
   */
  async getUniswapV2Price(pair) {
    // Simplified mock implementation
    // In production, this would interact with Uniswap V2 contracts
    const basePrice = 2000 + Math.random() * 100; // Mock WETH-USDC price around $2000-2100
    return basePrice;
  }
  
  /**
   * Get Uniswap V3 price (simplified)
   */
  async getUniswapV3Price(pair) {
    // Simplified mock implementation
    // In production, this would interact with Uniswap V3 contracts
    const basePrice = 2000 + Math.random() * 100; // Mock WETH-USDC price around $2000-2100
    const variation = (Math.random() - 0.5) * 0.02; // ±1% variation
    return basePrice * (1 + variation);
  }
  
  /**
   * Detect arbitrage opportunities from price data
   */
  detectArbitrageOpportunities(pair, prices) {
    if (prices.length < 2) return;
    
    const pairKey = `${pair.tokenA}-${pair.tokenB}`;
    
    // Find highest and lowest prices
    const sortedPrices = [...prices].sort((a, b) => b.price - a.price);
    const highest = sortedPrices[0];
    const lowest = sortedPrices[sortedPrices.length - 1];
    
    if (!highest || !lowest || highest.price <= 0 || lowest.price <= 0) {
      return;
    }
    
    // Calculate price difference percentage
    const priceDifference = (highest.price - lowest.price) / lowest.price;
    
    // Update metrics
    this.metrics.totalDetections++;
    this.metrics.lastDetectionTime = Date.now();
    
    // Check if opportunity meets threshold
    if (priceDifference >= this.options.priceThreshold) {
      this.metrics.validOpportunities++;
      
      const opportunity = {
        id: `price_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'price_arbitrage',
        pair: pairKey,
        tokenA: pair.tokenA,
        tokenB: pair.tokenB,
        buyExchange: lowest.exchangeId,
        sellExchange: highest.exchangeId,
        buyPrice: lowest.price,
        sellPrice: highest.price,
        priceDifference,
        profitPercentage: priceDifference * 100,
        timestamp: Date.now(),
        confidence: this.calculateConfidence(prices),
        estimatedGasCost: 0.001 // ETH
      };
      
      console.log(`🎯 Price arbitrage detected: ${pairKey}`);
      console.log(`   Buy: ${lowest.exchange} @ $${lowest.price.toFixed(4)}`);
      console.log(`   Sell: ${highest.exchange} @ $${highest.price.toFixed(4)}`);
      console.log(`   Profit: ${(priceDifference * 100).toFixed(2)}%`);
      
      this.emit('opportunityDetected', opportunity);
    }
  }
  
  /**
   * Calculate confidence score for an opportunity
   */
  calculateConfidence(prices) {
    // Simple confidence calculation based on:
    // - Number of exchanges with valid prices
    // - Price consistency
    // - Recent update frequency
    
    const validPrices = prices.filter(p => p.price > 0);
    const exchangeCount = validPrices.length;
    
    let confidence = Math.min(exchangeCount / 3, 1.0); // Max confidence with 3+ exchanges
    
    // Reduce confidence if prices are too volatile
    if (exchangeCount > 1) {
      const priceValues = validPrices.map(p => p.price);
      const avg = priceValues.reduce((a, b) => a + b, 0) / priceValues.length;
      const variance = priceValues.reduce((acc, price) => acc + Math.pow(price - avg, 2), 0) / priceValues.length;
      const volatility = Math.sqrt(variance) / avg;
      
      if (volatility > 0.05) { // More than 5% volatility
        confidence *= 0.7;
      }
    }
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }
  
  /**
   * Get current price for a pair
   */
  getCurrentPrice(tokenA, tokenB) {
    const pairKey = `${tokenA}-${tokenB}`;
    return this.priceCache.get(pairKey) || null;
  }
  
  /**
   * Get price history for a pair
   */
  getPriceHistory(tokenA, tokenB, limit = 50) {
    const pairKey = `${tokenA}-${tokenB}`;
    const history = this.priceHistory.get(pairKey) || [];
    return history.slice(-limit);
  }
  
  /**
   * Get performance metrics
   */
  getMetrics() {
    const now = Date.now();
    const timeDiff = (now - (this.metrics.lastDetectionTime || now)) / 1000;
    
    return {
      ...this.metrics,
      detectionsPerSecond: timeDiff > 0 ? this.metrics.totalDetections / timeDiff : 0,
      uptime: this.isActive ? now - (this.startTime || now) : 0,
      monitoredPairs: this.monitoredPairs ? this.monitoredPairs.length : 0,
      cachedPrices: this.priceCache.size
    };
  }
  
  /**
   * Shutdown the detector
   */
  shutdown() {
    this.stopMonitoring();
    this.isActive = false;
    this.priceCache.clear();
    this.priceHistory.clear();
    this.lastUpdate.clear();
    
    console.log('📊 Price Detector shutdown complete');
    this.emit('shutdown');
  }
}

export default PriceDetector;