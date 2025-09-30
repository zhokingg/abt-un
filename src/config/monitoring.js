/**
 * Monitoring and Alerting Configuration
 * Centralized configuration for all monitoring components, external services,
 * and alerting channels with environment-based settings
 */

import dotenv from 'dotenv';
dotenv.config();

const monitoringConfig = {
  // Global monitoring settings
  global: {
    enableMonitoring: process.env.ENABLE_MONITORING !== 'false',
    enableAlerting: process.env.ENABLE_ALERTING !== 'false',
    enableDashboard: process.env.ENABLE_DASHBOARD !== 'false',
    
    // Monitoring intervals
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000, // 30 seconds
    metricsCollectionInterval: parseInt(process.env.METRICS_COLLECTION_INTERVAL) || 15000, // 15 seconds
    performanceAnalysisInterval: parseInt(process.env.PERFORMANCE_ANALYSIS_INTERVAL) || 60000, // 1 minute
    
    // Data retention
    metricsRetentionDays: parseInt(process.env.METRICS_RETENTION_DAYS) || 30,
    logsRetentionDays: parseInt(process.env.LOGS_RETENTION_DAYS) || 14,
    incidentRetentionDays: parseInt(process.env.INCIDENT_RETENTION_DAYS) || 90
  },
  
  // MetricsDashboard configuration
  metricsDashboard: {
    port: parseInt(process.env.DASHBOARD_PORT) || 3000,
    updateInterval: parseInt(process.env.DASHBOARD_UPDATE_INTERVAL) || 1000, // 1 second
    retentionPeriod: parseInt(process.env.DASHBOARD_RETENTION_PERIOD) || 24 * 60 * 60 * 1000, // 24 hours
    enableWebSocket: process.env.DASHBOARD_WEBSOCKET !== 'false',
    enableRestAPI: process.env.DASHBOARD_REST_API !== 'false',
    maxConcurrentUsers: parseInt(process.env.DASHBOARD_MAX_USERS) || 50
  },
  
  // AlertManager configuration
  alertManager: {
    // Rate limiting
    rateLimitWindow: parseInt(process.env.ALERT_RATE_LIMIT_WINDOW) || 60000, // 1 minute
    maxAlertsPerWindow: parseInt(process.env.ALERT_MAX_PER_WINDOW) || 50,
    
    // Throttling
    throttleEnabled: process.env.ALERT_THROTTLE_ENABLED !== 'false',
    throttleWindow: parseInt(process.env.ALERT_THROTTLE_WINDOW) || 30000, // 30 seconds
    maxDuplicateAlerts: parseInt(process.env.ALERT_MAX_DUPLICATES) || 3,
    
    // Discord integration
    enableDiscord: process.env.ENABLE_DISCORD_ALERTS === 'true',
    discordWebhook: process.env.DISCORD_WEBHOOK_URL,
    
    // Telegram integration
    enableTelegram: process.env.ENABLE_TELEGRAM_ALERTS === 'true',
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatIds: process.env.TELEGRAM_CHAT_IDS ? 
      process.env.TELEGRAM_CHAT_IDS.split(',').map(id => id.trim()) : [],
    
    // Email integration
    enableEmail: process.env.ENABLE_EMAIL_ALERTS === 'true',
    smtpConfig: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    },
    emailRecipients: process.env.EMAIL_RECIPIENTS ? 
      process.env.EMAIL_RECIPIENTS.split(',').map(email => email.trim()) : [],
    
    // Slack integration
    enableSlack: process.env.ENABLE_SLACK_ALERTS === 'true',
    slackWebhook: process.env.SLACK_WEBHOOK_URL,
    slackChannel: process.env.SLACK_CHANNEL || '#alerts',
    
    // SMS integration (Twilio)
    enableSMS: process.env.ENABLE_SMS_ALERTS === 'true',
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
    smsRecipients: process.env.SMS_RECIPIENTS ? 
      process.env.SMS_RECIPIENTS.split(',').map(num => num.trim()) : [],
    
    // Push notifications
    enablePush: process.env.ENABLE_PUSH_ALERTS === 'true',
    webPushConfig: {
      vapidKeys: {
        publicKey: process.env.VAPID_PUBLIC_KEY,
        privateKey: process.env.VAPID_PRIVATE_KEY
      },
      contact: process.env.VAPID_CONTACT || 'mailto:admin@example.com'
    },
    
    // Webhooks
    enableWebhooks: process.env.ENABLE_WEBHOOK_ALERTS === 'true',
    webhookEndpoints: process.env.WEBHOOK_ENDPOINTS ? 
      process.env.WEBHOOK_ENDPOINTS.split(',').map(url => ({
        url: url.trim(),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': process.env.WEBHOOK_AUTH_TOKEN ? 
            `Bearer ${process.env.WEBHOOK_AUTH_TOKEN}` : undefined
        }
      })) : []
  },
  
  // HealthMonitor configuration
  healthMonitor: {
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000, // 30 seconds
    dependencyCheckInterval: parseInt(process.env.DEPENDENCY_CHECK_INTERVAL) || 60000, // 1 minute
    performanceCheckInterval: parseInt(process.env.PERFORMANCE_CHECK_INTERVAL) || 15000, // 15 seconds
    
    // Thresholds
    uptimeThreshold: parseFloat(process.env.UPTIME_THRESHOLD) || 99.5, // 99.5%
    responseTimeThreshold: parseInt(process.env.RESPONSE_TIME_THRESHOLD) || 5000, // 5 seconds
    
    // Auto-recovery
    enableAutoRecovery: process.env.ENABLE_AUTO_RECOVERY !== 'false',
    maxRecoveryAttempts: parseInt(process.env.MAX_RECOVERY_ATTEMPTS) || 3,
    
    // Health score weights
    healthScoreWeights: {
      availability: parseFloat(process.env.HEALTH_WEIGHT_AVAILABILITY) || 0.3,
      performance: parseFloat(process.env.HEALTH_WEIGHT_PERFORMANCE) || 0.25,
      resources: parseFloat(process.env.HEALTH_WEIGHT_RESOURCES) || 0.2,
      dependencies: parseFloat(process.env.HEALTH_WEIGHT_DEPENDENCIES) || 0.15,
      errors: parseFloat(process.env.HEALTH_WEIGHT_ERRORS) || 0.1
    }
  },
  
  // PerformanceAnalyzer configuration
  performanceAnalyzer: {
    trackingInterval: parseInt(process.env.PERFORMANCE_TRACKING_INTERVAL) || 5000, // 5 seconds
    metricsRetention: parseInt(process.env.PERFORMANCE_METRICS_RETENTION) || 24 * 60 * 60 * 1000, // 24 hours
    
    // Performance targets
    performanceTargets: {
      rpcLatency: parseInt(process.env.TARGET_RPC_LATENCY) || 100, // 100ms
      executionTime: parseInt(process.env.TARGET_EXECUTION_TIME) || 30000, // 30 seconds
      memoryUsage: parseInt(process.env.TARGET_MEMORY_USAGE) || 512, // 512MB
      cpuUsage: parseInt(process.env.TARGET_CPU_USAGE) || 70, // 70%
      successRate: parseInt(process.env.TARGET_SUCCESS_RATE) || 95 // 95%
    },
    
    // Alert thresholds
    alertThresholds: {
      latencySpike: parseFloat(process.env.ALERT_LATENCY_SPIKE) || 5, // 5x normal
      memoryLeak: parseFloat(process.env.ALERT_MEMORY_LEAK) || 1.5, // 50% increase
      errorRateSpike: parseFloat(process.env.ALERT_ERROR_RATE_SPIKE) || 3 // 3x normal
    }
  },
  
  // LogAnalyzer configuration
  logAnalyzer: {
    logDirectory: process.env.LOG_DIRECTORY || './logs',
    logLevel: process.env.LOG_LEVEL || 'info',
    maxLogFiles: parseInt(process.env.MAX_LOG_FILES) || 20,
    maxLogSize: process.env.MAX_LOG_SIZE || '100m',
    compressionEnabled: process.env.LOG_COMPRESSION !== 'false',
    retentionDays: parseInt(process.env.LOG_RETENTION_DAYS) || 30,
    
    // Real-time streaming
    enableStreaming: process.env.LOG_STREAMING !== 'false',
    streamingPort: parseInt(process.env.LOG_STREAMING_PORT) || 3001,
    maxStreamingClients: parseInt(process.env.LOG_MAX_STREAMING_CLIENTS) || 10,
    
    // Analysis features
    patternRecognition: process.env.LOG_PATTERN_RECOGNITION !== 'false',
    anomalyDetection: process.env.LOG_ANOMALY_DETECTION !== 'false',
    errorClassification: process.env.LOG_ERROR_CLASSIFICATION !== 'false',
    performanceLogging: process.env.LOG_PERFORMANCE_LOGGING !== 'false',
    timingAnalysis: process.env.LOG_TIMING_ANALYSIS !== 'false',
    bottleneckDetection: process.env.LOG_BOTTLENECK_DETECTION !== 'false'
  },
  
  // InfrastructureMonitor configuration
  infrastructureMonitor: {
    monitoringInterval: parseInt(process.env.INFRA_MONITORING_INTERVAL) || 15000, // 15 seconds
    networkCheckInterval: parseInt(process.env.INFRA_NETWORK_CHECK_INTERVAL) || 30000, // 30 seconds
    resourceCheckInterval: parseInt(process.env.INFRA_RESOURCE_CHECK_INTERVAL) || 10000, // 10 seconds
    rpcHealthCheckInterval: parseInt(process.env.INFRA_RPC_CHECK_INTERVAL) || 20000, // 20 seconds
    
    // Thresholds
    latencyThreshold: parseInt(process.env.INFRA_LATENCY_THRESHOLD) || 1000, // 1 second
    bandwidthThreshold: parseInt(process.env.INFRA_BANDWIDTH_THRESHOLD) || 80, // 80%
    cpuThreshold: parseInt(process.env.INFRA_CPU_THRESHOLD) || 85, // 85%
    memoryThreshold: parseInt(process.env.INFRA_MEMORY_THRESHOLD) || 90, // 90%
    diskThreshold: parseInt(process.env.INFRA_DISK_THRESHOLD) || 85, // 85%
    
    // Rate limiting
    rpcRateLimit: parseInt(process.env.INFRA_RPC_RATE_LIMIT) || 100, // per minute
    apiRateLimit: parseInt(process.env.INFRA_API_RATE_LIMIT) || 200, // per minute
    
    // Auto-optimization
    enableAutoOptimization: process.env.INFRA_AUTO_OPTIMIZATION !== 'false'
  },
  
  // IncidentManager configuration
  incidentManager: {
    detectionInterval: parseInt(process.env.INCIDENT_DETECTION_INTERVAL) || 30000, // 30 seconds
    anomalyThreshold: parseFloat(process.env.INCIDENT_ANOMALY_THRESHOLD) || 3, // 3 standard deviations
    cascadeTimeout: parseInt(process.env.INCIDENT_CASCADE_TIMEOUT) || 300000, // 5 minutes
    
    // Response settings
    enableAutoResponse: process.env.INCIDENT_AUTO_RESPONSE !== 'false',
    enableFailover: process.env.INCIDENT_FAILOVER !== 'false',
    enableSelfHealing: process.env.INCIDENT_SELF_HEALING !== 'false',
    
    // Escalation
    escalationLevels: ['low', 'medium', 'high', 'critical'],
    escalationTimeout: parseInt(process.env.INCIDENT_ESCALATION_TIMEOUT) || 600000, // 10 minutes
    maxEscalationLevel: process.env.INCIDENT_MAX_ESCALATION || 'critical',
    
    // Recovery
    recoveryValidationTimeout: parseInt(process.env.INCIDENT_RECOVERY_TIMEOUT) || 120000, // 2 minutes
    maxRecoveryAttempts: parseInt(process.env.INCIDENT_MAX_RECOVERY_ATTEMPTS) || 3
  },
  
  // DashboardAPI configuration
  dashboardAPI: {
    port: parseInt(process.env.DASHBOARD_API_PORT) || 3000,
    host: process.env.DASHBOARD_API_HOST || '0.0.0.0',
    
    // Authentication
    enableAuth: process.env.DASHBOARD_AUTH !== 'false',
    authMethod: process.env.DASHBOARD_AUTH_METHOD || 'token',
    authTokens: process.env.DASHBOARD_AUTH_TOKENS ? 
      new Set(process.env.DASHBOARD_AUTH_TOKENS.split(',').map(token => token.trim())) : 
      new Set(['dashboard-token-123']),
    sessionTimeout: parseInt(process.env.DASHBOARD_SESSION_TIMEOUT) || 24 * 60 * 60 * 1000, // 24 hours
    
    // API settings
    enableCORS: process.env.DASHBOARD_CORS !== 'false',
    enableRateLimit: process.env.DASHBOARD_RATE_LIMIT !== 'false',
    rateLimit: {
      windowMs: parseInt(process.env.DASHBOARD_RATE_WINDOW) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.DASHBOARD_RATE_MAX) || 100 // 100 requests per window
    },
    
    // Real-time features
    enableWebSocket: process.env.DASHBOARD_WEBSOCKET !== 'false',
    webSocketPath: process.env.DASHBOARD_WEBSOCKET_PATH || '/ws',
    maxConnections: parseInt(process.env.DASHBOARD_MAX_CONNECTIONS) || 100,
    
    // Caching
    enableCaching: process.env.DASHBOARD_CACHING !== 'false',
    cacheTimeout: parseInt(process.env.DASHBOARD_CACHE_TIMEOUT) || 30000, // 30 seconds
    
    // Features
    enableMobileAPI: process.env.DASHBOARD_MOBILE_API !== 'false',
    enableExport: process.env.DASHBOARD_EXPORT !== 'false',
    enableAlertManagement: process.env.DASHBOARD_ALERT_MANAGEMENT !== 'false',
    enableConfiguration: process.env.DASHBOARD_CONFIGURATION !== 'false'
  },
  
  // External service configurations
  externalServices: {
    // RPC Provider endpoints
    rpcProviders: [
      {
        name: 'Infura Mainnet',
        url: process.env.INFURA_MAINNET_URL || 'https://mainnet.infura.io/v3/',
        apiKey: process.env.INFURA_API_KEY,
        priority: 1,
        rateLimit: 100000 // per day
      },
      {
        name: 'Alchemy Mainnet',
        url: process.env.ALCHEMY_MAINNET_URL || 'https://eth-mainnet.alchemyapi.io/v2/',
        apiKey: process.env.ALCHEMY_API_KEY,
        priority: 2,
        rateLimit: 300000 // per day
      },
      {
        name: 'Cloudflare Ethereum',
        url: process.env.CLOUDFLARE_ETH_URL || 'https://cloudflare-eth.com',
        priority: 3,
        rateLimit: 100000 // per day
      },
      {
        name: 'QuickNode',
        url: process.env.QUICKNODE_URL,
        apiKey: process.env.QUICKNODE_API_KEY,
        priority: 4,
        rateLimit: 500000 // per day
      }
    ].filter(provider => provider.url), // Filter out undefined URLs
    
    // API endpoints for rate limiting monitoring
    apiEndpoints: [
      {
        name: 'CoinGecko',
        baseUrl: 'https://api.coingecko.com/api/v3',
        rateLimit: 50, // per minute
        apiKey: process.env.COINGECKO_API_KEY
      },
      {
        name: 'Etherscan',
        baseUrl: 'https://api.etherscan.io/api',
        rateLimit: 5, // per second
        apiKey: process.env.ETHERSCAN_API_KEY
      },
      {
        name: 'DexScreener',
        baseUrl: 'https://api.dexscreener.com/latest',
        rateLimit: 300, // per minute
        apiKey: process.env.DEXSCREENER_API_KEY
      }
    ],
    
    // WebSocket endpoints
    websocketEndpoints: [
      {
        name: 'Mempool.space',
        url: 'wss://mempool.space/api/v1/ws',
        enabled: process.env.ENABLE_MEMPOOL_WS !== 'false'
      },
      {
        name: 'Flashbots Relay',
        url: 'wss://relay.flashbots.net',
        enabled: process.env.ENABLE_FLASHBOTS_WS !== 'false'
      },
      {
        name: 'Uniswap Graph',
        url: 'wss://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
        enabled: process.env.ENABLE_UNISWAP_WS !== 'false'
      }
    ]
  },
  
  // Database configuration for metrics storage
  database: {
    // Time-series database (if using InfluxDB or TimescaleDB)
    timeSeries: {
      type: process.env.TIMESERIES_DB_TYPE || 'memory', // 'influxdb', 'timescaledb', 'memory'
      host: process.env.TIMESERIES_DB_HOST || 'localhost',
      port: parseInt(process.env.TIMESERIES_DB_PORT) || 8086,
      database: process.env.TIMESERIES_DB_NAME || 'arbitrage_metrics',
      username: process.env.TIMESERIES_DB_USER,
      password: process.env.TIMESERIES_DB_PASS,
      retentionPolicy: process.env.TIMESERIES_RETENTION || '30d'
    },
    
    // Redis for caching and pub/sub
    redis: {
      enabled: process.env.ENABLE_REDIS === 'true',
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB) || 0,
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'arbitrage:monitoring:'
    }
  },
  
  // Security configuration
  security: {
    // API key encryption
    encryptionKey: process.env.ENCRYPTION_KEY,
    
    // Rate limiting per IP
    ipRateLimit: {
      windowMs: parseInt(process.env.IP_RATE_WINDOW) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.IP_RATE_MAX) || 1000 // requests per window
    },
    
    // Audit logging
    auditLogging: {
      enabled: process.env.AUDIT_LOGGING !== 'false',
      logLevel: process.env.AUDIT_LOG_LEVEL || 'info',
      includeRequestBody: process.env.AUDIT_INCLUDE_BODY === 'true',
      includeResponseBody: process.env.AUDIT_INCLUDE_RESPONSE === 'true'
    }
  }
};

