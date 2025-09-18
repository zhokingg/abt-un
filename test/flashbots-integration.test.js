const FlashbotsService = require('../src/services/FlashbotsService');
const EnhancedRpcProvider = require('../src/providers/enhancedRpcProvider');
const EnhancedTransactionBuilder = require('../src/services/enhancedTransactionBuilder');
const config = require('../src/config/config');

/**
 * Flashbots Integration Tests
 * Tests the MEV protection functionality
 */
describe('Flashbots Integration', () => {
  let flashbotsService;
  let enhancedProvider;
  let mockWeb3Provider;
  
  beforeEach(() => {
    // Mock Web3Provider for testing
    mockWeb3Provider = {
      provider: {
        getNetwork: () => Promise.resolve({ name: 'mainnet', chainId: 1 }),
        getBlockNumber: () => Promise.resolve(18000000),
        estimateGas: () => Promise.resolve(300000),
        getFeeData: () => Promise.resolve({
          maxFeePerGas: '30000000000', // 30 gwei
          maxPriorityFeePerGas: '2000000000' // 2 gwei
        })
      },
      wallet: {
        address: '0x1234567890123456789012345678901234567890'
      },
      connected: true
    };
  });
  
  test('FlashbotsService initializes correctly', () => {
    flashbotsService = new FlashbotsService(mockWeb3Provider);
    
    expect(flashbotsService).toBeDefined();
    expect(flashbotsService.config).toBeDefined();
    expect(flashbotsService.config.enabled).toBeDefined();
    expect(flashbotsService.initialized).toBe(false);
  });
  
  test('shouldUsePrivateMempool returns correct routing decision', () => {
    flashbotsService = new FlashbotsService(mockWeb3Provider);
    flashbotsService.initialized = true;
    flashbotsService.config.enabled = true;
    
    // High-value opportunity should use private mempool
    const highValueResult = flashbotsService.shouldUsePrivateMempool({}, 100);
    expect(highValueResult).toBe(true);
    
    // Low-value opportunity should use public mempool
    const lowValueResult = flashbotsService.shouldUsePrivateMempool({}, 25);
    expect(lowValueResult).toBe(false);
  });
  
  test('calculateMevProtectionFee calculates fees correctly', () => {
    flashbotsService = new FlashbotsService(mockWeb3Provider);
    
    const baseFee = BigInt('30000000000'); // 30 gwei
    const gasUsed = 300000;
    
    const fees = flashbotsService.calculateMevProtectionFee(baseFee, gasUsed);
    
    expect(fees.totalFee).toBeDefined();
    expect(fees.priorityFeePerGas).toBeDefined();
    expect(fees.maxFeePerGas).toBeDefined();
    expect(fees.totalFeePerGas).toBeDefined();
  });
  
  test('EnhancedRpcProvider initializes routing strategy', () => {
    enhancedProvider = new EnhancedRpcProvider();
    
    expect(enhancedProvider.routingStrategy).toBeDefined();
    expect(enhancedProvider.routingStrategy.highValue).toBe('flashbots');
    expect(enhancedProvider.routingStrategy.lowValue).toBe('public');
    expect(enhancedProvider.routingStrategy.fallback).toBe('public');
  });
  
  test('Transaction routing logic works correctly', () => {
    enhancedProvider = new EnhancedRpcProvider();
    enhancedProvider.flashbotsEnabled = true;
    enhancedProvider.flashbotsService = {
      isReady: () => true,
      shouldUsePrivateMempool: (data, profit) => profit >= 50
    };
    
    // High-value transaction should route to Flashbots
    const highValueRouting = enhancedProvider.shouldRouteToFlashbots(100, {});
    expect(highValueRouting).toBe(true);
    
    // Low-value transaction should route to public mempool
    const lowValueRouting = enhancedProvider.shouldRouteToFlashbots(25, {});
    expect(lowValueRouting).toBe(false);
  });
  
  test('EnhancedTransactionBuilder has Flashbots enabled', () => {
    const mockFlashloanService = {};
    const mockContractManager = {};
    
    const builder = new EnhancedTransactionBuilder(
      mockWeb3Provider,
      mockFlashloanService,
      mockContractManager
    );
    
    expect(builder.mevProtection.flashbotsEnabled).toBe(true);
  });
  
  test('Bundle priority calculation works correctly', () => {
    const mockFlashloanService = {};
    const mockContractManager = {};
    
    const builder = new EnhancedTransactionBuilder(
      mockWeb3Provider,
      mockFlashloanService,
      mockContractManager
    );
    
    // High-profit opportunity should get ultra priority
    const highPriorityResult = builder.calculateBundlePriority({}, 150, { congestion: 'MEDIUM' });
    expect(highPriorityResult.priority).toBe('ultra');
    expect(highPriorityResult.multiplier).toBeGreaterThan(1.5);
    
    // Medium-profit opportunity should get high priority
    const mediumPriorityResult = builder.calculateBundlePriority({}, 75, { congestion: 'LOW' });
    expect(mediumPriorityResult.priority).toBe('high');
    
    // Low-profit opportunity should get medium priority
    const lowPriorityResult = builder.calculateBundlePriority({}, 35, { congestion: 'LOW' });
    expect(lowPriorityResult.priority).toBe('medium');
  });
  
  test('Flashbots MEV fees calculation is accurate', () => {
    const mockFlashloanService = {};
    const mockContractManager = {};
    
    const builder = new EnhancedTransactionBuilder(
      mockWeb3Provider,
      mockFlashloanService,
      mockContractManager
    );
    
    const baseFee = BigInt('30000000000'); // 30 gwei
    const gasEstimate = 300000;
    const profitUSD = 100;
    
    const fees = builder.calculateFlashbotsMevFees(baseFee, gasEstimate, profitUSD);
    
    expect(fees.maxFeePerGas).toBeDefined();
    expect(fees.maxPriorityFeePerGas).toBeDefined();
    expect(fees.totalFee).toBeDefined();
    expect(fees.priorityFeeGwei).toBeGreaterThanOrEqual(5); // High-value should get at least 5 gwei priority
  });
});

// Mock console.log to avoid test output noise
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};