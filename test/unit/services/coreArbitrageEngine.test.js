import { jest, describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import { MockWeb3Provider } from '../../mocks/providers/mockWeb3Provider.js';
import { MockPriceProvider } from '../../mocks/providers/mockPriceProvider.js';
import { PROFITABLE_OPPORTUNITY, UNPROFITABLE_OPPORTUNITY } from '../../fixtures/market-data/sampleOpportunities.js';

// Mock all the dependencies before importing the main class
jest.unstable_mockModule('../../../src/providers/web3Provider.js', () => ({
  default: MockWeb3Provider
}));

jest.unstable_mockModule('../../../src/providers/PriceProvider.js', () => ({
  default: MockPriceProvider
}));

jest.unstable_mockModule('../../../src/services/priceMonitor.js', () => ({
  default: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    start: jest.fn().mockResolvedValue(true),
    stop: jest.fn().mockResolvedValue(true),
    getCurrentPrices: jest.fn().mockResolvedValue({
      'ETH/USD': 2000,
      'USDC/USD': 1.0
    })
  }))
}));

jest.unstable_mockModule('../../../src/services/profitCalculator.js', () => ({
  default: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    calculateProfit: jest.fn().mockResolvedValue({
      grossProfit: 10.50,
      netProfit: 5.25,
      profitPercentage: 0.525,
      gasEstimate: 300000,
      gasCost: 5.25
    })
  }))
}));

jest.unstable_mockModule('../../../src/services/arbitrageDetector.js', () => ({
  default: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    detectOpportunities: jest.fn().mockResolvedValue([PROFITABLE_OPPORTUNITY])
  }))
}));

// Now import the class under test
const { default: CoreArbitrageEngine } = await import('../../../src/services/coreArbitrageEngine.js');
const { default: config } = await import('../../../src/config/config.js');

