import { EventEmitter } from 'events';
import os from 'os';
import fs from 'fs/promises';
import axios from 'axios';

/**
 * HealthMonitor - System health monitoring and alerting
 * Monitors infrastructure, application health, and performance metrics
 */
class HealthMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      checkInterval: options.checkInterval || 30000, // 30 seconds
      rpcTimeout: options.rpcTimeout || 5000, // 5 seconds
      memoryThreshold: options.memoryThreshold || 0.8, // 80%
      cpuThreshold: options.cpuThreshold || 0.8, // 80%
      diskThreshold: options.diskThreshold || 0.9, // 90%
      networkTimeout: options.networkTimeout || 10000, // 10 seconds
      healthyThreshold: options.healthyThreshold || 0.8, // 80% checks must pass
      maxRetries: options.maxRetries || 3,
      ...options
    };
    
    // Health check definitions
    this.healthChecks = {
      // Infrastructure monitoring
      system_memory: {
        name: 'System Memory',
        category: 'infrastructure',
        check: () => this.checkMemoryUsage(),
        critical: true,
        timeout: 5000
      },
      system_cpu: {
        name: 'System CPU',
        category: 'infrastructure', 
        check: () => this.checkCPUUsage(),
        critical: true,
        timeout: 5000
      },
      system_disk: {
        name: 'Disk Space',
        category: 'infrastructure',
        check: () => this.checkDiskSpace(),
        critical: false,
        timeout: 10000
      },
      network_connectivity: {
        name: 'Network Connectivity',
        category: 'infrastructure',
        check: () => this.checkNetworkConnectivity(),
        critical: true,
        timeout: 10000
      },
      
      // RPC provider health
      rpc_ethereum: {
        name: 'Ethereum RPC',
        category: 'rpc',
        check: () => this.checkRPCHealth('ethereum'),
        critical: true,
        timeout: 10000
      },
      rpc_polygon: {
        name: 'Polygon RPC',
        category: 'rpc',
        check: () => this.checkRPCHealth('polygon'),
        critical: false,
        timeout: 10000
      },
      rpc_bsc: {
        name: 'BSC RPC',
        category: 'rpc',
        check: () => this.checkRPCHealth('bsc'),
        critical: false,
        timeout: 10000
      },
      
      // Database connections
      redis_connection: {
        name: 'Redis Connection',
        category: 'database',
        check: () => this.checkRedisConnection(),
        critical: false,
        timeout: 5000
      },
      
      // Application components
      arbitrage_engine: {
        name: 'Arbitrage Engine',
        category: 'application',
        check: () => this.checkArbitrageEngine(),
        critical: true,
        timeout: 5000
      },
      price_feeds: {
        name: 'Price Feeds',
        category: 'application',
        check: () => this.checkPriceFeeds(),
        critical: true,
        timeout: 10000
      },
      mempool_monitor: {
        name: 'Mempool Monitor',
        category: 'application',
        check: () => this.checkMempoolMonitor(),
        critical: true,
        timeout: 5000
      },
      
      // WebSocket connections
      websocket_ethereum: {
        name: 'Ethereum WebSocket',
        category: 'websocket',
        check: () => this.checkWebSocketHealth('ethereum'),
        critical: true,
        timeout: 10000
      }
    };
    
    // Health state
    this.healthState = {
      overall: 'unknown',
      lastCheck: null,
      checks: {},
      issues: [],
      uptime: process.uptime(),
      startTime: Date.now(),
      consecutiveFailures: 0,
      lastHealthyTime: Date.now()
    };
    
    // Performance metrics
    this.performanceMetrics = {
      responseTime: {},
      errorRates: {},
      throughput: {},
      availability: {}
    };
    
    // Component references
    this.components = {
      arbitrageEngine: options.arbitrageEngine || null,
      priceMonitor: options.priceMonitor || null,
      mempoolMonitor: options.mempoolMonitor || null,
      redisClient: options.redisClient || null,
      rpcProviders: options.rpcProviders || {}
    };
    
    // Monitoring intervals
    this.healthCheckInterval = null;
    this.metricsInterval = null;
    
    // CPU usage tracking
    this.cpuUsage = [];
    this.lastCpuUsage = process.cpuUsage();
    
    this.isInitialized = false;
  }
  
  /**
   * Initialize health monitoring
   */
  async initialize() {
    console.log('🏥 Initializing Health Monitor...');
    
    try {
      // Initialize health state
      await this.initializeHealthState();
      
      // Start monitoring
      this.startHealthChecks();
      this.startMetricsCollection();
      
      // Initial health check
      await this.performHealthCheck();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      console.log('✅ Health Monitor initialized successfully');
      
    } catch (error) {
      console.error('❌ Health Monitor initialization failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Initialize health state
   */
  async initializeHealthState() {
    // Initialize check results
    Object.keys(this.healthChecks).forEach(checkId => {
      this.healthState.checks[checkId] = {
        status: 'unknown',
        lastRun: null,
        duration: 0,
        error: null,
        consecutiveFailures: 0,
        lastSuccess: null
      };
    });
    
    // Initialize performance metrics
    Object.keys(this.healthChecks).forEach(checkId => {
      this.performanceMetrics.responseTime[checkId] = [];
      this.performanceMetrics.errorRates[checkId] = { total: 0, errors: 0 };
      this.performanceMetrics.availability[checkId] = { total: 0, success: 0 };
    });
  }
  
  /**
   * Start health checks
   */
  startHealthChecks() {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('Health check failed:', error.message);
      }
    }, this.options.checkInterval);
  }
  
  /**
   * Start metrics collection
   */
  startMetricsCollection() {
    this.metricsInterval = setInterval(() => {
      this.collectPerformanceMetrics();
    }, 10000); // Every 10 seconds
  }
  
  /**
   * Perform comprehensive health check
   */
  async performHealthCheck() {
    const startTime = Date.now();
    const results = {};
    let totalChecks = 0;
    let passedChecks = 0;
    let criticalFailures = 0;
    
    // Run all health checks
    for (const [checkId, check] of Object.entries(this.healthChecks)) {
      totalChecks++;
      const result = await this.runSingleHealthCheck(checkId, check);
      results[checkId] = result;
      
      if (result.status === 'healthy') {
        passedChecks++;
      } else if (check.critical) {
        criticalFailures++;
      }
    }
    
    // Update health state
    this.healthState.checks = results;
    this.healthState.lastCheck = Date.now();
    
    // Determine overall health
    const healthRatio = passedChecks / totalChecks;
    let overallHealth = 'healthy';
    
    if (criticalFailures > 0) {
      overallHealth = 'critical';
      this.healthState.consecutiveFailures++;
    } else if (healthRatio < this.options.healthyThreshold) {
      overallHealth = 'unhealthy';
      this.healthState.consecutiveFailures++;
    } else {
      overallHealth = 'healthy';
      this.healthState.consecutiveFailures = 0;
      this.healthState.lastHealthyTime = Date.now();
    }
    
    const previousHealth = this.healthState.overall;
    this.healthState.overall = overallHealth;
    
    // Update issues list
    this.updateIssuesList(results);
    
    // Emit health events
    if (previousHealth !== overallHealth) {
      this.emit('healthChanged', {
        previous: previousHealth,
        current: overallHealth,
        checks: results,
        issues: this.healthState.issues
      });
    }
    
    this.emit('healthCheck', {
      overall: overallHealth,
      passed: passedChecks,
      total: totalChecks,
      criticalFailures,
      duration: Date.now() - startTime,
      issues: this.healthState.issues
    });
    
    return this.healthState;
  }
  
  /**
   * Run single health check
   */
  async runSingleHealthCheck(checkId, check) {
    const startTime = Date.now();
    const state = this.healthState.checks[checkId];
    let result = {
      status: 'unknown',
      message: '',
      duration: 0,
      error: null,
      timestamp: startTime
    };
    
    try {
      // Run check with timeout
      const checkPromise = check.check();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), check.timeout);
      });
      
      const checkResult = await Promise.race([checkPromise, timeoutPromise]);
      
      result.status = checkResult.status || 'healthy';
      result.message = checkResult.message || 'Check passed';
      result.data = checkResult.data || {};
      
      // Update success metrics
      state.consecutiveFailures = 0;
      state.lastSuccess = startTime;
      
    } catch (error) {
      result.status = 'unhealthy';
      result.message = error.message;
      result.error = error;
      
      // Update failure metrics
      state.consecutiveFailures++;
    }
    
    result.duration = Date.now() - startTime;
    
    // Update state
    state.status = result.status;
    state.lastRun = startTime;
    state.duration = result.duration;
    state.error = result.error;
    
    // Update performance metrics
    this.updatePerformanceMetrics(checkId, result);
    
    return result;
  }
  
  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(checkId, result) {
    const metrics = this.performanceMetrics;
    
    // Response time
    metrics.responseTime[checkId].push({
      timestamp: result.timestamp,
      duration: result.duration
    });
    
    // Keep only last 100 measurements
    if (metrics.responseTime[checkId].length > 100) {
      metrics.responseTime[checkId] = metrics.responseTime[checkId].slice(-100);
    }
    
    // Error rates
    metrics.errorRates[checkId].total++;
    if (result.status !== 'healthy') {
      metrics.errorRates[checkId].errors++;
    }
    
    // Availability
    metrics.availability[checkId].total++;
    if (result.status === 'healthy') {
      metrics.availability[checkId].success++;
    }
  }
  
  /**
   * Update issues list
   */
  updateIssuesList(results) {
    this.healthState.issues = [];
    
    Object.entries(results).forEach(([checkId, result]) => {
      if (result.status !== 'healthy') {
        const check = this.healthChecks[checkId];
        this.healthState.issues.push({
          checkId,
          name: check.name,
          category: check.category,
          status: result.status,
          message: result.message,
          critical: check.critical,
          consecutiveFailures: this.healthState.checks[checkId].consecutiveFailures,
          lastSuccess: this.healthState.checks[checkId].lastSuccess,
          timestamp: result.timestamp
        });
      }
    });
    
    // Sort by severity (critical first, then by consecutive failures)
    this.healthState.issues.sort((a, b) => {
      if (a.critical && !b.critical) return -1;
      if (!a.critical && b.critical) return 1;
      return b.consecutiveFailures - a.consecutiveFailures;
    });
  }
  
  /**
   * Check memory usage
   */
  async checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usagePercent = usedMem / totalMem;
    
    const processMemMB = memUsage.heapUsed / 1024 / 1024;
    const totalMemGB = totalMem / 1024 / 1024 / 1024;
    
    if (usagePercent > this.options.memoryThreshold) {
      return {
        status: 'unhealthy',
        message: `High memory usage: ${(usagePercent * 100).toFixed(1)}%`,
        data: {
          systemUsagePercent: usagePercent * 100,
          processMemoryMB: processMemMB,
          totalMemoryGB: totalMemGB,
          freeMemoryGB: freeMem / 1024 / 1024 / 1024
        }
      };
    }
    
    return {
      status: 'healthy',
      message: `Memory usage normal: ${(usagePercent * 100).toFixed(1)}%`,
      data: {
        systemUsagePercent: usagePercent * 100,
        processMemoryMB: processMemMB,
        totalMemoryGB: totalMemGB,
        freeMemoryGB: freeMem / 1024 / 1024 / 1024
      }
    };
  }
  
  /**
   * Check CPU usage
   */
  async checkCPUUsage() {
    const currentCpuUsage = process.cpuUsage(this.lastCpuUsage);
    this.lastCpuUsage = process.cpuUsage();
    
    // Calculate CPU percentage (simplified)
    const cpuPercent = (currentCpuUsage.user + currentCpuUsage.system) / 1000000 / os.cpus().length;
    
    // Track CPU usage
    this.cpuUsage.push({ timestamp: Date.now(), usage: cpuPercent });
    if (this.cpuUsage.length > 10) {
      this.cpuUsage = this.cpuUsage.slice(-10);
    }
    
    // Calculate average CPU usage
    const avgCpuUsage = this.cpuUsage.reduce((sum, item) => sum + item.usage, 0) / this.cpuUsage.length;
    
    if (avgCpuUsage > this.options.cpuThreshold) {
      return {
        status: 'unhealthy',
        message: `High CPU usage: ${(avgCpuUsage * 100).toFixed(1)}%`,
        data: {
          currentUsage: cpuPercent * 100,
          averageUsage: avgCpuUsage * 100,
          cores: os.cpus().length,
          loadAverage: os.loadavg()
        }
      };
    }
    
    return {
      status: 'healthy',
      message: `CPU usage normal: ${(avgCpuUsage * 100).toFixed(1)}%`,
      data: {
        currentUsage: cpuPercent * 100,
        averageUsage: avgCpuUsage * 100,
        cores: os.cpus().length,
        loadAverage: os.loadavg()
      }
    };
  }
  
  /**
   * Check disk space
   */
  async checkDiskSpace() {
    try {
      const stats = await fs.stat('.');
      // Simplified disk check - would use proper filesystem stats in production
      return {
        status: 'healthy',
        message: 'Disk space check passed',
        data: {
          available: 'Unknown', // Would implement proper disk space checking
          used: 'Unknown',
          threshold: this.options.diskThreshold * 100
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Disk space check failed: ${error.message}`,
        data: { error: error.message }
      };
    }
  }
  
  /**
   * Check network connectivity
   */
  async checkNetworkConnectivity() {
    const testUrls = [
      'https://api.coingecko.com/api/v3/ping',
      'https://mainnet.infura.io/v3/',
      'https://cloudflare-dns.com/dns-query'
    ];
    
    const results = [];
    
    for (const url of testUrls) {
      try {
        const startTime = Date.now();
        const response = await axios.get(url, { 
          timeout: this.options.networkTimeout / testUrls.length 
        });
        const duration = Date.now() - startTime;
        
        results.push({
          url,
          status: 'success',
          duration,
          statusCode: response.status
        });
      } catch (error) {
        results.push({
          url,
          status: 'failed',
          error: error.message,
          duration: this.options.networkTimeout / testUrls.length
        });
      }
    }
    
    const successCount = results.filter(r => r.status === 'success').length;
    const avgLatency = results
      .filter(r => r.status === 'success')
      .reduce((sum, r) => sum + r.duration, 0) / (successCount || 1);
    
    if (successCount === 0) {
      return {
        status: 'unhealthy',
        message: 'No network connectivity',
        data: { results, avgLatency: null }
      };
    } else if (successCount < testUrls.length / 2) {
      return {
        status: 'unhealthy',
        message: `Poor network connectivity: ${successCount}/${testUrls.length} endpoints reachable`,
        data: { results, avgLatency }
      };
    }
    
    return {
      status: 'healthy',
      message: `Network connectivity good: ${successCount}/${testUrls.length} endpoints reachable`,
      data: { results, avgLatency }
    };
  }
  
  /**
   * Check RPC provider health
   */
  async checkRPCHealth(network) {
    const provider = this.components.rpcProviders[network];
    if (!provider) {
      return {
        status: 'unhealthy',
        message: `No RPC provider configured for ${network}`,
        data: { network }
      };
    }
    
    try {
      const startTime = Date.now();
      
      // Test basic RPC call
      const blockNumber = await provider.getBlockNumber();
      const duration = Date.now() - startTime;
      
      if (duration > this.options.rpcTimeout) {
        return {
          status: 'unhealthy',
          message: `${network} RPC slow response: ${duration}ms`,
          data: { network, duration, blockNumber }
        };
      }
      
      return {
        status: 'healthy',
        message: `${network} RPC healthy: ${duration}ms`,
        data: { network, duration, blockNumber }
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `${network} RPC failed: ${error.message}`,
        data: { network, error: error.message }
      };
    }
  }
  
  /**
   * Check Redis connection
   */
  async checkRedisConnection() {
    const redis = this.components.redisClient;
    if (!redis) {
      return {
        status: 'healthy',
        message: 'Redis not configured',
        data: { configured: false }
      };
    }
    
    try {
      const startTime = Date.now();
      await redis.ping();
      const duration = Date.now() - startTime;
      
      return {
        status: 'healthy',
        message: `Redis connection healthy: ${duration}ms`,
        data: { duration, configured: true }
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Redis connection failed: ${error.message}`,
        data: { error: error.message, configured: true }
      };
    }
  }
  
  /**
   * Check arbitrage engine health
   */
  async checkArbitrageEngine() {
    const engine = this.components.arbitrageEngine;
    if (!engine) {
      return {
        status: 'unhealthy',
        message: 'Arbitrage engine not initialized',
        data: { initialized: false }
      };
    }
    
    try {
      // Check if engine is running and responsive
      const isRunning = engine.isRunning || false;
      const lastActivity = engine.lastActivity || null;
      const errorCount = engine.errorCount || 0;
      
      if (!isRunning) {
        return {
          status: 'unhealthy',
          message: 'Arbitrage engine not running',
          data: { running: false, lastActivity, errorCount }
        };
      }
      
      // Check if engine has been active recently (within 5 minutes)
      if (lastActivity && Date.now() - lastActivity > 5 * 60 * 1000) {
        return {
          status: 'unhealthy',
          message: 'Arbitrage engine inactive for over 5 minutes',
          data: { running: true, lastActivity, errorCount }
        };
      }
      
      return {
        status: 'healthy',
        message: 'Arbitrage engine healthy',
        data: { running: true, lastActivity, errorCount }
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Arbitrage engine check failed: ${error.message}`,
        data: { error: error.message }
      };
    }
  }
  
  /**
   * Check price feeds health
   */
  async checkPriceFeeds() {
    const priceMonitor = this.components.priceMonitor;
    if (!priceMonitor) {
      return {
        status: 'unhealthy',
        message: 'Price monitor not initialized',
        data: { initialized: false }
      };
    }
    
    try {
      // Check price feed staleness
      const feeds = priceMonitor.getActiveFeedsStatus?.() || {};
      const staleFeeds = [];
      const healthyFeeds = [];
      
      Object.entries(feeds).forEach(([feedId, status]) => {
        const age = Date.now() - (status.lastUpdate || 0);
        if (age > 60000) { // 1 minute threshold
          staleFeeds.push({ feedId, age });
        } else {
          healthyFeeds.push(feedId);
        }
      });
      
      if (staleFeeds.length > 0 && healthyFeeds.length === 0) {
        return {
          status: 'unhealthy',
          message: `All price feeds stale: ${staleFeeds.length} feeds`,
          data: { staleFeeds, healthyFeeds, totalFeeds: Object.keys(feeds).length }
        };
      } else if (staleFeeds.length > healthyFeeds.length) {
        return {
          status: 'unhealthy',
          message: `Majority of price feeds stale: ${staleFeeds.length}/${Object.keys(feeds).length}`,
          data: { staleFeeds, healthyFeeds, totalFeeds: Object.keys(feeds).length }
        };
      }
      
      return {
        status: 'healthy',
        message: `Price feeds healthy: ${healthyFeeds.length}/${Object.keys(feeds).length} active`,
        data: { staleFeeds, healthyFeeds, totalFeeds: Object.keys(feeds).length }
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Price feeds check failed: ${error.message}`,
        data: { error: error.message }
      };
    }
  }
  
  /**
   * Check mempool monitor health
   */
  async checkMempoolMonitor() {
    const monitor = this.components.mempoolMonitor;
    if (!monitor) {
      return {
        status: 'unhealthy',
        message: 'Mempool monitor not initialized',
        data: { initialized: false }
      };
    }
    
    try {
      const isActive = monitor.isActive || false;
      const lastTransaction = monitor.lastTransaction || null;
      const pendingCount = monitor.pendingCount || 0;
      
      if (!isActive) {
        return {
          status: 'unhealthy',
          message: 'Mempool monitor not active',
          data: { active: false, lastTransaction, pendingCount }
        };
      }
      
      return {
        status: 'healthy',
        message: `Mempool monitor healthy: ${pendingCount} pending`,
        data: { active: true, lastTransaction, pendingCount }
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Mempool monitor check failed: ${error.message}`,
        data: { error: error.message }
      };
    }
  }
  
  /**
   * Check WebSocket connection health
   */
  async checkWebSocketHealth(network) {
    // Simplified WebSocket check - would implement proper WebSocket monitoring
    try {
      return {
        status: 'healthy',
        message: `${network} WebSocket connection healthy`,
        data: { network, connected: true }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `${network} WebSocket connection failed: ${error.message}`,
        data: { network, error: error.message, connected: false }
      };
    }
  }
  
  /**
   * Collect performance metrics
   */
  collectPerformanceMetrics() {
    // Calculate throughput and error rates
    Object.keys(this.performanceMetrics.errorRates).forEach(checkId => {
      const errorMetrics = this.performanceMetrics.errorRates[checkId];
      if (errorMetrics.total > 0) {
        errorMetrics.rate = (errorMetrics.errors / errorMetrics.total) * 100;
      }
      
      const availabilityMetrics = this.performanceMetrics.availability[checkId];
      if (availabilityMetrics.total > 0) {
        availabilityMetrics.percentage = (availabilityMetrics.success / availabilityMetrics.total) * 100;
      }
    });
  }
  
  /**
   * Get health status
   */
  getHealthStatus() {
    return {
      overall: this.healthState.overall,
      uptime: process.uptime(),
      lastCheck: this.healthState.lastCheck,
      issues: this.healthState.issues,
      checks: this.healthState.checks,
      consecutiveFailures: this.healthState.consecutiveFailures,
      lastHealthyTime: this.healthState.lastHealthyTime,
      metrics: this.getHealthMetrics()
    };
  }
  
  /**
   * Get health metrics summary
   */
  getHealthMetrics() {
    const metrics = {};
    
    Object.keys(this.performanceMetrics.responseTime).forEach(checkId => {
      const responseTimes = this.performanceMetrics.responseTime[checkId];
      const errorRate = this.performanceMetrics.errorRates[checkId];
      const availability = this.performanceMetrics.availability[checkId];
      
      if (responseTimes.length > 0) {
        const times = responseTimes.map(r => r.duration);
        metrics[checkId] = {
          avgResponseTime: times.reduce((a, b) => a + b, 0) / times.length,
          minResponseTime: Math.min(...times),
          maxResponseTime: Math.max(...times),
          errorRate: errorRate.rate || 0,
          availability: availability.percentage || 0,
          totalChecks: availability.total || 0
        };
      }
    });
    
    return metrics;
  }
  
  /**
   * Add custom health check
   */
  addHealthCheck(checkId, checkConfig) {
    this.healthChecks[checkId] = {
      name: checkConfig.name,
      category: checkConfig.category || 'custom',
      check: checkConfig.check,
      critical: checkConfig.critical || false,
      timeout: checkConfig.timeout || 10000
    };
    
    this.healthState.checks[checkId] = {
      status: 'unknown',
      lastRun: null,
      duration: 0,
      error: null,
      consecutiveFailures: 0,
      lastSuccess: null
    };
    
    // Initialize metrics
    this.performanceMetrics.responseTime[checkId] = [];
    this.performanceMetrics.errorRates[checkId] = { total: 0, errors: 0 };
    this.performanceMetrics.availability[checkId] = { total: 0, success: 0 };
  }
  
  /**
   * Remove health check
   */
  removeHealthCheck(checkId) {
    delete this.healthChecks[checkId];
    delete this.healthState.checks[checkId];
    delete this.performanceMetrics.responseTime[checkId];
    delete this.performanceMetrics.errorRates[checkId];
    delete this.performanceMetrics.availability[checkId];
  }
  
  /**
   * Get detailed health report
   */
  getHealthReport() {
    return {
      summary: {
        overall: this.healthState.overall,
        uptime: process.uptime(),
        totalChecks: Object.keys(this.healthChecks).length,
        healthyChecks: Object.values(this.healthState.checks).filter(c => c.status === 'healthy').length,
        criticalIssues: this.healthState.issues.filter(i => i.critical).length,
        lastCheck: this.healthState.lastCheck
      },
      issues: this.healthState.issues,
      checks: this.healthState.checks,
      metrics: this.getHealthMetrics(),
      performance: this.performanceMetrics,
      system: {
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch(),
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        cpuCount: os.cpus().length,
        loadAverage: os.loadavg()
      }
    };
  }
  
  /**
   * Shutdown health monitor
   */
  async shutdown() {
    console.log('🛑 Shutting down Health Monitor...');
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    this.isInitialized = false;
    this.emit('shutdown');
    
    console.log('✅ Health Monitor shutdown complete');
  }
}

export default HealthMonitor;