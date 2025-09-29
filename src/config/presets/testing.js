/**
 * Testing Environment Configuration Preset
 */

export default {
  // Network Configuration - Use testnets
  CHAIN_ID: 5, // Goerli testnet
  DRY_RUN: true, // Always dry run in testing
  
  // Trading Configuration - Conservative for testing
  MIN_PROFIT_THRESHOLD: 0.05, // Very low threshold for testing
  MAX_TRADE_AMOUNT: 10, // Very small amounts
  SLIPPAGE_TOLERANCE: 2.0, // High tolerance for testing
  
  // Monitoring Configuration
  PRICE_CHECK_INTERVAL: 5000, // 5 seconds
  LOG_LEVEL: 'debug',
  
  // Performance Configuration - Relaxed for testing
  PERFORMANCE_TARGETS: {
    rpcLatency: 1000, // 1 second
    executionTime: 120000, // 2 minutes
    memoryUsage: 2048, // 2GB
    cpuUsage: 95, // 95%
    successRate: 60 // 60% (very relaxed for testing)
  },
  
  // Risk Management - Very conservative
  RISK_LIMITS: {
    maxDailyLoss: 1, // $1
    maxTradeAmount: 10, // $10
    maxPositionSize: 1.0, // 100% for testing
    maxDrawdown: 1.0, // 100%
    emergencyStopLoss: 0.5, // 50%
    maxConsecutiveLosses: 100,
    cooldownPeriod: 1000 // 1 second
  },
  
  // Gas Optimization - Disabled or minimal
  GAS_OPTIMIZATION: {
    enabled: false, // Disabled in testing
    
    gasPool: {
      minReserveETH: 0.001, // 0.001 ETH
      targetReserveETH: 0.01, // 0.01 ETH
      autoReplenish: false,
      lowThresholdPercent: 10
    },
    
    strategies: {
      default: 'DISABLED'
    },
    
    targets: {
      savingsPercent: 0, // No savings required
      maxGasCostPercent: 100, // Allow 100% of profit on gas
      optimizationTimeoutMs: 1000 // 1 second
    }
  },
  
  // Flashbots Configuration - Disabled in testing
  FLASHBOTS: {
    enabled: false,
    profitThresholdUSD: 1000000, // Very high threshold to disable
    maxBaseFeeGwei: 1, // Very low to disable
    priorityFeeGwei: 0,
    maxRetries: 0,
    timeoutMs: 1000,
    fallbackToPublic: true
  },
  
  // Monitoring Configuration - Minimal
  MONITORING: {
    logLevel: 'debug',
    enableFileLogging: false, // Disabled to avoid file pollution
    enableMetrics: false,
    metricsInterval: 60000, // 1 minute
    healthCheckInterval: 10000, // 10s
    logRetentionDays: 1
  },
  
  // Alerting Configuration - Disabled
  ALERTING: {
    enableDiscord: false,
    enableTelegram: false,
    enableEmail: false,
    enableSMS: false,
    enableSlack: false,
    priorityThreshold: 'critical',
    rateLimitWindow: 1000, // 1 second
    maxAlertsPerWindow: 1000,
    cooldownPeriod: 0
  },
  
  // Backtesting Configuration - Fast testing
  BACKTESTING: {
    initialCapital: 1000, // $1k
    simulationSpeed: 100, // 100x speed
    dataRetentionMonths: 1, // 1 month
    monteCarloRuns: 10 // Minimal runs
  },
  
  // External Services - Mock or local
  EXTERNAL_SERVICES: {
    redis: {
      url: 'redis://localhost:6379',
      maxRetries: 0,
      retryDelayOnFailover: 0
    },
    
    prometheus: {
      enabled: false
    },
    
    grafana: {
      enabled: false
    },
    
    bullQueue: {
      enabled: false,
      concurrency: 1,
      maxRetries: 0
    }
  },
  
  // Testing-specific features
  TESTING: {
    enableMocking: true,
    enableFixtures: true,
    enableTimeTravel: true,
    enableStateReset: true,
    enableFastMode: true,
    skipNetworkCalls: true,
    useTestData: true,
    enableDebugOutput: true,
    disableRateLimiting: true,
    enableParallelExecution: true,
    maxTestDuration: 30000, // 30 seconds per test
    enableCoverage: true
  },
  
  // Network-specific overrides for testing
  NETWORKS: {
    ethereum: {
      enabled: false // Disable mainnet in testing
    },
    goerli: {
      enabled: true,
      rpcUrls: [
        'https://goerli.infura.io/v3/test-key',
        'https://rpc.ankr.com/eth_goerli'
      ]
    },
    sepolia: {
      enabled: true,
      rpcUrls: [
        'https://sepolia.infura.io/v3/test-key',
        'https://rpc.ankr.com/eth_sepolia'
      ]
    }
  },
  
  // Test data configuration
  TEST_DATA: {
    useFixedPrices: true,
    useFixedGasPrices: true,
    useFixedTimestamps: true,
    enableDeterministicRandom: true,
    seedValue: 12345,
    mockApiResponses: true,
    simulateNetworkErrors: false,
    simulateLatency: false
  }
};