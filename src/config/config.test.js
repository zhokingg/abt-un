/**
 * Comprehensive tests for the configuration management system
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { 
  validateEnvironmentConfig, 
  validateNetworkConfig, 
  validateTokenConfig,
  validateRpcConnectivity,
  validateCompleteConfiguration 
} from './validator.js';
import { ConfigManager } from './ConfigManager.js';
import { NetworkManager } from './NetworkManager.js';
import networks, { 
  getNetworkByChainId, 
  getEnabledNetworks, 
  getMainnetNetworks,
  getTestnetNetworks,
  networkSupportsFeature,
  validateNetworkConfig as validateNetworkConfigUtil
} from './networks.js';
import tokens, {
  getToken,
  getTokenByAddress,
  getNetworkTokens,
  getStablecoins,
  getTradingPairs,
  getHighLiquidityPairs,
  getTokenRiskCategory,
  validateTokenPair,
  getOptimalArbitragePairs,
  isStablecoin,
  getTokenDecimals
} from './tokens.js';

// Mock ethers for testing
jest.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      getNetwork: jest.fn().mockResolvedValue({ chainId: 1n }),
      getBlockNumber: jest.fn().mockResolvedValue(18000000),
      getCode: jest.fn().mockResolvedValue('0x608060405234801561001057600080fd5b50')
    })),
    Wallet: jest.fn(),
    isAddress: jest.fn().mockReturnValue(true)
  }
}));

describe('Configuration Validator', () => {
  describe('validateEnvironmentConfig', () => {
    test('should validate valid environment configuration', () => {
      const config = {
        RPC_URL: 'https://mainnet.infura.io/v3/valid-key',
        PRIVATE_KEY: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        CHAIN_ID: 1,
        MIN_PROFIT_THRESHOLD: 0.5
      };

      const errors = validateEnvironmentConfig(config);
      expect(errors).toHaveLength(0);
    });

    test('should fail validation for invalid RPC URL', () => {
      const config = {
        RPC_URL: 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY',
        CHAIN_ID: 1,
        MIN_PROFIT_THRESHOLD: 0.5
      };

      const errors = validateEnvironmentConfig(config);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Invalid RPC URL');
    });

    test('should fail validation for unsupported chain ID', () => {
      const config = {
        RPC_URL: 'https://mainnet.infura.io/v3/valid-key',
        CHAIN_ID: 999999,
        MIN_PROFIT_THRESHOLD: 0.5
      };

      const errors = validateEnvironmentConfig(config);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(error => error.includes('Unsupported chain ID'))).toBe(true);
    });
  });

  describe('validateNetworkConfig', () => {
    test('should validate valid network configuration', () => {
      const networkConfig = {
        chainId: 1,
        name: 'Ethereum Mainnet',
        rpcUrls: ['https://mainnet.infura.io/v3/valid-key'],
        contracts: { uniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' },
        gasSettings: { standard: 21000 },
        enabled: true,
        isTestnet: false
      };

      const errors = validateNetworkConfig(networkConfig, 'ethereum');
      expect(errors).toHaveLength(0);
    });

    test('should fail validation for missing required fields', () => {
      const networkConfig = {
        chainId: 1,
        name: 'Ethereum Mainnet'
        // Missing rpcUrls, contracts, gasSettings, enabled, isTestnet
      };

      const errors = validateNetworkConfig(networkConfig, 'ethereum');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateTokenConfig', () => {
    test('should validate valid token configuration', () => {
      const tokenConfig = {
        address: '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        type: 'stablecoin'
      };

      const errors = validateTokenConfig(tokenConfig, 'USDC', 'ethereum');
      expect(errors).toHaveLength(0);
    });

    test('should fail validation for invalid token type', () => {
      const tokenConfig = {
        address: '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        type: 'invalid-type'
      };

      const errors = validateTokenConfig(tokenConfig, 'USDC', 'ethereum');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(error => error.includes('Invalid token type'))).toBe(true);
    });
  });

  describe('validateRpcConnectivity', () => {
    test('should validate RPC connectivity', async () => {
      const result = await validateRpcConnectivity(
        'https://mainnet.infura.io/v3/valid-key',
        1,
        5000
      );

      expect(result.isValid).toBe(true);
      expect(result.chainId).toBe(1);
    });
  });
});

describe('ConfigManager', () => {
  let configManager;

  beforeEach(() => {
    configManager = new ConfigManager({
      enableHotReload: false,
      enableValidation: false
    });
  });

  afterEach(() => {
    configManager.destroy();
  });

  test('should get and set configuration values', () => {
    configManager.set('test.value', 'hello world');
    const value = configManager.get('test.value');
    expect(value).toBe('hello world');
  });

  test('should handle nested configuration paths', () => {
    configManager.set('deep.nested.config.value', 42);
    const value = configManager.get('deep.nested.config.value');
    expect(value).toBe(42);
  });

  test('should return default values for missing keys', () => {
    const value = configManager.get('missing.key', 'default');
    expect(value).toBe('default');
  });

  test('should emit events on configuration changes', (done) => {
    configManager.on('configChanged', (event) => {
      expect(event.key).toBe('test.event');
      expect(event.value).toBe('test value');
      done();
    });

    configManager.set('test.event', 'test value');
  });

  test('should handle secure configuration', () => {
    const sensitiveData = { apiKey: 'secret-key', password: 'secure-password' };
    configManager.setSecure('secure.data', sensitiveData);
    
    const retrieved = configManager.getSecure('secure.data');
    expect(retrieved).toEqual(sensitiveData);
  });

  test('should generate configuration summary', () => {
    const summary = configManager.getSummary();
    expect(summary).toHaveProperty('version');
    expect(summary).toHaveProperty('environment');
    expect(summary).toHaveProperty('hotReloadEnabled');
  });
});

describe('NetworkManager', () => {
  let networkManager;

  beforeEach(() => {
    networkManager = new NetworkManager({
      enableHealthMonitoring: false
    });
  });

  afterEach(() => {
    networkManager.destroy();
  });

  test('should initialize network manager', async () => {
    await networkManager.initialize();
    expect(networkManager.providers.size).toBeGreaterThan(0);
  });

  test('should get best provider for a network', () => {
    networkManager.currentNetwork = 'ethereum';
    const provider = networkManager.getBestProvider();
    expect(provider).toBeDefined();
  });

  test('should switch networks', async () => {
    await networkManager.switchToNetwork('ethereum');
    expect(networkManager.currentNetwork).toBe('ethereum');
  });

  test('should get network statistics', () => {
    const stats = networkManager.getNetworkStats();
    expect(stats).toBeDefined();
    expect(typeof stats).toBe('object');
  });

  test('should get supported networks', () => {
    const supportedNetworks = networkManager.getSupportedNetworks();
    expect(Array.isArray(supportedNetworks)).toBe(true);
  });
});

describe('Networks Configuration', () => {
  test('should get network by chain ID', () => {
    const network = getNetworkByChainId(1);
    expect(network).toBeDefined();
    expect(network.chainId).toBe(1);
    expect(network.name).toBe('Ethereum Mainnet');
  });

  test('should get enabled networks', () => {
    const enabledNetworks = getEnabledNetworks();
    expect(typeof enabledNetworks).toBe('object');
  });

  test('should get mainnet networks', () => {
    const mainnets = getMainnetNetworks();
    expect(typeof mainnets).toBe('object');
    
    // All mainnets should have isTestnet: false
    Object.values(mainnets).forEach(network => {
      expect(network.isTestnet).toBe(false);
    });
  });

  test('should get testnet networks', () => {
    const testnets = getTestnetNetworks();
    expect(typeof testnets).toBe('object');
    
    // All testnets should have isTestnet: true
    Object.values(testnets).forEach(network => {
      expect(network.isTestnet).toBe(true);
    });
  });

  test('should check if network supports feature', () => {
    const supportsUniswapV3 = networkSupportsFeature('ethereum', 'uniswapV3');
    expect(supportsUniswapV3).toBe(true);
    
    const supportsNonexistentFeature = networkSupportsFeature('ethereum', 'nonexistent');
    expect(supportsNonexistentFeature).toBe(false);
  });

  test('should validate network configuration', () => {
    const result = validateNetworkConfigUtil('ethereum');
    expect(result.isValid).toBe(true);
  });
});

describe('Tokens Configuration', () => {
  test('should get token by symbol', () => {
    const token = getToken('WETH', 'ethereum');
    expect(token).toBeDefined();
    expect(token.symbol).toBe('WETH');
    expect(token.network).toBe('ethereum');
  });

  test('should get token by address', () => {
    const token = getTokenByAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 'ethereum');
    expect(token).toBeDefined();
    expect(token.symbol).toBe('WETH');
  });

  test('should get all tokens for a network', () => {
    const networkTokens = getNetworkTokens('ethereum');
    expect(Array.isArray(networkTokens)).toBe(true);
    expect(networkTokens.length).toBeGreaterThan(0);
  });

  test('should get stablecoins', () => {
    const stablecoins = getStablecoins('ethereum');
    expect(Array.isArray(stablecoins)).toBe(true);
    
    // All returned tokens should be stable
    stablecoins.forEach(token => {
      expect(token.isStable).toBe(true);
    });
  });

  test('should get trading pairs', () => {
    const pairs = getTradingPairs('ethereum');
    expect(Array.isArray(pairs)).toBe(true);
    expect(pairs.length).toBeGreaterThan(0);
  });

  test('should get high liquidity pairs', () => {
    const highLiquidityPairs = getHighLiquidityPairs('ethereum');
    expect(Array.isArray(highLiquidityPairs)).toBe(true);
    
    // All pairs should have high liquidity
    highLiquidityPairs.forEach(pair => {
      expect(pair.liquidity).toBe('high');
    });
  });

  test('should get token risk category', () => {
    const riskCategory = getTokenRiskCategory('WETH');
    expect(riskCategory).toBeDefined();
    expect(riskCategory.category).toBe('LOW');
  });

  test('should validate token pair', () => {
    const validation = validateTokenPair('WETH', 'USDC', 'ethereum');
    expect(validation.valid).toBe(true);
    expect(validation.tokenA).toBeDefined();
    expect(validation.tokenB).toBeDefined();
  });

  test('should get optimal arbitrage pairs', () => {
    const optimalPairs = getOptimalArbitragePairs('ethereum', 'MEDIUM');
    expect(Array.isArray(optimalPairs)).toBe(true);
  });

  test('should check if token is stablecoin', () => {
    expect(isStablecoin('USDC', 'ethereum')).toBe(true);
    expect(isStablecoin('WETH', 'ethereum')).toBe(false);
  });

  test('should get token decimals', () => {
    expect(getTokenDecimals('USDC', 'ethereum')).toBe(6);
    expect(getTokenDecimals('WETH', 'ethereum')).toBe(18);
  });

  test('should handle unknown tokens gracefully', () => {
    expect(() => getToken('UNKNOWN', 'ethereum')).toThrow();
    expect(getTokenDecimals('UNKNOWN', 'ethereum')).toBe(18); // Default
    expect(isStablecoin('UNKNOWN', 'ethereum')).toBe(false);
  });
});

describe('Integration Tests', () => {
  test('should integrate ConfigManager with network configuration', () => {
    const configManager = new ConfigManager({
      enableValidation: false,
      enableHotReload: false
    });

    const ethereumConfig = configManager.get('networks.ethereum');
    expect(ethereumConfig).toBeDefined();
    expect(ethereumConfig.chainId).toBe(1);

    configManager.destroy();
  });

  test('should integrate NetworkManager with token configuration', async () => {
    const networkManager = new NetworkManager({
      enableHealthMonitoring: false
    });

    await networkManager.initialize();
    
    // Test that we can get token information for supported networks
    const supportedNetworks = networkManager.getSupportedNetworks();
    supportedNetworks.forEach(network => {
      const networkTokens = getNetworkTokens(network.name);
      expect(Array.isArray(networkTokens)).toBe(true);
    });

    networkManager.destroy();
  });

  test('should validate complete configuration integration', async () => {
    const testConfig = {
      RPC_URL: 'https://mainnet.infura.io/v3/valid-key',
      CHAIN_ID: 1,
      MIN_PROFIT_THRESHOLD: 0.5,
      networks: networks,
      tokens: tokens
    };

    const validation = await validateCompleteConfiguration(testConfig);
    expect(validation).toBeDefined();
    expect(validation.isValid).toBe(true);
  });
});

describe('Error Handling', () => {
  test('should handle invalid network names gracefully', () => {
    expect(() => getNetworkTokens('invalid-network')).toThrow('Network invalid-network not supported');
  });

  test('should handle invalid token symbols gracefully', () => {
    expect(() => getToken('INVALID', 'ethereum')).toThrow('Token INVALID not found on ethereum');
  });

  test('should handle invalid token addresses gracefully', () => {
    expect(() => getTokenByAddress('0x0000000000000000000000000000000000000000', 'ethereum'))
      .toThrow('Token with address 0x0000000000000000000000000000000000000000 not found on ethereum');
  });

  test('should validate token pair with same tokens', () => {
    const validation = validateTokenPair('WETH', 'WETH', 'ethereum');
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('Cannot trade token with itself');
  });
});

describe('Performance Tests', () => {
  test('should handle large number of token lookups efficiently', () => {
    const startTime = Date.now();
    const iterations = 1000;

    for (let i = 0; i < iterations; i++) {
      getToken('WETH', 'ethereum');
      getToken('USDC', 'ethereum');
      getToken('USDT', 'ethereum');
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Should complete 3000 lookups in less than 100ms
    expect(duration).toBeLessThan(100);
  });

  test('should handle configuration changes efficiently', () => {
    const configManager = new ConfigManager({
      enableValidation: false,
      enableHotReload: false,
      enableCache: true
    });

    const startTime = Date.now();
    const iterations = 1000;

    for (let i = 0; i < iterations; i++) {
      configManager.set(`test.key.${i}`, `value-${i}`);
      configManager.get(`test.key.${i}`);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Should complete 2000 operations in less than 50ms
    expect(duration).toBeLessThan(50);

    configManager.destroy();
  });
});