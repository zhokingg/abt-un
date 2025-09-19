require('dotenv').config();

const config = {
  // Network Configuration
  RPC_URL: process.env.RPC_URL || 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY',
  CHAIN_ID: parseInt(process.env.CHAIN_ID) || 1,
  
  // Redis Configuration
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // Uniswap Contract Addresses (Mainnet)
  UNISWAP_V2_FACTORY: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
  UNISWAP_V2_ROUTER: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  UNISWAP_V3_FACTORY: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  UNISWAP_V3_QUOTER: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
  
  // Trading Configuration
  MIN_PROFIT_THRESHOLD: parseFloat(process.env.MIN_PROFIT_THRESHOLD) || 0.5, // 0.5%
  MAX_TRADE_AMOUNT: parseFloat(process.env.MAX_TRADE_AMOUNT) || 1000, // $1000
  SLIPPAGE_TOLERANCE: parseFloat(process.env.SLIPPAGE_TOLERANCE) || 0.1, // 0.1%
  
  // Token Addresses (Mainnet)
  TOKENS: {
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    USDC: '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F'
  },
  
  // Monitoring Configuration
  PRICE_CHECK_INTERVAL: parseInt(process.env.PRICE_CHECK_INTERVAL) || 5000, // 5 seconds
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  
  // API Configuration
  COINGECKO_API_KEY: process.env.COINGECKO_API_KEY || '',
  
  // Safety Configuration
  DRY_RUN: process.env.DRY_RUN === 'true' || true, // Default to dry run
  PRIVATE_KEY: process.env.PRIVATE_KEY || '',
  
  // Flashbots Configuration
  FLASHBOTS: {
    enabled: process.env.FLASHBOTS_ENABLED === 'true' || false,
    relayUrl: process.env.FLASHBOTS_RELAY_URL || 'https://relay.flashbots.net',
    signerPrivateKey: process.env.FLASHBOTS_SIGNER_PRIVATE_KEY || process.env.PRIVATE_KEY || '',
    profitThresholdUSD: parseFloat(process.env.FLASHBOTS_PROFIT_THRESHOLD) || 50, // $50 minimum for private mempool
    maxBaseFeeGwei: parseFloat(process.env.FLASHBOTS_MAX_BASE_FEE) || 100, // 100 gwei max
    priorityFeeGwei: parseFloat(process.env.FLASHBOTS_PRIORITY_FEE) || 2, // 2 gwei priority fee
    maxRetries: parseInt(process.env.FLASHBOTS_MAX_RETRIES) || 3,
    timeoutMs: parseInt(process.env.FLASHBOTS_TIMEOUT) || 30000, // 30 seconds
    fallbackToPublic: process.env.FLASHBOTS_FALLBACK_PUBLIC !== 'false' // true by default
  },
  
  // Gas Optimization Configuration
  GAS_OPTIMIZATION: {
    enabled: process.env.GAS_OPTIMIZATION_ENABLED !== 'false', // Enabled by default
    
    // Gas pool management
    gasPool: {
      minReserveETH: parseFloat(process.env.GAS_POOL_MIN_RESERVE) || 0.1, // 0.1 ETH
      targetReserveETH: parseFloat(process.env.GAS_POOL_TARGET_RESERVE) || 0.5, // 0.5 ETH
      autoReplenish: process.env.GAS_POOL_AUTO_REPLENISH !== 'false', // Enabled by default
      lowThresholdPercent: parseFloat(process.env.GAS_POOL_LOW_THRESHOLD) || 30 // 30%
    },
    
    // Gas strategies
    strategies: {
      default: process.env.GAS_STRATEGY_DEFAULT || 'BALANCED_OPTIMIZATION',
      aggressiveSavings: {
        maxGasPriceGwei: parseFloat(process.env.GAS_AGGRESSIVE_MAX_PRICE) || 50,
        profitThreshold: parseFloat(process.env.GAS_AGGRESSIVE_PROFIT_THRESHOLD) || 0.001 // 0.1%
      },
      speedPrioritized: {
        maxGasPriceGwei: parseFloat(process.env.GAS_SPEED_MAX_PRICE) || 200,
        profitThreshold: parseFloat(process.env.GAS_SPEED_PROFIT_THRESHOLD) || 0.01 // 1%
      }
    },
    
    // ML gas prediction
    mlPrediction: {
      enabled: process.env.GAS_ML_PREDICTION_ENABLED !== 'false',
      modelConfidenceThreshold: parseFloat(process.env.GAS_ML_CONFIDENCE_THRESHOLD) || 0.7,
      maxHistorySize: parseInt(process.env.GAS_ML_MAX_HISTORY) || 1000,
      predictionCacheTimeMs: parseInt(process.env.GAS_ML_CACHE_TIME) || 30000 // 30 seconds
    },
    
    // Gas optimization targets
    targets: {
      savingsPercent: parseFloat(process.env.GAS_SAVINGS_TARGET) || 30, // 30% savings target
      maxGasCostPercent: parseFloat(process.env.GAS_MAX_COST_PERCENT) || 30, // Max 30% of profit on gas
      optimizationTimeoutMs: parseInt(process.env.GAS_OPTIMIZATION_TIMEOUT) || 5000 // 5 seconds
    },
    
    // Batch processing
    batchProcessing: {
      enabled: process.env.GAS_BATCH_PROCESSING_ENABLED === 'true',
      maxBatchSize: parseInt(process.env.GAS_MAX_BATCH_SIZE) || 5,
      batchTimeoutMs: parseInt(process.env.GAS_BATCH_TIMEOUT) || 10000, // 10 seconds
      minBatchSavings: parseFloat(process.env.GAS_MIN_BATCH_SAVINGS) || 15 // 15% minimum savings
    },
    
    // Analytics and monitoring
    analytics: {
      enabled: process.env.GAS_ANALYTICS_ENABLED !== 'false',
      retentionDays: parseInt(process.env.GAS_ANALYTICS_RETENTION) || 30,
      reportingInterval: parseInt(process.env.GAS_ANALYTICS_REPORTING_INTERVAL) || 3600000, // 1 hour
      alertOnLowEfficiency: process.env.GAS_ALERT_LOW_EFFICIENCY !== 'false',
      efficiencyThreshold: parseFloat(process.env.GAS_EFFICIENCY_THRESHOLD) || 20 // 20% minimum efficiency
    }
  },
  
  // Development
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Phase 4: Performance & Safety Configuration
  PHASE4: {
    // Network Optimization
    RPC_ENDPOINTS: [
      {
        url: process.env.RPC_URL_PRIMARY || process.env.RPC_URL || 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY',
        region: 'primary',
        priority: 1
      },
      {
        url: process.env.RPC_URL_SECONDARY || '',
        region: 'secondary',
        priority: 2
      },
      {
        url: process.env.RPC_URL_TERTIARY || '',
        region: 'tertiary',
        priority: 3
      }
    ].filter(endpoint => endpoint.url && !endpoint.url.includes('YOUR_INFURA_KEY')),
    
    // Performance Targets
    PERFORMANCE_TARGETS: {
      rpcLatency: parseInt(process.env.RPC_LATENCY_TARGET) || 100, // 100ms
      executionTime: parseInt(process.env.EXECUTION_TIME_TARGET) || 30000, // 30s
      memoryUsage: parseInt(process.env.MEMORY_USAGE_TARGET) || 512, // 512MB
      cpuUsage: parseInt(process.env.CPU_USAGE_TARGET) || 70, // 70%
      successRate: parseFloat(process.env.SUCCESS_RATE_TARGET) || 95 // 95%
    },
    
    // Risk Management
    RISK_LIMITS: {
      maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS) || 1000, // $1000
      maxTradeAmount: parseFloat(process.env.MAX_TRADE_AMOUNT) || 1000, // $1000
      maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE) || 0.1, // 10%
      maxDrawdown: parseFloat(process.env.MAX_DRAWDOWN) || 0.2, // 20%
      emergencyStopLoss: parseFloat(process.env.EMERGENCY_STOP_LOSS) || 0.05, // 5%
      maxConsecutiveLosses: parseInt(process.env.MAX_CONSECUTIVE_LOSSES) || 5,
      cooldownPeriod: parseInt(process.env.COOLDOWN_PERIOD) || 300000 // 5 minutes
    },
    
    // Monitoring Configuration
    MONITORING: {
      logLevel: process.env.LOG_LEVEL || 'info',
      enableFileLogging: process.env.ENABLE_FILE_LOGGING !== 'false',
      enableMetrics: process.env.ENABLE_METRICS !== 'false',
      metricsInterval: parseInt(process.env.METRICS_INTERVAL) || 30000, // 30s
      healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 60000, // 1 minute
      logRetentionDays: parseInt(process.env.LOG_RETENTION_DAYS) || 30
    },
    
    // Alerting Configuration
    ALERTING: {
      enableDiscord: process.env.ENABLE_DISCORD_ALERTS === 'true',
      enableTelegram: process.env.ENABLE_TELEGRAM_ALERTS === 'true',
      enableEmail: process.env.ENABLE_EMAIL_ALERTS === 'true',
      enableSMS: process.env.ENABLE_SMS_ALERTS === 'true',
      enableSlack: process.env.ENABLE_SLACK_ALERTS === 'true',
      priorityThreshold: process.env.ALERT_PRIORITY_THRESHOLD || 'medium',
      rateLimitWindow: parseInt(process.env.ALERT_RATE_LIMIT_WINDOW) || 300000, // 5 minutes
      maxAlertsPerWindow: parseInt(process.env.MAX_ALERTS_PER_WINDOW) || 10,
      cooldownPeriod: parseInt(process.env.ALERT_COOLDOWN_PERIOD) || 60000 // 1 minute
    },
    
    // Backtesting Configuration
    BACKTESTING: {
      initialCapital: parseFloat(process.env.BACKTEST_INITIAL_CAPITAL) || 10000, // $10k
      simulationSpeed: parseFloat(process.env.BACKTEST_SIMULATION_SPEED) || 1, // 1x
      dataRetentionMonths: parseInt(process.env.BACKTEST_DATA_RETENTION) || 6, // 6 months
      monteCarloRuns: parseInt(process.env.MONTE_CARLO_RUNS) || 1000
    },
    
    // External Services
    EXTERNAL_SERVICES: {
      // Redis for caching and session management
      redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        maxRetries: parseInt(process.env.REDIS_MAX_RETRIES) || 3,
        retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY) || 100
      },
      
      // Prometheus for metrics collection
      prometheus: {
        enabled: process.env.ENABLE_PROMETHEUS === 'true',
        port: parseInt(process.env.PROMETHEUS_PORT) || 9090,
        endpoint: process.env.PROMETHEUS_ENDPOINT || '/metrics'
      },
      
      // Grafana for monitoring dashboards
      grafana: {
        enabled: process.env.ENABLE_GRAFANA === 'true',
        url: process.env.GRAFANA_URL || 'http://localhost:3000',
        apiKey: process.env.GRAFANA_API_KEY || ''
      },
      
      // Bull Queue for job processing
      bullQueue: {
        enabled: process.env.ENABLE_BULL_QUEUE === 'true',
        concurrency: parseInt(process.env.BULL_QUEUE_CONCURRENCY) || 5,
        maxRetries: parseInt(process.env.BULL_QUEUE_MAX_RETRIES) || 3
      }
    }
  }
};

// Validation
if (!config.RPC_URL.includes('YOUR_INFURA_KEY') && config.NODE_ENV === 'production') {
  console.log('✅ RPC URL configured');
} else if (config.NODE_ENV === 'production') {
  console.warn('⚠️  Warning: Using default RPC URL in production');
}

// Phase 4 validation
if (config.PHASE4.RPC_ENDPOINTS.length === 0) {
  console.warn('⚠️  Warning: No additional RPC endpoints configured for Phase 4');
}

if (config.NODE_ENV === 'production' && !config.PHASE4.EXTERNAL_SERVICES.redis.url.includes('localhost')) {
  console.log('✅ Production Redis configuration detected');
}

module.exports = config;