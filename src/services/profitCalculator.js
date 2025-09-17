const { ethers } = require('ethers');
const config = require('../config/config');

/**
 * Enhanced Profit Calculation Engine
 * Comprehensive profit calculation with gas fees, slippage, and trading fees
 */
class ProfitCalculator {
  constructor(web3Provider) {
    this.web3Provider = web3Provider;
    this.provider = web3Provider?.provider;
    
    // Gas price cache
    this.gasPriceCache = {
      price: null,
      timestamp: 0,
      ttl: 30000 // 30 seconds TTL
    };
    
    // Trading fee structures for different DEXs
    this.tradingFees = {
      'uniswap-v2': 0.003, // 0.3%
      'uniswap-v3-500': 0.0005, // 0.05%
      'uniswap-v3-3000': 0.003, // 0.3%
      'uniswap-v3-10000': 0.01, // 1%
      'sushiswap': 0.003, // 0.3%
    };
    
    // Base gas estimates for different operations
    this.gasEstimates = {
      v2_swap: 150000,
      v3_swap: 180000,
      arbitrage_simple: 300000,
      arbitrage_complex: 450000,
      approval: 50000
    };
  }

  /**
   * Calculate comprehensive profit for an arbitrage opportunity
   */
  async calculateProfit(opportunity, tradeAmountUSD = config.MAX_TRADE_AMOUNT) {
    try {
      const startTime = Date.now();
      
      // 1. Calculate gross profit
      const grossProfit = this.calculateGrossProfit(opportunity, tradeAmountUSD);
      
      // 2. Get current gas costs
      const gasCosts = await this.estimateGasCosts(opportunity);
      
      // 3. Calculate trading fees
      const tradingFees = this.calculateTradingFees(opportunity, tradeAmountUSD);
      
      // 4. Estimate slippage impact
      const slippageImpact = this.estimateSlippage(opportunity, tradeAmountUSD);
      
      // 5. Calculate net profit
      const totalCosts = gasCosts.totalCostUSD + tradingFees.totalFeesUSD + slippageImpact.costUSD;
      const netProfit = grossProfit.profitUSD - totalCosts;
      
      // 6. Calculate ROI and profitability metrics
      const roi = (netProfit / tradeAmountUSD) * 100;
      const profitable = netProfit > 0 && roi >= config.MIN_PROFIT_THRESHOLD;
      
      // 7. Risk assessment
      const riskScore = this.calculateRiskScore(opportunity, tradeAmountUSD);
      
      const calculationTime = Date.now() - startTime;
      
      return {
        // Basic metrics
        tradeAmountUSD,
        grossProfit: grossProfit.profitUSD,
        netProfit,
        roi,
        profitable,
        
        // Cost breakdown
        costs: {
          gas: gasCosts,
          tradingFees,
          slippage: slippageImpact,
          total: totalCosts
        },
        
        // Risk assessment
        riskScore,
        riskLevel: this.getRiskLevel(riskScore),
        
        // Metadata
        calculationTime,
        timestamp: Date.now(),
        
        // Detailed breakdown
        breakdown: {
          buyPrice: opportunity.buyPrice,
          sellPrice: opportunity.sellPrice,
          priceSpread: ((opportunity.sellPrice - opportunity.buyPrice) / opportunity.buyPrice) * 100,
          minProfitRequired: (config.MIN_PROFIT_THRESHOLD / 100) * tradeAmountUSD
        }
      };
      
    } catch (error) {
      console.error('❌ Error calculating profit:', error.message);
      return this.getErrorResult(tradeAmountUSD);
    }
  }

