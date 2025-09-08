const config = require('../config/config');
const { ethers } = require('ethers');

class ArbitrageDetector {
  constructor() {
    this.opportunities = [];
    this.minProfitThreshold = config.MIN_PROFIT_THRESHOLD;
    this.stats = {
      totalChecked: 0,
      opportunitiesFound: 0,
      profitableFound: 0,
      totalPotentialProfit: 0
    };
  }

  /**
   * Detect arbitrage opportunity between V2 and V3 prices
   */
  detectArbitrage(v2Price, v3Price, tokenPair, additionalData = {}) {
    if (!v2Price || !v3Price || !tokenPair) {
      return null;
    }

    this.stats.totalChecked++;

    // Normalize prices to ensure we're comparing correctly
    const price1 = parseFloat(v2Price.price || v2Price);
    const price2 = parseFloat(v3Price.price || v3Price);

    if (price1 <= 0 || price2 <= 0) {
      return null;
    }

    // Calculate price difference and profit percentage
    const priceDiff = Math.abs(price2 - price1);
    const lowerPrice = Math.min(price1, price2);
    const higherPrice = Math.max(price1, price2);
    const profitPercentage = (priceDiff / lowerPrice) * 100;

    // Determine trade direction
    const buyFromV2 = price1 < price2;
    const buyExchange = buyFromV2 ? 'uniswap-v2' : 'uniswap-v3';
    const sellExchange = buyFromV2 ? 'uniswap-v3' : 'uniswap-v2';

    const opportunity = {
      id: `${tokenPair}-${Date.now()}`,
      timestamp: Date.now(),
      tokenPair,
      
      // Price data
      v2Price: price1,
      v3Price: price2,
      priceDiff,
      profitPercentage: parseFloat(profitPercentage.toFixed(6)),
      
      // Trade direction
      buyExchange,
      sellExchange,
      buyPrice: lowerPrice,
      sellPrice: higherPrice,
      
      // Profitability
      profitable: profitPercentage >= this.minProfitThreshold,
      
      // Additional data
      gasPrice: additionalData.gasPrice,
      blockNumber: additionalData.blockNumber,
      
      // Raw data for analysis
      v2Data: v2Price,
      v3Data: v3Price
    };

    // Update stats
    this.stats.opportunitiesFound++;
    if (opportunity.profitable) {
      this.stats.profitableFound++;
    }

    // Store opportunity
    this.addOpportunity(opportunity);

    return opportunity;
  }

  /**
   * Calculate potential profit for a given trade amount
   */
  calculatePotentialProfit(opportunity, tradeAmountUSD = config.MAX_TRADE_AMOUNT) {
    if (!opportunity || !opportunity.profitable) {
      return {
        grossProfit: 0,
        netProfit: 0,
        gasEstimate: 0,
        profitable: false,
        tradeAmount: tradeAmountUSD
      };
    }

    // Calculate gross profit
    const amountToBuy = tradeAmountUSD / opportunity.buyPrice;
    const sellValue = amountToBuy * opportunity.sellPrice;
    const grossProfit = sellValue - tradeAmountUSD;

    // Estimate gas costs (simplified - should be more sophisticated in production)
    const gasEstimate = this.estimateGasCosts(opportunity);
    
    // Calculate slippage impact
    const slippageImpact = this.estimateSlippage(tradeAmountUSD, opportunity);
    
    // Net profit after costs
    const netProfit = grossProfit - gasEstimate - slippageImpact;

    const result = {
      tradeAmount: tradeAmountUSD,
      amountToBuy: parseFloat(amountToBuy.toFixed(6)),
      sellValue: parseFloat(sellValue.toFixed(2)),
      grossProfit: parseFloat(grossProfit.toFixed(2)),
      gasEstimate: parseFloat(gasEstimate.toFixed(2)),
      slippageImpact: parseFloat(slippageImpact.toFixed(2)),
      netProfit: parseFloat(netProfit.toFixed(2)),
      profitable: netProfit > 0,
      roi: parseFloat(((netProfit / tradeAmountUSD) * 100).toFixed(4))
    };

    if (result.profitable) {
      this.stats.totalPotentialProfit += result.netProfit;
    }

    return result;
  }

