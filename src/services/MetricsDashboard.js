import { EventEmitter } from 'events';
import express from 'express';

/**
 * MetricsDashboard - Real-time Performance Metrics Dashboard
 * Provides comprehensive real-time dashboard with live performance charts,
 * KPIs, system health status, and risk exposure visualization
 */
class MetricsDashboard extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      port: options.port || 3000,
      updateInterval: options.updateInterval || 1000, // 1 second
      retentionPeriod: options.retentionPeriod || 24 * 60 * 60 * 1000, // 24 hours
      enableWebSocket: options.enableWebSocket !== false,
      enableRestAPI: options.enableRestAPI !== false,
      enableAuthentication: options.enableAuthentication || false,
      maxConcurrentUsers: options.maxConcurrentUsers || 50,
      ...options
    };
    
    // Real-time metrics store
    this.metricsStore = {
      trading: {
        profitLoss: { current: 0, history: [], trend: 'stable' },
        winRate: { current: 0, history: [], target: 85 },
        averageProfit: { current: 0, history: [], trend: 'up' },
        totalTrades: { successful: 0, failed: 0, pending: 0 },
        executionSpeed: { current: 0, history: [], target: 500 }, // ms
        successRate: { current: 100, history: [], target: 95 }
      },
      system: {
        cpuUsage: { current: 0, history: [], threshold: 80 },
        memoryUsage: { current: 0, history: [], threshold: 85 },
        networkLatency: { current: 0, history: [], threshold: 200 },
        diskUsage: { current: 0, history: [], threshold: 90 },
        uptime: { current: 0, startTime: Date.now() }
      },
      market: {
        opportunityRate: { current: 0, history: [], trend: 'stable' },
        marketCondition: { current: 'normal', history: [], indicators: {} },
        gasPrice: { current: 0, history: [], trend: 'stable' },
        networkCongestion: { current: 0, history: [], threshold: 70 },
        mevActivity: { current: 0, history: [], trend: 'stable' }
      },
      risk: {
        currentExposure: { current: 0, history: [], limit: 100000 },
        riskScore: { current: 0, history: [], threshold: 75 },
        drawdown: { current: 0, max: 0, history: [] },
        slippageAnalysis: { current: 0, history: [], threshold: 2 },
        concentrationRisk: { current: 0, history: [], threshold: 30 }
      },
      network: {
        rpcHealth: { endpoints: new Map(), overall: 'healthy' },
        websocketStatus: { connected: false, latency: 0, reconnects: 0 },
        apiStatus: { services: new Map(), overall: 'operational' },
        flashbotsStatus: { connected: false, successRate: 0 },
        dexConnectivity: { uniswapV2: 'healthy', uniswapV3: 'healthy' }
      }
    };
    
    // Dashboard state
    this.dashboardState = {
      activeUsers: 0,
      lastUpdate: Date.now(),
      alertsCount: { critical: 0, high: 0, medium: 0, low: 0 },
      systemHealth: 'healthy',
      tradingActive: false,
      emergencyStop: false
    };
    
    // KPI definitions with color-coded status
    this.kpis = {
      hourlyProfit: { 
        value: 0, 
        target: 100, 
        status: 'neutral',
        format: 'currency'
      },
      executionLatency: { 
        value: 0, 
        target: 500, 
        status: 'good',
        format: 'ms',
        direction: 'lower' // lower is better
      },
      successRate: { 
        value: 100, 
        target: 95, 
        status: 'excellent',
        format: 'percentage'
      },
      riskExposure: { 
        value: 0, 
        target: 75, 
        status: 'safe',
        format: 'percentage',
        direction: 'lower'
      },
      networkHealth: { 
        value: 100, 
        target: 95, 
        status: 'excellent',
        format: 'percentage'
      }
    };
    
    // Express app for REST API
    this.app = null;
    this.server = null;
    this.wsServer = null;
    this.connectedClients = new Set();
    
    // Update timers
    this.updateTimer = null;
    this.cleanupTimer = null;
    
    this.isRunning = false;
  }
  
  /**
   * Initialize the dashboard
   */
  async initialize() {
    try {
      if (this.options.enableRestAPI) {
        await this.initializeWebServer();
      }
      
      if (this.options.enableWebSocket) {
        await this.initializeWebSocket();
      }
      
      this.startMetricsCollection();
      this.startDataCleanup();
      
      this.isRunning = true;
      this.emit('initialized');
      
      console.log(`📊 MetricsDashboard initialized on port ${this.options.port}`);
      
    } catch (error) {
      console.error('Failed to initialize MetricsDashboard:', error);
      throw error;
    }
  }
  
  /**
   * Initialize Express web server
   */
  async initializeWebServer() {
    this.app = express();
    this.app.use(express.json());
    this.app.use(express.static('public')); // For static dashboard files
    
    // CORS middleware
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      next();
    });
    
    // API routes
    this.setupAPIRoutes();
    
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.options.port, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
  
  /**
   * Setup API routes
   */
  setupAPIRoutes() {
    // Real-time metrics endpoint
    this.app.get('/api/metrics', (req, res) => {
      res.json({
        timestamp: Date.now(),
        metrics: this.metricsStore,
        kpis: this.kpis,
        dashboardState: this.dashboardState
      });
    });
    
    // Historical data endpoint
    this.app.get('/api/metrics/history/:category/:metric', (req, res) => {
      const { category, metric } = req.params;
      const { timeRange = '1h' } = req.query;
      
      const data = this.getHistoricalData(category, metric, timeRange);
      res.json({
        category,
        metric,
        timeRange,
        data
      });
    });
    
    // System health endpoint
    this.app.get('/api/health', (req, res) => {
      res.json({
        timestamp: Date.now(),
        overall: this.dashboardState.systemHealth,
        components: {
          trading: this.calculateComponentHealth('trading'),
          system: this.calculateComponentHealth('system'),
          network: this.calculateComponentHealth('network'),
          risk: this.calculateComponentHealth('risk')
        },
        uptime: Date.now() - this.metricsStore.system.uptime.startTime,
        alerts: this.dashboardState.alertsCount
      });
    });
    
    // Live performance charts data
    this.app.get('/api/charts/:chart', (req, res) => {
      const { chart } = req.params;
      const chartData = this.generateChartData(chart);
      res.json({
        chart,
        timestamp: Date.now(),
        data: chartData
      });
    });
    
    // KPI dashboard data
    this.app.get('/api/kpis', (req, res) => {
      res.json({
        timestamp: Date.now(),
        kpis: this.kpis,
        trends: this.calculateKPITrends()
      });
    });
    
    // Risk exposure visualization
    this.app.get('/api/risk', (req, res) => {
      res.json({
        timestamp: Date.now(),
        exposure: this.metricsStore.risk,
        breakdown: this.generateRiskBreakdown(),
        alerts: this.getRiskAlerts()
      });
    });
    
    // Network status indicators
    this.app.get('/api/network', (req, res) => {
      res.json({
        timestamp: Date.now(),
        status: this.metricsStore.network,
        connectivity: this.getNetworkConnectivity(),
        performance: this.getNetworkPerformance()
      });
    });
    
    // Active opportunities tracking
    this.app.get('/api/opportunities', (req, res) => {
      res.json({
        timestamp: Date.now(),
        active: this.getActiveOpportunities(),
        recent: this.getRecentOpportunities(),
        statistics: this.getOpportunityStatistics()
      });
    });
  }
  
  /**
   * Initialize WebSocket server for real-time updates
   */
  async initializeWebSocket() {
    // This would typically use socket.io or ws library
    // For now, implementing a simple concept
    console.log('WebSocket server would be initialized here');
  }
  
  /**
   * Start metrics collection
   */
  startMetricsCollection() {
    this.updateTimer = setInterval(() => {
      this.collectMetrics();
      this.updateKPIs();
      this.broadcastUpdate();
    }, this.options.updateInterval);
  }
  
  /**
   * Collect current metrics
   */
  collectMetrics() {
    const now = Date.now();
    
    // Update system metrics
    this.updateSystemMetrics();
    
    // Update dashboard state
    this.dashboardState.lastUpdate = now;
    this.dashboardState.systemHealth = this.calculateOverallHealth();
    
    // Emit metrics update event
    this.emit('metricsUpdated', {
      timestamp: now,
      metrics: this.metricsStore,
      kpis: this.kpis
    });
  }
  
  /**
   * Update system metrics
   */
  updateSystemMetrics() {
    const memUsage = process.memoryUsage();
    const now = Date.now();
    
    // Memory usage
    const memoryPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    this.addMetricPoint('system', 'memoryUsage', memoryPercent, now);
    
    // Uptime
    this.metricsStore.system.uptime.current = Date.now() - this.metricsStore.system.uptime.startTime;
    
    // Clean old data points
    this.cleanOldMetrics(now);
  }
  
  /**
   * Add a metric data point
   */
  addMetricPoint(category, metric, value, timestamp = Date.now()) {
    if (this.metricsStore[category] && this.metricsStore[category][metric]) {
      this.metricsStore[category][metric].current = value;
      this.metricsStore[category][metric].history.push({
        timestamp,
        value
      });
    }
  }
  
  /**
   * Update trading metrics
   */
  updateTradingMetrics(data) {
    const { profitLoss, executionTime, success, gasUsed } = data;
    
    if (success) {
      this.metricsStore.trading.totalTrades.successful++;
      this.addMetricPoint('trading', 'profitLoss', profitLoss);
    } else {
      this.metricsStore.trading.totalTrades.failed++;
    }
    
    this.addMetricPoint('trading', 'executionSpeed', executionTime);
    
    // Calculate success rate
    const total = this.metricsStore.trading.totalTrades.successful + 
                  this.metricsStore.trading.totalTrades.failed;
    const successRate = total > 0 ? 
      (this.metricsStore.trading.totalTrades.successful / total) * 100 : 100;
    
    this.addMetricPoint('trading', 'successRate', successRate);
  }
  
  /**
   * Update market metrics
   */
  updateMarketMetrics(data) {
    const { gasPrice, networkCongestion, opportunityRate, mevActivity } = data;
    
    if (gasPrice) this.addMetricPoint('market', 'gasPrice', gasPrice);
    if (networkCongestion) this.addMetricPoint('market', 'networkCongestion', networkCongestion);
    if (opportunityRate) this.addMetricPoint('market', 'opportunityRate', opportunityRate);
    if (mevActivity) this.addMetricPoint('market', 'mevActivity', mevActivity);
  }
  
  /**
   * Update risk metrics
   */
  updateRiskMetrics(data) {
    const { exposure, riskScore, drawdown, slippage } = data;
    
    if (exposure !== undefined) this.addMetricPoint('risk', 'currentExposure', exposure);
    if (riskScore !== undefined) this.addMetricPoint('risk', 'riskScore', riskScore);
    if (drawdown !== undefined) this.addMetricPoint('risk', 'drawdown', drawdown);
    if (slippage !== undefined) this.addMetricPoint('risk', 'slippageAnalysis', slippage);
  }
  
  /**
   * Update network metrics
   */
  updateNetworkMetrics(data) {
    const { rpcLatency, websocketStatus, apiResponses } = data;
    
    if (rpcLatency) this.addMetricPoint('system', 'networkLatency', rpcLatency);
    
    if (websocketStatus) {
      this.metricsStore.network.websocketStatus = {
        ...this.metricsStore.network.websocketStatus,
        ...websocketStatus
      };
    }
    
    if (apiResponses) {
      Object.entries(apiResponses).forEach(([service, status]) => {
        this.metricsStore.network.apiStatus.services.set(service, status);
      });
    }
  }
  
  /**
   * Update KPIs with color-coded status
   */
  updateKPIs() {
    // Hourly profit
    const recentProfits = this.getRecentMetrics('trading', 'profitLoss', 3600000); // 1 hour
    const hourlyProfit = recentProfits.reduce((sum, point) => sum + point.value, 0);
    this.kpis.hourlyProfit.value = hourlyProfit;
    this.kpis.hourlyProfit.status = this.calculateKPIStatus('hourlyProfit', hourlyProfit);
    
    // Execution latency
    const avgLatency = this.metricsStore.trading.executionSpeed.current;
    this.kpis.executionLatency.value = avgLatency;
    this.kpis.executionLatency.status = this.calculateKPIStatus('executionLatency', avgLatency);
    
    // Success rate
    const successRate = this.metricsStore.trading.successRate.current;
    this.kpis.successRate.value = successRate;
    this.kpis.successRate.status = this.calculateKPIStatus('successRate', successRate);
    
    // Risk exposure
    const riskExposure = this.metricsStore.risk.riskScore.current;
    this.kpis.riskExposure.value = riskExposure;
    this.kpis.riskExposure.status = this.calculateKPIStatus('riskExposure', riskExposure);
    
    // Network health
    const networkHealth = this.calculateNetworkHealth();
    this.kpis.networkHealth.value = networkHealth;
    this.kpis.networkHealth.status = this.calculateKPIStatus('networkHealth', networkHealth);
  }
  
  /**
   * Calculate KPI status based on value and target
   */
  calculateKPIStatus(kpiName, value) {
    const kpi = this.kpis[kpiName];
    const isLowerBetter = kpi.direction === 'lower';
    
    let status;
    if (isLowerBetter) {
      if (value <= kpi.target * 0.8) status = 'excellent';
      else if (value <= kpi.target) status = 'good';
      else if (value <= kpi.target * 1.2) status = 'warning';
      else status = 'critical';
    } else {
      if (value >= kpi.target * 1.1) status = 'excellent';
      else if (value >= kpi.target) status = 'good';
      else if (value >= kpi.target * 0.8) status = 'warning';
      else status = 'critical';
    }
    
    return status;
  }
  
  /**
   * Get historical data for specific metric
   */
  getHistoricalData(category, metric, timeRange) {
    if (!this.metricsStore[category] || !this.metricsStore[category][metric]) {
      return [];
    }
    
    const history = this.metricsStore[category][metric].history || [];
    const now = Date.now();
    let cutoff;
    
    switch (timeRange) {
      case '5m': cutoff = now - 5 * 60 * 1000; break;
      case '15m': cutoff = now - 15 * 60 * 1000; break;
      case '1h': cutoff = now - 60 * 60 * 1000; break;
      case '6h': cutoff = now - 6 * 60 * 60 * 1000; break;
      case '24h': cutoff = now - 24 * 60 * 60 * 1000; break;
      default: cutoff = now - 60 * 60 * 1000; // Default 1 hour
    }
    
    return history.filter(point => point.timestamp >= cutoff);
  }
  
  /**
   * Generate chart data for dashboard
   */
  generateChartData(chartType) {
    switch (chartType) {
      case 'profit-trend':
        return this.generateProfitTrendChart();
      case 'execution-performance':
        return this.generateExecutionPerformanceChart();
      case 'system-resources':
        return this.generateSystemResourcesChart();
      case 'risk-exposure':
        return this.generateRiskExposureChart();
      case 'network-latency':
        return this.generateNetworkLatencyChart();
      default:
        return { labels: [], datasets: [] };
    }
  }
  
  /**
   * Generate profit trend chart data
   */
  generateProfitTrendChart() {
    const profitHistory = this.getHistoricalData('trading', 'profitLoss', '24h');
    
    return {
      labels: profitHistory.map(point => new Date(point.timestamp).toLocaleTimeString()),
      datasets: [{
        label: 'Profit/Loss',
        data: profitHistory.map(point => point.value),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4
      }]
    };
  }
  
  /**
   * Generate execution performance chart
   */
  generateExecutionPerformanceChart() {
    const latencyHistory = this.getHistoricalData('trading', 'executionSpeed', '1h');
    const successHistory = this.getHistoricalData('trading', 'successRate', '1h');
    
    return {
      labels: latencyHistory.map(point => new Date(point.timestamp).toLocaleTimeString()),
      datasets: [
        {
          label: 'Execution Time (ms)',
          data: latencyHistory.map(point => point.value),
          borderColor: 'rgb(59, 130, 246)',
          yAxisID: 'y'
        },
        {
          label: 'Success Rate (%)',
          data: successHistory.map(point => point.value),
          borderColor: 'rgb(16, 185, 129)',
          yAxisID: 'y1'
        }
      ]
    };
  }
  
  /**
   * Broadcast real-time updates to connected clients
   */
  broadcastUpdate() {
    if (this.connectedClients.size > 0) {
      const updateData = {
        timestamp: Date.now(),
        type: 'metrics-update',
        data: {
          metrics: this.metricsStore,
          kpis: this.kpis,
          dashboardState: this.dashboardState
        }
      };
      
      // Broadcast to WebSocket clients
      this.connectedClients.forEach(client => {
        try {
          client.send(JSON.stringify(updateData));
        } catch (error) {
          console.error('Failed to send update to client:', error);
          this.connectedClients.delete(client);
        }
      });
    }
  }
  
  /**
   * Calculate overall system health
   */
  calculateOverallHealth() {
    const components = [
      this.calculateComponentHealth('trading'),
      this.calculateComponentHealth('system'),
      this.calculateComponentHealth('network'),
      this.calculateComponentHealth('risk')
    ];
    
    if (components.some(health => health === 'critical')) return 'critical';
    if (components.some(health => health === 'warning')) return 'warning';
    if (components.every(health => health === 'healthy')) return 'healthy';
    return 'degraded';
  }
  
  /**
   * Calculate component health status
   */
  calculateComponentHealth(category) {
    const metrics = this.metricsStore[category];
    if (!metrics) return 'unknown';
    
    // Component-specific health logic
    switch (category) {
      case 'trading':
        return this.calculateTradingHealth(metrics);
      case 'system':
        return this.calculateSystemHealth(metrics);
      case 'network':
        return this.calculateNetworkHealth();
      case 'risk':
        return this.calculateRiskHealth(metrics);
      default:
        return 'unknown';
    }
  }
  
  /**
   * Calculate trading component health
   */
  calculateTradingHealth(metrics) {
    const successRate = metrics.successRate.current;
    const avgLatency = metrics.executionSpeed.current;
    
    if (successRate < 80 || avgLatency > 10000) return 'critical';
    if (successRate < 90 || avgLatency > 5000) return 'warning';
    return 'healthy';
  }
  
  /**
   * Calculate system component health
   */
  calculateSystemHealth(metrics) {
    const cpuUsage = metrics.cpuUsage.current;
    const memoryUsage = metrics.memoryUsage.current;
    const networkLatency = metrics.networkLatency.current;
    
    if (cpuUsage > 90 || memoryUsage > 95 || networkLatency > 2000) return 'critical';
    if (cpuUsage > 80 || memoryUsage > 85 || networkLatency > 1000) return 'warning';
    return 'healthy';
  }
  
  /**
   * Calculate network health
   */
  calculateNetworkHealth() {
    const rpcHealth = this.metricsStore.network.rpcHealth.overall;
    const wsConnected = this.metricsStore.network.websocketStatus.connected;
    const apiStatus = this.metricsStore.network.apiStatus.overall;
    
    if (rpcHealth === 'critical' || !wsConnected || apiStatus === 'down') return 0; // 0% health
    if (rpcHealth === 'warning' || apiStatus === 'degraded') return 70; // 70% health
    return 100; // 100% health
  }
  
  /**
   * Clean old metric data points
   */
  cleanOldMetrics(currentTime) {
    const cutoff = currentTime - this.options.retentionPeriod;
    
    Object.values(this.metricsStore).forEach(category => {
      Object.values(category).forEach(metric => {
        if (metric.history) {
          metric.history = metric.history.filter(point => point.timestamp >= cutoff);
        }
      });
    });
  }
  
  /**
   * Start periodic data cleanup
   */
  startDataCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanOldMetrics(Date.now());
    }, 300000); // Every 5 minutes
  }
  
  /**
   * Get dashboard configuration for frontend
   */
  getDashboardConfig() {
    return {
      updateInterval: this.options.updateInterval,
      maxConcurrentUsers: this.options.maxConcurrentUsers,
      availableCharts: [
        'profit-trend',
        'execution-performance', 
        'system-resources',
        'risk-exposure',
        'network-latency'
      ],
      kpiDefinitions: this.kpis,
      thresholds: {
        trading: { successRate: 90, executionTime: 5000 },
        system: { cpu: 80, memory: 85, latency: 1000 },
        risk: { exposure: 75, drawdown: 20 }
      }
    };
  }
  
  /**
   * Shutdown dashboard
   */
  async shutdown() {
    console.log('🛑 Shutting down MetricsDashboard...');
    
    if (this.updateTimer) clearInterval(this.updateTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    
    if (this.server) {
      await new Promise(resolve => this.server.close(resolve));
    }
    
    this.connectedClients.clear();
    this.isRunning = false;
    
    this.emit('shutdown');
    console.log('✅ MetricsDashboard shutdown complete');
  }
  
  /**
   * Get current dashboard status
   */
  getStatus() {
    return {
      running: this.isRunning,
      uptime: Date.now() - this.metricsStore.system.uptime.startTime,
      activeUsers: this.connectedClients.size,
      metricsCount: this.getTotalMetricsCount(),
      lastUpdate: this.dashboardState.lastUpdate,
      systemHealth: this.dashboardState.systemHealth
    };
  }
  
  /**
   * Get total metrics count
   */
  getTotalMetricsCount() {
    let count = 0;
    Object.values(this.metricsStore).forEach(category => {
      Object.values(category).forEach(metric => {
        if (metric.history) count += metric.history.length;
      });
    });
    return count;
  }
}

export default MetricsDashboard;