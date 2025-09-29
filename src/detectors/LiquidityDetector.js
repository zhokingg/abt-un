import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import config from '../config/config.js';

/**
 * LiquidityDetector - Liquidity analysis across pools for optimal trade sizing
 * Monitors pool liquidity and calculates maximum trade sizes
 */
class LiquidityDetector extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      minLiquidity: options.minLiquidity || 10000, // $10k minimum liquidity
      liquidityThreshold: options.liquidityThreshold || 0.05, // 5% of pool liquidity max trade
      updateInterval: options.updateInterval || 5000, // 5 seconds
      priceImpactLimit: options.priceImpactLimit || 0.03, // 3% max price impact
      ...options
    };
    
    // Liquidity tracking
    this.liquidityCache = new Map();
    this.poolInfo = new Map();
    this.lastUpdate = new Map();
    
    // Pool configurations for different exchanges
    this.poolTypes = {
      'uniswap-v2': {
        name: 'Uniswap V2',
        factoryAddress: config.UNISWAP_V2_FACTORY,
        feeRate: 0.003 // 0.3%
      },
      'uniswap-v3': {
        name: 'Uniswap V3',
        factoryAddress: config.UNISWAP_V3_FACTORY,
        feeRates: [0.0005, 0.003, 0.01] // 0.05%, 0.3%, 1%
      }
    };
    
    // Performance metrics
    this.metrics = {
      totalPools: 0,
      validPools: 0,
      totalLiquidity: 0,
      averageLiquidity: 0,
      lastAnalysisTime: null,
      poolUpdatesPerSecond: 0
    };
    
    this.isActive = false;
    this.updateTimer = null;
  }
  
  /**
   * Initialize the liquidity detector
   */
  async initialize(web3Provider) {
    try {
      this.web3Provider = web3Provider;
      
      if (!this.web3Provider || !this.web3Provider.isConnected()) {
        throw new Error('Web3 provider not connected');
      }
      
      console.log('💧 Initializing Liquidity Detector...');
      console.log(`   Min liquidity: $${this.options.minLiquidity.toLocaleString()}`);
      console.log(`   Liquidity threshold: ${this.options.liquidityThreshold * 100}%`);
      console.log(`   Price impact limit: ${this.options.priceImpactLimit * 100}%`);
      
      this.isActive = true;
      this.startTime = Date.now();
      this.emit('initialized');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Liquidity Detector:', error.message);
      throw error;
    }
  }
  
  /**
   * Start liquidity monitoring
   */
  startMonitoring(tokenPairs = []) {
    if (!this.isActive) {
      throw new Error('Liquidity detector not initialized');
    }
    
    console.log(`💧 Starting liquidity monitoring for ${tokenPairs.length} pairs...`);
    
    this.monitoredPairs = tokenPairs;
    
    // Start update timer
    this.updateTimer = setInterval(() => {
      this.updateLiquidity();
    }, this.options.updateInterval);
    
    // Initial liquidity update
    this.updateLiquidity();
    
    this.emit('monitoringStarted', { pairs: tokenPairs.length });
  }
  
  /**
   * Stop liquidity monitoring
   */
  stopMonitoring() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    
    console.log('💧 Liquidity monitoring stopped');
    this.emit('monitoringStopped');
  }
  
  /**
   * Update liquidity for all monitored pairs
   */
  async updateLiquidity() {
    if (!this.monitoredPairs || this.monitoredPairs.length === 0) {
      return;
    }
    
    const updatePromises = this.monitoredPairs.map(pair => 
      this.updatePairLiquidity(pair).catch(error => {
        console.warn(`⚠️ Failed to update liquidity for ${pair.tokenA}-${pair.tokenB}:`, error.message);
        return null;
      })
    );
    
    const results = await Promise.allSettled(updatePromises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
    
    this.metrics.lastAnalysisTime = Date.now();
    this.emit('liquidityUpdated', { successful, total: this.monitoredPairs.length });
  }
  
  /**
   * Update liquidity for a specific token pair
   */
  async updatePairLiquidity(pair) {
    const pairKey = `${pair.tokenA}-${pair.tokenB}`;
    const currentTime = Date.now();
    
    try {
      // Get liquidity from all pool types
      const liquidityPromises = Object.entries(this.poolTypes).map(([poolType, config]) => 
        this.getPoolLiquidity(pair, poolType).then(liquidity => ({
          poolType,
          config,
          liquidity,
          timestamp: currentTime
        }))
      );
      
      const liquidityData = await Promise.all(liquidityPromises);
      const validPools = liquidityData.filter(p => p.liquidity && p.liquidity.totalUSD > 0);
      
      if (validPools.length === 0) {
        return null;
      }
      
      // Update liquidity cache
      this.liquidityCache.set(pairKey, validPools);
      this.lastUpdate.set(pairKey, currentTime);
      
      // Calculate optimal trade sizes
      const tradeAnalysis = this.calculateOptimalTradeSizes(pair, validPools);
      
      // Emit liquidity analysis
      this.emit('liquidityAnalyzed', {
        pair: pairKey,
        liquidity: validPools,
        tradeAnalysis,
        timestamp: currentTime
      });
      
      return validPools;
    } catch (error) {
      console.error(`❌ Error updating liquidity for ${pairKey}:`, error.message);
      return null;
    }
  }
  
  /**
   * Get pool liquidity for a specific pool type
   */
  async getPoolLiquidity(pair, poolType) {
    try {
      if (poolType === 'uniswap-v2') {
        return this.getUniswapV2Liquidity(pair);
      } else if (poolType === 'uniswap-v3') {
        return this.getUniswapV3Liquidity(pair);
      }
      
      return null;
    } catch (error) {
      console.warn(`⚠️ Failed to get ${poolType} liquidity for ${pair.tokenA}-${pair.tokenB}:`, error.message);
      return null;
    }
  }
  
  /**
   * Get Uniswap V2 pool liquidity (simplified)
   */
  async getUniswapV2Liquidity(pair) {
    // Simplified mock implementation
    // In production, this would interact with Uniswap V2 factory and pair contracts
    
    const mockReserves = {
      token0: 100 + Math.random() * 900, // 100-1000 ETH
      token1: 200000 + Math.random() * 1800000, // $200k-2M USDC
      totalUSD: 0
    };
    
    mockReserves.totalUSD = mockReserves.token0 * 2000 + mockReserves.token1; // Assuming ETH=$2000
    
    return {
      poolAddress: '0x' + Math.random().toString(16).substr(2, 40),
      reserves: mockReserves,
      totalUSD: mockReserves.totalUSD,
      token0: pair.tokenA,
      token1: pair.tokenB,
      fee: this.poolTypes['uniswap-v2'].feeRate
    };
  }
  
  /**
   * Get Uniswap V3 pool liquidity (simplified)
   */
  async getUniswapV3Liquidity(pair) {
    // Simplified mock implementation
    // In production, this would interact with Uniswap V3 factory and pool contracts
    
    const mockLiquidity = {
      activeLiquidity: 50000 + Math.random() * 450000, // $50k-500k
      totalLiquidity: 500000 + Math.random() * 4500000, // $500k-5M
      currentTick: Math.floor(Math.random() * 1000) - 500,
      totalUSD: 0
    };
    
    mockLiquidity.totalUSD = mockLiquidity.totalLiquidity;
    
    const feeRates = this.poolTypes['uniswap-v3'].feeRates;
    const selectedFee = feeRates[Math.floor(Math.random() * feeRates.length)];
    
    return {
      poolAddress: '0x' + Math.random().toString(16).substr(2, 40),
      liquidity: mockLiquidity,
      totalUSD: mockLiquidity.totalUSD,
      token0: pair.tokenA,
      token1: pair.tokenB,
      fee: selectedFee,
      tickSpacing: selectedFee === 0.0005 ? 10 : selectedFee === 0.003 ? 60 : 200
    };
  }
  
  /**
   * Calculate optimal trade sizes based on liquidity
   */
  calculateOptimalTradeSizes(pair, pools) {
    const analysis = {
      maxTradeSize: 0,
      recommendedTradeSize: 0,
      priceImpact: {},
      liquidityUtilization: {},
      bestPool: null
    };
    
    let bestPool = null;
    let maxLiquidity = 0;
    
    for (const pool of pools) {
      const liquidityUSD = pool.liquidity ? pool.liquidity.totalUSD : pool.totalUSD;
      
      if (liquidityUSD > maxLiquidity) {
        maxLiquidity = liquidityUSD;
        bestPool = pool;
      }
      
      // Calculate max trade size (% of pool liquidity)
      const maxTrade = liquidityUSD * this.options.liquidityThreshold;
      const recommendedTrade = liquidityUSD * (this.options.liquidityThreshold / 2); // Conservative
      
      analysis.maxTradeSize = Math.max(analysis.maxTradeSize, maxTrade);
      analysis.recommendedTradeSize = Math.max(analysis.recommendedTradeSize, recommendedTrade);
      
      // Calculate price impact for different trade sizes
      const tradeSizes = [1000, 5000, 10000, 25000, 50000]; // USD amounts
      analysis.priceImpact[pool.poolType] = {};
      
      for (const tradeSize of tradeSizes) {
        if (tradeSize <= liquidityUSD) {
          analysis.priceImpact[pool.poolType][tradeSize] = this.calculatePriceImpact(tradeSize, liquidityUSD, pool);
        }
      }
      
      // Calculate liquidity utilization
      analysis.liquidityUtilization[pool.poolType] = {
        available: liquidityUSD,
        utilizationPercent: (recommendedTrade / liquidityUSD) * 100
      };
    }
    
    analysis.bestPool = bestPool;
    
    // Apply minimum liquidity filter
    if (maxLiquidity < this.options.minLiquidity) {
      analysis.maxTradeSize = 0;
      analysis.recommendedTradeSize = 0;
      
      this.emit('lowLiquidity', {
        pair: `${pair.tokenA}-${pair.tokenB}`,
        liquidity: maxLiquidity,
        minimum: this.options.minLiquidity
      });
    }
    
    return analysis;
  }
  
  /**
   * Calculate price impact for a trade
   */
  calculatePriceImpact(tradeSize, poolLiquidity, pool) {
    // Simplified price impact calculation
    // Real implementation would use AMM formulas (x*y=k for V2, concentrated liquidity for V3)
    
    const utilizationRatio = tradeSize / poolLiquidity;
    
    let priceImpact;
    if (pool.poolType === 'uniswap-v2') {
      // V2 uses constant product formula: impact increases quadratically
      priceImpact = utilizationRatio * (1 + utilizationRatio);
    } else if (pool.poolType === 'uniswap-v3') {
      // V3 concentrated liquidity: impact varies by tick range
      priceImpact = utilizationRatio * 0.8; // Generally lower impact due to concentration
    } else {
      priceImpact = utilizationRatio;
    }
    
    return Math.min(priceImpact, 1.0); // Cap at 100%
  }
  
  /**
   * Analyze optimal trade size for a specific opportunity
   */
  analyzeTradeSize(tokenA, tokenB, desiredTradeSize) {
    const pairKey = `${tokenA}-${tokenB}`;
    const pools = this.liquidityCache.get(pairKey);
    
    if (!pools) {
      return {
        approved: false,
        reason: 'No liquidity data available',
        maxTradeSize: 0,
        priceImpact: 1.0
      };
    }
    
    // Find best pool for the trade
    let bestPool = null;
    let minPriceImpact = 1.0;
    
    for (const pool of pools) {
      const liquidityUSD = pool.liquidity ? pool.liquidity.totalUSD : pool.totalUSD;
      
      if (liquidityUSD < this.options.minLiquidity) continue;
      
      const priceImpact = this.calculatePriceImpact(desiredTradeSize, liquidityUSD, pool);
      
      if (priceImpact < minPriceImpact) {
        minPriceImpact = priceImpact;
        bestPool = pool;
      }
    }
    
    if (!bestPool) {
      return {
        approved: false,
        reason: 'Insufficient liquidity',
        maxTradeSize: 0,
        priceImpact: 1.0
      };
    }
    
    const liquidityUSD = bestPool.liquidity ? bestPool.liquidity.totalUSD : bestPool.totalUSD;
    const maxTradeSize = liquidityUSD * this.options.liquidityThreshold;
    
    return {
      approved: minPriceImpact <= this.options.priceImpactLimit && desiredTradeSize <= maxTradeSize,
      reason: minPriceImpact > this.options.priceImpactLimit ? 'Price impact too high' : 
              desiredTradeSize > maxTradeSize ? 'Trade size too large' : 'Approved',
      maxTradeSize,
      recommendedTradeSize: Math.min(desiredTradeSize, maxTradeSize * 0.8), // 80% of max for safety
      priceImpact: minPriceImpact,
      bestPool: bestPool.poolType,
      poolAddress: bestPool.poolAddress
    };
  }
  
  /**
   * Get current liquidity data for a pair
   */
  getLiquidity(tokenA, tokenB) {
    const pairKey = `${tokenA}-${tokenB}`;
    return this.liquidityCache.get(pairKey) || null;
  }
  
  /**
   * Get performance metrics
   */
  getMetrics() {
    const totalLiquidity = Array.from(this.liquidityCache.values())
      .reduce((sum, pools) => {
        const poolSum = pools.reduce((pSum, pool) => {
          const liquidityUSD = pool.liquidity ? pool.liquidity.totalUSD : pool.totalUSD;
          return pSum + liquidityUSD;
        }, 0);
        return sum + poolSum;
      }, 0);
    
    const validPools = Array.from(this.liquidityCache.values())
      .reduce((count, pools) => {
        return count + pools.filter(pool => {
          const liquidityUSD = pool.liquidity ? pool.liquidity.totalUSD : pool.totalUSD;
          return liquidityUSD >= this.options.minLiquidity;
        }).length;
      }, 0);
    
    const totalPools = Array.from(this.liquidityCache.values())
      .reduce((count, pools) => count + pools.length, 0);
    
    return {
      ...this.metrics,
      totalPools,
      validPools,
      totalLiquidity,
      averageLiquidity: totalPools > 0 ? totalLiquidity / totalPools : 0,
      uptime: this.isActive ? Date.now() - (this.startTime || Date.now()) : 0,
      monitoredPairs: this.monitoredPairs ? this.monitoredPairs.length : 0,
      cachedPools: this.liquidityCache.size
    };
  }
  
  /**
   * Shutdown the detector
   */
  shutdown() {
    this.stopMonitoring();
    this.isActive = false;
    this.liquidityCache.clear();
    this.poolInfo.clear();
    this.lastUpdate.clear();
    
    console.log('💧 Liquidity Detector shutdown complete');
    this.emit('shutdown');
  }
}

export default LiquidityDetector;