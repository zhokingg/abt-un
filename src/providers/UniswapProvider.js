import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import config from '../config/config.js';

/**
 * UniswapProvider - Uniswap V2/V3 protocol integration
 * Provides unified interface for interacting with Uniswap protocols
 */
class UniswapProvider extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      enableV2: options.enableV2 !== false,
      enableV3: options.enableV3 !== false,
      defaultSlippage: options.defaultSlippage || 0.005, // 0.5%
      quoterCacheTime: options.quoterCacheTime || 10000, // 10 seconds
      maxRetries: options.maxRetries || 3,
      ...options
    };
    
    // Protocol configurations
    this.protocols = {
      v2: {
        enabled: this.options.enableV2,
        factoryAddress: config.UNISWAP_V2_FACTORY,
        routerAddress: config.UNISWAP_V2_ROUTER,
        fee: 0.003, // 0.3%
        name: 'Uniswap V2'
      },
      v3: {
        enabled: this.options.enableV3,
        factoryAddress: config.UNISWAP_V3_FACTORY,
        quoterAddress: config.UNISWAP_V3_QUOTER,
        fees: [0.0005, 0.003, 0.01], // 0.05%, 0.3%, 1%
        name: 'Uniswap V3'
      }
    };
    
    // Contract interfaces (simplified)
    this.contracts = {
      v2Factory: null,
      v2Router: null,
      v3Factory: null,
      v3Quoter: null
    };
    
    // Quote cache for performance
    this.quoteCache = new Map();
    this.poolCache = new Map();
    
    // Performance metrics
    this.metrics = {
      totalQuotes: 0,
      successfulQuotes: 0,
      averageQuoteTime: 0,
      cacheHitRate: 0,
      v2Quotes: 0,
      v3Quotes: 0,
      lastQuoteTime: null
    };
    
    this.isInitialized = false;
  }
  
  /**
   * Initialize the Uniswap provider
   */
  async initialize(web3Provider) {
    try {
      this.web3Provider = web3Provider;
      
      if (!this.web3Provider || !this.web3Provider.isConnected()) {
        throw new Error('Web3 provider not connected');
      }
      
      console.log('🦄 Initializing Uniswap Provider...');
      console.log(`   V2 support: ${this.protocols.v2.enabled ? 'enabled' : 'disabled'}`);
      console.log(`   V3 support: ${this.protocols.v3.enabled ? 'enabled' : 'disabled'}`);
      console.log(`   Default slippage: ${this.options.defaultSlippage * 100}%`);
      
      // Initialize contract interfaces (simplified for this implementation)
      if (this.protocols.v2.enabled) {
        console.log(`   V2 Factory: ${this.protocols.v2.factoryAddress}`);
        console.log(`   V2 Router: ${this.protocols.v2.routerAddress}`);
      }
      
      if (this.protocols.v3.enabled) {
        console.log(`   V3 Factory: ${this.protocols.v3.factoryAddress}`);
        console.log(`   V3 Quoter: ${this.protocols.v3.quoterAddress}`);
      }
      
      this.isInitialized = true;
      this.startTime = Date.now();
      this.emit('initialized');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Uniswap Provider:', error.message);
      throw error;
    }
  }
  
  /**
   * Get quote for token swap
   */
  async getQuote(tokenIn, tokenOut, amountIn, protocol = 'best') {
    if (!this.isInitialized) {
      throw new Error('Uniswap provider not initialized');
    }
    
    const startTime = Date.now();
    this.metrics.totalQuotes++;
    
    try {
      // Check cache first
      const cacheKey = `${tokenIn}-${tokenOut}-${amountIn}-${protocol}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.metrics.cacheHitRate = (this.metrics.cacheHitRate + 1) / 2;
        return cached;
      }
      
      let bestQuote = null;
      const quotes = [];
      
      // Get quotes from enabled protocols
      if (protocol === 'best' || protocol === 'v2') {
        if (this.protocols.v2.enabled) {
          try {
            const v2Quote = await this.getV2Quote(tokenIn, tokenOut, amountIn);
            if (v2Quote.success) {
              quotes.push(v2Quote);
              this.metrics.v2Quotes++;
            }
          } catch (error) {
            console.warn('V2 quote failed:', error.message);
          }
        }
      }
      
      if (protocol === 'best' || protocol === 'v3') {
        if (this.protocols.v3.enabled) {
          try {
            const v3Quote = await this.getV3Quote(tokenIn, tokenOut, amountIn);
            if (v3Quote.success) {
              quotes.push(v3Quote);
              this.metrics.v3Quotes++;
            }
          } catch (error) {
            console.warn('V3 quote failed:', error.message);
          }
        }
      }
      
      if (quotes.length === 0) {
        throw new Error('No quotes available');
      }
      
      // Select best quote
      if (protocol === 'best') {
        bestQuote = quotes.reduce((best, current) => 
          current.outputAmount > best.outputAmount ? current : best
        );
      } else {
        bestQuote = quotes[0];
      }
      
      // Add metadata
      bestQuote.quotedAt = Date.now();
      bestQuote.quotingTime = Date.now() - startTime;
      bestQuote.alternatives = quotes.length > 1 ? quotes.filter(q => q !== bestQuote) : [];
      
      // Cache the result
      this.addToCache(cacheKey, bestQuote);
      
      // Update metrics
      this.metrics.successfulQuotes++;
      this.metrics.averageQuoteTime = (this.metrics.averageQuoteTime + bestQuote.quotingTime) / 2;
      this.metrics.lastQuoteTime = Date.now();
      
      this.emit('quoteReceived', bestQuote);
      return bestQuote;
      
    } catch (error) {
      console.error('❌ Failed to get quote:', error.message);
      throw error;
    }
  }
  
  /**
   * Get Uniswap V2 quote
   */
  async getV2Quote(tokenIn, tokenOut, amountIn) {
    try {
      // Simplified implementation - in production, this would call actual contracts
      const mockReserves = this.getMockV2Reserves(tokenIn, tokenOut);
      
      if (!mockReserves) {
        return { success: false, error: 'Pair not found' };
      }
      
      // Calculate output using constant product formula
      const amountInWithFee = amountIn * 997; // 0.3% fee
      const numerator = amountInWithFee * mockReserves.reserve1;
      const denominator = mockReserves.reserve0 * 1000 + amountInWithFee;
      const outputAmount = numerator / denominator;
      
      // Calculate price impact
      const priceImpact = this.calculateV2PriceImpact(amountIn, outputAmount, mockReserves);
      
      return {
        success: true,
        protocol: 'v2',
        tokenIn,
        tokenOut,
        amountIn,
        outputAmount,
        priceImpact,
        fee: this.protocols.v2.fee,
        route: [tokenIn, tokenOut],
        poolAddress: mockReserves.pairAddress,
        gasUsed: 150000, // Estimated gas
        executionPrice: outputAmount / amountIn,
        minimumOutput: outputAmount * (1 - this.options.defaultSlippage)
      };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get Uniswap V3 quote
   */
  async getV3Quote(tokenIn, tokenOut, amountIn) {
    try {
      // Simplified implementation - in production, this would call actual quoter contract
      const mockPools = this.getMockV3Pools(tokenIn, tokenOut);
      
      if (mockPools.length === 0) {
        return { success: false, error: 'No pools found' };
      }
      
      // Get quotes from all fee tiers and select best
      let bestOutput = 0;
      let bestPool = null;
      
      for (const pool of mockPools) {
        const output = this.calculateV3Output(amountIn, pool);
        if (output > bestOutput) {
          bestOutput = output;
          bestPool = pool;
        }
      }
      
      if (!bestPool) {
        return { success: false, error: 'No valid pool found' };
      }
      
      // Calculate price impact
      const priceImpact = this.calculateV3PriceImpact(amountIn, bestOutput, bestPool);
      
      return {
        success: true,
        protocol: 'v3',
        tokenIn,
        tokenOut,
        amountIn,
        outputAmount: bestOutput,
        priceImpact,
        fee: bestPool.fee,
        route: [tokenIn, tokenOut],
        poolAddress: bestPool.poolAddress,
        gasUsed: 180000, // Estimated gas for V3
        executionPrice: bestOutput / amountIn,
        minimumOutput: bestOutput * (1 - this.options.defaultSlippage),
        tickRange: bestPool.tickRange,
        liquidity: bestPool.liquidity
      };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get mock V2 reserves (for testing)
   */
  getMockV2Reserves(tokenIn, tokenOut) {
    // Generate deterministic mock data based on token addresses
    const hash = this.hashTokenPair(tokenIn, tokenOut);
    const random = this.seededRandom(hash);
    
    return {
      pairAddress: '0x' + hash.slice(0, 40),
      reserve0: 100 + random() * 900, // 100-1000 ETH
      reserve1: 200000 + random() * 1800000, // $200k-2M USDC
      token0: tokenIn,
      token1: tokenOut
    };
  }
  
  /**
   * Get mock V3 pools (for testing)
   */
  getMockV3Pools(tokenIn, tokenOut) {
    const pools = [];
    const hash = this.hashTokenPair(tokenIn, tokenOut);
    
    // Generate pools for different fee tiers
    for (const fee of this.protocols.v3.fees) {
      const random = this.seededRandom(hash + fee.toString());
      
      pools.push({
        poolAddress: '0x' + this.hashTokenPair(tokenIn + tokenOut, fee.toString()).slice(0, 40),
        fee,
        liquidity: 500000 + random() * 4500000, // $500k-5M
        currentTick: Math.floor(random() * 1000) - 500,
        tickRange: {
          lower: -1000,
          upper: 1000
        },
        token0: tokenIn,
        token1: tokenOut
      });
    }
    
    return pools;
  }
  
  /**
   * Calculate V3 output amount
   */
  calculateV3Output(amountIn, pool) {
    // Simplified V3 calculation - in production, would use proper concentrated liquidity math
    const feeAdjustedAmount = amountIn * (1 - pool.fee);
    const liquidityUtilization = amountIn / pool.liquidity;
    const slippage = liquidityUtilization * (liquidityUtilization + 0.1);
    
    return feeAdjustedAmount * (1 - slippage) * (2000 / 2010); // Mock price calculation
  }
  
  /**
   * Calculate V2 price impact
   */
  calculateV2PriceImpact(amountIn, outputAmount, reserves) {
    const priceBeforeTrade = reserves.reserve1 / reserves.reserve0;
    const priceAfterTrade = (reserves.reserve1 - outputAmount) / (reserves.reserve0 + amountIn);
    
    return Math.abs(priceAfterTrade - priceBeforeTrade) / priceBeforeTrade;
  }
  
  /**
   * Calculate V3 price impact
   */
  calculateV3PriceImpact(amountIn, outputAmount, pool) {
    const liquidityUtilization = amountIn / pool.liquidity;
    return liquidityUtilization * 0.8; // Simplified calculation
  }
  
  /**
   * Get multi-hop quote
   */
  async getMultiHopQuote(tokenIn, tokenOut, amountIn, maxHops = 3) {
    if (!this.isInitialized) {
      throw new Error('Uniswap provider not initialized');
    }
    
    try {
      console.log(`🦄 Getting multi-hop quote: ${tokenIn} → ${tokenOut}`);
      
      // For simplicity, we'll just find routes through WETH
      const intermediateToken = config.TOKENS.WETH;
      
      if (tokenIn === intermediateToken || tokenOut === intermediateToken) {
        // Direct swap
        return this.getQuote(tokenIn, tokenOut, amountIn);
      }
      
      // Two-hop swap via WETH
      const firstHop = await this.getQuote(tokenIn, intermediateToken, amountIn);
      if (!firstHop.success) {
        throw new Error('First hop failed');
      }
      
      const secondHop = await this.getQuote(intermediateToken, tokenOut, firstHop.outputAmount);
      if (!secondHop.success) {
        throw new Error('Second hop failed');
      }
      
      return {
        success: true,
        protocol: 'multi-hop',
        tokenIn,
        tokenOut,
        amountIn,
        outputAmount: secondHop.outputAmount,
        route: [tokenIn, intermediateToken, tokenOut],
        hops: [firstHop, secondHop],
        totalFee: firstHop.fee + secondHop.fee,
        totalGas: firstHop.gasUsed + secondHop.gasUsed,
        priceImpact: firstHop.priceImpact + secondHop.priceImpact,
        executionPrice: secondHop.outputAmount / amountIn,
        minimumOutput: secondHop.minimumOutput
      };
      
    } catch (error) {
      console.error('❌ Multi-hop quote failed:', error.message);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get pool information
   */
  async getPoolInfo(tokenA, tokenB, protocol = 'best') {
    const cacheKey = `pool-${tokenA}-${tokenB}-${protocol}`;
    const cached = this.poolCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 60000) { // 1 minute cache
      return cached.data;
    }
    
    try {
      const pools = [];
      
      if (protocol === 'best' || protocol === 'v2') {
        if (this.protocols.v2.enabled) {
          const v2Pool = this.getMockV2Reserves(tokenA, tokenB);
          if (v2Pool) {
            pools.push({
              protocol: 'v2',
              address: v2Pool.pairAddress,
              fee: this.protocols.v2.fee,
              reserves: {
                token0: v2Pool.reserve0,
                token1: v2Pool.reserve1
              },
              totalLiquidity: v2Pool.reserve0 * 2000 + v2Pool.reserve1 // Simplified USD calculation
            });
          }
        }
      }
      
      if (protocol === 'best' || protocol === 'v3') {
        if (this.protocols.v3.enabled) {
          const v3Pools = this.getMockV3Pools(tokenA, tokenB);
          for (const pool of v3Pools) {
            pools.push({
              protocol: 'v3',
              address: pool.poolAddress,
              fee: pool.fee,
              liquidity: pool.liquidity,
              currentTick: pool.currentTick,
              tickRange: pool.tickRange,
              totalLiquidity: pool.liquidity
            });
          }
        }
      }
      
      const result = {
        tokenA,
        tokenB,
        pools,
        totalPools: pools.length,
        totalLiquidity: pools.reduce((sum, pool) => sum + pool.totalLiquidity, 0),
        timestamp: Date.now()
      };
      
      // Cache the result
      this.poolCache.set(cacheKey, { data: result, timestamp: Date.now() });
      
      return result;
      
    } catch (error) {
      console.error('❌ Failed to get pool info:', error.message);
      throw error;
    }
  }
  
  /**
   * Execute trade (simulation for this implementation)
   */
  async executeTrade(quote, slippage = null) {
    if (!quote || !quote.success) {
      throw new Error('Invalid quote');
    }
    
    const actualSlippage = slippage || this.options.defaultSlippage;
    const minimumOutput = quote.outputAmount * (1 - actualSlippage);
    
    console.log(`🦄 Simulating trade execution:`);
    console.log(`   Protocol: ${quote.protocol}`);
    console.log(`   Route: ${quote.route.join(' → ')}`);
    console.log(`   Input: ${quote.amountIn} ${quote.tokenIn}`);
    console.log(`   Expected output: ${quote.outputAmount.toFixed(6)} ${quote.tokenOut}`);
    console.log(`   Minimum output: ${minimumOutput.toFixed(6)} ${quote.tokenOut}`);
    console.log(`   Slippage tolerance: ${actualSlippage * 100}%`);
    
    // Simulate execution result
    const executionSlippage = Math.random() * actualSlippage * 0.8; // Random slippage within tolerance
    const actualOutput = quote.outputAmount * (1 - executionSlippage);
    
    const result = {
      success: true,
      transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
      actualOutput,
      actualSlippage: executionSlippage,
      gasUsed: quote.gasUsed,
      executionTime: Date.now(),
      quote: { ...quote }
    };
    
    this.emit('tradeExecuted', result);
    return result;
  }
  
  /**
   * Cache management
   */
  getFromCache(key) {
    const cached = this.quoteCache.get(key);
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    if (age > this.options.quoterCacheTime) {
      this.quoteCache.delete(key);
      return null;
    }
    
    return cached.quote;
  }
  
  addToCache(key, quote) {
    this.quoteCache.set(key, {
      quote,
      timestamp: Date.now()
    });
    
    // Clean old cache entries
    if (this.quoteCache.size > 1000) {
      const cutoff = Date.now() - this.options.quoterCacheTime;
      for (const [cacheKey, entry] of this.quoteCache.entries()) {
        if (entry.timestamp < cutoff) {
          this.quoteCache.delete(cacheKey);
        }
      }
    }
  }
  
  /**
   * Utility functions
   */
  hashTokenPair(tokenA, tokenB) {
    const combined = tokenA.toLowerCase() + tokenB.toLowerCase();
    // Simple hash function for deterministic mock data
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(40, '0');
  }
  
  seededRandom(seed) {
    const seedValue = typeof seed === 'string' ? 
      seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 
      seed;
    
    return function() {
      const x = Math.sin(seedValue) * 10000;
      return x - Math.floor(x);
    };
  }
  
  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      quotingSuccessRate: this.metrics.totalQuotes > 0 ? 
        (this.metrics.successfulQuotes / this.metrics.totalQuotes) * 100 : 0,
      cacheSize: this.quoteCache.size,
      poolCacheSize: this.poolCache.size,
      uptime: this.isInitialized ? Date.now() - (this.startTime || Date.now()) : 0
    };
  }
  
  /**
   * Clear caches
   */
  clearCache() {
    this.quoteCache.clear();
    this.poolCache.clear();
    console.log('🦄 Uniswap Provider cache cleared');
  }
  
  /**
   * Shutdown the provider
   */
  shutdown() {
    this.isInitialized = false;
    this.clearCache();
    
    console.log('🦄 Uniswap Provider shutdown complete');
    this.emit('shutdown');
  }
}

export default UniswapProvider;