  /**
   * Calculate gross profit before fees and costs
   */
  calculateGrossProfit(opportunity, tradeAmountUSD) {
    const buyPrice = opportunity.buyPrice;
    const sellPrice = opportunity.sellPrice;
    
    if (!buyPrice || !sellPrice || buyPrice <= 0 || sellPrice <= 0) {
      return { profitUSD: 0, profitPercentage: 0 };
    }
    
    // Calculate tokens that can be bought
    const tokenAmount = tradeAmountUSD / buyPrice;
    
    // Calculate sell value
    const sellValue = tokenAmount * sellPrice;
    
    // Calculate gross profit
    const profitUSD = sellValue - tradeAmountUSD;
    const profitPercentage = (profitUSD / tradeAmountUSD) * 100;
    
    return {
      profitUSD,
      profitPercentage,
      tokenAmount,
      sellValue,
      buyValue: tradeAmountUSD
    };
  }

  /**
   * Estimate gas costs for arbitrage transaction
   */
  async estimateGasCosts(opportunity) {
    try {
      // Get current gas price
      const gasPrice = await this.getCurrentGasPrice();
      
      // Determine gas estimate based on arbitrage complexity
      const gasLimit = this.getGasEstimate(opportunity);
      
      // Calculate gas cost in ETH
      const gasCostWei = gasPrice * BigInt(gasLimit);
      const gasCostETH = parseFloat(ethers.formatEther(gasCostWei));
      
      // Convert to USD (simplified ETH price)
      const ethPriceUSD = await this.getETHPriceUSD();
      const gasCostUSD = gasCostETH * ethPriceUSD;
      
      // Add priority fee for faster execution
      const priorityFeeMultiplier = this.getPriorityFeeMultiplier(opportunity);
      const totalCostUSD = gasCostUSD * priorityFeeMultiplier;
      
      return {
        gasLimit,
        gasPrice: gasPrice.toString(),
        gasCostETH,
        gasCostUSD,
        priorityFeeMultiplier,
        totalCostUSD,
        ethPriceUSD
      };
      
    } catch (error) {
      console.error('❌ Error estimating gas costs:', error.message);
      return this.getDefaultGasCosts();
    }
  }

  /**
   * Get current gas price with caching
   */
  async getCurrentGasPrice() {
    const now = Date.now();
    
    // Return cached gas price if still valid
    if (this.gasPriceCache.price && 
        (now - this.gasPriceCache.timestamp) < this.gasPriceCache.ttl) {
      return this.gasPriceCache.price;
    }
    
    try {
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');
      
      // Cache the gas price
      this.gasPriceCache = {
        price: gasPrice,
        timestamp: now,
        ttl: this.gasPriceCache.ttl
      };
      
      return gasPrice;
    } catch (error) {
      console.error('❌ Error fetching gas price:', error.message);
      return ethers.parseUnits('20', 'gwei'); // Fallback
    }
  }

  /**
   * Get gas estimate based on arbitrage complexity
   */
  getGasEstimate(opportunity) {
    // Simple V2-V3 arbitrage
    if (opportunity.buyExchange && opportunity.sellExchange) {
      const isV2toV3 = opportunity.buyExchange.includes('v2') && 
                       opportunity.sellExchange.includes('v3');
      const isV3toV2 = opportunity.buyExchange.includes('v3') && 
                       opportunity.sellExchange.includes('v2');
      
      if (isV2toV3 || isV3toV2) {
        return this.gasEstimates.arbitrage_simple;
      }
    }
    
    // Complex multi-hop arbitrage
    if (opportunity.hops && opportunity.hops > 2) {
      return this.gasEstimates.arbitrage_complex;
    }
    
    // Default arbitrage estimate
    return this.gasEstimates.arbitrage_simple;
  }

  /**
   * Calculate trading fees for both buy and sell operations
   */
  calculateTradingFees(opportunity, tradeAmountUSD) {
    const buyExchange = opportunity.buyExchange || 'uniswap-v2';
    const sellExchange = opportunity.sellExchange || 'uniswap-v3-3000';
    
    // Get fee rates
    const buyFeeRate = this.tradingFees[buyExchange] || 0.003;
    const sellFeeRate = this.tradingFees[sellExchange] || 0.003;
    
    // Calculate fees
    const buyFeeUSD = tradeAmountUSD * buyFeeRate;
    const sellFeeUSD = tradeAmountUSD * sellFeeRate;
    const totalFeesUSD = buyFeeUSD + sellFeeUSD;
    
    return {
      buyFeeUSD,
      sellFeeUSD,
      totalFeesUSD,
      buyFeeRate,
      sellFeeRate,
      totalFeeRate: buyFeeRate + sellFeeRate
    };
  }

