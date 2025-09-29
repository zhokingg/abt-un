import { EventEmitter } from 'events';
import { ethers } from 'ethers';

/**
 * PriceAggregator - Multi-source price aggregation with outlier detection
 * Provides weighted average pricing, confidence scoring, and arbitrage opportunity calculation
 */
class PriceAggregator extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      outlierThreshold: options.outlierThreshold || 0.05, // 5% deviation to be considered outlier
      minSources: options.minSources || 2,
      confidenceThreshold: options.confidenceThreshold || 0.7,
      maxPriceAge: options.maxPriceAge || 30000, // 30 seconds
      impactCalculationPrecision: options.impactCalculationPrecision || 4,
      slippageFactors: {
        low: 0.001,    // 0.1%
        medium: 0.003, // 0.3%
        high: 0.01     // 1%
      },
      ...options
    };
    
    // Price aggregation state
    this.aggregatedPrices = new Map();
    this.priceConfidence = new Map();
    this.outlierDetection = new Map();
    this.arbitrageOpportunities = new Map();
    
    // Liquidity depth tracking
    this.liquidityDepth = new Map();
    this.historicalVolumes = new Map();
    
    // Performance metrics
    this.metrics = {
      totalAggregations: 0,
      outliersDetected: 0,
      opportunitiesFound: 0,
      averageConfidence: 0,
      lastAggregation: null
    };
    
    this.isActive = false;
  }
  
  /**
   * Initialize the price aggregator
   */
  async initialize() {
    try {
      console.log('📊 Initializing PriceAggregator...');
      
      this.isActive = true;
      console.log('✅ PriceAggregator initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize PriceAggregator:', error);
      throw error;
    }
  }
  
  /**
   * Aggregate prices from multiple sources with outlier detection
   */
  aggregatePrices(symbol, sourcePrices) {
    if (!this.isActive) {
      throw new Error('PriceAggregator not initialized');
    }
    
    if (!sourcePrices || sourcePrices.length === 0) {
      return null;
    }
    
    const startTime = Date.now();
    this.metrics.totalAggregations++;
    
    // Filter valid prices (not too old)
    const validPrices = sourcePrices.filter(price => 
      price && 
      typeof price.price === 'number' && 
      price.price > 0 &&
      (Date.now() - price.timestamp) < this.options.maxPriceAge
    );
    
    if (validPrices.length < this.options.minSources) {
      console.warn(`Insufficient price sources for ${symbol}: ${validPrices.length}/${this.options.minSources}`);
      return null;
    }
    
    // Detect and filter outliers
    const { cleanPrices, outliers } = this.detectOutliers(validPrices);
    
    if (outliers.length > 0) {
      this.metrics.outliersDetected += outliers.length;
      this.emit('outliersDetected', {
        symbol,
        outliers,
        timestamp: Date.now()
      });
    }
    
    if (cleanPrices.length === 0) {
      console.warn(`No valid prices after outlier filtering for ${symbol}`);
      return null;
    }
    
    // Calculate weighted average
    const weightedAverage = this.calculateWeightedAverage(cleanPrices);
    
    // Calculate confidence score
    const confidence = this.calculateConfidence(cleanPrices, weightedAverage);
    
    // Calculate price spread
    const spread = this.calculateSpread(cleanPrices);
    
    // Calculate volume-weighted price if volume data available
    const volumeWeightedPrice = this.calculateVolumeWeightedPrice(cleanPrices);
    
    const aggregatedData = {
      symbol,
      price: weightedAverage,
      volumeWeightedPrice,
      confidence,
      spread: spread * 100, // Convert to percentage
      sourceCount: cleanPrices.length,
      outlierCount: outliers.length,
      timestamp: Date.now(),
      sources: cleanPrices.map(p => ({
        source: p.source,
        price: p.price,
        weight: p.weight || 1,
        timestamp: p.timestamp
      })),
      processingTime: Date.now() - startTime
    };
    
    // Store aggregated price
    this.aggregatedPrices.set(symbol, aggregatedData);
    this.priceConfidence.set(symbol, confidence);
    
    // Update average confidence metric
    this.updateAverageConfidence();
    
    this.emit('priceAggregated', aggregatedData);
    
    return aggregatedData;
  }
  
  /**
   * Detect outlier prices using statistical methods
   */
  detectOutliers(prices) {
    if (prices.length <= 2) {
      return { cleanPrices: prices, outliers: [] };
    }
    
    // Calculate median and MAD (Median Absolute Deviation)
    const sortedPrices = [...prices].sort((a, b) => a.price - b.price);
    const median = this.calculateMedian(sortedPrices.map(p => p.price));
    
    // Calculate MAD
    const deviations = sortedPrices.map(p => Math.abs(p.price - median));
    const mad = this.calculateMedian(deviations);
    
    // Modified Z-score threshold (typically 3.5)
    const threshold = 3.5;
    const modifiedZScoreThreshold = threshold * mad / 0.6745; // 0.6745 is the MAD constant
    
    const cleanPrices = [];
    const outliers = [];
    
    for (const price of prices) {
      const modifiedZScore = Math.abs(price.price - median) / (mad / 0.6745);
      
      if (modifiedZScore > threshold || Math.abs(price.price - median) / median > this.options.outlierThreshold) {
        outliers.push({
          ...price,
          reason: 'statistical_outlier',
          deviation: Math.abs(price.price - median) / median,
          modifiedZScore
        });
      } else {
        cleanPrices.push(price);
      }
    }
    
    return { cleanPrices, outliers };
  }
  
  /**
   * Calculate median of an array
   */
  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }
  
  /**
   * Calculate weighted average price
   */
  calculateWeightedAverage(prices) {
    let totalWeight = 0;
    let weightedSum = 0;
    
    for (const price of prices) {
      const weight = price.weight || 1;
      const confidence = price.confidence || 1;
      const adjustedWeight = weight * confidence;
      
      weightedSum += price.price * adjustedWeight;
      totalWeight += adjustedWeight;
    }
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }
  
  /**
   * Calculate volume-weighted average price (VWAP)
   */
  calculateVolumeWeightedPrice(prices) {
    let totalVolume = 0;
    let volumeWeightedSum = 0;
    
    for (const price of prices) {
      const volume = price.volume || price.liquidity || 1;
      volumeWeightedSum += price.price * volume;
      totalVolume += volume;
    }
    
    return totalVolume > 0 ? volumeWeightedSum / totalVolume : null;
  }
  
  /**
   * Calculate confidence score based on price agreement
   */
  calculateConfidence(prices, aggregatedPrice) {
    if (prices.length <= 1) return 0.5;
    
    // Base confidence from number of sources
    let confidence = Math.min(0.4 + (prices.length - 1) * 0.15, 0.9);
    
    // Adjust based on price agreement (lower spread = higher confidence)
    const spread = this.calculateSpread(prices);
    confidence *= Math.max(0.3, 1 - spread * 10); // Penalize high spread
    
    // Adjust based on source reliability
    const avgReliability = prices.reduce((sum, p) => sum + (p.reliability || 0.8), 0) / prices.length;
    confidence *= avgReliability;
    
    // Adjust based on recency
    const avgAge = prices.reduce((sum, p) => sum + (Date.now() - p.timestamp), 0) / prices.length;
    const ageMultiplier = Math.max(0.5, 1 - avgAge / this.options.maxPriceAge);
    confidence *= ageMultiplier;
    
    return Math.max(0.1, Math.min(confidence, 1.0));
  }
  
  /**
   * Calculate price spread (max - min) / min
   */
  calculateSpread(prices) {
    if (prices.length <= 1) return 0;
    
    const priceValues = prices.map(p => p.price);
    const minPrice = Math.min(...priceValues);
    const maxPrice = Math.max(...priceValues);
    
    return minPrice > 0 ? (maxPrice - minPrice) / minPrice : 0;
  }
  
  /**
   * Calculate arbitrage opportunities between different sources
   */
  calculateArbitrageOpportunities(symbol, sourcePrices) {
    if (!sourcePrices || sourcePrices.length < 2) {
      return [];
    }
    
    const opportunities = [];
    
    // Compare all pairs of sources
    for (let i = 0; i < sourcePrices.length; i++) {
      for (let j = i + 1; j < sourcePrices.length; j++) {
        const sourceA = sourcePrices[i];
        const sourceB = sourcePrices[j];
        
        if (!sourceA.exchange || !sourceB.exchange) continue;
        
        const priceDiff = Math.abs(sourceA.price - sourceB.price);
        const avgPrice = (sourceA.price + sourceB.price) / 2;
        const spreadPercentage = (priceDiff / avgPrice) * 100;
        
        // Determine buy/sell direction
        const buySource = sourceA.price < sourceB.price ? sourceA : sourceB;
        const sellSource = sourceA.price < sourceB.price ? sourceB : sourceA;
        
        // Calculate potential profit (accounting for basic fees)
        const tradingFees = 0.003 * 2; // 0.3% per trade * 2 trades
        const netSpread = spreadPercentage / 100 - tradingFees;
        
        if (netSpread > 0.001) { // Minimum 0.1% profit threshold
          const opportunity = {
            symbol,
            buyFrom: buySource.exchange || buySource.source,
            sellTo: sellSource.exchange || sellSource.source,
            buyPrice: buySource.price,
            sellPrice: sellSource.price,
            spreadPercentage,
            netProfitPercentage: netSpread * 100,
            confidence: Math.min(sourceA.confidence || 0.8, sourceB.confidence || 0.8),
            timestamp: Date.now(),
            
            // Enhanced calculations
            priceImpact: this.estimatePriceImpact(symbol, buySource, sellSource),
            slippageRisk: this.calculateSlippageRisk(spreadPercentage),
            liquidityScore: this.calculateLiquidityScore(buySource, sellSource),
            riskScore: this.calculateRiskScore(symbol, netSpread, spreadPercentage)
          };
          
          opportunities.push(opportunity);
        }
      }
    }
    
    // Sort by net profit percentage (descending)
    opportunities.sort((a, b) => b.netProfitPercentage - a.netProfitPercentage);
    
    if (opportunities.length > 0) {
      this.metrics.opportunitiesFound += opportunities.length;
      this.arbitrageOpportunities.set(symbol, opportunities);
      
      this.emit('arbitrageOpportunitiesFound', {
        symbol,
        opportunities: opportunities.slice(0, 5), // Top 5 opportunities
        timestamp: Date.now()
      });
    }
    
    return opportunities;
  }
  
  /**
   * Estimate price impact for different trade sizes
   */
  estimatePriceImpact(symbol, buySource, sellSource, tradeAmount = 10000) {
    // Get liquidity depth if available
    const liquidity = this.liquidityDepth.get(symbol) || {};
    
    const buyLiquidity = liquidity[buySource.exchange] || buySource.liquidity || 1000000;
    const sellLiquidity = liquidity[sellSource.exchange] || sellSource.liquidity || 1000000;
    
    // Simple price impact estimation (square root model)
    const buyImpact = Math.sqrt(tradeAmount / buyLiquidity) * 0.01; // 1% per sqrt of ratio
    const sellImpact = Math.sqrt(tradeAmount / sellLiquidity) * 0.01;
    
    return {
      buy: buyImpact * 100, // percentage
      sell: sellImpact * 100,
      total: (buyImpact + sellImpact) * 100,
      tradeAmount
    };
  }
  
  /**
   * Calculate slippage risk based on spread
   */
  calculateSlippageRisk(spreadPercentage) {
    const { slippageFactors } = this.options;
    
    if (spreadPercentage < 0.1) return 'low';
    if (spreadPercentage < 0.5) return 'medium';
    return 'high';
  }
  
  /**
   * Calculate liquidity score for sources
   */
  calculateLiquidityScore(sourceA, sourceB) {
    const liquidityA = sourceA.liquidity || sourceA.volume24h || 0;
    const liquidityB = sourceB.liquidity || sourceB.volume24h || 0;
    
    const totalLiquidity = liquidityA + liquidityB;
    
    if (totalLiquidity > 10000000) return 'high';   // > $10M
    if (totalLiquidity > 1000000) return 'medium';  // > $1M
    return 'low';
  }
  
  /**
   * Calculate risk score for an arbitrage opportunity
   */
  calculateRiskScore(symbol, netSpread, spreadPercentage) {
    let riskScore = 0;
    
    // Low profit = higher risk
    if (netSpread < 0.005) riskScore += 30; // < 0.5%
    else if (netSpread < 0.01) riskScore += 15; // < 1%
    
    // High spread might indicate low liquidity or data issues
    if (spreadPercentage > 2) riskScore += 25;
    else if (spreadPercentage > 1) riskScore += 10;
    
    // Check historical volatility
    const historicalData = this.historicalVolumes.get(symbol);
    if (historicalData && historicalData.volatility > 0.05) {
      riskScore += 20; // High volatility
    }
    
    // Check price confidence
    const confidence = this.priceConfidence.get(symbol) || 0.5;
    if (confidence < 0.6) riskScore += 15;
    
    return Math.min(riskScore, 100); // Cap at 100
  }
  
  /**
   * Update liquidity depth data
   */
  updateLiquidityDepth(symbol, exchange, depth) {
    if (!this.liquidityDepth.has(symbol)) {
      this.liquidityDepth.set(symbol, {});
    }
    
    this.liquidityDepth.get(symbol)[exchange] = depth;
  }
  
  /**
   * Update historical volume data
   */
  updateHistoricalVolume(symbol, volumeData) {
    const history = this.historicalVolumes.get(symbol) || [];
    history.push({
      volume: volumeData.volume,
      timestamp: Date.now()
    });
    
    // Keep only last 24 hours of data
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentHistory = history.filter(h => h.timestamp > oneDayAgo);
    
    // Calculate volatility
    if (recentHistory.length > 1) {
      const volumes = recentHistory.map(h => h.volume);
      const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
      const variance = volumes.reduce((sum, v) => sum + Math.pow(v - avgVolume, 2), 0) / volumes.length;
      const volatility = Math.sqrt(variance) / avgVolume;
      
      recentHistory.volatility = volatility;
    }
    
    this.historicalVolumes.set(symbol, recentHistory);
  }
  
  /**
   * Get current aggregated price
   */
  getCurrentPrice(symbol) {
    return this.aggregatedPrices.get(symbol);
  }
  
  /**
   * Get current arbitrage opportunities
   */
  getArbitrageOpportunities(symbol) {
    return this.arbitrageOpportunities.get(symbol) || [];
  }
  
  /**
   * Get top arbitrage opportunities across all symbols
   */
  getTopArbitrageOpportunities(limit = 10) {
    const allOpportunities = [];
    
    for (const [symbol, opportunities] of this.arbitrageOpportunities) {
      for (const opp of opportunities) {
        allOpportunities.push({ ...opp, symbol });
      }
    }
    
    return allOpportunities
      .sort((a, b) => b.netProfitPercentage - a.netProfitPercentage)
      .slice(0, limit);
  }
  
  /**
   * Update average confidence metric
   */
  updateAverageConfidence() {
    const confidenceValues = Array.from(this.priceConfidence.values());
    if (confidenceValues.length > 0) {
      this.metrics.averageConfidence = confidenceValues.reduce((sum, c) => sum + c, 0) / confidenceValues.length;
    }
    this.metrics.lastAggregation = Date.now();
  }
  
  /**
   * Clean up old data
   */
  cleanup() {
    const now = Date.now();
    const maxAge = this.options.maxPriceAge * 2; // Keep data for twice the max age
    
    // Clean aggregated prices
    for (const [symbol, data] of this.aggregatedPrices) {
      if (now - data.timestamp > maxAge) {
        this.aggregatedPrices.delete(symbol);
        this.priceConfidence.delete(symbol);
        this.arbitrageOpportunities.delete(symbol);
      }
    }
    
    console.log(`🧹 Cleaned up old price data. Current symbols: ${this.aggregatedPrices.size}`);
  }
  
  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeSymbols: this.aggregatedPrices.size,
      activeOpportunities: Array.from(this.arbitrageOpportunities.values())
        .reduce((sum, opps) => sum + opps.length, 0),
      averageProcessingTime: this.calculateAverageProcessingTime()
    };
  }
  
  /**
   * Calculate average processing time
   */
  calculateAverageProcessingTime() {
    const recentData = Array.from(this.aggregatedPrices.values())
      .filter(data => Date.now() - data.timestamp < 300000) // Last 5 minutes
      .map(data => data.processingTime);
    
    if (recentData.length === 0) return 0;
    
    return recentData.reduce((sum, time) => sum + time, 0) / recentData.length;
  }
  
  /**
   * Export price data for analysis
   */
  exportPriceData(symbol) {
    const aggregatedData = this.aggregatedPrices.get(symbol);
    const opportunities = this.arbitrageOpportunities.get(symbol);
    const confidence = this.priceConfidence.get(symbol);
    
    return {
      symbol,
      aggregatedPrice: aggregatedData,
      arbitrageOpportunities: opportunities,
      confidence,
      timestamp: Date.now()
    };
  }
}

export default PriceAggregator;