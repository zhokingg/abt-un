import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import config from '../config/config.js';

/**
 * PriceProvider - Aggregated price feed provider
 * Combines multiple price sources for accurate and reliable pricing
 */
class PriceProvider extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      updateInterval: options.updateInterval || 10000, // 10 seconds
      priceValidityTime: options.priceValidityTime || 30000, // 30 seconds
      enableChainlinkFeeds: options.enableChainlinkFeeds !== false,
      enableDEXPrices: options.enableDEXPrices !== false,
      enableExternalAPIs: options.enableExternalAPIs !== false,
      deviationThreshold: options.deviationThreshold || 0.05, // 5% max deviation
      ...options
    };
    
    // Price sources configuration
    this.priceSources = {
      chainlink: {
        name: 'Chainlink',
        enabled: this.options.enableChainlinkFeeds,
        weight: 0.4,
        feeds: {
          'ETH/USD': '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
          'BTC/USD': '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c',
          'USDC/USD': '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6'
        }
      },
      dex: {
        name: 'DEX Aggregated',
        enabled: this.options.enableDEXPrices,
        weight: 0.4,
        sources: ['uniswap-v2', 'uniswap-v3', 'sushiswap']
      },
      external: {
        name: 'External APIs',
        enabled: this.options.enableExternalAPIs,
        weight: 0.2,
        apis: ['coingecko', 'coinbase', 'binance']
      }
    };
    
    // Price cache and history
    this.priceCache = new Map();
    this.priceHistory = new Map();
    this.sourceReliability = new Map();
    
    // Performance metrics
    this.metrics = {
      totalPriceUpdates: 0,
      successfulUpdates: 0,
      sourceErrors: {},
      averageUpdateTime: 0,
      lastUpdateTime: null,
      priceAccuracy: 0.95
    };
    
    this.isActive = false;
    this.updateTimer = null;
  }
  
  async initialize(web3Provider, uniswapProvider = null) {
    try {
      this.web3Provider = web3Provider;
      this.uniswapProvider = uniswapProvider;
      
      console.log('💰 Initializing Price Provider...');
      console.log(`   Update interval: ${this.options.updateInterval}ms`);
      console.log(`   Chainlink feeds: ${this.priceSources.chainlink.enabled ? 'enabled' : 'disabled'}`);
      console.log(`   DEX prices: ${this.priceSources.dex.enabled ? 'enabled' : 'disabled'}`);
      console.log(`   External APIs: ${this.priceSources.external.enabled ? 'enabled' : 'disabled'}`);
      
      // Initialize source reliability tracking
      for (const [sourceId, source] of Object.entries(this.priceSources)) {
        if (source.enabled) {
          this.sourceReliability.set(sourceId, {
            successCount: 0,
            errorCount: 0,
            reliability: 1.0,
            lastUpdate: null
          });
          this.metrics.sourceErrors[sourceId] = 0;
        }
      }
      
      this.isActive = true;
      this.startTime = Date.now();
      this.emit('initialized');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Price Provider:', error.message);
      throw error;
    }
  }
  
  startPriceUpdates() {
    if (!this.isActive) {
      throw new Error('Price provider not initialized');
    }
    
    console.log('💰 Starting price updates...');
    
    this.updateTimer = setInterval(() => {
      this.updateAllPrices();
    }, this.options.updateInterval);
    
    // Initial update
    this.updateAllPrices();
    
    this.emit('updatesStarted');
  }
  
  stopPriceUpdates() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    
    console.log('💰 Price updates stopped');
    this.emit('updatesStopped');
  }
  
  async updateAllPrices() {
    const startTime = Date.now();
    this.metrics.totalPriceUpdates++;
    
    try {
      // Define token pairs to monitor
      const tokenPairs = [
        { base: 'ETH', quote: 'USD', tokenAddress: config.TOKENS.WETH },
        { base: 'USDC', quote: 'USD', tokenAddress: config.TOKENS.USDC },
        { base: 'USDT', quote: 'USD', tokenAddress: config.TOKENS.USDT },
        { base: 'DAI', quote: 'USD', tokenAddress: config.TOKENS.DAI }
      ];
      
      const updatePromises = tokenPairs.map(pair => 
        this.updatePairPrice(pair).catch(error => {
          console.warn(`⚠️ Failed to update ${pair.base}/${pair.quote}:`, error.message);
          return null;
        })
      );
      
      const results = await Promise.allSettled(updatePromises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
      
      // Update metrics
      if (successful > 0) {
        this.metrics.successfulUpdates++;
      }
      
      this.metrics.averageUpdateTime = (this.metrics.averageUpdateTime + (Date.now() - startTime)) / 2;
      this.metrics.lastUpdateTime = Date.now();
      
      this.emit('pricesUpdated', { successful, total: tokenPairs.length });
      
    } catch (error) {
      console.error('❌ Price update batch failed:', error.message);
    }
  }
  
  async updatePairPrice(pair) {
    const pairKey = `${pair.base}/${pair.quote}`;
    const prices = [];
    
    try {
      // Get price from Chainlink feeds
      if (this.priceSources.chainlink.enabled && this.priceSources.chainlink.feeds[pairKey]) {
        try {
          const chainlinkPrice = await this.getChainlinkPrice(pairKey);
          if (chainlinkPrice) {
            prices.push({
              source: 'chainlink',
              price: chainlinkPrice.price,
              timestamp: chainlinkPrice.timestamp,
              weight: this.priceSources.chainlink.weight
            });
          }
        } catch (error) {
          this.recordSourceError('chainlink', error);
        }
      }
      
      // Get price from DEX sources
      if (this.priceSources.dex.enabled) {
        try {
          const dexPrice = await this.getDEXPrice(pair);
          if (dexPrice) {
            prices.push({
              source: 'dex',
              price: dexPrice.price,
              timestamp: dexPrice.timestamp,
              weight: this.priceSources.dex.weight
            });
          }
        } catch (error) {
          this.recordSourceError('dex', error);
        }
      }
      
      // Get price from external APIs
      if (this.priceSources.external.enabled) {
        try {
          const externalPrice = await this.getExternalAPIPrice(pair);
          if (externalPrice) {
            prices.push({
              source: 'external',
              price: externalPrice.price,
              timestamp: externalPrice.timestamp,
              weight: this.priceSources.external.weight
            });
          }
        } catch (error) {
          this.recordSourceError('external', error);
        }
      }
      
      if (prices.length === 0) {
        throw new Error('No price sources available');
      }
      
      // Calculate weighted average price
      const aggregatedPrice = this.calculateWeightedPrice(prices);
      
      // Validate price deviation
      const validated = this.validatePriceDeviation(pairKey, prices, aggregatedPrice);
      
      // Update cache and history
      this.updatePriceCache(pairKey, validated);
      
      return validated;
      
    } catch (error) {
      console.error(`❌ Failed to update price for ${pairKey}:`, error.message);
      return null;
    }
  }
  
  async getChainlinkPrice(pairKey) {
    // Simplified implementation - in production, would call actual Chainlink contracts
    const feedAddress = this.priceSources.chainlink.feeds[pairKey];
    if (!feedAddress) return null;
    
    // Mock Chainlink price data
    const basePrices = {
      'ETH/USD': 2000 + Math.random() * 200, // $2000-2200
      'BTC/USD': 45000 + Math.random() * 5000, // $45k-50k
      'USDC/USD': 1.0 + (Math.random() - 0.5) * 0.002 // $0.999-1.001
    };
    
    const price = basePrices[pairKey];
    if (!price) return null;
    
    this.recordSourceSuccess('chainlink');
    
    return {
      price,
      timestamp: Date.now(),
      feedAddress,
      confidence: 0.95
    };
  }
  
  async getDEXPrice(pair) {
    if (!this.uniswapProvider) {
      // Mock DEX price if no provider available
      const mockPrices = {
        'ETH': 2000 + Math.random() * 100,
        'USDC': 1.0,
        'USDT': 1.0,
        'DAI': 1.0
      };
      
      const price = mockPrices[pair.base] || 1.0;
      
      this.recordSourceSuccess('dex');
      
      return {
        price,
        timestamp: Date.now(),
        confidence: 0.85
      };
    }
    
    try {
      // Use Uniswap provider to get DEX price
      const quote = await this.uniswapProvider.getQuote(
        pair.tokenAddress,
        config.TOKENS.USDC, // Use USDC as quote currency
        ethers.parseUnits('1.0', 18) // 1 token
      );
      
      if (quote.success) {
        this.recordSourceSuccess('dex');
        
        return {
          price: quote.outputAmount,
          timestamp: Date.now(),
          confidence: 0.85,
          protocol: quote.protocol
        };
      }
      
      return null;
    } catch (error) {
      this.recordSourceError('dex', error);
      return null;
    }
  }
  
  async getExternalAPIPrice(pair) {
    // Mock external API price - in production, would call actual APIs
    const basePrices = {
      'ETH': 2000 + Math.random() * 50,
      'USDC': 1.0,
      'USDT': 1.0,
      'DAI': 1.0
    };
    
    const price = basePrices[pair.base];
    if (!price) return null;
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    this.recordSourceSuccess('external');
    
    return {
      price,
      timestamp: Date.now(),
      confidence: 0.8,
      api: 'coingecko'
    };
  }
  
  calculateWeightedPrice(prices) {
    if (prices.length === 0) return null;
    if (prices.length === 1) return prices[0];
    
    // Adjust weights based on source reliability
    const adjustedPrices = prices.map(priceData => {
      const reliability = this.sourceReliability.get(priceData.source);
      const adjustedWeight = priceData.weight * (reliability?.reliability || 1.0);
      
      return {
        ...priceData,
        adjustedWeight
      };
    });
    
    // Calculate weighted average
    const totalWeight = adjustedPrices.reduce((sum, p) => sum + p.adjustedWeight, 0);
    const weightedSum = adjustedPrices.reduce((sum, p) => sum + (p.price * p.adjustedWeight), 0);
    
    const averagePrice = weightedSum / totalWeight;
    
    return {
      price: averagePrice,
      sources: adjustedPrices,
      confidence: this.calculatePriceConfidence(adjustedPrices),
      timestamp: Date.now()
    };
  }
  
  validatePriceDeviation(pairKey, prices, aggregatedPrice) {
    // Check for excessive deviation between sources
    const priceValues = prices.map(p => p.price);
    const maxPrice = Math.max(...priceValues);
    const minPrice = Math.min(...priceValues);
    const deviation = (maxPrice - minPrice) / minPrice;
    
    if (deviation > this.options.deviationThreshold) {
      console.warn(`⚠️ High price deviation for ${pairKey}: ${(deviation * 100).toFixed(2)}%`);
      
      // Filter out outliers
      const median = this.calculateMedian(priceValues);
      const filteredPrices = prices.filter(p => 
        Math.abs(p.price - median) / median <= this.options.deviationThreshold
      );
      
      if (filteredPrices.length > 0) {
        return this.calculateWeightedPrice(filteredPrices);
      }
    }
    
    return aggregatedPrice;
  }
  
  calculateMedian(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    
    return sorted[middle];
  }
  
  calculatePriceConfidence(prices) {
    let confidence = 0.5; // Base confidence
    
    // Higher confidence with more sources
    confidence += Math.min(prices.length * 0.15, 0.3);
    
    // Higher confidence with reliable sources
    const avgReliability = prices.reduce((sum, p) => {
      const reliability = this.sourceReliability.get(p.source);
      return sum + (reliability?.reliability || 0.5);
    }, 0) / prices.length;
    
    confidence += avgReliability * 0.2;
    
    return Math.min(confidence, 1.0);
  }
  
  updatePriceCache(pairKey, priceData) {
    this.priceCache.set(pairKey, priceData);
    
    // Store in history
    if (!this.priceHistory.has(pairKey)) {
      this.priceHistory.set(pairKey, []);
    }
    
    const history = this.priceHistory.get(pairKey);
    history.push(priceData);
    
    // Keep only last 100 entries
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }
  
  recordSourceSuccess(sourceId) {
    const reliability = this.sourceReliability.get(sourceId);
    if (reliability) {
      reliability.successCount++;
      reliability.lastUpdate = Date.now();
      reliability.reliability = Math.min(
        reliability.successCount / (reliability.successCount + reliability.errorCount),
        1.0
      );
    }
  }
  
  recordSourceError(sourceId, error) {
    this.metrics.sourceErrors[sourceId]++;
    
    const reliability = this.sourceReliability.get(sourceId);
    if (reliability) {
      reliability.errorCount++;
      reliability.reliability = Math.min(
        reliability.successCount / (reliability.successCount + reliability.errorCount),
        1.0
      );
    }
  }
  
  getPrice(base, quote = 'USD') {
    const pairKey = `${base}/${quote}`;
    const cached = this.priceCache.get(pairKey);
    
    if (!cached) return null;
    
    // Check if price is still valid
    const age = Date.now() - cached.timestamp;
    if (age > this.options.priceValidityTime) {
      return null;
    }
    
    return cached;
  }
  
  getPriceHistory(base, quote = 'USD', limit = 50) {
    const pairKey = `${base}/${quote}`;
    const history = this.priceHistory.get(pairKey) || [];
    return history.slice(-limit);
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      sourceReliability: Object.fromEntries(this.sourceReliability),
      cacheSize: this.priceCache.size,
      updateSuccessRate: this.metrics.totalPriceUpdates > 0 ? 
        (this.metrics.successfulUpdates / this.metrics.totalPriceUpdates) * 100 : 0,
      uptime: this.isActive ? Date.now() - (this.startTime || Date.now()) : 0
    };
  }
  
  shutdown() {
    this.stopPriceUpdates();
    this.isActive = false;
    this.priceCache.clear();
    this.priceHistory.clear();
    
    console.log('💰 Price Provider shutdown complete');
    this.emit('shutdown');
  }
}

export default PriceProvider;