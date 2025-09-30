import { EventEmitter } from 'events';
import NetworkOptimizer from './NetworkOptimizer.js';
import BacktestingEngine from './BacktestingEngine.js';
import MonitoringService from './MonitoringService.js';
import AlertingService from './AlertingService.js';
import PerformanceAnalyzer from './PerformanceAnalyzer.js';
import RiskManager from './RiskManager.js';
// New comprehensive monitoring components
import PerformanceDashboard from './PerformanceDashboard.js';
import HealthMonitor from './HealthMonitor.js';
import AnalyticsEngine from './AnalyticsEngine.js';
import LogManager from './LogManager.js';
import EventTracker from './EventTracker.js';
import NotificationManager from './NotificationManager.js';
import ReportingService from './ReportingService.js';
import config from '../config/config.js';

/**
 * Phase4Manager - Orchestrates all Phase 4 Performance & Safety components
 * Provides unified management and coordination of advanced features
 */
class Phase4Manager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      // Existing components
      enableNetworkOptimization: options.enableNetworkOptimization !== false,
      enableBacktesting: options.enableBacktesting !== false,
      enableMonitoring: options.enableMonitoring !== false,
      enableAlerting: options.enableAlerting !== false,
      enablePerformanceAnalysis: options.enablePerformanceAnalysis !== false,
      enableRiskManagement: options.enableRiskManagement !== false,
      
      // New comprehensive monitoring components
      enablePerformanceDashboard: options.enablePerformanceDashboard !== false,
      enableHealthMonitor: options.enableHealthMonitor !== false,
      enableAnalyticsEngine: options.enableAnalyticsEngine !== false,
      enableLogManager: options.enableLogManager !== false,
      enableEventTracker: options.enableEventTracker !== false,
      enableNotificationManager: options.enableNotificationManager !== false,
      enableReportingService: options.enableReportingService !== false,
      
      autoStart: options.autoStart !== false,
      ...options
    };
    
    this.phase4Config = config.PHASE4 || {};
    
    // Component instances
    this.components = {
      // Existing components
      networkOptimizer: null,
      backtestingEngine: null,
      monitoringService: null,
      alertingService: null,
      performanceAnalyzer: null,
      riskManager: null,
      
      // New comprehensive monitoring components
      performanceDashboard: null,
      healthMonitor: null,
      analyticsEngine: null,
      logManager: null,
      eventTracker: null,
      notificationManager: null,
      reportingService: null
    };
    
    // Component status
    this.componentStatus = {
      // Existing components
      networkOptimizer: 'inactive',
      backtestingEngine: 'inactive',
      monitoringService: 'inactive',
      alertingService: 'inactive',
      performanceAnalyzer: 'inactive',
      riskManager: 'inactive',
      
      // New comprehensive monitoring components
      performanceDashboard: 'inactive',
      healthMonitor: 'inactive',
      analyticsEngine: 'inactive',
      logManager: 'inactive',
      eventTracker: 'inactive',
      notificationManager: 'inactive',
      reportingService: 'inactive'
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
      
      // Initialize new comprehensive monitoring components
      
      // Initialize Log Manager (first as other components depend on it)
      if (this.options.enableLogManager) {
        console.log('📝 Initializing Log Manager...');
        this.components.logManager = new LogManager({
          logLevel: this.phase4Config.LOG_LEVEL || 'info',
          enableAnalysis: true,
          ...this.phase4Config.LOG_MANAGER
        });
        
        await this.components.logManager.initialize();
        this.componentStatus.logManager = 'active';
        initResults.logManager = 'success';
        
        this.setupLogManagerEvents();
      }
      
      // Initialize Event Tracker
      if (this.options.enableEventTracker) {
        console.log('📊 Initializing Event Tracker...');
        this.components.eventTracker = new EventTracker({
          enableAnalysis: true,
          ...this.phase4Config.EVENT_TRACKER
        });
        
        await this.components.eventTracker.initialize();
        this.componentStatus.eventTracker = 'active';
        initResults.eventTracker = 'success';
        
        this.setupEventTrackerEvents();
      }
      
      // Initialize Health Monitor
      if (this.options.enableHealthMonitor) {
        console.log('🏥 Initializing Health Monitor...');
        this.components.healthMonitor = new HealthMonitor({
          arbitrageEngine: this.options.arbitrageEngine,
          priceMonitor: this.options.priceMonitor,
          mempoolMonitor: this.options.mempoolMonitor,
          rpcProviders: this.options.rpcProviders || {},
          ...this.phase4Config.HEALTH_MONITOR
        });
        
        await this.components.healthMonitor.initialize();
        this.componentStatus.healthMonitor = 'active';
        initResults.healthMonitor = 'success';
        
        this.setupHealthMonitorEvents();
      }
      
      // Initialize Analytics Engine
      if (this.options.enableAnalyticsEngine) {
        console.log('🧠 Initializing Analytics Engine...');
        this.components.analyticsEngine = new AnalyticsEngine({
          enableAnalysis: true,
          ...this.phase4Config.ANALYTICS_ENGINE
        });
        
        await this.components.analyticsEngine.initialize();
        this.componentStatus.analyticsEngine = 'active';
        initResults.analyticsEngine = 'success';
        
        this.setupAnalyticsEngineEvents();
      }
      
      // Initialize Notification Manager
      if (this.options.enableNotificationManager) {
        console.log('📬 Initializing Notification Manager...');
        this.components.notificationManager = new NotificationManager({
          alertingService: this.components.alertingService,
          logManager: this.components.logManager,
          enableScheduling: true,
          enableDigests: true,
          ...this.phase4Config.NOTIFICATION_MANAGER
        });
        
        await this.components.notificationManager.initialize();
        this.componentStatus.notificationManager = 'active';
        initResults.notificationManager = 'success';
        
        this.setupNotificationManagerEvents();
      }
      
      // Initialize Performance Dashboard
      if (this.options.enablePerformanceDashboard) {
        console.log('📈 Initializing Performance Dashboard...');
        this.components.performanceDashboard = new PerformanceDashboard({
          enableWebSocket: true,
          webSocketPort: this.phase4Config.DASHBOARD_PORT || 8080,
          ...this.phase4Config.PERFORMANCE_DASHBOARD
        });
        
        await this.components.performanceDashboard.initialize();
        this.componentStatus.performanceDashboard = 'active';
        initResults.performanceDashboard = 'success';
        
        this.setupPerformanceDashboardEvents();
      }
      
      // Initialize Reporting Service
      if (this.options.enableReportingService) {
        console.log('📊 Initializing Reporting Service...');
        this.components.reportingService = new ReportingService({
          performanceAnalyzer: this.components.performanceAnalyzer,
          analyticsEngine: this.components.analyticsEngine,
          healthMonitor: this.components.healthMonitor,
          riskManager: this.components.riskManager,
          eventTracker: this.components.eventTracker,
          logManager: this.components.logManager,
          notificationManager: this.components.notificationManager,
          enableAutomation: true,
          enableDelivery: true,
          ...this.phase4Config.REPORTING_SERVICE
        });
        
        await this.components.reportingService.initialize();
        this.componentStatus.reportingService = 'active';
        initResults.reportingService = 'success';
        
        this.setupReportingServiceEvents();
      }
      
      // Setup cross-component integrations
      this.setupCrossComponentIntegrations();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      this.isInitialized = true;
      
      const activeComponents = Object.values(this.componentStatus).filter(status => status === 'active').length;
      const totalComponents = Object.keys(this.componentStatus).length;
      
      console.log('✅ Phase 4 initialization complete');
      console.log(`📊 Active components: ${activeComponents}/${totalComponents}`);
      console.log('🎯 Enhanced features: Multi-RPC failover, Risk management, Performance monitoring, Advanced analytics, Real-time dashboard, Comprehensive alerting, Automated reporting');
      
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
   * Setup Log Manager events
   */
  setupLogManagerEvents() {
    const logManager = this.components.logManager;
    
    logManager.on('patternDetected', (pattern) => {
      this.sendAlert('system', {
        message: `Log pattern detected: ${pattern.pattern}`,
        count: pattern.count,
        type: pattern.type
      }, { priority: 'medium' });
    });
    
    logManager.on('anomalyDetected', (anomaly) => {
      this.sendAlert('system', {
        message: `Log anomaly detected: ${anomaly.type}`,
        description: anomaly.description,
        severity: anomaly.severity
      }, { priority: 'high' });
    });
    
    logManager.on('analysisComplete', (analysis) => {
      this.logEvent('logManager', 'analysisComplete', {
        patterns: analysis.patterns?.totalPatterns,
        anomalies: analysis.anomalies?.length
      });
    });
  }
  
  /**
   * Setup Event Tracker events
   */
  setupEventTrackerEvents() {
    const eventTracker = this.components.eventTracker;
    
    eventTracker.on('patternDetected', (pattern) => {
      this.logEvent('eventTracker', 'patternDetected', {
        pattern: pattern.pattern,
        count: pattern.count
      });
    });
    
    eventTracker.on('anomaliesDetected', (anomalies) => {
      anomalies.forEach(anomaly => {
        this.sendAlert('system', {
          message: `Event anomaly: ${anomaly.type}`,
          eventType: anomaly.eventType,
          severity: anomaly.severity
        }, { priority: anomaly.severity === 'critical' ? 'critical' : 'medium' });
      });
    });
    
    eventTracker.on('analysisComplete', (analysis) => {
      this.logEvent('eventTracker', 'analysisComplete', {
        totalEvents: analysis.summary?.totalEvents,
        patterns: analysis.patterns?.totalPatterns
      });
    });
  }
  
  /**
   * Setup Health Monitor events
   */
  setupHealthMonitorEvents() {
    const healthMonitor = this.components.healthMonitor;
    
    healthMonitor.on('healthChanged', (change) => {
      this.sendAlert('system', {
        message: `System health changed from ${change.previous} to ${change.current}`,
        previous: change.previous,
        current: change.current,
        issues: change.issues?.length || 0
      }, { 
        priority: change.current === 'critical' ? 'critical' : 
                 change.current === 'unhealthy' ? 'high' : 'low' 
      });
    });
    
    healthMonitor.on('healthCheck', (result) => {
      if (result.criticalFailures > 0) {
        this.sendAlert('system', {
          message: `Health check failed: ${result.criticalFailures} critical issues`,
          passed: result.passed,
          total: result.total,
          issues: result.issues
        }, { priority: 'critical' });
      }
    });
  }
  
  /**
   * Setup Analytics Engine events
   */
  setupAnalyticsEngineEvents() {
    const analyticsEngine = this.components.analyticsEngine;
    
    analyticsEngine.on('anomaliesDetected', (anomalies) => {
      anomalies.forEach(anomaly => {
        if (anomaly.severity === 'critical') {
          this.sendAlert('analytics', {
            message: `Critical anomaly in ${anomaly.metric}`,
            metric: anomaly.metric,
            value: anomaly.value,
            expected: anomaly.expected,
            zScore: anomaly.zScore
          }, { priority: 'critical' });
        }
      });
    });
    
    analyticsEngine.on('analysisComplete', (analysis) => {
      this.logEvent('analyticsEngine', 'analysisComplete', {
        insights: analysis.insights?.recommendations?.length,
        predictions: Object.keys(analysis.predictions || {}).length
      });
    });
  }
  
  /**
   * Setup Notification Manager events
   */
  setupNotificationManagerEvents() {
    const notificationManager = this.components.notificationManager;
    
    notificationManager.on('notificationFailed', (notification) => {
      this.logEvent('notificationManager', 'deliveryFailed', {
        notificationId: notification.id,
        type: notification.type,
        attempts: notification.attempts
      });
    });
    
    notificationManager.on('notificationEscalated', (escalation) => {
      this.logEvent('notificationManager', 'escalated', {
        originalId: escalation.original.id,
        escalationId: escalation.escalation.id
      });
    });
  }
  
  /**
   * Setup Performance Dashboard events
   */
  setupPerformanceDashboardEvents() {
    const dashboard = this.components.performanceDashboard;
    
    dashboard.on('metricsUpdated', (metrics) => {
      // Update aggregated metrics for other components
      this.aggregatedMetrics.system = {
        ...this.aggregatedMetrics.system,
        cpu: metrics.system?.cpu,
        memory: metrics.system?.memory,
        uptime: metrics.system?.uptime
      };
      
      this.aggregatedMetrics.trading = {
        ...this.aggregatedMetrics.trading,
        totalTrades: metrics.trades?.total,
        successRate: metrics.trades?.successRate,
        totalProfit: metrics.pnl?.totalProfit
      };
      
      this.aggregatedMetrics.lastUpdate = Date.now();
    });
  }
  
  /**
   * Setup Reporting Service events
   */
  setupReportingServiceEvents() {
    const reportingService = this.components.reportingService;
    
    reportingService.on('reportGenerated', (metadata) => {
      this.logEvent('reportingService', 'reportGenerated', {
        reportId: metadata.id,
        template: metadata.templateId,
        generationTime: metadata.generationTime
      });
    });
    
    reportingService.on('reportGenerationFailed', (metadata) => {
      this.sendAlert('system', {
        message: `Report generation failed: ${metadata.templateId}`,
        error: metadata.error,
        reportId: metadata.id
      }, { priority: 'medium' });
    });
    
    reportingService.on('scheduledReportGenerated', (event) => {
      this.logEvent('reportingService', 'scheduledReportGenerated', {
        templateId: event.templateId,
        reportId: event.reportId
      });
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
    
    // Integrate new monitoring components
    
    // Connect Performance Dashboard with other components
    if (this.components.performanceDashboard) {
      // Feed trade data from performance analyzer
      if (this.components.performanceAnalyzer) {
        this.components.performanceAnalyzer.on('opportunityRecorded', (data) => {
          this.components.performanceDashboard.updateTradeMetrics(data);
        });
      }
      
      // Feed system metrics from health monitor
      if (this.components.healthMonitor) {
        this.components.healthMonitor.on('healthCheck', (data) => {
          this.components.performanceDashboard.updateSystemMetrics({
            status: data.overall,
            uptime: data.uptime,
            issues: data.issues?.length || 0
          });
        });
      }
      
      // Feed risk metrics from risk manager
      if (this.components.riskManager) {
        this.components.riskManager.on('riskUpdated', (data) => {
          this.components.performanceDashboard.updateRiskMetrics(data);
        });
      }
    }
    
    // Connect Analytics Engine with data sources
    if (this.components.analyticsEngine) {
      // Feed trade data
      if (this.components.performanceAnalyzer) {
        this.components.performanceAnalyzer.on('opportunityRecorded', (data) => {
          this.components.analyticsEngine.addTradeData(data);
        });
      }
      
      // Feed system performance data
      if (this.components.healthMonitor) {
        this.components.healthMonitor.on('healthCheck', (data) => {
          this.components.analyticsEngine.addSystemData({
            timestamp: Date.now(),
            uptime: data.uptime,
            healthStatus: data.overall,
            issues: data.issues?.length || 0
          });
        });
      }
      
      // Feed risk data
      if (this.components.riskManager) {
        this.components.riskManager.on('riskUpdated', (data) => {
          this.components.analyticsEngine.addRiskData({
            timestamp: Date.now(),
            ...data
          });
        });
      }
    }
    
    // Connect Event Tracker with business events
    if (this.components.eventTracker) {
      // Track arbitrage lifecycle events
      if (this.components.performanceAnalyzer) {
        this.components.performanceAnalyzer.on('opportunityDetected', (data) => {
          this.components.eventTracker.trackEvent('opportunity_detected', data);
        });
        
        this.components.performanceAnalyzer.on('opportunityExecuted', (data) => {
          this.components.eventTracker.trackEvent('opportunity_executed', data);
        });
      }
      
      // Track system events
      if (this.components.healthMonitor) {
        this.components.healthMonitor.on('healthChanged', (data) => {
          if (data.current === 'critical') {
            this.components.eventTracker.trackEvent('system_critical', data);
          }
        });
      }
      
      // Track risk events
      if (this.components.riskManager) {
        this.components.riskManager.on('thresholdExceeded', (data) => {
          this.components.eventTracker.trackEvent('risk_threshold_exceeded', data);
        });
        
        this.components.riskManager.on('emergencyStop', (data) => {
          this.components.eventTracker.trackEvent('emergency_stop', data);
        });
      }
    }
    
    // Connect Notification Manager with alerting
    if (this.components.notificationManager && this.components.alertingService) {
      // Override alerting service with notification manager for enhanced features
      this.components.alertingService.notificationManager = this.components.notificationManager;
    }
    
    // Connect Log Manager with all components
    if (this.components.logManager) {
      // Provide logger to other components
      const logger = this.components.logManager.getLogger();
      
      Object.values(this.components).forEach(component => {
        if (component && typeof component.setLogger === 'function') {
          component.setLogger(logger);
        }
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
   * Get comprehensive dashboard data
   */
  getDashboardData() {
    const data = {
      system: this.getSystemStatus(),
      performance: this.getPerformanceReport(),
      timestamp: Date.now()
    };
    
    // Add dashboard-specific data if available
    if (this.components.performanceDashboard) {
      data.dashboard = this.components.performanceDashboard.getDashboardState();
    }
    
    // Add health data if available
    if (this.components.healthMonitor) {
      data.health = this.components.healthMonitor.getHealthStatus();
    }
    
    // Add analytics data if available
    if (this.components.analyticsEngine) {
      data.analytics = this.components.analyticsEngine.getAnalyticsSummary();
    }
    
    return data;
  }
  
  /**
   * Get comprehensive system metrics
   */
  getComprehensiveMetrics() {
    const metrics = {
      timestamp: Date.now(),
      components: {},
      aggregated: this.aggregatedMetrics
    };
    
    // Collect metrics from all components
    Object.entries(this.components).forEach(([name, component]) => {
      if (component && this.componentStatus[name] === 'active') {
        try {
          if (typeof component.getMetrics === 'function') {
            metrics.components[name] = component.getMetrics();
          } else if (typeof component.getSnapshot === 'function') {
            metrics.components[name] = component.getSnapshot();
          } else if (typeof component.getStatistics === 'function') {
            metrics.components[name] = component.getStatistics();
          }
        } catch (error) {
          metrics.components[name] = { error: error.message };
        }
      }
    });
    
    return metrics;
  }
  
  /**
   * Get monitoring insights and recommendations
   */
  getMonitoringInsights() {
    const insights = {
      timestamp: Date.now(),
      recommendations: [],
      warnings: [],
      alerts: [],
      performance: {}
    };
    
    // Get analytics insights
    if (this.components.analyticsEngine) {
      try {
        const analytics = this.components.analyticsEngine.getAnalyticsSummary();
        if (analytics.insights) {
          insights.recommendations.push(...(analytics.insights.recommendations || []));
          insights.warnings.push(...(analytics.insights.warnings || []));
        }
      } catch (error) {
        console.error('Failed to get analytics insights:', error.message);
      }
    }
    
    // Get health insights
    if (this.components.healthMonitor) {
      try {
        const health = this.components.healthMonitor.getHealthStatus();
        if (health.issues && health.issues.length > 0) {
          insights.warnings.push(...health.issues.map(issue => ({
            type: 'health',
            title: `${issue.name} Issue`,
            message: issue.message,
            critical: issue.critical
          })));
        }
      } catch (error) {
        console.error('Failed to get health insights:', error.message);
      }
    }
    
    return insights;
  }
  
  /**
   * Generate comprehensive report
   */
  async generateComprehensiveReport(options = {}) {
    if (!this.components.reportingService) {
      throw new Error('Reporting service not available');
    }
    
    const templateId = options.template || 'daily_performance';
    
    try {
      const reportId = await this.components.reportingService.generateReport(templateId, {
        format: options.format || 'json',
        timeRange: options.timeRange,
        ...options
      });
      
      this.logEvent('phase4Manager', 'reportGenerated', {
        reportId,
        template: templateId,
        format: options.format || 'json'
      });
      
      return reportId;
      
    } catch (error) {
      this.logEvent('phase4Manager', 'reportGenerationFailed', {
        template: templateId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Send notification through notification manager
   */
  async sendNotification(type, data, options = {}) {
    if (!this.components.notificationManager) {
      // Fallback to regular alert
      return this.sendAlert(type, data, options);
    }
    
    try {
      const notificationId = await this.components.notificationManager.sendNotification(type, data, options);
      
      this.logEvent('phase4Manager', 'notificationSent', {
        notificationId,
        type,
        priority: options.priority || 'medium'
      });
      
      return notificationId;
      
    } catch (error) {
      console.error('Failed to send notification:', error.message);
      // Fallback to regular alert
      return this.sendAlert(type, data, options);
    }
  }
  
  /**
   * Track business event
   */
  async trackEvent(eventType, data = {}, correlationId = null) {
    if (!this.components.eventTracker) {
      this.logEvent('phase4Manager', eventType, data);
      return null;
    }
    
    try {
      const eventId = await this.components.eventTracker.trackEvent(eventType, data, correlationId);
      return eventId;
    } catch (error) {
      console.error('Failed to track event:', error.message);
      this.logEvent('phase4Manager', eventType, data);
      return null;
    }
  }
  
  /**
   * Get comprehensive status including all new components
   */
  getEnhancedSystemStatus() {
    const baseStatus = this.getSystemStatus();
    
    const enhancedStatus = {
      ...baseStatus,
      comprehensiveMonitoring: {
        performanceDashboard: {
          status: this.componentStatus.performanceDashboard,
          connections: this.components.performanceDashboard?.wsConnections?.size || 0,
          metricsCount: this.components.performanceDashboard ? 
            Object.keys(this.components.performanceDashboard.metrics || {}).length : 0
        },
        healthMonitor: {
          status: this.componentStatus.healthMonitor,
          overallHealth: this.components.healthMonitor?.healthState?.overall || 'unknown',
          activeChecks: this.components.healthMonitor ? 
            Object.keys(this.components.healthMonitor.healthChecks || {}).length : 0,
          issues: this.components.healthMonitor?.healthState?.issues?.length || 0
        },
        analyticsEngine: {
          status: this.componentStatus.analyticsEngine,
          dataPoints: this.components.analyticsEngine ? 
            Object.values(this.components.analyticsEngine.data || {}).reduce((sum, arr) => 
              sum + (Array.isArray(arr) ? arr.length : 0), 0) : 0,
          predictions: this.components.analyticsEngine ? 
            Object.keys(this.components.analyticsEngine.models || {}).filter(
              key => this.components.analyticsEngine.models[key].enabled
            ).length : 0
        },
        eventTracker: {
          status: this.componentStatus.eventTracker,
          totalEvents: this.components.eventTracker?.events?.size || 0,
          patterns: this.components.eventTracker?.analytics?.patterns?.size || 0,
          correlations: this.components.eventTracker?.eventsByCorrelation?.size || 0
        },
        logManager: {
          status: this.componentStatus.logManager,
          logBuffer: this.components.logManager?.logBuffer?.length || 0,
          patterns: this.components.logManager?.logAnalysis?.patterns?.size || 0,
          streams: this.components.logManager?.logStreams?.size || 0
        },
        notificationManager: {
          status: this.componentStatus.notificationManager,
          queueSize: this.components.notificationManager?.notificationQueue?.length || 0,
          sent: this.components.notificationManager?.sentNotifications?.size || 0,
          failed: this.components.notificationManager?.failedNotifications?.size || 0
        },
        reportingService: {
          status: this.componentStatus.reportingService,
          reports: this.components.reportingService?.generatedReports?.size || 0,
          schedules: this.components.reportingService?.schedules?.size || 0,
          templates: this.components.reportingService ? 
            Object.keys(this.components.reportingService.reportTemplates || {}).length : 0
        }
      }
    };
    
    return enhancedStatus;
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
        'reportingService',
        'performanceDashboard', 
        'notificationManager',
        'analyticsEngine',
        'eventTracker',
        'healthMonitor',
        'performanceAnalyzer', 
        'alertingService',
        'riskManager',
        'networkOptimizer',
        'monitoringService',
        'logManager' // Last, so it can log other shutdowns
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