  /**
   * Estimate slippage impact based on trade size and liquidity
   */
  estimateSlippage(opportunity, tradeAmountUSD) {
    // Base slippage from configuration
    let baseSlippage = config.SLIPPAGE_TOLERANCE || 0.1;
    
    // Adjust slippage based on trade size (larger trades = more slippage)
    const tradeSizeMultiplier = Math.sqrt(tradeAmountUSD / 10000); // Scale with sqrt
    const sizeAdjustedSlippage = baseSlippage * tradeSizeMultiplier;
    
    // Adjust for liquidity if available
    let liquidityAdjustment = 1;
    if (opportunity.liquidityUSD) {
      const liquidityRatio = tradeAmountUSD / opportunity.liquidityUSD;
      liquidityAdjustment = 1 + (liquidityRatio * 2); // More impact on low liquidity
    }
    
    const totalSlippage = sizeAdjustedSlippage * liquidityAdjustment;
    const slippageCostUSD = (totalSlippage / 100) * tradeAmountUSD;
    
    return {
      baseSlippage,
      sizeAdjustedSlippage,
      liquidityAdjustment,
      totalSlippage,
      costUSD: slippageCostUSD,
      percentage: totalSlippage
    };
  }

  /**
   * Calculate risk score for the opportunity
   */
  calculateRiskScore(opportunity, tradeAmountUSD) {
    let riskScore = 0;
    
    // 1. Liquidity risk (40% weight)
    const liquidityRisk = this.calculateLiquidityRisk(opportunity, tradeAmountUSD);
    riskScore += liquidityRisk * 0.4;
    
    // 2. Price volatility risk (25% weight)
    const volatilityRisk = this.calculateVolatilityRisk(opportunity);
    riskScore += volatilityRisk * 0.25;
    
    // 3. Gas price risk (20% weight)
    const gasPriceRisk = this.calculateGasPriceRisk();
    riskScore += gasPriceRisk * 0.2;
    
    // 4. MEV competition risk (15% weight)
    const competitionRisk = this.calculateCompetitionRisk(opportunity);
    riskScore += competitionRisk * 0.15;
    
    return Math.min(Math.max(riskScore, 0), 100); // Clamp between 0-100
  }

  /**
   * Calculate liquidity risk component
   */
  calculateLiquidityRisk(opportunity, tradeAmountUSD) {
    if (!opportunity.liquidityUSD) return 50; // Medium risk if unknown
    
    const liquidityRatio = tradeAmountUSD / opportunity.liquidityUSD;
    
    if (liquidityRatio < 0.01) return 10; // Low risk
    if (liquidityRatio < 0.05) return 25; // Medium-low risk
    if (liquidityRatio < 0.1) return 50;  // Medium risk
    if (liquidityRatio < 0.2) return 75;  // High risk
    return 90; // Very high risk
  }

  /**
   * Calculate volatility risk component
   */
  calculateVolatilityRisk(opportunity) {
    const priceSpread = opportunity.profitPercentage || 0;
    
    // Higher profit margins might indicate higher volatility/risk
    if (priceSpread < 0.5) return 20;  // Low volatility
    if (priceSpread < 1.0) return 30;  // Medium-low volatility
    if (priceSpread < 2.0) return 50;  // Medium volatility
    if (priceSpread < 5.0) return 70;  // High volatility
    return 85; // Very high volatility
  }

  /**
   * Calculate gas price risk component
   */
  calculateGasPriceRisk() {
    // This would analyze current network congestion
    // For now, return a moderate risk score
    return 40;
  }

