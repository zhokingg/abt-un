import { EventEmitter } from 'events';
import winston from 'winston';
import fs from 'fs';
import path from 'path';

/**
 * LogAnalyzer - Centralized Log Aggregation and Analysis
 * Provides structured logging, real-time log streaming, pattern recognition,
 * and automated error classification with intelligent insights
 */
class LogAnalyzer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      logDirectory: options.logDirectory || './logs',
      logLevel: options.logLevel || 'info',
      maxLogFiles: options.maxLogFiles || 20,
      maxLogSize: options.maxLogSize || '100m',
      compressionEnabled: options.compressionEnabled !== false,
      retentionDays: options.retentionDays || 30,
      
      // Real-time streaming
      enableStreaming: options.enableStreaming !== false,
      streamingPort: options.streamingPort || 3001,
      maxStreamingClients: options.maxStreamingClients || 10,
      
      // Pattern recognition
      patternRecognition: options.patternRecognition !== false,
      anomalyDetection: options.anomalyDetection !== false,
      errorClassification: options.errorClassification !== false,
      
      // Performance analysis
      performanceLogging: options.performanceLogging !== false,
      timingAnalysis: options.timingAnalysis !== false,
      bottleneckDetection: options.bottleneckDetection !== false,
      
      ...options
    };
    
    // Logger instance
    this.logger = null;
    
    // Log storage and indexing
    this.logIndex = new Map(); // Fast log lookup
    this.logBuffer = []; // Recent logs buffer
    this.bufferSize = options.bufferSize || 10000;
    
    // Pattern recognition data
    this.logPatterns = {
      errors: new Map(),
      warnings: new Map(),
      performance: new Map(),
      anomalies: new Map(),
      custom: new Map()
    };
    
    // Error classification
    this.errorClassifications = {
      network: {
        patterns: [/connection.*failed/i, /timeout/i, /ECONNREFUSED/i, /network.*error/i],
        severity: 'high',
        category: 'connectivity'
      },
      rpc: {
        patterns: [/rpc.*error/i, /provider.*error/i, /eth_.*failed/i],
        severity: 'high',
        category: 'blockchain'
      },
      database: {
        patterns: [/database.*error/i, /query.*failed/i, /connection.*pool/i],
        severity: 'critical',
        category: 'data'
      },
      arbitrage: {
        patterns: [/arbitrage.*failed/i, /opportunity.*missed/i, /execution.*error/i],
        severity: 'medium',
        category: 'trading'
      },
      gas: {
        patterns: [/gas.*too.*low/i, /insufficient.*funds/i, /gas.*limit/i],
        severity: 'medium',
        category: 'transaction'
      },
      mempool: {
        patterns: [/mempool.*error/i, /transaction.*dropped/i, /nonce.*too.*low/i],
        severity: 'medium',
        category: 'mempool'
      },
      contract: {
        patterns: [/contract.*error/i, /revert/i, /execution.*reverted/i],
        severity: 'high',
        category: 'smart_contract'
      }
    };
    
    // Performance metrics
    this.performanceMetrics = {
      logProcessingRate: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      patternMatchRate: 0,
      anomaliesDetected: 0,
      totalLogsProcessed: 0,
      lastProcessingTime: Date.now()
    };
    
    // Analytics data
    this.analytics = {
      hourlyStats: new Map(),
      errorTrends: new Map(),
      componentHealth: new Map(),
      performanceTrends: new Map(),
      alertHistory: []
    };
    
    // Real-time streaming
    this.streamingClients = new Set();
    this.streamingServer = null;
    
    // Timing analysis
    this.timingData = new Map();
    this.performanceBaselines = new Map();
    
    // State
    this.isRunning = false;
    this.startTime = Date.now();
    
    // Cleanup timer
    this.cleanupTimer = null;
  }
  
  /**
   * Initialize log analyzer
   */
  async initialize() {
    try {
      console.log('📊 Initializing LogAnalyzer...');
      
      // Create log directory
      await this.ensureLogDirectory();
      
      // Initialize Winston logger
      this.initializeLogger();
      
      // Initialize pattern recognition
      this.initializePatternRecognition();
      
      // Start real-time streaming if enabled
      if (this.options.enableStreaming) {
        await this.initializeStreaming();
      }
      
      // Start cleanup timer
      this.startCleanupTimer();
      
      this.isRunning = true;
      this.emit('initialized');
      
      console.log('✅ LogAnalyzer initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize LogAnalyzer:', error);
      throw error;
    }
  }
  
  /**
   * Ensure log directory exists
   */
  async ensureLogDirectory() {
    try {
      await fs.promises.mkdir(this.options.logDirectory, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }
  
  /**
   * Initialize Winston logger with multiple transports
   */
  initializeLogger() {
    const logFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return JSON.stringify({
          timestamp,
          level,
          message,
          ...meta
        });
      })
    );
    
    const transports = [
      // Console transport with color formatting
      new winston.transports.Console({
        level: this.options.logLevel,
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }),
      
      // File transport for all logs
      new winston.transports.File({
        filename: path.join(this.options.logDirectory, 'combined.log'),
        level: 'debug',
        format: logFormat,
        maxsize: this.options.maxLogSize,
        maxFiles: this.options.maxLogFiles,
        tailable: true
      }),
      
      // Error-only file
      new winston.transports.File({
        filename: path.join(this.options.logDirectory, 'errors.log'),
        level: 'error',
        format: logFormat,
        maxsize: this.options.maxLogSize,
        maxFiles: 5
      }),
      
      // Performance logs
      new winston.transports.File({
        filename: path.join(this.options.logDirectory, 'performance.log'),
        level: 'info',
        format: logFormat,
        maxsize: this.options.maxLogSize,
        maxFiles: 10
      })
    ];
    
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: logFormat,
      transports,
      exitOnError: false
    });
    
    // Hook into log events for real-time processing
    this.logger.on('data', (log) => {
      this.processLogEntry(log);
    });
  }
  
  /**
   * Initialize pattern recognition system
   */
  initializePatternRecognition() {
    // Initialize error pattern counters
    Object.keys(this.errorClassifications).forEach(category => {
      this.logPatterns.errors.set(category, {
        count: 0,
        recentOccurrences: [],
        trend: 'stable',
        lastSeen: null
      });
    });
    
    // Initialize performance baselines
    this.performanceBaselines.set('rpc_call', { baseline: 100, threshold: 500 });
    this.performanceBaselines.set('db_query', { baseline: 50, threshold: 200 });
    this.performanceBaselines.set('arbitrage_detection', { baseline: 10, threshold: 100 });
    this.performanceBaselines.set('trade_execution', { baseline: 5000, threshold: 30000 });
  }
  
  /**
   * Initialize real-time streaming server
   */
  async initializeStreaming() {
    // This would typically use Socket.IO or WebSocket
    console.log(`🌊 Log streaming would be initialized on port ${this.options.streamingPort}`);
    // Mock implementation for now
  }
  
  /**
   * Process incoming log entry
   */
  processLogEntry(logEntry) {
    try {
      const parsedLog = this.parseLogEntry(logEntry);
      
      // Add to buffer
      this.addToBuffer(parsedLog);
      
      // Update metrics
      this.updateProcessingMetrics();
      
      // Pattern recognition
      if (this.options.patternRecognition) {
        this.analyzeLogPatterns(parsedLog);
      }
      
      // Error classification
      if (this.options.errorClassification && parsedLog.level === 'error') {
        this.classifyError(parsedLog);
      }
      
      // Performance analysis
      if (this.options.performanceLogging && parsedLog.timing) {
        this.analyzePerformance(parsedLog);
      }
      
      // Anomaly detection
      if (this.options.anomalyDetection) {
        this.detectAnomalies(parsedLog);
      }
      
      // Real-time streaming
      if (this.options.enableStreaming && this.streamingClients.size > 0) {
        this.streamLogEntry(parsedLog);
      }
      
      // Emit log processed event
      this.emit('logProcessed', parsedLog);
      
    } catch (error) {
      console.error('Error processing log entry:', error);
      this.performanceMetrics.errorRate++;
    }
  }
  
  /**
   * Parse raw log entry
   */
  parseLogEntry(logEntry) {
    try {
      const parsed = typeof logEntry === 'string' ? JSON.parse(logEntry) : logEntry;
      
      return {
        id: this.generateLogId(),
        timestamp: parsed.timestamp || new Date().toISOString(),
        level: parsed.level || 'info',
        message: parsed.message || '',
        component: parsed.component || 'unknown',
        action: parsed.action || null,
        duration: parsed.duration || null,
        error: parsed.error || null,
        stack: parsed.stack || null,
        metadata: parsed.metadata || {},
        ...parsed
      };
      
    } catch (error) {
      return {
        id: this.generateLogId(),
        timestamp: new Date().toISOString(),
        level: 'warn',
        message: 'Failed to parse log entry',
        raw: logEntry,
        parseError: error.message
      };
    }
  }
  
  /**
   * Add log to buffer and index
   */
  addToBuffer(logEntry) {
    // Add to buffer
    this.logBuffer.push(logEntry);
    
    // Maintain buffer size
    if (this.logBuffer.length > this.bufferSize) {
      const removed = this.logBuffer.shift();
      this.logIndex.delete(removed.id);
    }
    
    // Add to index for fast lookup
    this.logIndex.set(logEntry.id, logEntry);
  }
  
  /**
   * Analyze log patterns
   */
  analyzeLogPatterns(logEntry) {
    const { level, message, component } = logEntry;
    
    // Pattern matching for different log levels
    switch (level) {
      case 'error':
        this.matchErrorPatterns(message, logEntry);
        break;
      case 'warn':
        this.matchWarningPatterns(message, logEntry);
        break;
      case 'info':
        if (logEntry.duration) {
          this.matchPerformancePatterns(logEntry);
        }
        break;
    }
    
    // Component-specific patterns
    this.matchComponentPatterns(component, logEntry);
  }
  
  /**
   * Match error patterns
   */
  matchErrorPatterns(message, logEntry) {
    for (const [category, classification] of Object.entries(this.errorClassifications)) {
      for (const pattern of classification.patterns) {
        if (pattern.test(message)) {
          this.recordPatternMatch('errors', category, logEntry);
          break;
        }
      }
    }
  }
  
  /**
   * Match warning patterns
   */
  matchWarningPatterns(message, logEntry) {
    const warningPatterns = {
      performance_degradation: /slow|degraded|performance/i,
      resource_pressure: /memory|cpu|disk.*high/i,
      network_issues: /latency|connectivity|timeout/i,
      rate_limiting: /rate.*limit|throttled/i
    };
    
    for (const [pattern, regex] of Object.entries(warningPatterns)) {
      if (regex.test(message)) {
        this.recordPatternMatch('warnings', pattern, logEntry);
      }
    }
  }
  
  /**
   * Match performance patterns
   */
  matchPerformancePatterns(logEntry) {
    const { action, duration } = logEntry;
    if (!action || !duration) return;
    
    const baseline = this.performanceBaselines.get(action);
    if (baseline) {
      if (duration > baseline.threshold) {
        this.recordPatternMatch('performance', `${action}_slow`, logEntry);
      } else if (duration > baseline.baseline * 2) {
        this.recordPatternMatch('performance', `${action}_degraded`, logEntry);
      }
    }
  }
  
  /**
   * Match component-specific patterns
   */
  matchComponentPatterns(component, logEntry) {
    if (!this.logPatterns.custom.has(component)) {
      this.logPatterns.custom.set(component, {
        count: 0,
        errors: 0,
        warnings: 0,
        lastActivity: Date.now()
      });
    }
    
    const componentStats = this.logPatterns.custom.get(component);
    componentStats.count++;
    componentStats.lastActivity = Date.now();
    
    if (logEntry.level === 'error') componentStats.errors++;
    if (logEntry.level === 'warn') componentStats.warnings++;
  }
  
  /**
   * Record pattern match
   */
  recordPatternMatch(category, pattern, logEntry) {
    if (!this.logPatterns[category].has(pattern)) {
      this.logPatterns[category].set(pattern, {
        count: 0,
        recentOccurrences: [],
        trend: 'stable',
        lastSeen: null,
        severity: this.getPatternSeverity(pattern)
      });
    }
    
    const patternData = this.logPatterns[category].get(pattern);
    patternData.count++;
    patternData.lastSeen = Date.now();
    patternData.recentOccurrences.push({
      timestamp: logEntry.timestamp,
      logId: logEntry.id
    });
    
    // Keep only recent occurrences (last 24 hours)
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    patternData.recentOccurrences = patternData.recentOccurrences
      .filter(occ => new Date(occ.timestamp).getTime() > cutoff);
    
    // Calculate trend
    this.calculatePatternTrend(pattern, patternData);
    
    // Update metrics
    this.performanceMetrics.patternMatchRate++;
    
    // Emit pattern match event
    this.emit('patternMatched', {
      category,
      pattern,
      logEntry,
      patternData
    });
  }
  
  /**
   * Calculate pattern trend
   */
  calculatePatternTrend(pattern, patternData) {
    const recentCount = patternData.recentOccurrences.length;
    const timeWindow = 60 * 60 * 1000; // 1 hour
    
    const hourAgo = Date.now() - timeWindow;
    const recentHourCount = patternData.recentOccurrences
      .filter(occ => new Date(occ.timestamp).getTime() > hourAgo).length;
    
    const previousHourCount = recentCount - recentHourCount;
    
    if (recentHourCount > previousHourCount * 1.5) {
      patternData.trend = 'increasing';
    } else if (recentHourCount < previousHourCount * 0.5) {
      patternData.trend = 'decreasing';
    } else {
      patternData.trend = 'stable';
    }
  }
  
  /**
   * Classify error
   */
  classifyError(logEntry) {
    const { message } = logEntry;
    let classified = false;
    
    for (const [category, classification] of Object.entries(this.errorClassifications)) {
      for (const pattern of classification.patterns) {
        if (pattern.test(message)) {
          this.recordErrorClassification(category, classification, logEntry);
          classified = true;
          break;
        }
      }
      if (classified) break;
    }
    
    if (!classified) {
      this.recordErrorClassification('unknown', {
        severity: 'medium',
        category: 'unclassified'
      }, logEntry);
    }
  }
  
  /**
   * Record error classification
   */
  recordErrorClassification(category, classification, logEntry) {
    if (!this.analytics.errorTrends.has(category)) {
      this.analytics.errorTrends.set(category, {
        count: 0,
        severity: classification.severity,
        category: classification.category,
        recentErrors: [],
        trend: 'stable'
      });
    }
    
    const errorData = this.analytics.errorTrends.get(category);
    errorData.count++;
    errorData.recentErrors.push({
      timestamp: logEntry.timestamp,
      message: logEntry.message,
      component: logEntry.component,
      logId: logEntry.id
    });
    
    // Keep only recent errors
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    errorData.recentErrors = errorData.recentErrors
      .filter(err => new Date(err.timestamp).getTime() > cutoff);
    
    // Emit error classification event
    this.emit('errorClassified', {
      category,
      classification,
      logEntry,
      errorData
    });
  }
  
  /**
   * Analyze performance metrics
   */
  analyzePerformance(logEntry) {
    const { action, duration, component } = logEntry;
    if (!action || !duration) return;
    
    const timingKey = `${component}_${action}`;
    
    if (!this.timingData.has(timingKey)) {
      this.timingData.set(timingKey, {
        samples: [],
        average: 0,
        median: 0,
        p95: 0,
        p99: 0,
        min: Infinity,
        max: 0,
        trend: 'stable'
      });
    }
    
    const timing = this.timingData.get(timingKey);
    timing.samples.push({
      timestamp: Date.now(),
      duration: duration
    });
    
    // Keep only recent samples (last 1000 or 1 hour)
    const cutoff = Date.now() - 60 * 60 * 1000;
    timing.samples = timing.samples
      .filter(sample => sample.timestamp > cutoff)
      .slice(-1000);
    
    // Calculate statistics
    this.calculateTimingStatistics(timing);
    
    // Detect performance anomalies
    this.detectPerformanceAnomalies(timingKey, duration, timing);
  }
  
  /**
   * Calculate timing statistics
   */
  calculateTimingStatistics(timing) {
    const durations = timing.samples.map(s => s.duration).sort((a, b) => a - b);
    
    timing.average = durations.reduce((a, b) => a + b, 0) / durations.length;
    timing.median = durations[Math.floor(durations.length / 2)];
    timing.p95 = durations[Math.floor(durations.length * 0.95)];
    timing.p99 = durations[Math.floor(durations.length * 0.99)];
    timing.min = Math.min(...durations);
    timing.max = Math.max(...durations);
  }
  
  /**
   * Detect anomalies in log patterns
   */
  detectAnomalies(logEntry) {
    // Frequency-based anomaly detection
    this.detectFrequencyAnomalies(logEntry);
    
    // Content-based anomaly detection
    this.detectContentAnomalies(logEntry);
    
    // Timing-based anomaly detection
    if (logEntry.duration) {
      this.detectTimingAnomalies(logEntry);
    }
  }
  
  /**
   * Detect frequency anomalies
   */
  detectFrequencyAnomalies(logEntry) {
    const { component, level } = logEntry;
    const now = Date.now();
    const timeWindow = 5 * 60 * 1000; // 5 minutes
    
    // Count recent logs from same component with same level
    const recentLogs = this.logBuffer.filter(log => 
      log.component === component && 
      log.level === level &&
      new Date(log.timestamp).getTime() > now - timeWindow
    );
    
    // Define thresholds based on log level
    const thresholds = {
      error: 10,
      warn: 50,
      info: 1000,
      debug: 5000
    };
    
    const threshold = thresholds[level] || 100;
    
    if (recentLogs.length > threshold) {
      this.recordAnomaly('frequency_spike', {
        component,
        level,
        count: recentLogs.length,
        threshold,
        timeWindow: '5min'
      }, logEntry);
    }
  }
  
  /**
   * Detect content anomalies
   */
  detectContentAnomalies(logEntry) {
    const { message, component } = logEntry;
    
    // Detect unusual message lengths
    if (message.length > 1000) {
      this.recordAnomaly('long_message', {
        component,
        messageLength: message.length,
        preview: message.substring(0, 100) + '...'
      }, logEntry);
    }
    
    // Detect stack traces in non-error logs
    if (logEntry.level !== 'error' && logEntry.stack) {
      this.recordAnomaly('unexpected_stack_trace', {
        component,
        level: logEntry.level
      }, logEntry);
    }
  }
  
  /**
   * Detect timing anomalies
   */
  detectTimingAnomalies(logEntry) {
    const { action, duration, component } = logEntry;
    const timingKey = `${component}_${action}`;
    
    const timing = this.timingData.get(timingKey);
    if (!timing || timing.samples.length < 10) return;
    
    // Detect if duration is significantly higher than normal
    const threshold = timing.average * 3; // 3x average
    
    if (duration > threshold) {
      this.recordAnomaly('performance_spike', {
        component,
        action,
        duration,
        average: timing.average,
        threshold
      }, logEntry);
    }
  }
  
  /**
   * Detect performance anomalies
   */
  detectPerformanceAnomalies(timingKey, duration, timing) {
    // Check if this is a significant slowdown
    if (timing.samples.length >= 10) {
      const threshold = timing.average * 2.5;
      
      if (duration > threshold) {
        this.emit('performanceAnomaly', {
          type: 'slowdown',
          timingKey,
          duration,
          threshold,
          statistics: timing
        });
      }
    }
  }
  
  /**
   * Record anomaly
   */
  recordAnomaly(type, details, logEntry) {
    const anomaly = {
      id: this.generateAnomalyId(),
      type,
      details,
      logEntry,
      timestamp: Date.now(),
      severity: this.getAnomalySeverity(type)
    };
    
    if (!this.logPatterns.anomalies.has(type)) {
      this.logPatterns.anomalies.set(type, []);
    }
    
    this.logPatterns.anomalies.get(type).push(anomaly);
    this.performanceMetrics.anomaliesDetected++;
    
    // Emit anomaly event
    this.emit('anomalyDetected', anomaly);
    
    console.log(`🚨 Anomaly detected: ${type} in ${details.component || 'unknown'}`);
  }
  
  /**
   * Update processing metrics
   */
  updateProcessingMetrics() {
    this.performanceMetrics.totalLogsProcessed++;
    
    const now = Date.now();
    const elapsed = now - this.performanceMetrics.lastProcessingTime;
    
    if (elapsed >= 60000) { // Every minute
      const logsPerMinute = (this.performanceMetrics.totalLogsProcessed / elapsed) * 60000;
      this.performanceMetrics.logProcessingRate = logsPerMinute;
      this.performanceMetrics.lastProcessingTime = now;
    }
  }
  
  /**
   * Stream log entry to connected clients
   */
  streamLogEntry(logEntry) {
    const streamData = {
      type: 'log',
      data: logEntry,
      timestamp: Date.now()
    };
    
    // Mock streaming - would use WebSocket in real implementation
    console.log(`📡 Streaming log to ${this.streamingClients.size} clients`);
  }
  
  /**
   * Get logs by filter criteria
   */
  getLogs(filters = {}) {
    const {
      level,
      component,
      startTime,
      endTime,
      limit = 100,
      pattern,
      hasError
    } = filters;
    
    let filteredLogs = [...this.logBuffer];
    
    // Apply filters
    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }
    
    if (component) {
      filteredLogs = filteredLogs.filter(log => log.component === component);
    }
    
    if (startTime) {
      filteredLogs = filteredLogs.filter(log => 
        new Date(log.timestamp).getTime() >= new Date(startTime).getTime()
      );
    }
    
    if (endTime) {
      filteredLogs = filteredLogs.filter(log => 
        new Date(log.timestamp).getTime() <= new Date(endTime).getTime()
      );
    }
    
    if (pattern) {
      const regex = new RegExp(pattern, 'i');
      filteredLogs = filteredLogs.filter(log => regex.test(log.message));
    }
    
    if (hasError) {
      filteredLogs = filteredLogs.filter(log => log.error || log.stack);
    }
    
    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return filteredLogs.slice(0, limit);
  }
  
  /**
   * Search logs with advanced query
   */
  searchLogs(query, options = {}) {
    const {
      fuzzy = false,
      caseSensitive = false,
      fields = ['message'],
      limit = 100
    } = options;
    
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(fuzzy ? this.fuzzyPattern(query) : query, flags);
    
    const results = this.logBuffer.filter(log => {
      return fields.some(field => {
        const value = log[field];
        return value && regex.test(value.toString());
      });
    });
    
    return results.slice(0, limit);
  }
  
  /**
   * Create fuzzy search pattern
   */
  fuzzyPattern(query) {
    return query.split('').map(char => 
      char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    ).join('.*');
  }
  
  /**
   * Get log analytics summary
   */
  getAnalyticsSummary() {
    return {
      overview: {
        totalLogs: this.performanceMetrics.totalLogsProcessed,
        processingRate: this.performanceMetrics.logProcessingRate,
        errorRate: this.performanceMetrics.errorRate,
        anomaliesDetected: this.performanceMetrics.anomaliesDetected,
        patternMatches: this.performanceMetrics.patternMatchRate
      },
      
      patterns: {
        errors: Object.fromEntries(this.logPatterns.errors),
        warnings: Object.fromEntries(this.logPatterns.warnings),
        performance: Object.fromEntries(this.logPatterns.performance),
        anomalies: Object.fromEntries(this.logPatterns.anomalies)
      },
      
      components: Object.fromEntries(this.logPatterns.custom),
      
      errorTrends: Object.fromEntries(this.analytics.errorTrends),
      
      timing: Object.fromEntries(this.timingData),
      
      recentActivity: this.getRecentActivity()
    };
  }
  
  /**
   * Get recent activity summary
   */
  getRecentActivity() {
    const now = Date.now();
    const timeRanges = {
      last5min: now - 5 * 60 * 1000,
      last15min: now - 15 * 60 * 1000,
      lastHour: now - 60 * 60 * 1000
    };
    
    const activity = {};
    
    Object.entries(timeRanges).forEach(([range, cutoff]) => {
      const logs = this.logBuffer.filter(log => 
        new Date(log.timestamp).getTime() > cutoff
      );
      
      activity[range] = {
        total: logs.length,
        errors: logs.filter(log => log.level === 'error').length,
        warnings: logs.filter(log => log.level === 'warn').length,
        components: [...new Set(logs.map(log => log.component))].length
      };
    });
    
    return activity;
  }
  
  /**
   * Generate performance report
   */
  generatePerformanceReport() {
    const timingReport = {};
    
    this.timingData.forEach((timing, key) => {
      timingReport[key] = {
        average: Math.round(timing.average),
        median: Math.round(timing.median),
        p95: Math.round(timing.p95),
        p99: Math.round(timing.p99),
        min: Math.round(timing.min),
        max: Math.round(timing.max),
        samples: timing.samples.length,
        trend: timing.trend
      };
    });
    
    return {
      timestamp: Date.now(),
      processingMetrics: this.performanceMetrics,
      timingAnalysis: timingReport,
      bottlenecks: this.identifyBottlenecks(),
      recommendations: this.generatePerformanceRecommendations()
    };
  }
  
  /**
   * Identify performance bottlenecks
   */
  identifyBottlenecks() {
    const bottlenecks = [];
    
    this.timingData.forEach((timing, key) => {
      if (timing.samples.length < 10) return;
      
      const [component, action] = key.split('_');
      const baseline = this.performanceBaselines.get(action);
      
      if (baseline && timing.average > baseline.threshold) {
        bottlenecks.push({
          component,
          action,
          averageTime: Math.round(timing.average),
          threshold: baseline.threshold,
          severity: timing.average > baseline.threshold * 2 ? 'high' : 'medium',
          samples: timing.samples.length
        });
      }
    });
    
    return bottlenecks.sort((a, b) => b.averageTime - a.averageTime);
  }
  
  /**
   * Generate performance recommendations
   */
  generatePerformanceRecommendations() {
    const recommendations = [];
    const bottlenecks = this.identifyBottlenecks();
    
    bottlenecks.forEach(bottleneck => {
      switch (bottleneck.action) {
        case 'rpc_call':
          recommendations.push({
            type: 'optimization',
            target: bottleneck.component,
            issue: 'Slow RPC calls',
            suggestion: 'Consider implementing connection pooling or switching RPC providers',
            priority: bottleneck.severity
          });
          break;
          
        case 'db_query':
          recommendations.push({
            type: 'optimization',
            target: bottleneck.component,
            issue: 'Slow database queries',
            suggestion: 'Review query performance and consider indexing or caching',
            priority: bottleneck.severity
          });
          break;
          
        case 'arbitrage_detection':
          recommendations.push({
            type: 'optimization',
            target: bottleneck.component,
            issue: 'Slow arbitrage detection',
            suggestion: 'Optimize detection algorithms or increase computational resources',
            priority: bottleneck.severity
          });
          break;
      }
    });
    
    return recommendations;
  }
  
  /**
   * Start cleanup timer
   */
  startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, 60 * 60 * 1000); // Every hour
  }
  
  /**
   * Perform periodic cleanup
   */
  performCleanup() {
    const now = Date.now();
    const retentionPeriod = this.options.retentionDays * 24 * 60 * 60 * 1000;
    const cutoff = now - retentionPeriod;
    
    // Clean up old pattern data
    this.logPatterns.errors.forEach((data, pattern) => {
      data.recentOccurrences = data.recentOccurrences.filter(occ => 
        new Date(occ.timestamp).getTime() > cutoff
      );
    });
    
    // Clean up old timing data
    this.timingData.forEach((timing, key) => {
      timing.samples = timing.samples.filter(sample => sample.timestamp > cutoff);
    });
    
    console.log('🗑️  Log cleanup completed');
  }
  
  /**
   * Generate unique log ID
   */
  generateLogId() {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Generate unique anomaly ID
   */
  generateAnomalyId() {
    return `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get pattern severity
   */
  getPatternSeverity(pattern) {
    const severityMap = {
      network: 'high',
      rpc: 'high', 
      database: 'critical',
      arbitrage: 'medium',
      contract: 'high'
    };
    
    return severityMap[pattern] || 'medium';
  }
  
  /**
   * Get anomaly severity
   */
  getAnomalySeverity(type) {
    const severityMap = {
      frequency_spike: 'high',
      performance_spike: 'medium',
      long_message: 'low',
      unexpected_stack_trace: 'medium'
    };
    
    return severityMap[type] || 'medium';
  }
  
  /**
   * Get log analyzer status
   */
  getStatus() {
    return {
      running: this.isRunning,
      uptime: Date.now() - this.startTime,
      logsProcessed: this.performanceMetrics.totalLogsProcessed,
      processingRate: this.performanceMetrics.logProcessingRate,
      bufferSize: this.logBuffer.length,
      indexSize: this.logIndex.size,
      streamingClients: this.streamingClients.size,
      patterns: {
        errors: this.logPatterns.errors.size,
        warnings: this.logPatterns.warnings.size,
        anomalies: Array.from(this.logPatterns.anomalies.values()).reduce((sum, arr) => sum + arr.length, 0)
      }
    };
  }
  
  /**
   * Shutdown log analyzer
   */
  async shutdown() {
    console.log('🛑 Shutting down LogAnalyzer...');
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    if (this.streamingServer) {
      // Close streaming server
    }
    
    this.isRunning = false;
    this.emit('shutdown');
    
    console.log('✅ LogAnalyzer shutdown complete');
  }
}

export default LogAnalyzer;