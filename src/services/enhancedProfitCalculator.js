const { ethers } = require('ethers');
const config = require('../config/config');
const ProfitCalculator = require('./profitCalculator');

/**
 * Enhanced Profit Calculator with Flashloan Cost Integration
 * Extends the existing ProfitCalculator with comprehensive flashloan cost analysis
 */
class EnhancedProfitCalculator extends ProfitCalculator {
  constructor(web3Provider, flashloanService) {
    super(web3Provider);
    
    this.flashloanService = flashloanService;
    
    // Enhanced cost structures
    this.enhancedCosts = {
      flashloanFees: {
        aave: 0.0009, // 0.09%
        dydx: 0.0000, // 0%
        balancer: 0.0000 // 0%
      },
      gasEstimates: {
        flashloanArbitrage: 400000,
        complexArbitrage: 500000,
        emergencyExit: 100000
      },
      mevProtectionCosts: {
        priorityFeeIncrease: 0.2, // 20% increase
        maxPriorityFeeGwei: 50
      }
    };
    
    // Price impact models for different liquidity levels
    this.priceImpactModels = {
      low: { base: 0.01, scaling: 0.0001 }, // 1% base + 0.01% per $1000
      medium: { base: 0.005, scaling: 0.00005 }, // 0.5% base + 0.005% per $1000
      high: { base: 0.002, scaling: 0.00002 } // 0.2% base + 0.002% per $1000
    };
  }
  