describe('CoreArbitrageEngine - Unit Tests', () => {
  let engine;
  let mockWeb3Provider;
  let mockPriceProvider;

  beforeAll(() => {
    // Set up test environment
    config.RPC_URL = 'https://mainnet.infura.io/v3/test-key';
    config.NODE_ENV = 'test';
    config.DRY_RUN = true;
    config.PRIVATE_KEY = 'test-key';
  });

  beforeEach(() => {
    // Create fresh instances for each test
    engine = new CoreArbitrageEngine();
    mockWeb3Provider = new MockWeb3Provider();
    mockPriceProvider = new MockPriceProvider();
  });

  afterEach(async () => {
    if (engine && engine.isRunning) {
      await engine.stop();
    }
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize successfully with all required components', async () => {
      await engine.initialize();
      
      expect(engine.web3Provider).toBeTruthy();
      expect(engine.priceMonitor).toBeTruthy();
      expect(engine.profitCalculator).toBeTruthy();
      expect(engine.arbitrageDetector).toBeTruthy();
      expect(engine.isInitialized).toBe(true);
    });

    test('should validate configuration before initialization', async () => {
      const originalRpcUrl = config.RPC_URL;
      const originalNodeEnv = config.NODE_ENV;
      
      // Test invalid RPC URL in production
      config.RPC_URL = 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY';
      config.NODE_ENV = 'production';
      
      await expect(engine.initialize()).rejects.toThrow('Invalid RPC URL configuration');
      
      // Restore original values
      config.RPC_URL = originalRpcUrl;
      config.NODE_ENV = originalNodeEnv;
    });

    test('should handle initialization failures gracefully', async () => {
      // Mock a service that fails to initialize
      const mockFailingService = {
        initialize: jest.fn().mockRejectedValue(new Error('Service initialization failed'))
      };
      
      engine.web3Provider = mockFailingService;
      
      await expect(engine.initialize()).rejects.toThrow('Service initialization failed');
      expect(engine.isInitialized).toBe(false);
    });
  });

  describe('Engine Control', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should start and stop engine correctly', async () => {
      expect(engine.isRunning).toBe(false);
      
      await engine.start();
      expect(engine.isRunning).toBe(true);
      
      await engine.stop();
      expect(engine.isRunning).toBe(false);
    });

    test('should prevent multiple starts', async () => {
      await engine.start();
      expect(engine.isRunning).toBe(true);
      
      // Second start should not throw but should do nothing
      await engine.start();
      expect(engine.isRunning).toBe(true);
    });

    test('should pause and resume engine', async () => {
      await engine.start();
      
      expect(engine.isPaused).toBe(false);
      
      engine.pause();
      expect(engine.isPaused).toBe(true);
      
      engine.resume();
      expect(engine.isPaused).toBe(false);
    });

    test('should handle stop when not running', async () => {
      expect(engine.isRunning).toBe(false);
      
      // Should not throw when stopping a stopped engine
      await engine.stop();
      expect(engine.isRunning).toBe(false);
    });
  });

  describe('Opportunity Processing', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should evaluate profitable opportunities correctly', async () => {
      const result = await engine.evaluateOpportunity(PROFITABLE_OPPORTUNITY);
      
      expect(result).toBeDefined();
      expect(result.approved).toBe(true);
      expect(result.profitability).toBeGreaterThan(0);
      expect(result.netProfit).toBeGreaterThan(0);
    });

    test('should reject unprofitable opportunities', async () => {
      const result = await engine.evaluateOpportunity(UNPROFITABLE_OPPORTUNITY);
      
      expect(result).toBeDefined();
      expect(result.approved).toBe(false);
      expect(result.rejectionReason).toContain('unprofitable');
    });

    test('should handle invalid opportunity data', async () => {
      const invalidOpportunity = {
        id: 'invalid-opportunity',
        tokenPair: 'INVALID-PAIR'
        // Missing required fields
      };
      
      await expect(engine.evaluateOpportunity(invalidOpportunity))
        .rejects.toThrow('Invalid opportunity data');
    });

    test('should track opportunity metrics', async () => {
      await engine.evaluateOpportunity(PROFITABLE_OPPORTUNITY);
      await engine.evaluateOpportunity(UNPROFITABLE_OPPORTUNITY);
      
      const metrics = engine.getMetrics();
      
      expect(metrics.opportunitiesEvaluated).toBe(2);
      expect(metrics.opportunitiesApproved).toBe(1);
      expect(metrics.opportunitiesRejected).toBe(1);
    });
  });

  describe('Risk Management', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should enforce minimum profit threshold', async () => {
      const lowProfitOpportunity = {
        ...PROFITABLE_OPPORTUNITY,
        profitPercentage: 0.1, // Below default threshold
        netProfit: 1.0
      };
      
      const result = await engine.evaluateOpportunity(lowProfitOpportunity);
      
      expect(result.approved).toBe(false);
      expect(result.rejectionReason).toContain('profit threshold');
    });

    test('should enforce maximum trade amount', async () => {
      const largeTrade = {
        ...PROFITABLE_OPPORTUNITY,
        amountIn: '10000000000', // 10,000 USDC - above limit
        estimatedProfit: 1000
      };
      
      const result = await engine.evaluateOpportunity(largeTrade);
      
      expect(result.approved).toBe(false);
      expect(result.rejectionReason).toContain('trade amount');
    });

    test('should check gas price limits', async () => {
      // Mock high gas price
      mockWeb3Provider.setGasPrice('100000000000'); // 100 gwei
      
      const result = await engine.evaluateOpportunity(PROFITABLE_OPPORTUNITY);
      
      // Should still evaluate but with adjusted profit calculation
      expect(result).toBeDefined();
      expect(result.gasCost).toBeGreaterThan(PROFITABLE_OPPORTUNITY.estimatedGasCost);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should handle network errors gracefully', async () => {
      // Simulate network error
      mockWeb3Provider.simulateNetworkError();
      
      const result = await engine.evaluateOpportunity(PROFITABLE_OPPORTUNITY);
      
      expect(result.approved).toBe(false);
      expect(result.rejectionReason).toContain('network error');
    });

    test('should handle service failures without crashing', async () => {
      // Mock service failure during opportunity evaluation
      engine.profitCalculator.calculateProfit.mockRejectedValue(
        new Error('Profit calculation failed')
      );
      
      const result = await engine.evaluateOpportunity(PROFITABLE_OPPORTUNITY);
      
      expect(result.approved).toBe(false);
      expect(result.rejectionReason).toContain('calculation failed');
    });

    test('should recover from temporary failures', async () => {
      // First call fails
      engine.profitCalculator.calculateProfit
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue({
          grossProfit: 10.50,
          netProfit: 5.25,
          profitPercentage: 0.525
        });
      
      // First evaluation should fail
      const firstResult = await engine.evaluateOpportunity(PROFITABLE_OPPORTUNITY);
      expect(firstResult.approved).toBe(false);
      
      // Second evaluation should succeed
      const secondResult = await engine.evaluateOpportunity(PROFITABLE_OPPORTUNITY);
      expect(secondResult.approved).toBe(true);
    });
  });

  describe('Performance Metrics', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should track execution times', async () => {
      const startTime = Date.now();
      await engine.evaluateOpportunity(PROFITABLE_OPPORTUNITY);
      const endTime = Date.now();
      
      const metrics = engine.getMetrics();
      
      expect(metrics.averageEvaluationTime).toBeDefined();
      expect(metrics.averageEvaluationTime).toBeGreaterThan(0);
      expect(metrics.averageEvaluationTime).toBeLessThan(endTime - startTime + 100); // Allow for margin
    });

    test('should track success rates', async () => {
      // Process multiple opportunities
      await engine.evaluateOpportunity(PROFITABLE_OPPORTUNITY);
      await engine.evaluateOpportunity(UNPROFITABLE_OPPORTUNITY);
      await engine.evaluateOpportunity(PROFITABLE_OPPORTUNITY);
      
      const metrics = engine.getMetrics();
      
      expect(metrics.successRate).toBeDefined();
      expect(metrics.successRate).toBeCloseTo(0.67, 1); // 2/3 approved
    });

    test('should provide comprehensive metrics', async () => {
      const metrics = engine.getMetrics();
      
      expect(metrics).toHaveProperty('opportunitiesEvaluated');
      expect(metrics).toHaveProperty('opportunitiesApproved');
      expect(metrics).toHaveProperty('opportunitiesRejected');
      expect(metrics).toHaveProperty('averageEvaluationTime');
      expect(metrics).toHaveProperty('successRate');
      expect(metrics).toHaveProperty('totalProfit');
      expect(metrics).toHaveProperty('totalGasCost');
    });
  });
});