  /**
   * Estimate gas costs for arbitrage transaction
   */
  estimateGasCosts(opportunity) {
    // Simplified gas estimation
    // In production, this should query actual gas prices and estimate gas usage
    const baseGasPrice = 20; // 20 gwei
    const gasLimit = 200000; // Estimated gas for arbitrage transaction
    const ethPrice = 2500; // Simplified ETH price
    
    const gasCostETH = (baseGasPrice * gasLimit) / 1e9;
    const gasCostUSD = gasCostETH * ethPrice;
    
    return gasCostUSD;
  }

  /**
   * Estimate slippage impact
   */
  estimateSlippage(tradeAmount, opportunity) {
    // Simplified slippage calculation
    // In production, this should use pool liquidity data
    const slippagePercentage = config.SLIPPAGE_TOLERANCE;
    return (tradeAmount * slippagePercentage) / 100;
  }

  /**
   * Add opportunity to history
   */
  addOpportunity(opportunity) {
    this.opportunities.push(opportunity);
    
    // Keep only last 1000 opportunities to prevent memory issues
    if (this.opportunities.length > 1000) {
      this.opportunities = this.opportunities.slice(-1000);
    }
  }

  /**
   * Get recent opportunities
   */
  getRecentOpportunities(limit = 10) {
    return this.opportunities
      .slice(-limit)
      .reverse(); // Most recent first
  }

  /**
   * Get profitable opportunities
   */
  getProfitableOpportunities(limit = 50) {
    return this.opportunities
      .filter(opp => opp.profitable)
      .slice(-limit)
      .reverse();
  }

  /**
   * Get statistics
   */
  getStats() {
    const profitable = this.getProfitableOpportunities().length;
    const total = this.opportunities.length;
    
    return {
      totalChecked: this.stats.totalChecked,
      totalOpportunities: total,
      profitableOpportunities: profitable,
      profitabilityRate: total > 0 ? ((profitable / total) * 100).toFixed(2) : 0,
      averageProfitPercentage: this.calculateAverageProfit(),
      totalPotentialProfit: parseFloat(this.stats.totalPotentialProfit.toFixed(2)),
      uptime: this.getUptime()
    };
  }

  /**
   * Calculate average profit percentage
   */
  calculateAverageProfit() {
    const profitable = this.getProfitableOpportunities();
    if (profitable.length === 0) return 0;
    
    const totalProfit = profitable.reduce((sum, opp) => sum + opp.profitPercentage, 0);
    return parseFloat((totalProfit / profitable.length).toFixed(4));
  }

  /**
   * Get system uptime
   */
  getUptime() {
    return process.uptime();
  }

  /**
   * Log opportunity details
   */
  logOpportunity(opportunity, includeProfit = true) {
    if (!opportunity) return;

    const timestamp = new Date(opportunity.timestamp).toLocaleTimeString();
    const profitStatus = opportunity.profitable ? '🟢 PROFITABLE' : '🔴 Not Profitable';
    
    console.log(`\n${profitStatus} - ${opportunity.tokenPair}`);
    console.log(`⏰ Time: ${timestamp}`);
    console.log(`💰 Buy on ${opportunity.buyExchange}: $${opportunity.buyPrice.toFixed(6)}`);
    console.log(`💸 Sell on ${opportunity.sellExchange}: $${opportunity.sellPrice.toFixed(6)}`);
    console.log(`📈 Profit: ${opportunity.profitPercentage}%`);
    
    if (opportunity.profitable && includeProfit) {
      const profit = this.calculatePotentialProfit(opportunity);
      console.log(`💵 Potential net profit: $${profit.netProfit} (${profit.roi}% ROI)`);
      console.log(`⛽ Est. gas cost: $${profit.gasEstimate}`);
    }
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalChecked: 0,
      opportunitiesFound: 0,
      profitableFound: 0,
      totalPotentialProfit: 0
    };
    this.opportunities = [];
  }
}

module.exports = ArbitrageDetector;