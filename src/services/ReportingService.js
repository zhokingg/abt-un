import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

/**
 * ReportingService - Automated and custom report generation
 * Provides comprehensive reporting capabilities with scheduling and delivery
 */
class ReportingService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      reportDirectory: options.reportDirectory || './reports',
      enableAutomation: options.enableAutomation !== false,
      defaultTimezone: options.defaultTimezone || 'UTC',
      maxReportAge: options.maxReportAge || 30 * 24 * 60 * 60 * 1000, // 30 days
      enableDelivery: options.enableDelivery !== false,
      ...options
    };
    
    // Report templates
    this.reportTemplates = {
      daily_performance: {
        name: 'Daily Performance Report',
        description: 'Daily trading performance summary',
        frequency: 'daily',
        scheduledTime: '09:00',
        recipients: ['admin', 'trader'],
        deliveryChannels: ['email', 'discord'],
        sections: [
          'executive_summary',
          'trading_performance',
          'profit_loss',
          'opportunity_analysis',
          'system_health',
          'risk_metrics'
        ]
      },
      weekly_analysis: {
        name: 'Weekly Analysis Report',
        description: 'Comprehensive weekly performance analysis',
        frequency: 'weekly',
        scheduledTime: 'Monday 10:00',
        recipients: ['admin'],
        deliveryChannels: ['email'],
        sections: [
          'executive_summary',
          'trading_performance',
          'profit_loss',
          'market_analysis',
          'strategy_performance',
          'risk_analysis',
          'system_performance',
          'recommendations'
        ]
      },
      monthly_review: {
        name: 'Monthly Performance Review',
        description: 'Monthly comprehensive performance review',
        frequency: 'monthly',
        scheduledTime: '1st 11:00',
        recipients: ['admin', 'stakeholder'],
        deliveryChannels: ['email'],
        sections: [
          'executive_summary',
          'monthly_highlights',
          'trading_performance',
          'profit_loss',
          'market_impact',
          'strategy_evolution',
          'risk_assessment',
          'system_reliability',
          'compliance_status',
          'future_outlook'
        ]
      },
      system_health: {
        name: 'System Health Report',
        description: 'System health and performance metrics',
        frequency: 'daily',
        scheduledTime: '08:00',
        recipients: ['admin', 'monitor'],
        deliveryChannels: ['discord'],
        sections: [
          'system_overview',
          'uptime_metrics',
          'performance_metrics',
          'error_analysis',
          'resource_utilization',
          'alerts_summary'
        ]
      },
      risk_assessment: {
        name: 'Risk Assessment Report',
        description: 'Risk metrics and exposure analysis',
        frequency: 'weekly',
        scheduledTime: 'Friday 16:00',
        recipients: ['admin', 'risk_manager'],
        deliveryChannels: ['email'],
        sections: [
          'risk_summary',
          'exposure_analysis',
          'drawdown_analysis',
          'volatility_metrics',
          'correlation_analysis',
          'scenario_analysis',
          'risk_recommendations'
        ]
      },
      compliance_audit: {
        name: 'Compliance Audit Report',
        description: 'Regulatory compliance and audit trail',
        frequency: 'monthly',
        scheduledTime: '15th 14:00',
        recipients: ['admin', 'compliance'],
        deliveryChannels: ['email'],
        sections: [
          'compliance_summary',
          'audit_trail',
          'regulatory_metrics',
          'transaction_analysis',
          'risk_compliance',
          'documentation_status'
        ]
      }
    };
    
    // Report schedules
    this.schedules = new Map();
    
    // Generated reports storage
    this.generatedReports = new Map(); // reportId -> report metadata
    
    // Data sources (injected dependencies)
    this.dataSources = {
      performanceAnalyzer: options.performanceAnalyzer || null,
      analyticsEngine: options.analyticsEngine || null,
      healthMonitor: options.healthMonitor || null,
      riskManager: options.riskManager || null,
      eventTracker: options.eventTracker || null,
      logManager: options.logManager || null
    };
    
    // Delivery services
    this.deliveryServices = {
      notificationManager: options.notificationManager || null,
      emailService: options.emailService || null
    };
    
    // Report generation state
    this.isGenerating = false;
    this.generationQueue = [];
    
    // Intervals
    this.schedulerInterval = null;
    this.cleanupInterval = null;
    
    this.isInitialized = false;
  }
  
  /**
   * Initialize reporting service
   */
  async initialize() {
    console.log('📊 Initializing Reporting Service...');
    
    try {
      // Create report directory
      await this.createReportDirectory();
      
      // Initialize report schedules
      this.initializeSchedules();
      
      // Start automation if enabled
      if (this.options.enableAutomation) {
        this.startAutomation();
      }
      
      // Setup cleanup
      this.setupCleanup();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      console.log('✅ Reporting Service initialized successfully');
      
    } catch (error) {
      console.error('❌ Reporting Service initialization failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Create report directory
   */
  async createReportDirectory() {
    try {
      await fs.access(this.options.reportDirectory);
    } catch (error) {
      await fs.mkdir(this.options.reportDirectory, { recursive: true });
    }
    
    // Create subdirectories
    const subdirs = ['daily', 'weekly', 'monthly', 'adhoc', 'templates'];
    for (const subdir of subdirs) {
      const dirPath = path.join(this.options.reportDirectory, subdir);
      try {
        await fs.access(dirPath);
      } catch (error) {
        await fs.mkdir(dirPath, { recursive: true });
      }
    }
  }
  
  /**
   * Initialize report schedules
   */
  initializeSchedules() {
    Object.entries(this.reportTemplates).forEach(([templateId, template]) => {
      this.schedules.set(templateId, {
        templateId,
        template,
        nextRun: this.calculateNextRun(template),
        lastRun: null,
        enabled: true
      });
    });
  }
  
  /**
   * Calculate next run time for a template
   */
  calculateNextRun(template) {
    const now = new Date();
    let nextRun = new Date(now);
    
    switch (template.frequency) {
      case 'daily':
        const [hour, minute] = template.scheduledTime.split(':').map(Number);
        nextRun.setHours(hour, minute, 0, 0);
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        break;
        
      case 'weekly':
        const [dayName, time] = template.scheduledTime.split(' ');
        const [weekHour, weekMinute] = time.split(':').map(Number);
        const dayIndex = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(dayName);
        
        nextRun.setHours(weekHour, weekMinute, 0, 0);
        const daysToAdd = (dayIndex - now.getDay() + 7) % 7;
        if (daysToAdd === 0 && nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 7);
        } else {
          nextRun.setDate(nextRun.getDate() + daysToAdd);
        }
        break;
        
      case 'monthly':
        const [dayOfMonth, monthTime] = template.scheduledTime.split(' ');
        const [monthHour, monthMinute] = monthTime.split(':').map(Number);
        
        if (dayOfMonth === '1st') {
          nextRun.setDate(1);
        } else if (dayOfMonth === '15th') {
          nextRun.setDate(15);
        } else {
          nextRun.setDate(parseInt(dayOfMonth));
        }
        
        nextRun.setHours(monthHour, monthMinute, 0, 0);
        if (nextRun <= now) {
          nextRun.setMonth(nextRun.getMonth() + 1);
        }
        break;
        
      default:
        nextRun.setHours(nextRun.getHours() + 1); // Default to 1 hour
    }
    
    return nextRun.getTime();
  }
  
  /**
   * Start automation
   */
  startAutomation() {
    this.schedulerInterval = setInterval(() => {
      this.processSchedules();
    }, 60000); // Check every minute
  }
  
  /**
   * Process scheduled reports
   */
  async processSchedules() {
    const now = Date.now();
    
    for (const [templateId, schedule] of this.schedules.entries()) {
      if (schedule.enabled && schedule.nextRun <= now) {
        try {
          await this.generateScheduledReport(templateId, schedule);
          
          // Update next run time
          schedule.lastRun = now;
          schedule.nextRun = this.calculateNextRun(schedule.template);
          
        } catch (error) {
          console.error(`Failed to generate scheduled report ${templateId}:`, error.message);
        }
      }
    }
  }
  
  /**
   * Generate scheduled report
   */
  async generateScheduledReport(templateId, schedule) {
    const reportId = await this.generateReport(templateId, {
      scheduled: true,
      scheduledTime: schedule.nextRun
    });
    
    // Deliver report if delivery is enabled
    if (this.options.enableDelivery && reportId) {
      await this.deliverReport(reportId);
    }
    
    this.emit('scheduledReportGenerated', { templateId, reportId, schedule });
  }
  
  /**
   * Generate report
   */
  async generateReport(templateId, options = {}) {
    const template = this.reportTemplates[templateId];
    if (!template) {
      throw new Error(`Report template not found: ${templateId}`);
    }
    
    const reportId = this.generateReportId(templateId);
    const startTime = Date.now();
    
    try {
      // Add to generation queue if already generating
      if (this.isGenerating) {
        return new Promise((resolve, reject) => {
          this.generationQueue.push({ templateId, options, resolve, reject });
        });
      }
      
      this.isGenerating = true;
      
      console.log(`📊 Generating report: ${template.name} (${reportId})`);
      
      // Collect data from all sources
      const reportData = await this.collectReportData(template, options);
      
      // Generate report content
      const reportContent = await this.generateReportContent(template, reportData, options);
      
      // Save report
      const reportPath = await this.saveReport(reportId, template, reportContent, options);
      
      // Store report metadata
      const reportMetadata = {
        id: reportId,
        templateId,
        template,
        generatedAt: Date.now(),
        generationTime: Date.now() - startTime,
        path: reportPath,
        format: options.format || 'json',
        scheduled: options.scheduled || false,
        options,
        size: reportContent.length || 0,
        sections: template.sections,
        status: 'completed'
      };
      
      this.generatedReports.set(reportId, reportMetadata);
      
      this.emit('reportGenerated', reportMetadata);
      
      console.log(`✅ Report generated: ${reportId} (${Date.now() - startTime}ms)`);
      
      return reportId;
      
    } catch (error) {
      console.error(`❌ Report generation failed: ${templateId}`, error.message);
      
      // Store error information
      const errorMetadata = {
        id: reportId,
        templateId,
        template,
        generatedAt: Date.now(),
        generationTime: Date.now() - startTime,
        error: error.message,
        status: 'failed',
        options
      };
      
      this.generatedReports.set(reportId, errorMetadata);
      
      this.emit('reportGenerationFailed', errorMetadata);
      
      throw error;
      
    } finally {
      this.isGenerating = false;
      
      // Process queue
      if (this.generationQueue.length > 0) {
        const next = this.generationQueue.shift();
        try {
          const reportId = await this.generateReport(next.templateId, next.options);
          next.resolve(reportId);
        } catch (error) {
          next.reject(error);
        }
      }
    }
  }
  
  /**
   * Collect data from all sources
   */
  async collectReportData(template, options) {
    const data = {
      timestamp: Date.now(),
      reportPeriod: this.calculateReportPeriod(template, options),
      metadata: {
        template: template.name,
        generated: new Date().toISOString(),
        timezone: this.options.defaultTimezone
      }
    };
    
    // Collect from performance analyzer
    if (this.dataSources.performanceAnalyzer) {
      try {
        data.performance = this.dataSources.performanceAnalyzer.getPerformanceReport();
        data.metrics = this.dataSources.performanceAnalyzer.getSnapshot();
      } catch (error) {
        console.warn('Failed to collect performance data:', error.message);
        data.performance = { error: error.message };
      }
    }
    
    // Collect from analytics engine
    if (this.dataSources.analyticsEngine) {
      try {
        data.analytics = this.dataSources.analyticsEngine.getAnalyticsSummary();
      } catch (error) {
        console.warn('Failed to collect analytics data:', error.message);
        data.analytics = { error: error.message };
      }
    }
    
    // Collect from health monitor
    if (this.dataSources.healthMonitor) {
      try {
        data.health = this.dataSources.healthMonitor.getHealthStatus();
        data.healthReport = this.dataSources.healthMonitor.getHealthReport();
      } catch (error) {
        console.warn('Failed to collect health data:', error.message);
        data.health = { error: error.message };
      }
    }
    
    // Collect from risk manager
    if (this.dataSources.riskManager) {
      try {
        data.risk = this.dataSources.riskManager.getRiskReport();
      } catch (error) {
        console.warn('Failed to collect risk data:', error.message);
        data.risk = { error: error.message };
      }
    }
    
    // Collect from event tracker
    if (this.dataSources.eventTracker) {
      try {
        data.events = this.dataSources.eventTracker.getAnalytics();
      } catch (error) {
        console.warn('Failed to collect event data:', error.message);
        data.events = { error: error.message };
      }
    }
    
    // Collect from log manager
    if (this.dataSources.logManager) {
      try {
        data.logs = this.dataSources.logManager.getLogAnalysisSummary();
      } catch (error) {
        console.warn('Failed to collect log data:', error.message);
        data.logs = { error: error.message };
      }
    }
    
    return data;
  }
  
  /**
   * Calculate report period
   */
  calculateReportPeriod(template, options) {
    const now = Date.now();
    let startTime, endTime = now;
    
    if (options.timeRange) {
      return options.timeRange;
    }
    
    switch (template.frequency) {
      case 'daily':
        startTime = now - (24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        startTime = now - (7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startTime = now - (30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = now - (24 * 60 * 60 * 1000);
    }
    
    return {
      start: startTime,
      end: endTime,
      duration: endTime - startTime,
      frequency: template.frequency
    };
  }
  
  /**
   * Generate report content
   */
  async generateReportContent(template, data, options) {
    const format = options.format || 'json';
    const sections = {};
    
    // Generate each section
    for (const sectionId of template.sections) {
      try {
        sections[sectionId] = await this.generateReportSection(sectionId, data, template, options);
      } catch (error) {
        console.warn(`Failed to generate section ${sectionId}:`, error.message);
        sections[sectionId] = { error: error.message };
      }
    }
    
    const reportContent = {
      metadata: data.metadata,
      period: data.reportPeriod,
      summary: this.generateExecutiveSummary(data, sections),
      sections,
      statistics: this.generateReportStatistics(data, sections),
      generated: {
        timestamp: Date.now(),
        format,
        template: template.name,
        version: '1.0'
      }
    };
    
    // Format output
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(reportContent, null, 2);
      case 'html':
        return this.generateHTMLReport(reportContent, template);
      case 'markdown':
        return this.generateMarkdownReport(reportContent, template);
      case 'csv':
        return this.generateCSVReport(reportContent, template);
      default:
        return JSON.stringify(reportContent, null, 2);
    }
  }
  
  /**
   * Generate report section
   */
  async generateReportSection(sectionId, data, template, options) {
    switch (sectionId) {
      case 'executive_summary':
        return this.generateExecutiveSummary(data);
        
      case 'trading_performance':
        return this.generateTradingPerformanceSection(data);
        
      case 'profit_loss':
        return this.generateProfitLossSection(data);
        
      case 'opportunity_analysis':
        return this.generateOpportunityAnalysisSection(data);
        
      case 'system_health':
        return this.generateSystemHealthSection(data);
        
      case 'risk_metrics':
        return this.generateRiskMetricsSection(data);
        
      case 'market_analysis':
        return this.generateMarketAnalysisSection(data);
        
      case 'strategy_performance':
        return this.generateStrategyPerformanceSection(data);
        
      case 'risk_analysis':
        return this.generateRiskAnalysisSection(data);
        
      case 'system_performance':
        return this.generateSystemPerformanceSection(data);
        
      case 'recommendations':
        return this.generateRecommendationsSection(data);
        
      case 'monthly_highlights':
        return this.generateMonthlyHighlightsSection(data);
        
      case 'compliance_status':
        return this.generateComplianceStatusSection(data);
        
      case 'future_outlook':
        return this.generateFutureOutlookSection(data);
        
      default:
        return { error: `Unknown section: ${sectionId}` };
    }
  }
  
  /**
   * Generate executive summary
   */
  generateExecutiveSummary(data, sections = {}) {
    const summary = {
      title: 'Executive Summary',
      period: data.reportPeriod,
      keyMetrics: {},
      highlights: [],
      concerns: [],
      recommendations: []
    };
    
    // Extract key metrics from performance data
    if (data.performance?.summary) {
      const perf = data.performance.summary;
      summary.keyMetrics = {
        totalOpportunities: perf.totalOpportunities || 0,
        successRate: perf.successRate || 0,
        totalProfit: perf.totalProfit || 0,
        averageLatency: perf.avgLatency || 0,
        uptime: perf.uptime || 0
      };
      
      // Generate highlights
      if (perf.successRate > 90) {
        summary.highlights.push(`Excellent success rate: ${perf.successRate.toFixed(1)}%`);
      }
      if (perf.totalProfit > 1000) {
        summary.highlights.push(`Strong profitability: ${perf.totalProfit.toFixed(2)} total profit`);
      }
      if (perf.avgLatency < 100) {
        summary.highlights.push(`Low latency performance: ${perf.avgLatency.toFixed(0)}ms average`);
      }
      
      // Generate concerns
      if (perf.successRate < 70) {
        summary.concerns.push(`Low success rate: ${perf.successRate.toFixed(1)}%`);
      }
      if (perf.avgLatency > 500) {
        summary.concerns.push(`High latency detected: ${perf.avgLatency.toFixed(0)}ms average`);
      }
    }
    
    // Extract health concerns
    if (data.health?.issues) {
      const criticalIssues = data.health.issues.filter(issue => issue.critical);
      if (criticalIssues.length > 0) {
        summary.concerns.push(`${criticalIssues.length} critical system issues detected`);
      }
    }
    
    // Generate recommendations
    if (data.analytics?.insights?.recommendations) {
      summary.recommendations = data.analytics.insights.recommendations
        .slice(0, 3)
        .map(rec => rec.title);
    }
    
    return summary;
  }
  
  /**
   * Generate trading performance section
   */
  generateTradingPerformanceSection(data) {
    const section = {
      title: 'Trading Performance',
      metrics: {},
      trends: {},
      analysis: {}
    };
    
    if (data.performance?.summary) {
      const perf = data.performance.summary;
      section.metrics = {
        totalTrades: perf.totalOpportunities || 0,
        successfulTrades: Math.round((perf.totalOpportunities || 0) * (perf.successRate || 0) / 100),
        successRate: perf.successRate || 0,
        averageExecutionTime: perf.avgLatency || 0,
        totalVolume: perf.totalVolume || 0
      };
    }
    
    if (data.analytics?.profitability) {
      section.trends = {
        topPerformingPairs: data.analytics.profitability.topTokenPairs || [],
        bestTradingHours: data.analytics.profitability.bestTradingHours || []
      };
    }
    
    return section;
  }
  
  /**
   * Generate profit & loss section
   */
  generateProfitLossSection(data) {
    const section = {
      title: 'Profit & Loss Analysis',
      summary: {},
      breakdown: {},
      trends: {}
    };
    
    if (data.performance?.summary) {
      section.summary = {
        totalProfit: data.performance.summary.totalProfit || 0,
        totalLoss: 0, // Would calculate from detailed data
        netPnL: data.performance.summary.totalProfit || 0,
        profitFactor: 1, // Would calculate from detailed data
        winRate: data.performance.summary.successRate || 0
      };
    }
    
    return section;
  }
  
  /**
   * Generate opportunity analysis section
   */
  generateOpportunityAnalysisSection(data) {
    const section = {
      title: 'Opportunity Analysis',
      summary: {},
      conversion: {},
      patterns: {}
    };
    
    if (data.events?.summary) {
      const opportunities = data.events.summary.eventsByCategory?.opportunity || 0;
      const trades = data.events.summary.eventsByCategory?.trading || 0;
      
      section.summary = {
        opportunitiesDetected: opportunities,
        opportunitiesExecuted: trades,
        conversionRate: opportunities > 0 ? (trades / opportunities) * 100 : 0
      };
    }
    
    return section;
  }
  
  /**
   * Generate system health section
   */
  generateSystemHealthSection(data) {
    const section = {
      title: 'System Health',
      overall: {},
      components: {},
      issues: []
    };
    
    if (data.health) {
      section.overall = {
        status: data.health.overall || 'unknown',
        uptime: data.health.uptime || 0,
        lastCheck: data.health.lastCheck || null
      };
      
      section.issues = data.health.issues || [];
    }
    
    if (data.healthReport?.system) {
      section.components = {
        nodeVersion: data.healthReport.system.nodeVersion,
        platform: data.healthReport.system.platform,
        totalMemory: data.healthReport.system.totalMemory,
        freeMemory: data.healthReport.system.freeMemory,
        cpuCount: data.healthReport.system.cpuCount
      };
    }
    
    return section;
  }
  
  /**
   * Generate risk metrics section
   */
  generateRiskMetricsSection(data) {
    const section = {
      title: 'Risk Metrics',
      current: {},
      historical: {},
      limits: {}
    };
    
    if (data.risk?.summary) {
      section.current = {
        riskScore: data.risk.summary.overallRiskScore || 0,
        currentDrawdown: data.risk.summary.currentDrawdown || 0,
        exposureLevel: data.risk.summary.currentExposure || 0,
        emergencyStop: data.risk.summary.emergencyStop || false
      };
    }
    
    return section;
  }
  
  /**
   * Generate market analysis section
   */
  generateMarketAnalysisSection(data) {
    return {
      title: 'Market Analysis',
      conditions: {},
      volatility: {},
      liquidity: {},
      trends: {}
    };
  }
  
  /**
   * Generate strategy performance section
   */
  generateStrategyPerformanceSection(data) {
    return {
      title: 'Strategy Performance',
      strategies: {},
      comparison: {},
      optimization: {}
    };
  }
  
  /**
   * Generate risk analysis section
   */
  generateRiskAnalysisSection(data) {
    const section = {
      title: 'Risk Analysis',
      assessment: {},
      scenarios: {},
      recommendations: []
    };
    
    if (data.analytics?.risk) {
      section.assessment = {
        sharpeRatio: data.analytics.risk.sharpeRatio || 0,
        sortinoRatio: data.analytics.risk.sortinoRatio || 0,
        maxDrawdown: data.analytics.risk.maxDrawdown || 0,
        currentDrawdown: data.analytics.risk.currentDrawdown || 0
      };
    }
    
    return section;
  }
  
  /**
   * Generate system performance section
   */
  generateSystemPerformanceSection(data) {
    const section = {
      title: 'System Performance',
      metrics: {},
      bottlenecks: [],
      optimization: {}
    };
    
    if (data.performance?.components) {
      section.metrics = {
        averageLatency: data.performance.components.networkOptimizer?.averageLatency || 0,
        errorRate: data.performance.components.errorRate || 0,
        throughput: data.performance.components.throughput || 0
      };
    }
    
    return section;
  }
  
  /**
   * Generate recommendations section
   */
  generateRecommendationsSection(data) {
    const section = {
      title: 'Recommendations',
      performance: [],
      risk: [],
      system: [],
      strategy: []
    };
    
    if (data.analytics?.insights) {
      section.performance = data.analytics.insights.recommendations || [];
      section.risk = data.analytics.insights.warnings || [];
      section.system = data.analytics.insights.optimizations || [];
    }
    
    return section;
  }
  
  /**
   * Generate monthly highlights section
   */
  generateMonthlyHighlightsSection(data) {
    return {
      title: 'Monthly Highlights',
      achievements: [],
      milestones: [],
      improvements: [],
      challenges: []
    };
  }
  
  /**
   * Generate compliance status section
   */
  generateComplianceStatusSection(data) {
    return {
      title: 'Compliance Status',
      regulatory: {},
      audit: {},
      documentation: {},
      issues: []
    };
  }
  
  /**
   * Generate future outlook section
   */
  generateFutureOutlookSection(data) {
    return {
      title: 'Future Outlook',
      forecasts: {},
      opportunities: [],
      risks: [],
      roadmap: []
    };
  }
  
  /**
   * Generate report statistics
   */
  generateReportStatistics(data, sections) {
    return {
      dataPoints: Object.keys(data).length,
      sections: Object.keys(sections).length,
      generationTime: Date.now() - data.timestamp,
      coverage: {
        performance: !!data.performance,
        analytics: !!data.analytics,
        health: !!data.health,
        risk: !!data.risk,
        events: !!data.events,
        logs: !!data.logs
      }
    };
  }
  
  /**
   * Generate HTML report
   */
  generateHTMLReport(content, template) {
    let html = `
<!DOCTYPE html>
<html>
<head>
  <title>${template.name}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    .header { border-bottom: 2px solid #ccc; padding-bottom: 20px; margin-bottom: 30px; }
    .section { margin-bottom: 30px; }
    .metric { display: inline-block; margin: 10px; padding: 15px; background: #f5f5f5; border-radius: 5px; }
    .highlight { color: #28a745; }
    .concern { color: #dc3545; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${template.name}</h1>
    <p>Generated: ${new Date(content.generated.timestamp).toLocaleString()}</p>
    <p>Period: ${new Date(content.period.start).toLocaleDateString()} - ${new Date(content.period.end).toLocaleDateString()}</p>
  </div>
`;
    
    // Add sections
    Object.entries(content.sections).forEach(([sectionId, section]) => {
      html += `
  <div class="section">
    <h2>${section.title || sectionId}</h2>
    <pre>${JSON.stringify(section, null, 2)}</pre>
  </div>`;
    });
    
    html += `
  <div class="footer">
    <p><small>Generated by Arbitrage Bot Reporting Service v${content.generated.version}</small></p>
  </div>
</body>
</html>`;
    
    return html;
  }
  
  /**
   * Generate Markdown report
   */
  generateMarkdownReport(content, template) {
    let markdown = `# ${template.name}\n\n`;
    markdown += `**Generated:** ${new Date(content.generated.timestamp).toLocaleString()}\n`;
    markdown += `**Period:** ${new Date(content.period.start).toLocaleDateString()} - ${new Date(content.period.end).toLocaleDateString()}\n\n`;
    
    // Add sections
    Object.entries(content.sections).forEach(([sectionId, section]) => {
      markdown += `## ${section.title || sectionId}\n\n`;
      markdown += '```json\n';
      markdown += JSON.stringify(section, null, 2);
      markdown += '\n```\n\n';
    });
    
    markdown += `---\n*Generated by Arbitrage Bot Reporting Service v${content.generated.version}*\n`;
    
    return markdown;
  }
  
  /**
   * Generate CSV report
   */
  generateCSVReport(content, template) {
    const rows = [];
    rows.push('Section,Metric,Value,Timestamp');
    
    // Extract metrics from sections
    Object.entries(content.sections).forEach(([sectionId, section]) => {
      if (section.metrics) {
        Object.entries(section.metrics).forEach(([metric, value]) => {
          rows.push(`${sectionId},${metric},${value},${content.generated.timestamp}`);
        });
      }
    });
    
    return rows.join('\n');
  }
  
  /**
   * Save report to disk
   */
  async saveReport(reportId, template, content, options) {
    const format = options.format || 'json';
    const extension = format === 'json' ? 'json' : format;
    const subdirectory = options.scheduled ? template.frequency : 'adhoc';
    
    const filename = `${reportId}.${extension}`;
    const reportPath = path.join(this.options.reportDirectory, subdirectory, filename);
    
    await fs.writeFile(reportPath, content, 'utf8');
    
    return reportPath;
  }
  
  /**
   * Deliver report
   */
  async deliverReport(reportId) {
    const reportMetadata = this.generatedReports.get(reportId);
    if (!reportMetadata) {
      throw new Error(`Report not found: ${reportId}`);
    }
    
    const template = reportMetadata.template;
    
    try {
      // Send via notification manager
      if (this.deliveryServices.notificationManager) {
        for (const recipient of template.recipients) {
          await this.deliveryServices.notificationManager.sendNotification('report_generated', {
            reportId,
            reportName: template.name,
            generatedAt: reportMetadata.generatedAt,
            format: reportMetadata.format,
            path: reportMetadata.path
          }, {
            recipients: [recipient],
            channels: template.deliveryChannels
          });
        }
      }
      
      this.emit('reportDelivered', { reportId, template });
      
    } catch (error) {
      console.error(`Failed to deliver report ${reportId}:`, error.message);
      this.emit('reportDeliveryFailed', { reportId, error: error.message });
    }
  }
  
  /**
   * Get report
   */
  async getReport(reportId, format = null) {
    const reportMetadata = this.generatedReports.get(reportId);
    if (!reportMetadata) {
      throw new Error(`Report not found: ${reportId}`);
    }
    
    if (reportMetadata.status === 'failed') {
      throw new Error(`Report generation failed: ${reportMetadata.error}`);
    }
    
    // Read report content
    const content = await fs.readFile(reportMetadata.path, 'utf8');
    
    if (!format || format === reportMetadata.format) {
      return {
        metadata: reportMetadata,
        content
      };
    }
    
    // Convert format if requested
    const parsedContent = JSON.parse(content);
    let convertedContent;
    
    switch (format.toLowerCase()) {
      case 'html':
        convertedContent = this.generateHTMLReport(parsedContent, reportMetadata.template);
        break;
      case 'markdown':
        convertedContent = this.generateMarkdownReport(parsedContent, reportMetadata.template);
        break;
      case 'csv':
        convertedContent = this.generateCSVReport(parsedContent, reportMetadata.template);
        break;
      default:
        convertedContent = content;
    }
    
    return {
      metadata: reportMetadata,
      content: convertedContent
    };
  }
  
  /**
   * List reports
   */
  listReports(filter = {}) {
    const reports = Array.from(this.generatedReports.values());
    
    let filteredReports = reports;
    
    if (filter.templateId) {
      filteredReports = filteredReports.filter(r => r.templateId === filter.templateId);
    }
    
    if (filter.status) {
      filteredReports = filteredReports.filter(r => r.status === filter.status);
    }
    
    if (filter.scheduled !== undefined) {
      filteredReports = filteredReports.filter(r => r.scheduled === filter.scheduled);
    }
    
    if (filter.timeRange) {
      const { start, end } = filter.timeRange;
      filteredReports = filteredReports.filter(r => 
        r.generatedAt >= start && r.generatedAt <= end
      );
    }
    
    // Sort by generation time (newest first)
    return filteredReports.sort((a, b) => b.generatedAt - a.generatedAt);
  }
  
  /**
   * Delete report
   */
  async deleteReport(reportId) {
    const reportMetadata = this.generatedReports.get(reportId);
    if (!reportMetadata) {
      return false;
    }
    
    try {
      // Delete file
      await fs.unlink(reportMetadata.path);
    } catch (error) {
      console.warn(`Failed to delete report file: ${error.message}`);
    }
    
    // Remove from metadata
    this.generatedReports.delete(reportId);
    
    this.emit('reportDeleted', { reportId });
    
    return true;
  }
  
  /**
   * Update schedule
   */
  updateSchedule(templateId, updates) {
    const schedule = this.schedules.get(templateId);
    if (!schedule) {
      throw new Error(`Schedule not found: ${templateId}`);
    }
    
    Object.assign(schedule, updates);
    
    // Recalculate next run if time changed
    if (updates.scheduledTime) {
      schedule.template.scheduledTime = updates.scheduledTime;
      schedule.nextRun = this.calculateNextRun(schedule.template);
    }
    
    this.emit('scheduleUpdated', { templateId, schedule });
  }
  
  /**
   * Setup cleanup
   */
  setupCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldReports();
    }, 24 * 60 * 60 * 1000); // Daily
  }
  
  /**
   * Cleanup old reports
   */
  async cleanupOldReports() {
    const cutoff = Date.now() - this.options.maxReportAge;
    const toDelete = [];
    
    this.generatedReports.forEach((metadata, reportId) => {
      if (metadata.generatedAt < cutoff) {
        toDelete.push(reportId);
      }
    });
    
    for (const reportId of toDelete) {
      await this.deleteReport(reportId);
    }
    
    if (toDelete.length > 0) {
      console.log(`🧹 Report cleanup: removed ${toDelete.length} old reports`);
    }
  }
  
  /**
   * Generate unique report ID
   */
  generateReportId(templateId) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substr(2, 6);
    return `${templateId}_${timestamp}_${random}`;
  }
  
  /**
   * Get reporting statistics
   */
  getStatistics() {
    const reports = Array.from(this.generatedReports.values());
    
    return {
      total: reports.length,
      completed: reports.filter(r => r.status === 'completed').length,
      failed: reports.filter(r => r.status === 'failed').length,
      scheduled: reports.filter(r => r.scheduled).length,
      adhoc: reports.filter(r => !r.scheduled).length,
      byTemplate: reports.reduce((acc, report) => {
        acc[report.templateId] = (acc[report.templateId] || 0) + 1;
        return acc;
      }, {}),
      avgGenerationTime: reports.length > 0 ?
        reports.reduce((sum, r) => sum + (r.generationTime || 0), 0) / reports.length : 0,
      schedules: {
        total: this.schedules.size,
        enabled: Array.from(this.schedules.values()).filter(s => s.enabled).length,
        nextRuns: Array.from(this.schedules.values())
          .filter(s => s.enabled)
          .map(s => ({
            templateId: s.templateId,
            nextRun: new Date(s.nextRun).toISOString()
          }))
      }
    };
  }
  
  /**
   * Shutdown reporting service
   */
  async shutdown() {
    console.log('🛑 Shutting down Reporting Service...');
    
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Wait for any pending generation to complete
    while (this.isGenerating) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.isInitialized = false;
    this.emit('shutdown');
    
    console.log('✅ Reporting Service shutdown complete');
  }
}

export default ReportingService;