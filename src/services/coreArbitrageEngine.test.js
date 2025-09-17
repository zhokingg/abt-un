const CoreArbitrageEngine = require('./coreArbitrageEngine');
const config = require('../config/config');

// Mock Web3Provider to avoid requiring actual blockchain connection
jest.mock('../providers/web3Provider', () => {
  return jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(true),
    isConnected: jest.fn().mockReturnValue(true),
    provider: {
      getBlockNumber: jest.fn().mockResolvedValue(12345),
      getGasPrice: jest.fn().mockResolvedValue('20000000000'),
      on: jest.fn(),
      removeAllListeners: jest.fn()
    },
    disconnect: jest.fn()
  }));
});

// Set up proper config for tests
beforeAll(() => {
  config.RPC_URL = 'https://mainnet.infura.io/v3/test-key';
  config.NODE_ENV = 'test';
  config.DRY_RUN = true;
  config.PRIVATE_KEY = 'test-key';
});

describe('CoreArbitrageEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new CoreArbitrageEngine();
  });

  afterEach(async () => {
    if (engine.isRunning) {
      await engine.stop();
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      await engine.initialize();
      
      expect(engine.web3Provider).toBeTruthy();
      expect(engine.priceMonitor).toBeTruthy();
      expect(engine.profitCalculator).toBeTruthy();
      expect(engine.mempoolMonitor).toBeTruthy();
      expect(engine.transactionBuilder).toBeTruthy();
      expect(engine.arbitrageDetector).toBeTruthy();
    });

    test('should validate configuration', async () => {
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
  });

  describe('Engine Control', () => {
    test('should start and stop engine', async () => {
      await engine.initialize();
      
      expect(engine.isRunning).toBe(false);
      
      await engine.start();
      expect(engine.isRunning).toBe(true);
      
      await engine.stop();
      expect(engine.isRunning).toBe(false);
    });

    test('should pause and resume engine', async () => {
      await engine.initialize();
      await engine.start();
      
      expect(engine.isPaused).toBe(false);
      
      engine.pause();
      expect(engine.isPaused).toBe(true);
      
      engine.resume();
      expect(engine.isPaused).toBe(false);
      
      await engine.stop();
    });
  });

  describe('Opportunity Management', () => {
    test('should evaluate opportunities correctly', async () => {
      await engine.initialize();
      
      const mockOpportunity = {
        id: 'test-opportunity-1',
        tokenPair: 'WETH-USDC',
        buyPrice: 2000,
        sellPrice: 2010,
        profitPercentage: 0.5,
        buyExchange: 'uniswap-v2',
        sellExchange: 'uniswap-v3'
      };
      
      // Mock the profit calculator
      engine.profitCalculator.calculateProfit = jest.fn().mockResolvedValue({
        profitable: true,
        roi: 0.6,
        netProfit: 50,
        riskLevel: 'MEDIUM'
      });
      
      engine.profitCalculator.simulateTrade = jest.fn().mockResolvedValue({
        simulation: {
          success: true,
          successProbability: 85
        }
      });
      
      await engine.evaluateOpportunity(mockOpportunity);
      
      expect(engine.activeOpportunities.has('test-opportunity-1')).toBe(true);
      expect(engine.stats.totalOpportunities).toBe(1);
      expect(engine.stats.profitableOpportunities).toBe(1);
    });

    test('should cleanup expired opportunities', async () => {
      await engine.initialize();
      
      // Add expired opportunity
      const expiredOpportunity = {
        id: 'expired-opportunity',
        detectedAt: Date.now() - (engine.engineConfig.opportunityTimeout * 3), // 3x timeout ago
        status: 'evaluated'
      };
      
      engine.activeOpportunities.set('expired-opportunity', expiredOpportunity);
      
      engine.cleanupExpiredOpportunities();
      
      expect(engine.activeOpportunities.has('expired-opportunity')).toBe(false);
      expect(engine.opportunityHistory.length).toBe(1);
    });
  });

  describe('Event Handling', () => {
    test('should handle price change events', async () => {
      await engine.initialize();
      
      const priceChangeEvent = {
        pairId: 'WETH_USDC_uniswap-v2',
        previousPrice: 2000,
        newPrice: 2010,
        percentageChange: 0.5
      };
      
      // Should not throw error
      await engine.handlePriceChange(priceChangeEvent);
    });

    test('should handle mempool opportunities', async () => {
      await engine.initialize();
      
      const mempoolEvent = {
        hasOpportunity: true,
        opportunityType: 'arbitrage',
        txHash: '0x123',
        tokens: ['WETH', 'USDC'],
        opportunity: {
          value: 100,
          confidence: 0.8
        }
      };
      
      // Mock the evaluate function
      engine.evaluateOpportunity = jest.fn();
      
      await engine.handleMempoolOpportunity(mempoolEvent);
      
      expect(engine.evaluateOpportunity).toHaveBeenCalled();
    });
  });

  describe('Status and Metrics', () => {
    test('should return correct status', async () => {
      await engine.initialize();
      
      const status = engine.getStatus();
      
      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('isPaused');
      expect(status).toHaveProperty('stats');
      expect(status).toHaveProperty('services');
      expect(status.services).toHaveProperty('web3Connected');
    });

    test('should update stats correctly', () => {
      engine.stats.totalOpportunities = 10;
      engine.stats.executedTrades = 8;
      engine.stats.startTime = Date.now() - 60000; // 1 minute ago
      
      engine.updateStats();
      
      expect(engine.stats.successRate).toBe(80);
      expect(engine.stats.uptime).toBeGreaterThan(0);
    });
  });

  describe('Utility Functions', () => {
    test('should generate correct pair ID', () => {
      const pair = {
        tokenA: 'WETH',
        tokenB: 'USDC',
        exchange: 'uniswap-v2'
      };
      
      const pairId = engine.getPairId(pair);
      expect(pairId).toBe('WETH_USDC_uniswap-v2');
    });

    test('should determine execution correctly', () => {
      const profitAnalysis = {
        roi: 1.0,
        riskLevel: 'MEDIUM'
      };
      
      const simulation = {
        simulation: {
          successProbability: 85
        }
      };
      
      // Test with dry run enabled
      config.DRY_RUN = true;
      expect(engine.shouldExecuteOpportunity(profitAnalysis, simulation)).toBe(false);
      
      // Test with dry run disabled
      config.DRY_RUN = false;
      expect(engine.shouldExecuteOpportunity(profitAnalysis, simulation)).toBe(true);
      
      // Test with low profit
      profitAnalysis.roi = 0.1;
      expect(engine.shouldExecuteOpportunity(profitAnalysis, simulation)).toBe(false);
      
      // Test with very high risk
      profitAnalysis.roi = 1.0;
      profitAnalysis.riskLevel = 'VERY HIGH';
      expect(engine.shouldExecuteOpportunity(profitAnalysis, simulation)).toBe(false);
    });
  });
});