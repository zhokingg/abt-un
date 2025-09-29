/**
 * Development Environment Configuration Preset
 */

export default {
  // Network Configuration
  CHAIN_ID: 1,
  DRY_RUN: true, // Always dry run in development
  
  // Trading Configuration
  MIN_PROFIT_THRESHOLD: 0.1, // Lower threshold for testing
  MAX_TRADE_AMOUNT: 100, // Lower amounts in development
  SLIPPAGE_TOLERANCE: 1.0, // Higher tolerance for testing
  
  // Monitoring Configuration
  PRICE_CHECK_INTERVAL: 10000, // 10 seconds - more frequent checks
  LOG_LEVEL: 'debug',
  
  // Performance Configuration
  PERFORMANCE_TARGETS: {
    rpcLatency: 500, // More relaxed in development
    executionTime: 60000, // 60s
    memoryUsage: 1024, // 1GB
    cpuUsage: 90, // 90%
    successRate: 80 // 80% (lower for testing)
  },
  
  // Risk Management - More relaxed for testing
  RISK_LIMITS: {
    maxDailyLoss: 10, // $10
    maxTradeAmount: 100, // $100
    maxPositionSize: 0.5, // 50% for testing
    maxDrawdown: 0.5, // 50%
    emergencyStopLoss: 0.1, // 10%
    maxConsecutiveLosses: 10,
    cooldownPeriod: 60000 // 1 minute
  },
  
  // Gas Optimization - Conservative in development
  GAS_OPTIMIZATION: {
    enabled: true,
    
    gasPool: {
      minReserveETH: 0.01, // 0.01 ETH
      targetReserveETH: 0.05, // 0.05 ETH
      autoReplenish: true,
      lowThresholdPercent: 20
    },
    
    strategies: {
      default: 'CONSERVATIVE'
    },
    
    targets: {
      savingsPercent: 20, // 20% savings target
      maxGasCostPercent: 50, // Max 50% of profit on gas
      optimizationTimeoutMs: 10000 // 10 seconds
    }
  },
  
  // Monitoring Configuration
  MONITORING: {
    logLevel: 'debug',
    enableFileLogging: true,
    enableMetrics: true,
    metricsInterval: 10000, // 10s
    healthCheckInterval: 30000, // 30s
    logRetentionDays: 7
  },
  
  // Alerting Configuration - Less aggressive in development
  ALERTING: {
    enableDiscord: false,
    enableTelegram: false,
    enableEmail: false,
    enableSMS: false,
    enableSlack: false,
    priorityThreshold: 'low',
    rateLimitWindow: 60000, // 1 minute
    maxAlertsPerWindow: 50,
    cooldownPeriod: 10000 // 10 seconds
  },
  
  // External Services
  EXTERNAL_SERVICES: {
    redis: {
      url: 'redis://localhost:6379',
      maxRetries: 1,
      retryDelayOnFailover: 100
    },
    
    prometheus: {
      enabled: true,
      port: 9091, // Different port to avoid conflicts
      endpoint: '/dev-metrics'
    },
    
    grafana: {
      enabled: false
    },
    
    bullQueue: {
      enabled: false, // Disabled in development
      concurrency: 1,
      maxRetries: 1
    }
  },
  
  // Development-specific features
  DEVELOPMENT: {
    enableHotReload: true,
    enableDebugMode: true,
    mockExternalServices: true,
    useTestTokens: true,
    simulateNetworkLatency: false,
    enableDetailedLogging: true,
    skipValidation: false,
    allowUnsafeOperations: true
  }
};