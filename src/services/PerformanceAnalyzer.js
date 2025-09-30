import { EventEmitter } from 'events';
import os from 'os';

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
          cores: os.cpus().length,
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
        loadAverage: os.loadavg()
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
   * Generate recommendations based on performance analysis
   */
  generateRecommendations(issues) {
    const recommendations = [];
    
    // CPU-related recommendations
    const cpuIssues = issues.filter(issue => issue.type.includes('cpu'));
    if (cpuIssues.length > 0) {
      recommendations.push({
        type: 'resource_optimization',
        priority: 'high',
        issue: 'High CPU usage detected',
        suggestion: 'Consider optimizing CPU-intensive operations or scaling horizontally',
        impact: 'Improve system stability and response times',
        estimatedImprovement: '20-30%'
      });
    }
    
    // Memory-related recommendations
    const memoryIssues = issues.filter(issue => issue.type.includes('memory'));
    if (memoryIssues.length > 0) {
      recommendations.push({
        type: 'memory_optimization',
        priority: 'medium',
        issue: 'High memory usage or potential memory leaks',
        suggestion: 'Implement memory optimization techniques and regular garbage collection',
        impact: 'Prevent out-of-memory errors and improve performance',
        estimatedImprovement: '15-25%'
      });
    }
    
    // Network-related recommendations
    const networkIssues = issues.filter(issue => issue.type.includes('network') || issue.type.includes('rpc'));
    if (networkIssues.length > 0) {
      recommendations.push({
        type: 'network_optimization',
        priority: 'high',
        issue: 'Network latency or RPC performance issues',
        suggestion: 'Optimize RPC provider selection and implement connection pooling',
        impact: 'Reduce transaction latency and improve execution speed',
        estimatedImprovement: '30-50%'
      });
    }
    
    // Trading performance recommendations
    const tradingIssues = issues.filter(issue => issue.type.includes('arbitrage') || issue.type.includes('execution'));
    if (tradingIssues.length > 0) {
      recommendations.push({
        type: 'trading_optimization',
        priority: 'critical',
        issue: 'Trading execution performance degradation',
        suggestion: 'Review arbitrage detection algorithms and execution strategies',
        impact: 'Increase profitability and reduce missed opportunities',
        estimatedImprovement: '10-40%'
      });
    }
    
    return recommendations;
  }
  
  /**
   * Detect performance bottlenecks
   */
  detectBottlenecks() {
    const bottlenecks = [];
    const currentTime = Date.now();
    
    // Check RPC latency bottlenecks
    if (this.metrics.network.rpc.avgLatency > this.options.performanceTargets.rpcLatency * 2) {
      bottlenecks.push({
        id: `bottleneck_${currentTime}_rpc`,
        type: 'rpc_latency',
        severity: 'high',
        description: 'RPC latency exceeds acceptable thresholds',
        metric: this.metrics.network.rpc.avgLatency,
        threshold: this.options.performanceTargets.rpcLatency,
        impact: 'Slower arbitrage detection and execution',
        suggestions: ['Switch RPC providers', 'Implement connection pooling', 'Use multiple providers'],
        detectedAt: currentTime
      });
    }
    
    // Check execution time bottlenecks
    const recentExecutions = this.metrics.arbitrage.performance.executionLatency.slice(-10);
    if (recentExecutions.length > 0) {
      const avgExecutionTime = recentExecutions.reduce((sum, exec) => sum + exec.value, 0) / recentExecutions.length;
      
      if (avgExecutionTime > this.options.performanceTargets.executionTime * 1.5) {
        bottlenecks.push({
          id: `bottleneck_${currentTime}_execution`,
          type: 'execution_time',
          severity: 'critical',
          description: 'Trade execution time is significantly higher than target',
          metric: avgExecutionTime,
          threshold: this.options.performanceTargets.executionTime,
          impact: 'Missed arbitrage opportunities and reduced profitability',
          suggestions: ['Optimize gas price strategy', 'Improve transaction building', 'Use MEV protection'],
          detectedAt: currentTime
        });
      }
    }
    
    // Check memory usage bottlenecks
    const memoryUsage = this.getCurrentMemoryUsage();
    if (memoryUsage > this.options.performanceTargets.memoryUsage * 1.2) {
      bottlenecks.push({
        id: `bottleneck_${currentTime}_memory`,
        type: 'memory_usage',
        severity: 'medium',
        description: 'Memory usage is approaching dangerous levels',
        metric: memoryUsage,
        threshold: this.options.performanceTargets.memoryUsage,
        impact: 'Potential system instability and crashes',
        suggestions: ['Implement memory optimization', 'Clear caches regularly', 'Check for memory leaks'],
        detectedAt: currentTime
      });
    }
    
    // Update bottlenecks
    this.bottlenecks.current = bottlenecks;
    
    // Emit bottleneck detection events
    bottlenecks.forEach(bottleneck => {
      this.emit('bottleneckDetected', bottleneck);
    });
    
    return bottlenecks;
  }
  
  /**
   * Analyze memory usage trend
   */
  analyzeMemoryTrend() {
    const memoryHistory = this.metrics.system.memory.usage.slice(-20); // Last 20 measurements
    
    if (memoryHistory.length < 5) {
      return {
        trend: 'insufficient_data',
        risk: 'unknown',
        recommendation: 'Continue monitoring'
      };
    }
    
    // Calculate trend
    const trend = this.calculateTrend(memoryHistory);
    
    // Assess risk
    let risk = 'low';
    const currentUsage = memoryHistory[memoryHistory.length - 1]?.value || 0;
    
    if (currentUsage > 90) {
      risk = 'critical';
    } else if (currentUsage > 80) {
      risk = 'high';
    } else if (trend.direction === 'increasing' && trend.magnitude > 0.1) {
      risk = 'medium';
    }
    
    // Generate recommendation
    let recommendation = 'Continue monitoring';
    
    if (risk === 'critical') {
      recommendation = 'Immediate memory cleanup required - restart services if necessary';
    } else if (risk === 'high') {
      recommendation = 'Optimize memory usage and clear caches';
    } else if (trend.direction === 'increasing') {
      recommendation = 'Monitor for potential memory leaks';
    }
    
    return {
      trend: trend.direction,
      magnitude: trend.magnitude,
      risk,
      currentUsage,
      recommendation,
      history: memoryHistory
    };
  }
  
  /**
   * Generate performance insights
   */
  generateInsights() {
    const insights = {
      optimizations: [],
      warnings: [],
      recommendations: []
    };
    
    // Analyze RPC performance
    const rpcMetrics = this.metrics.network.rpc;
    if (rpcMetrics.avgLatency > this.options.performanceTargets.rpcLatency) {
      insights.warnings.push({
        type: 'rpc_performance',
        message: `RPC latency (${rpcMetrics.avgLatency}ms) exceeds target (${this.options.performanceTargets.rpcLatency}ms)`,
        severity: 'medium',
        timestamp: Date.now()
      });
      
      insights.optimizations.push({
        area: 'network',
        suggestion: 'Consider switching to faster RPC providers or implementing connection pooling',
        expectedImprovement: '20-40% latency reduction',
        priority: 'high'
      });
    }
    
    // Analyze arbitrage performance
    const arbitrageMetrics = this.metrics.arbitrage.opportunities;
    const successRate = arbitrageMetrics.successRate;
    
    if (successRate < this.options.performanceTargets.successRate) {
      insights.warnings.push({
        type: 'arbitrage_performance',
        message: `Success rate (${successRate}%) is below target (${this.options.performanceTargets.successRate}%)`,
        severity: 'high',
        timestamp: Date.now()
      });
      
      insights.recommendations.push({
        area: 'trading',
        suggestion: 'Review arbitrage strategies and execution logic',
        expectedImprovement: `Potential to increase success rate to ${this.options.performanceTargets.successRate}%+`,
        priority: 'critical'
      });
    }
    
    // Analyze system resource usage
    const memoryTrend = this.analyzeMemoryTrend();
    if (memoryTrend.risk !== 'low') {
      insights.warnings.push({
        type: 'memory_usage',
        message: `Memory usage trend: ${memoryTrend.trend} (${memoryTrend.risk} risk)`,
        severity: memoryTrend.risk === 'critical' ? 'critical' : 'medium',
        timestamp: Date.now()
      });
      
      insights.optimizations.push({
        area: 'system',
        suggestion: memoryTrend.recommendation,
        expectedImprovement: 'Improved system stability',
        priority: memoryTrend.risk === 'critical' ? 'critical' : 'medium'
      });
    }
    
    // Update insights
    this.insights = insights;
    
    return insights;
  }
  
  /**
   * Calculate hourly profit rate
   */
  calculateHourlyProfit() {
    const hourlyProfits = this.metrics.business.profitability.hourlyProfit;
    
    if (hourlyProfits.length === 0) {
      return {
        current: 0,
        average: 0,
        trend: 'no_data',
        last24h: 0
      };
    }
    
    // Get last 24 hours of data
    const now = Date.now();
    const last24h = hourlyProfits.filter(profit => 
      now - profit.timestamp < 24 * 60 * 60 * 1000
    );
    
    const current = hourlyProfits[hourlyProfits.length - 1]?.value || 0;
    const average = last24h.length > 0 ? 
      last24h.reduce((sum, profit) => sum + profit.value, 0) / last24h.length : 0;
    const total24h = last24h.reduce((sum, profit) => sum + profit.value, 0);
    
    // Calculate trend
    const trend = this.calculateTrend(last24h.slice(-6)); // Last 6 hours
    
    return {
      current,
      average,
      trend: trend.direction,
      last24h: total24h,
      samples: last24h.length
    };
  }
  
  /**
   * Calculate execution efficiency
   */
  calculateExecutionEfficiency() {
    const opportunities = this.metrics.arbitrage.opportunities;
    const performance = this.metrics.arbitrage.performance;
    
    if (opportunities.detected === 0) {
      return {
        overall: 0,
        conversionRate: 0,
        executionScore: 0,
        profitEfficiency: 0
      };
    }
    
    // Conversion rate: executed / detected
    const conversionRate = (opportunities.executed / opportunities.detected) * 100;
    
    // Success rate: successful / executed
    const successRate = opportunities.executed > 0 ? 
      (opportunities.successful / opportunities.executed) * 100 : 0;
    
    // Execution speed score (based on average execution time)
    const avgExecutionTime = performance.executionLatency.length > 0 ?
      performance.executionLatency.reduce((sum, exec) => sum + exec.value, 0) / performance.executionLatency.length : 0;
    
    const executionScore = Math.max(0, 100 - (avgExecutionTime / this.options.performanceTargets.executionTime) * 100);
    
    // Profit efficiency (profit per executed trade)
    const profitEfficiency = opportunities.executed > 0 ? 
      opportunities.totalProfit / opportunities.executed : 0;
    
    // Overall efficiency score
    const overall = (conversionRate * 0.3 + successRate * 0.4 + executionScore * 0.3);
    
    return {
      overall: Math.min(100, overall),
      conversionRate,
      executionScore,
      profitEfficiency,
      avgExecutionTime,
      successRate
    };
  }
  
  /**
   * Calculate RPC failover rate
   */
  calculateFailoverRate() {
    const rpcMetrics = this.metrics.network.rpc;
    
    if (rpcMetrics.totalRequests === 0) {
      return {
        rate: 0,
        total: 0,
        failovers: 0,
        reliability: 100
      };
    }
    
    const failoverRate = (rpcMetrics.failoverCount / rpcMetrics.totalRequests) * 100;
    const reliability = ((rpcMetrics.successfulRequests) / rpcMetrics.totalRequests) * 100;
    
    return {
      rate: failoverRate,
      total: rpcMetrics.totalRequests,
      failovers: rpcMetrics.failoverCount,
      reliability,
      successfulRequests: rpcMetrics.successfulRequests,
      failedRequests: rpcMetrics.failedRequests
    };
  }
  
  /**
   * Get current memory usage in MB
   */
  getCurrentMemoryUsage() {
    const memoryUsage = process.memoryUsage();
    return Math.round(memoryUsage.heapUsed / 1024 / 1024); // Convert to MB
  }
  
  /**
   * Check SLA compliance
   */
  checkSLACompliance() {
    const targets = this.options.performanceTargets;
    const metrics = this.metrics;
    
    const compliance = {
      rpcLatency: {
        target: targets.rpcLatency,
        current: metrics.network.rpc.avgLatency,
        compliant: metrics.network.rpc.avgLatency <= targets.rpcLatency,
        compliance: Math.max(0, 100 - ((metrics.network.rpc.avgLatency / targets.rpcLatency) * 100))
      },
      executionTime: {
        target: targets.executionTime,
        current: this.getAverageExecutionTime(),
        compliant: this.getAverageExecutionTime() <= targets.executionTime,
        compliance: Math.max(0, 100 - ((this.getAverageExecutionTime() / targets.executionTime) * 100))
      },
      successRate: {
        target: targets.successRate,
        current: metrics.arbitrage.opportunities.successRate,
        compliant: metrics.arbitrage.opportunities.successRate >= targets.successRate,
        compliance: (metrics.arbitrage.opportunities.successRate / targets.successRate) * 100
      },
      memoryUsage: {
        target: targets.memoryUsage,
        current: this.getCurrentMemoryUsage(),
        compliant: this.getCurrentMemoryUsage() <= targets.memoryUsage,
        compliance: Math.max(0, 100 - ((this.getCurrentMemoryUsage() / targets.memoryUsage) * 100))
      }
    };
    
    // Calculate overall compliance
    const overallCompliance = Object.values(compliance).reduce((sum, metric) => {
      return sum + Math.min(100, metric.compliance);
    }, 0) / Object.keys(compliance).length;
    
    return {
      overall: overallCompliance,
      details: compliance,
      compliant: overallCompliance >= 90 // 90% compliance threshold
    };
  }
  
  /**
   * Get average execution time
   */
  getAverageExecutionTime() {
    const executions = this.metrics.arbitrage.performance.executionLatency;
    if (executions.length === 0) return 0;
    
    return executions.reduce((sum, exec) => sum + exec.value, 0) / executions.length;
  }
  
  /**
   * Calculate performance grade
   */
  calculatePerformanceGrade(issues) {
    const slaCompliance = this.checkSLACompliance();
    const efficiency = this.calculateExecutionEfficiency();
    const failoverRate = this.calculateFailoverRate();
    
    // Calculate weighted score
    const score = (
      slaCompliance.overall * 0.4 +
      efficiency.overall * 0.3 +
      failoverRate.reliability * 0.2 +
      (100 - Math.min(100, issues.length * 10)) * 0.1 // Issue penalty
    );
    
    // Convert to letter grade
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
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

export default PerformanceAnalyzer;