import { EventEmitter } from 'events';
import axios from 'axios';
import os from 'os';

/**
 * HealthMonitor - Comprehensive System Health Monitoring
 * Tracks component health, performs automated health checks,
 * monitors dependencies and provides health status reporting
 */
class HealthMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      healthCheckInterval: options.healthCheckInterval || 30000, // 30 seconds
      dependencyCheckInterval: options.dependencyCheckInterval || 60000, // 1 minute
      performanceCheckInterval: options.performanceCheckInterval || 15000, // 15 seconds
      uptimeThreshold: options.uptimeThreshold || 99.5, // 99.5% uptime requirement
      responseTimeThreshold: options.responseTimeThreshold || 5000, // 5 seconds
      enableAutoRecovery: options.enableAutoRecovery !== false,
      maxRecoveryAttempts: options.maxRecoveryAttempts || 3,
      healthScoreWeights: {
        availability: 0.3,
        performance: 0.25,
        resources: 0.2,
        dependencies: 0.15,
        errors: 0.1
      },
      ...options
    };
    
    // Component health tracking
    this.componentHealth = {
      coreArbitrageEngine: {
        status: 'unknown',
        lastCheck: null,
        uptime: 0,
        errors: [],
        metrics: {},
        dependencies: ['rpcProviders', 'database', 'mempool']
      },
      rpcProviders: {
        status: 'unknown',
        lastCheck: null,
        endpoints: new Map(),
        failoverCount: 0,
        averageLatency: 0,
        successRate: 100
      },
      database: {
        status: 'unknown',
        lastCheck: null,
        connectionPool: 0,
        queryPerformance: 0,
        errors: [],
        metrics: {}
      },
      mempool: {
        status: 'unknown',
        lastCheck: null,
        connectionStatus: false,
        transactionRate: 0,
        errors: [],
        reconnections: 0
      },
      smartContracts: {
        status: 'unknown',
        lastCheck: null,
        deployedContracts: new Map(),
        gasUsage: 0,
        successRate: 100,
        errors: []
      },
      externalAPIs: {
        status: 'unknown',
        lastCheck: null,
        services: new Map([
          ['coingecko', { status: 'unknown', latency: 0, errors: 0 }],
          ['etherscan', { status: 'unknown', latency: 0, errors: 0 }],
          ['flashbots', { status: 'unknown', latency: 0, errors: 0 }]
        ]),
        overallLatency: 0
      },
      networkConnectivity: {
        status: 'unknown',
        lastCheck: null,
        mainnet: { connected: false, latency: 0, blockHeight: 0 },
        websockets: { connected: false, reconnections: 0 },
        bandwidth: { upload: 0, download: 0 }
      }
    };
    
    // System health metrics
    this.systemHealth = {
      overall: {
        status: 'unknown',
        score: 0,
        lastUpdate: Date.now(),
        issues: [],
        recommendations: []
      },
      resources: {
        cpu: { usage: 0, cores: os.cpus().length, temperature: 0 },
        memory: { used: 0, total: os.totalmem(), percentage: 0, swapUsed: 0 },
        disk: { used: 0, total: 0, percentage: 0, iops: 0 },
        network: { bytesIn: 0, bytesOut: 0, packetsIn: 0, packetsOut: 0 }
      },
      performance: {
        responseTime: 0,
        throughput: 0,
        errorRate: 0,
        availability: 100,
        latency: { p50: 0, p95: 0, p99: 0 }
      }
    };
    
    // Health check configurations
    this.healthChecks = {
      system: {
        enabled: true,
        checks: [
          { name: 'cpu_usage', threshold: 85, weight: 0.3 },
          { name: 'memory_usage', threshold: 90, weight: 0.3 },
          { name: 'disk_usage', threshold: 85, weight: 0.2 },
          { name: 'network_latency', threshold: 1000, weight: 0.2 }
        ]
      },
      application: {
        enabled: true,
        checks: [
          { name: 'arbitrage_engine', endpoint: '/health/engine', weight: 0.4 },
          { name: 'database_connection', endpoint: '/health/db', weight: 0.3 },
          { name: 'rpc_connectivity', endpoint: '/health/rpc', weight: 0.3 }
        ]
      },
      external: {
        enabled: true,
        checks: [
          { name: 'ethereum_mainnet', url: 'https://mainnet.infura.io/v3/', weight: 0.4 },
          { name: 'price_feeds', url: 'https://api.coingecko.com/api/v3/ping', weight: 0.3 },
          { name: 'flashbots_relay', url: 'https://relay.flashbots.net/', weight: 0.3 }
        ]
      }
    };
    
    // Recovery procedures
    this.recoveryProcedures = {
      high_cpu_usage: {
        steps: ['reduce_polling_frequency', 'clear_caches', 'restart_heavy_processes'],
        maxAttempts: 2,
        cooldown: 300000 // 5 minutes
      },
      high_memory_usage: {
        steps: ['garbage_collect', 'clear_memory_caches', 'restart_memory_intensive_services'],
        maxAttempts: 3,
        cooldown: 180000 // 3 minutes
      },
      rpc_connectivity_issues: {
        steps: ['switch_rpc_provider', 'reset_connections', 'update_endpoint_priority'],
        maxAttempts: 5,
        cooldown: 60000 // 1 minute
      },
      database_connection_loss: {
        steps: ['reconnect_database', 'clear_connection_pool', 'restart_database_service'],
        maxAttempts: 3,
        cooldown: 120000 // 2 minutes
      }
    };
    
    // Health history for trend analysis
    this.healthHistory = {
      overall: [],
      components: new Map(),
      incidents: [],
      recoveries: []
    };
    
    // Timers
    this.healthCheckTimer = null;
    this.dependencyCheckTimer = null;
    this.performanceCheckTimer = null;
    
    // State
    this.isMonitoring = false;
    this.startTime = Date.now();
    
    // Recovery state
    this.recoveryAttempts = new Map();
    this.lastRecoveryTime = new Map();
  }
  
  /**
   * Initialize health monitoring
   */
  async initialize() {
    try {
      console.log('🏥 Initializing HealthMonitor...');
      
      // Perform initial health assessment
      await this.performInitialHealthCheck();
      
      // Start monitoring intervals
      this.startHealthChecks();
      this.startDependencyChecks();
      this.startPerformanceChecks();
      
      this.isMonitoring = true;
      this.emit('initialized');
      
      console.log('✅ HealthMonitor initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize HealthMonitor:', error);
      throw error;
    }
  }
  
  /**
   * Perform initial comprehensive health check
   */
  async performInitialHealthCheck() {
    console.log('🔍 Performing initial health assessment...');
    
    // Check system resources
    await this.checkSystemHealth();
    
    // Check application components
    await this.checkApplicationHealth();
    
    // Check external dependencies
    await this.checkExternalDependencies();
    
    // Calculate initial health score
    this.calculateOverallHealth();
    
    console.log(`📊 Initial health score: ${this.systemHealth.overall.score.toFixed(1)}% (${this.systemHealth.overall.status})`);
  }
  
  /**
   * Start regular health checks
   */
  startHealthChecks() {
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('Health check error:', error);
        this.recordHealthEvent('health_check_error', { error: error.message });
      }
    }, this.options.healthCheckInterval);
    
    console.log(`🔄 Started health checks (interval: ${this.options.healthCheckInterval}ms)`);
  }
  
  /**
   * Start dependency monitoring
   */
  startDependencyChecks() {
    this.dependencyCheckTimer = setInterval(async () => {
      try {
        await this.checkExternalDependencies();
      } catch (error) {
        console.error('Dependency check error:', error);
      }
    }, this.options.dependencyCheckInterval);
  }
  
  /**
   * Start performance monitoring
   */
  startPerformanceChecks() {
    this.performanceCheckTimer = setInterval(async () => {
      try {
        await this.checkPerformanceMetrics();
      } catch (error) {
        console.error('Performance check error:', error);
      }
    }, this.options.performanceCheckInterval);
  }
  
  /**
   * Perform comprehensive health check
   */
  async performHealthCheck() {
    const startTime = Date.now();
    
    // Check system health
    await this.checkSystemHealth();
    
    // Check application components
    await this.checkApplicationHealth();
    
    // Update overall health
    this.calculateOverallHealth();
    
    // Check for issues requiring intervention
    await this.assessHealthIssues();
    
    // Record health data
    this.recordHealthSnapshot();
    
    // Emit health update
    this.emit('healthUpdated', this.getHealthSummary());
    
    const duration = Date.now() - startTime;
    console.log(`🏥 Health check completed in ${duration}ms - Status: ${this.systemHealth.overall.status}`);
  }
  
  /**
   * Check system resource health
   */
  async checkSystemHealth() {
    // CPU usage
    const cpuUsage = await this.getCPUUsage();
    this.systemHealth.resources.cpu.usage = cpuUsage;
    
    // Memory usage
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const memPercentage = (memUsage.rss / totalMem) * 100;
    
    this.systemHealth.resources.memory.used = memUsage.rss;
    this.systemHealth.resources.memory.percentage = memPercentage;
    
    // Network metrics
    await this.checkNetworkHealth();
    
    // Update system component status
    this.updateSystemComponentStatus();
  }
  
  /**
   * Check application component health
   */
  async checkApplicationHealth() {
    // Check Core Arbitrage Engine
    await this.checkCoreEngineHealth();
    
    // Check RPC providers
    await this.checkRPCHealth();
    
    // Check database connectivity
    await this.checkDatabaseHealth();
    
    // Check mempool monitoring
    await this.checkMempoolHealth();
    
    // Check smart contracts
    await this.checkSmartContractHealth();
  }
  
  /**
   * Check Core Arbitrage Engine health
   */
  async checkCoreEngineHealth() {
    try {
      const component = this.componentHealth.coreArbitrageEngine;
      
      // Mock health check - in real implementation would check actual engine status
      const isRunning = true; // Would check if engine is active
      const hasErrors = component.errors.length > 0;
      
      if (isRunning && !hasErrors) {
        component.status = 'healthy';
      } else if (isRunning && hasErrors) {
        component.status = 'degraded';
      } else {
        component.status = 'critical';
      }
      
      component.lastCheck = Date.now();
      component.uptime = Date.now() - this.startTime;
      
    } catch (error) {
      this.componentHealth.coreArbitrageEngine.status = 'critical';
      this.componentHealth.coreArbitrageEngine.errors.push({
        timestamp: Date.now(),
        error: error.message
      });
    }
  }
  
  /**
   * Check RPC provider health
   */
  async checkRPCHealth() {
    const component = this.componentHealth.rpcProviders;
    const healthyEndpoints = [];
    const totalLatency = [];
    
    // Mock RPC endpoints - in real implementation would check actual endpoints
    const mockEndpoints = [
      'https://mainnet.infura.io/v3/xxx',
      'https://eth-mainnet.alchemyapi.io/v2/xxx',
      'https://cloudflare-eth.com'
    ];
    
    for (const endpoint of mockEndpoints) {
      try {
        const startTime = Date.now();
        
        // Mock RPC call - in real implementation would make actual RPC call
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
        
        const latency = Date.now() - startTime;
        totalLatency.push(latency);
        
        component.endpoints.set(endpoint, {
          status: 'healthy',
          latency,
          lastCheck: Date.now(),
          errors: 0
        });
        
        healthyEndpoints.push(endpoint);
        
      } catch (error) {
        component.endpoints.set(endpoint, {
          status: 'unhealthy',
          latency: 0,
          lastCheck: Date.now(),
          errors: component.endpoints.get(endpoint)?.errors + 1 || 1
        });
      }
    }
    
    // Calculate overall RPC health
    component.averageLatency = totalLatency.length > 0 ? 
      totalLatency.reduce((a, b) => a + b, 0) / totalLatency.length : 0;
    
    component.successRate = (healthyEndpoints.length / mockEndpoints.length) * 100;
    
    if (healthyEndpoints.length === 0) {
      component.status = 'critical';
    } else if (healthyEndpoints.length < mockEndpoints.length * 0.7) {
      component.status = 'degraded';
    } else {
      component.status = 'healthy';
    }
    
    component.lastCheck = Date.now();
  }
  
  /**
   * Check database health
   */
  async checkDatabaseHealth() {
    try {
      const component = this.componentHealth.database;
      
      // Mock database check - in real implementation would check actual database
      const connectionActive = true;
      const queryTime = Math.random() * 100 + 10; // Mock query time
      
      component.connectionPool = 5; // Mock connection pool size
      component.queryPerformance = queryTime;
      component.status = connectionActive && queryTime < 100 ? 'healthy' : 'degraded';
      component.lastCheck = Date.now();
      
    } catch (error) {
      this.componentHealth.database.status = 'critical';
      this.componentHealth.database.errors.push({
        timestamp: Date.now(),
        error: error.message
      });
    }
  }
  
  /**
   * Check mempool monitoring health
   */
  async checkMempoolHealth() {
    try {
      const component = this.componentHealth.mempool;
      
      // Mock mempool check - in real implementation would check WebSocket connections
      const connected = true;
      const transactionRate = Math.floor(Math.random() * 100) + 50;
      
      component.connectionStatus = connected;
      component.transactionRate = transactionRate;
      component.status = connected ? 'healthy' : 'critical';
      component.lastCheck = Date.now();
      
    } catch (error) {
      this.componentHealth.mempool.status = 'critical';
      this.componentHealth.mempool.errors.push({
        timestamp: Date.now(),
        error: error.message
      });
    }
  }
  
  /**
   * Check smart contract health
   */
  async checkSmartContractHealth() {
    try {
      const component = this.componentHealth.smartContracts;
      
      // Mock contract health check
      const contractsDeployed = 3;
      const avgGasUsage = Math.floor(Math.random() * 100000) + 50000;
      
      component.gasUsage = avgGasUsage;
      component.successRate = 98; // Mock success rate
      component.status = 'healthy';
      component.lastCheck = Date.now();
      
    } catch (error) {
      this.componentHealth.smartContracts.status = 'critical';
      this.componentHealth.smartContracts.errors.push({
        timestamp: Date.now(),
        error: error.message
      });
    }
  }
  
  /**
   * Check external dependencies
   */
  async checkExternalDependencies() {
    const component = this.componentHealth.externalAPIs;
    const services = component.services;
    const latencies = [];
    
    // Check each external service
    for (const [serviceName, serviceData] of services.entries()) {
      try {
        const startTime = Date.now();
        
        // Mock API call - in real implementation would make actual API calls
        await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50));
        
        const latency = Date.now() - startTime;
        latencies.push(latency);
        
        services.set(serviceName, {
          ...serviceData,
          status: latency < 500 ? 'healthy' : 'degraded',
          latency,
          lastCheck: Date.now()
        });
        
      } catch (error) {
        services.set(serviceName, {
          ...serviceData,
          status: 'unhealthy',
          latency: 0,
          errors: serviceData.errors + 1,
          lastCheck: Date.now()
        });
      }
    }
    
    // Calculate overall external API health
    const healthyServices = Array.from(services.values()).filter(s => s.status === 'healthy').length;
    const totalServices = services.size;
    
    component.overallLatency = latencies.length > 0 ? 
      latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    
    if (healthyServices === totalServices) {
      component.status = 'healthy';
    } else if (healthyServices >= totalServices * 0.7) {
      component.status = 'degraded';
    } else {
      component.status = 'critical';
    }
    
    component.lastCheck = Date.now();
  }
  
  /**
   * Check network connectivity
   */
  async checkNetworkHealth() {
    const component = this.componentHealth.networkConnectivity;
    
    try {
      // Mock mainnet connectivity check
      const mainnetLatency = Math.random() * 200 + 50;
      const blockHeight = Math.floor(Math.random() * 1000) + 18000000;
      
      component.mainnet = {
        connected: true,
        latency: mainnetLatency,
        blockHeight
      };
      
      // Mock WebSocket status
      component.websockets = {
        connected: true,
        reconnections: component.websockets.reconnections || 0
      };
      
      component.status = 'healthy';
      component.lastCheck = Date.now();
      
    } catch (error) {
      component.status = 'critical';
      component.mainnet.connected = false;
    }
  }
  
  /**
   * Check performance metrics
   */
  async checkPerformanceMetrics() {
    // Mock performance data
    this.systemHealth.performance.responseTime = Math.random() * 500 + 100;
    this.systemHealth.performance.throughput = Math.random() * 100 + 50;
    this.systemHealth.performance.errorRate = Math.random() * 2;
    
    // Calculate availability
    const uptime = Date.now() - this.startTime;
    this.systemHealth.performance.availability = Math.min(100, (uptime / (uptime + 1000)) * 100);
  }
  
  /**
   * Calculate overall health score
   */
  calculateOverallHealth() {
    const weights = this.options.healthScoreWeights;
    let score = 0;
    
    // Component availability score
    const componentStatuses = Object.values(this.componentHealth).map(c => c.status);
    const healthyComponents = componentStatuses.filter(s => s === 'healthy').length;
    const availabilityScore = (healthyComponents / componentStatuses.length) * 100;
    
    // Performance score
    const performanceScore = Math.max(0, 100 - this.systemHealth.performance.errorRate * 10);
    
    // Resource utilization score
    const cpuScore = Math.max(0, 100 - this.systemHealth.resources.cpu.usage);
    const memoryScore = Math.max(0, 100 - this.systemHealth.resources.memory.percentage);
    const resourceScore = (cpuScore + memoryScore) / 2;
    
    // Dependencies score
    const externalAPIHealth = this.componentHealth.externalAPIs.status;
    const dependencyScore = externalAPIHealth === 'healthy' ? 100 : 
                           externalAPIHealth === 'degraded' ? 70 : 30;
    
    // Error rate score
    const errorScore = Math.max(0, 100 - this.systemHealth.performance.errorRate * 20);
    
    // Calculate weighted score
    score = (availabilityScore * weights.availability) +
            (performanceScore * weights.performance) +
            (resourceScore * weights.resources) +
            (dependencyScore * weights.dependencies) +
            (errorScore * weights.errors);
    
    // Determine status
    this.systemHealth.overall.score = score;
    
    if (score >= 95) {
      this.systemHealth.overall.status = 'excellent';
    } else if (score >= 85) {
      this.systemHealth.overall.status = 'healthy';
    } else if (score >= 70) {
      this.systemHealth.overall.status = 'degraded';
    } else if (score >= 50) {
      this.systemHealth.overall.status = 'unhealthy';
    } else {
      this.systemHealth.overall.status = 'critical';
    }
    
    this.systemHealth.overall.lastUpdate = Date.now();
  }
  
  /**
   * Assess health issues and trigger recovery if needed
   */
  async assessHealthIssues() {
    const issues = [];
    const recommendations = [];
    
    // Check CPU usage
    if (this.systemHealth.resources.cpu.usage > 85) {
      issues.push({
        type: 'high_cpu_usage',
        severity: this.systemHealth.resources.cpu.usage > 95 ? 'critical' : 'warning',
        value: this.systemHealth.resources.cpu.usage,
        threshold: 85
      });
      
      if (this.options.enableAutoRecovery) {
        await this.triggerRecovery('high_cpu_usage');
      }
    }
    
    // Check memory usage
    if (this.systemHealth.resources.memory.percentage > 90) {
      issues.push({
        type: 'high_memory_usage',
        severity: this.systemHealth.resources.memory.percentage > 95 ? 'critical' : 'warning',
        value: this.systemHealth.resources.memory.percentage,
        threshold: 90
      });
      
      if (this.options.enableAutoRecovery) {
        await this.triggerRecovery('high_memory_usage');
      }
    }
    
    // Check RPC connectivity
    if (this.componentHealth.rpcProviders.status !== 'healthy') {
      issues.push({
        type: 'rpc_connectivity_issues',
        severity: this.componentHealth.rpcProviders.status === 'critical' ? 'critical' : 'warning',
        details: `Success rate: ${this.componentHealth.rpcProviders.successRate}%`
      });
      
      if (this.options.enableAutoRecovery) {
        await this.triggerRecovery('rpc_connectivity_issues');
      }
    }
    
    this.systemHealth.overall.issues = issues;
    this.systemHealth.overall.recommendations = recommendations;
    
    // Emit alerts for critical issues
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      this.emit('criticalHealthIssue', {
        issues: criticalIssues,
        timestamp: Date.now(),
        overallHealth: this.systemHealth.overall.status
      });
    }
  }
  
  /**
   * Trigger automated recovery procedure
   */
  async triggerRecovery(issueType) {
    const procedure = this.recoveryProcedures[issueType];
    if (!procedure) return;
    
    const attemptKey = issueType;
    const currentAttempts = this.recoveryAttempts.get(attemptKey) || 0;
    const lastAttempt = this.lastRecoveryTime.get(attemptKey) || 0;
    
    // Check cooldown period
    if (Date.now() - lastAttempt < procedure.cooldown) {
      console.log(`⏳ Recovery for ${issueType} on cooldown`);
      return;
    }
    
    // Check max attempts
    if (currentAttempts >= procedure.maxAttempts) {
      console.log(`🚫 Max recovery attempts reached for ${issueType}`);
      this.emit('recoveryFailed', { issueType, attempts: currentAttempts });
      return;
    }
    
    console.log(`🔧 Triggering recovery for ${issueType} (attempt ${currentAttempts + 1})`);
    
    try {
      await this.executeRecoverySteps(issueType, procedure.steps);
      
      // Reset attempts on success
      this.recoveryAttempts.delete(attemptKey);
      this.lastRecoveryTime.delete(attemptKey);
      
      this.recordHealthEvent('recovery_success', { issueType, steps: procedure.steps });
      this.emit('recoverySuccess', { issueType });
      
    } catch (error) {
      this.recoveryAttempts.set(attemptKey, currentAttempts + 1);
      this.lastRecoveryTime.set(attemptKey, Date.now());
      
      this.recordHealthEvent('recovery_failure', { issueType, error: error.message });
      this.emit('recoveryAttempt', { issueType, attempt: currentAttempts + 1, error: error.message });
    }
  }
  
  /**
   * Execute recovery steps
   */
  async executeRecoverySteps(issueType, steps) {
    for (const step of steps) {
      console.log(`🔧 Executing recovery step: ${step}`);
      
      switch (step) {
        case 'reduce_polling_frequency':
          // Mock implementation
          console.log('   Reducing polling frequency');
          break;
          
        case 'clear_caches':
          // Mock implementation
          console.log('   Clearing caches');
          break;
          
        case 'garbage_collect':
          if (global.gc) {
            global.gc();
            console.log('   Garbage collection triggered');
          }
          break;
          
        case 'switch_rpc_provider':
          console.log('   Switching to backup RPC provider');
          break;
          
        case 'reconnect_database':
          console.log('   Reconnecting to database');
          break;
          
        default:
          console.log(`   Unknown recovery step: ${step}`);
      }
      
      // Wait between steps
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  /**
   * Record health snapshot for history
   */
  recordHealthSnapshot() {
    const snapshot = {
      timestamp: Date.now(),
      overallScore: this.systemHealth.overall.score,
      status: this.systemHealth.overall.status,
      componentStatuses: Object.entries(this.componentHealth).reduce((acc, [name, comp]) => {
        acc[name] = comp.status;
        return acc;
      }, {}),
      resourceUsage: {
        cpu: this.systemHealth.resources.cpu.usage,
        memory: this.systemHealth.resources.memory.percentage
      }
    };
    
    this.healthHistory.overall.push(snapshot);
    
    // Keep only last 24 hours of data
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    this.healthHistory.overall = this.healthHistory.overall.filter(s => s.timestamp > cutoff);
  }
  
  /**
   * Record health event
   */
  recordHealthEvent(eventType, data) {
    const event = {
      type: eventType,
      timestamp: Date.now(),
      data
    };
    
    if (eventType.includes('recovery')) {
      this.healthHistory.recoveries.push(event);
    } else {
      this.healthHistory.incidents.push(event);
    }
    
    // Keep limited history
    if (this.healthHistory.incidents.length > 1000) {
      this.healthHistory.incidents = this.healthHistory.incidents.slice(-500);
    }
    if (this.healthHistory.recoveries.length > 500) {
      this.healthHistory.recoveries = this.healthHistory.recoveries.slice(-250);
    }
  }
  
  /**
   * Get current CPU usage
   */
  async getCPUUsage() {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = Date.now();
      
      setTimeout(() => {
        const currentUsage = process.cpuUsage(startUsage);
        const elapsedTime = Date.now() - startTime;
        const elapsedUserMS = currentUsage.user / 1000;
        const elapsedSystemMS = currentUsage.system / 1000;
        const cpuPercent = ((elapsedUserMS + elapsedSystemMS) / elapsedTime) * 100;
        
        resolve(Math.min(100, cpuPercent));
      }, 100);
    });
  }
  
  /**
   * Update system component status
   */
  updateSystemComponentStatus() {
    // Update overall system component status based on resource usage
    const cpuUsage = this.systemHealth.resources.cpu.usage;
    const memUsage = this.systemHealth.resources.memory.percentage;
    
    let systemStatus = 'healthy';
    
    if (cpuUsage > 95 || memUsage > 95) {
      systemStatus = 'critical';
    } else if (cpuUsage > 85 || memUsage > 85) {
      systemStatus = 'degraded';
    }
    
    // System isn't explicitly tracked as a component, but we could add it
  }
  
  /**
   * Get health summary
   */
  getHealthSummary() {
    return {
      timestamp: Date.now(),
      overall: this.systemHealth.overall,
      components: Object.entries(this.componentHealth).reduce((acc, [name, comp]) => {
        acc[name] = {
          status: comp.status,
          lastCheck: comp.lastCheck,
          uptime: comp.uptime || 0
        };
        return acc;
      }, {}),
      resources: this.systemHealth.resources,
      performance: this.systemHealth.performance,
      uptime: Date.now() - this.startTime
    };
  }
  
  /**
   * Get detailed health report
   */
  getDetailedHealthReport() {
    return {
      summary: this.getHealthSummary(),
      components: this.componentHealth,
      systemHealth: this.systemHealth,
      history: {
        recentSnapshots: this.healthHistory.overall.slice(-10),
        recentIncidents: this.healthHistory.incidents.slice(-5),
        recentRecoveries: this.healthHistory.recoveries.slice(-3)
      },
      recoveryState: {
        activeRecoveries: Array.from(this.recoveryAttempts.entries()),
        cooldowns: Array.from(this.lastRecoveryTime.entries())
      }
    };
  }
  
  /**
   * Get component health by name
   */
  getComponentHealth(componentName) {
    return this.componentHealth[componentName] || null;
  }
  
  /**
   * Update component health manually
   */
  updateComponentHealth(componentName, healthData) {
    if (this.componentHealth[componentName]) {
      this.componentHealth[componentName] = {
        ...this.componentHealth[componentName],
        ...healthData,
        lastCheck: Date.now()
      };
      
      this.emit('componentHealthUpdated', {
        component: componentName,
        health: this.componentHealth[componentName]
      });
    }
  }
  
  /**
   * Shutdown health monitoring
   */
  async shutdown() {
    console.log('🛑 Shutting down HealthMonitor...');
    
    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
    if (this.dependencyCheckTimer) clearInterval(this.dependencyCheckTimer);
    if (this.performanceCheckTimer) clearInterval(this.performanceCheckTimer);
    
    this.isMonitoring = false;
    this.emit('shutdown');
    
    console.log('✅ HealthMonitor shutdown complete');
  }
  
  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      monitoring: this.isMonitoring,
      uptime: Date.now() - this.startTime,
      lastHealthCheck: Math.max(...Object.values(this.componentHealth).map(c => c.lastCheck || 0)),
      overallHealth: this.systemHealth.overall.status,
      healthScore: this.systemHealth.overall.score,
      activeIssues: this.systemHealth.overall.issues.length,
      recoveryAttempts: this.recoveryAttempts.size
    };
  }
}

export default HealthMonitor;