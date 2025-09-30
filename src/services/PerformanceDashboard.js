import { EventEmitter } from 'events';
import WebSocket, { WebSocketServer } from 'ws';

/**
 * PerformanceDashboard - Real-time performance tracking and visualization
 * Provides comprehensive P&L tracking, trade statistics, system health, and risk metrics
 */
class PerformanceDashboard extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      updateInterval: options.updateInterval || 1000, // 1 second for real-time
      metricsRetention: options.metricsRetention || 24 * 60 * 60 * 1000, // 24 hours
      webSocketPort: options.webSocketPort || 8080,
      enableWebSocket: options.enableWebSocket !== false,
      maxConnections: options.maxConnections || 100,
      ...options
    };
    
    // Real-time metrics
    this.metrics = {
      pnl: {
        current: 0,
        daily: 0,
        weekly: 0,
        monthly: 0,
        totalProfit: 0,
        totalLoss: 0,
        netPnL: 0,
        profitability: 0,
        winRate: 0,
        lossRate: 0,
        averageWin: 0,
        averageLoss: 0,
        lastUpdated: Date.now()
      },
      trades: {
        total: 0,
        successful: 0,
        failed: 0,
        pending: 0,
        successRate: 0,
        averageExecutionTime: 0,
        fastestExecution: 0,
        slowestExecution: 0,
        totalGasCost: 0,
        averageGasCost: 0
      },
      opportunities: {
        detected: 0,
        analyzed: 0,
        executed: 0,
        skipped: 0,
        conversionRate: 0,
        averageSpread: 0,
        bestSpread: 0,
        averageConfidence: 0
      },
      system: {
        cpu: 0,
        memory: 0,
        networkLatency: 0,
        rpcLatency: 0,
        uptime: 0,
        errors: 0,
        warnings: 0,
        status: 'healthy'
      },
      risk: {
        currentExposure: 0,
        maxExposure: 0,
        riskScore: 0,
        drawdown: 0,
        maxDrawdown: 0,
        circuitBreakerStatus: 'normal',
        volatility: 0,
        correlation: 0
      },
      gas: {
        currentPrice: 0,
        averagePrice: 0,
        totalCost: 0,
        optimization: 0,
        savings: 0,
        efficiency: 0
      },
      roi: {
        daily: 0,
        weekly: 0,
        monthly: 0,
        annualized: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
        maxDrawdown: 0,
        recoveryFactor: 0
      }
    };
    
    // Performance history for charts
    this.history = {
      pnl: [],
      trades: [],
      opportunities: [],
      system: [],
      gas: [],
      timestamps: []
    };
    
    // WebSocket server for real-time updates
    this.wsServer = null;
    this.wsConnections = new Set();
    
    // Update intervals
    this.updateInterval = null;
    this.cleanupInterval = null;
    
    // Performance tracking
    this.sessionStart = Date.now();
    this.lastMetricsUpdate = Date.now();
    
    // Initialization flag
    this.isInitialized = false;
  }
  
  /**
   * Initialize the performance dashboard
   */
  async initialize() {
    console.log('🚀 Initializing Performance Dashboard...');
    
    try {
      // Setup WebSocket server if enabled
      if (this.options.enableWebSocket) {
        await this.setupWebSocketServer();
      }
      
      // Start metrics collection
      this.startMetricsCollection();
      
      // Setup cleanup timer
      this.setupCleanupTimer();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      console.log('✅ Performance Dashboard initialized successfully');
      
    } catch (error) {
      console.error('❌ Performance Dashboard initialization failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Setup WebSocket server for real-time updates
   */
  async setupWebSocketServer() {
    return new Promise((resolve, reject) => {
      try {
        this.wsServer = new WebSocketServer({ 
          port: this.options.webSocketPort,
          maxPayload: 1024 * 1024 // 1MB max payload
        });
        
        this.wsServer.on('connection', (ws, req) => {
          // Connection limit check
          if (this.wsConnections.size >= this.options.maxConnections) {
            ws.close(1008, 'Connection limit exceeded');
            return;
          }
          
          this.wsConnections.add(ws);
          console.log(`📱 Dashboard client connected. Total: ${this.wsConnections.size}`);
          
          // Send initial metrics
          this.sendMetricsToClient(ws);
          
          ws.on('close', () => {
            this.wsConnections.delete(ws);
            console.log(`📱 Dashboard client disconnected. Total: ${this.wsConnections.size}`);
          });
          
          ws.on('error', (error) => {
            console.warn('WebSocket error:', error.message);
            this.wsConnections.delete(ws);
          });
          
          ws.on('message', (message) => {
            try {
              const data = JSON.parse(message);
              this.handleClientMessage(ws, data);
            } catch (error) {
              console.warn('Invalid WebSocket message:', error.message);
            }
          });
        });
        
        this.wsServer.on('error', reject);
        this.wsServer.on('listening', () => {
          console.log(`🌐 WebSocket server listening on port ${this.options.webSocketPort}`);
          resolve();
        });
        
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Handle client messages
   */
  handleClientMessage(ws, data) {
    switch (data.type) {
      case 'subscribe':
        // Handle subscription to specific metrics
        ws.subscriptions = data.metrics || ['all'];
        break;
        
      case 'unsubscribe':
        // Handle unsubscription
        ws.subscriptions = [];
        break;
        
      case 'getHistory':
        // Send historical data
        this.sendHistoryToClient(ws, data.timeRange);
        break;
        
      case 'ping':
        // Respond to ping
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
        
      default:
        console.warn('Unknown WebSocket message type:', data.type);
    }
  }
  
  /**
   * Send metrics to specific client
   */
  sendMetricsToClient(ws) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        const message = {
          type: 'metrics',
          data: this.metrics,
          timestamp: Date.now()
        };
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.warn('Failed to send metrics to client:', error.message);
      }
    }
  }
  
  /**
   * Send historical data to client
   */
  sendHistoryToClient(ws, timeRange = 3600000) { // Default 1 hour
    if (ws.readyState === WebSocket.OPEN) {
      try {
        const cutoff = Date.now() - timeRange;
        const filteredHistory = {};
        
        Object.keys(this.history).forEach(key => {
          if (key === 'timestamps') {
            filteredHistory[key] = this.history[key].filter(t => t >= cutoff);
          } else {
            const timestamps = this.history.timestamps;
            filteredHistory[key] = this.history[key].filter((_, index) => 
              timestamps[index] >= cutoff
            );
          }
        });
        
        const message = {
          type: 'history',
          data: filteredHistory,
          timeRange,
          timestamp: Date.now()
        };
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.warn('Failed to send history to client:', error.message);
      }
    }
  }
  
  /**
   * Broadcast metrics to all connected clients
   */
  broadcastMetrics() {
    if (this.wsConnections.size === 0) return;
    
    const message = {
      type: 'metrics',
      data: this.metrics,
      timestamp: Date.now()
    };
    const messageString = JSON.stringify(message);
    
    this.wsConnections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(messageString);
        } catch (error) {
          console.warn('Failed to broadcast to client:', error.message);
          this.wsConnections.delete(ws);
        }
      } else {
        this.wsConnections.delete(ws);
      }
    });
  }
  
  /**
   * Start metrics collection
   */
  startMetricsCollection() {
    this.updateInterval = setInterval(() => {
      this.updateSystemMetrics();
      this.calculateDerivedMetrics();
      this.updateHistory();
      this.broadcastMetrics();
      this.emit('metricsUpdated', this.metrics);
    }, this.options.updateInterval);
  }
  
  /**
   * Update system metrics
   */
  updateSystemMetrics() {
    // CPU usage approximation
    this.metrics.system.cpu = Math.random() * 100; // Would use actual CPU monitoring
    
    // Memory usage
    const memUsage = process.memoryUsage();
    this.metrics.system.memory = (memUsage.heapUsed / 1024 / 1024); // MB
    
    // Uptime
    this.metrics.system.uptime = Date.now() - this.sessionStart;
    
    // Status determination
    if (this.metrics.system.cpu > 90 || this.metrics.system.memory > 1000) {
      this.metrics.system.status = 'warning';
    } else if (this.metrics.system.cpu > 95 || this.metrics.system.memory > 1500) {
      this.metrics.system.status = 'critical';
    } else {
      this.metrics.system.status = 'healthy';
    }
  }
  
  /**
   * Calculate derived metrics
   */
  calculateDerivedMetrics() {
    // Success rate
    if (this.metrics.trades.total > 0) {
      this.metrics.trades.successRate = 
        (this.metrics.trades.successful / this.metrics.trades.total) * 100;
    }
    
    // Opportunity conversion rate
    if (this.metrics.opportunities.detected > 0) {
      this.metrics.opportunities.conversionRate = 
        (this.metrics.opportunities.executed / this.metrics.opportunities.detected) * 100;
    }
    
    // Win/Loss ratios
    const totalTrades = this.metrics.trades.successful + this.metrics.trades.failed;
    if (totalTrades > 0) {
      this.metrics.pnl.winRate = (this.metrics.trades.successful / totalTrades) * 100;
      this.metrics.pnl.lossRate = (this.metrics.trades.failed / totalTrades) * 100;
    }
    
    // Net P&L
    this.metrics.pnl.netPnL = this.metrics.pnl.totalProfit - this.metrics.pnl.totalLoss;
    
    // Profitability
    if (this.metrics.pnl.totalLoss > 0) {
      this.metrics.pnl.profitability = 
        (this.metrics.pnl.totalProfit / this.metrics.pnl.totalLoss) * 100;
    }
    
    // Gas efficiency
    if (this.metrics.gas.totalCost > 0 && this.metrics.trades.total > 0) {
      this.metrics.gas.averagePrice = this.metrics.gas.totalCost / this.metrics.trades.total;
      this.metrics.gas.efficiency = Math.max(0, 100 - (this.metrics.gas.averagePrice / 50)); // Assuming 50 gwei baseline
    }
    
    // ROI calculations (simplified)
    const timeElapsed = Date.now() - this.sessionStart;
    const daysElapsed = timeElapsed / (24 * 60 * 60 * 1000);
    
    if (daysElapsed > 0) {
      this.metrics.roi.daily = (this.metrics.pnl.netPnL / daysElapsed);
      this.metrics.roi.weekly = this.metrics.roi.daily * 7;
      this.metrics.roi.monthly = this.metrics.roi.daily * 30;
      this.metrics.roi.annualized = this.metrics.roi.daily * 365;
    }
    
    this.lastMetricsUpdate = Date.now();
  }
  
  /**
   * Update historical data
   */
  updateHistory() {
    const timestamp = Date.now();
    
    // Add current metrics to history
    this.history.timestamps.push(timestamp);
    this.history.pnl.push({ ...this.metrics.pnl });
    this.history.trades.push({ ...this.metrics.trades });
    this.history.opportunities.push({ ...this.metrics.opportunities });
    this.history.system.push({ ...this.metrics.system });
    this.history.gas.push({ ...this.metrics.gas });
    
    // Cleanup old data
    const cutoff = timestamp - this.options.metricsRetention;
    this.cleanupHistory(cutoff);
  }
  
  /**
   * Cleanup old historical data
   */
  cleanupHistory(cutoff) {
    let removeCount = 0;
    const timestamps = this.history.timestamps;
    
    // Find cutoff index
    for (let i = 0; i < timestamps.length; i++) {
      if (timestamps[i] >= cutoff) break;
      removeCount++;
    }
    
    if (removeCount > 0) {
      // Remove old data from all arrays
      Object.keys(this.history).forEach(key => {
        this.history[key].splice(0, removeCount);
      });
    }
  }
  
  /**
   * Setup cleanup timer
   */
  setupCleanupTimer() {
    this.cleanupInterval = setInterval(() => {
      const cutoff = Date.now() - this.options.metricsRetention;
      this.cleanupHistory(cutoff);
    }, 5 * 60 * 1000); // Cleanup every 5 minutes
  }
  
  /**
   * Update trade metrics from external data
   */
  updateTradeMetrics(tradeData) {
    this.metrics.trades.total++;
    
    if (tradeData.success) {
      this.metrics.trades.successful++;
      this.metrics.pnl.totalProfit += tradeData.profit || 0;
      this.metrics.pnl.current += tradeData.profit || 0;
    } else {
      this.metrics.trades.failed++;
      this.metrics.pnl.totalLoss += Math.abs(tradeData.loss || 0);
      this.metrics.pnl.current -= Math.abs(tradeData.loss || 0);
    }
    
    // Update execution time
    if (tradeData.executionTime) {
      const currentAvg = this.metrics.trades.averageExecutionTime;
      const total = this.metrics.trades.total;
      this.metrics.trades.averageExecutionTime = 
        ((currentAvg * (total - 1)) + tradeData.executionTime) / total;
      
      // Update fastest/slowest
      if (this.metrics.trades.fastestExecution === 0 || 
          tradeData.executionTime < this.metrics.trades.fastestExecution) {
        this.metrics.trades.fastestExecution = tradeData.executionTime;
      }
      if (tradeData.executionTime > this.metrics.trades.slowestExecution) {
        this.metrics.trades.slowestExecution = tradeData.executionTime;
      }
    }
    
    // Update gas costs
    if (tradeData.gasCost) {
      this.metrics.gas.totalCost += tradeData.gasCost;
      this.metrics.trades.totalGasCost += tradeData.gasCost;
      this.metrics.trades.averageGasCost = 
        this.metrics.trades.totalGasCost / this.metrics.trades.total;
    }
    
    this.emit('tradeUpdated', tradeData);
  }
  
  /**
   * Update opportunity metrics
   */
  updateOpportunityMetrics(opportunityData) {
    if (opportunityData.stage === 'detected') {
      this.metrics.opportunities.detected++;
    } else if (opportunityData.stage === 'analyzed') {
      this.metrics.opportunities.analyzed++;
    } else if (opportunityData.stage === 'executed') {
      this.metrics.opportunities.executed++;
    } else if (opportunityData.stage === 'skipped') {
      this.metrics.opportunities.skipped++;
    }
    
    // Update spread tracking
    if (opportunityData.spread) {
      const currentAvg = this.metrics.opportunities.averageSpread;
      const total = this.metrics.opportunities.detected;
      this.metrics.opportunities.averageSpread = 
        ((currentAvg * (total - 1)) + opportunityData.spread) / total;
      
      if (opportunityData.spread > this.metrics.opportunities.bestSpread) {
        this.metrics.opportunities.bestSpread = opportunityData.spread;
      }
    }
    
    // Update confidence tracking
    if (opportunityData.confidence) {
      const currentAvg = this.metrics.opportunities.averageConfidence;
      const total = this.metrics.opportunities.detected;
      this.metrics.opportunities.averageConfidence = 
        ((currentAvg * (total - 1)) + opportunityData.confidence) / total;
    }
    
    this.emit('opportunityUpdated', opportunityData);
  }
  
  /**
   * Update risk metrics
   */
  updateRiskMetrics(riskData) {
    Object.assign(this.metrics.risk, riskData);
    this.emit('riskUpdated', riskData);
  }
  
  /**
   * Get current dashboard state
   */
  getDashboardState() {
    return {
      metrics: this.metrics,
      history: this.history,
      connections: this.wsConnections.size,
      uptime: Date.now() - this.sessionStart,
      lastUpdate: this.lastMetricsUpdate,
      status: this.isInitialized ? 'active' : 'inactive'
    };
  }
  
  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    return {
      pnl: {
        net: this.metrics.pnl.netPnL,
        profitability: this.metrics.pnl.profitability,
        winRate: this.metrics.pnl.winRate
      },
      trades: {
        total: this.metrics.trades.total,
        successRate: this.metrics.trades.successRate,
        averageTime: this.metrics.trades.averageExecutionTime
      },
      opportunities: {
        conversionRate: this.metrics.opportunities.conversionRate,
        averageSpread: this.metrics.opportunities.averageSpread
      },
      system: {
        status: this.metrics.system.status,
        uptime: this.metrics.system.uptime
      },
      roi: {
        daily: this.metrics.roi.daily,
        monthly: this.metrics.roi.monthly
      }
    };
  }
  
  /**
   * Export metrics data
   */
  exportMetrics(format = 'json') {
    const data = {
      metrics: this.metrics,
      history: this.history,
      summary: this.getPerformanceSummary(),
      exportTime: new Date().toISOString()
    };
    
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'csv':
        return this.convertToCSV(data);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
  
  /**
   * Convert data to CSV format
   */
  convertToCSV(data) {
    // Simplified CSV conversion for metrics
    const rows = [];
    rows.push('Timestamp,Metric,Value');
    
    const timestamp = new Date().toISOString();
    Object.entries(data.metrics).forEach(([category, metrics]) => {
      if (typeof metrics === 'object') {
        Object.entries(metrics).forEach(([key, value]) => {
          rows.push(`${timestamp},${category}.${key},${value}`);
        });
      } else {
        rows.push(`${timestamp},${category},${metrics}`);
      }
    });
    
    return rows.join('\n');
  }
  
  /**
   * Shutdown the dashboard
   */
  async shutdown() {
    console.log('🛑 Shutting down Performance Dashboard...');
    
    // Clear intervals
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Close WebSocket connections
    this.wsConnections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1001, 'Server shutting down');
      }
    });
    this.wsConnections.clear();
    
    // Close WebSocket server
    if (this.wsServer) {
      await new Promise(resolve => {
        this.wsServer.close(resolve);
      });
    }
    
    this.isInitialized = false;
    this.emit('shutdown');
    
    console.log('✅ Performance Dashboard shutdown complete');
  }
}

export default PerformanceDashboard;