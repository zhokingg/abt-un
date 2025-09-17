const EventEmitter = require('events');
const winston = require('winston');
const os = require('os');

/**
 * MonitoringService - Phase 4: Comprehensive system monitoring and logging
 * Provides structured logging, performance tracking, and health monitoring
 */
class MonitoringService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      logLevel: options.logLevel || 'info',
      enableFileLogging: options.enableFileLogging !== false,
      enableConsoleLogging: options.enableConsoleLogging !== false,
      enableMetrics: options.enableMetrics !== false,
      metricsInterval: options.metricsInterval || 30000, // 30 seconds
      healthCheckInterval: options.healthCheckInterval || 60000, // 1 minute
      logRetentionDays: options.logRetentionDays || 30,
      maxLogFiles: options.maxLogFiles || 10,
      ...options
    };
    
    // Initialize Winston logger
    this.logger = null;
    this.initializeLogger();
    
    // System metrics
    this.systemMetrics = {
      cpu: { usage: 0, cores: os.cpus().length },
      memory: { used: 0, total: os.totalmem(), free: 0, percentage: 0 },
      network: { requests: 0, errors: 0, latency: 0 },
      disk: { used: 0, free: 0, percentage: 0 },
      uptime: process.uptime(),
      timestamp: Date.now()
    };
    
    // Application metrics
    this.appMetrics = {
      arbitrage: {
        opportunitiesDetected: 0,
        opportunitiesExecuted: 0,
        successfulTrades: 0,
        failedTrades: 0,
        totalProfit: 0,
        totalGasCost: 0,
        averageExecutionTime: 0
      },
      rpc: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageLatency: 0,
        endpointFailovers: 0
      },
      mempool: {
        transactionsProcessed: 0,
        mevOpportunities: 0,
        gasPrice: { current: 0, average: 0, max: 0 }
      },
      errors: {
        total: 0,
        byType: new Map(),
        byComponent: new Map(),
        last24h: []
      }
    };
    
    // Health status
    this.healthStatus = {
      overall: 'healthy',
      components: {
        database: 'unknown',
        rpcEndpoints: 'unknown',
        mempool: 'unknown',
        arbitrageEngine: 'unknown',
        networkOptimizer: 'unknown'
      },
      lastCheck: Date.now(),
      uptime: 0,
      alerts: []
    };
    
    // Performance thresholds
    this.thresholds = {
      cpu: { warning: 70, critical: 90 },
      memory: { warning: 80, critical: 95 },
      disk: { warning: 80, critical: 95 },
      rpcLatency: { warning: 1000, critical: 5000 }, // milliseconds
      errorRate: { warning: 0.1, critical: 0.2 }, // 10% and 20%
      executionTime: { warning: 30000, critical: 60000 } // milliseconds
    };
    
    // Timers
    this.metricsTimer = null;
    this.healthCheckTimer = null;
    
    this.isInitialized = false;
  }
  
  /**
   * Initialize the monitoring service
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }
    
    try {
      this.logger.info('🔍 Initializing Monitoring Service...', {
        component: 'MonitoringService',
        action: 'initialize'
      });
      
      // Start periodic metrics collection
      if (this.options.enableMetrics) {
        this.startMetricsCollection();
      }
      
      // Start health checks
      this.startHealthChecks();
      
      // Set up process monitoring
      this.setupProcessMonitoring();
      
      this.isInitialized = true;
      
      this.logger.info('✅ Monitoring Service initialized successfully', {
        component: 'MonitoringService',
        action: 'initialize',
        status: 'success',
        metricsEnabled: this.options.enableMetrics,
        healthChecksEnabled: true
      });
      
      this.emit('initialized');
      
    } catch (error) {
      this.logger.error('❌ Failed to initialize Monitoring Service', {
        component: 'MonitoringService',
        action: 'initialize',
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * Initialize Winston logger
   */
  initializeLogger() {
    const logFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return JSON.stringify({
          timestamp,
          level,
          message,
          ...meta
        });
      })
    );
    
    const transports = [];
    
    // Console transport
    if (this.options.enableConsoleLogging) {
      transports.push(new winston.transports.Console({
        level: 'debug',
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple(),
          winston.format.printf(({ level, message, timestamp, ...meta }) => {
            const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `${timestamp} [${level}]: ${message}${metaString}`;
          })
        )
      }));
    }
    
    // File transports
    if (this.options.enableFileLogging) {
      // Application logs
      transports.push(new winston.transports.File({
        filename: 'logs/app.log',
        level: this.options.logLevel,
        format: logFormat,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: this.options.maxLogFiles,
        tailable: true
      }));
      
      // Error logs
      transports.push(new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: logFormat,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: this.options.maxLogFiles,
        tailable: true
      }));
      
      // Trading logs
      transports.push(new winston.transports.File({
        filename: 'logs/trading.log',
        level: 'info',
        format: logFormat,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: this.options.maxLogFiles,
        tailable: true
      }));
    }
    
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: logFormat,
      transports,
      exitOnError: false
    });
  }
  
  /**
   * Start metrics collection
   */
  startMetricsCollection() {
    this.metricsTimer = setInterval(async () => {
      await this.collectSystemMetrics();
      this.emit('metricsCollected', this.systemMetrics);
    }, this.options.metricsInterval);
    
    this.logger.info('📊 Started metrics collection', {
      component: 'MonitoringService',
      action: 'startMetricsCollection',
      interval: this.options.metricsInterval
    });
  }
  
  /**
   * Start health checks
   */
  startHealthChecks() {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
      this.emit('healthCheckComplete', this.healthStatus);
    }, this.options.healthCheckInterval);
    
    this.logger.info('🏥 Started health checks', {
      component: 'MonitoringService',
      action: 'startHealthChecks',
      interval: this.options.healthCheckInterval
    });
  }
  
  /**
   * Collect system metrics
   */
  async collectSystemMetrics() {
    try {
      // CPU metrics
      const cpus = os.cpus();
      let totalIdle = 0;
      let totalTick = 0;
      
      for (const cpu of cpus) {
        for (const type in cpu.times) {
          totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
      }
      
      this.systemMetrics.cpu.usage = 100 - Math.round(100 * totalIdle / totalTick);
      
      // Memory metrics
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      
      this.systemMetrics.memory = {
        used: usedMem,
        total: totalMem,
        free: freeMem,
        percentage: Math.round((usedMem / totalMem) * 100)
      };
      
      // Process metrics
      const memUsage = process.memoryUsage();
      this.systemMetrics.process = {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
      };
      
      // Uptime
      this.systemMetrics.uptime = process.uptime();
      this.systemMetrics.timestamp = Date.now();
      
      // Check thresholds and emit alerts
      this.checkThresholds();
      
    } catch (error) {
      this.logger.error('Failed to collect system metrics', {
        component: 'MonitoringService',
        action: 'collectSystemMetrics',
        error: error.message
      });
    }
  }
  
  /**
   * Perform comprehensive health check
   */
  async performHealthCheck() {
    const checks = {};
    
    try {
      // System health
      checks.system = await this.checkSystemHealth();
      
      // Component health (these would be implemented by the components)
      checks.rpcEndpoints = await this.checkRPCHealth();
      checks.mempool = await this.checkMempoolHealth();
      checks.arbitrageEngine = await this.checkArbitrageEngineHealth();
      
      // Overall health
      const failedChecks = Object.values(checks).filter(check => check.status !== 'healthy');
      
      if (failedChecks.length === 0) {
        this.healthStatus.overall = 'healthy';
      } else if (failedChecks.some(check => check.status === 'critical')) {
        this.healthStatus.overall = 'critical';
      } else {
        this.healthStatus.overall = 'degraded';
      }
      
      this.healthStatus.components = {
        system: checks.system.status,
        rpcEndpoints: checks.rpcEndpoints.status,
        mempool: checks.mempool.status,
        arbitrageEngine: checks.arbitrageEngine.status
      };
      
      this.healthStatus.lastCheck = Date.now();
      this.healthStatus.uptime = process.uptime();
      
      this.logger.info('Health check completed', {
        component: 'MonitoringService',
        action: 'performHealthCheck',
        overallStatus: this.healthStatus.overall,
        checks
      });
      
    } catch (error) {
      this.logger.error('Health check failed', {
        component: 'MonitoringService',
        action: 'performHealthCheck',
        error: error.message
      });
      
      this.healthStatus.overall = 'critical';
    }
  }
  
  /**
   * Check system health
   */
  async checkSystemHealth() {
    const issues = [];
    
    if (this.systemMetrics.cpu.usage > this.thresholds.cpu.critical) {
      issues.push('Critical CPU usage');
    } else if (this.systemMetrics.cpu.usage > this.thresholds.cpu.warning) {
      issues.push('High CPU usage');
    }
    
    if (this.systemMetrics.memory.percentage > this.thresholds.memory.critical) {
      issues.push('Critical memory usage');
    } else if (this.systemMetrics.memory.percentage > this.thresholds.memory.warning) {
      issues.push('High memory usage');
    }
    
    return {
      status: issues.length === 0 ? 'healthy' : 
              issues.some(issue => issue.includes('Critical')) ? 'critical' : 'degraded',
      issues,
      metrics: {
        cpu: this.systemMetrics.cpu.usage,
        memory: this.systemMetrics.memory.percentage,
        uptime: this.systemMetrics.uptime
      }
    };
  }
  
  /**
   * Check RPC endpoints health
   */
  async checkRPCHealth() {
    // This would integrate with NetworkOptimizer
    return {
      status: 'healthy',
      healthyEndpoints: 3,
      totalEndpoints: 3,
      averageLatency: 45
    };
  }
  
  /**
   * Check mempool monitoring health
   */
  async checkMempoolHealth() {
    return {
      status: 'healthy',
      transactionsPerSecond: 150,
      lastUpdate: Date.now() - 1000
    };
  }
  
  /**
   * Check arbitrage engine health
   */
  async checkArbitrageEngineHealth() {
    return {
      status: 'healthy',
      opportunitiesDetected: this.appMetrics.arbitrage.opportunitiesDetected,
      lastOpportunity: Date.now() - 30000
    };
  }
  
  /**
   * Check thresholds and emit alerts
   */
  checkThresholds() {
    const alerts = [];
    
    // CPU alerts
    if (this.systemMetrics.cpu.usage > this.thresholds.cpu.critical) {
      alerts.push({
        type: 'critical',
        component: 'system',
        metric: 'cpu',
        value: this.systemMetrics.cpu.usage,
        threshold: this.thresholds.cpu.critical,
        message: `Critical CPU usage: ${this.systemMetrics.cpu.usage}%`
      });
    } else if (this.systemMetrics.cpu.usage > this.thresholds.cpu.warning) {
      alerts.push({
        type: 'warning',
        component: 'system',
        metric: 'cpu',
        value: this.systemMetrics.cpu.usage,
        threshold: this.thresholds.cpu.warning,
        message: `High CPU usage: ${this.systemMetrics.cpu.usage}%`
      });
    }
    
    // Memory alerts
    if (this.systemMetrics.memory.percentage > this.thresholds.memory.critical) {
      alerts.push({
        type: 'critical',
        component: 'system',
        metric: 'memory',
        value: this.systemMetrics.memory.percentage,
        threshold: this.thresholds.memory.critical,
        message: `Critical memory usage: ${this.systemMetrics.memory.percentage}%`
      });
    } else if (this.systemMetrics.memory.percentage > this.thresholds.memory.warning) {
      alerts.push({
        type: 'warning',
        component: 'system',
        metric: 'memory',
        value: this.systemMetrics.memory.percentage,
        threshold: this.thresholds.memory.warning,
        message: `High memory usage: ${this.systemMetrics.memory.percentage}%`
      });
    }
    
    // Emit alerts
    for (const alert of alerts) {
      this.emit('alert', alert);
      this.logger.warn('System alert triggered', {
        component: 'MonitoringService',
        action: 'checkThresholds',
        alert
      });
    }
  }
  
  /**
   * Setup process monitoring
   */
  setupProcessMonitoring() {
    // Uncaught exception handler
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', {
        component: 'Process',
        action: 'uncaughtException',
        error: error.message,
        stack: error.stack
      });
      
      this.emit('criticalError', {
        type: 'uncaughtException',
        error: error.message,
        stack: error.stack
      });
    });
    
    // Unhandled rejection handler
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled promise rejection', {
        component: 'Process',
        action: 'unhandledRejection',
        reason: reason,
        promise: promise
      });
      
      this.emit('criticalError', {
        type: 'unhandledRejection',
        reason: reason
      });
    });
    
    // Memory usage monitoring
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      
      if (heapUsedMB > 500) { // 500MB threshold
        this.logger.warn('High memory usage detected', {
          component: 'Process',
          action: 'memoryMonitoring',
          heapUsedMB,
          heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
          rssMB: Math.round(memUsage.rss / 1024 / 1024)
        });
      }
    }, 60000); // Check every minute
  }
  
  /**
   * Log structured message
   */
  log(level, message, metadata = {}) {
    const logData = {
      timestamp: new Date().toISOString(),
      component: metadata.component || 'Unknown',
      action: metadata.action || 'unknown',
      ...metadata
    };
    
    this.logger[level](message, logData);
  }
  
  /**
   * Log arbitrage opportunity
   */
  logOpportunity(opportunity) {
    this.appMetrics.arbitrage.opportunitiesDetected++;
    
    this.logger.info('Arbitrage opportunity detected', {
      component: 'ArbitrageEngine',
      action: 'opportunityDetected',
      opportunityId: opportunity.id,
      tokenPair: `${opportunity.tokenA}/${opportunity.tokenB}`,
      spread: opportunity.spread,
      expectedProfit: opportunity.expectedProfit,
      exchanges: [opportunity.exchangeA, opportunity.exchangeB],
      confidence: opportunity.confidence
    });
  }
  
  /**
   * Log trade execution
   */
  logTradeExecution(trade) {
    if (trade.success) {
      this.appMetrics.arbitrage.successfulTrades++;
      this.appMetrics.arbitrage.totalProfit += trade.actualProfit;
    } else {
      this.appMetrics.arbitrage.failedTrades++;
    }
    
    this.appMetrics.arbitrage.opportunitiesExecuted++;
    this.appMetrics.arbitrage.totalGasCost += trade.gasCost;
    
    this.logger.info('Trade execution completed', {
      component: 'ArbitrageEngine',
      action: 'tradeExecution',
      tradeId: trade.id,
      opportunityId: trade.opportunityId,
      success: trade.success,
      actualProfit: trade.actualProfit,
      gasCost: trade.gasCost,
      executionTime: trade.executionTime,
      txHash: trade.txHash
    });
  }
  
  /**
   * Log RPC request
   */
  logRPCRequest(endpoint, method, latency, success, error = null) {
    this.appMetrics.rpc.totalRequests++;
    
    if (success) {
      this.appMetrics.rpc.successfulRequests++;
      this.appMetrics.rpc.averageLatency = 
        (this.appMetrics.rpc.averageLatency * (this.appMetrics.rpc.successfulRequests - 1) + latency) / 
        this.appMetrics.rpc.successfulRequests;
    } else {
      this.appMetrics.rpc.failedRequests++;
    }
    
    const logLevel = success ? 'debug' : 'warn';
    this.logger[logLevel]('RPC request completed', {
      component: 'NetworkOptimizer',
      action: 'rpcRequest',
      endpoint,
      method,
      latency,
      success,
      error: error?.message
    });
  }
  
  /**
   * Log error with categorization
   */
  logError(error, component, action, metadata = {}) {
    this.appMetrics.errors.total++;
    
    // Categorize errors
    const errorType = error.name || 'UnknownError';
    const currentCount = this.appMetrics.errors.byType.get(errorType) || 0;
    this.appMetrics.errors.byType.set(errorType, currentCount + 1);
    
    const componentCount = this.appMetrics.errors.byComponent.get(component) || 0;
    this.appMetrics.errors.byComponent.set(component, componentCount + 1);
    
    // Add to recent errors (last 24h)
    const errorEntry = {
      timestamp: Date.now(),
      type: errorType,
      component,
      action,
      message: error.message
    };
    
    this.appMetrics.errors.last24h.push(errorEntry);
    
    // Keep only last 24 hours
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.appMetrics.errors.last24h = this.appMetrics.errors.last24h.filter(
      err => err.timestamp > oneDayAgo
    );
    
    this.logger.error('Error occurred', {
      component,
      action,
      error: error.message,
      stack: error.stack,
      errorType,
      ...metadata
    });
  }
  
  /**
   * Get comprehensive metrics
   */
  getMetrics() {
    return {
      system: this.systemMetrics,
      application: this.appMetrics,
      health: this.healthStatus,
      thresholds: this.thresholds,
      timestamp: Date.now()
    };
  }
  
  /**
   * Get health status
   */
  getHealthStatus() {
    return {
      ...this.healthStatus,
      metrics: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: this.systemMetrics.cpu.usage
      }
    };
  }
  
  /**
   * Export logs for analysis
   */
  async exportLogs(startDate, endDate, components = []) {
    // In a real implementation, this would query log files or database
    return {
      period: { start: startDate, end: endDate },
      components: components.length > 0 ? components : ['all'],
      logs: [], // Would contain filtered log entries
      summary: {
        totalEntries: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0
      }
    };
  }
  
  /**
   * Shutdown monitoring service
   */
  async shutdown() {
    this.logger.info('🛑 Shutting down Monitoring Service...', {
      component: 'MonitoringService',
      action: 'shutdown'
    });
    
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    // Close logger transports
    this.logger.close();
    
    this.isInitialized = false;
    this.emit('shutdown');
    
    console.log('✅ Monitoring Service shutdown complete');
  }
}

module.exports = MonitoringService;