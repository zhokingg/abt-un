/**
 * Staging Environment Configuration Preset
 */

export default {
  // Network Configuration - Production-like but safe
  CHAIN_ID: 1,
  DRY_RUN: true, // Dry run in staging for safety
  
  // Trading Configuration - Production-like values
  MIN_PROFIT_THRESHOLD: 0.3, // Lower than production for testing
  MAX_TRADE_AMOUNT: 1000, // Lower than production
  SLIPPAGE_TOLERANCE: 0.2, // Slightly more tolerant than production
  
  // Monitoring Configuration
  PRICE_CHECK_INTERVAL: 4000, // 4 seconds
  LOG_LEVEL: 'info',
  
  // Performance Configuration - Production-like but relaxed
  PERFORMANCE_TARGETS: {
    rpcLatency: 200, // 200ms
    executionTime: 30000, // 30s
    memoryUsage: 768, // 768MB
    cpuUsage: 80, // 80%
    successRate: 90 // 90%
  },
  
  // Risk Management - Conservative but realistic
  RISK_LIMITS: {
    maxDailyLoss: 500, // $500
    maxTradeAmount: 1000, // $1000
    maxPositionSize: 0.2, // 20%
    maxDrawdown: 0.25, // 25%
    emergencyStopLoss: 0.05, // 5%
    maxConsecutiveLosses: 5,
    cooldownPeriod: 180000 // 3 minutes
  },
  
  // Gas Optimization - Moderate optimization
  GAS_OPTIMIZATION: {
    enabled: true,
    
    gasPool: {
      minReserveETH: 0.1, // 0.1 ETH
      targetReserveETH: 0.5, // 0.5 ETH
      autoReplenish: true,
      lowThresholdPercent: 30
    },
    
    strategies: {
      default: 'BALANCED_OPTIMIZATION'
    },
    
    mlPrediction: {
      enabled: true,
      modelConfidenceThreshold: 0.7,
      maxHistorySize: 1000,
      predictionCacheTimeMs: 20000 // 20 seconds
    },
    
    targets: {
      savingsPercent: 30, // 30% savings target
      maxGasCostPercent: 25, // Max 25% of profit on gas
      optimizationTimeoutMs: 5000 // 5 seconds
    },
    
    batchProcessing: {
      enabled: true,
      maxBatchSize: 5,
      batchTimeoutMs: 8000, // 8 seconds
      minBatchSavings: 20 // 20% minimum savings
    }
  },
  
  // Flashbots Configuration - Enabled but conservative
  FLASHBOTS: {
    enabled: true,
    profitThresholdUSD: 75, // $75 minimum
    maxBaseFeeGwei: 150, // 150 gwei max
    priorityFeeGwei: 3, // 3 gwei priority fee
    maxRetries: 3,
    timeoutMs: 25000, // 25 seconds
    fallbackToPublic: true
  },
  
  // Monitoring Configuration - Comprehensive monitoring
  MONITORING: {
    logLevel: 'info',
    enableFileLogging: true,
    enableMetrics: true,
    metricsInterval: 20000, // 20s
    healthCheckInterval: 45000, // 45s
    logRetentionDays: 30
  },
  
  // Alerting Configuration - Moderate alerting
  ALERTING: {
    enableDiscord: true,
    enableTelegram: false,
    enableEmail: true,
    enableSMS: false,
    enableSlack: true,
    priorityThreshold: 'medium',
    rateLimitWindow: 180000, // 3 minutes
    maxAlertsPerWindow: 10,
    cooldownPeriod: 60000 // 1 minute
  },
  
  // Backtesting Configuration
  BACKTESTING: {
    initialCapital: 10000, // $10k
    simulationSpeed: 2, // 2x speed
    dataRetentionMonths: 6, // 6 months
    monteCarloRuns: 1000
  },
  
  // External Services - Staging environment
  EXTERNAL_SERVICES: {
    redis: {
      url: process.env.REDIS_URL || 'redis://staging-redis:6379',
      maxRetries: 3,
      retryDelayOnFailover: 150
    },
    
    prometheus: {
      enabled: true,
      port: 9090,
      endpoint: '/staging-metrics'
    },
    
    grafana: {
      enabled: true,
      url: process.env.GRAFANA_URL || 'http://staging-grafana:3000',
      apiKey: process.env.GRAFANA_API_KEY || ''
    },
    
    bullQueue: {
      enabled: true,
      concurrency: 5,
      maxRetries: 2
    }
  },
  
  // Security Configuration - Production-like
  SECURITY: {
    enableEncryption: true,
    enableAuditLogging: true,
    enableRateLimiting: true,
    enableAccessControl: true,
    maxRequestsPerMinute: 500,
    enableIPWhitelist: false, // More open in staging
    requireTLS: true
  },
  
  // Staging-specific features
  STAGING: {
    enablePerformanceProfiling: true,
    enableLoadTesting: true,
    enableEndToEndTesting: true,
    enableIntegrationTesting: true,
    enableStressTesting: true,
    enableDataValidation: true,
    enableMockServices: false, // Use real services in staging
    enableFeatureToggling: true,
    enableA11yTesting: true,
    enableSecurityScanning: true
  },
  
  // Feature flags for staging testing
  FEATURE_FLAGS: {
    enableNewArbitrageAlgorithm: true,
    enableAdvancedRiskManagement: true,
    enableMachineLearningPredictions: true,
    enableCrossChainArbitrage: false, // Disabled for safety
    enableHighFrequencyTrading: false,
    enableExperimentalFeatures: true,
    enableBetaFeatures: true,
    enableDebugMode: true
  },
  
  // Testing and validation configuration
  VALIDATION: {
    enableConfigValidation: true,
    enablePerformanceValidation: true,
    enableSecurityValidation: true,
    enableFunctionalValidation: true,
    enableRegressionTesting: true,
    enableUserAcceptanceTesting: true,
    enableDataIntegrityChecks: true,
    enableComplianceChecks: true
  }
};