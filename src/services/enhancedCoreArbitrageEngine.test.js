const EnhancedCoreArbitrageEngine = require('./enhancedCoreArbitrageEngine');
const config = require('../config/config');

// Mock dependencies
jest.mock('./flashloanService');
jest.mock('./contractManager');
jest.mock('./enhancedTransactionBuilder');
jest.mock('./enhancedProfitCalculator');
jest.mock('../providers/web3Provider');

const FlashloanService = require('./flashloanService');
const ContractManager = require('./contractManager');
const EnhancedTransactionBuilder = require('./enhancedTransactionBuilder');
const EnhancedProfitCalculator = require('./enhancedProfitCalculator');

// Set up proper config for tests
beforeAll(() => {
  config.RPC_URL = 'https://mainnet.infura.io/v3/test-key';
  config.NODE_ENV = 'test';
  config.DRY_RUN = true;
  config.PRIVATE_KEY = 'test-key';
});

describe('EnhancedCoreArbitrageEngine', () => {
  let engine;
  let mockFlashloanService;
  let mockContractManager;
  let mockEnhancedTransactionBuilder;
  let mockEnhancedProfitCalculator;

  beforeEach(() => {
    // Create mocks
    mockFlashloanService = {
      initialize: jest.fn().mockResolvedValue(true),
      getFlashloanAvailability: jest.fn().mockResolvedValue([
        { provider: 'aave', available: true, fee: 9, estimatedFee: '900' }
      ]),
      estimateFlashloanFees: jest.fn().mockResolvedValue([
        { provider: 'aave', fee: '900', feeBps: 9, available: true }
      ])
    };

    mockContractManager = {
      initialize: jest.fn().mockResolvedValue(true),
      checkProfitability: jest.fn().mockResolvedValue({
        isProfitable: true,
        grossProfit: '5000',
        netProfit: '4500',
        profitPercentage: '450'
      }),
      isEmergencyStopped: jest.fn().mockResolvedValue(false),
      addresses: {
        flashloanArbitrage: '0x1234567890123456789012345678901234567890'
      },
      abis: {
        flashloanArbitrage: ['function executeArbitrage(tuple) external']
      }
    };

    mockEnhancedTransactionBuilder = {
      buildFlashloanArbitrageTransaction: jest.fn().mockResolvedValue({
        transaction: {
          to: '0x1234567890123456789012345678901234567890',
          data: '0xabcdef...',
          gasLimit: '500000',
          maxFeePerGas: '20000000000'
        },
        gasStrategy: 'STANDARD',
        estimatedCost: '0.01'
      }),
      sendFlashloanTransaction: jest.fn().mockResolvedValue({
        hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      }),
      on: jest.fn()
    };

    mockEnhancedProfitCalculator = {
      calculateFlashloanArbitrageProfit: jest.fn().mockResolvedValue({
        enhancedNetProfit: 45.50,
        enhancedROI: 4.55,
        riskAdjustedProfit: 40.25,
        risk: {
          totalRisk: 0.15,
          riskLevel: 'MEDIUM'
        },
        executionProbability: 0.85,
        isProfitable: true,
        costs: {
          total: 4.50
        }
      })
    };

    // Mock the constructors
    FlashloanService.mockImplementation(() => mockFlashloanService);
    ContractManager.mockImplementation(() => mockContractManager);
    EnhancedTransactionBuilder.mockImplementation(() => mockEnhancedTransactionBuilder);
    EnhancedProfitCalculator.mockImplementation(() => mockEnhancedProfitCalculator);

    engine = new EnhancedCoreArbitrageEngine();
  });

  afterEach(async () => {
    if (engine.isRunning) {
      await engine.stop();
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully with Phase 3 services', async () => {
      await engine.initialize();

      expect(engine.flashloanService).toBeTruthy();
      expect(engine.contractManager).toBeTruthy();
      expect(engine.enhancedTransactionBuilder).toBeTruthy();
      expect(engine.enhancedProfitCalculator).toBeTruthy();
      expect(mockFlashloanService.initialize).toHaveBeenCalled();
      expect(mockContractManager.initialize).toHaveBeenCalled();
    });

    test('should initialize with contract addresses', async () => {
      const contractAddresses = {
        flashloanArbitrage: '0x1111111111111111111111111111111111111111',
        arbitrageRouter: '0x2222222222222222222222222222222222222222'
      };

      await engine.initialize(contractAddresses);

      expect(mockContractManager.initialize).toHaveBeenCalledWith(contractAddresses);
    });
  });

  describe('Flashloan Opportunity Evaluation', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should evaluate flashloan opportunity successfully', async () => {
      const opportunity = {
        id: 'test-opportunity-1',
        tokenA: { address: '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB', decimals: 6 },
        tokenB: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
        tradeAmountUSD: 1000,
        buyFrom: 'uniswap-v2',
        sellTo: 'uniswap-v3'
      };

      const result = await engine.evaluateFlashloanOpportunity(opportunity);

      expect(result.suitable).toBe(true);
      expect(result.profitAnalysis).toBeTruthy();
      expect(result.profitAnalysis.isProfitable).toBe(true);
      expect(mockEnhancedProfitCalculator.calculateFlashloanArbitrageProfit).toHaveBeenCalledWith(
        opportunity,
        1000
      );
    });

    test('should reject opportunity with low profit', async () => {
      const opportunity = {
        id: 'test-opportunity-2',
        tokenA: { address: '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB', decimals: 6 },
        tokenB: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
        tradeAmountUSD: 1000,
        buyFrom: 'uniswap-v2',
        sellTo: 'uniswap-v3'
      };

      // Mock low profit result
      mockEnhancedProfitCalculator.calculateFlashloanArbitrageProfit.mockResolvedValueOnce({
        enhancedNetProfit: 0.5,
        enhancedROI: 0.05, // 0.05% - below threshold
        risk: { totalRisk: 0.1, riskLevel: 'LOW' },
        executionProbability: 0.9,
        isProfitable: false
      });

      const result = await engine.evaluateFlashloanOpportunity(opportunity);

      expect(result.suitable).toBe(false);
      expect(result.reason).toBe('Profit below threshold');
    });

    test('should reject opportunity with high risk', async () => {
      const opportunity = {
        id: 'test-opportunity-3',
        tokenA: { address: '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB', decimals: 6 },
        tokenB: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
        tradeAmountUSD: 1000,
        buyFrom: 'uniswap-v2',
        sellTo: 'uniswap-v3'
      };

      // Mock high risk result
      mockEnhancedProfitCalculator.calculateFlashloanArbitrageProfit.mockResolvedValueOnce({
        enhancedNetProfit: 50,
        enhancedROI: 5.0,
        risk: { totalRisk: 0.4, riskLevel: 'HIGH' }, // High risk
        executionProbability: 0.9,
        isProfitable: true
      });

      const result = await engine.evaluateFlashloanOpportunity(opportunity);

      expect(result.suitable).toBe(false);
      expect(result.reason).toBe('Risk too high');
    });

    test('should reject opportunity with low execution probability', async () => {
      const opportunity = {
        id: 'test-opportunity-4',
        tokenA: { address: '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB', decimals: 6 },
        tokenB: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
        tradeAmountUSD: 1000,
        buyFrom: 'uniswap-v2',
        sellTo: 'uniswap-v3'
      };

      // Mock low execution probability
      mockEnhancedProfitCalculator.calculateFlashloanArbitrageProfit.mockResolvedValueOnce({
        enhancedNetProfit: 50,
        enhancedROI: 5.0,
        risk: { totalRisk: 0.1, riskLevel: 'LOW' },
        executionProbability: 0.3, // Low probability
        isProfitable: true
      });

      const result = await engine.evaluateFlashloanOpportunity(opportunity);

      expect(result.suitable).toBe(false);
      expect(result.reason).toBe('Low execution probability');
    });

    test('should store suitable opportunities', async () => {
      const opportunity = {
        id: 'test-opportunity-5',
        tokenA: { address: '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB', decimals: 6 },
        tokenB: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
        tradeAmountUSD: 1000,
        buyFrom: 'uniswap-v2',
        sellTo: 'uniswap-v3'
      };

      const result = await engine.evaluateFlashloanOpportunity(opportunity);

      expect(result.suitable).toBe(true);
      expect(engine.flashloanOpportunities.has('test-opportunity-5')).toBe(true);

      const storedOpp = engine.flashloanOpportunities.get('test-opportunity-5');
      expect(storedOpp.opportunity).toEqual(opportunity);
      expect(storedOpp.status).toBe('evaluated');
    });
  });

  describe('Flashloan Arbitrage Execution', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should execute flashloan arbitrage successfully', async () => {
      const opportunity = {
        id: 'test-execution-1',
        tokenA: { address: '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB', decimals: 6 },
        tokenB: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
        tradeAmountUSD: 1000,
        buyFrom: 'uniswap-v2',
        sellTo: 'uniswap-v3'
      };

      // First evaluate the opportunity
      await engine.evaluateFlashloanOpportunity(opportunity);

      // Then execute it
      const result = await engine.executeFlashloanArbitrage('test-execution-1');

      expect(result.success).toBe(true);
      expect(result.txHash).toBeTruthy();
      expect(result.expectedProfit).toBe(45.50);
      expect(mockEnhancedTransactionBuilder.buildFlashloanArbitrageTransaction).toHaveBeenCalled();
      expect(mockEnhancedTransactionBuilder.sendFlashloanTransaction).toHaveBeenCalled();
    });

    test('should fail execution for unknown opportunity', async () => {
      const result = await engine.executeFlashloanArbitrage('unknown-opportunity');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Opportunity not found');
    });

    test('should validate execution conditions before executing', async () => {
      const opportunity = {
        id: 'test-execution-2',
        tokenA: { address: '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB', decimals: 6 },
        tokenB: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
        tradeAmountUSD: 1000,
        buyFrom: 'uniswap-v2',
        sellTo: 'uniswap-v3'
      };

      // Evaluate first
      await engine.evaluateFlashloanOpportunity(opportunity);

      // Mock emergency stop
      mockContractManager.isEmergencyStopped.mockResolvedValueOnce(true);

      const result = await engine.executeFlashloanArbitrage('test-execution-2');

      expect(result.success).toBe(false);
      expect(result.error).toContain('emergency stop');
    });

    test('should track active executions', async () => {
      const opportunity = {
        id: 'test-execution-3',
        tokenA: { address: '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB', decimals: 6 },
        tokenB: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
        tradeAmountUSD: 1000,
        buyFrom: 'uniswap-v2',
        sellTo: 'uniswap-v3'
      };

      await engine.evaluateFlashloanOpportunity(opportunity);

      expect(engine.activeExecutions.size).toBe(0);

      await engine.executeFlashloanArbitrage('test-execution-3');

      expect(engine.activeExecutions.size).toBe(1);
      const execution = Array.from(engine.activeExecutions.values())[0];
      expect(execution.opportunityId).toBe('test-execution-3');
      expect(execution.status).toBe('executing');
    });
  });

  describe('Emergency Stop', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should activate emergency stop', async () => {
      mockContractManager.activateEmergencyStop = jest.fn().mockResolvedValue({
        success: true,
        txHash: '0xemergency...'
      });

      await engine.emergencyStopFlashloans();

      expect(engine.flashloanConfig.enabled).toBe(false);
      expect(mockContractManager.activateEmergencyStop).toHaveBeenCalled();
    });

    test('should clear opportunities on emergency stop', async () => {
      const opportunity = {
        id: 'test-emergency',
        tokenA: { address: '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB', decimals: 6 },
        tokenB: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
        tradeAmountUSD: 1000,
        buyFrom: 'uniswap-v2',
        sellTo: 'uniswap-v3'
      };

      await engine.evaluateFlashloanOpportunity(opportunity);
      expect(engine.flashloanOpportunities.size).toBe(1);

      mockContractManager.activateEmergencyStop = jest.fn().mockResolvedValue({
        success: true
      });

      await engine.emergencyStopFlashloans();

      expect(engine.flashloanOpportunities.size).toBe(0);
    });
  });

  describe('Enhanced Metrics', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should return enhanced metrics including Phase 3 data', () => {
      // Set some test metrics
      engine.phase3Metrics.flashloanExecutions = 10;
      engine.phase3Metrics.successfulFlashloans = 8;
      engine.phase3Metrics.totalFlashloanProfit = 400;

      const metrics = engine.getEnhancedMetrics();

      expect(metrics.phase3).toBeTruthy();
      expect(metrics.phase3.flashloanExecutions).toBe(10);
      expect(metrics.phase3.successfulFlashloans).toBe(8);
      expect(metrics.phase3.flashloanSuccessRate).toBe(80);
      expect(metrics.phase3.averageProfit).toBe(50);
    });

    test('should handle zero executions in metrics', () => {
      const metrics = engine.getEnhancedMetrics();

      expect(metrics.phase3.flashloanSuccessRate).toBe(0);
      expect(metrics.phase3.averageProfit).toBe(0);
    });
  });

  describe('Configuration Management', () => {
    test('should respect flashloan configuration', async () => {
      await engine.initialize();

      // Disable flashloans
      engine.flashloanConfig.enabled = false;

      const opportunity = {
        id: 'test-disabled',
        tokenA: { address: '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB', decimals: 6 },
        tokenB: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
        tradeAmountUSD: 1000,
        buyFrom: 'uniswap-v2',
        sellTo: 'uniswap-v3'
      };

      const result = await engine.evaluateFlashloanOpportunity(opportunity);

      expect(result.suitable).toBe(false);
      expect(result.reason).toBe('Flashloans disabled');
    });

    test('should respect maximum trade amount', async () => {
      await engine.initialize();

      const opportunity = {
        id: 'test-large-trade',
        tokenA: { address: '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB', decimals: 6 },
        tokenB: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
        tradeAmountUSD: 2000000, // $2M - exceeds default max
        buyFrom: 'uniswap-v2',
        sellTo: 'uniswap-v3'
      };

      const result = await engine.evaluateFlashloanOpportunity(opportunity);

      expect(result.suitable).toBe(false);
      expect(result.reason).toBe('Trade amount too large');
    });
  });

  describe('Helper Methods', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should get correct router addresses', () => {
      expect(engine.getRouterAddress('uniswap-v2')).toBe(config.UNISWAP_V2_ROUTER);
      expect(engine.getRouterAddress('uniswap-v3')).toBe('0xE592427A0AEce92De3Edee1F18E0157C05861564');
      expect(engine.getRouterAddress('unknown')).toBe(config.UNISWAP_V2_ROUTER); // fallback
    });

    test('should get correct pool fees', () => {
      expect(engine.getPoolFee('uniswap-v2')).toBe(0);
      expect(engine.getPoolFee('uniswap-v3')).toBe(3000);
    });

    test('should prepare arbitrage data correctly', () => {
      const opportunity = {
        tokenA: { address: '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB', decimals: 6 },
        tokenB: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
        tradeAmountUSD: 1000,
        buyFrom: 'uniswap-v2',
        sellTo: 'uniswap-v3'
      };

      const profitAnalysis = { enhancedNetProfit: 50 };

      const arbitrageData = engine.prepareArbitrageData(opportunity, profitAnalysis);

      expect(arbitrageData.tokenA).toBe('0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB');
      expect(arbitrageData.tokenB).toBe('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2');
      expect(arbitrageData.routerA).toBe(config.UNISWAP_V2_ROUTER);
      expect(arbitrageData.feeA).toBe(0);
      expect(arbitrageData.feeB).toBe(3000);
      expect(arbitrageData.deadline).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });
});