import { jest, describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import { MockWeb3Provider } from '../../mocks/providers/mockWeb3Provider.js';
import { MockPriceProvider } from '../../mocks/providers/mockPriceProvider.js';
import { PROFITABLE_OPPORTUNITY, FLASHLOAN_OPPORTUNITY } from '../../fixtures/market-data/sampleOpportunities.js';

// Mock all services for integration testing
jest.unstable_mockModule('../../../src/providers/web3Provider.js', () => ({
  default: MockWeb3Provider
}));

jest.unstable_mockModule('../../../src/providers/PriceProvider.js', () => ({
  default: MockPriceProvider
}));

// Import the classes after mocking
const { default: CoreArbitrageEngine } = await import('../../../src/services/coreArbitrageEngine.js');
const { default: config } = await import('../../../src/config/config.js');

describe('Arbitrage Full Workflow - Integration Tests', () => {
  let engine;
  let mockWeb3Provider;
  let mockPriceProvider;

  beforeAll(() => {
    // Set up test environment
    config.RPC_URL = 'https://mainnet.infura.io/v3/test-key';
    config.NODE_ENV = 'test';
    config.DRY_RUN = true;
    config.PRIVATE_KEY = 'test-key';
    config.MIN_PROFIT_THRESHOLD = 0.3; // Lower threshold for testing
  });

  beforeEach(async () => {
    engine = new CoreArbitrageEngine();
    mockWeb3Provider = new MockWeb3Provider();
    mockPriceProvider = new MockPriceProvider();
    
    await engine.initialize();
  });

  afterEach(async () => {
    if (engine && engine.isRunning) {
      await engine.stop();
    }
    jest.clearAllMocks();
  });

  describe('End-to-End Arbitrage Detection and Execution', () => {
    test('should detect, evaluate, and execute profitable arbitrage opportunity', async () => {
      // Start the engine
      await engine.start();
      
      // Mock opportunity detection
      engine.arbitrageDetector.detectOpportunities.mockResolvedValue([PROFITABLE_OPPORTUNITY]);
      
      // Mock successful transaction execution
      mockWeb3Provider.provider.sendTransaction.mockResolvedValue({
        hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        wait: () => Promise.resolve({
          status: 1,
          gasUsed: '298534',
          effectiveGasPrice: '20000000000'
        })
      });
      
      // Trigger opportunity processing cycle
      const results = await engine.processOpportunities();
      
      expect(results).toBeDefined();
      expect(results.opportunitiesProcessed).toBe(1);
      expect(results.opportunitiesExecuted).toBe(1);
      expect(results.totalProfit).toBeGreaterThan(0);
      expect(results.transactionHashes).toHaveLength(1);
    });

    test('should handle flashloan arbitrage workflow', async () => {
      await engine.start();
      
      // Mock flashloan opportunity detection
      engine.arbitrageDetector.detectOpportunities.mockResolvedValue([FLASHLOAN_OPPORTUNITY]);
      
      // Mock flashloan service
      const mockFlashloanService = {
        checkAvailability: jest.fn().mockResolvedValue({
          available: true,
          provider: 'aave',
          maxAmount: '50000000000'
        }),
        executeFlashloan: jest.fn().mockResolvedValue({
          success: true,
          txHash: '0xflashloan123456789',
          profit: '195.23'
        })
      };
      
      engine.flashloanService = mockFlashloanService;
      
      const results = await engine.processOpportunities();
      
      expect(results.opportunitiesProcessed).toBe(1);
      expect(results.flashloanExecutions).toBe(1);
      expect(mockFlashloanService.executeFlashloan).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: FLASHLOAN_OPPORTUNITY.flashloanAmount,
          provider: FLASHLOAN_OPPORTUNITY.flashloanProvider
        })
      );
    });

    test('should reject opportunities that fail risk assessment', async () => {
      await engine.start();
      
      // Create high-risk opportunity
      const highRiskOpportunity = {
        ...PROFITABLE_OPPORTUNITY,
        confidence: 0.3, // Very low confidence
        slippage: 3.0, // High slippage
        riskFactors: ['high_volatility', 'low_liquidity']
      };
      
      engine.arbitrageDetector.detectOpportunities.mockResolvedValue([highRiskOpportunity]);
      
      const results = await engine.processOpportunities();
      
      expect(results.opportunitiesProcessed).toBe(1);
      expect(results.opportunitiesExecuted).toBe(0);
      expect(results.opportunitiesRejected).toBe(1);
      expect(results.rejectionReasons).toContain('high_risk');
    });

    test('should handle multiple concurrent opportunities', async () => {
      await engine.start();
      
      const multipleOpportunities = [
        PROFITABLE_OPPORTUNITY,
        { ...PROFITABLE_OPPORTUNITY, id: 'opportunity-2', tokenPair: 'DAI-USDC' },
        { ...PROFITABLE_OPPORTUNITY, id: 'opportunity-3', tokenPair: 'WETH-DAI' }
      ];
      
      engine.arbitrageDetector.detectOpportunities.mockResolvedValue(multipleOpportunities);
      
      const results = await engine.processOpportunities();
      
      expect(results.opportunitiesProcessed).toBe(3);
      expect(results.opportunitiesExecuted).toBeGreaterThan(0);
      expect(results.concurrentExecutions).toBe(true);
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should recover from temporary RPC failures', async () => {
      await engine.start();
      
      // Simulate RPC failure then recovery
      mockWeb3Provider.provider.getBlockNumber
        .mockRejectedValueOnce(new Error('RPC timeout'))
        .mockResolvedValue(12346);
      
      engine.arbitrageDetector.detectOpportunities.mockResolvedValue([PROFITABLE_OPPORTUNITY]);
      
      const results = await engine.processOpportunities();
      
      // Should retry and succeed
      expect(results.opportunitiesProcessed).toBe(1);
      expect(results.rpcRetries).toBeGreaterThan(0);
    });

    test('should handle transaction failures gracefully', async () => {
      await engine.start();
      
      engine.arbitrageDetector.detectOpportunities.mockResolvedValue([PROFITABLE_OPPORTUNITY]);
      
      // Mock transaction failure
      mockWeb3Provider.provider.sendTransaction.mockRejectedValue(
        new Error('Transaction failed: insufficient funds')
      );
      
      const results = await engine.processOpportunities();
      
      expect(results.opportunitiesProcessed).toBe(1);
      expect(results.opportunitiesExecuted).toBe(0);
      expect(results.transactionFailures).toBe(1);
      expect(results.failureReasons).toContain('insufficient funds');
    });

    test('should implement circuit breaker on consecutive failures', async () => {
      await engine.start();
      
      engine.arbitrageDetector.detectOpportunities.mockResolvedValue([PROFITABLE_OPPORTUNITY]);
      
      // Mock multiple consecutive failures
      mockWeb3Provider.provider.sendTransaction.mockRejectedValue(
        new Error('Persistent failure')
      );
      
      // Process multiple cycles to trigger circuit breaker
      await engine.processOpportunities();
      await engine.processOpportunities();
      await engine.processOpportunities();
      
      const status = engine.getStatus();
      
      expect(status.circuitBreakerTripped).toBe(true);
      expect(status.consecutiveFailures).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Performance and Monitoring', () => {
    test('should track comprehensive metrics', async () => {
      await engine.start();
      
      const opportunities = [
        PROFITABLE_OPPORTUNITY,
        { ...PROFITABLE_OPPORTUNITY, id: 'opp-2' },
        { ...FLASHLOAN_OPPORTUNITY, id: 'flash-1' }
      ];
      
      engine.arbitrageDetector.detectOpportunities.mockResolvedValue(opportunities);
      
      await engine.processOpportunities();
      
      const metrics = engine.getMetrics();
      
      expect(metrics).toHaveProperty('totalOpportunitiesProcessed');
      expect(metrics).toHaveProperty('totalProfit');
      expect(metrics).toHaveProperty('totalGasCost');
      expect(metrics).toHaveProperty('averageExecutionTime');
      expect(metrics).toHaveProperty('successRate');
      expect(metrics).toHaveProperty('profitabilityRate');
      expect(metrics.profitPerHour).toBeGreaterThan(0);
    });

    test('should emit real-time events during execution', async () => {
      await engine.start();
      
      const events = [];
      
      engine.on('opportunityDetected', (event) => events.push({ type: 'detected', ...event }));
      engine.on('opportunityEvaluated', (event) => events.push({ type: 'evaluated', ...event }));
      engine.on('transactionSubmitted', (event) => events.push({ type: 'submitted', ...event }));
      engine.on('transactionConfirmed', (event) => events.push({ type: 'confirmed', ...event }));
      
      engine.arbitrageDetector.detectOpportunities.mockResolvedValue([PROFITABLE_OPPORTUNITY]);
      
      await engine.processOpportunities();
      
      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.type === 'detected')).toBe(true);
      expect(events.some(e => e.type === 'evaluated')).toBe(true);
    });

    test('should maintain execution time SLA', async () => {
      await engine.start();
      
      engine.arbitrageDetector.detectOpportunities.mockResolvedValue([PROFITABLE_OPPORTUNITY]);
      
      const startTime = Date.now();
      await engine.processOpportunities();
      const endTime = Date.now();
      
      const executionTime = endTime - startTime;
      
      // Should complete within 30 seconds (SLA requirement)
      expect(executionTime).toBeLessThan(30000);
      
      const metrics = engine.getMetrics();
      expect(metrics.averageExecutionTime).toBeLessThan(25000); // 25s average target
    });
  });

  describe('Risk Management Integration', () => {
    test('should enforce position size limits', async () => {
      await engine.start();
      
      const largeOpportunity = {
        ...PROFITABLE_OPPORTUNITY,
        amountIn: '100000000000', // 100k USDC - very large
        estimatedProfit: 5000
      };
      
      engine.arbitrageDetector.detectOpportunities.mockResolvedValue([largeOpportunity]);
      
      const results = await engine.processOpportunities();
      
      expect(results.opportunitiesRejected).toBe(1);
      expect(results.rejectionReasons).toContain('position_size_limit');
    });

    test('should implement daily profit limits', async () => {
      await engine.start();
      
      // Set daily profit limit
      engine.setDailyProfitLimit(100); // $100 daily limit
      
      // Simulate having already made $95 profit today
      engine.metrics.dailyProfit = 95;
      
      engine.arbitrageDetector.detectOpportunities.mockResolvedValue([PROFITABLE_OPPORTUNITY]);
      
      const results = await engine.processOpportunities();
      
      // Should be rejected due to daily limit
      expect(results.opportunitiesRejected).toBe(1);
      expect(results.rejectionReasons).toContain('daily_profit_limit');
    });

    test('should adjust position sizes based on market volatility', async () => {
      await engine.start();
      
      // Set high volatility market conditions
      engine.setMarketConditions({
        volatility: 'high',
        trend: 'bearish'
      });
      
      engine.arbitrageDetector.detectOpportunities.mockResolvedValue([PROFITABLE_OPPORTUNITY]);
      
      const results = await engine.processOpportunities();
      
      if (results.opportunitiesExecuted > 0) {
        expect(results.positionSizeAdjustments).toBeDefined();
        expect(results.positionSizeAdjustments[0].reason).toContain('high_volatility');
      }
    });
  });

  describe('Multi-Exchange Integration', () => {
    test('should execute arbitrage across different DEX protocols', async () => {
      await engine.start();
      
      const crossProtocolOpportunity = {
        ...PROFITABLE_OPPORTUNITY,
        buyExchange: 'uniswap_v2',
        sellExchange: 'sushiswap',
        crossProtocol: true
      };
      
      engine.arbitrageDetector.detectOpportunities.mockResolvedValue([crossProtocolOpportunity]);
      
      const results = await engine.processOpportunities();
      
      expect(results.crossProtocolExecutions).toBe(1);
      expect(results.executionComplexity).toBe('high');
    });

    test('should handle partial fills across exchanges', async () => {
      await engine.start();
      
      // Mock partial fill scenario
      mockWeb3Provider.provider.sendTransaction.mockResolvedValue({
        hash: '0xpartialfill123',
        wait: () => Promise.resolve({
          status: 1,
          logs: [
            { topics: ['0xSwap'], data: '0x...' }, // Partial swap event
          ]
        })
      });
      
      engine.arbitrageDetector.detectOpportunities.mockResolvedValue([PROFITABLE_OPPORTUNITY]);
      
      const results = await engine.processOpportunities();
      
      expect(results.partialFills).toBeGreaterThan(0);
      expect(results.actualProfit).toBeLessThan(PROFITABLE_OPPORTUNITY.estimatedProfit);
    });
  });
});