import { EventEmitter } from 'events';
import winston from 'winston';
import fs from 'fs/promises';
import path from 'path';

/**
 * LogManager - Comprehensive logging and log analysis system
 * Provides structured logging, log analysis, pattern recognition, and audit trails
 */
class LogManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      logLevel: options.logLevel || 'info',
      logDirectory: options.logDirectory || './logs',
      maxFileSize: options.maxFileSize || 100 * 1024 * 1024, // 100MB
      maxFiles: options.maxFiles || 10,
      retentionDays: options.retentionDays || 30,
      enableConsole: options.enableConsole !== false,
      enableFile: options.enableFile !== false,
      enableAnalysis: options.enableAnalysis !== false,
      analysisInterval: options.analysisInterval || 300000, // 5 minutes
      patternThreshold: options.patternThreshold || 5, // 5 occurrences to identify pattern
      ...options
    };
    
    // Logger instance
    this.logger = null;
    
    // Log analysis data
    this.logAnalysis = {
      patterns: new Map(),
      errorCount: new Map(),
      performanceMetrics: new Map(),
      securityEvents: [],
      auditTrail: [],
      correlationIds: new Map()
    };
    
    // Real-time log streaming
    this.logStreams = new Set();
    this.logBuffer = [];
    this.maxBufferSize = 1000;
    
    // Pattern recognition
    this.patterns = {
      errors: new Map(),
      warnings: new Map(),
      performance: new Map(),
      security: new Map(),
      business: new Map()
    };
    
    // Analysis intervals
    this.analysisInterval = null;
    this.cleanupInterval = null;
    
    // Context tracking
    this.contextStack = [];
    this.correlationCounter = 0;
    
    this.isInitialized = false;
  }
  
  /**
   * Initialize the log manager
   */
  async initialize() {
    console.log('📝 Initializing Log Manager...');
    
    try {
      // Create log directory
      await this.createLogDirectory();
      
      // Initialize Winston logger
      await this.initializeLogger();
      
      // Start log analysis if enabled
      if (this.options.enableAnalysis) {
        this.startLogAnalysis();
      }
      
      // Setup cleanup
      this.setupCleanup();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      console.log('✅ Log Manager initialized successfully');
      
    } catch (error) {
      console.error('❌ Log Manager initialization failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Create log directory if it doesn't exist
   */
  async createLogDirectory() {
    try {
      await fs.access(this.options.logDirectory);
    } catch (error) {
      await fs.mkdir(this.options.logDirectory, { recursive: true });
    }
  }
  
  /**
   * Initialize Winston logger with custom configuration  
   */
  async initializeLogger() {
    const formats = [];
    
    // Add timestamp
    formats.push(winston.format.timestamp());
    
    // Add custom format for structured logging
    formats.push(winston.format.errors({ stack: true }));
    formats.push(winston.format.json());
    
    // Create transports
    const transports = [];
    
    // Console transport
    if (this.options.enableConsole) {
      transports.push(new winston.transports.Console({
        level: this.options.logLevel,
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            let output = `${timestamp} [${level}]: ${message}`;
            if (Object.keys(meta).length > 0) {
              output += ` ${JSON.stringify(meta)}`;
            }
            return output;
          })
        )
      }));
    }
    
    // File transports
    if (this.options.enableFile) {
      // Combined logs
      transports.push(new winston.transports.File({
        filename: path.join(this.options.logDirectory, 'combined.log'),
        level: this.options.logLevel,
        maxsize: this.options.maxFileSize,
        maxFiles: this.options.maxFiles,
        format: winston.format.combine(...formats)
      }));
      
      // Error logs
      transports.push(new winston.transports.File({
        filename: path.join(this.options.logDirectory, 'error.log'),
        level: 'error',
        maxsize: this.options.maxFileSize,
        maxFiles: this.options.maxFiles,
        format: winston.format.combine(...formats)
      }));
      
      // Performance logs
      transports.push(new winston.transports.File({
        filename: path.join(this.options.logDirectory, 'performance.log'),
        level: 'info',
        maxsize: this.options.maxFileSize,
        maxFiles: this.options.maxFiles,
        format: winston.format.combine(...formats),
        // Only log performance-related entries
        filter: (info) => info.category === 'performance'
      }));
      
      // Security logs
      transports.push(new winston.transports.File({
        filename: path.join(this.options.logDirectory, 'security.log'),
        level: 'warn',
        maxsize: this.options.maxFileSize,
        maxFiles: this.options.maxFiles,
        format: winston.format.combine(...formats),
        // Only log security-related entries
        filter: (info) => info.category === 'security'
      }));
      
      // Audit logs
      transports.push(new winston.transports.File({
        filename: path.join(this.options.logDirectory, 'audit.log'),
        level: 'info',
        maxsize: this.options.maxFileSize,
        maxFiles: this.options.maxFiles,
        format: winston.format.combine(...formats),
        // Only log audit-related entries
        filter: (info) => info.category === 'audit'
      }));
    }
    
    // Create logger
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      transports,
      exitOnError: false
    });
    
    // Add custom logging methods
    this.setupCustomMethods();
    
    // Hook into logger to capture logs for analysis
    if (this.options.enableAnalysis) {
      this.hookLogCapture();
    }
  }
  
  /**
   * Setup custom logging methods
   */
  setupCustomMethods() {
    // Performance logging
    this.logger.performance = (message, data = {}) => {
      this.logger.info(message, {
        ...data,
        category: 'performance',
        timestamp: Date.now(),
        correlationId: this.getCurrentCorrelationId()
      });
    };
    
    // Security logging
    this.logger.security = (message, data = {}) => {
      this.logger.warn(message, {
        ...data,
        category: 'security',
        timestamp: Date.now(),
        correlationId: this.getCurrentCorrelationId()
      });
      
      // Add to security events for analysis
      this.logAnalysis.securityEvents.push({
        timestamp: Date.now(),
        message,
        data,
        correlationId: this.getCurrentCorrelationId()
      });
    };
    
    // Audit logging
    this.logger.audit = (action, data = {}) => {
      const auditEntry = {
        action,
        timestamp: Date.now(),
        correlationId: this.getCurrentCorrelationId(),
        context: this.getCurrentContext(),
        ...data
      };
      
      this.logger.info(`Audit: ${action}`, {
        ...auditEntry,
        category: 'audit'
      });
      
      // Add to audit trail
      this.logAnalysis.auditTrail.push(auditEntry);
      
      // Keep audit trail size manageable
      if (this.logAnalysis.auditTrail.length > 10000) {
        this.logAnalysis.auditTrail = this.logAnalysis.auditTrail.slice(-5000);
      }
    };
    
    // Business event logging
    this.logger.business = (event, data = {}) => {
      this.logger.info(`Business Event: ${event}`, {
        event,
        ...data,
        category: 'business',
        timestamp: Date.now(),
        correlationId: this.getCurrentCorrelationId()
      });
    };
    
    // Trade logging
    this.logger.trade = (action, tradeData = {}) => {
      this.logger.info(`Trade: ${action}`, {
        action,
        ...tradeData,
        category: 'trade',
        timestamp: Date.now(),
        correlationId: this.getCurrentCorrelationId()
      });
    };
    
    // Opportunity logging
    this.logger.opportunity = (stage, opportunityData = {}) => {
      this.logger.info(`Opportunity: ${stage}`, {
        stage,
        ...opportunityData,
        category: 'opportunity',
        timestamp: Date.now(),
        correlationId: this.getCurrentCorrelationId()
      });
    };
  }
  
  /**
   * Hook into logger to capture logs for real-time analysis
   */
  hookLogCapture() {
    // Hook into logger events instead of using a stream transport
    this.logger.on('data', (info) => {
      try {
        this.processLogEntry(info);
        this.bufferLogEntry(info);
        this.streamLogEntry(info);
      } catch (error) {
        // Ignore processing errors
      }
    });
  }
  
  /**
   * Process log entry for analysis
   */
  processLogEntry(logEntry) {
    const { level, message, category, timestamp = Date.now() } = logEntry;
    
    // Error pattern analysis
    if (level === 'error') {
      this.analyzeErrorPattern(message, logEntry);
    }
    
    // Performance pattern analysis
    if (category === 'performance') {
      this.analyzePerformancePattern(logEntry);
    }
    
    // Security pattern analysis
    if (category === 'security') {
      this.analyzeSecurityPattern(logEntry);
    }
    
    // General pattern recognition
    this.recognizePatterns(logEntry);
    
    // Update correlation tracking
    if (logEntry.correlationId) {
      this.updateCorrelationTracking(logEntry);
    }
  }
  
  /**
   * Analyze error patterns
   */
  analyzeErrorPattern(message, logEntry) {
    // Normalize error message for pattern detection
    const normalizedMessage = this.normalizeErrorMessage(message);
    
    const errorPattern = this.patterns.errors.get(normalizedMessage) || {
      count: 0,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      examples: [],
      correlationIds: new Set()
    };
    
    errorPattern.count++;
    errorPattern.lastSeen = Date.now();
    errorPattern.examples.push({
      timestamp: Date.now(),
      fullMessage: message,
      context: logEntry
    });
    
    if (logEntry.correlationId) {
      errorPattern.correlationIds.add(logEntry.correlationId);
    }
    
    // Keep only recent examples
    if (errorPattern.examples.length > 10) {
      errorPattern.examples = errorPattern.examples.slice(-5);
    }
    
    this.patterns.errors.set(normalizedMessage, errorPattern);
    
    // Emit pattern event if threshold reached
    if (errorPattern.count === this.options.patternThreshold) {
      this.emit('patternDetected', {
        type: 'error',
        pattern: normalizedMessage,
        details: errorPattern
      });
    }
  }
  
  /**
   * Normalize error message for pattern detection
   */
  normalizeErrorMessage(message) {
    // Remove specific values to identify patterns
    return message
      .replace(/\b\d+\b/g, 'NUMBER') // Replace numbers
      .replace(/0x[a-fA-F0-9]+/g, 'HASH') // Replace hashes
      .replace(/\b[A-Z0-9]{20,}\b/g, 'TOKEN') // Replace token addresses
      .replace(/\d+\.\d+/g, 'DECIMAL') // Replace decimals
      .replace(/timeout of \d+ms exceeded/g, 'timeout exceeded')
      .toLowerCase();
  }
  
  /**
   * Analyze performance patterns
   */
  analyzePerformancePattern(logEntry) {
    const { executionTime, operation, component } = logEntry;
    
    if (executionTime && operation) {
      const key = `${component}-${operation}`;
      const perfMetrics = this.logAnalysis.performanceMetrics.get(key) || {
        count: 0,
        totalTime: 0,
        minTime: Infinity,
        maxTime: 0,
        recentTimes: []
      };
      
      perfMetrics.count++;
      perfMetrics.totalTime += executionTime;
      perfMetrics.minTime = Math.min(perfMetrics.minTime, executionTime);
      perfMetrics.maxTime = Math.max(perfMetrics.maxTime, executionTime);
      perfMetrics.recentTimes.push(executionTime);
      
      // Keep only recent times for trend analysis
      if (perfMetrics.recentTimes.length > 100) {
        perfMetrics.recentTimes = perfMetrics.recentTimes.slice(-50);
      }
      
      this.logAnalysis.performanceMetrics.set(key, perfMetrics);
      
      // Check for performance degradation
      if (perfMetrics.recentTimes.length >= 10) {
        const recentAvg = perfMetrics.recentTimes.slice(-10)
          .reduce((a, b) => a + b, 0) / 10;
        const overallAvg = perfMetrics.totalTime / perfMetrics.count;
        
        if (recentAvg > overallAvg * 1.5) {
          this.emit('performanceDegradation', {
            operation: key,
            recentAvg,
            overallAvg,
            degradation: ((recentAvg - overallAvg) / overallAvg) * 100
          });
        }
      }
    }
  }
  
  /**
   * Analyze security patterns
   */
  analyzeSecurityPattern(logEntry) {
    const { message, source, ip, user } = logEntry;
    
    // Track security events by source
    if (source) {
      const secPattern = this.patterns.security.get(source) || {
        count: 0,
        events: [],
        severity: 'low'
      };
      
      secPattern.count++;
      secPattern.events.push({
        timestamp: Date.now(),
        message,
        ip,
        user
      });
      
      // Keep only recent events
      if (secPattern.events.length > 20) {
        secPattern.events = secPattern.events.slice(-10);
      }
      
      // Escalate severity based on frequency
      if (secPattern.count > 10) {
        secPattern.severity = 'high';
      } else if (secPattern.count > 5) {
        secPattern.severity = 'medium';
      }
      
      this.patterns.security.set(source, secPattern);
      
      // Emit security alert for high severity
      if (secPattern.severity === 'high') {
        this.emit('securityAlert', {
          source,
          pattern: secPattern,
          message: `High frequency security events from ${source}`
        });
      }
    }
  }
  
  /**
   * General pattern recognition
   */
  recognizePatterns(logEntry) {
    const { level, message, category } = logEntry;
    
    // Create pattern key
    const patternKey = `${level}-${category}-${this.normalizeMessage(message)}`;
    
    const pattern = this.logAnalysis.patterns.get(patternKey) || {
      count: 0,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      level,
      category,
      normalizedMessage: this.normalizeMessage(message)
    };
    
    pattern.count++;
    pattern.lastSeen = Date.now();
    
    this.logAnalysis.patterns.set(patternKey, pattern);
  }
  
  /**
   * Normalize message for pattern recognition
   */
  normalizeMessage(message) {
    return message.substring(0, 100); // First 100 chars for pattern matching
  }
  
  /**
   * Update correlation tracking
   */
  updateCorrelationTracking(logEntry) {
    const { correlationId } = logEntry;
    
    const correlation = this.logAnalysis.correlationIds.get(correlationId) || {
      logs: [],
      startTime: Date.now(),
      endTime: null,
      duration: null
    };
    
    correlation.logs.push({
      timestamp: Date.now(),
      level: logEntry.level,
      message: logEntry.message,
      category: logEntry.category
    });
    
    correlation.endTime = Date.now();
    correlation.duration = correlation.endTime - correlation.startTime;
    
    this.logAnalysis.correlationIds.set(correlationId, correlation);
    
    // Clean up old correlations
    if (this.logAnalysis.correlationIds.size > 1000) {
      const oldestCorrelations = Array.from(this.logAnalysis.correlationIds.entries())
        .sort((a, b) => a[1].startTime - b[1].startTime)
        .slice(0, 500);
      
      oldestCorrelations.forEach(([id]) => {
        this.logAnalysis.correlationIds.delete(id);
      });
    }
  }
  
  /**
   * Buffer log entry for streaming
   */
  bufferLogEntry(logEntry) {
    this.logBuffer.push(logEntry);
    
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize / 2);
    }
  }
  
  /**
   * Stream log entry to connected clients
   */
  streamLogEntry(logEntry) {
    if (this.logStreams.size > 0) {
      const streamData = {
        type: 'logEntry',
        data: logEntry,
        timestamp: Date.now()
      };
      
      this.logStreams.forEach(stream => {
        try {
          if (stream.readyState === 1) { // WebSocket.OPEN
            stream.send(JSON.stringify(streamData));
          }
        } catch (error) {
          this.logStreams.delete(stream);
        }
      });
    }
  }
  
  /**
   * Start log analysis
   */
  startLogAnalysis() {
    this.analysisInterval = setInterval(() => {
      this.performLogAnalysis();
    }, this.options.analysisInterval);
  }
  
  /**
   * Perform comprehensive log analysis
   */
  performLogAnalysis() {
    try {
      const analysis = {
        timestamp: Date.now(),
        patterns: this.analyzeLogPatterns(),
        performance: this.analyzePerformanceMetrics(),
        security: this.analyzeSecurityEvents(),
        trends: this.analyzeTrends(),
        anomalies: this.detectLogAnomalies()
      };
      
      this.emit('analysisComplete', analysis);
      
    } catch (error) {
      console.error('Log analysis failed:', error.message);
    }
  }
  
  /**
   * Analyze log patterns
   */
  analyzeLogPatterns() {
    const patterns = {
      frequent: [],
      recent: [],
      concerning: []
    };
    
    // Most frequent patterns
    patterns.frequent = Array.from(this.logAnalysis.patterns.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([key, pattern]) => ({ key, ...pattern }));
    
    // Recent patterns (last hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    patterns.recent = Array.from(this.logAnalysis.patterns.entries())
      .filter(([, pattern]) => pattern.lastSeen > oneHourAgo)
      .sort((a, b) => b[1].lastSeen - a[1].lastSeen)
      .slice(0, 10)
      .map(([key, pattern]) => ({ key, ...pattern }));
    
    // Concerning patterns (errors, high frequency)
    patterns.concerning = Array.from(this.logAnalysis.patterns.entries())
      .filter(([, pattern]) => 
        pattern.level === 'error' && pattern.count > this.options.patternThreshold)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([key, pattern]) => ({ key, ...pattern }));
    
    return patterns;
  }
  
  /**
   * Analyze performance metrics from logs
   */
  analyzePerformanceMetrics() {
    const metrics = {
      slowestOperations: [],
      degradingOperations: [],
      summary: {
        totalOperations: 0,
        averageTime: 0,
        operationCount: this.logAnalysis.performanceMetrics.size
      }
    };
    
    let totalTime = 0;
    let totalCount = 0;
    
    // Analyze each operation
    Array.from(this.logAnalysis.performanceMetrics.entries()).forEach(([operation, data]) => {
      const avgTime = data.totalTime / data.count;
      totalTime += data.totalTime;
      totalCount += data.count;
      
      // Slowest operations
      metrics.slowestOperations.push({
        operation,
        averageTime: avgTime,
        maxTime: data.maxTime,
        count: data.count
      });
      
      // Check for degradation
      if (data.recentTimes.length >= 10) {
        const recentAvg = data.recentTimes.slice(-10)
          .reduce((a, b) => a + b, 0) / 10;
        const overallAvg = avgTime;
        
        if (recentAvg > overallAvg * 1.2) {
          metrics.degradingOperations.push({
            operation,
            recentAvg,
            overallAvg,
            degradation: ((recentAvg - overallAvg) / overallAvg) * 100
          });
        }
      }
    });
    
    // Sort by average time
    metrics.slowestOperations.sort((a, b) => b.averageTime - a.averageTime);
    metrics.slowestOperations = metrics.slowestOperations.slice(0, 10);
    
    // Summary
    metrics.summary.totalOperations = totalCount;
    metrics.summary.averageTime = totalCount > 0 ? totalTime / totalCount : 0;
    
    return metrics;
  }
  
  /**
   * Analyze security events
   */
  analyzeSecurityEvents() {
    const recentEvents = this.logAnalysis.securityEvents.slice(-100);
    
    return {
      recentCount: recentEvents.length,
      eventsBySource: this.groupSecurityEventsBySource(recentEvents),
      timeline: this.createSecurityTimeline(recentEvents),
      severity: this.assessSecuritySeverity(recentEvents)
    };
  }
  
  /**
   * Group security events by source
   */
  groupSecurityEventsBySource(events) {
    const grouped = new Map();
    
    events.forEach(event => {
      const source = event.data.source || 'unknown';
      const sourceEvents = grouped.get(source) || [];
      sourceEvents.push(event);
      grouped.set(source, sourceEvents);
    });
    
    return Array.from(grouped.entries())
      .map(([source, events]) => ({
        source,
        count: events.length,
        lastEvent: Math.max(...events.map(e => e.timestamp))
      }))
      .sort((a, b) => b.count - a.count);
  }
  
  /**
   * Create security timeline
   */
  createSecurityTimeline(events) {
    const timeline = new Map();
    const hourMs = 60 * 60 * 1000;
    
    events.forEach(event => {
      const hour = Math.floor(event.timestamp / hourMs) * hourMs;
      const hourCount = timeline.get(hour) || 0;
      timeline.set(hour, hourCount + 1);
    });
    
    return Array.from(timeline.entries())
      .map(([hour, count]) => ({ hour: new Date(hour), count }))
      .sort((a, b) => a.hour - b.hour);
  }
  
  /**
   * Assess security severity
   */
  assessSecuritySeverity(events) {
    const recentThreshold = Date.now() - (60 * 60 * 1000); // Last hour
    const recentEvents = events.filter(e => e.timestamp > recentThreshold);
    
    if (recentEvents.length > 20) {
      return 'critical';
    } else if (recentEvents.length > 10) {
      return 'high';
    } else if (recentEvents.length > 5) {
      return 'medium';
    } else {
      return 'low';
    }
  }
  
  /**
   * Analyze trends in log data
   */
  analyzeTrends() {
    const trends = {
      errorRate: this.calculateErrorRateTrend(),
      logVolume: this.calculateLogVolumeTrend(),
      performanceTrend: this.calculatePerformanceTrend()
    };
    
    return trends;
  }
  
  /**
   * Calculate error rate trend
   */
  calculateErrorRateTrend() {
    const hourMs = 60 * 60 * 1000;
    const last24Hours = 24;
    const now = Date.now();
    
    const hourlyData = [];
    
    for (let i = last24Hours - 1; i >= 0; i--) {
      const hourStart = now - (i * hourMs);
      const hourEnd = hourStart + hourMs;
      
      let errorCount = 0;
      let totalCount = 0;
      
      // Count errors and total logs in this hour (simplified)
      this.logBuffer.forEach(log => {
        if (log.timestamp >= hourStart && log.timestamp < hourEnd) {
          totalCount++;
          if (log.level === 'error') {
            errorCount++;
          }
        }
      });
      
      const errorRate = totalCount > 0 ? (errorCount / totalCount) * 100 : 0;
      
      hourlyData.push({
        hour: new Date(hourStart),
        errorRate,
        errorCount,
        totalCount
      });
    }
    
    return {
      data: hourlyData,
      trend: this.calculateTrendDirection(hourlyData.map(d => d.errorRate))
    };
  }
  
  /**
   * Calculate log volume trend
   */
  calculateLogVolumeTrend() {
    const hourMs = 60 * 60 * 1000;
    const last24Hours = 24;
    const now = Date.now();
    
    const hourlyVolume = [];
    
    for (let i = last24Hours - 1; i >= 0; i--) {
      const hourStart = now - (i * hourMs);
      const hourEnd = hourStart + hourMs;
      
      const count = this.logBuffer.filter(log => 
        log.timestamp >= hourStart && log.timestamp < hourEnd
      ).length;
      
      hourlyVolume.push({
        hour: new Date(hourStart),
        count
      });
    }
    
    return {
      data: hourlyVolume,
      trend: this.calculateTrendDirection(hourlyVolume.map(d => d.count))
    };
  }
  
  /**
   * Calculate performance trend
   */
  calculatePerformanceTrend() {
    // Simplified performance trend calculation
    const perfData = Array.from(this.logAnalysis.performanceMetrics.values());
    const avgPerformance = perfData.map(data => data.totalTime / data.count);
    
    return {
      trend: this.calculateTrendDirection(avgPerformance),
      averageTime: avgPerformance.reduce((a, b) => a + b, 0) / (avgPerformance.length || 1)
    };
  }
  
  /**
   * Calculate trend direction from data series
   */
  calculateTrendDirection(data) {
    if (data.length < 2) return 'stable';
    
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const change = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    if (change > 10) return 'increasing';
    if (change < -10) return 'decreasing';
    return 'stable';
  }
  
  /**
   * Detect log anomalies
   */
  detectLogAnomalies() {
    const anomalies = [];
    
    // Detect unusual error spikes
    const errorSpike = this.detectErrorSpike();
    if (errorSpike) {
      anomalies.push(errorSpike);
    }
    
    // Detect unusual log volume
    const volumeAnomaly = this.detectVolumeAnomaly();
    if (volumeAnomaly) {
      anomalies.push(volumeAnomaly);
    }
    
    // Detect performance anomalies
    const perfAnomaly = this.detectPerformanceAnomaly();
    if (perfAnomaly) {
      anomalies.push(perfAnomaly);
    }
    
    return anomalies;
  }
  
  /**
   * Detect error spikes
   */
  detectErrorSpike() {
    const recentErrors = this.logBuffer
      .filter(log => log.level === 'error' && log.timestamp > (Date.now() - 60 * 60 * 1000))
      .length;
    
    const historicalAvg = 5; // Simplified baseline
    
    if (recentErrors > historicalAvg * 3) {
      return {
        type: 'error_spike',
        severity: 'high',
        description: `Error spike detected: ${recentErrors} errors in last hour (baseline: ${historicalAvg})`,
        value: recentErrors,
        baseline: historicalAvg
      };
    }
    
    return null;
  }
  
  /**
   * Detect volume anomalies
   */
  detectVolumeAnomaly() {
    const recentVolume = this.logBuffer
      .filter(log => log.timestamp > (Date.now() - 60 * 60 * 1000))
      .length;
    
    const historicalAvg = 100; // Simplified baseline
    
    if (recentVolume > historicalAvg * 2) {
      return {
        type: 'volume_spike',
        severity: 'medium',
        description: `Log volume spike: ${recentVolume} logs in last hour (baseline: ${historicalAvg})`,
        value: recentVolume,
        baseline: historicalAvg
      };
    } else if (recentVolume < historicalAvg * 0.1) {
      return {
        type: 'volume_drop',
        severity: 'medium',
        description: `Log volume drop: ${recentVolume} logs in last hour (baseline: ${historicalAvg})`,
        value: recentVolume,
        baseline: historicalAvg
      };
    }
    
    return null;
  }
  
  /**
   * Detect performance anomalies
   */
  detectPerformanceAnomaly() {
    // Check for sudden performance degradation
    const degradingOps = [];
    
    this.logAnalysis.performanceMetrics.forEach((data, operation) => {
      if (data.recentTimes.length >= 10) {
        const recentAvg = data.recentTimes.slice(-10)
          .reduce((a, b) => a + b, 0) / 10;
        const overallAvg = data.totalTime / data.count;
        
        if (recentAvg > overallAvg * 2) {
          degradingOps.push({
            operation,
            recentAvg,
            overallAvg,
            degradation: ((recentAvg - overallAvg) / overallAvg) * 100
          });
        }
      }
    });
    
    if (degradingOps.length > 0) {
      return {
        type: 'performance_degradation',
        severity: 'high',
        description: `Performance degradation detected in ${degradingOps.length} operations`,
        operations: degradingOps
      };
    }
    
    return null;
  }
  
  /**
   * Setup cleanup
   */
  setupCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupLogs();
    }, 24 * 60 * 60 * 1000); // Daily
  }
  
  /**
   * Cleanup old logs and data
   */
  async cleanupLogs() {
    try {
      // Cleanup log files based on retention policy
      await this.cleanupLogFiles();
      
      // Cleanup in-memory data
      this.cleanupMemoryData();
      
      console.log('🧹 Log cleanup completed');
      
    } catch (error) {
      console.error('Log cleanup failed:', error.message);
    }
  }
  
  /**
   * Cleanup old log files
   */
  async cleanupLogFiles() {
    try {
      const files = await fs.readdir(this.options.logDirectory);
      const cutoffTime = Date.now() - (this.options.retentionDays * 24 * 60 * 60 * 1000);
      
      for (const file of files) {
        const filePath = path.join(this.options.logDirectory, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          await fs.unlink(filePath);
          console.log(`🗑️ Deleted old log file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup log files:', error.message);
    }
  }
  
  /**
   * Cleanup in-memory data
   */
  cleanupMemoryData() {
    const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
    
    // Cleanup security events
    this.logAnalysis.securityEvents = this.logAnalysis.securityEvents
      .filter(event => event.timestamp > cutoffTime);
    
    // Cleanup audit trail (keep longer)
    const auditCutoff = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days
    this.logAnalysis.auditTrail = this.logAnalysis.auditTrail
      .filter(entry => entry.timestamp > auditCutoff);
    
    // Cleanup correlation tracking
    this.logAnalysis.correlationIds.forEach((correlation, id) => {
      if (correlation.startTime < cutoffTime) {
        this.logAnalysis.correlationIds.delete(id);
      }
    });
    
    // Cleanup log buffer
    this.logBuffer = this.logBuffer.filter(log => log.timestamp > cutoffTime);
  }
  
  /**
   * Context management methods
   */
  pushContext(context) {
    this.contextStack.push(context);
  }
  
  popContext() {
    return this.contextStack.pop();
  }
  
  getCurrentContext() {
    return this.contextStack.length > 0 ? this.contextStack[this.contextStack.length - 1] : null;
  }
  
  /**
   * Correlation ID management
   */
  generateCorrelationId() {
    return `log_${Date.now()}_${++this.correlationCounter}`;
  }
  
  getCurrentCorrelationId() {
    const context = this.getCurrentContext();
    return context?.correlationId || this.generateCorrelationId();
  }
  
  /**
   * Add log stream for real-time monitoring
   */
  addLogStream(stream) {
    this.logStreams.add(stream);
    
    // Send recent logs to new stream
    const recentLogs = this.logBuffer.slice(-50);
    recentLogs.forEach(log => {
      try {
        stream.send(JSON.stringify({
          type: 'logEntry',
          data: log,
          timestamp: Date.now()
        }));
      } catch (error) {
        this.logStreams.delete(stream);
      }
    });
  }
  
  /**
   * Remove log stream
   */
  removeLogStream(stream) {
    this.logStreams.delete(stream);
  }
  
  /**
   * Get log analysis summary
   */
  getLogAnalysisSummary() {
    return {
      patterns: {
        total: this.logAnalysis.patterns.size,
        errors: Array.from(this.patterns.errors.entries()).length,
        security: Array.from(this.patterns.security.entries()).length
      },
      performance: {
        operations: this.logAnalysis.performanceMetrics.size,
        totalMetrics: Array.from(this.logAnalysis.performanceMetrics.values())
          .reduce((sum, data) => sum + data.count, 0)
      },
      security: {
        events: this.logAnalysis.securityEvents.length,
        recentEvents: this.logAnalysis.securityEvents
          .filter(e => e.timestamp > (Date.now() - 24 * 60 * 60 * 1000)).length
      },
      audit: {
        entries: this.logAnalysis.auditTrail.length,
        recentEntries: this.logAnalysis.auditTrail
          .filter(e => e.timestamp > (Date.now() - 24 * 60 * 60 * 1000)).length
      },
      buffer: {
        size: this.logBuffer.length,
        streams: this.logStreams.size
      },
      correlations: this.logAnalysis.correlationIds.size
    };
  }
  
  /**
   * Export logs
   */
  async exportLogs(options = {}) {
    const {
      format = 'json',
      timeRange = 24 * 60 * 60 * 1000, // 24 hours
      categories = [],
      levels = []
    } = options;
    
    const cutoff = Date.now() - timeRange;
    let logs = this.logBuffer.filter(log => log.timestamp > cutoff);
    
    // Filter by categories
    if (categories.length > 0) {
      logs = logs.filter(log => categories.includes(log.category));
    }
    
    // Filter by levels
    if (levels.length > 0) {
      logs = logs.filter(log => levels.includes(log.level));
    }
    
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify({
          logs,
          meta: {
            totalLogs: logs.length,
            timeRange,
            exportTime: new Date().toISOString()
          }
        }, null, 2);
        
      case 'csv':
        return this.convertLogsToCSV(logs);
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
  
  /**
   * Convert logs to CSV format
   */
  convertLogsToCSV(logs) {
    const rows = [];
    rows.push('Timestamp,Level,Category,Message,CorrelationId');
    
    logs.forEach(log => {
      rows.push([
        new Date(log.timestamp).toISOString(),
        log.level,
        log.category || '',
        `"${(log.message || '').replace(/"/g, '""')}"`,
        log.correlationId || ''
      ].join(','));
    });
    
    return rows.join('\n');
  }
  
  /**
   * Get logger instance for external use
   */
  getLogger() {
    return this.logger;
  }
  
  /**
   * Shutdown log manager
   */
  async shutdown() {
    console.log('🛑 Shutting down Log Manager...');
    
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Close all log streams
    this.logStreams.forEach(stream => {
      try {
        stream.close();
      } catch (error) {
        // Ignore close errors
      }
    });
    this.logStreams.clear();
    
    // Close logger
    if (this.logger) {
      this.logger.close();
    }
    
    this.isInitialized = false;
    this.emit('shutdown');
    
    console.log('✅ Log Manager shutdown complete');
  }
}

export default LogManager;