  /**
   * Calculate comprehensive profit with flashloan costs
   */
  async calculateFlashloanArbitrageProfit(opportunity, tradeAmountUSD = config.MAX_TRADE_AMOUNT, options = {}) {
    const startTime = Date.now();
    
    try {
      console.log(`💰 Calculating flashloan arbitrage profit for ${tradeAmountUSD} USD...`);
      
      // 1. Basic profit calculation (inherited)
      const basicProfit = await this.calculateProfit(opportunity, tradeAmountUSD);
      
      // 2. Enhanced flashloan cost analysis
      const flashloanCosts = await this.calculateFlashloanCosts(
        opportunity.tokenA,
        tradeAmountUSD,
        options.gasPrice || await this.getCurrentGasPrice()
      );
      
      // 3. Enhanced slippage and price impact
      const enhancedSlippage = await this.calculateEnhancedSlippage(opportunity, tradeAmountUSD);
      
      // 4. MEV protection costs
      const mevCosts = await this.calculateMEVProtectionCosts(
        flashloanCosts.gasCosts.totalCostUSD,
        options.gasPrice || await this.getCurrentGasPrice()
      );
      
      // 5. Liquidity depth analysis
      const liquidityAnalysis = await this.analyzeLiquidityDepth(opportunity, tradeAmountUSD);
      
      // 6. Calculate net profit with all costs
      const totalEnhancedCosts = 
        flashloanCosts.totalCostUSD + 
        enhancedSlippage.totalSlippageCostUSD +
        mevCosts.totalCostUSD +
        (liquidityAnalysis.liquidityCostUSD || 0);
      
      const enhancedNetProfit = basicProfit.grossProfit.profitUSD - totalEnhancedCosts;
      const enhancedROI = (enhancedNetProfit / tradeAmountUSD) * 100;
      
      // 7. Risk-adjusted profitability
      const riskAdjustment = this.calculateRiskAdjustment(opportunity, tradeAmountUSD, liquidityAnalysis);
      const riskAdjustedProfit = enhancedNetProfit * (1 - riskAdjustment.totalRisk);
      
      // 8. Execution probability
      const executionProbability = await this.calculateExecutionProbability(
        opportunity,
        enhancedNetProfit,
        flashloanCosts,
        liquidityAnalysis
      );
      
      const calculationTime = Date.now() - startTime;
      
      const result = {
        // Basic metrics
        tradeAmountUSD,
        grossProfit: basicProfit.grossProfit.profitUSD,
        basicNetProfit: basicProfit.netProfit,
        enhancedNetProfit,
        riskAdjustedProfit,
        
        // ROI metrics
        basicROI: basicProfit.roi,
        enhancedROI,
        riskAdjustedROI: (riskAdjustedProfit / tradeAmountUSD) * 100,
        
        // Detailed cost breakdown
        costs: {
          basic: basicProfit.costs,
          flashloan: flashloanCosts,
          slippage: enhancedSlippage,
          mev: mevCosts,
          liquidity: liquidityAnalysis.liquidityCostUSD || 0,
          total: totalEnhancedCosts
        },
        
        // Risk analysis
        risk: riskAdjustment,
        liquidity: liquidityAnalysis,
        executionProbability,
        
        // Profitability assessment
        isProfitable: enhancedNetProfit > 0 && enhancedROI >= config.MIN_PROFIT_THRESHOLD,
        isRiskAdjustedProfitable: riskAdjustedProfit > 0,
        confidenceLevel: this.calculateConfidenceLevel(executionProbability, liquidityAnalysis),
        
        // Recommendations
        recommendations: this.generateRecommendations(enhancedNetProfit, riskAdjustment, liquidityAnalysis),
        
        // Meta
        calculationTime,
        timestamp: Date.now(),
        version: '3.0-flashloan'
      };
      
      console.log(`✅ Enhanced profit calculation completed in ${calculationTime}ms`);
      console.log(`📊 Enhanced Net Profit: $${enhancedNetProfit.toFixed(2)} (ROI: ${enhancedROI.toFixed(2)}%)`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Enhanced profit calculation failed:', error.message);
      
      // Fallback to basic calculation
      const fallbackResult = await this.calculateProfit(opportunity, tradeAmountUSD);
      fallbackResult.error = error.message;
      fallbackResult.fallback = true;
      
      return fallbackResult;
    }
  }
  
  /**
   * Calculate comprehensive flashloan costs
   */
  async calculateFlashloanCosts(tokenAddress, tradeAmountUSD, gasPrice) {
    try {
      // Get flashloan provider fees
      const providerFees = await this.flashloanService.estimateFlashloanFees(
        tokenAddress,
        ethers.parseUnits(tradeAmountUSD.toString(), 6) // Assuming USDC-like
      );
      
      // Calculate gas costs for flashloan execution
      const gasCosts = await this.calculateFlashloanGasCosts(gasPrice);
      
      // Calculate opportunity cost of capital
      const opportunityCost = this.calculateOpportunityCost(tradeAmountUSD);
      
      // Total flashloan costs
      const totalProviderFees = providerFees.reduce((sum, fee) => 
        sum + (fee.available ? parseFloat(fee.fee) : 0), 0
      );
      
      const totalCostUSD = 
        (totalProviderFees / 1e6) + // Convert from wei/smallest unit
        gasCosts.totalCostUSD +
        opportunityCost.costUSD;
      
      return {
        providerFees: providerFees.map(fee => ({
          provider: fee.provider,
          feeUSD: parseFloat(fee.fee) / 1e6,
          feeBps: fee.feeBps,
          available: fee.available
        })),
        gasCosts,
        opportunityCost,
        totalCostUSD,
        breakdown: {
          flashloanFees: totalProviderFees / 1e6,
          gasFees: gasCosts.totalCostUSD,
          opportunityCost: opportunityCost.costUSD
        }
      };
      
    } catch (error) {
      console.warn('⚠️ Error calculating flashloan costs, using estimates:', error.message);
      
      // Fallback cost estimation
      const estimatedFee = tradeAmountUSD * 0.001; // 0.1% estimated
      const estimatedGas = 50; // $50 estimated gas
      
      return {
        providerFees: [{ provider: 'estimated', feeUSD: estimatedFee, available: true }],
        gasCosts: { totalCostUSD: estimatedGas },
        opportunityCost: { costUSD: 0 },
        totalCostUSD: estimatedFee + estimatedGas,
        estimated: true
      };
    }
  }
  
  /**
   * Calculate enhanced slippage with price impact modeling
   */
  async calculateEnhancedSlippage(opportunity, tradeAmountUSD) {
    // Get liquidity levels for both DEXs
    const liquidityA = await this.estimateLiquidity(opportunity.buyFrom, opportunity.tokenA, opportunity.tokenB);
    const liquidityB = await this.estimateLiquidity(opportunity.sellTo, opportunity.tokenA, opportunity.tokenB);
    
    // Calculate price impact for each leg
    const priceImpactA = this.calculatePriceImpact(tradeAmountUSD, liquidityA.level, 'buy');
    const priceImpactB = this.calculatePriceImpact(tradeAmountUSD, liquidityB.level, 'sell');
    
    // Calculate dynamic slippage based on volatility
    const volatilitySlippage = await this.calculateVolatilitySlippage(opportunity);
    
    // Calculate network congestion slippage
    const congestionSlippage = await this.calculateCongestionSlippage();
    
    const totalSlippagePercent = priceImpactA + priceImpactB + volatilitySlippage + congestionSlippage;
    const totalSlippageCostUSD = tradeAmountUSD * (totalSlippagePercent / 100);
    
    return {
      priceImpact: {
        buy: priceImpactA,
        sell: priceImpactB,
        total: priceImpactA + priceImpactB
      },
      volatilitySlippage,
      congestionSlippage,
      totalSlippagePercent,
      totalSlippageCostUSD,
      breakdown: {
        priceImpactUSD: tradeAmountUSD * ((priceImpactA + priceImpactB) / 100),
        volatilityUSD: tradeAmountUSD * (volatilitySlippage / 100),
        congestionUSD: tradeAmountUSD * (congestionSlippage / 100)
      }
    };
  }
  
  /**
   * Calculate MEV protection costs
   */
  async calculateMEVProtectionCosts(baseGasCostUSD, gasPrice) {
    const gasPriceGwei = parseFloat(ethers.formatUnits(gasPrice, 'gwei'));
    
    // Calculate additional priority fee for MEV protection
    const priorityFeeIncrease = this.enhancedCosts.mevProtectionCosts.priorityFeeIncrease;
    const maxPriorityFeeGwei = this.enhancedCosts.mevProtectionCosts.maxPriorityFeeGwei;
    
    const additionalPriorityFee = Math.min(
      gasPriceGwei * priorityFeeIncrease,
      maxPriorityFeeGwei
    );
    
    // Estimate additional cost for MEV protection
    const mevProtectionGasOverhead = 50000; // Additional gas for MEV protection
    const mevProtectionCostUSD = (additionalPriorityFee / 1e9) * mevProtectionGasOverhead * 2000; // Assume $2000 ETH
    
    // Calculate potential loss from MEV if not protected
    const potentialMevLoss = baseGasCostUSD * 0.1; // Estimate 10% potential loss
    
    return {
      additionalPriorityFeeGwei: additionalPriorityFee,
      mevProtectionCostUSD,
      potentialMevLoss,
      totalCostUSD: mevProtectionCostUSD,
      netBenefit: potentialMevLoss - mevProtectionCostUSD,
      recommended: potentialMevLoss > mevProtectionCostUSD
    };
  }
  
  /**
   * Analyze liquidity depth across DEXs
   */
  async analyzeLiquidityDepth(opportunity, tradeAmountUSD) {
    try {
      const analysis = {
        buyDex: await this.getDetailedLiquidityAnalysis(opportunity.buyFrom, opportunity.tokenA, opportunity.tokenB, tradeAmountUSD),
        sellDex: await this.getDetailedLiquidityAnalysis(opportunity.sellTo, opportunity.tokenA, opportunity.tokenB, tradeAmountUSD),
        crossDexLiquidity: null,
        liquidityCostUSD: 0
      };
      
      // Calculate liquidity-based costs
      const liquidityRisk = Math.max(analysis.buyDex.riskLevel, analysis.sellDex.riskLevel);
      analysis.liquidityCostUSD = tradeAmountUSD * (liquidityRisk / 1000); // Risk-based cost
      
      // Cross-DEX liquidity comparison
      analysis.crossDexLiquidity = {
        liquidityRatio: analysis.buyDex.availableLiquidity / analysis.sellDex.availableLiquidity,
        symmetrical: Math.abs(1 - analysis.crossDexLiquidity?.liquidityRatio || 1) < 0.2
      };
      
      return analysis;
      
    } catch (error) {
      console.warn('⚠️ Error analyzing liquidity depth:', error.message);
      
      return {
        buyDex: { availableLiquidity: tradeAmountUSD * 10, riskLevel: 50 },
        sellDex: { availableLiquidity: tradeAmountUSD * 10, riskLevel: 50 },
        liquidityCostUSD: tradeAmountUSD * 0.001, // 0.1% estimated cost
        estimated: true
      };
    }
  }
  
  /**
   * Calculate risk adjustment factors
   */
  calculateRiskAdjustment(opportunity, tradeAmountUSD, liquidityAnalysis) {
    const risks = {
      liquidityRisk: this.calculateLiquidityRisk(liquidityAnalysis, tradeAmountUSD),
      volatilityRisk: this.calculateVolatilityRisk(opportunity),
      executionRisk: this.calculateExecutionRisk(opportunity, tradeAmountUSD),
      smartContractRisk: 0.01, // 1% for smart contract risk
      mevRisk: this.calculateMEVRisk(tradeAmountUSD)
    };
    
    const totalRisk = Math.min(
      risks.liquidityRisk +
      risks.volatilityRisk +
      risks.executionRisk +
      risks.smartContractRisk +
      risks.mevRisk,
      0.5 // Cap total risk at 50%
    );
    
    return {
      ...risks,
      totalRisk,
      riskLevel: this.categorizeTotalRisk(totalRisk)
    };
  }
  
  /**
   * Calculate execution probability
   */
  async calculateExecutionProbability(opportunity, netProfit, flashloanCosts, liquidityAnalysis) {
    let probability = 1.0;
    
    // Reduce probability based on profit margin
    const profitMargin = netProfit / opportunity.tradeAmountUSD;
    if (profitMargin < 0.001) probability *= 0.1; // Very thin margins
    else if (profitMargin < 0.005) probability *= 0.5;
    else if (profitMargin < 0.01) probability *= 0.8;
    
    // Reduce probability based on liquidity
    const avgLiquidity = (liquidityAnalysis.buyDex.availableLiquidity + liquidityAnalysis.sellDex.availableLiquidity) / 2;
    const liquidityRatio = opportunity.tradeAmountUSD / avgLiquidity;
    if (liquidityRatio > 0.1) probability *= 0.5; // Large trade vs liquidity
    else if (liquidityRatio > 0.05) probability *= 0.8;
    
    // Reduce probability based on gas costs
    const gasCostRatio = flashloanCosts.gasCosts.totalCostUSD / netProfit;
    if (gasCostRatio > 0.5) probability *= 0.6; // High gas vs profit
    else if (gasCostRatio > 0.3) probability *= 0.8;
    
    // Network congestion factor
    const congestionLevel = await this.getNetworkCongestionLevel();
    if (congestionLevel === 'HIGH') probability *= 0.7;
    else if (congestionLevel === 'EXTREME') probability *= 0.4;
    
    return Math.max(probability, 0.1); // Minimum 10% probability
  }
  
  /**
   * Calculate confidence level
   */
  calculateConfidenceLevel(executionProbability, liquidityAnalysis) {
    let confidence = executionProbability;
    
    // Adjust based on data quality
    if (liquidityAnalysis.estimated) confidence *= 0.8;
    
    // Categorize confidence
    if (confidence > 0.8) return 'HIGH';
    if (confidence > 0.6) return 'MEDIUM';
    if (confidence > 0.4) return 'LOW';
    return 'VERY_LOW';
  }
  
  /**
   * Generate actionable recommendations
   */
  generateRecommendations(netProfit, riskAdjustment, liquidityAnalysis) {
    const recommendations = [];
    
    if (netProfit <= 0) {
      recommendations.push('NOT_PROFITABLE: Current conditions do not support profitable execution');
    }
    
    if (riskAdjustment.totalRisk > 0.3) {
      recommendations.push('HIGH_RISK: Consider reducing trade size or waiting for better conditions');
    }
    
    if (riskAdjustment.liquidityRisk > 0.1) {
      recommendations.push('LIQUIDITY_CONCERN: Monitor liquidity depth before execution');
    }
    
    if (riskAdjustment.mevRisk > 0.05) {
      recommendations.push('MEV_PROTECTION: Enable MEV protection or use private mempool');
    }
    
    if (liquidityAnalysis.crossDexLiquidity && !liquidityAnalysis.crossDexLiquidity.symmetrical) {
      recommendations.push('LIQUIDITY_IMBALANCE: Significant liquidity difference between DEXs');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('EXECUTE: Conditions favorable for execution');
    }
    
    return recommendations;
  }
  
  /**
   * Helper methods for detailed calculations
   */
  
  calculatePriceImpact(tradeAmountUSD, liquidityLevel, direction) {
    const model = this.priceImpactModels[liquidityLevel] || this.priceImpactModels.medium;
    const tradeAmountK = tradeAmountUSD / 1000;
    
    return model.base + (model.scaling * tradeAmountK);
  }
  
  async calculateVolatilitySlippage(opportunity) {
    // Simplified volatility calculation - in production would use historical data
    return 0.001; // 0.1% base volatility slippage
  }
  
  async calculateCongestionSlippage() {
    const congestionLevel = await this.getNetworkCongestionLevel();
    
    switch (congestionLevel) {
      case 'LOW': return 0.0005; // 0.05%
      case 'MEDIUM': return 0.001; // 0.1%
      case 'HIGH': return 0.002; // 0.2%
      case 'EXTREME': return 0.005; // 0.5%
      default: return 0.001;
    }
  }
  
  calculateLiquidityRisk(liquidityAnalysis, tradeAmountUSD) {
    if (liquidityAnalysis.estimated) return 0.05; // 5% for estimated
    
    const avgLiquidity = (liquidityAnalysis.buyDex.availableLiquidity + liquidityAnalysis.sellDex.availableLiquidity) / 2;
    const liquidityRatio = tradeAmountUSD / avgLiquidity;
    
    if (liquidityRatio > 0.1) return 0.1; // 10% risk for large trades
    if (liquidityRatio > 0.05) return 0.05; // 5% risk
    return 0.01; // 1% base risk
  }
  
  calculateVolatilityRisk(opportunity) {
    // Simplified - would use actual volatility data in production
    return 0.02; // 2% base volatility risk
  }
  
  calculateExecutionRisk(opportunity, tradeAmountUSD) {
    // Based on complexity and amount
    let risk = 0.01; // 1% base
    
    if (tradeAmountUSD > 100000) risk += 0.01; // Large trade risk
    if (opportunity.complexRouting) risk += 0.01; // Complex routing risk
    
    return risk;
  }
  
  calculateMEVRisk(tradeAmountUSD) {
    // MEV risk increases with trade size and profit potential
    const baseRisk = 0.01; // 1% base MEV risk
    const sizeMultiplier = Math.min(tradeAmountUSD / 100000, 2); // Up to 2x for large trades
    
    return baseRisk * sizeMultiplier;
  }
  
  categorizeTotalRisk(totalRisk) {
    if (totalRisk < 0.05) return 'LOW';
    if (totalRisk < 0.15) return 'MEDIUM';
    if (totalRisk < 0.3) return 'HIGH';
    return 'EXTREME';
  }
  
  async getNetworkCongestionLevel() {
    try {
      const gasPrice = await this.provider.getGasPrice();
      const gasPriceGwei = parseFloat(ethers.formatUnits(gasPrice, 'gwei'));
      
      if (gasPriceGwei < 20) return 'LOW';
      if (gasPriceGwei < 50) return 'MEDIUM';
      if (gasPriceGwei < 100) return 'HIGH';
      return 'EXTREME';
      
    } catch (error) {
      return 'MEDIUM';
    }
  }
  
  calculateOpportunityCost(tradeAmountUSD) {
    // Opportunity cost of tying up capital (simplified)
    const annualRate = 0.05; // 5% annual opportunity cost
    const timeHours = 0.1; // Assume 6 minutes average holding time
    const costUSD = tradeAmountUSD * (annualRate / (365 * 24)) * timeHours;
    
    return { costUSD, annualRate, timeHours };
  }
  
  async calculateFlashloanGasCosts(gasPrice) {
    const gasEstimate = this.enhancedCosts.gasEstimates.flashloanArbitrage;
    const gasPriceGwei = parseFloat(ethers.formatUnits(gasPrice, 'gwei'));
    const ethPrice = 2000; // Simplified - would get real price
    
    const gasCostETH = (gasEstimate * gasPriceGwei) / 1e9;
    const totalCostUSD = gasCostETH * ethPrice;
    
    return {
      gasEstimate,
      gasPriceGwei,
      gasCostETH,
      totalCostUSD,
      ethPrice
    };
  }
  
  async estimateLiquidity(exchange, tokenA, tokenB) {
    // Simplified liquidity estimation - would integrate with actual DEX APIs
    return {
      level: 'medium',
      availableLiquidity: 1000000 // $1M default
    };
  }
  
  async getDetailedLiquidityAnalysis(exchange, tokenA, tokenB, tradeAmount) {
    // Simplified - would get real liquidity data
    return {
      availableLiquidity: tradeAmount * 20, // 20x trade amount
      riskLevel: 30, // Medium risk
      confidence: 0.8
    };
  }
}

module.exports = EnhancedProfitCalculator;