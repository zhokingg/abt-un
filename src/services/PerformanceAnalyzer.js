const EventEmitter = require('events');

/**
 * PerformanceAnalyzer - Phase 4: Real-time performance tracking and analytics
 * Provides comprehensive performance metrics, bottleneck detection, and optimization insights
 */
class PerformanceAnalyzer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      trackingInterval: options.trackingInterval || 5000, // 5 seconds
      metricsRetention: options.metricsRetention || 24 * 60 * 60 * 1000, // 24 hours
      performanceTargets: {
        rpcLatency: options.rpcLatency || 100, // 100ms
        executionTime: options.executionTime || 30000, // 30 seconds
        memoryUsage: options.memoryUsage || 512, // 512MB
        cpuUsage: options.cpuUsage || 70, // 70%
        successRate: options.successRate || 95, // 95%
        ...options.performanceTargets
      },
      alertThresholds: {
        latencySpike: options.latencySpike || 5, // 5x normal latency
        memoryLeak: options.memoryLeak || 1.5, // 50% increase over baseline
        errorRateSpike: options.errorRateSpike || 3, // 3x normal error rate
        ...options.alertThresholds
      },
      ...options
    };
    
    // Real-time metrics
    this.metrics = {
      arbitrage: {
        opportunities: {
          detected: 0,
          executed: 0,
          successful: 0,
          failed: 0,
          avgExecutionTime: 0,
          avgProfit: 0,
          totalProfit: 0,
          successRate: 0
        },
        performance: {
          detectionLatency: [],
          executionLatency: [],
          gasEfficiency: [],
          slippage: [],
          mevProtection: []
        }
      },
      network: {
        rpc: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          avgLatency: 0,
          latencyP95: 0,
          latencyP99: 0,
          failoverCount: 0,
          endpointHealth: new Map()
        },
        blockchain: {
          blockTime: [],
          gasPrice: [],
          networkCongestion: [],
          mevActivity: []
        }
      },
      system: {
        cpu: {
          usage: [],
          cores: require('os').cpus().length,
          loadAverage: []
        },
        memory: {
          heapUsed: [],
          heapTotal: [],
          rss: [],
          external: [],
          usage: []
        },
        performance: {
          eventLoopLag: [],
          gcTime: [],
          asyncHooks: []
        }
      },
      business: {
        profitability: {
          hourlyProfit: [],
          dailyProfit: [],
          monthlyProfit: 0,
          roi: 0,
          sharpeRatio: 0
        },
        risk: {
          maxDrawdown: 0,
          valueAtRisk: 0,
          exposureByToken: new Map(),
          riskScore: 0
        }
      }
    };
    
    // Historical data for trend analysis
    this.historicalMetrics = [];
    this.performanceBaseline = null;
    
    // Bottleneck detection
    this.bottlenecks = {
      current: [],
      resolved: [],
      recurring: new Map()
    };
    
    // Performance insights
    this.insights = {
      optimizations: [],
      warnings: [],
      recommendations: []
    };
    
    // Tracking state
    this.isTracking = false;
    this.trackingTimer = null;
    this.startTime = Date.now();
    
    // Performance measurement tools
    this.measurementPoints = new Map();
    this.activeTraces = new Map();
  }
  
  /**
   * Initialize the performance analyzer
   */
  async initialize() {
    console.log('📊 Initializing Performance Analyzer...');
    
    try {
      // Establish performance baseline
      await this.establishBaseline();
      
      // Start performance tracking
      this.startTracking();
      
      // Setup garbage collection monitoring
      this.setupGCMonitoring();
      
      // Setup event loop monitoring
      this.setupEventLoopMonitoring();
      
      console.log('✅ Performance Analyzer initialized');
      console.log(`🎯 Performance targets: RPC latency <${this.options.performanceTargets.rpcLatency}ms, Execution <${this.options.performanceTargets.executionTime/1000}s`);
      
      this.emit('initialized', {
        targets: this.options.performanceTargets,
        baselineEstablished: !!this.performanceBaseline
      });
      
    } catch (error) {
      console.error('❌ Failed to initialize Performance Analyzer:', error.message);
      throw error;
    }
  }
  
  /**
   * Establish performance baseline
   */
  async establishBaseline() {
    console.log('📏 Establishing performance baseline...');
    
    // Collect initial metrics for baseline
    const initialSample = await this.collectSystemSnapshot();
    
    this.performanceBaseline = {
      timestamp: Date.now(),
      system: {
        avgCpuUsage: initialSample.cpu.usage,
        avgMemoryUsage: initialSample.memory.usage,
        baselineLatency: 50 // ms, will be updated with actual measurements
      },
      network: {
        baselineRpcLatency: 100, // ms, will be updated
        baselineBlockTime: 12000 // ms, Ethereum average
      },
      arbitrage: {
        baselineExecutionTime: 25000, // ms, target
        baselineSuccessRate: 95 // percent
      }
    };
    
    console.log('✅ Performance baseline established');
  }
  
  /**
   * Start performance tracking
   */
  startTracking() {
    if (this.isTracking) {
      return;
    }
    
    this.isTracking = true;
    
    this.trackingTimer = setInterval(async () => {
      await this.collectMetrics();
      this.analyzePerformance();
      this.detectBottlenecks();
      this.generateInsights();
    }, this.options.trackingInterval);
    
    console.log(`📈 Performance tracking started (${this.options.trackingInterval}ms interval)`);
  }
  
  /**
   * Collect comprehensive metrics
   */
  async collectMetrics() {
    try {
      // System metrics
      const systemSnapshot = await this.collectSystemSnapshot();
      this.updateSystemMetrics(systemSnapshot);
      
      // Calculate derived metrics
      this.calculateDerivedMetrics();
      
      // Store historical data
      this.storeHistoricalData();
      
      // Emit metrics update
      this.emit('metricsUpdated', this.getSnapshot());
      
    } catch (error) {
      console.error('Failed to collect metrics:', error.message);
    }
  }
  
  /**
   * Collect system snapshot
   */
  async collectSystemSnapshot() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      timestamp: Date.now(),
      cpu: {
        usage: this.calculateCpuUsage(cpuUsage),
        loadAverage: require('os').loadavg()
      },
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss,
        external: memUsage.external,
        usage: (memUsage.heapUsed / memUsage.heapTotal) * 100
      },
      process: {
        uptime: process.uptime(),
        pid: process.pid
      }
    };
  }
  
  /**
   * Calculate CPU usage percentage
   */
  calculateCpuUsage(cpuUsage) {
    if (!this.lastCpuUsage) {
      this.lastCpuUsage = cpuUsage;
      return 0;
    }
    
    const userDiff = cpuUsage.user - this.lastCpuUsage.user;
    const systemDiff = cpuUsage.system - this.lastCpuUsage.system;
    const totalDiff = userDiff + systemDiff;
    
    this.lastCpuUsage = cpuUsage;
    
    // Convert microseconds to percentage
    return Math.min(100, (totalDiff / 1000000) * 100 / (this.options.trackingInterval / 1000));
  }
  
  /**
   * Update system metrics
   */
  updateSystemMetrics(snapshot) {
    // CPU metrics
    this.metrics.system.cpu.usage.push({
      timestamp: snapshot.timestamp,
      value: snapshot.cpu.usage
    });
    this.metrics.system.cpu.loadAverage.push({
      timestamp: snapshot.timestamp,
      value: snapshot.cpu.loadAverage[0]
    });
    
    // Memory metrics
    this.metrics.system.memory.heapUsed.push({
      timestamp: snapshot.timestamp,
      value: snapshot.memory.heapUsed
    });
    this.metrics.system.memory.usage.push({
      timestamp: snapshot.timestamp,
      value: snapshot.memory.usage
    });
    
    // Trim old data
    this.trimOldData();
  }
  
  /**
   * Trim old data to manage memory
   */
  trimOldData() {
    const cutoff = Date.now() - this.options.metricsRetention;
    
    // Trim system metrics
    for (const category of ['cpu', 'memory', 'performance']) {
      for (const metric in this.metrics.system[category]) {
        if (Array.isArray(this.metrics.system[category][metric])) {
          this.metrics.system[category][metric] = 
            this.metrics.system[category][metric].filter(point => point.timestamp > cutoff);
        }
      }
    }
    
    // Trim network metrics
    for (const metric in this.metrics.network.blockchain) {
      if (Array.isArray(this.metrics.network.blockchain[metric])) {
        this.metrics.network.blockchain[metric] = 
          this.metrics.network.blockchain[metric].filter(point => point.timestamp > cutoff);
      }
    }
    
    // Trim arbitrage performance data
    for (const metric in this.metrics.arbitrage.performance) {
      if (Array.isArray(this.metrics.arbitrage.performance[metric])) {
        this.metrics.arbitrage.performance[metric] = 
          this.metrics.arbitrage.performance[metric].filter(point => point.timestamp > cutoff);
      }
    }
  }
  
  /**
   * Calculate derived metrics
   */
  calculateDerivedMetrics() {
    // Calculate averages and percentiles
    this.metrics.network.rpc.avgLatency = this.calculateAverage(
      this.metrics.arbitrage.performance.executionLatency, 300000 // Last 5 minutes
    );
    
    this.metrics.network.rpc.latencyP95 = this.calculatePercentile(
      this.metrics.arbitrage.performance.executionLatency, 95, 300000
    );
    
    this.metrics.network.rpc.latencyP99 = this.calculatePercentile(
      this.metrics.arbitrage.performance.executionLatency, 99, 300000
    );
    
    // Calculate success rate
    if (this.metrics.arbitrage.opportunities.executed > 0) {
      this.metrics.arbitrage.opportunities.successRate = 
        (this.metrics.arbitrage.opportunities.successful / this.metrics.arbitrage.opportunities.executed) * 100;
    }
    
    // Calculate average profit
    if (this.metrics.arbitrage.opportunities.successful > 0) {
      this.metrics.arbitrage.opportunities.avgProfit = 
        this.metrics.arbitrage.opportunities.totalProfit / this.metrics.arbitrage.opportunities.successful;
    }
  }
  
  /**
   * Calculate average for time series data
   */
  calculateAverage(data, timeWindow = null) {
    if (!Array.isArray(data) || data.length === 0) return 0;
    
    let filteredData = data;
    if (timeWindow) {
      const cutoff = Date.now() - timeWindow;
      filteredData = data.filter(point => point.timestamp > cutoff);
    }
    
    if (filteredData.length === 0) return 0;
    
    const sum = filteredData.reduce((acc, point) => acc + point.value, 0);
    return sum / filteredData.length;
  }
  
  /**
   * Calculate percentile for time series data
   */
  calculatePercentile(data, percentile, timeWindow = null) {
    if (!Array.isArray(data) || data.length === 0) return 0;
    
    let filteredData = data;
    if (timeWindow) {
      const cutoff = Date.now() - timeWindow;
      filteredData = data.filter(point => point.timestamp > cutoff);
    }
    
    if (filteredData.length === 0) return 0;
    
    const sorted = filteredData.map(point => point.value).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
  
  /**
   * Analyze performance and detect issues
   */
  analyzePerformance() {
    const analysis = {
      timestamp: Date.now(),
      slaCompliance: this.checkSLACompliance(),
      performanceGrade: 'A',
      issuesDetected: [],
      recommendations: []
    };
    
    // Check RPC latency
    if (this.metrics.network.rpc.avgLatency > this.options.performanceTargets.rpcLatency) {
      analysis.issuesDetected.push({
        type: 'high_latency',
        severity: this.metrics.network.rpc.avgLatency > this.options.performanceTargets.rpcLatency * 2 ? 'critical' : 'warning',
        metric: 'rpc_latency',
        current: this.metrics.network.rpc.avgLatency,
        target: this.options.performanceTargets.rpcLatency
      });
    }
    
    // Check success rate
    if (this.metrics.arbitrage.opportunities.successRate < this.options.performanceTargets.successRate) {
      analysis.issuesDetected.push({
        type: 'low_success_rate',
        severity: this.metrics.arbitrage.opportunities.successRate < 80 ? 'critical' : 'warning',
        metric: 'success_rate',
        current: this.metrics.arbitrage.opportunities.successRate,
        target: this.options.performanceTargets.successRate
      });
    }
    
    // Check memory usage
    const currentMemoryUsage = this.getCurrentMemoryUsage();
    if (currentMemoryUsage > this.options.performanceTargets.memoryUsage) {
      analysis.issuesDetected.push({
        type: 'high_memory_usage',
        severity: currentMemoryUsage > this.options.performanceTargets.memoryUsage * 1.5 ? 'critical' : 'warning',
        metric: 'memory_usage',
        current: currentMemoryUsage,
        target: this.options.performanceTargets.memoryUsage
      });
    }
    
    // Calculate performance grade
    analysis.performanceGrade = this.calculatePerformanceGrade(analysis.issuesDetected);
    
    // Generate recommendations
    analysis.recommendations = this.generateRecommendations(analysis.issuesDetected);
    
    this.emit('performanceAnalysis', analysis);
  }
  
  /**
   * Check SLA compliance
   */
  checkSLACompliance() {
    const targets = this.options.performanceTargets;
    
    return {
      rpcLatency: {
        target: targets.rpcLatency,
        current: this.metrics.network.rpc.avgLatency,
        compliant: this.metrics.network.rpc.avgLatency <= targets.rpcLatency
      },
      successRate: {
        target: targets.successRate,
        current: this.metrics.arbitrage.opportunities.successRate,
        compliant: this.metrics.arbitrage.opportunities.successRate >= targets.successRate
      },
      executionTime: {
        target: targets.executionTime,
        current: this.metrics.arbitrage.opportunities.avgExecutionTime,
        compliant: this.metrics.arbitrage.opportunities.avgExecutionTime <= targets.executionTime
      }
    };
  }
  
  /**
   * Calculate performance grade
   */
  calculatePerformanceGrade(issues) {
    const criticalIssues = issues.filter(issue => issue.severity === 'critical').length;
    const warningIssues = issues.filter(issue => issue.severity === 'warning').length;
    
    if (criticalIssues > 0) return 'F';
    if (warningIssues > 3) return 'D';
    if (warningIssues > 2) return 'C';
    if (warningIssues > 1) return 'B';
    return 'A';
  }
  
  /**
   * Generate performance recommendations
   */
  generateRecommendations(issues) {
    const recommendations = [];
    
    for (const issue of issues) {
      switch (issue.type) {
        case 'high_latency':
          recommendations.push({
            category: 'network',
            priority: 'high',
            title: 'Optimize RPC endpoints',
            description: 'Consider adding more RPC endpoints or switching to faster providers',
            impact: 'Reduce latency by 30-50%'
          });
          break;
          
        case 'low_success_rate':
          recommendations.push({
            category: 'arbitrage',
            priority: 'critical',
            title: 'Review arbitrage strategy',
            description: 'Analyze failed trades and adjust profit thresholds or gas estimation',
            impact: 'Increase success rate by 10-15%'
          });
          break;
          
        case 'high_memory_usage':
          recommendations.push({
            category: 'system',
            priority: 'medium',
            title: 'Optimize memory usage',
            description: 'Review data retention policies and implement memory pooling',
            impact: 'Reduce memory usage by 20-30%'
          });
          break;
      }
    }
    
    return recommendations;
  }
  
  /**
   * Detect performance bottlenecks
   */
  detectBottlenecks() {
    const currentBottlenecks = [];
    
    // Network bottlenecks
    if (this.metrics.network.rpc.avgLatency > this.performanceBaseline?.network.baselineRpcLatency * 2) {
      currentBottlenecks.push({
        type: 'network_latency',
        component: 'rpc',
        severity: 'high',
        description: 'RPC latency significantly higher than baseline',
        impact: 'Delayed trade execution',
        detectedAt: Date.now()
      });
    }
    
    // Memory bottlenecks
    const memoryTrend = this.analyzeMemoryTrend();
    if (memoryTrend.isIncreasing && memoryTrend.rate > 0.1) { // 10% increase per hour
      currentBottlenecks.push({
        type: 'memory_leak',
        component: 'system',
        severity: 'medium',
        description: 'Memory usage increasing steadily',
        impact: 'Potential system instability',
        detectedAt: Date.now()
      });
    }
    
    // CPU bottlenecks
    const avgCpuUsage = this.calculateAverage(this.metrics.system.cpu.usage, 300000); // Last 5 minutes
    if (avgCpuUsage > 80) {
      currentBottlenecks.push({
        type: 'cpu_saturation',
        component: 'system',
        severity: 'high',
        description: 'High CPU usage detected',
        impact: 'Reduced processing speed',
        detectedAt: Date.now()
      });
    }
    
    this.bottlenecks.current = currentBottlenecks;
    
    if (currentBottlenecks.length > 0) {
      this.emit('bottlenecksDetected', currentBottlenecks);
    }
  }
  
  /**
   * Analyze memory usage trend
   */
  analyzeMemoryTrend() {
    const memoryData = this.metrics.system.memory.usage.slice(-12); // Last hour (5-minute intervals)
    
    if (memoryData.length < 2) {
      return { isIncreasing: false, rate: 0 };
    }
    
    const firstValue = memoryData[0].value;
    const lastValue = memoryData[memoryData.length - 1].value;
    const timeSpan = memoryData[memoryData.length - 1].timestamp - memoryData[0].timestamp;
    
    const rate = (lastValue - firstValue) / firstValue / (timeSpan / 3600000); // Rate per hour
    
    return {
      isIncreasing: rate > 0.05, // 5% increase threshold
      rate: rate,
      trend: rate > 0.1 ? 'steep' : rate > 0.05 ? 'moderate' : 'stable'
    };
  }
  
  /**
   * Generate performance insights
   */
  generateInsights() {
    const insights = [];
    
    // Profitability insights
    const hourlyProfit = this.calculateHourlyProfit();
    if (hourlyProfit > 0) {
      insights.push({
        type: 'profitability',
        category: 'positive',
        title: 'Positive Performance',
        description: `Current hourly profit rate: $${hourlyProfit.toFixed(2)}`,
        recommendation: 'Consider increasing trade size if risk tolerance allows'
      });
    }
    
    // Efficiency insights
    const executionEfficiency = this.calculateExecutionEfficiency();
    if (executionEfficiency < 0.8) {
      insights.push({
        type: 'efficiency',
        category: 'improvement',
        title: 'Execution Efficiency Below Target',
        description: `Current efficiency: ${(executionEfficiency * 100).toFixed(1)}%`,
        recommendation: 'Review gas estimation and slippage tolerance settings'
      });
    }
    
    // Network insights
    const failoverRate = this.calculateFailoverRate();
    if (failoverRate > 0.1) {
      insights.push({
        type: 'network',
        category: 'warning',
        title: 'High RPC Failover Rate',
        description: `Failover rate: ${(failoverRate * 100).toFixed(1)}%`,
        recommendation: 'Add more reliable RPC endpoints'
      });
    }
    
    this.insights.optimizations = insights;
    this.emit('insightsGenerated', insights);
  }
  
  /**
   * Calculate hourly profit rate
   */
  calculateHourlyProfit() {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    // This would be calculated from actual trade data
    return this.metrics.arbitrage.opportunities.avgProfit * 2; // Simplified calculation
  }
  
  /**
   * Calculate execution efficiency
   */
  calculateExecutionEfficiency() {
    if (this.metrics.arbitrage.opportunities.executed === 0) return 1;
    
    return this.metrics.arbitrage.opportunities.successful / this.metrics.arbitrage.opportunities.executed;
  }
  
  /**
   * Calculate RPC failover rate
   */
  calculateFailoverRate() {
    if (this.metrics.network.rpc.totalRequests === 0) return 0;
    
    return this.metrics.network.rpc.failoverCount / this.metrics.network.rpc.totalRequests;
  }
  
  /**
   * Get current memory usage in MB
   */
  getCurrentMemoryUsage() {
    const memUsage = process.memoryUsage();
    return Math.round(memUsage.heapUsed / 1024 / 1024);
  }
  
  /**
   * Store historical data for trend analysis
   */
  storeHistoricalData() {
    const snapshot = this.getSnapshot();
    
    this.historicalMetrics.push({
      timestamp: Date.now(),
      snapshot
    });
    
    // Keep only last 24 hours of historical data
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.historicalMetrics = this.historicalMetrics.filter(
      record => record.timestamp > oneDayAgo
    );
  }
  
  /**
   * Setup garbage collection monitoring
   */
  setupGCMonitoring() {
    // This would require additional setup with performance hooks
    // For now, we'll track basic GC events through process monitoring
  }
  
  /**
   * Setup event loop monitoring
   */
  setupEventLoopMonitoring() {
    // Track event loop lag
    let start = process.hrtime.bigint();
    
    setInterval(() => {
      const delta = process.hrtime.bigint() - start;
      const lag = Number(delta - BigInt(this.options.trackingInterval * 1000000)) / 1000000; // Convert to ms
      
      this.metrics.system.performance.eventLoopLag.push({
        timestamp: Date.now(),
        value: Math.max(0, lag)
      });
      
      start = process.hrtime.bigint();
    }, this.options.trackingInterval);
  }
  
  /**
   * Start performance measurement
   */
  startMeasurement(name, metadata = {}) {
    const measurementId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.measurementPoints.set(measurementId, {
      name,
      startTime: process.hrtime.bigint(),
      startTimestamp: Date.now(),
      metadata
    });
    
    return measurementId;
  }
  
  /**
   * End performance measurement
   */
  endMeasurement(measurementId, metadata = {}) {
    const measurement = this.measurementPoints.get(measurementId);
    if (!measurement) {
      console.warn(`Measurement not found: ${measurementId}`);
      return null;
    }
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - measurement.startTime) / 1000000; // Convert to milliseconds
    
    const result = {
      name: measurement.name,
      duration,
      startTime: measurement.startTimestamp,
      endTime: Date.now(),
      metadata: { ...measurement.metadata, ...metadata }
    };
    
    // Store in appropriate metrics category
    this.recordMeasurement(result);
    
    this.measurementPoints.delete(measurementId);
    
    return result;
  }
  
  /**
   * Record measurement in appropriate metrics category
   */
  recordMeasurement(measurement) {
    const category = this.categorizeMetric(measurement.name);
    
    switch (category) {
      case 'arbitrage':
        this.metrics.arbitrage.performance.executionLatency.push({
          timestamp: measurement.endTime,
          value: measurement.duration
        });
        break;
        
      case 'network':
        this.metrics.arbitrage.performance.detectionLatency.push({
          timestamp: measurement.endTime,
          value: measurement.duration
        });
        break;
        
      default:
        // Store in general performance metrics
        if (!this.metrics.system.performance.customMetrics) {
          this.metrics.system.performance.customMetrics = [];
        }
        this.metrics.system.performance.customMetrics.push({
          timestamp: measurement.endTime,
          name: measurement.name,
          value: measurement.duration
        });
    }
  }
  
  /**
   * Categorize metric by name
   */
  categorizeMetric(name) {
    if (name.includes('arbitrage') || name.includes('trade') || name.includes('execution')) {
      return 'arbitrage';
    }
    if (name.includes('rpc') || name.includes('network') || name.includes('connection')) {
      return 'network';
    }
    return 'system';
  }
  
  /**
   * Get current performance snapshot
   */
  getSnapshot() {
    return {
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
      metrics: JSON.parse(JSON.stringify(this.metrics)),
      bottlenecks: this.bottlenecks.current,
      insights: this.insights,
      performance: {
        grade: this.calculatePerformanceGrade([]),
        slaCompliance: this.checkSLACompliance(),
        efficiency: this.calculateExecutionEfficiency()
      }
    };
  }
  
  /**
   * Get comprehensive performance report
   */
  getPerformanceReport() {
    return {
      summary: {
        uptime: Date.now() - this.startTime,
        totalOpportunities: this.metrics.arbitrage.opportunities.detected,
        successRate: this.metrics.arbitrage.opportunities.successRate,
        totalProfit: this.metrics.arbitrage.opportunities.totalProfit,
        avgLatency: this.metrics.network.rpc.avgLatency,
        performanceGrade: this.calculatePerformanceGrade([])
      },
      current: this.getSnapshot(),
      trends: this.analyzeTrends(),
      bottlenecks: {
        current: this.bottlenecks.current,
        resolved: this.bottlenecks.resolved.slice(-10), // Last 10 resolved
        recurring: Array.from(this.bottlenecks.recurring.entries())
      },
      recommendations: this.insights.optimizations
    };
  }
  
  /**
   * Analyze performance trends
   */
  analyzeTrends() {
    const trends = {};
    
    // Profit trend
    const profitData = this.metrics.business.profitability.hourlyProfit.slice(-24); // Last 24 hours
    trends.profit = this.calculateTrend(profitData);
    
    // Latency trend
    const latencyData = this.metrics.arbitrage.performance.executionLatency.slice(-100); // Last 100 measurements
    trends.latency = this.calculateTrend(latencyData);
    
    // Success rate trend
    trends.successRate = {
      current: this.metrics.arbitrage.opportunities.successRate,
      direction: 'stable' // Would be calculated from historical data
    };
    
    return trends;
  }
  
  /**
   * Calculate trend direction and magnitude
   */
  calculateTrend(data) {
    if (!data || data.length < 2) {
      return { direction: 'stable', magnitude: 0 };
    }
    
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, point) => sum + point.value, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, point) => sum + point.value, 0) / secondHalf.length;
    
    const change = (secondAvg - firstAvg) / firstAvg;
    
    return {
      direction: change > 0.05 ? 'increasing' : change < -0.05 ? 'decreasing' : 'stable',
      magnitude: Math.abs(change),
      change: change * 100 // Percentage change
    };
  }
  
  /**
   * Record arbitrage metrics
   */
  recordArbitrageOpportunity(opportunity) {
    this.metrics.arbitrage.opportunities.detected++;
    this.emit('opportunityRecorded', opportunity);
  }
  
  recordTradeExecution(trade) {
    this.metrics.arbitrage.opportunities.executed++;
    
    if (trade.success) {
      this.metrics.arbitrage.opportunities.successful++;
      this.metrics.arbitrage.opportunities.totalProfit += trade.actualProfit;
    } else {
      this.metrics.arbitrage.opportunities.failed++;
    }
    
    // Record execution time
    this.metrics.arbitrage.performance.executionLatency.push({
      timestamp: Date.now(),
      value: trade.executionTime
    });
    
    this.emit('tradeRecorded', trade);
  }
  
  recordRPCRequest(endpoint, latency, success) {
    this.metrics.network.rpc.totalRequests++;
    
    if (success) {
      this.metrics.network.rpc.successfulRequests++;
    } else {
      this.metrics.network.rpc.failedRequests++;
    }
    
    // Update endpoint health
    this.metrics.network.rpc.endpointHealth.set(endpoint, {
      lastLatency: latency,
      isHealthy: success,
      timestamp: Date.now()
    });
    
    this.emit('rpcRequestRecorded', { endpoint, latency, success });
  }
  
  /**
   * Shutdown performance analyzer
   */
  async shutdown() {
    console.log('🛑 Shutting down Performance Analyzer...');
    
    this.isTracking = false;
    
    if (this.trackingTimer) {
      clearInterval(this.trackingTimer);
      this.trackingTimer = null;
    }
    
    this.emit('shutdown');
    console.log('✅ Performance Analyzer shutdown complete');
  }
}

module.exports = PerformanceAnalyzer;