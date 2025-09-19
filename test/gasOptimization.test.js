const GasOptimizationEngine = require('../src/optimization/gasOptimizationEngine');
const AdvancedGasManager = require('../src/services/advancedGasManager');
const GasOptimizedTransactionBuilder = require('../src/services/gasOptimizedTransactionBuilder');
const GasAnalytics = require('../src/services/gasAnalytics');

describe('Gas Optimization System', () => {
  let mockProvider;
  let mockContractManager;
  let gasEngine;
  
  beforeEach(() => {
    // Mock provider
    mockProvider = {
      getBlock: jest.fn(() => Promise.resolve({
        number: 18000000,
        timestamp: Math.floor(Date.now() / 1000),
        gasUsed: 15000000n,
        gasLimit: 30000000n
      })),
      getFeeData: jest.fn(() => Promise.resolve({
        gasPrice: 25000000000n, // 25 gwei
        maxFeePerGas: 30000000000n, // 30 gwei
        maxPriorityFeePerGas: 2000000000n // 2 gwei
      })),
      getGasPrice: jest.fn(() => Promise.resolve(25000000000n)),
      getBalance: jest.fn(() => Promise.resolve(500000000000000000n)) // 0.5 ETH
    };
    
    // Mock web3 provider
    const mockWeb3Provider = {
      provider: mockProvider,
      wallet: { address: '0x1234567890123456789012345678901234567890' }
    };
    
    // Mock contract manager
    mockContractManager = {
      addresses: {
        flashloanArbitrage: '0x1111111111111111111111111111111111111111'
      },
      estimateArbitrageGas: jest.fn(() => Promise.resolve({
        gasLimit: '400000',
        estimated: true
      }))
    };
    
    // Initialize gas optimization engine
    gasEngine = new GasOptimizationEngine(mockWeb3Provider, mockContractManager);
  });
  
  describe('GasOptimizationEngine', () => {
    test('should initialize with correct components', () => {
      expect(gasEngine).toBeDefined();
      expect(gasEngine.gasManager).toBeDefined();
      expect(gasEngine.transactionBuilder).toBeDefined();
      expect(gasEngine.analytics).toBeDefined();
    });
    
    test('should have optimization strategies', () => {
      const stats = gasEngine.getStats();
      
      expect(stats.strategies).toContain('AGGRESSIVE_SAVINGS');
      expect(stats.strategies).toContain('BALANCED_OPTIMIZATION');
      expect(stats.strategies).toContain('SPEED_PRIORITIZED');
      expect(stats.strategies).toContain('PROFIT_MAXIMIZATION');
    });
    
    test('should optimize transaction successfully', async () => {
      const arbitrageData = {
        tokenA: '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB',
        tokenB: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        amountIn: 10000,
        expectedProfit: 0.02
      };
      
      const result = await gasEngine.optimizeTransaction(arbitrageData);
      
      expect(result).toBeDefined();
      expect(result.strategy).toBeDefined();
      expect(result.savings).toBeDefined();
      expect(result.savings.percentage).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('AdvancedGasManager', () => {
    let gasManager;
    
    beforeEach(() => {
      gasManager = new AdvancedGasManager({
        provider: mockProvider,
        wallet: { address: '0x1234567890123456789012345678901234567890' }
      });
    });
    
    test('should calculate optimal gas parameters', async () => {
      const arbitrageData = {
        amountIn: 10000,
        expectedProfit: 0.015
      };
      
      const gasParams = await gasManager.getOptimalGasParams(arbitrageData);
      
      expect(gasParams).toBeDefined();
      expect(gasParams.gasLimit).toBeDefined();
      expect(gasParams.maxFeePerGas).toBeDefined();
      expect(gasParams.maxPriorityFeePerGas).toBeDefined();
      expect(gasParams.strategy).toBeDefined();
    });
    
    test('should provide gas statistics', () => {
      const stats = gasManager.getStats();
      
      expect(stats.networkStats).toBeDefined();
      expect(stats.gasPool).toBeDefined();
      expect(stats.metrics).toBeDefined();
    });
  });
  
  describe('GasOptimizedTransactionBuilder', () => {
    let transactionBuilder;
    
    beforeEach(() => {
      transactionBuilder = new GasOptimizedTransactionBuilder(
        { provider: mockProvider },
        mockContractManager
      );
    });
    
    test('should build optimized transaction', async () => {
      const arbitrageData = {
        tokenA: '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB',
        tokenB: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        amountIn: 10000
      };
      
      const result = await transactionBuilder.buildOptimizedArbitrageTransaction(arbitrageData);
      
      expect(result).toBeDefined();
      expect(result.transaction).toBeDefined();
      expect(result.gasParams).toBeDefined();
      expect(result.estimatedCostUSD).toBeDefined();
      expect(result.optimization).toBeDefined();
    });
    
    test('should provide performance statistics', () => {
      const stats = transactionBuilder.getPerformanceStats();
      
      expect(stats).toBeDefined();
      expect(stats.totalTransactions).toBeDefined();
      expect(stats.cacheSize).toBeDefined();
    });
  });
  
  describe('GasAnalytics', () => {
    let gasAnalytics;
    
    beforeEach(() => {
      gasAnalytics = new GasAnalytics({ provider: mockProvider });
    });
    
    test('should record transactions', async () => {
      const transactionData = {
        gasLimit: 400000n,
        maxFeePerGas: 25000000000n,
        maxPriorityFeePerGas: 2000000000n,
        strategy: 'BALANCED_OPTIMIZATION',
        estimatedCostUSD: 45
      };
      
      const result = {
        hash: '0xabcdef',
        gasUsed: 380000n,
        status: 'success',
        actualCostUSD: 42
      };
      
      await gasAnalytics.recordTransaction(transactionData, result);
      
      const dashboardData = gasAnalytics.getDashboardData();
      expect(dashboardData).toBeDefined();
      expect(dashboardData.realTime).toBeDefined();
      expect(dashboardData.metrics).toBeDefined();
    });
    
    test('should generate analytics report', async () => {
      const report = await gasAnalytics.generateAnalyticsReport();
      
      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.performance).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });
    
    test('should analyze gas patterns', async () => {
      const analysis = await gasAnalytics.analyzeGasPatterns();
      
      expect(analysis).toBeDefined();
      expect(analysis.totalTransactions).toBeDefined();
      expect(analysis.optimizationRecommendations).toBeDefined();
    });
  });
  
  describe('Integration Tests', () => {
    test('should demonstrate full gas optimization flow', async () => {
      const arbitrageData = {
        tokenA: '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB',
        tokenB: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        amountIn: 50000,
        expectedProfit: 0.025
      };
      
      // Step 1: Optimize transaction
      const optimizationResult = await gasEngine.optimizeTransaction(arbitrageData);
      
      expect(optimizationResult).toBeDefined();
      expect(optimizationResult.strategy).toBeDefined();
      
      // Step 2: Check if savings achieved
      expect(optimizationResult.savings.percentage).toBeGreaterThanOrEqual(0);
      
      // Step 3: Validate transaction structure
      if (optimizationResult.transaction) {
        expect(optimizationResult.transaction.gasLimit).toBeDefined();
        expect(optimizationResult.transaction.maxFeePerGas).toBeDefined();
      }
      
      // Step 4: Check analytics recording
      const stats = gasEngine.getStats();
      expect(stats.performance.totalOptimizations).toBeGreaterThan(0);
    });
    
    test('should handle different trade sizes appropriately', async () => {
      const smallTrade = {
        tokenA: '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB',
        tokenB: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        amountIn: 1000,
        expectedProfit: 0.003
      };
      
      const largeTrade = {
        ...smallTrade,
        amountIn: 500000,
        expectedProfit: 0.03
      };
      
      const smallResult = await gasEngine.optimizeTransaction(smallTrade);
      const largeResult = await gasEngine.optimizeTransaction(largeTrade);
      
      // Small trades should use cost-minimizing strategies
      expect(smallResult.strategy).toBe('AGGRESSIVE_SAVINGS');
      
      // Large trades with good margins should use speed strategies
      expect(largeResult.strategy).toBe('SPEED_PRIORITIZED');
    });
  });
  
  describe('Error Handling', () => {
    test('should handle optimization failures gracefully', async () => {
      // Mock failure in gas manager
      gasEngine.gasManager.getOptimalGasParams = jest.fn(() => 
        Promise.reject(new Error('Network error'))
      );
      
      const arbitrageData = {
        tokenA: '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB',
        tokenB: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        amountIn: 10000
      };
      
      const result = await gasEngine.optimizeTransaction(arbitrageData);
      
      // Should fall back to safe defaults
      expect(result).toBeDefined();
      expect(result.fallbackUsed).toBe(true);
      expect(result.strategy).toBe('FALLBACK');
    });
  });
});

// Helper function to run gas optimization demo
async function runGasOptimizationDemo() {
  console.log('🚀 Gas Optimization Demo Starting...');
  
  // Mock setup (same as tests)
  const mockProvider = {
    getBlock: () => Promise.resolve({
      number: 18000000,
      timestamp: Math.floor(Date.now() / 1000),
      gasUsed: 15000000n,
      gasLimit: 30000000n
    }),
    getFeeData: () => Promise.resolve({
      gasPrice: 25000000000n,
      maxFeePerGas: 30000000000n,
      maxPriorityFeePerGas: 2000000000n
    }),
    getGasPrice: () => Promise.resolve(25000000000n),
    getBalance: () => Promise.resolve(500000000000000000n)
  };
  
  const mockWeb3Provider = {
    provider: mockProvider,
    wallet: { address: '0x1234567890123456789012345678901234567890' }
  };
  
  const mockContractManager = {
    addresses: { flashloanArbitrage: '0x1111111111111111111111111111111111111111' },
    estimateArbitrageGas: () => Promise.resolve({ gasLimit: '400000', estimated: true })
  };
  
  const gasEngine = new GasOptimizationEngine(mockWeb3Provider, mockContractManager);
  
  // Demo different optimization scenarios
  const scenarios = [
    {
      name: 'Small Low-Margin Trade',
      data: { amountIn: 1000, expectedProfit: 0.002 }
    },
    {
      name: 'Medium Balanced Trade',
      data: { amountIn: 25000, expectedProfit: 0.01 }
    },
    {
      name: 'Large High-Margin Trade',
      data: { amountIn: 100000, expectedProfit: 0.03 }
    }
  ];
  
  for (const scenario of scenarios) {
    console.log(`\n📊 Testing: ${scenario.name}`);
    
    const arbitrageData = {
      tokenA: '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB',
      tokenB: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      ...scenario.data
    };
    
    try {
      const result = await gasEngine.optimizeTransaction(arbitrageData);
      
      console.log(`  Strategy: ${result.strategy}`);
      console.log(`  Savings: ${result.savings.percentage.toFixed(1)}%`);
      console.log(`  Estimated Cost: $${result.savings.optimized.toFixed(2)}`);
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }
  
  // Show final statistics
  const stats = gasEngine.getStats();
  console.log('\n📈 Final Statistics:');
  console.log(`  Total Optimizations: ${stats.performance.totalOptimizations}`);
  console.log(`  Success Rate: ${(stats.performance.successRate * 100).toFixed(1)}%`);
  console.log(`  Average Savings: $${stats.performance.averageOptimization}`);
  
  console.log('\n✅ Gas Optimization Demo Completed!');
}

// Export for manual testing
module.exports = { runGasOptimizationDemo };