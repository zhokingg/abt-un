import { EventEmitter } from 'events';
import axios from 'axios';
import os from 'os';

/**
 * InfrastructureMonitor - Network and Infrastructure Monitoring
 * Monitors RPC providers, network performance, API rate limiting,
 * server resources, and infrastructure health with optimization recommendations
 */
class InfrastructureMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      monitoringInterval: options.monitoringInterval || 15000, // 15 seconds
      networkCheckInterval: options.networkCheckInterval || 30000, // 30 seconds
      resourceCheckInterval: options.resourceCheckInterval || 10000, // 10 seconds
      rpcHealthCheckInterval: options.rpcHealthCheckInterval || 20000, // 20 seconds
      
      // Thresholds
      latencyThreshold: options.latencyThreshold || 1000, // 1 second
      bandwidthThreshold: options.bandwidthThreshold || 80, // 80% usage
      cpuThreshold: options.cpuThreshold || 85, // 85% usage
      memoryThreshold: options.memoryThreshold || 90, // 90% usage
      diskThreshold: options.diskThreshold || 85, // 85% usage
      
      // Rate limiting
      rpcRateLimit: options.rpcRateLimit || 100, // requests per minute
      apiRateLimit: options.apiRateLimit || 200, // requests per minute
      
      // Auto-optimization
      enableAutoOptimization: options.enableAutoOptimization !== false,
      
      ...options
    };
    
    // RPC Provider monitoring
    this.rpcProviders = new Map([
      ['infura-mainnet', {
        url: 'https://mainnet.infura.io/v3/',
        name: 'Infura Mainnet',
        status: 'unknown',
        latency: 0,
        successRate: 100,
        requestCount: 0,
        errorCount: 0,
        lastCheck: null,
        priority: 1,
        rateLimit: { requests: 0, window: Date.now(), limit: 100000 }
      }],
      ['alchemy-mainnet', {
        url: 'https://eth-mainnet.alchemyapi.io/v2/',
        name: 'Alchemy Mainnet',
        status: 'unknown',
        latency: 0,
        successRate: 100,
        requestCount: 0,
        errorCount: 0,
        lastCheck: null,
        priority: 2,
        rateLimit: { requests: 0, window: Date.now(), limit: 300000 }
      }],
      ['cloudflare-eth', {
        url: 'https://cloudflare-eth.com',
        name: 'Cloudflare Ethereum',
        status: 'unknown',
        latency: 0,
        successRate: 100,
        requestCount: 0,
        errorCount: 0,
        lastCheck: null,
        priority: 3,
        rateLimit: { requests: 0, window: Date.now(), limit: 100000 }
      }],
      ['quicknode', {
        url: 'https://ethereum-mainnet.core.chainstack.com/',
        name: 'QuickNode',
        status: 'unknown',
        latency: 0,
        successRate: 100,
        requestCount: 0,
        errorCount: 0,
        lastCheck: null,
        priority: 4,
        rateLimit: { requests: 0, window: Date.now(), limit: 500000 }
      }]
    ]);
    
    // Network performance metrics
    this.networkMetrics = {
      overall: {
        status: 'unknown',
        averageLatency: 0,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        lastOptimization: null
      },
      bandwidth: {
        upload: { current: 0, peak: 0, average: 0 },
        download: { current: 0, peak: 0, average: 0 },
        utilization: 0
      },
      congestion: {
        level: 'low',
        score: 0,
        indicators: [],
        adaptations: []
      }
    };
    
    // WebSocket connection monitoring
    this.websocketConnections = new Map([
      ['mempool', {
        url: 'wss://mempool.space/api/v1/ws',
        status: 'disconnected',
        latency: 0,
        reconnections: 0,
        lastMessage: null,
        messageCount: 0,
        errorCount: 0
      }],
      ['flashbots', {
        url: 'wss://relay.flashbots.net',
        status: 'disconnected',
        latency: 0,
        reconnections: 0,
        lastMessage: null,
        messageCount: 0,
        errorCount: 0
      }],
      ['uniswap', {
        url: 'wss://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
        status: 'disconnected',
        latency: 0,
        reconnections: 0,
        lastMessage: null,
        messageCount: 0,
        errorCount: 0
      }]
    ]);
    
    // API rate limiting tracking
    this.apiRateLimits = new Map([
      ['coingecko', {
        requests: 0,
        limit: 50, // per minute
        window: Date.now(),
        status: 'healthy',
        violations: 0
      }],
      ['etherscan', {
        requests: 0,
        limit: 5, // per second
        window: Date.now(),
        status: 'healthy',
        violations: 0
      }],
      ['dexscreener', {
        requests: 0,
        limit: 300, // per minute
        window: Date.now(),
        status: 'healthy',
        violations: 0
      }]
    ]);
    
    // Server resource monitoring
    this.serverResources = {
      system: {
        platform: os.platform(),
        arch: os.arch(),
        uptime: 0,
        loadAverage: [0, 0, 0],
        hostname: os.hostname()
      },
      cpu: {
        usage: 0,
        cores: os.cpus().length,
        model: os.cpus()[0]?.model || 'Unknown',
        temperature: 0,
        frequency: 0
      },
      memory: {
        total: os.totalmem(),
        free: 0,
        used: 0,
        percentage: 0,
        swapTotal: 0,
        swapUsed: 0
      },
      disk: {
        total: 0,
        free: 0,
        used: 0,
        percentage: 0,
        iops: 0,
        throughput: 0
      },
      network: {
        interfaces: new Map(),
        totalBytesIn: 0,
        totalBytesOut: 0,
        packetsIn: 0,
        packetsOut: 0,
        errors: 0
      }
    };
    
    // Database performance (if applicable)
    this.databaseMetrics = {
      connectionPool: {
        total: 0,
        active: 0,
        idle: 0,
        waiting: 0
      },
      queries: {
        total: 0,
        successful: 0,
        failed: 0,
        averageTime: 0,
        slowQueries: 0
      },
      cache: {
        hitRate: 0,
        missRate: 0,
        size: 0,
        evictions: 0
      }
    };
    
    // Redis cache monitoring (if using Redis)
    this.cacheMetrics = {
      redis: {
        connected: false,
        memory: 0,
        hitRate: 0,
        missRate: 0,
        keyCount: 0,
        evictions: 0,
        commandsProcessed: 0
      }
    };
    
    // Container health (if using Docker/Kubernetes)
    this.containerMetrics = {
      docker: {
        containers: new Map(),
        totalContainers: 0,
        runningContainers: 0,
        stoppedContainers: 0
      },
      kubernetes: {
        pods: new Map(),
        services: new Map(),
        nodes: new Map()
      }
    };
    
    // Infrastructure optimization
    this.optimizations = {
      rpcLoadBalancing: {
        enabled: false,
        algorithm: 'round_robin', // 'round_robin', 'least_latency', 'weighted'
        weights: new Map()
      },
      caching: {
        enabled: true,
        strategies: ['memory', 'redis'],
        ttl: 60000, // 1 minute default
        hitRate: 0
      },
      requestBatching: {
        enabled: false,
        batchSize: 10,
        maxWaitTime: 100 // milliseconds
      }
    };
    
    // Historical data
    this.metricsHistory = {
      rpcLatency: [],
      networkBandwidth: [],
      systemResources: [],
      errorRates: []
    };
    
    // Monitoring timers
    this.monitoringTimer = null;
    this.networkTimer = null;
    this.resourceTimer = null;
    this.rpcTimer = null;
    
    // State
    this.isMonitoring = false;
    this.startTime = Date.now();
  }
  
  /**
   * Initialize infrastructure monitoring
   */
  async initialize() {
    try {
      console.log('🏗️ Initializing InfrastructureMonitor...');
      
      // Perform initial checks
      await this.performInitialChecks();
      
      // Start monitoring intervals
      this.startMonitoring();
      
      this.isMonitoring = true;
      this.emit('initialized');
      
      console.log('✅ InfrastructureMonitor initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize InfrastructureMonitor:', error);
      throw error;
    }
  }
  
  /**
   * Perform initial infrastructure checks
   */
  async performInitialChecks() {
    console.log('🔍 Performing initial infrastructure assessment...');
    
    // Check system resources
    await this.checkSystemResources();
    
    // Check RPC providers
    await this.checkRPCProviders();
    
    // Check network connectivity
    await this.checkNetworkConnectivity();
    
    // Check API rate limits
    this.checkAPIRateLimits();
    
    // Initialize optimization strategies
    this.initializeOptimizations();
    
    console.log('📊 Initial infrastructure assessment completed');
  }
  
  /**
   * Start monitoring intervals
   */
  startMonitoring() {
    // Main monitoring loop
    this.monitoringTimer = setInterval(async () => {
      await this.performMonitoringCycle();
    }, this.options.monitoringInterval);
    
    // Network specific monitoring
    this.networkTimer = setInterval(async () => {
      await this.checkNetworkPerformance();
    }, this.options.networkCheckInterval);
    
    // Resource monitoring
    this.resourceTimer = setInterval(async () => {
      await this.checkSystemResources();
    }, this.options.resourceCheckInterval);
    
    // RPC health monitoring
    this.rpcTimer = setInterval(async () => {
      await this.checkRPCProviders();
    }, this.options.rpcHealthCheckInterval);
    
    console.log('🔄 Started infrastructure monitoring intervals');
  }
  
  /**
   * Perform monitoring cycle
   */
  async performMonitoringCycle() {
    try {
      // Update WebSocket connections
      await this.checkWebSocketConnections();
      
      // Check API rate limits
      this.checkAPIRateLimits();
      
      // Analyze performance trends
      this.analyzePerformanceTrends();
      
      // Optimize if needed
      if (this.options.enableAutoOptimization) {
        await this.performAutoOptimization();
      }
      
      // Emit monitoring update
      this.emit('monitoringUpdate', this.getInfrastructureStatus());
      
    } catch (error) {
      console.error('Error in monitoring cycle:', error);
      this.emit('monitoringError', error);
    }
  }
  
  /**
   * Check RPC provider health and performance
   */
  async checkRPCProviders() {
    const checks = [];
    
    for (const [providerId, provider] of this.rpcProviders.entries()) {
      checks.push(this.checkSingleRPCProvider(providerId, provider));
    }
    
    await Promise.allSettled(checks);
    
    // Update overall RPC metrics
    this.updateRPCMetrics();
    
    // Optimize RPC routing if needed
    this.optimizeRPCRouting();
  }
  
  /**
   * Check single RPC provider
   */
  async checkSingleRPCProvider(providerId, provider) {
    try {
      const startTime = Date.now();
      
      // Mock RPC call - in real implementation would make actual eth_blockNumber call
      const mockLatency = Math.random() * 200 + 50;
      await new Promise(resolve => setTimeout(resolve, mockLatency));
      
      const latency = Date.now() - startTime;
      
      // Update provider metrics
      provider.latency = latency;
      provider.requestCount++;
      provider.lastCheck = Date.now();
      provider.status = latency < this.options.latencyThreshold ? 'healthy' : 'degraded';
      
      // Update success rate
      provider.successRate = ((provider.requestCount - provider.errorCount) / provider.requestCount) * 100;
      
      // Check rate limiting
      this.updateRPCRateLimit(providerId, provider);
      
    } catch (error) {
      const provider = this.rpcProviders.get(providerId);
      provider.errorCount++;
      provider.status = 'unhealthy';
      provider.lastCheck = Date.now();
      
      console.error(`RPC provider ${providerId} check failed:`, error.message);
    }
  }
  
  /**
   * Update RPC rate limiting
   */
  updateRPCRateLimit(providerId, provider) {
    const now = Date.now();
    const windowSize = 60000; // 1 minute window
    
    // Reset window if needed
    if (now - provider.rateLimit.window > windowSize) {
      provider.rateLimit.requests = 0;
      provider.rateLimit.window = now;
    }
    
    provider.rateLimit.requests++;
    
    // Check if approaching rate limit
    const usagePercentage = (provider.rateLimit.requests / provider.rateLimit.limit) * 100;
    
    if (usagePercentage > 80) {
      this.emit('rateLimitWarning', {
        provider: providerId,
        usage: usagePercentage,
        limit: provider.rateLimit.limit
      });
    }
  }
  
  /**
   * Update overall RPC metrics
   */
  updateRPCMetrics() {
    const providers = Array.from(this.rpcProviders.values());
    const healthyProviders = providers.filter(p => p.status === 'healthy');
    
    this.networkMetrics.overall.totalRequests = providers.reduce((sum, p) => sum + p.requestCount, 0);
    this.networkMetrics.overall.successfulRequests = providers.reduce((sum, p) => sum + (p.requestCount - p.errorCount), 0);
    this.networkMetrics.overall.failedRequests = providers.reduce((sum, p) => sum + p.errorCount, 0);
    this.networkMetrics.overall.averageLatency = healthyProviders.length > 0 ?
      healthyProviders.reduce((sum, p) => sum + p.latency, 0) / healthyProviders.length : 0;
    
    // Determine overall status
    if (healthyProviders.length === providers.length) {
      this.networkMetrics.overall.status = 'healthy';
    } else if (healthyProviders.length >= providers.length * 0.7) {
      this.networkMetrics.overall.status = 'degraded';
    } else {
      this.networkMetrics.overall.status = 'unhealthy';
    }
  }
  
  /**
   * Check network performance and connectivity
   */
  async checkNetworkPerformance() {
    try {
      // Check network interfaces
      await this.checkNetworkInterfaces();
      
      // Detect network congestion
      this.detectNetworkCongestion();
      
      // Update bandwidth metrics
      this.updateBandwidthMetrics();
      
    } catch (error) {
      console.error('Network performance check failed:', error);
    }
  }
  
  /**
   * Check network interfaces
   */
  async checkNetworkInterfaces() {
    const interfaces = os.networkInterfaces();
    
    Object.entries(interfaces).forEach(([name, addresses]) => {
      if (!addresses) return;
      
      const mainAddress = addresses.find(addr => addr.family === 'IPv4' && !addr.internal);
      if (mainAddress) {
        if (!this.serverResources.network.interfaces.has(name)) {
          this.serverResources.network.interfaces.set(name, {
            address: mainAddress.address,
            bytesIn: 0,
            bytesOut: 0,
            packetsIn: 0,
            packetsOut: 0,
            errors: 0,
            drops: 0
          });
        }
        
        // In real implementation, would read actual network statistics
        // For now, mock some data
        const interfaceData = this.serverResources.network.interfaces.get(name);
        interfaceData.bytesIn += Math.floor(Math.random() * 1000000);
        interfaceData.bytesOut += Math.floor(Math.random() * 500000);
      }
    });
  }
  
  /**
   * Detect network congestion
   */
  detectNetworkCongestion() {
    const avgLatency = this.networkMetrics.overall.averageLatency;
    const errorRate = this.networkMetrics.overall.failedRequests / 
                     Math.max(1, this.networkMetrics.overall.totalRequests);
    
    let congestionScore = 0;
    const indicators = [];
    
    // Latency-based congestion detection
    if (avgLatency > 2000) {
      congestionScore += 40;
      indicators.push('high_latency');
    } else if (avgLatency > 1000) {
      congestionScore += 20;
      indicators.push('elevated_latency');
    }
    
    // Error rate-based congestion detection
    if (errorRate > 0.1) {
      congestionScore += 30;
      indicators.push('high_error_rate');
    } else if (errorRate > 0.05) {
      congestionScore += 15;
      indicators.push('elevated_error_rate');
    }
    
    // Bandwidth utilization
    if (this.networkMetrics.bandwidth.utilization > 80) {
      congestionScore += 30;
      indicators.push('high_bandwidth_usage');
    }
    
    // Update congestion metrics
    this.networkMetrics.congestion.score = congestionScore;
    this.networkMetrics.congestion.indicators = indicators;
    
    if (congestionScore > 70) {
      this.networkMetrics.congestion.level = 'high';
    } else if (congestionScore > 40) {
      this.networkMetrics.congestion.level = 'medium';
    } else {
      this.networkMetrics.congestion.level = 'low';
    }
  }
  
  /**
   * Update bandwidth metrics
   */
  updateBandwidthMetrics() {
    // Mock bandwidth calculation - in real implementation would use actual network stats
    const totalBytesIn = Array.from(this.serverResources.network.interfaces.values())
      .reduce((sum, iface) => sum + iface.bytesIn, 0);
    const totalBytesOut = Array.from(this.serverResources.network.interfaces.values())
      .reduce((sum, iface) => sum + iface.bytesOut, 0);
    
    this.serverResources.network.totalBytesIn = totalBytesIn;
    this.serverResources.network.totalBytesOut = totalBytesOut;
    
    // Calculate current usage (simplified)
    const currentUpload = Math.floor(Math.random() * 1000000); // Mock current upload
    const currentDownload = Math.floor(Math.random() * 2000000); // Mock current download
    
    this.networkMetrics.bandwidth.upload.current = currentUpload;
    this.networkMetrics.bandwidth.download.current = currentDownload;
    
    // Update peaks
    this.networkMetrics.bandwidth.upload.peak = Math.max(
      this.networkMetrics.bandwidth.upload.peak,
      currentUpload
    );
    this.networkMetrics.bandwidth.download.peak = Math.max(
      this.networkMetrics.bandwidth.download.peak,
      currentDownload
    );
  }
  
  /**
   * Check system resources
   */
  async checkSystemResources() {
    try {
      // Update system uptime
      this.serverResources.system.uptime = os.uptime();
      this.serverResources.system.loadAverage = os.loadavg();
      
      // Check CPU usage
      await this.checkCPUUsage();
      
      // Check memory usage
      this.checkMemoryUsage();
      
      // Check disk usage
      await this.checkDiskUsage();
      
      // Emit resource alerts if thresholds exceeded
      this.checkResourceThresholds();
      
    } catch (error) {
      console.error('System resource check failed:', error);
    }
  }
  
  /**
   * Check CPU usage
   */
  async checkCPUUsage() {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = Date.now();
      
      setTimeout(() => {
        const currentUsage = process.cpuUsage(startUsage);
        const elapsedTime = Date.now() - startTime;
        const elapsedUserMS = currentUsage.user / 1000;
        const elapsedSystemMS = currentUsage.system / 1000;
        const cpuPercent = ((elapsedUserMS + elapsedSystemMS) / elapsedTime) * 100;
        
        this.serverResources.cpu.usage = Math.min(100, cpuPercent);
        resolve();
      }, 100);
    });
  }
  
  /**
   * Check memory usage
   */
  checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    
    this.serverResources.memory.total = totalMem;
    this.serverResources.memory.free = freeMem;
    this.serverResources.memory.used = totalMem - freeMem;
    this.serverResources.memory.percentage = ((totalMem - freeMem) / totalMem) * 100;
    
    // Process-specific memory
    this.serverResources.memory.processHeapUsed = memUsage.heapUsed;
    this.serverResources.memory.processHeapTotal = memUsage.heapTotal;
    this.serverResources.memory.processRSS = memUsage.rss;
  }
  
  /**
   * Check disk usage
   */
  async checkDiskUsage() {
    // Mock disk usage - in real implementation would use fs.stat or similar
    const mockTotal = 1000000000000; // 1TB
    const mockUsed = Math.floor(Math.random() * 500000000000); // Up to 500GB used
    
    this.serverResources.disk.total = mockTotal;
    this.serverResources.disk.used = mockUsed;
    this.serverResources.disk.free = mockTotal - mockUsed;
    this.serverResources.disk.percentage = (mockUsed / mockTotal) * 100;
  }
  
  /**
   * Check resource thresholds and emit alerts
   */
  checkResourceThresholds() {
    const alerts = [];
    
    // CPU threshold
    if (this.serverResources.cpu.usage > this.options.cpuThreshold) {
      alerts.push({
        type: 'cpu_threshold_exceeded',
        value: this.serverResources.cpu.usage,
        threshold: this.options.cpuThreshold,
        severity: this.serverResources.cpu.usage > 95 ? 'critical' : 'high'
      });
    }
    
    // Memory threshold
    if (this.serverResources.memory.percentage > this.options.memoryThreshold) {
      alerts.push({
        type: 'memory_threshold_exceeded',
        value: this.serverResources.memory.percentage,
        threshold: this.options.memoryThreshold,
        severity: this.serverResources.memory.percentage > 95 ? 'critical' : 'high'
      });
    }
    
    // Disk threshold
    if (this.serverResources.disk.percentage > this.options.diskThreshold) {
      alerts.push({
        type: 'disk_threshold_exceeded',
        value: this.serverResources.disk.percentage,
        threshold: this.options.diskThreshold,
        severity: this.serverResources.disk.percentage > 95 ? 'critical' : 'high'
      });
    }
    
    // Emit alerts
    alerts.forEach(alert => {
      this.emit('resourceAlert', alert);
    });
  }
  
  /**
   * Check WebSocket connections
   */
  async checkWebSocketConnections() {
    for (const [connectionId, connection] of this.websocketConnections.entries()) {
      try {
        // Mock WebSocket health check
        const isConnected = Math.random() > 0.1; // 90% chance of being connected
        const latency = Math.random() * 100 + 20;
        
        connection.status = isConnected ? 'connected' : 'disconnected';
        connection.latency = isConnected ? latency : 0;
        connection.lastCheck = Date.now();
        
        if (isConnected) {
          connection.messageCount += Math.floor(Math.random() * 10);
        } else {
          connection.reconnections++;
          // In real implementation, would trigger reconnection
        }
        
      } catch (error) {
        const connection = this.websocketConnections.get(connectionId);
        connection.status = 'error';
        connection.errorCount++;
        console.error(`WebSocket ${connectionId} check failed:`, error.message);
      }
    }
  }
  
  /**
   * Check API rate limits
   */
  checkAPIRateLimits() {
    const now = Date.now();
    
    this.apiRateLimits.forEach((rateLimit, apiName) => {
      const windowSize = 60000; // 1 minute window
      
      // Reset window if needed
      if (now - rateLimit.window > windowSize) {
        rateLimit.requests = 0;
        rateLimit.window = now;
      }
      
      // Check rate limit status
      const usagePercentage = (rateLimit.requests / rateLimit.limit) * 100;
      
      if (usagePercentage > 90) {
        rateLimit.status = 'critical';
      } else if (usagePercentage > 70) {
        rateLimit.status = 'warning';
      } else {
        rateLimit.status = 'healthy';
      }
      
      // Emit rate limit warning
      if (usagePercentage > 80) {
        this.emit('rateLimitWarning', {
          api: apiName,
          usage: usagePercentage,
          limit: rateLimit.limit,
          requests: rateLimit.requests
        });
      }
    });
  }
  
  /**
   * Check network connectivity
   */
  async checkNetworkConnectivity() {
    const connectivityTests = [
      { name: 'google_dns', host: '8.8.8.8', port: 53 },
      { name: 'cloudflare_dns', host: '1.1.1.1', port: 53 },
      { name: 'ethereum_mainnet', host: 'mainnet.infura.io', port: 443 }
    ];
    
    for (const test of connectivityTests) {
      try {
        // Mock connectivity test
        const latency = Math.random() * 50 + 10;
        await new Promise(resolve => setTimeout(resolve, latency));
        
        console.log(`✅ Connectivity test ${test.name}: ${latency.toFixed(0)}ms`);
        
      } catch (error) {
        console.error(`❌ Connectivity test ${test.name} failed:`, error.message);
      }
    }
  }
  
  /**
   * Analyze performance trends
   */
  analyzePerformanceTrends() {
    const now = Date.now();
    
    // Record current metrics
    this.metricsHistory.rpcLatency.push({
      timestamp: now,
      value: this.networkMetrics.overall.averageLatency
    });
    
    this.metricsHistory.systemResources.push({
      timestamp: now,
      cpu: this.serverResources.cpu.usage,
      memory: this.serverResources.memory.percentage,
      disk: this.serverResources.disk.percentage
    });
    
    // Keep only last 24 hours of data
    const cutoff = now - 24 * 60 * 60 * 1000;
    this.metricsHistory.rpcLatency = this.metricsHistory.rpcLatency.filter(m => m.timestamp > cutoff);
    this.metricsHistory.systemResources = this.metricsHistory.systemResources.filter(m => m.timestamp > cutoff);
  }
  
  /**
   * Initialize optimization strategies
   */
  initializeOptimizations() {
    // Initialize RPC load balancing weights based on current performance
    this.rpcProviders.forEach((provider, providerId) => {
      this.optimizations.rpcLoadBalancing.weights.set(providerId, 1.0);
    });
    
    console.log('🔧 Infrastructure optimizations initialized');
  }
  
  /**
   * Perform automatic optimization
   */
  async performAutoOptimization() {
    try {
      // Optimize RPC routing
      this.optimizeRPCRouting();
      
      // Optimize caching strategies
      this.optimizeCaching();
      
      // Optimize request batching
      this.optimizeRequestBatching();
      
      this.networkMetrics.overall.lastOptimization = Date.now();
      
    } catch (error) {
      console.error('Auto-optimization failed:', error);
    }
  }
  
  /**
   * Optimize RPC routing
   */
  optimizeRPCRouting() {
    const providers = Array.from(this.rpcProviders.entries());
    const healthyProviders = providers.filter(([, p]) => p.status === 'healthy');
    
    if (healthyProviders.length === 0) return;
    
    // Update weights based on performance
    healthyProviders.forEach(([providerId, provider]) => {
      const latencyScore = Math.max(0, 1000 - provider.latency) / 1000;
      const reliabilityScore = provider.successRate / 100;
      const weight = (latencyScore * 0.6) + (reliabilityScore * 0.4);
      
      this.optimizations.rpcLoadBalancing.weights.set(providerId, weight);
    });
    
    // Re-prioritize providers
    const sortedProviders = healthyProviders.sort(([, a], [, b]) => {
      const weightA = this.optimizations.rpcLoadBalancing.weights.get(a);
      const weightB = this.optimizations.rpcLoadBalancing.weights.get(b);
      return weightB - weightA;
    });
    
    // Update priorities
    sortedProviders.forEach(([providerId, provider], index) => {
      provider.priority = index + 1;
    });
  }
  
  /**
   * Optimize caching strategies
   */
  optimizeCaching() {
    // Calculate cache hit rate
    const cacheRequests = this.networkMetrics.overall.totalRequests;
    const cacheHits = Math.floor(cacheRequests * 0.7); // Mock 70% hit rate
    
    this.optimizations.caching.hitRate = cacheHits / Math.max(1, cacheRequests);
    
    // Adjust TTL based on performance
    if (this.optimizations.caching.hitRate < 0.5) {
      this.optimizations.caching.ttl = Math.min(300000, this.optimizations.caching.ttl * 1.2);
    } else if (this.optimizations.caching.hitRate > 0.9) {
      this.optimizations.caching.ttl = Math.max(30000, this.optimizations.caching.ttl * 0.9);
    }
  }
  
  /**
   * Optimize request batching
   */
  optimizeRequestBatching() {
    const avgLatency = this.networkMetrics.overall.averageLatency;
    
    // Enable batching if latency is high
    if (avgLatency > 500 && !this.optimizations.requestBatching.enabled) {
      this.optimizations.requestBatching.enabled = true;
      this.optimizations.requestBatching.batchSize = 5;
      console.log('🔧 Enabled request batching due to high latency');
    }
    
    // Adjust batch size based on performance
    if (this.optimizations.requestBatching.enabled) {
      if (avgLatency > 1000) {
        this.optimizations.requestBatching.batchSize = Math.min(20, this.optimizations.requestBatching.batchSize + 2);
      } else if (avgLatency < 200) {
        this.optimizations.requestBatching.batchSize = Math.max(1, this.optimizations.requestBatching.batchSize - 1);
      }
    }
  }
  
  /**
   * Get infrastructure status
   */
  getInfrastructureStatus() {
    return {
      timestamp: Date.now(),
      overall: {
        status: this.calculateOverallStatus(),
        uptime: Date.now() - this.startTime,
        monitoring: this.isMonitoring
      },
      network: {
        status: this.networkMetrics.overall.status,
        averageLatency: this.networkMetrics.overall.averageLatency,
        successRate: this.calculateOverallSuccessRate(),
        congestion: this.networkMetrics.congestion
      },
      rpcProviders: this.getRPCProviderSummary(),
      websockets: this.getWebSocketSummary(),
      resources: {
        cpu: {
          usage: this.serverResources.cpu.usage,
          cores: this.serverResources.cpu.cores,
          status: this.serverResources.cpu.usage > this.options.cpuThreshold ? 'warning' : 'healthy'
        },
        memory: {
          percentage: this.serverResources.memory.percentage,
          used: this.serverResources.memory.used,
          total: this.serverResources.memory.total,
          status: this.serverResources.memory.percentage > this.options.memoryThreshold ? 'warning' : 'healthy'
        },
        disk: {
          percentage: this.serverResources.disk.percentage,
          used: this.serverResources.disk.used,
          total: this.serverResources.disk.total,
          status: this.serverResources.disk.percentage > this.options.diskThreshold ? 'warning' : 'healthy'
        }
      },
      optimizations: this.optimizations
    };
  }
  
  /**
   * Calculate overall infrastructure status
   */
  calculateOverallStatus() {
    const networkStatus = this.networkMetrics.overall.status;
    const cpuHealthy = this.serverResources.cpu.usage <= this.options.cpuThreshold;
    const memoryHealthy = this.serverResources.memory.percentage <= this.options.memoryThreshold;
    const diskHealthy = this.serverResources.disk.percentage <= this.options.diskThreshold;
    
    const healthyRPCs = Array.from(this.rpcProviders.values()).filter(p => p.status === 'healthy').length;
    const totalRPCs = this.rpcProviders.size;
    
    if (networkStatus === 'unhealthy' || !cpuHealthy || !memoryHealthy || !diskHealthy) {
      return 'critical';
    }
    
    if (networkStatus === 'degraded' || healthyRPCs < totalRPCs * 0.7) {
      return 'degraded';
    }
    
    return 'healthy';
  }
  
  /**
   * Calculate overall success rate
   */
  calculateOverallSuccessRate() {
    const total = this.networkMetrics.overall.totalRequests;
    const successful = this.networkMetrics.overall.successfulRequests;
    return total > 0 ? (successful / total) * 100 : 100;
  }
  
  /**
   * Get RPC provider summary
   */
  getRPCProviderSummary() {
    const summary = {};
    
    this.rpcProviders.forEach((provider, providerId) => {
      summary[providerId] = {
        name: provider.name,
        status: provider.status,
        latency: Math.round(provider.latency),
        successRate: Math.round(provider.successRate),
        priority: provider.priority,
        weight: this.optimizations.rpcLoadBalancing.weights.get(providerId) || 1.0
      };
    });
    
    return summary;
  }
  
  /**
   * Get WebSocket summary
   */
  getWebSocketSummary() {
    const summary = {};
    
    this.websocketConnections.forEach((connection, connectionId) => {
      summary[connectionId] = {
        status: connection.status,
        latency: Math.round(connection.latency),
        reconnections: connection.reconnections,
        messageCount: connection.messageCount,
        errorCount: connection.errorCount
      };
    });
    
    return summary;
  }
  
  /**
   * Get detailed infrastructure report
   */
  getInfrastructureReport() {
    return {
      summary: this.getInfrastructureStatus(),
      detailed: {
        rpcProviders: Object.fromEntries(this.rpcProviders),
        websocketConnections: Object.fromEntries(this.websocketConnections),
        serverResources: this.serverResources,
        networkMetrics: this.networkMetrics,
        apiRateLimits: Object.fromEntries(this.apiRateLimits),
        databaseMetrics: this.databaseMetrics,
        cacheMetrics: this.cacheMetrics
      },
      history: {
        rpcLatency: this.metricsHistory.rpcLatency.slice(-100),
        systemResources: this.metricsHistory.systemResources.slice(-100)
      },
      optimizations: this.optimizations,
      recommendations: this.generateOptimizationRecommendations()
    };
  }
  
  /**
   * Generate optimization recommendations
   */
  generateOptimizationRecommendations() {
    const recommendations = [];
    
    // High latency recommendations
    if (this.networkMetrics.overall.averageLatency > 1000) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        issue: 'High network latency',
        recommendation: 'Consider enabling request batching and switching to faster RPC providers',
        impact: 'Reduce average response time by 30-50%'
      });
    }
    
    // Resource usage recommendations
    if (this.serverResources.cpu.usage > 80) {
      recommendations.push({
        type: 'resource',
        priority: 'medium',
        issue: 'High CPU usage',
        recommendation: 'Optimize CPU-intensive operations or scale horizontally',
        impact: 'Improve system stability and response times'
      });
    }
    
    if (this.serverResources.memory.percentage > 85) {
      recommendations.push({
        type: 'resource',
        priority: 'medium',
        issue: 'High memory usage',
        recommendation: 'Implement memory optimization or increase available RAM',
        impact: 'Prevent out-of-memory errors and improve performance'
      });
    }
    
    // RPC optimization recommendations
    const unhealthyRPCs = Array.from(this.rpcProviders.values()).filter(p => p.status !== 'healthy').length;
    if (unhealthyRPCs > 0) {
      recommendations.push({
        type: 'connectivity',
        priority: 'high',
        issue: `${unhealthyRPCs} RPC provider(s) unhealthy`,
        recommendation: 'Review RPC provider configurations and consider adding backup providers',
        impact: 'Improve system reliability and reduce failover frequency'
      });
    }
    
    // Caching recommendations
    if (this.optimizations.caching.hitRate < 0.6) {
      recommendations.push({
        type: 'optimization',
        priority: 'low',
        issue: 'Low cache hit rate',
        recommendation: 'Review caching strategy and increase cache TTL for stable data',
        impact: 'Reduce external API calls and improve response times'
      });
    }
    
    return recommendations;
  }
  
  /**
   * Track API request for rate limiting
   */
  trackAPIRequest(apiName) {
    const rateLimit = this.apiRateLimits.get(apiName);
    if (rateLimit) {
      rateLimit.requests++;
    }
  }
  
  /**
   * Get rate limit status for API
   */
  getRateLimitStatus(apiName) {
    const rateLimit = this.apiRateLimits.get(apiName);
    if (!rateLimit) return null;
    
    const usagePercentage = (rateLimit.requests / rateLimit.limit) * 100;
    
    return {
      api: apiName,
      requests: rateLimit.requests,
      limit: rateLimit.limit,
      usage: usagePercentage,
      status: rateLimit.status,
      resetTime: rateLimit.window + 60000 // 1 minute window
    };
  }
  
  /**
   * Get monitoring status
   */
  getMonitoringStatus() {
    return {
      running: this.isMonitoring,
      uptime: Date.now() - this.startTime,
      lastCheck: Math.max(
        ...Array.from(this.rpcProviders.values()).map(p => p.lastCheck || 0)
      ),
      monitoredComponents: {
        rpcProviders: this.rpcProviders.size,
        websockets: this.websocketConnections.size,
        apis: this.apiRateLimits.size
      },
      overallStatus: this.calculateOverallStatus()
    };
  }
  
  /**
   * Shutdown infrastructure monitoring
   */
  async shutdown() {
    console.log('🛑 Shutting down InfrastructureMonitor...');
    
    if (this.monitoringTimer) clearInterval(this.monitoringTimer);
    if (this.networkTimer) clearInterval(this.networkTimer);
    if (this.resourceTimer) clearInterval(this.resourceTimer);
    if (this.rpcTimer) clearInterval(this.rpcTimer);
    
    this.isMonitoring = false;
    this.emit('shutdown');
    
    console.log('✅ InfrastructureMonitor shutdown complete');
  }
}

export default InfrastructureMonitor;