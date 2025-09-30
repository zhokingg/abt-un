import { EventEmitter } from 'events';
import monitoringConfig, { validateMonitoringConfig, getEnvironmentConfig } from '../config/monitoring.js';

// Import monitoring services
import MetricsDashboard from './MetricsDashboard.js';
import AlertManager from './AlertManager.js';
import HealthMonitor from './HealthMonitor.js';
import PerformanceAnalyzer from './PerformanceAnalyzer.js';
import LogAnalyzer from './LogAnalyzer.js';
import InfrastructureMonitor from './InfrastructureMonitor.js';
import IncidentManager from './IncidentManager.js';
import DashboardAPI from './DashboardAPI.js';

/**
 * MonitoringIntegration - Central Integration Service
 * Integrates all monitoring components with the CoreArbitrageEngine
 * and provides unified monitoring, alerting, and dashboard functionality
 */
class MonitoringIntegration extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      ...getEnvironmentConfig(),
      ...options
    };
    
    // Monitoring services
    this.services = {
      metricsDashboard: null,
      alertManager: null,
      healthMonitor: null,
      performanceAnalyzer: null,
      logAnalyzer: null,
      infrastructureMonitor: null,
      incidentManager: null,
      dashboardAPI: null
    };
    
    // Core arbitrage engine reference
    this.coreEngine = null;
    
    // Service status tracking
    this.serviceStatus = {
      metricsDashboard: 'inactive',
      alertManager: 'inactive',
      healthMonitor: 'inactive',
      performanceAnalyzer: 'inactive',
      logAnalyzer: 'inactive',
      infrastructureMonitor: 'inactive',
      incidentManager: 'inactive',
      dashboardAPI: 'inactive'
    };
    
    // Event handlers storage
    this.eventHandlers = new Map();
    
    // Metrics aggregation
    this.aggregatedMetrics = {
      trading: {
        totalOpportunities: 0,
        executedTrades: 0,
        successfulTrades: 0,
        totalProfit: 0,
        averageExecutionTime: 0,
        successRate: 0
      },
      system: {
        uptime: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        networkLatency: 0,
        healthScore: 100
      },
      alerts: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        total: 0
      }
    };
    
    // State
    this.isInitialized = false;
    this.isRunning = false;
    this.startTime = Date.now();
    
    // Periodic tasks
    this.metricsAggregationTimer = null;
  }
  
  /**
   * Initialize monitoring integration
   */
  async initialize(coreArbitrageEngine) {
    try {
      console.log('🔧 Initializing MonitoringIntegration...');
      
      // Validate configuration
      const configValidation = validateMonitoringConfig();
      if (!configValidation.valid) {
        console.warn('⚠️ Configuration validation warnings found');
        configValidation.errors.forEach(error => console.warn(`   - ${error}`));
      }
      
      // Store core engine reference
      this.coreEngine = coreArbitrageEngine;
      
      // Initialize services based on configuration
      await this.initializeServices();
      
      // Setup integration with core engine
      this.setupCoreEngineIntegration();
      
      // Setup cross-service event routing
      this.setupEventRouting();
      
      // Start metrics aggregation
      this.startMetricsAggregation();
      
      this.isInitialized = true;
      this.isRunning = true;
      this.emit('initialized');
      
      console.log('✅ MonitoringIntegration initialized successfully');
      console.log(`📊 Active services: ${this.getActiveServices().join(', ')}`);
      
    } catch (error) {
      console.error('❌ Failed to initialize MonitoringIntegration:', error);
      throw error;
    }
  }
  
  /**
   * Initialize monitoring services
   */
  async initializeServices() {
    const config = this.options;
    
    // Initialize AlertManager first (needed by other services)
    if (config.global.enableAlerting) {
      console.log('📢 Initializing AlertManager...');
      this.services.alertManager = new AlertManager(config.alertManager);
      await this.services.alertManager.initialize();
      this.serviceStatus.alertManager = 'active';
    }
    
    // Initialize LogAnalyzer
    if (config.global.enableMonitoring) {
      console.log('📊 Initializing LogAnalyzer...');
      this.services.logAnalyzer = new LogAnalyzer(config.logAnalyzer);
      await this.services.logAnalyzer.initialize();
      this.serviceStatus.logAnalyzer = 'active';
    }
    
    // Initialize PerformanceAnalyzer
    if (config.global.enableMonitoring) {
      console.log('⚡ Initializing PerformanceAnalyzer...');
      this.services.performanceAnalyzer = new PerformanceAnalyzer(config.performanceAnalyzer);
      await this.services.performanceAnalyzer.initialize();
      this.serviceStatus.performanceAnalyzer = 'active';
    }
    
    // Initialize HealthMonitor
    if (config.global.enableMonitoring) {
      console.log('🏥 Initializing HealthMonitor...');
      this.services.healthMonitor = new HealthMonitor(config.healthMonitor);
      await this.services.healthMonitor.initialize();
      this.serviceStatus.healthMonitor = 'active';
    }
    
    // Initialize InfrastructureMonitor
    if (config.global.enableMonitoring) {
      console.log('🏗️ Initializing InfrastructureMonitor...');
      this.services.infrastructureMonitor = new InfrastructureMonitor(config.infrastructureMonitor);
      await this.services.infrastructureMonitor.initialize();
      this.serviceStatus.infrastructureMonitor = 'active';
    }
    
    // Initialize IncidentManager
    if (config.global.enableMonitoring) {
      console.log('🚨 Initializing IncidentManager...');
      this.services.incidentManager = new IncidentManager(config.incidentManager);
      await this.services.incidentManager.initialize();
      this.serviceStatus.incidentManager = 'active';
    }
    
    // Initialize MetricsDashboard
    if (config.global.enableDashboard) {
      console.log('📊 Initializing MetricsDashboard...');
      this.services.metricsDashboard = new MetricsDashboard(config.metricsDashboard);
      await this.services.metricsDashboard.initialize();
      this.serviceStatus.metricsDashboard = 'active';
    }
    
    // Initialize DashboardAPI
    if (config.global.enableDashboard) {
      console.log('🌐 Initializing DashboardAPI...');
      this.services.dashboardAPI = new DashboardAPI(config.dashboardAPI);
      await this.services.dashboardAPI.initialize(this.services);
      this.serviceStatus.dashboardAPI = 'active';
    }
  }
  
  /**
   * Setup integration with CoreArbitrageEngine
   */
  setupCoreEngineIntegration() {
    if (!this.coreEngine) {
      console.warn('⚠️ CoreArbitrageEngine not provided, skipping integration');
      return;
    }
    
    console.log('🔗 Setting up CoreArbitrageEngine integration...');
    
    // Listen to arbitrage engine events
    this.setupEngineEventHandlers();
    
    // Inject monitoring hooks into engine methods
    this.injectMonitoringHooks();
    
    // Setup real-time data flow
    this.setupRealTimeDataFlow();
  }
  
  /**
   * Setup event handlers for CoreArbitrageEngine
   */
  setupEngineEventHandlers() {
    const engine = this.coreEngine;
    
    // Opportunity detection events
    const opportunityHandler = (opportunity) => {
      this.handleOpportunityDetected(opportunity);
    };
    engine.on('opportunityDetected', opportunityHandler);
    this.eventHandlers.set('opportunityDetected', opportunityHandler);
    
    // Trade execution events
    const tradeExecutedHandler = (trade) => {
      this.handleTradeExecuted(trade);
    };
    engine.on('tradeExecuted', tradeExecutedHandler);
    this.eventHandlers.set('tradeExecuted', tradeExecutedHandler);
    
    // Trade failure events
    const tradeFailedHandler = (trade) => {
      this.handleTradeFailed(trade);
    };
    engine.on('tradeFailed', tradeFailedHandler);
    this.eventHandlers.set('tradeFailed', tradeFailedHandler);
    
    // System events
    const systemEventHandler = (event) => {
      this.handleSystemEvent(event);
    };
    engine.on('systemEvent', systemEventHandler);
    this.eventHandlers.set('systemEvent', systemEventHandler);
    
    // Error events
    const errorHandler = (error) => {
      this.handleEngineError(error);
    };
    engine.on('error', errorHandler);
    this.eventHandlers.set('error', errorHandler);
    
    // Performance events
    const performanceHandler = (metrics) => {
      this.handlePerformanceData(metrics);
    };
    engine.on('performanceMetrics', performanceHandler);
    this.eventHandlers.set('performanceMetrics', performanceHandler);
  }
  
  /**
   * Inject monitoring hooks into engine methods
   */
  injectMonitoringHooks() {
    const engine = this.coreEngine;
    
    // Hook into opportunity detection
    if (engine.detectOpportunities) {
      const originalDetectOpportunities = engine.detectOpportunities.bind(engine);
      engine.detectOpportunities = async (...args) => {
        const startTime = Date.now();
        
        try {
          const result = await originalDetectOpportunities(...args);
          
          // Record performance metrics
          if (this.services.performanceAnalyzer) {
            this.services.performanceAnalyzer.recordArbitrageOpportunity({
              detectionTime: Date.now() - startTime,
              opportunitiesFound: Array.isArray(result) ? result.length : (result ? 1 : 0)
            });
          }
          
          return result;
        } catch (error) {
          // Record error
          if (this.services.logAnalyzer) {
            this.services.logAnalyzer.processLogEntry({
              level: 'error',
              message: 'Opportunity detection failed',
              component: 'arbitrage',
              error: error.message,
              duration: Date.now() - startTime
            });
          }
          throw error;
        }
      };
    }
    
    // Hook into trade execution
    if (engine.executeTrade) {
      const originalExecuteTrade = engine.executeTrade.bind(engine);
      engine.executeTrade = async (opportunity, ...args) => {
        const startTime = Date.now();
        const tradeId = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        try {
          // Start performance measurement
          if (this.services.performanceAnalyzer) {
            this.services.performanceAnalyzer.startMeasurement(`trade_execution_${tradeId}`);
          }
          
          const result = await originalExecuteTrade(opportunity, ...args);
          
          // End performance measurement
          if (this.services.performanceAnalyzer) {
            this.services.performanceAnalyzer.endMeasurement(`trade_execution_${tradeId}`, {
              success: true,
              profit: result.actualProfit || 0
            });
          }
          
          // Log successful execution
          if (this.services.logAnalyzer) {
            this.services.logAnalyzer.processLogEntry({
              level: 'info',
              message: 'Trade executed successfully',
              component: 'arbitrage',
              action: 'trade_execution',
              duration: Date.now() - startTime,
              metadata: {
                tradeId,
                profit: result.actualProfit,
                gasUsed: result.gasUsed
              }
            });
          }
          
          return result;
        } catch (error) {
          // End performance measurement with failure
          if (this.services.performanceAnalyzer) {
            this.services.performanceAnalyzer.endMeasurement(`trade_execution_${tradeId}`, {
              success: false,
              error: error.message
            });
          }
          
          // Log execution failure
          if (this.services.logAnalyzer) {
            this.services.logAnalyzer.processLogEntry({
              level: 'error',
              message: 'Trade execution failed',
              component: 'arbitrage',
              action: 'trade_execution',
              duration: Date.now() - startTime,
              error: error.message,
              metadata: { tradeId }
            });
          }
          
          throw error;
        }
      };
    }
  }
  
  /**
   * Setup real-time data flow between services
   */
  setupRealTimeDataFlow() {
    // Performance data flow
    if (this.services.performanceAnalyzer && this.services.metricsDashboard) {
      this.services.performanceAnalyzer.on('metricsUpdated', (metrics) => {
        this.services.metricsDashboard.updateTradingMetrics({
          profitLoss: metrics.arbitrage?.opportunities?.totalProfit || 0,
          executionTime: metrics.arbitrage?.performance?.executionLatency?.[0]?.value || 0,
          success: true,
          gasUsed: 0
        });
      });
    }
    
    // Health monitoring data flow
    if (this.services.healthMonitor && this.services.metricsDashboard) {
      this.services.healthMonitor.on('healthUpdated', (health) => {
        this.services.metricsDashboard.updateSystemMetrics({
          cpuUsage: health.resources?.cpu?.usage || 0,
          memoryUsage: health.resources?.memory?.percentage || 0,
          networkLatency: health.performance?.responseTime || 0
        });
      });
    }
    
    // Infrastructure monitoring data flow
    if (this.services.infrastructureMonitor && this.services.metricsDashboard) {
      this.services.infrastructureMonitor.on('monitoringUpdate', (infraStatus) => {
        this.services.metricsDashboard.updateNetworkMetrics({
          rpcLatency: infraStatus.network?.averageLatency || 0,
          websocketStatus: { connected: true },
          apiResponses: {}
        });
      });
    }
  }
  
  /**
   * Setup cross-service event routing
   */
  setupEventRouting() {
    // Route incidents to alert manager
    if (this.services.incidentManager && this.services.alertManager) {
      this.services.incidentManager.on('incidentDetected', async (incident) => {
        await this.services.alertManager.sendAlert('system_failure', {
          component: incident.type,
          error: incident.details?.error || 'System incident detected',
          impact: incident.severity,
          timestamp: incident.timestamp
        }, { priority: incident.severity });
      });
      
      this.services.incidentManager.on('incidentEscalated', async (incident) => {
        await this.services.alertManager.sendAlert('emergency_stop', {
          trigger: 'incident_escalation',
          reason: `Incident ${incident.id} escalated to ${incident.escalationLevel}`,
          timestamp: Date.now()
        }, { priority: 'critical' });
      });
    }
    
    // Route health issues to alert manager
    if (this.services.healthMonitor && this.services.alertManager) {
      this.services.healthMonitor.on('criticalHealthIssue', async (healthIssue) => {
        await this.services.alertManager.sendAlert('system_failure', {
          component: 'health_monitor',
          error: `Critical health issues detected: ${healthIssue.issues.map(i => i.type).join(', ')}`,
          impact: 'system_wide',
          timestamp: healthIssue.timestamp
        }, { priority: 'critical' });
      });
    }
    
    // Route performance anomalies to incident manager
    if (this.services.performanceAnalyzer && this.services.incidentManager) {
      this.services.performanceAnalyzer.on('bottleneckDetected', (bottleneck) => {
        // This would trigger incident detection in a real implementation
        console.log(`🔍 Performance bottleneck detected: ${bottleneck.type}`);
      });
    }
    
    // Route log anomalies to alert manager
    if (this.services.logAnalyzer && this.services.alertManager) {
      this.services.logAnalyzer.on('anomalyDetected', async (anomaly) => {
        if (anomaly.severity === 'high' || anomaly.severity === 'critical') {
          await this.services.alertManager.sendAlert('performance', {
            metric: anomaly.type,
            value: anomaly.details,
            threshold: 'anomaly_detected'
          }, { priority: anomaly.severity });
        }
      });
    }
  }
  
  /**
   * Start metrics aggregation
   */
  startMetricsAggregation() {
    this.metricsAggregationTimer = setInterval(() => {
      this.aggregateMetrics();
    }, this.options.global.metricsCollectionInterval);
    
    console.log('📊 Started metrics aggregation');
  }
  
  /**
   * Aggregate metrics from all services
   */
  aggregateMetrics() {
    try {
      // Aggregate trading metrics
      if (this.services.performanceAnalyzer) {
        const snapshot = this.services.performanceAnalyzer.getSnapshot();
        this.aggregatedMetrics.trading = {
          totalOpportunities: snapshot.metrics?.arbitrage?.opportunities?.detected || 0,
          executedTrades: snapshot.metrics?.arbitrage?.opportunities?.executed || 0,
          successfulTrades: snapshot.metrics?.arbitrage?.opportunities?.successful || 0,
          totalProfit: snapshot.metrics?.arbitrage?.opportunities?.totalProfit || 0,
          averageExecutionTime: snapshot.metrics?.arbitrage?.opportunities?.avgExecutionTime || 0,
          successRate: snapshot.metrics?.arbitrage?.opportunities?.successRate || 0
        };
      }
      
      // Aggregate system metrics
      if (this.services.healthMonitor) {
        const healthSummary = this.services.healthMonitor.getHealthSummary();
        this.aggregatedMetrics.system = {
          uptime: healthSummary.uptime || 0,
          cpuUsage: healthSummary.resources?.cpu?.usage || 0,
          memoryUsage: healthSummary.resources?.memory?.percentage || 0,
          networkLatency: healthSummary.performance?.responseTime || 0,
          healthScore: healthSummary.overall?.score || 100
        };
      }
      
      // Aggregate alert metrics
      if (this.services.incidentManager) {
        const activeIncidents = this.services.incidentManager.getActiveIncidents();
        const alertCounts = { critical: 0, high: 0, medium: 0, low: 0 };
        
        activeIncidents.forEach(incident => {
          if (alertCounts[incident.severity] !== undefined) {
            alertCounts[incident.severity]++;
          }
        });
        
        this.aggregatedMetrics.alerts = {
          ...alertCounts,
          total: activeIncidents.length
        };
      }
      
      // Emit aggregated metrics
      this.emit('metricsAggregated', this.aggregatedMetrics);
      
    } catch (error) {
      console.error('Error aggregating metrics:', error);
    }
  }
  
  /**
   * Event handlers for engine events
   */
  handleOpportunityDetected(opportunity) {
    // Update metrics
    if (this.services.performanceAnalyzer) {
      this.services.performanceAnalyzer.recordArbitrageOpportunity(opportunity);
    }
    
    // Send alert for high-value opportunities
    if (opportunity.estimatedProfit > 1000 && this.services.alertManager) {
      this.services.alertManager.sendAlert('opportunity', {
        type: opportunity.type,
        symbol: opportunity.symbol,
        profit: opportunity.estimatedProfit,
        confidence: opportunity.confidence,
        risk: opportunity.riskScore
      }, { priority: 'high' });
    }
    
    // Log opportunity
    if (this.services.logAnalyzer) {
      this.services.logAnalyzer.processLogEntry({
        level: 'info',
        message: 'Arbitrage opportunity detected',
        component: 'arbitrage',
        action: 'opportunity_detection',
        metadata: {
          type: opportunity.type,
          profit: opportunity.estimatedProfit,
          confidence: opportunity.confidence
        }
      });
    }
  }
  
  handleTradeExecuted(trade) {
    // Record trade execution
    if (this.services.performanceAnalyzer) {
      this.services.performanceAnalyzer.recordTradeExecution({
        success: true,
        actualProfit: trade.actualProfit,
        executionTime: trade.executionTime
      });
    }
    
    // Send execution alert
    if (this.services.alertManager) {
      this.services.alertManager.sendAlert('execution', {
        type: trade.type,
        symbol: trade.symbol,
        profit: trade.actualProfit,
        status: 'successful'
      }, { priority: 'medium' });
    }
    
    // Update dashboard metrics
    if (this.services.metricsDashboard) {
      this.services.metricsDashboard.updateTradingMetrics({
        profitLoss: trade.actualProfit,
        executionTime: trade.executionTime,
        success: true,
        gasUsed: trade.gasUsed
      });
    }
  }
  
  handleTradeFailed(trade) {
    // Record trade failure
    if (this.services.performanceAnalyzer) {
      this.services.performanceAnalyzer.recordTradeExecution({
        success: false,
        actualProfit: 0,
        executionTime: trade.executionTime || 0
      });
    }
    
    // Send failure alert
    if (this.services.alertManager) {
      this.services.alertManager.sendAlert('error', {
        service: 'arbitrage',
        error: trade.error || 'Trade execution failed',
        timestamp: Date.now()
      }, { priority: 'high' });
    }
    
    // Log trade failure
    if (this.services.logAnalyzer) {
      this.services.logAnalyzer.processLogEntry({
        level: 'error',
        message: 'Trade execution failed',
        component: 'arbitrage',
        action: 'trade_execution',
        error: trade.error,
        metadata: {
          type: trade.type,
          reason: trade.failureReason
        }
      });
    }
  }
  
  handleSystemEvent(event) {
    // Log system event
    if (this.services.logAnalyzer) {
      this.services.logAnalyzer.processLogEntry({
        level: event.severity === 'critical' ? 'error' : 'info',
        message: event.message,
        component: event.component || 'system',
        action: event.action,
        metadata: event.data
      });
    }
    
    // Send alert for critical events
    if (event.severity === 'critical' && this.services.alertManager) {
      this.services.alertManager.sendAlert('error', {
        service: event.component,
        error: event.message,
        timestamp: Date.now()
      }, { priority: 'critical' });
    }
  }
  
  handleEngineError(error) {
    // Log error
    if (this.services.logAnalyzer) {
      this.services.logAnalyzer.processLogEntry({
        level: 'error',
        message: error.message,
        component: 'arbitrage_engine',
        error: error.message,
        stack: error.stack
      });
    }
    
    // Send critical alert
    if (this.services.alertManager) {
      this.services.alertManager.sendAlert('error', {
        service: 'arbitrage_engine',
        error: error.message,
        timestamp: Date.now()
      }, { priority: 'critical' });
    }
  }
  
  handlePerformanceData(metrics) {
    // Update performance analyzer
    if (this.services.performanceAnalyzer) {
      // Process performance metrics
      Object.entries(metrics).forEach(([metric, value]) => {
        if (typeof value === 'number') {
          this.services.performanceAnalyzer.recordMeasurement({
            name: metric,
            duration: value,
            endTime: Date.now()
          });
        }
      });
    }
  }
  
  /**
   * Get monitoring status
   */
  getMonitoringStatus() {
    return {
      initialized: this.isInitialized,
      running: this.isRunning,
      uptime: Date.now() - this.startTime,
      services: this.serviceStatus,
      activeServices: this.getActiveServices(),
      aggregatedMetrics: this.aggregatedMetrics,
      coreEngineConnected: !!this.coreEngine
    };
  }
  
  /**
   * Get active services list
   */
  getActiveServices() {
    return Object.entries(this.serviceStatus)
      .filter(([, status]) => status === 'active')
      .map(([service]) => service);
  }
  
  /**
   * Get service by name
   */
  getService(serviceName) {
    return this.services[serviceName] || null;
  }
  
  /**
   * Send manual alert through alert manager
   */
  async sendAlert(type, data, options = {}) {
    if (this.services.alertManager) {
      return await this.services.alertManager.sendAlert(type, data, options);
    }
    throw new Error('AlertManager not initialized');
  }
  
  /**
   * Get comprehensive system report
   */
  async getSystemReport() {
    const report = {
      timestamp: Date.now(),
      overview: this.getMonitoringStatus(),
      services: {}
    };
    
    // Collect reports from all services
    if (this.services.healthMonitor) {
      report.services.health = this.services.healthMonitor.getDetailedHealthReport();
    }
    
    if (this.services.performanceAnalyzer) {
      report.services.performance = this.services.performanceAnalyzer.getPerformanceReport();
    }
    
    if (this.services.infrastructureMonitor) {
      report.services.infrastructure = this.services.infrastructureMonitor.getInfrastructureReport();
    }
    
    if (this.services.incidentManager) {
      report.services.incidents = {
        active: this.services.incidentManager.getActiveIncidents(),
        history: this.services.incidentManager.getIncidentHistory(10)
      };
    }
    
    if (this.services.logAnalyzer) {
      report.services.logs = this.services.logAnalyzer.getAnalyticsSummary();
    }
    
    return report;
  }
  
  /**
   * Shutdown monitoring integration
   */
  async shutdown() {
    console.log('🛑 Shutting down MonitoringIntegration...');
    
    // Clear timers
    if (this.metricsAggregationTimer) {
      clearInterval(this.metricsAggregationTimer);
    }
    
    // Remove event handlers from core engine
    if (this.coreEngine) {
      this.eventHandlers.forEach((handler, event) => {
        this.coreEngine.removeListener(event, handler);
      });
      this.eventHandlers.clear();
    }
    
    // Shutdown services in reverse order
    const shutdownOrder = [
      'dashboardAPI',
      'metricsDashboard',
      'incidentManager',
      'infrastructureMonitor',
      'healthMonitor',
      'performanceAnalyzer',
      'logAnalyzer',
      'alertManager'
    ];
    
    for (const serviceName of shutdownOrder) {
      const service = this.services[serviceName];
      if (service && typeof service.shutdown === 'function') {
        try {
          await service.shutdown();
          this.serviceStatus[serviceName] = 'inactive';
        } catch (error) {
          console.error(`Error shutting down ${serviceName}:`, error);
        }
      }
    }
    
    this.isRunning = false;
    this.emit('shutdown');
    
    console.log('✅ MonitoringIntegration shutdown complete');
  }
}

export default MonitoringIntegration;