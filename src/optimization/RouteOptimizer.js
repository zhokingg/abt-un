import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import config from '../config/config.js';

/**
 * RouteOptimizer - Optimal trading path calculation for arbitrage
 * Finds the best routes across multiple exchanges and protocols
 */
class RouteOptimizer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      maxHops: options.maxHops || 3, // Maximum hops in a route
      minLiquidity: options.minLiquidity || 10000, // $10k minimum pool liquidity
      maxSlippage: options.maxSlippage || 0.01, // 1% max slippage
      maxGasCost: options.maxGasCost || 0.01, // 1% max gas cost of trade value
      routeCacheTime: options.routeCacheTime || 30000, // 30 seconds cache
      ...options
    };
    
    // Supported exchanges and protocols
    this.exchanges = {
      'uniswap-v2': {
        name: 'Uniswap V2',
        type: 'amm',
        feeRate: 0.003,
        gasPerSwap: 120000,
        routerAddress: config.UNISWAP_V2_ROUTER,
        enabled: true
      },
      'uniswap-v3': {
        name: 'Uniswap V3',
        type: 'concentrated_liquidity',
        feeRates: [0.0005, 0.003, 0.01],
        gasPerSwap: 140000,
        routerAddress: config.UNISWAP_V3_QUOTER,
        enabled: true
      },
      'sushiswap': {
        name: 'SushiSwap',
        type: 'amm',
        feeRate: 0.003,
        gasPerSwap: 125000,
        routerAddress: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
        enabled: false // Disabled by default, enable based on liquidity
      }
    };
    
    // Route cache for performance
    this.routeCache = new Map();
    this.liquidityCache = new Map();
    this.lastCacheUpdate = new Map();
    
    // Performance metrics
    this.metrics = {
      totalRouteCalculations: 0,
      optimalRoutesFound: 0,
      averageRouteLength: 0,
      averageGasSaved: 0,
      cacheHitRate: 0,
      lastOptimizationTime: null
    };
    
    this.isActive = false;
  }
  
  /**
   * Initialize the route optimizer
   */
  async initialize(web3Provider, priceDetector = null, liquidityDetector = null) {
    try {
      this.web3Provider = web3Provider;
      this.priceDetector = priceDetector;
      this.liquidityDetector = liquidityDetector;
      
      if (!this.web3Provider || !this.web3Provider.isConnected()) {
        throw new Error('Web3 provider not connected');
      }
      
      console.log('🚀 Initializing Route Optimizer...');
      console.log(`   Max hops: ${this.options.maxHops}`);
      console.log(`   Min liquidity: $${this.options.minLiquidity.toLocaleString()}`);
      console.log(`   Max slippage: ${this.options.maxSlippage * 100}%`);
      console.log(`   Enabled exchanges: ${Object.entries(this.exchanges).filter(([_, ex]) => ex.enabled).map(([id, _]) => id).join(', ')}`);
      
      this.isActive = true;
      this.startTime = Date.now();
      this.emit('initialized');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Route Optimizer:', error.message);
      throw error;
    }
  }
  
  /**
   * Find optimal route for a token swap
   */
  async findOptimalRoute(tokenA, tokenB, amountIn, options = {}) {
    if (!this.isActive) {
      throw new Error('Route optimizer not initialized');
    }
    
    const startTime = Date.now();
    this.metrics.totalRouteCalculations++;
    
    try {
      // Check cache first
      const cacheKey = `${tokenA}-${tokenB}-${amountIn}-${JSON.stringify(options)}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.metrics.cacheHitRate = (this.metrics.cacheHitRate + 1) / 2; // Running average
        return cached;
      }
      
      console.log(`🚀 Finding optimal route: ${tokenA} → ${tokenB} (${amountIn})`);
      
      // Generate all possible routes
      const allRoutes = await this.generateAllRoutes(tokenA, tokenB, options);
      
      if (allRoutes.length === 0) {
        throw new Error('No routes found');
      }
      
      // Calculate costs and returns for each route
      const evaluatedRoutes = await Promise.all(
        allRoutes.map(route => this.evaluateRoute(route, amountIn))
      );
      
      // Filter valid routes
      const validRoutes = evaluatedRoutes.filter(route => 
        route.valid && 
        route.outputAmount > 0 &&
        route.slippage <= this.options.maxSlippage &&
        route.gasRatio <= this.options.maxGasCost
      );
      
      if (validRoutes.length === 0) {
        throw new Error('No valid routes found');
      }
      
      // Find optimal route (highest net output)
      const optimalRoute = validRoutes.reduce((best, current) => 
        current.netOutputAmount > best.netOutputAmount ? current : best
      );
      
      // Cache the result
      this.addToCache(cacheKey, optimalRoute);
      
      this.metrics.optimalRoutesFound++;
      this.metrics.lastOptimizationTime = Date.now();
      this.updateMetrics(optimalRoute);
      
      const duration = Date.now() - startTime;
      console.log(`✅ Optimal route found in ${duration}ms:`);
      console.log(`   Path: ${optimalRoute.path.map(p => p.symbol || p.address?.slice(0, 8)).join(' → ')}`);
      console.log(`   Output: ${optimalRoute.outputAmount.toFixed(6)} ${tokenB}`);
      console.log(`   Net output: ${optimalRoute.netOutputAmount.toFixed(6)} ${tokenB}`);
      console.log(`   Gas cost: ${optimalRoute.gasCostETH.toFixed(6)} ETH`);
      console.log(`   Slippage: ${(optimalRoute.slippage * 100).toFixed(3)}%`);
      
      this.emit('optimalRouteFound', optimalRoute);
      return optimalRoute;
      
    } catch (error) {
      console.error('❌ Route optimization failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Generate all possible routes between two tokens
   */
  async generateAllRoutes(tokenA, tokenB, options = {}) {
    const routes = [];
    const maxHops = Math.min(options.maxHops || this.options.maxHops, 4);
    
    // Direct routes (single hop)
    for (const [exchangeId, exchange] of Object.entries(this.exchanges)) {
      if (!exchange.enabled) continue;
      
      const directRoute = {
        path: [tokenA, tokenB],
        exchanges: [exchangeId],
        hops: 1,
        type: 'direct'
      };
      
      routes.push(directRoute);
    }
    
    // Multi-hop routes if requested
    if (maxHops > 1) {
      const intermediateTokens = this.getIntermediateTokens();
      
      for (const intermediate of intermediateTokens) {
        if (intermediate === tokenA || intermediate === tokenB) continue;
        
        // 2-hop routes via intermediate token
        for (const exchange1 of Object.keys(this.exchanges)) {
          if (!this.exchanges[exchange1].enabled) continue;
          
          for (const exchange2 of Object.keys(this.exchanges)) {
            if (!this.exchanges[exchange2].enabled) continue;
            
            const twoHopRoute = {
              path: [tokenA, intermediate, tokenB],
              exchanges: [exchange1, exchange2],
              hops: 2,
              type: 'multi-hop'
            };
            
            routes.push(twoHopRoute);
          }
        }
        
        // 3-hop routes if requested
        if (maxHops >= 3) {
          for (const intermediate2 of intermediateTokens) {
            if (intermediate2 === tokenA || intermediate2 === tokenB || intermediate2 === intermediate) continue;
            
            for (const exchange1 of Object.keys(this.exchanges)) {
              if (!this.exchanges[exchange1].enabled) continue;
              
              for (const exchange2 of Object.keys(this.exchanges)) {
                if (!this.exchanges[exchange2].enabled) continue;
                
                for (const exchange3 of Object.keys(this.exchanges)) {
                  if (!this.exchanges[exchange3].enabled) continue;
                  
                  const threeHopRoute = {
                    path: [tokenA, intermediate, intermediate2, tokenB],
                    exchanges: [exchange1, exchange2, exchange3],
                    hops: 3,
                    type: 'multi-hop'
                  };
                  
                  routes.push(threeHopRoute);
                }
              }
            }
          }
        }
      }
    }
    
    console.log(`📊 Generated ${routes.length} potential routes`);
    return routes;
  }
  
  /**
   * Get intermediate tokens for multi-hop routes
   */
  getIntermediateTokens() {
    return [
      config.TOKENS.WETH,
      config.TOKENS.USDC,
      config.TOKENS.USDT,
      config.TOKENS.DAI,
      // Add more popular intermediate tokens
      '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC
      '0x514910771AF9Ca656af840dff83E8264EcF986CA'  // LINK
    ].filter(Boolean);
  }
  
  /**
   * Evaluate a route for cost and return
   */
  async evaluateRoute(route, amountIn) {
    try {
      let currentAmount = amountIn;
      let totalGasCost = 0;
      let totalSlippage = 0;
      let valid = true;
      
      const swapDetails = [];
      
      // Calculate each hop in the route
      for (let i = 0; i < route.path.length - 1; i++) {
        const tokenIn = route.path[i];
        const tokenOut = route.path[i + 1];
        const exchangeId = route.exchanges[i];
        const exchange = this.exchanges[exchangeId];
        
        if (!exchange) {
          valid = false;
          break;
        }
        
        // Get swap quote for this hop
        const swapQuote = await this.getSwapQuote(tokenIn, tokenOut, currentAmount, exchangeId);
        
        if (!swapQuote.success || swapQuote.outputAmount <= 0) {
          valid = false;
          break;
        }
        
        // Check liquidity requirements
        if (swapQuote.liquidity < this.options.minLiquidity) {
          valid = false;
          break;
        }
        
        currentAmount = swapQuote.outputAmount;
        totalGasCost += exchange.gasPerSwap;
        totalSlippage += swapQuote.slippage;
        
        swapDetails.push({
          tokenIn,
          tokenOut,
          amountIn: i === 0 ? amountIn : swapDetails[i-1].amountOut,
          amountOut: swapQuote.outputAmount,
          exchange: exchangeId,
          slippage: swapQuote.slippage,
          priceImpact: swapQuote.priceImpact,
          gasUsed: exchange.gasPerSwap
        });
      }
      
      if (!valid) {
        return { ...route, valid: false };
      }
      
      // Calculate gas cost in ETH and USD
      const gasCostETH = await this.calculateGasCostETH(totalGasCost);
      const gasCostUSD = gasCostETH * 2000; // Simplified ETH price
      const tradeValueUSD = amountIn * 2000; // Simplified calculation
      
      // Calculate final metrics
      const outputAmount = currentAmount;
      const netOutputAmount = outputAmount - (gasCostUSD / 2000); // Subtract gas cost
      const overallSlippage = totalSlippage / route.hops;
      const gasRatio = gasCostUSD / tradeValueUSD;
      
      return {
        ...route,
        valid: true,
        inputAmount: amountIn,
        outputAmount,
        netOutputAmount: Math.max(0, netOutputAmount),
        gasCost: totalGasCost,
        gasCostETH,
        gasCostUSD,
        slippage: overallSlippage,
        gasRatio,
        swapDetails,
        efficiency: netOutputAmount / amountIn, // Route efficiency metric
        timestamp: Date.now()
      };
      
    } catch (error) {
      console.warn(`⚠️ Error evaluating route:`, error.message);
      return { ...route, valid: false, error: error.message };
    }
  }
  
  /**
   * Get swap quote for a token pair on specific exchange
   */
  async getSwapQuote(tokenIn, tokenOut, amountIn, exchangeId) {
    try {
      // Simplified implementation - in production, this would call actual DEX contracts
      const exchange = this.exchanges[exchangeId];
      
      if (!exchange) {
        return { success: false, error: 'Exchange not found' };
      }
      
      // Mock liquidity check
      const mockLiquidity = 50000 + Math.random() * 450000; // $50k-500k
      
      if (mockLiquidity < this.options.minLiquidity) {
        return { success: false, error: 'Insufficient liquidity' };
      }
      
      // Simple price calculation with slippage
      const basePrice = 2000 + Math.random() * 100; // Mock price around $2000-2100
      const slippage = (amountIn / mockLiquidity) * 2; // Price impact based on trade size
      const effectivePrice = basePrice * (1 - slippage);
      const outputAmount = (amountIn / effectivePrice) * 0.997; // Apply fee
      
      return {
        success: true,
        outputAmount,
        slippage,
        priceImpact: slippage,
        liquidity: mockLiquidity,
        price: effectivePrice,
        fee: exchange.feeRate || 0.003
      };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Calculate gas cost in ETH
   */
  async calculateGasCostETH(gasUsed) {
    try {
      const feeData = await this.web3Provider.getProvider().getFeeData();
      const gasPrice = feeData.maxFeePerGas || feeData.gasPrice;
      
      if (!gasPrice) return 0.01; // Fallback
      
      const gasCostWei = BigInt(gasUsed) * gasPrice;
      return Number(ethers.formatEther(gasCostWei));
      
    } catch (error) {
      return 0.01; // Fallback gas cost
    }
  }
  
  /**
   * Find arbitrage routes between exchanges
   */
  async findArbitrageRoutes(tokenA, tokenB, amountIn) {
    console.log(`🔍 Finding arbitrage routes for ${tokenA}-${tokenB}...`);
    
    const routes = [];
    const enabledExchanges = Object.entries(this.exchanges).filter(([_, ex]) => ex.enabled);
    
    // Check all exchange pairs for arbitrage opportunities
    for (let i = 0; i < enabledExchanges.length; i++) {
      for (let j = i + 1; j < enabledExchanges.length; j++) {
        const [buyExchange, buyConfig] = enabledExchanges[i];
        const [sellExchange, sellConfig] = enabledExchanges[j];
        
        // Route 1: Buy on exchange i, sell on exchange j
        const route1 = await this.evaluateArbitrageRoute(tokenA, tokenB, amountIn, buyExchange, sellExchange);
        if (route1.valid && route1.profit > 0) {
          routes.push(route1);
        }
        
        // Route 2: Buy on exchange j, sell on exchange i
        const route2 = await this.evaluateArbitrageRoute(tokenA, tokenB, amountIn, sellExchange, buyExchange);
        if (route2.valid && route2.profit > 0) {
          routes.push(route2);
        }
      }
    }
    
    // Sort by profit
    routes.sort((a, b) => b.profit - a.profit);
    
    console.log(`✅ Found ${routes.length} profitable arbitrage routes`);
    return routes;
  }
  
  /**
   * Evaluate arbitrage route between two exchanges
   */
  async evaluateArbitrageRoute(tokenA, tokenB, amountIn, buyExchange, sellExchange) {
    try {
      // Get buy price
      const buyQuote = await this.getSwapQuote(tokenA, tokenB, amountIn, buyExchange);
      if (!buyQuote.success) {
        return { valid: false, error: 'Buy quote failed' };
      }
      
      // Get sell price
      const sellQuote = await this.getSwapQuote(tokenB, tokenA, buyQuote.outputAmount, sellExchange);
      if (!sellQuote.success) {
        return { valid: false, error: 'Sell quote failed' };
      }
      
      // Calculate profit
      const finalAmount = sellQuote.outputAmount;
      const profit = finalAmount - amountIn;
      const profitPercentage = (profit / amountIn) * 100;
      
      // Calculate gas costs
      const totalGas = this.exchanges[buyExchange].gasPerSwap + this.exchanges[sellExchange].gasPerSwap;
      const gasCostETH = await this.calculateGasCostETH(totalGas);
      const gasCostUSD = gasCostETH * 2000;
      
      const netProfit = profit - (gasCostUSD / 2000); // Assuming tokenA is worth ~$2000
      
      return {
        valid: true,
        type: 'arbitrage',
        tokenA,
        tokenB,
        buyExchange,
        sellExchange,
        amountIn,
        buyAmount: buyQuote.outputAmount,
        sellAmount: finalAmount,
        profit,
        netProfit,
        profitPercentage,
        gasCost: totalGas,
        gasCostETH,
        gasCostUSD,
        buySlippage: buyQuote.slippage,
        sellSlippage: sellQuote.slippage,
        timestamp: Date.now()
      };
      
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
  
  /**
   * Cache management
   */
  getFromCache(key) {
    const cached = this.routeCache.get(key);
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    if (age > this.options.routeCacheTime) {
      this.routeCache.delete(key);
      return null;
    }
    
    return cached.route;
  }
  
  addToCache(key, route) {
    this.routeCache.set(key, {
      route,
      timestamp: Date.now()
    });
    
    // Clean old cache entries
    if (this.routeCache.size > 1000) {
      const cutoff = Date.now() - this.options.routeCacheTime;
      for (const [cacheKey, entry] of this.routeCache.entries()) {
        if (entry.timestamp < cutoff) {
          this.routeCache.delete(cacheKey);
        }
      }
    }
  }
  
  /**
   * Update performance metrics
   */
  updateMetrics(route) {
    if (!route) return;
    
    // Update running averages
    this.metrics.averageRouteLength = (this.metrics.averageRouteLength + route.hops) / 2;
    
    if (route.gasCostUSD) {
      const gasSaved = (route.hops * 150000 - route.gasCost) / 150000; // Estimated savings vs naive routing
      this.metrics.averageGasSaved = (this.metrics.averageGasSaved + gasSaved) / 2;
    }
  }
  
  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.routeCache.size,
      enabledExchanges: Object.values(this.exchanges).filter(ex => ex.enabled).length,
      uptime: this.isActive ? Date.now() - (this.startTime || Date.now()) : 0
    };
  }
  
  /**
   * Clear cache
   */
  clearCache() {
    this.routeCache.clear();
    this.liquidityCache.clear();
    this.lastCacheUpdate.clear();
    console.log('🚀 Route cache cleared');
  }
  
  /**
   * Shutdown the optimizer
   */
  shutdown() {
    this.isActive = false;
    this.clearCache();
    
    console.log('🚀 Route Optimizer shutdown complete');
    this.emit('shutdown');
  }
}

export default RouteOptimizer;