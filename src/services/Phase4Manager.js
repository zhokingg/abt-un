import { EventEmitter } from 'events';
import NetworkOptimizer from './NetworkOptimizer.js';
import BacktestingEngine from './BacktestingEngine.js';
import MonitoringService from './MonitoringService.js';
import AlertingService from './AlertingService.js';
import PerformanceAnalyzer from './PerformanceAnalyzer.js';
import RiskManager from './RiskManager.js';
import config from '../config/config.js';

/**
 * Phase4Manager - Orchestrates all Phase 4 Performance & Safety components
 * Provides unified management and coordination of advanced features
 */
class Phase4Manager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      enableNetworkOptimization: options.enableNetworkOptimization !== false,
      enableBacktesting: options.enableBacktesting !== false,
      enableMonitoring: options.enableMonitoring !== false,
      enableAlerting: options.enableAlerting !== false,
      enablePerformanceAnalysis: options.enablePerformanceAnalysis !== false,
      enableRiskManagement: options.enableRiskManagement !== false,
      autoStart: options.autoStart !== false,
      ...options
    };
    
    this.phase4Config = config.PHASE4 || {};
    
    // Component instances
    this.components = {
      networkOptimizer: null,
      backtestingEngine: null,
      monitoringService: null,
      alertingService: null,
      performanceAnalyzer: null,
      riskManager: null
    };
    
    // Component status
    this.componentStatus = {
      networkOptimizer: 'inactive',
      backtestingEngine: 'inactive',
      monitoringService: 'inactive',
      alertingService: 'inactive',
      performanceAnalyzer: 'inactive',
      riskManager: 'inactive'
    };
    
    // Overall status
    this.isInitialized = false;
    this.isStarted = false;
    
    // Performance metrics aggregation
    this.aggregatedMetrics = {
      system: {},
      network: {},
      trading: {},
      risk: {},
      lastUpdate: 0
    };
    
    // Health status
    this.healthStatus = {
      overall: 'unknown',
      components: {},
      lastCheck: 0,
      issues: []
    };
  }
  
  /**
   * Initialize all Phase 4 components
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }
    
    console.log('🚀 Initializing Phase 4: Performance & Safety...');
    console.log('⚡ Advanced MEV Arbitrage Bot - Enhanced Performance & Risk Management');
    
    try {
      const initResults = {};
      
      // Initialize Network Optimizer
      if (this.options.enableNetworkOptimization) {
        console.log('🌐 Initializing Network Optimizer...');
        this.components.networkOptimizer = new NetworkOptimizer(
          this.phase4Config.RPC_ENDPOINTS || [],
          {
            latencyThreshold: this.phase4Config.PERFORMANCE_TARGETS?.rpcLatency || 100,
            ...this.phase4Config.NETWORK_OPTIMIZER
          }
        );
        
        await this.components.networkOptimizer.initialize();
        this.componentStatus.networkOptimizer = 'active';
        initResults.networkOptimizer = 'success';
        
        this.setupNetworkOptimizerEvents();
      }
      
      // Initialize Monitoring Service
      if (this.options.enableMonitoring) {
        console.log('🔍 Initializing Monitoring Service...');
        this.components.monitoringService = new MonitoringService(
          this.phase4Config.MONITORING || {}
        );
        
        await this.components.monitoringService.initialize();
        this.componentStatus.monitoringService = 'active';
        initResults.monitoringService = 'success';
        
        this.setupMonitoringEvents();
      }
      
      // Initialize Performance Analyzer
      if (this.options.enablePerformanceAnalysis) {
        console.log('📊 Initializing Performance Analyzer...');
        this.components.performanceAnalyzer = new PerformanceAnalyzer({
          performanceTargets: this.phase4Config.PERFORMANCE_TARGETS || {},
          ...this.phase4Config.PERFORMANCE_ANALYZER
        });
        
        await this.components.performanceAnalyzer.initialize();
        this.componentStatus.performanceAnalyzer = 'active';
        initResults.performanceAnalyzer = 'success';
        
        this.setupPerformanceAnalyzerEvents();
      }
      
      // Initialize Risk Manager
      if (this.options.enableRiskManagement) {
        console.log('🛡️ Initializing Risk Manager...');
        this.components.riskManager = new RiskManager({
          ...this.phase4Config.RISK_LIMITS,
          initialCapital: this.phase4Config.BACKTESTING?.initialCapital || 10000
        });
        
        await this.components.riskManager.initialize();
        this.componentStatus.riskManager = 'active';
        initResults.riskManager = 'success';
        
        this.setupRiskManagerEvents();
      }
      
      // Initialize Alerting Service
      if (this.options.enableAlerting) {
        console.log('🚨 Initializing Alerting Service...');
        this.components.alertingService = new AlertingService(
          this.phase4Config.ALERTING || {}
        );
        
        await this.components.alertingService.initialize();
        this.componentStatus.alertingService = 'active';
        initResults.alertingService = 'success';
        
        this.setupAlertingEvents();
      }
      
      // Initialize Backtesting Engine
      if (this.options.enableBacktesting) {
        console.log('📈 Initializing Backtesting Engine...');
        this.components.backtestingEngine = new BacktestingEngine(
          this.phase4Config.BACKTESTING || {}
        );
        
        await this.components.backtestingEngine.initialize();
        this.componentStatus.backtestingEngine = 'active';
        initResults.backtestingEngine = 'success';
        
        this.setupBacktestingEvents();
      }
      
      // Setup cross-component integrations
      this.setupCrossComponentIntegrations();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      this.isInitialized = true;
      
      const activeComponents = Object.values(this.componentStatus).filter(status => status === 'active').length;
      
      console.log('✅ Phase 4 initialization complete');
      console.log(`📊 Active components: ${activeComponents}/6`);
      console.log('🎯 Enhanced features: Multi-RPC failover, Risk management, Performance monitoring, Alerting');
      
      this.emit('initialized', {
        activeComponents,
        componentStatus: this.componentStatus,
        initResults,
        config: this.phase4Config
      });
      
      // Auto-start if enabled
      if (this.options.autoStart) {
        await this.start();
      }
      
    } catch (error) {
      console.error('❌ Phase 4 initialization failed:', error.message);
      this.emit('initializationError', error);
      throw error;
    }
  }
  
  /**
   * Start all Phase 4 services
   */
  async start() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.isStarted) {
      return;
    }
    
    console.log('🚀 Starting Phase 4 services...');
    
    try {
      // Performance analysis and monitoring are automatically started during initialization
      
      // Send startup notification
      if (this.components.alertingService) {
        await this.components.alertingService.sendAlert('system', {
          message: 'Phase 4 Performance & Safety system started',
          version: 'Phase 4',
          activeComponents: Object.keys(this.components).filter(key => this.components[key] !== null).length,
          timestamp: new Date().toISOString()
        }, {
          priority: 'low'
        });
      }
      
      this.isStarted = true;
      
      console.log('✅ Phase 4 services started successfully');
      
      this.emit('started', {
        timestamp: Date.now(),
        activeComponents: this.getActiveComponents()
      });
      
    } catch (error) {
      console.error('❌ Failed to start Phase 4 services:', error.message);
      throw error;
    }
  }
  
  /**
   * Setup Network Optimizer event handlers
   */
  setupNetworkOptimizerEvents() {
    const optimizer = this.components.networkOptimizer;
    
    optimizer.on('endpointFailure', (data) => {
      this.logEvent('network', 'endpoint_failure', data);
      this.sendAlert('rpc', data, { priority: 'medium' });
    });
    
    optimizer.on('circuitBreakerTripped', (data) => {
      this.logEvent('network', 'circuit_breaker_tripped', data);
      this.sendAlert('system', {
        message: 'Network circuit breaker tripped',
        ...data
      }, { priority: 'high' });
    });
    
    optimizer.on('healthCheck', (data) => {
      if (this.components.performanceAnalyzer) {
        this.components.performanceAnalyzer.recordRPCRequest(
          data.url, data.latency, data.healthy
        );
      }
    });
  }
  
  /**
   * Setup Monitoring Service event handlers
   */
  setupMonitoringEvents() {
    const monitor = this.components.monitoringService;
    
    monitor.on('alert', (alert) => {
      this.sendAlert('system', {
        message: alert.message,
        component: alert.component,
        metric: alert.metric,
        value: alert.value,
        threshold: alert.threshold
      }, { priority: alert.type });
    });
    
    monitor.on('criticalError', (error) => {
      this.sendAlert('system', {
        message: 'Critical system error detected',
        error: error.type,
        details: error.error || error.reason
      }, { priority: 'critical' });
    });
    
    monitor.on('metricsCollected', (metrics) => {
      this.updateAggregatedMetrics('system', metrics);
    });
  }
  
  /**
   * Setup Performance Analyzer event handlers
   */
  setupPerformanceAnalyzerEvents() {
    const analyzer = this.components.performanceAnalyzer;
    
    analyzer.on('bottlenecksDetected', (bottlenecks) => {
      for (const bottleneck of bottlenecks) {
        this.sendAlert('performance', {
          message: bottleneck.description,
          type: bottleneck.type,
          component: bottleneck.component,
          impact: bottleneck.impact
        }, { priority: bottleneck.severity });
      }
    });
    
    analyzer.on('performanceAnalysis', (analysis) => {
      if (analysis.performanceGrade === 'F') {
        this.sendAlert('performance', {
          message: 'Critical performance degradation detected',
          grade: analysis.performanceGrade,
          issues: analysis.issuesDetected.length
        }, { priority: 'critical' });
      }
    });
    
    analyzer.on('metricsUpdated', (metrics) => {
      this.updateAggregatedMetrics('performance', metrics);
    });
  }
  
  /**
   * Setup Risk Manager event handlers
   */
  setupRiskManagerEvents() {
    const riskManager = this.components.riskManager;
    
    riskManager.on('emergencyStop', (data) => {
      this.logEvent('risk', 'emergency_stop', data);
      this.sendAlert('system', {
        message: 'EMERGENCY STOP TRIGGERED',
        reasons: data.reasons,
        portfolioValue: data.portfolioValue
      }, { priority: 'critical' });
    });
    
    riskManager.on('riskAssessment', (assessment) => {
      if (!assessment.approved && assessment.riskScore > 0.8) {
        this.sendAlert('risk', {
          message: 'High-risk trade rejected',
          opportunityId: assessment.opportunityId,
          riskScore: assessment.riskScore,
          reason: assessment.reason
        }, { priority: 'medium' });
      }
    });
    
    riskManager.on('tradeProcessed', (data) => {
      if (this.components.performanceAnalyzer) {
        this.components.performanceAnalyzer.recordTradeExecution(data.trade);
      }
    });
  }
  
  /**
   * Setup Alerting Service event handlers
   */
  setupAlertingEvents() {
    const alerting = this.components.alertingService;
    
    alerting.on('alertError', (data) => {
      this.logEvent('alerting', 'alert_error', data);
    });
    
    alerting.on('alertSent', (data) => {
      this.logEvent('alerting', 'alert_sent', {
        alertId: data.alert.id,
        deliveries: data.deliveries,
        successful: data.successful
      });
    });
  }
  
  /**
   * Setup Backtesting Engine event handlers
   */
  setupBacktestingEvents() {
    const backtesting = this.components.backtestingEngine;
    
    backtesting.on('progress', (data) => {
      this.logEvent('backtesting', 'progress', data);
    });
    
    backtesting.on('completed', (results) => {
      this.logEvent('backtesting', 'completed', {
        totalTrades: results.metrics.totalTrades,
        successRate: results.metrics.winRate,
        totalProfit: results.metrics.netProfit
      });
      
      this.sendAlert('backtesting', {
        message: 'Backtesting simulation completed',
        totalTrades: results.metrics.totalTrades,
        successRate: results.metrics.winRate,
        netProfit: results.metrics.netProfit,
        sharpeRatio: results.metrics.sharpeRatio
      }, { priority: 'low' });
    });
  }
  
  /**
   * Setup cross-component integrations
   */
  setupCrossComponentIntegrations() {
    // Integrate network optimizer with monitoring
    if (this.components.networkOptimizer && this.components.monitoringService) {
      this.components.networkOptimizer.on('healthCheck', (data) => {
        this.components.monitoringService.logRPCRequest(
          data.url, 'healthCheck', data.latency, data.healthy, data.error
        );
      });
    }
    
    // Integrate performance analyzer with risk manager
    if (this.components.performanceAnalyzer && this.components.riskManager) {
      this.components.performanceAnalyzer.on('opportunityRecorded', (opportunity) => {
        // Risk manager can use this for opportunity tracking
      });
    }
    
    // Integrate monitoring with alerting
    if (this.components.monitoringService && this.components.alertingService) {
      this.components.monitoringService.on('alert', async (alert) => {
        await this.components.alertingService.sendAlert('system', {
          message: alert.message,
          component: alert.component,
          metric: alert.metric,
          value: alert.value,
          threshold: alert.threshold
        }, { priority: alert.type });
      });
    }
  }
  
  /**
   * Execute RPC call using network optimizer
   */
  async executeRPCCall(method, params = [], options = {}) {
    if (!this.components.networkOptimizer) {
      throw new Error('Network Optimizer not available');
    }
    
    const measurementId = this.components.performanceAnalyzer?.startMeasurement(`rpc_${method}`) || null;
    
    try {
      const result = await this.components.networkOptimizer.executeCall(method, params, options);
      
      if (measurementId && this.components.performanceAnalyzer) {
        this.components.performanceAnalyzer.endMeasurement(measurementId, { success: true });
      }
      
      return result;
      
    } catch (error) {
      if (measurementId && this.components.performanceAnalyzer) {
        this.components.performanceAnalyzer.endMeasurement(measurementId, { 
          success: false, 
          error: error.message 
        });
      }
      
      throw error;
    }
  }
  
  /**
   * Assess risk for a trade opportunity
   */
  async assessTradeRisk(opportunity) {
    if (!this.components.riskManager) {
      return { approved: true, riskScore: 0, maxTradeSize: opportunity.tradeAmount };
    }
    
    return await this.components.riskManager.assessTradeRisk(opportunity);
  }
  
  /**
   * Process trade result through all relevant components
   */
  async processTradeResult(trade) {
    // Log trade with monitoring service
    if (this.components.monitoringService) {
      this.components.monitoringService.logTradeExecution(trade);
    }
    
    // Process with risk manager
    if (this.components.riskManager) {
      this.components.riskManager.processTradeResult(trade);
    }
    
    // Record with performance analyzer
    if (this.components.performanceAnalyzer) {
      this.components.performanceAnalyzer.recordTradeExecution(trade);
    }
    
    // Send trade alert if significant
    if (trade.success && trade.actualProfit > 100) {
      await this.sendAlert('trade', {
        success: trade.success,
        profit: trade.actualProfit,
        executionTime: trade.executionTime,
        txHash: trade.txHash
      }, { priority: 'medium' });
    } else if (!trade.success) {
      await this.sendAlert('trade', {
        success: trade.success,
        loss: trade.totalCosts,
        reason: trade.failureReason || 'Unknown',
        opportunityId: trade.opportunityId
      }, { priority: 'high' });
    }
  }
  
  /**
   * Run backtesting simulation
   */
  async runBacktest(strategy = null, options = {}) {
    if (!this.components.backtestingEngine) {
      throw new Error('Backtesting Engine not available');
    }
    
    return await this.components.backtestingEngine.runBacktest(strategy);
  }
  
  /**
   * Send alert through alerting service
   */
  async sendAlert(type, data, options = {}) {
    if (!this.components.alertingService) {
      return;
    }
    
    try {
      await this.components.alertingService.sendAlert(type, data, options);
    } catch (error) {
      console.error('Failed to send alert:', error.message);
    }
  }
  
  /**
   * Log event through monitoring service
   */
  logEvent(component, action, data) {
    if (this.components.monitoringService) {
      this.components.monitoringService.log('info', `${component}: ${action}`, {
        component,
        action,
        ...data
      });
    }
  }
  
  /**
   * Update aggregated metrics
   */
  updateAggregatedMetrics(category, metrics) {
    this.aggregatedMetrics[category] = {
      ...this.aggregatedMetrics[category],
      ...metrics,
      lastUpdate: Date.now()
    };
    
    this.emit('metricsUpdated', {
      category,
      metrics: this.aggregatedMetrics[category]
    });
  }
  
  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    setInterval(async () => {
      await this.performHealthCheck();
    }, 60000); // Every minute
  }
  
  /**
   * Perform comprehensive health check
   */
  async performHealthCheck() {
    const healthStatus = {
      overall: 'healthy',
      components: {},
      issues: [],
      timestamp: Date.now()
    };
    
    // Check each component
    for (const [name, component] of Object.entries(this.components)) {
      if (!component) {
        healthStatus.components[name] = 'disabled';
        continue;
      }
      
      try {
        if (typeof component.getHealthStatus === 'function') {
          const componentHealth = await component.getHealthStatus();
          healthStatus.components[name] = componentHealth.overall || 'healthy';
          
          if (componentHealth.issues) {
            healthStatus.issues.push(...componentHealth.issues.map(issue => ({
              component: name,
              ...issue
            })));
          }
        } else {
          healthStatus.components[name] = this.componentStatus[name];
        }
      } catch (error) {
        healthStatus.components[name] = 'error';
        healthStatus.issues.push({
          component: name,
          type: 'health_check_failed',
          message: error.message
        });
      }
    }
    
    // Determine overall health
    const componentStatuses = Object.values(healthStatus.components);
    if (componentStatuses.includes('critical') || componentStatuses.includes('error')) {
      healthStatus.overall = 'critical';
    } else if (componentStatuses.includes('degraded') || componentStatuses.includes('warning')) {
      healthStatus.overall = 'degraded';
    }
    
    this.healthStatus = healthStatus;
    this.emit('healthCheck', healthStatus);
    
    // Send alert if health is critical
    if (healthStatus.overall === 'critical') {
      await this.sendAlert('system', {
        message: 'Critical system health issues detected',
        issues: healthStatus.issues.length,
        failedComponents: componentStatuses.filter(s => s === 'critical' || s === 'error').length
      }, { priority: 'critical' });
    }
  }
  
  /**
   * Get active components list
   */
  getActiveComponents() {
    return Object.entries(this.componentStatus)
      .filter(([_, status]) => status === 'active')
      .map(([name, _]) => name);
  }
  
  /**
   * Get comprehensive system status
   */
  getSystemStatus() {
    return {
      phase: 'Phase 4: Performance & Safety',
      isInitialized: this.isInitialized,
      isStarted: this.isStarted,
      componentStatus: this.componentStatus,
      healthStatus: this.healthStatus,
      activeComponents: this.getActiveComponents(),
      aggregatedMetrics: this.aggregatedMetrics,
      uptime: process.uptime(),
      timestamp: Date.now()
    };
  }
  
  /**
   * Get performance report from all components
   */
  async getPerformanceReport() {
    const report = {
      timestamp: Date.now(),
      overall: this.getSystemStatus(),
      components: {}
    };
    
    // Collect reports from each component
    for (const [name, component] of Object.entries(this.components)) {
      if (!component) continue;
      
      try {
        if (typeof component.getMetrics === 'function') {
          report.components[name] = await component.getMetrics();
        } else if (typeof component.getStats === 'function') {
          report.components[name] = await component.getStats();
        } else if (typeof component.getPerformanceReport === 'function') {
          report.components[name] = await component.getPerformanceReport();
        }
      } catch (error) {
        report.components[name] = { error: error.message };
      }
    }
    
    return report;
  }
  
  /**
   * Shutdown all Phase 4 components gracefully
   */
  async shutdown() {
    console.log('🛑 Shutting down Phase 4 services...');
    
    try {
      // Send shutdown notification
      await this.sendAlert('system', {
        message: 'Phase 4 system shutting down',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }, { priority: 'low' });
      
      // Shutdown components in reverse order of importance
      const shutdownOrder = [
        'backtestingEngine',
        'performanceAnalyzer', 
        'alertingService',
        'riskManager',
        'networkOptimizer',
        'monitoringService' // Last, so it can log other shutdowns
      ];
      
      for (const componentName of shutdownOrder) {
        const component = this.components[componentName];
        if (component && typeof component.shutdown === 'function') {
          try {
            await component.shutdown();
            this.componentStatus[componentName] = 'inactive';
            console.log(`✅ ${componentName} shutdown complete`);
          } catch (error) {
            console.error(`❌ Failed to shutdown ${componentName}:`, error.message);
          }
        }
      }
      
      this.isStarted = false;
      this.isInitialized = false;
      
      console.log('✅ Phase 4 shutdown complete');
      
      this.emit('shutdown', {
        timestamp: Date.now(),
        shutdownComponents: shutdownOrder.filter(name => this.components[name] !== null)
      });
      
    } catch (error) {
      console.error('❌ Error during Phase 4 shutdown:', error.message);
      throw error;
    }
  }
}

export default Phase4Manager;