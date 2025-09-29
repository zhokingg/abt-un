/**
 * Production Environment Configuration Preset
 */

export default {
  // Network Configuration
  CHAIN_ID: 1,
  DRY_RUN: false, // Live trading in production
  
  // Trading Configuration
  MIN_PROFIT_THRESHOLD: 0.5, // Higher threshold in production
  MAX_TRADE_AMOUNT: 10000, // Higher amounts in production
  SLIPPAGE_TOLERANCE: 0.1, // Tight tolerance in production
  
  // Monitoring Configuration
  PRICE_CHECK_INTERVAL: 3000, // 3 seconds - optimized for production
  LOG_LEVEL: 'info',
  
  // Performance Configuration - Strict requirements
  PERFORMANCE_TARGETS: {
    rpcLatency: 100, // 100ms
    executionTime: 15000, // 15s
    memoryUsage: 512, // 512MB
    cpuUsage: 70, // 70%
    successRate: 98 // 98%
  },
  
  // Risk Management - Strict limits
  RISK_LIMITS: {
    maxDailyLoss: 5000, // $5000
    maxTradeAmount: 10000, // $10000
    maxPositionSize: 0.1, // 10%
    maxDrawdown: 0.15, // 15%
    emergencyStopLoss: 0.03, // 3%
    maxConsecutiveLosses: 3,
    cooldownPeriod: 300000 // 5 minutes
  },
  
  // Gas Optimization - Aggressive optimization
  GAS_OPTIMIZATION: {
    enabled: true,
    
    gasPool: {
      minReserveETH: 0.5, // 0.5 ETH
      targetReserveETH: 2.0, // 2.0 ETH
      autoReplenish: true,
      lowThresholdPercent: 25
    },
    
    strategies: {
      default: 'AGGRESSIVE_OPTIMIZATION'
    },
    
    mlPrediction: {
      enabled: true,
      modelConfidenceThreshold: 0.8,
      maxHistorySize: 2000,
      predictionCacheTimeMs: 15000 // 15 seconds
    },
    
    targets: {
      savingsPercent: 40, // 40% savings target
      maxGasCostPercent: 20, // Max 20% of profit on gas
      optimizationTimeoutMs: 3000 // 3 seconds
    },
    
    batchProcessing: {
      enabled: true,
      maxBatchSize: 10,
      batchTimeoutMs: 5000, // 5 seconds
      minBatchSavings: 25 // 25% minimum savings
    }
  },
  
  // Flashbots Configuration - Enabled in production
  FLASHBOTS: {
    enabled: true,
    profitThresholdUSD: 100, // $100 minimum
    maxBaseFeeGwei: 200, // 200 gwei max
    priorityFeeGwei: 5, // 5 gwei priority fee
    maxRetries: 5,
    timeoutMs: 20000, // 20 seconds
    fallbackToPublic: true
  },
  
  // Monitoring Configuration - Comprehensive
  MONITORING: {
    logLevel: 'info',
    enableFileLogging: true,
    enableMetrics: true,
    metricsInterval: 30000, // 30s
    healthCheckInterval: 60000, // 1 minute
    logRetentionDays: 90
  },
  
  // Alerting Configuration - Full alerting
  ALERTING: {
    enableDiscord: true,
    enableTelegram: true,
    enableEmail: true,
    enableSMS: true,
    enableSlack: true,
    priorityThreshold: 'medium',
    rateLimitWindow: 300000, // 5 minutes
    maxAlertsPerWindow: 5,
    cooldownPeriod: 120000 // 2 minutes
  },
  
  // Backtesting Configuration
  BACKTESTING: {
    initialCapital: 100000, // $100k
    simulationSpeed: 1, // Real-time
    dataRetentionMonths: 12, // 1 year
    monteCarloRuns: 10000
  },
  
  // External Services - Production configuration
  EXTERNAL_SERVICES: {
    redis: {
      url: process.env.REDIS_URL || 'redis://redis-cluster:6379',
      maxRetries: 5,
      retryDelayOnFailover: 200
    },
    
    prometheus: {
      enabled: true,
      port: 9090,
      endpoint: '/metrics'
    },
    
    grafana: {
      enabled: true,
      url: process.env.GRAFANA_URL || 'http://grafana:3000',
      apiKey: process.env.GRAFANA_API_KEY || ''
    },
    
    bullQueue: {
      enabled: true,
      concurrency: 10,
      maxRetries: 3
    }
  },
  
  // Security Configuration
  SECURITY: {
    enableEncryption: true,
    enableAuditLogging: true,
    enableRateLimiting: true,
    enableAccessControl: true,
    maxRequestsPerMinute: 1000,
    enableIPWhitelist: true,
    requireTLS: true
  },
  
  // Production-specific features
  PRODUCTION: {
    enableCircuitBreaker: true,
    enableHealthChecks: true,
    enableGracefulShutdown: true,
    enableRequestTracing: true,
    enableErrorReporting: true,
    enablePerformanceMonitoring: true,
    enableAutomaticRecovery: true,
    enableLoadBalancing: true
  }
};