// Validation function to check required configurations
export function validateMonitoringConfig() {
  const errors = [];
  
  // Check for required Discord configuration if enabled
  if (monitoringConfig.alertManager.enableDiscord && !monitoringConfig.alertManager.discordWebhook) {
    errors.push('Discord alerts enabled but DISCORD_WEBHOOK_URL not provided');
  }
  
  // Check for required Telegram configuration if enabled
  if (monitoringConfig.alertManager.enableTelegram) {
    if (!monitoringConfig.alertManager.telegramBotToken) {
      errors.push('Telegram alerts enabled but TELEGRAM_BOT_TOKEN not provided');
    }
    if (monitoringConfig.alertManager.telegramChatIds.length === 0) {
      errors.push('Telegram alerts enabled but TELEGRAM_CHAT_IDS not provided');
    }
  }
  
  // Check for required Email configuration if enabled
  if (monitoringConfig.alertManager.enableEmail) {
    if (!monitoringConfig.alertManager.smtpConfig.host) {
      errors.push('Email alerts enabled but SMTP_HOST not provided');
    }
    if (monitoringConfig.alertManager.emailRecipients.length === 0) {
      errors.push('Email alerts enabled but EMAIL_RECIPIENTS not provided');
    }
  }
  
  // Check for required SMS configuration if enabled
  if (monitoringConfig.alertManager.enableSMS) {
    if (!monitoringConfig.alertManager.twilioAccountSid) {
      errors.push('SMS alerts enabled but TWILIO_ACCOUNT_SID not provided');
    }
    if (!monitoringConfig.alertManager.twilioAuthToken) {
      errors.push('SMS alerts enabled but TWILIO_AUTH_TOKEN not provided');
    }
    if (monitoringConfig.alertManager.smsRecipients.length === 0) {
      errors.push('SMS alerts enabled but SMS_RECIPIENTS not provided');
    }
  }
  
  // Check for at least one RPC provider
  if (monitoringConfig.externalServices.rpcProviders.length === 0) {
    errors.push('No RPC providers configured');
  }
  
  if (errors.length > 0) {
    console.warn('⚠️ Monitoring configuration warnings:');
    errors.forEach(error => console.warn(`   - ${error}`));
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Helper function to get environment-specific configuration
export function getEnvironmentConfig() {
  const env = process.env.NODE_ENV || 'development';
  
  const envOverrides = {
    development: {
      global: {
        healthCheckInterval: 60000, // 1 minute in dev
        metricsCollectionInterval: 30000, // 30 seconds in dev
      },
      metricsDashboard: {
        updateInterval: 5000, // 5 seconds in dev
      },
      alertManager: {
        rateLimitWindow: 300000, // 5 minutes in dev
        maxAlertsPerWindow: 20,
      }
    },
    
    test: {
      global: {
        enableMonitoring: false,
        enableAlerting: false,
      },
      alertManager: {
        enableDiscord: false,
        enableTelegram: false,
        enableEmail: false,
        enableSMS: false,
      }
    },
    
    production: {
      global: {
        healthCheckInterval: 30000, // 30 seconds in prod
        metricsCollectionInterval: 15000, // 15 seconds in prod
      },
      alertManager: {
        rateLimitWindow: 60000, // 1 minute in prod
        maxAlertsPerWindow: 100,
      },
      security: {
        auditLogging: {
          enabled: true,
          logLevel: 'warn'
        }
      }
    }
  };
  
  // Deep merge environment overrides
  return deepMerge(monitoringConfig, envOverrides[env] || {});
}

// Deep merge utility function
function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

export default monitoringConfig;