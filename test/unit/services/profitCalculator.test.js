import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { MockWeb3Provider } from '../../mocks/providers/mockWeb3Provider.js';
import { PROFITABLE_OPPORTUNITY, FLASHLOAN_OPPORTUNITY } from '../../fixtures/market-data/sampleOpportunities.js';

// Mock dependencies
jest.unstable_mockModule('../../../src/providers/web3Provider.js', () => ({
  default: MockWeb3Provider
}));

const { default: ProfitCalculator } = await import('../../../src/services/profitCalculator.js');
const { default: config } = await import('../../../src/config/config.js');

describe('ProfitCalculator - Unit Tests', () => {
  let calculator;
  let mockWeb3Provider;

  beforeEach(() => {
    calculator = new ProfitCalculator();
    mockWeb3Provider = new MockWeb3Provider();
    calculator.web3Provider = mockWeb3Provider;
  });

  describe('Basic Profit Calculations', () => {
    test('should calculate profit for simple arbitrage opportunity', async () => {
      const result = await calculator.calculateProfit(PROFITABLE_OPPORTUNITY);
      
      expect(result).toBeDefined();
      expect(result.grossProfit).toBeGreaterThan(0);
      expect(result.netProfit).toBeGreaterThan(0);
      expect(result.profitPercentage).toBeGreaterThan(0);
      expect(result.gasCost).toBeGreaterThan(0);
      expect(result.netProfit).toBeLessThan(result.grossProfit);
    });

    test('should calculate profit for flashloan opportunity', async () => {
      const result = await calculator.calculateProfit(FLASHLOAN_OPPORTUNITY);
      
      expect(result).toBeDefined();
      expect(result.grossProfit).toBeGreaterThan(0);
      expect(result.netProfit).toBeGreaterThan(0);
      expect(result.flashloanFee).toBeGreaterThan(0);
      expect(result.totalCosts).toBe(result.gasCost + result.flashloanFee);
      expect(result.netProfit).toBe(result.grossProfit - result.totalCosts);
    });

    test('should handle unprofitable scenarios', async () => {
      const unprofitableOpp = {
        ...PROFITABLE_OPPORTUNITY,
        buyPrice: 2010,
        sellPrice: 2005 // Negative spread
      };
      
      const result = await calculator.calculateProfit(unprofitableOpp);
      
      expect(result.grossProfit).toBeLessThan(0);
      expect(result.netProfit).toBeLessThan(result.grossProfit);
      expect(result.profitPercentage).toBeLessThan(0);
    });
  });

  describe('Gas Cost Calculations', () => {
    test('should calculate gas costs accurately', async () => {
      mockWeb3Provider.setGasPrice('25000000000'); // 25 gwei
      
      const result = await calculator.calculateGasCost(350000); // 350k gas limit
      
      expect(result).toBeDefined();
      expect(result.gasLimit).toBe(350000);
      expect(result.gasPrice).toBe('25000000000');
      expect(result.gasCostWei).toBe('8750000000000000'); // 350k * 25 gwei
      expect(result.gasCostEth).toBeCloseTo(0.00875, 6);
      expect(result.gasCostUsd).toBeGreaterThan(0);
    });

    test('should apply gas price multiplier for faster execution', async () => {
      mockWeb3Provider.setGasPrice('20000000000'); // 20 gwei
      
      const result = await calculator.calculateGasCost(300000, 1.5); // 1.5x multiplier
      
      expect(result.effectiveGasPrice).toBe('30000000000'); // 20 * 1.5 = 30 gwei
      expect(result.gasCostWei).toBe('9000000000000000'); // 300k * 30 gwei
    });

    test('should handle high gas price scenarios', async () => {
      mockWeb3Provider.setGasPrice('200000000000'); // 200 gwei (very high)
      
      const result = await calculator.calculateGasCost(400000);
      
      expect(result.gasCostEth).toBeCloseTo(0.08, 2); // 400k * 200 gwei
      expect(result.isHighGasCost).toBe(true);
      expect(result.gasCostUsd).toBeGreaterThan(100); // Should be expensive
    });
  });

  describe('Slippage Calculations', () => {
    test('should calculate slippage impact on profit', async () => {
      const slippageResult = calculator.calculateSlippageImpact(
        PROFITABLE_OPPORTUNITY,
        0.5 // 0.5% slippage
      );
      
      expect(slippageResult).toBeDefined();
      expect(slippageResult.originalProfit).toBe(PROFITABLE_OPPORTUNITY.estimatedProfit);
      expect(slippageResult.slippageAdjustedProfit).toBeLessThan(slippageResult.originalProfit);
      expect(slippageResult.slippageCost).toBeGreaterThan(0);
      expect(slippageResult.slippagePercentage).toBe(0.5);
    });

    test('should handle high slippage scenarios', async () => {
      const highSlippageResult = calculator.calculateSlippageImpact(
        PROFITABLE_OPPORTUNITY,
        2.0 // 2% slippage
      );
      
      expect(highSlippageResult.slippageCost).toBeGreaterThan(0);
      expect(highSlippageResult.isHighSlippage).toBe(true);
      expect(highSlippageResult.slippageAdjustedProfit).toBeLessThan(
        PROFITABLE_OPPORTUNITY.estimatedProfit * 0.95
      );
    });

    test('should warn about excessive slippage', async () => {
      const excessiveSlippageResult = calculator.calculateSlippageImpact(
        PROFITABLE_OPPORTUNITY,
        5.0 // 5% slippage - excessive
      );
      
      expect(excessiveSlippageResult.isExcessiveSlippage).toBe(true);
      expect(excessiveSlippageResult.warning).toContain('excessive slippage');
    });
  });

  describe('Flashloan Calculations', () => {
    test('should calculate Aave flashloan fees', () => {
      const flashloanAmount = '10000000000'; // 10,000 USDC
      const aaveFee = calculator.calculateFlashloanFee(flashloanAmount, 'aave');
      
      expect(aaveFee).toBeDefined();
      expect(aaveFee.provider).toBe('aave');
      expect(aaveFee.amount).toBe(flashloanAmount);
      expect(aaveFee.feePercentage).toBe(0.09); // 0.09% for Aave
      expect(aaveFee.feeAmount).toBe('9000000'); // 9 USDC
    });

    test('should calculate dYdX flashloan fees', () => {
      const flashloanAmount = '5000000000'; // 5,000 USDC
      const dydxFee = calculator.calculateFlashloanFee(flashloanAmount, 'dydx');
      
      expect(dydxFee).toBeDefined();
      expect(dydxFee.provider).toBe('dydx');
      expect(dydxFee.feePercentage).toBe(0); // dYdX is free
      expect(dydxFee.feeAmount).toBe('0');
    });

    test('should compare flashloan providers', () => {
      const flashloanAmount = '20000000000'; // 20,000 USDC
      
      const comparison = calculator.compareFlashloanProviders(flashloanAmount);
      
      expect(comparison).toBeInstanceOf(Array);
      expect(comparison.length).toBeGreaterThan(0);
      
      const sorted = comparison.sort((a, b) => parseFloat(a.feeAmount) - parseFloat(b.feeAmount));
      expect(sorted[0].provider).toBe('dydx'); // dYdX should be cheapest (free)
    });
  });

  describe('Risk-Adjusted Calculations', () => {
    test('should apply risk multipliers to profit calculations', async () => {
      const riskFactors = {
        volatilityRisk: 1.2,
        liquidityRisk: 1.1,
        executionRisk: 1.05
      };
      
      const result = await calculator.calculateRiskAdjustedProfit(
        PROFITABLE_OPPORTUNITY,
        riskFactors
      );
      
      expect(result).toBeDefined();
      expect(result.originalProfit).toBe(PROFITABLE_OPPORTUNITY.estimatedProfit);
      expect(result.riskAdjustedProfit).toBeLessThan(result.originalProfit);
      expect(result.totalRiskMultiplier).toBeCloseTo(1.386, 2); // 1.2 * 1.1 * 1.05
    });

    test('should calculate confidence-weighted profits', async () => {
      const highConfidenceOpp = { ...PROFITABLE_OPPORTUNITY, confidence: 0.95 };
      const lowConfidenceOpp = { ...PROFITABLE_OPPORTUNITY, confidence: 0.60 };
      
      const highConfResult = await calculator.calculateConfidenceWeightedProfit(highConfidenceOpp);
      const lowConfResult = await calculator.calculateConfidenceWeightedProfit(lowConfidenceOpp);
      
      expect(highConfResult.weightedProfit).toBeGreaterThan(lowConfResult.weightedProfit);
      expect(highConfResult.confidenceMultiplier).toBeGreaterThan(lowConfResult.confidenceMultiplier);
    });
  });

  describe('Market Conditions Impact', () => {
    test('should adjust calculations for high volatility', async () => {
      const volatileMarketConditions = {
        volatility: 'high',
        marketTrend: 'bearish',
        liquidityCondition: 'normal'
      };
      
      const result = await calculator.calculateWithMarketConditions(
        PROFITABLE_OPPORTUNITY,
        volatileMarketConditions
      );
      
      expect(result.marketAdjustment).toBeDefined();
      expect(result.adjustedProfit).toBeLessThan(PROFITABLE_OPPORTUNITY.estimatedProfit);
      expect(result.riskPremium).toBeGreaterThan(0);
    });

    test('should boost calculations for favorable conditions', async () => {
      const favorableConditions = {
        volatility: 'low',
        marketTrend: 'bullish',
        liquidityCondition: 'high'
      };
      
      const result = await calculator.calculateWithMarketConditions(
        PROFITABLE_OPPORTUNITY,
        favorableConditions
      );
      
      expect(result.adjustedProfit).toBeGreaterThanOrEqual(PROFITABLE_OPPORTUNITY.estimatedProfit);
      expect(result.favorabilityBonus).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing opportunity data', async () => {
      const incompleteOpportunity = {
        id: 'incomplete',
        tokenPair: 'ETH-USDC'
        // Missing required fields
      };
      
      await expect(calculator.calculateProfit(incompleteOpportunity))
        .rejects.toThrow('Missing required opportunity data');
    });

    test('should handle network errors during gas price fetching', async () => {
      mockWeb3Provider.simulateNetworkError();
      
      await expect(calculator.calculateGasCost(300000))
        .rejects.toThrow('Network error');
    });

    test('should provide fallback gas price on provider failure', async () => {
      mockWeb3Provider.provider.getGasPrice.mockRejectedValue(new Error('Provider unavailable'));
      
      const result = await calculator.calculateGasCostWithFallback(300000);
      
      expect(result).toBeDefined();
      expect(result.gasPriceFallback).toBe(true);
      expect(result.gasPrice).toBe('20000000000'); // Default fallback
    });
  });

  describe('Performance Optimization', () => {
    test('should cache gas price for short periods', async () => {
      const gasCost1 = await calculator.calculateGasCost(300000);
      const gasCost2 = await calculator.calculateGasCost(350000);
      
      // Gas price should be cached and reused
      expect(mockWeb3Provider.provider.getGasPrice).toHaveBeenCalledTimes(1);
      expect(gasCost1.gasPrice).toBe(gasCost2.gasPrice);
    });

    test('should batch multiple calculations efficiently', async () => {
      const opportunities = [
        PROFITABLE_OPPORTUNITY,
        FLASHLOAN_OPPORTUNITY,
        { ...PROFITABLE_OPPORTUNITY, id: 'test-3' }
      ];
      
      const results = await calculator.batchCalculateProfit(opportunities);
      
      expect(results).toHaveLength(3);
      expect(results.every(result => result.netProfit !== undefined)).toBe(true);
      expect(mockWeb3Provider.provider.getGasPrice).toHaveBeenCalledTimes(1); // Cached
    });
  });
});