  /**
   * Calculate MEV competition risk
   */
  calculateCompetitionRisk(opportunity) {
    const profitMargin = opportunity.profitPercentage || 0;
    
    // Higher profit opportunities attract more competition
    if (profitMargin > 5.0) return 80;  // High competition expected
    if (profitMargin > 2.0) return 60;  // Medium-high competition
    if (profitMargin > 1.0) return 40;  // Medium competition
    if (profitMargin > 0.5) return 25;  // Low-medium competition
    return 15; // Low competition
  }

  /**
   * Get risk level description
   */
  getRiskLevel(riskScore) {
    if (riskScore <= 20) return 'LOW';
    if (riskScore <= 40) return 'MEDIUM-LOW';
    if (riskScore <= 60) return 'MEDIUM';
    if (riskScore <= 80) return 'HIGH';
    return 'VERY HIGH';
  }

  /**
   * Get priority fee multiplier based on opportunity urgency
   */
  getPriorityFeeMultiplier(opportunity) {
    const profitMargin = opportunity.profitPercentage || 0;
    
    // Higher profits justify higher priority fees
    if (profitMargin > 5.0) return 1.5;  // 50% higher gas
    if (profitMargin > 2.0) return 1.3;  // 30% higher gas
    if (profitMargin > 1.0) return 1.2;  // 20% higher gas
    if (profitMargin > 0.5) return 1.1;  // 10% higher gas
    return 1.0; // Standard gas price
  }

  /**
   * Simulate trade execution to validate profitability
   */
  async simulateTrade(opportunity, tradeAmountUSD) {
    console.log(`🧪 Simulating trade for ${opportunity.tokenPair}...`);
    
    try {
      // This would perform actual trade simulation against DEX contracts
      // For now, return a simplified simulation result
      
      const profitCalculation = await this.calculateProfit(opportunity, tradeAmountUSD);
      
      // Add simulation-specific data
      const simulation = {
        ...profitCalculation,
        simulation: {
          success: profitCalculation.profitable,
          expectedSlippage: profitCalculation.costs.slippage.percentage,
          priceImpact: profitCalculation.costs.slippage.percentage * 0.8,
          executionTime: Math.random() * 15 + 5, // 5-20 seconds
          successProbability: profitCalculation.profitable ? 
            Math.max(90 - profitCalculation.riskScore * 0.5, 50) : 10
        }
      };
      
      console.log(`✅ Trade simulation completed: ${simulation.simulation.success ? 'PROFITABLE' : 'NOT PROFITABLE'}`);
      
      return simulation;
      
    } catch (error) {
      console.error('❌ Trade simulation failed:', error.message);
      return this.getErrorResult(tradeAmountUSD);
    }
  }

  /**
   * Get simplified ETH price in USD
   */
  async getETHPriceUSD() {
    // Simplified - in production, fetch from price oracle or API
    return 2500; // $2500 ETH
  }

  /**
   * Get default gas costs when estimation fails
   */
  getDefaultGasCosts() {
    return {
      gasLimit: this.gasEstimates.arbitrage_simple,
      gasPrice: ethers.parseUnits('20', 'gwei').toString(),
      gasCostETH: 0.006, // 20 gwei * 300k gas
      gasCostUSD: 15, // ~$15 at $2500 ETH
      priorityFeeMultiplier: 1.1,
      totalCostUSD: 16.5,
      ethPriceUSD: 2500
    };
  }

  /**
   * Get error result when calculation fails
   */
  getErrorResult(tradeAmountUSD) {
    return {
      tradeAmountUSD,
      grossProfit: 0,
      netProfit: 0,
      roi: 0,
      profitable: false,
      error: true,
      costs: {
        gas: this.getDefaultGasCosts(),
        tradingFees: { totalFeesUSD: 0 },
        slippage: { costUSD: 0 },
        total: 0
      },
      riskScore: 100,
      riskLevel: 'VERY HIGH'
    };
  }
}

module.exports = ProfitCalculator;