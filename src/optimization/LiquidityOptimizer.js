import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import config from '../config/config.js';

/**
 * LiquidityOptimizer - Trade size optimization based on liquidity analysis
 * Calculates optimal trade sizes to minimize slippage and maximize efficiency
 */
class LiquidityOptimizer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      maxSlippage: options.maxSlippage || 0.02, // 2% max slippage
      optimalSlippage: options.optimalSlippage || 0.005, // 0.5% optimal slippage
      minTradeSize: options.minTradeSize || 100, // $100 minimum
      maxTradeSize: options.maxTradeSize || 100000, // $100k maximum
      liquidityBuffer: options.liquidityBuffer || 0.1, // 10% liquidity buffer
      riskTolerance: options.riskTolerance || 0.3, // 30% risk tolerance
      ...options
    };
    
    // Optimization strategies
    this.strategies = {
      CONSERVATIVE: {
        name: 'Conservative',
        description: 'Minimize slippage, smaller positions',
        maxSlippageMultiplier: 0.5,
        liquidityUtilization: 0.05, // 5% of pool liquidity
        riskAdjustment: 0.7
      },
      BALANCED: {
        name: 'Balanced',
        description: 'Balance between size and slippage',
        maxSlippageMultiplier: 1.0,
        liquidityUtilization: 0.1, // 10% of pool liquidity
        riskAdjustment: 1.0
      },
      AGGRESSIVE: {
        name: 'Aggressive',
        description: 'Maximize position size',
        maxSlippageMultiplier: 1.5,
        liquidityUtilization: 0.2, // 20% of pool liquidity
        riskAdjustment: 1.3
      },
      ADAPTIVE: {
        name: 'Adaptive',
        description: 'Dynamic optimization based on conditions',
        maxSlippageMultiplier: 1.0, // Will adjust dynamically
        liquidityUtilization: 0.1, // Will adjust dynamically
        riskAdjustment: 1.0 // Will adjust dynamically
      }
    };
    
    // Liquidity data cache
    this.liquidityCache = new Map();
    this.poolAnalysis = new Map();
    this.historicalSlippage = new Map();
    
    // Performance metrics
    this.metrics = {
      totalOptimizations: 0,
      averageSlippage: 0,
      slippageAccuracy: 0,
      optimalSizes: 0,
      liquidityEfficiency: 0,
      riskAdjustedReturns: 0,
      lastOptimizationTime: null
    };
    
    this.isActive = false;
  }
  
  /**
   * Initialize the liquidity optimizer
   */
  async initialize(liquidityDetector = null, priceDetector = null) {
    try {
      this.liquidityDetector = liquidityDetector;
      this.priceDetector = priceDetector;
      
      console.log('💧 Initializing Liquidity Optimizer...');
      console.log(`   Max slippage: ${this.options.maxSlippage * 100}%`);
      console.log(`   Optimal slippage: ${this.options.optimalSlippage * 100}%`);
      console.log(`   Trade size range: $${this.options.minTradeSize} - $${this.options.maxTradeSize.toLocaleString()}`);
      console.log(`   Liquidity buffer: ${this.options.liquidityBuffer * 100}%`);
      
      this.isActive = true;
      this.startTime = Date.now();
      this.emit('initialized');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Liquidity Optimizer:', error.message);
      throw error;
    }
  }
  
  /**
   * Optimize trade size for a specific opportunity
   */
  async optimizeTradeSize(opportunity, strategy = 'BALANCED') {
    if (!this.isActive) {
      throw new Error('Liquidity optimizer not initialized');
    }
    
    this.metrics.totalOptimizations++;
    const startTime = Date.now();
    
    try {
      console.log(`💧 Optimizing trade size for ${opportunity.pair || 'unknown pair'}...`);
      
      // Get liquidity data
      const liquidityData = await this.getLiquidityData(opportunity);
      if (!liquidityData || liquidityData.length === 0) {
        throw new Error('No liquidity data available');
      }
      
      // Analyze pools for optimization
      const poolAnalysis = await this.analyzePoolsForOptimization(liquidityData, opportunity);
      
      // Calculate optimal trade size
      const optimization = await this.calculateOptimalTradeSize(
        opportunity,
        poolAnalysis,
        strategy
      );
      
      // Validate and adjust optimization
      const validatedOptimization = this.validateOptimization(optimization, opportunity);
      
      // Update metrics
      this.updateOptimizationMetrics(validatedOptimization);
      
      const duration = Date.now() - startTime;
      console.log(`✅ Trade size optimized in ${duration}ms:`);
      console.log(`   Original size: $${opportunity.tradeAmount?.toLocaleString() || 'N/A'}`);
      console.log(`   Optimized size: $${validatedOptimization.optimalTradeSize.toLocaleString()}`);
      console.log(`   Expected slippage: ${(validatedOptimization.expectedSlippage * 100).toFixed(3)}%`);
      console.log(`   Efficiency score: ${(validatedOptimization.efficiencyScore * 100).toFixed(1)}%`);
      
      this.emit('tradeSizeOptimized', validatedOptimization);
      return validatedOptimization;
      
    } catch (error) {
      console.error('❌ Trade size optimization failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Get liquidity data for optimization
   */
  async getLiquidityData(opportunity) {
    // If we have a liquidity detector, use it
    if (this.liquidityDetector) {
      const tokenA = opportunity.tokenA || opportunity.token0;
      const tokenB = opportunity.tokenB || opportunity.token1;
      
      if (tokenA && tokenB) {
        return this.liquidityDetector.getLiquidity(tokenA, tokenB);
      }
    }
    
    // Fallback: use cached data or mock data
    const pairKey = opportunity.pair || 'ETH-USDC';
    let cached = this.liquidityCache.get(pairKey);
    
    if (!cached || Date.now() - cached.timestamp > 30000) {
      // Generate mock liquidity data
      cached = {
        pools: this.generateMockLiquidityData(pairKey),
        timestamp: Date.now()
      };
      this.liquidityCache.set(pairKey, cached);
    }
    
    return cached.pools;
  }
  
  /**
   * Generate mock liquidity data for testing
   */
  generateMockLiquidityData(pairKey) {
    return [
      {
        poolType: 'uniswap-v2',
        totalUSD: 150000 + Math.random() * 850000, // $150k-1M
        reserves: {
          token0: 50 + Math.random() * 200, // ETH
          token1: 100000 + Math.random() * 400000, // USDC
        },
        fee: 0.003,
        poolAddress: '0x' + Math.random().toString(16).substr(2, 40)
      },
      {
        poolType: 'uniswap-v3',
        totalUSD: 500000 + Math.random() * 4500000, // $500k-5M
        liquidity: {
          activeLiquidity: 200000 + Math.random() * 800000,
          totalLiquidity: 500000 + Math.random() * 4500000,
          currentTick: Math.floor(Math.random() * 1000) - 500,
        },
        fee: [0.0005, 0.003, 0.01][Math.floor(Math.random() * 3)],
        poolAddress: '0x' + Math.random().toString(16).substr(2, 40)
      }
    ];
  }
  
  /**
   * Analyze pools for optimization opportunities
   */
  async analyzePoolsForOptimization(pools, opportunity) {
    const analysis = {
      bestPool: null,
      poolComparisons: [],
      liquidityDistribution: {},
      riskAssessment: {},
      optimalStrategy: 'BALANCED'
    };
    
    let bestScore = 0;
    
    for (const pool of pools) {
      const poolAnalysis = await this.analyzeIndividualPool(pool, opportunity);
      analysis.poolComparisons.push(poolAnalysis);
      
      if (poolAnalysis.optimizationScore > bestScore) {
        bestScore = poolAnalysis.optimizationScore;
        analysis.bestPool = poolAnalysis;
      }
      
      // Track liquidity distribution
      const liquidityUSD = pool.totalUSD || (pool.liquidity ? pool.liquidity.totalUSD : 0);
      analysis.liquidityDistribution[pool.poolType] = liquidityUSD;
    }
    
    // Calculate overall risk assessment
    analysis.riskAssessment = this.calculateRiskAssessment(pools, opportunity);
    
    // Determine optimal strategy based on conditions
    analysis.optimalStrategy = this.determineOptimalStrategy(analysis);
    
    return analysis;
  }
  
  /**
   * Analyze individual pool for optimization
   */
  async analyzeIndividualPool(pool, opportunity) {
    const liquidityUSD = pool.totalUSD || (pool.liquidity ? pool.liquidity.totalUSD : 0);
    const feeRate = pool.fee || 0.003;
    
    // Calculate liquidity depth at different trade sizes
    const tradeSizes = [1000, 5000, 10000, 25000, 50000];
    const depthAnalysis = {};
    
    for (const size of tradeSizes) {
      if (size <= liquidityUSD) {
        depthAnalysis[size] = this.calculateSlippageForTradeSize(pool, size);
      }
    }
    
    // Calculate pool efficiency metrics
    const efficiency = this.calculatePoolEfficiency(pool, opportunity);
    
    // Calculate optimization score
    const optimizationScore = this.calculatePoolOptimizationScore(pool, efficiency, depthAnalysis);
    
    return {
      poolType: pool.poolType,
      poolAddress: pool.poolAddress,
      liquidityUSD,
      feeRate,
      depthAnalysis,
      efficiency,
      optimizationScore,
      recommendedMaxTradeSize: liquidityUSD * 0.1, // 10% of liquidity
      timestamp: Date.now()
    };
  }
  
  /**
   * Calculate slippage for a specific trade size
   */
  calculateSlippageForTradeSize(pool, tradeSize) {
    const liquidityUSD = pool.totalUSD || (pool.liquidity ? pool.liquidity.totalUSD : 0);
    const utilizationRatio = tradeSize / liquidityUSD;
    
    let slippage;
    
    if (pool.poolType === 'uniswap-v2') {
      // Constant product formula: slippage increases quadratically
      slippage = utilizationRatio * (1 + utilizationRatio * 2);
    } else if (pool.poolType === 'uniswap-v3') {
      // Concentrated liquidity: varies by active liquidity
      const activeLiquidity = pool.liquidity?.activeLiquidity || liquidityUSD * 0.4;
      const activeUtilization = tradeSize / activeLiquidity;
      slippage = activeUtilization * (1 + activeUtilization);
    } else {
      // Generic AMM formula
      slippage = utilizationRatio * 1.5;
    }
    
    return {
      slippage: Math.min(slippage, 1.0), // Cap at 100%
      priceImpact: slippage * 0.8,
      utilizationRatio,
      feasible: slippage <= this.options.maxSlippage
    };
  }
  
  /**
   * Calculate pool efficiency for optimization
   */
  calculatePoolEfficiency(pool, opportunity) {
    const liquidityUSD = pool.totalUSD || (pool.liquidity ? pool.liquidity.totalUSD : 0);
    const feeRate = pool.fee || 0.003;
    
    // Base efficiency on liquidity-to-fee ratio
    let efficiency = liquidityUSD / (feeRate * 1000000); // Normalize
    
    // Adjust for pool type advantages
    if (pool.poolType === 'uniswap-v3') {
      efficiency *= 1.2; // V3 concentrated liquidity advantage
    }
    
    // Adjust for opportunity characteristics
    if (opportunity.urgency === 'high') {
      efficiency *= (liquidityUSD > 1000000 ? 1.1 : 0.9); // Favor high liquidity for urgent trades
    }
    
    return Math.min(efficiency / 1000, 1.0); // Normalize to 0-1
  }
  
  /**
   * Calculate pool optimization score
   */
  calculatePoolOptimizationScore(pool, efficiency, depthAnalysis) {
    let score = efficiency * 0.4; // 40% weight on efficiency
    
    // Add depth score (30% weight)
    const depthScores = Object.values(depthAnalysis).map(d => d.feasible ? 1 - d.slippage : 0);
    const averageDepthScore = depthScores.length > 0 ? depthScores.reduce((sum, s) => sum + s, 0) / depthScores.length : 0;
    score += averageDepthScore * 0.3;
    
    // Add liquidity score (20% weight)
    const liquidityUSD = pool.totalUSD || (pool.liquidity ? pool.liquidity.totalUSD : 0);
    const liquidityScore = Math.min(liquidityUSD / 1000000, 1.0); // Normalize to $1M
    score += liquidityScore * 0.2;
    
    // Add fee score (10% weight)
    const feeScore = 1 - (pool.fee || 0.003) / 0.01; // Lower fees = higher score
    score += Math.max(0, feeScore) * 0.1;
    
    return Math.min(score, 1.0);
  }
  
  /**
   * Calculate risk assessment for the opportunity
   */
  calculateRiskAssessment(pools, opportunity) {
    const totalLiquidity = pools.reduce((sum, pool) => {
      return sum + (pool.totalUSD || (pool.liquidity ? pool.liquidity.totalUSD : 0));
    }, 0);
    
    const averageFee = pools.reduce((sum, pool) => sum + (pool.fee || 0.003), 0) / pools.length;
    
    // Calculate liquidity concentration risk
    const liquidityConcentration = this.calculateLiquidityConcentration(pools);
    
    // Calculate slippage risk
    const maxTradeSize = opportunity.tradeAmount || 10000;
    const slippageRisk = this.calculateSlippageRisk(pools, maxTradeSize);
    
    return {
      totalLiquidity,
      averageFee,
      liquidityConcentration,
      slippageRisk,
      overallRisk: (liquidityConcentration + slippageRisk) / 2,
      riskLevel: this.categorizeRisk((liquidityConcentration + slippageRisk) / 2)
    };
  }
  
  /**
   * Calculate liquidity concentration risk
   */
  calculateLiquidityConcentration(pools) {
    if (pools.length <= 1) return 1.0; // High risk with only one pool
    
    const liquidities = pools.map(pool => pool.totalUSD || (pool.liquidity ? pool.liquidity.totalUSD : 0));
    const total = liquidities.reduce((sum, liq) => sum + liq, 0);
    
    // Calculate Herfindahl-Hirschman Index (concentration measure)
    const hhi = liquidities.reduce((sum, liq) => {
      const share = liq / total;
      return sum + (share * share);
    }, 0);
    
    return hhi; // Higher values indicate more concentration (more risk)
  }
  
  /**
   * Calculate slippage risk for a trade size
   */
  calculateSlippageRisk(pools, tradeSize) {
    let minSlippage = 1.0;
    
    for (const pool of pools) {
      const slippageAnalysis = this.calculateSlippageForTradeSize(pool, tradeSize);
      minSlippage = Math.min(minSlippage, slippageAnalysis.slippage);
    }
    
    return minSlippage; // Lower slippage = lower risk
  }
  
  /**
   * Categorize risk level
   */
  categorizeRisk(riskScore) {
    if (riskScore <= 0.2) return 'low';
    if (riskScore <= 0.5) return 'medium';
    if (riskScore <= 0.8) return 'high';
    return 'very_high';
  }
  
  /**
   * Determine optimal strategy based on analysis
   */
  determineOptimalStrategy(analysis) {
    const riskLevel = analysis.riskAssessment.riskLevel;
    const totalLiquidity = analysis.riskAssessment.totalLiquidity;
    
    if (riskLevel === 'very_high' || totalLiquidity < 50000) {
      return 'CONSERVATIVE';
    } else if (riskLevel === 'high') {
      return 'BALANCED';
    } else if (riskLevel === 'low' && totalLiquidity > 1000000) {
      return 'AGGRESSIVE';
    } else {
      return 'ADAPTIVE';
    }
  }
  
  /**
   * Calculate optimal trade size
   */
  async calculateOptimalTradeSize(opportunity, poolAnalysis, strategy) {
    const strategyConfig = this.strategies[strategy];
    if (!strategyConfig) {
      throw new Error(`Unknown strategy: ${strategy}`);
    }
    
    const bestPool = poolAnalysis.bestPool;
    if (!bestPool) {
      throw new Error('No suitable pool found');
    }
    
    // Calculate base optimal size
    let optimalSize = this.calculateBaseOptimalSize(bestPool, strategyConfig);
    
    // Apply opportunity-specific adjustments
    optimalSize = this.applyOpportunityAdjustments(optimalSize, opportunity, poolAnalysis);
    
    // Apply strategy-specific adjustments
    optimalSize = this.applyStrategyAdjustments(optimalSize, strategy, strategyConfig, poolAnalysis);
    
    // Apply constraints
    optimalSize = this.applyConstraints(optimalSize, opportunity);
    
    // Calculate expected outcomes
    const expectedSlippage = this.calculateExpectedSlippage(optimalSize, bestPool);
    const efficiencyScore = this.calculateEfficiencyScore(optimalSize, opportunity, poolAnalysis);
    
    return {
      optimalTradeSize: Math.round(optimalSize),
      originalTradeSize: opportunity.tradeAmount || 0,
      sizeAdjustment: opportunity.tradeAmount ? (optimalSize / opportunity.tradeAmount) : 1,
      expectedSlippage,
      maxSlippage: this.options.maxSlippage,
      efficiencyScore,
      bestPool: bestPool.poolType,
      poolAddress: bestPool.poolAddress,
      strategy,
      riskLevel: poolAnalysis.riskAssessment.riskLevel,
      confidenceLevel: this.calculateConfidenceLevel(poolAnalysis),
      optimization: {
        liquidityUtilization: optimalSize / bestPool.liquidityUSD,
        feeImpact: bestPool.feeRate,
        priceImpact: expectedSlippage * 0.8
      },
      timestamp: Date.now()
    };
  }
  
  /**
   * Calculate base optimal size using pool characteristics
   */
  calculateBaseOptimalSize(pool, strategyConfig) {
    const maxLiquidityUtilization = strategyConfig.liquidityUtilization;
    const liquidityUSD = pool.liquidityUSD;
    
    // Start with liquidity-based sizing
    let baseSize = liquidityUSD * maxLiquidityUtilization;
    
    // Adjust for pool efficiency
    baseSize *= pool.efficiency;
    
    return baseSize;
  }
  
  /**
   * Apply opportunity-specific adjustments
   */
  applyOpportunityAdjustments(baseSize, opportunity, poolAnalysis) {
    let adjustedSize = baseSize;
    
    // Adjust for opportunity profit margin
    if (opportunity.profitPercentage) {
      if (opportunity.profitPercentage > 5) {
        adjustedSize *= 1.2; // Increase size for high-profit opportunities
      } else if (opportunity.profitPercentage < 1) {
        adjustedSize *= 0.8; // Decrease size for low-profit opportunities
      }
    }
    
    // Adjust for urgency
    if (opportunity.urgency === 'high') {
      adjustedSize *= 0.9; // Slightly smaller for urgent trades to reduce slippage
    } else if (opportunity.urgency === 'low') {
      adjustedSize *= 1.1; // Larger for non-urgent trades
    }
    
    // Adjust for risk level
    const riskMultiplier = {
      'low': 1.2,
      'medium': 1.0,
      'high': 0.8,
      'very_high': 0.6
    };
    
    adjustedSize *= riskMultiplier[poolAnalysis.riskAssessment.riskLevel] || 1.0;
    
    return adjustedSize;
  }
  
  /**
   * Apply strategy-specific adjustments
   */
  applyStrategyAdjustments(baseSize, strategy, strategyConfig, poolAnalysis) {
    let adjustedSize = baseSize;
    
    // Apply risk adjustment
    adjustedSize *= strategyConfig.riskAdjustment;
    
    // Apply strategy-specific logic
    if (strategy === 'ADAPTIVE') {
      // Dynamic adjustment based on market conditions
      const networkCongestion = 0.5; // Simplified - would get from network state
      const volatility = poolAnalysis.riskAssessment.slippageRisk;
      
      if (networkCongestion > 0.7) {
        adjustedSize *= 0.9; // Reduce size in high congestion
      }
      
      if (volatility > 0.5) {
        adjustedSize *= 0.85; // Reduce size in high volatility
      }
    }
    
    return adjustedSize;
  }
  
  /**
   * Apply size constraints
   */
  applyConstraints(size, opportunity) {
    // Apply min/max constraints
    size = Math.max(this.options.minTradeSize, size);
    size = Math.min(this.options.maxTradeSize, size);
    
    // Don't exceed original trade size by more than 50% (safety check)
    if (opportunity.tradeAmount && size > opportunity.tradeAmount * 1.5) {
      size = opportunity.tradeAmount * 1.5;
    }
    
    return size;
  }
  
  /**
   * Calculate expected slippage for optimal size
   */
  calculateExpectedSlippage(tradeSize, pool) {
    const slippageAnalysis = this.calculateSlippageForTradeSize({ 
      poolType: pool.poolType,
      totalUSD: pool.liquidityUSD,
      liquidity: pool.liquidity,
      fee: pool.feeRate
    }, tradeSize);
    
    return slippageAnalysis.slippage;
  }
  
  /**
   * Calculate efficiency score for the optimization
   */
  calculateEfficiencyScore(tradeSize, opportunity, poolAnalysis) {
    const expectedSlippage = this.calculateExpectedSlippage(tradeSize, poolAnalysis.bestPool);
    const riskScore = 1 - poolAnalysis.riskAssessment.overallRisk;
    const liquidityScore = Math.min(poolAnalysis.bestPool.liquidityUSD / 500000, 1.0);
    
    // Weighted efficiency score
    const efficiency = (
      (1 - expectedSlippage) * 0.4 + // 40% weight on low slippage
      riskScore * 0.3 + // 30% weight on low risk
      liquidityScore * 0.2 + // 20% weight on high liquidity
      poolAnalysis.bestPool.efficiency * 0.1 // 10% weight on pool efficiency
    );
    
    return Math.max(0, Math.min(1, efficiency));
  }
  
  /**
   * Calculate confidence level for the optimization
   */
  calculateConfidenceLevel(poolAnalysis) {
    let confidence = 0.7; // Base confidence
    
    // Higher confidence with more liquidity data
    if (poolAnalysis.poolComparisons.length > 2) confidence += 0.1;
    
    // Higher confidence with lower risk
    if (poolAnalysis.riskAssessment.riskLevel === 'low') confidence += 0.2;
    else if (poolAnalysis.riskAssessment.riskLevel === 'very_high') confidence -= 0.3;
    
    // Higher confidence with high liquidity
    if (poolAnalysis.riskAssessment.totalLiquidity > 1000000) confidence += 0.1;
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }
  
  /**
   * Validate optimization results
   */
  validateOptimization(optimization, opportunity) {
    // Ensure slippage is within limits
    if (optimization.expectedSlippage > this.options.maxSlippage) {
      console.warn(`⚠️ Expected slippage ${optimization.expectedSlippage * 100}% exceeds limit`);
      optimization.optimalTradeSize *= 0.8; // Reduce size
      optimization.expectedSlippage = this.calculateExpectedSlippage(
        optimization.optimalTradeSize, 
        { poolType: optimization.bestPool, liquidityUSD: 500000, feeRate: 0.003 }
      );
    }
    
    // Ensure efficiency is reasonable
    if (optimization.efficiencyScore < 0.3) {
      console.warn(`⚠️ Low efficiency score: ${optimization.efficiencyScore}`);
      optimization.confidenceLevel *= 0.8;
    }
    
    return optimization;
  }
  
  /**
   * Update optimization metrics
   */
  updateOptimizationMetrics(optimization) {
    this.metrics.totalOptimizations++;
    
    // Update running averages
    this.metrics.averageSlippage = (this.metrics.averageSlippage + optimization.expectedSlippage) / 2;
    this.metrics.liquidityEfficiency = (this.metrics.liquidityEfficiency + optimization.efficiencyScore) / 2;
    
    // Count optimal sizes (within target slippage)
    if (optimization.expectedSlippage <= this.options.optimalSlippage) {
      this.metrics.optimalSizes++;
    }
    
    this.metrics.lastOptimizationTime = Date.now();
  }
  
  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      optimalSizeRate: this.metrics.totalOptimizations > 0 ? 
        (this.metrics.optimalSizes / this.metrics.totalOptimizations) * 100 : 0,
      cacheSize: this.liquidityCache.size,
      uptime: this.isActive ? Date.now() - (this.startTime || Date.now()) : 0
    };
  }
  
  /**
   * Clear cache
   */
  clearCache() {
    this.liquidityCache.clear();
    this.poolAnalysis.clear();
    this.historicalSlippage.clear();
    console.log('💧 Liquidity Optimizer cache cleared');
  }
  
  /**
   * Shutdown the optimizer
   */
  shutdown() {
    this.isActive = false;
    this.clearCache();
    
    console.log('💧 Liquidity Optimizer shutdown complete');
    this.emit('shutdown');
  }
}

export default LiquidityOptimizer;