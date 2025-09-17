const { ethers } = require('ethers');
const UniswapV2Fetcher = require('./uniswapV2Fetcher');
const UniswapV3Fetcher = require('./uniswapV3Fetcher');
const SushiswapFetcher = require('./sushiswapFetcher');
const config = require('../config/config');

class UnifiedPriceFetcher {
  constructor(provider) {
    this.provider = provider;
    
    // Initialize all fetchers
    this.fetchers = {
      'uniswap-v2': new UniswapV2Fetcher(provider),
      'uniswap-v3': new UniswapV3Fetcher(provider),
      'sushiswap': new SushiswapFetcher(provider)
    };
    
    // Price cache for reducing redundant calls
    this.priceCache = new Map();
    this.cacheTTL = config.REDIS_TTL * 1000; // Convert to milliseconds
    
    // Retry configuration
    this.retryConfig = {
      maxRetries: 3,
      retryDelay: 1000, // 1 second
      backoffMultiplier: 2
    };
    
    console.log('🔗 UnifiedPriceFetcher initialized with all DEX integrations');
  }

  /**
   * Get prices from all supported DEXs
   */
  async getAllPrices(tokenA, tokenB, amountIn, options = {}) {
    try {
      const { 
        enableCache = config.CACHE_ENABLED,
        timeout = 10000,
        includeFailures = false 
      } = options;
      
      // Check cache first
      if (enableCache) {
        const cached = this.getCachedPrice(tokenA, tokenB, amountIn);
        if (cached) {
          console.log('📋 Using cached prices');
          return cached;
        }
      }
      
      // Fetch from all DEXs concurrently
      const fetchPromises = Object.entries(this.fetchers).map(([exchange, fetcher]) =>
        this.fetchWithRetry(fetcher, tokenA, tokenB, amountIn, exchange)
      );
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Price fetch timeout')), timeout)
      );
      
      const results = await Promise.race([
        Promise.allSettled(fetchPromises),
        timeoutPromise
      ]);
      
      // Process results
      const processedResults = this.processResults(results, includeFailures);
      
      // Cache successful results
      if (enableCache && processedResults.successful.length > 0) {
        this.setCachedPrice(tokenA, tokenB, amountIn, processedResults);
      }
      
      return processedResults;
      
    } catch (error) {
      console.error('❌ Error in getAllPrices:', error.message);
      return {
        successful: [],
        failed: [],
        timestamp: Date.now(),
        error: error.message
      };
    }
  }

  /**
   * Get best price across all DEXs
   */
  async getBestPrice(tokenA, tokenB, amountIn, options = {}) {
    try {
      const allPrices = await this.getAllPrices(tokenA, tokenB, amountIn, options);
      
      if (allPrices.successful.length === 0) {
        return null;
      }
      
      // Find the exchange offering the highest output amount
      const bestPrice = allPrices.successful.reduce((best, current) => {
        const currentAmount = Number(current.data.amountOut || 0);
        const bestAmount = Number(best.data.amountOut || 0);
        
        return currentAmount > bestAmount ? current : best;
      });
      
      // Add comparison data
      bestPrice.comparison = {
        totalExchanges: allPrices.successful.length,
        alternatives: allPrices.successful.filter(p => p.exchange !== bestPrice.exchange),
        avgPrice: this.calculateAveragePrice(allPrices.successful),
        priceSpread: this.calculatePriceSpread(allPrices.successful)
      };
      
      return bestPrice;
      
    } catch (error) {
      console.error('❌ Error getting best price:', error.message);
      return null;
    }
  }

  /**
   * Detect arbitrage opportunities
   */
  async detectArbitrage(tokenA, tokenB, amountIn, options = {}) {
    try {
      const { minProfitThreshold = config.MIN_PROFIT_THRESHOLD } = options;
      
      const allPrices = await this.getAllPrices(tokenA, tokenB, amountIn, options);
      
      if (allPrices.successful.length < 2) {
        return null; // Need at least 2 exchanges for arbitrage
      }
      
      // Sort by amountOut (ascending) to find best buy/sell opportunities
      const sortedPrices = allPrices.successful.sort((a, b) => 
        Number(a.data.amountOut) - Number(b.data.amountOut)
      );
      
      const buyFrom = sortedPrices[sortedPrices.length - 1]; // Highest output (best buy)
      const sellTo = sortedPrices[0]; // Lowest output (best sell - reverse trade)
      
      // Calculate profit percentage
      const buyAmount = Number(buyFrom.data.amountOut);
      const sellAmount = Number(sellTo.data.amountOut);
      const profitPercentage = ((buyAmount - sellAmount) / sellAmount) * 100;
      
      if (profitPercentage < minProfitThreshold) {
        return null; // Not profitable enough
      }
      
      // Estimate gas costs
      const estimatedGas = (buyFrom.data.gasEstimate || 200000) + (sellTo.data.gasEstimate || 200000);
      const gasPrice = await this.provider.getGasPrice();
      const gasCostETH = Number(ethers.formatEther(gasPrice * BigInt(estimatedGas)));
      const gasCostUSD = gasCostETH * 2000; // Mock ETH price
      
      return {
        id: `${tokenA}-${tokenB}-${Date.now()}`,
        tokenPair: `${tokenA}/${tokenB}`,
        amountIn: amountIn.toString(),
        
        // Trade execution
        buyFrom: buyFrom.exchange,
        sellTo: sellTo.exchange,
        buyPrice: buyAmount,
        sellPrice: sellAmount,
        
        // Profitability
        profitPercentage,
        estimatedProfitUSD: (profitPercentage / 100) * Number(ethers.formatEther(amountIn)) * 2000,
        gasCostUSD,
        netProfitUSD: ((profitPercentage / 100) * Number(ethers.formatEther(amountIn)) * 2000) - gasCostUSD,
        
        // Metadata
        timestamp: Date.now(),
        allPrices: allPrices.successful,
        gasEstimate: estimatedGas,
        gasPrice: gasPrice.toString()
      };
      
    } catch (error) {
      console.error('❌ Error detecting arbitrage:', error.message);
      return null;
    }
  }

  /**
   * Fetch price with retry logic
   */
  async fetchWithRetry(fetcher, tokenA, tokenB, amountIn, exchange, attempt = 1) {
    try {
      const startTime = Date.now();
      
      let result;
      if (exchange === 'uniswap-v3') {
        result = await fetcher.getBestPrice(tokenA, tokenB, amountIn);
      } else {
        result = await fetcher.getPrice(tokenA, tokenB, amountIn);
      }
      
      const responseTime = Date.now() - startTime;
      
      return {
        exchange,
        success: !!result,
        data: result,
        responseTime,
        attempt
      };
      
    } catch (error) {
      if (attempt < this.retryConfig.maxRetries) {
        const delay = this.retryConfig.retryDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
        console.log(`🔄 Retrying ${exchange} in ${delay}ms (attempt ${attempt + 1})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchWithRetry(fetcher, tokenA, tokenB, amountIn, exchange, attempt + 1);
      }
      
      return {
        exchange,
        success: false,
        error: error.message,
        attempt
      };
    }
  }

  /**
   * Process fetch results
   */
  processResults(results, includeFailures = false) {
    const successful = [];
    const failed = [];
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success) {
        successful.push(result.value);
      } else {
        const failureInfo = result.status === 'fulfilled' 
          ? result.value 
          : { exchange: 'unknown', error: result.reason.message };
        failed.push(failureInfo);
      }
    }
    
    const processedResults = {
      successful,
      failed: includeFailures ? failed : [],
      timestamp: Date.now(),
      summary: {
        totalExchanges: results.length,
        successfulCount: successful.length,
        failedCount: failed.length,
        successRate: `${((successful.length / results.length) * 100).toFixed(1)}%`
      }
    };
    
    return processedResults;
  }

  /**
   * Calculate average price across exchanges
   */
  calculateAveragePrice(prices) {
    if (prices.length === 0) return 0;
    
    const totalAmount = prices.reduce((sum, price) => 
      sum + Number(price.data.amountOut || 0), 0);
    
    return totalAmount / prices.length;
  }

  /**
   * Calculate price spread (difference between highest and lowest)
   */
  calculatePriceSpread(prices) {
    if (prices.length === 0) return 0;
    
    const amounts = prices.map(p => Number(p.data.amountOut || 0));
    const max = Math.max(...amounts);
    const min = Math.min(...amounts);
    
    return {
      absolute: max - min,
      percentage: min > 0 ? ((max - min) / min) * 100 : 0,
      max,
      min
    };
  }

  /**
   * Cache management
   */
  getCachedPrice(tokenA, tokenB, amountIn) {
    const key = `${tokenA}-${tokenB}-${amountIn.toString()}`;
    const cached = this.priceCache.get(key);
    
    if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
      return cached.data;
    }
    
    // Clean expired cache entry
    if (cached) {
      this.priceCache.delete(key);
    }
    
    return null;
  }

  setCachedPrice(tokenA, tokenB, amountIn, data) {
    const key = `${tokenA}-${tokenB}-${amountIn.toString()}`;
    this.priceCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Health check for all fetchers
   */
  async healthCheck() {
    try {
      const healthPromises = Object.entries(this.fetchers).map(async ([exchange, fetcher]) => {
        try {
          const health = await fetcher.healthCheck();
          return { exchange, ...health };
        } catch (error) {
          return {
            exchange,
            status: 'unhealthy',
            error: error.message,
            lastCheck: Date.now()
          };
        }
      });
      
      const results = await Promise.allSettled(healthPromises);
      const healthStatus = results.map(result => 
        result.status === 'fulfilled' ? result.value : {
          exchange: 'unknown',
          status: 'unhealthy',
          error: result.reason.message
        }
      );
      
      const healthyCount = healthStatus.filter(h => h.status === 'healthy').length;
      
      return {
        overall: healthyCount > 0 ? 'healthy' : 'unhealthy',
        exchanges: healthStatus,
        summary: {
          total: healthStatus.length,
          healthy: healthyCount,
          unhealthy: healthStatus.length - healthyCount,
          healthRate: `${((healthyCount / healthStatus.length) * 100).toFixed(1)}%`
        },
        lastCheck: Date.now()
      };
      
    } catch (error) {
      return {
        overall: 'unhealthy',
        error: error.message,
        lastCheck: Date.now()
      };
    }
  }

  /**
   * Clear price cache
   */
  clearCache() {
    this.priceCache.clear();
    console.log('🗑️ Price cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.priceCache.size,
      ttl: this.cacheTTL,
      enabled: config.CACHE_ENABLED
    };
  }
}

module.exports = UnifiedPriceFetcher;