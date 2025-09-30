import { EventEmitter } from 'events';

/**
 * EventTracker - Business event tracking and correlation analysis
 * Provides comprehensive event tracking, funnel analysis, and root cause identification
 */
class EventTracker extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      retentionPeriod: options.retentionPeriod || 7 * 24 * 60 * 60 * 1000, // 7 days
      correlationWindow: options.correlationWindow || 5 * 60 * 1000, // 5 minutes
      maxEvents: options.maxEvents || 100000,
      enableAnalysis: options.enableAnalysis !== false,
      analysisInterval: options.analysisInterval || 300000, // 5 minutes
      funnelTimeout: options.funnelTimeout || 30 * 60 * 1000, // 30 minutes
      ...options
    };
    
    // Event storage
    this.events = new Map(); // eventId -> event data
    this.eventsByType = new Map(); // eventType -> Set of eventIds
    this.eventsByCorrelation = new Map(); // correlationId -> Set of eventIds
    this.eventTimeline = []; // Ordered by timestamp
    
    // Event definitions and categories
    this.eventTypes = {
      // Arbitrage lifecycle events
      opportunity_detected: {
        category: 'arbitrage',
        stage: 'detection',
        description: 'Arbitrage opportunity detected',
        nextEvents: ['opportunity_analyzed', 'opportunity_skipped']
      },
      opportunity_analyzed: {
        category: 'arbitrage',
        stage: 'analysis',
        description: 'Opportunity analysis completed',
        nextEvents: ['opportunity_executed', 'opportunity_rejected']
      },
      opportunity_executed: {
        category: 'arbitrage',
        stage: 'execution',
        description: 'Opportunity execution started',
        nextEvents: ['trade_submitted', 'execution_failed']
      },
      opportunity_rejected: {
        category: 'arbitrage',
        stage: 'rejection',
        description: 'Opportunity rejected',
        terminal: true
      },
      opportunity_skipped: {
        category: 'arbitrage',
        stage: 'skipped',
        description: 'Opportunity skipped',
        terminal: true
      },
      
      // Trade execution events
      trade_submitted: {
        category: 'trading',
        stage: 'submission',
        description: 'Trade transaction submitted',
        nextEvents: ['trade_confirmed', 'trade_failed', 'trade_reverted']
      },
      trade_confirmed: {
        category: 'trading',
        stage: 'confirmation',
        description: 'Trade confirmed on blockchain',
        nextEvents: ['profit_calculated']
      },
      trade_failed: {
        category: 'trading',
        stage: 'failure',
        description: 'Trade transaction failed',
        terminal: true
      },
      trade_reverted: {
        category: 'trading',
        stage: 'revert',
        description: 'Trade transaction reverted',
        terminal: true
      },
      profit_calculated: {
        category: 'trading',
        stage: 'completion',
        description: 'Trade profit calculated',
        terminal: true
      },
      
      // System events
      system_start: {
        category: 'system',
        stage: 'lifecycle',
        description: 'System started',
        nextEvents: ['system_ready']
      },
      system_ready: {
        category: 'system',
        stage: 'lifecycle',
        description: 'System ready for operation',
        nextEvents: ['system_stop', 'emergency_stop']
      },
      system_stop: {
        category: 'system',
        stage: 'lifecycle',
        description: 'System stopped normally',
        terminal: true
      },
      emergency_stop: {
        category: 'system',
        stage: 'emergency',
        description: 'Emergency stop triggered',
        nextEvents: ['system_stop']
      },
      
      // Risk events
      risk_threshold_exceeded: {
        category: 'risk',
        stage: 'warning',
        description: 'Risk threshold exceeded',
        nextEvents: ['risk_action_taken', 'circuit_breaker_triggered']
      },
      circuit_breaker_triggered: {
        category: 'risk',
        stage: 'protection',
        description: 'Circuit breaker activated',
        nextEvents: ['system_pause']
      },
      risk_action_taken: {
        category: 'risk',
        stage: 'mitigation',
        description: 'Risk mitigation action taken',
        terminal: true
      },
      system_pause: {
        category: 'system',
        stage: 'pause',
        description: 'System paused for safety',
        nextEvents: ['system_resume', 'system_stop']
      },
      system_resume: {
        category: 'system',
        stage: 'resume',
        description: 'System resumed operation',
        nextEvents: ['system_ready']
      },
      
      // Market events
      price_update: {
        category: 'market',
        stage: 'data',
        description: 'Price data updated',
        continuous: true
      },
      market_volatility_high: {
        category: 'market',
        stage: 'condition',
        description: 'High market volatility detected',
        nextEvents: ['strategy_adjusted']
      },
      liquidity_low: {
        category: 'market',
        stage: 'condition',
        description: 'Low liquidity detected',
        nextEvents: ['strategy_adjusted']
      },
      strategy_adjusted: {
        category: 'strategy',
        stage: 'adaptation',
        description: 'Strategy parameters adjusted',
        terminal: true
      },
      
      // Configuration events
      config_changed: {
        category: 'configuration',
        stage: 'update',
        description: 'Configuration updated',
        nextEvents: ['system_restart']
      },
      system_restart: {
        category: 'system',
        stage: 'restart',
        description: 'System restarted',
        nextEvents: ['system_ready']
      }
    };
    
    // Funnel definitions
    this.funnels = {
      arbitrage_flow: {
        name: 'Arbitrage Opportunity Flow',
        stages: [
          'opportunity_detected',
          'opportunity_analyzed',
          'opportunity_executed',
          'trade_submitted',
          'trade_confirmed',
          'profit_calculated'
        ],
        conversionMetrics: new Map()
      },
      system_lifecycle: {
        name: 'System Lifecycle',
        stages: [
          'system_start',
          'system_ready'
        ],
        conversionMetrics: new Map()
      },
      risk_response: {
        name: 'Risk Response Flow',
        stages: [
          'risk_threshold_exceeded',
          'risk_action_taken'
        ],
        conversionMetrics: new Map()
      }
    };
    
    // Analytics data
    this.analytics = {
      eventCounts: new Map(),
      conversionRates: new Map(),
      correlations: new Map(),
      patterns: new Map(),
      performance: new Map(),
      anomalies: []
    };
    
    // Event processing
    this.processingQueue = [];
    this.isProcessing = false;
    
    // Analysis intervals
    this.analysisInterval = null;
    this.cleanupInterval = null;
    
    this.isInitialized = false;
  }
  
  /**
   * Initialize the event tracker
   */
  async initialize() {
    console.log('📊 Initializing Event Tracker...');
    
    try {
      // Initialize analytics
      this.initializeAnalytics();
      
      // Start analysis if enabled
      if (this.options.enableAnalysis) {
        this.startAnalysis();
      }
      
      // Setup cleanup
      this.setupCleanup();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      console.log('✅ Event Tracker initialized successfully');
      
    } catch (error) {
      console.error('❌ Event Tracker initialization failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Initialize analytics structures
   */
  initializeAnalytics() {
    // Initialize event counts
    Object.keys(this.eventTypes).forEach(eventType => {
      this.analytics.eventCounts.set(eventType, 0);
    });
    
    // Initialize funnel metrics
    Object.values(this.funnels).forEach(funnel => {
      funnel.stages.forEach((stage, index) => {
        if (index < funnel.stages.length - 1) {
          const conversionKey = `${stage}_to_${funnel.stages[index + 1]}`;
          funnel.conversionMetrics.set(conversionKey, {
            attempts: 0,
            conversions: 0,
            rate: 0,
            avgTime: 0,
            times: []
          });
        }
      });
    });
  }
  
  /**
   * Track an event
   */
  async trackEvent(eventType, data = {}, correlationId = null) {
    const eventId = this.generateEventId();
    const timestamp = Date.now();
    
    // Create event object
    const event = {
      id: eventId,
      type: eventType,
      timestamp,
      correlationId: correlationId || this.generateCorrelationId(),
      data: { ...data },
      processed: false,
      stage: this.eventTypes[eventType]?.stage || 'unknown',
      category: this.eventTypes[eventType]?.category || 'unknown'
    };
    
    // Store event
    this.events.set(eventId, event);
    
    // Index by type
    if (!this.eventsByType.has(eventType)) {
      this.eventsByType.set(eventType, new Set());
    }
    this.eventsByType.get(eventType).add(eventId);
    
    // Index by correlation
    if (!this.eventsByCorrelation.has(event.correlationId)) {
      this.eventsByCorrelation.set(event.correlationId, new Set());
    }
    this.eventsByCorrelation.get(event.correlationId).add(eventId);
    
    // Add to timeline
    this.eventTimeline.push({
      id: eventId,
      timestamp,
      type: eventType,
      correlationId: event.correlationId
    });
    
    // Sort timeline (keep recent events first)
    this.eventTimeline.sort((a, b) => b.timestamp - a.timestamp);
    
    // Queue for processing
    this.processingQueue.push(eventId);
    
    // Process queue
    await this.processEventQueue();
    
    // Emit event
    this.emit('eventTracked', event);
    
    return eventId;
  }
  
  /**
   * Process event queue
   */
  async processEventQueue() {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      while (this.processingQueue.length > 0) {
        const eventId = this.processingQueue.shift();
        await this.processEvent(eventId);
      }
    } catch (error) {
      console.error('Event processing failed:', error.message);
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Process a single event
   */
  async processEvent(eventId) {
    const event = this.events.get(eventId);
    if (!event || event.processed) {
      return;
    }
    
    try {
      // Update event counts
      const currentCount = this.analytics.eventCounts.get(event.type) || 0;
      this.analytics.eventCounts.set(event.type, currentCount + 1);
      
      // Analyze correlations
      await this.analyzeEventCorrelations(event);
      
      // Update funnel metrics
      await this.updateFunnelMetrics(event);
      
      // Detect patterns
      await this.detectEventPatterns(event);
      
      // Performance analysis
      await this.analyzeEventPerformance(event);
      
      // Mark as processed
      event.processed = true;
      
    } catch (error) {
      console.error(`Failed to process event ${eventId}:`, error.message);
    }
  }
  
  /**
   * Analyze event correlations
   */
  async analyzeEventCorrelations(event) {
    const correlatedEvents = this.eventsByCorrelation.get(event.correlationId);
    if (!correlatedEvents || correlatedEvents.size < 2) {
      return;
    }
    
    // Get all events in this correlation
    const events = Array.from(correlatedEvents)
      .map(id => this.events.get(id))
      .filter(e => e && e.id !== event.id)
      .sort((a, b) => a.timestamp - b.timestamp);
    
    // Analyze event sequences
    events.forEach(prevEvent => {
      const timeDiff = event.timestamp - prevEvent.timestamp;
      
      if (timeDiff > 0 && timeDiff < this.options.correlationWindow) {
        const correlationKey = `${prevEvent.type}_to_${event.type}`;
        
        const correlation = this.analytics.correlations.get(correlationKey) || {
          count: 0,
          totalTime: 0,
          avgTime: 0,
          minTime: Infinity,
          maxTime: 0,
          times: []
        };
        
        correlation.count++;
        correlation.totalTime += timeDiff;
        correlation.avgTime = correlation.totalTime / correlation.count;
        correlation.minTime = Math.min(correlation.minTime, timeDiff);
        correlation.maxTime = Math.max(correlation.maxTime, timeDiff);
        correlation.times.push(timeDiff);
        
        // Keep only recent times for trend analysis
        if (correlation.times.length > 100) {
          correlation.times = correlation.times.slice(-100);
        }
        
        this.analytics.correlations.set(correlationKey, correlation);
      }
    });
  }
  
  /**
   * Update funnel metrics
   */
  async updateFunnelMetrics(event) {
    Object.values(this.funnels).forEach(funnel => {
      const stageIndex = funnel.stages.indexOf(event.type);
      if (stageIndex === -1) return;
      
      // Check if this is a funnel progression
      if (stageIndex > 0) {
        const prevStage = funnel.stages[stageIndex - 1];
        const conversionKey = `${prevStage}_to_${event.type}`;
        
        // Find previous stage event in same correlation
        const correlatedEvents = this.eventsByCorrelation.get(event.correlationId);
        if (correlatedEvents) {
          const prevEvent = Array.from(correlatedEvents)
            .map(id => this.events.get(id))
            .find(e => e && e.type === prevStage && e.timestamp < event.timestamp);
          
          if (prevEvent) {
            const conversionTime = event.timestamp - prevEvent.timestamp;
            const metrics = funnel.conversionMetrics.get(conversionKey);
            
            if (metrics) {
              metrics.conversions++;
              metrics.times.push(conversionTime);
              metrics.avgTime = metrics.times.reduce((a, b) => a + b, 0) / metrics.times.length;
              
              // Update conversion rate
              const prevStageCount = this.analytics.eventCounts.get(prevStage) || 0;
              metrics.rate = prevStageCount > 0 ? (metrics.conversions / prevStageCount) * 100 : 0;
              
              // Keep only recent times
              if (metrics.times.length > 100) {
                metrics.times = metrics.times.slice(-100);
              }
            }
          }
        }
      }
      
      // Update attempt counts for funnel stages
      if (stageIndex === 0 || stageIndex < funnel.stages.length - 1) {
        const nextStage = funnel.stages[stageIndex + 1];
        if (nextStage) {
          const conversionKey = `${event.type}_to_${nextStage}`;
          const metrics = funnel.conversionMetrics.get(conversionKey);
          if (metrics) {
            metrics.attempts++;
          }
        }
      }
    });
  }
  
  /**
   * Detect event patterns
   */
  async detectEventPatterns(event) {
    const windowSize = 5 * 60 * 1000; // 5 minutes
    const recentEvents = this.eventTimeline
      .filter(e => e.timestamp > (event.timestamp - windowSize))
      .slice(0, 50); // Last 50 events in window
    
    if (recentEvents.length < 3) return;
    
    // Detect sequence patterns
    const sequences = this.extractEventSequences(recentEvents, 3);
    sequences.forEach(sequence => {
      const patternKey = sequence.map(e => e.type).join('->');
      
      const pattern = this.analytics.patterns.get(patternKey) || {
        sequence: sequence.map(e => e.type),
        count: 0,
        lastSeen: 0,
        avgInterval: 0,
        intervals: []
      };
      
      pattern.count++;
      pattern.lastSeen = event.timestamp;
      
      // Calculate intervals between events in pattern
      if (sequence.length > 1) {
        const intervals = [];
        for (let i = 1; i < sequence.length; i++) {
          intervals.push(sequence[i].timestamp - sequence[i-1].timestamp);
        }
        pattern.intervals.push(...intervals);
        pattern.avgInterval = pattern.intervals.reduce((a, b) => a + b, 0) / pattern.intervals.length;
        
        // Keep only recent intervals
        if (pattern.intervals.length > 50) {
          pattern.intervals = pattern.intervals.slice(-50);
        }
      }
      
      this.analytics.patterns.set(patternKey, pattern);
      
      // Emit pattern detection for significant patterns
      if (pattern.count === 5 || pattern.count % 10 === 0) {
        this.emit('patternDetected', {
          pattern: patternKey,
          count: pattern.count,
          sequence: pattern.sequence
        });
      }
    });
    
    // Detect anomalous patterns
    this.detectAnomalousPatterns(event, recentEvents);
  }
  
  /**
   * Extract event sequences from timeline
   */
  extractEventSequences(events, length) {
    const sequences = [];
    
    for (let i = 0; i <= events.length - length; i++) {
      const sequence = events.slice(i, i + length);
      // Only include sequences within same correlation or close in time
      const maxGap = 60000; // 1 minute max gap
      let validSequence = true;
      
      for (let j = 1; j < sequence.length; j++) {
        const gap = sequence[j-1].timestamp - sequence[j].timestamp;
        if (gap > maxGap && sequence[j-1].correlationId !== sequence[j].correlationId) {
          validSequence = false;
          break;
        }
      }
      
      if (validSequence) {
        sequences.push(sequence);
      }
    }
    
    return sequences;
  }
  
  /**
   * Detect anomalous patterns
   */
  detectAnomalousPatterns(event, recentEvents) {
    // Detect rapid repeated events
    const sameTypeEvents = recentEvents.filter(e => e.type === event.type);
    if (sameTypeEvents.length >= 5) {
      const avgInterval = this.calculateAverageInterval(sameTypeEvents);
      if (avgInterval < 1000) { // Less than 1 second between same events
        this.analytics.anomalies.push({
          type: 'rapid_repetition',
          eventType: event.type,
          count: sameTypeEvents.length,
          avgInterval,
          timestamp: event.timestamp,
          severity: 'medium'
        });
        
        this.emit('anomalyDetected', {
          type: 'rapid_repetition',
          eventType: event.type,
          details: { count: sameTypeEvents.length, avgInterval }
        });
      }
    }
    
    // Detect missing expected events
    this.detectMissingEvents(event, recentEvents);
    
    // Detect unusual event combinations
    this.detectUnusualCombinations(event, recentEvents);
  }
  
  /**
   * Calculate average interval between events
   */
  calculateAverageInterval(events) {
    if (events.length < 2) return 0;
    
    let totalInterval = 0;
    for (let i = 1; i < events.length; i++) {
      totalInterval += events[i-1].timestamp - events[i].timestamp;
    }
    
    return totalInterval / (events.length - 1);
  }
  
  /**
   * Detect missing expected events
   */
  detectMissingEvents(event, recentEvents) {
    const eventDef = this.eventTypes[event.type];
    if (!eventDef || !eventDef.nextEvents) return;
    
    // Check if expected next events occurred
    const correlatedEvents = recentEvents.filter(e => e.correlationId === event.correlationId);
    const laterEvents = correlatedEvents.filter(e => e.timestamp > event.timestamp);
    
    const expectedTypes = new Set(eventDef.nextEvents);
    const actualTypes = new Set(laterEvents.map(e => e.type));
    
    const missingEvents = Array.from(expectedTypes).filter(type => !actualTypes.has(type));
    
    if (missingEvents.length > 0 && Date.now() - event.timestamp > 30000) { // 30 seconds timeout
      this.analytics.anomalies.push({
        type: 'missing_events',
        eventType: event.type,
        missingEvents,
        timestamp: Date.now(),
        correlationId: event.correlationId,
        severity: 'low'
      });
    }
  }
  
  /**
   * Detect unusual event combinations
   */
  detectUnusualCombinations(event, recentEvents) {
    // Look for events that rarely occur together
    const correlatedEvents = recentEvents.filter(e => e.correlationId === event.correlationId);
    
    if (correlatedEvents.length >= 3) {
      const combination = correlatedEvents.map(e => e.type).sort().join('+');
      
      // Check if this combination is rare (simplified check)
      const existingPattern = this.analytics.patterns.get(combination);
      if (!existingPattern || existingPattern.count < 2) {
        this.analytics.anomalies.push({
          type: 'unusual_combination',
          events: correlatedEvents.map(e => e.type),
          timestamp: event.timestamp,
          correlationId: event.correlationId,
          severity: 'low'
        });
      }
    }
  }
  
  /**
   * Analyze event performance
   */
  async analyzeEventPerformance(event) {
    if (!event.data.executionTime && !event.data.duration) {
      return;
    }
    
    const performanceKey = `${event.type}_performance`;
    const performance = this.analytics.performance.get(performanceKey) || {
      count: 0,
      totalTime: 0,
      avgTime: 0,
      minTime: Infinity,
      maxTime: 0,
      recentTimes: []
    };
    
    const executionTime = event.data.executionTime || event.data.duration || 0;
    
    performance.count++;
    performance.totalTime += executionTime;
    performance.avgTime = performance.totalTime / performance.count;
    performance.minTime = Math.min(performance.minTime, executionTime);
    performance.maxTime = Math.max(performance.maxTime, executionTime);
    performance.recentTimes.push(executionTime);
    
    // Keep only recent times
    if (performance.recentTimes.length > 100) {
      performance.recentTimes = performance.recentTimes.slice(-100);
    }
    
    this.analytics.performance.set(performanceKey, performance);
    
    // Check for performance degradation
    if (performance.recentTimes.length >= 20) {
      const recentAvg = performance.recentTimes.slice(-10)
        .reduce((a, b) => a + b, 0) / 10;
      
      if (recentAvg > performance.avgTime * 1.5) {
        this.emit('performanceDegradation', {
          eventType: event.type,
          recentAvg,
          overallAvg: performance.avgTime,
          degradation: ((recentAvg - performance.avgTime) / performance.avgTime) * 100
        });
      }
    }
  }
  
  /**
   * Start analysis
   */
  startAnalysis() {
    this.analysisInterval = setInterval(() => {
      this.performAnalysis();
    }, this.options.analysisInterval);
  }
  
  /**
   * Perform comprehensive analysis
   */
  performAnalysis() {
    try {
      const analysis = {
        timestamp: Date.now(),
        summary: this.getEventSummary(),
        funnels: this.analyzeFunnels(),
        correlations: this.analyzeCorrelations(),
        patterns: this.analyzePatterns(),
        performance: this.analyzePerformance(),
        anomalies: this.getRecentAnomalies()
      };
      
      this.emit('analysisComplete', analysis);
      
    } catch (error) {
      console.error('Event analysis failed:', error.message);
    }
  }
  
  /**
   * Get event summary
   */
  getEventSummary() {
    const totalEvents = this.events.size;
    const recentEvents = this.eventTimeline
      .filter(e => e.timestamp > (Date.now() - 60 * 60 * 1000)) // Last hour
      .length;
    
    const eventsByCategory = new Map();
    this.events.forEach(event => {
      const category = event.category;
      eventsByCategory.set(category, (eventsByCategory.get(category) || 0) + 1);
    });
    
    return {
      totalEvents,
      recentEvents,
      eventsByCategory: Object.fromEntries(eventsByCategory),
      topEventTypes: Array.from(this.analytics.eventCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([type, count]) => ({ type, count }))
    };
  }
  
  /**
   * Analyze funnels
   */
  analyzeFunnels() {
    const funnelAnalysis = {};
    
    Object.entries(this.funnels).forEach(([funnelId, funnel]) => {
      const stages = funnel.stages.map(stage => {
        const count = this.analytics.eventCounts.get(stage) || 0;
        return { stage, count };
      });
      
      const conversions = Array.from(funnel.conversionMetrics.entries())
        .map(([key, metrics]) => ({
          conversion: key,
          rate: metrics.rate,
          avgTime: metrics.avgTime,
          attempts: metrics.attempts,
          conversions: metrics.conversions
        }));
      
      funnelAnalysis[funnelId] = {
        name: funnel.name,
        stages,
        conversions,
        overallConversion: this.calculateOverallConversion(stages)
      };
    });
    
    return funnelAnalysis;
  }
  
  /**
   * Calculate overall funnel conversion
   */
  calculateOverallConversion(stages) {
    if (stages.length < 2) return 0;
    
    const firstStage = stages[0].count;
    const lastStage = stages[stages.length - 1].count;
    
    return firstStage > 0 ? (lastStage / firstStage) * 100 : 0;
  }
  
  /**
   * Analyze correlations
   */
  analyzeCorrelations() {
    const topCorrelations = Array.from(this.analytics.correlations.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
      .map(([key, data]) => ({
        correlation: key,
        count: data.count,
        avgTime: data.avgTime,
        minTime: data.minTime,
        maxTime: data.maxTime
      }));
    
    return {
      totalCorrelations: this.analytics.correlations.size,
      topCorrelations,
      strongCorrelations: topCorrelations.filter(c => c.count >= 10)
    };
  }
  
  /**
   * Analyze patterns
   */
  analyzePatterns() {
    const topPatterns = Array.from(this.analytics.patterns.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 15)
      .map(([key, data]) => ({
        pattern: key,
        sequence: data.sequence,
        count: data.count,
        avgInterval: data.avgInterval,
        lastSeen: data.lastSeen
      }));
    
    return {
      totalPatterns: this.analytics.patterns.size,
      topPatterns,
      recentPatterns: topPatterns.filter(p => 
        Date.now() - p.lastSeen < 60 * 60 * 1000 // Last hour
      )
    };
  }
  
  /**
   * Analyze performance
   */
  analyzePerformance() {
    const performanceData = Array.from(this.analytics.performance.entries())
      .map(([key, data]) => ({
        eventType: key.replace('_performance', ''),
        avgTime: data.avgTime,
        minTime: data.minTime,
        maxTime: data.maxTime,
        count: data.count,
        recentAvg: data.recentTimes.length > 0 ?
          data.recentTimes.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, data.recentTimes.length) : 0
      }));
    
    return {
      slowestEvents: performanceData
        .sort((a, b) => b.avgTime - a.avgTime)
        .slice(0, 10),
      degradingEvents: performanceData
        .filter(p => p.recentAvg > p.avgTime * 1.2)
        .sort((a, b) => (b.recentAvg / b.avgTime) - (a.recentAvg / a.avgTime))
    };
  }
  
  /**
   * Get recent anomalies
   */
  getRecentAnomalies() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    return this.analytics.anomalies
      .filter(anomaly => anomaly.timestamp > oneHourAgo)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20);
  }
  
  /**
   * Setup cleanup
   */
  setupCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000); // Every hour
  }
  
  /**
   * Cleanup old data
   */
  cleanupOldData() {
    const cutoff = Date.now() - this.options.retentionPeriod;
    let removedCount = 0;
    
    // Remove old events
    const eventsToRemove = [];
    this.events.forEach((event, eventId) => {
      if (event.timestamp < cutoff) {
        eventsToRemove.push(eventId);
      }
    });
    
    eventsToRemove.forEach(eventId => {
      const event = this.events.get(eventId);
      if (event) {
        // Remove from indices
        this.eventsByType.get(event.type)?.delete(eventId);
        this.eventsByCorrelation.get(event.correlationId)?.delete(eventId);
        
        // Remove event
        this.events.delete(eventId);
        removedCount++;
      }
    });
    
    // Clean timeline
    this.eventTimeline = this.eventTimeline.filter(e => e.timestamp >= cutoff);
    
    // Clean anomalies
    this.analytics.anomalies = this.analytics.anomalies.filter(a => a.timestamp >= cutoff);
    
    // Clean empty sets
    this.eventsByType.forEach((eventSet, eventType) => {
      if (eventSet.size === 0) {
        this.eventsByType.delete(eventType);
      }
    });
    
    this.eventsByCorrelation.forEach((eventSet, correlationId) => {
      if (eventSet.size === 0) {
        this.eventsByCorrelation.delete(correlationId);
      }
    });
    
    if (removedCount > 0) {
      console.log(`🧹 Event cleanup: removed ${removedCount} old events`);
    }
  }
  
  /**
   * Generate unique event ID
   */
  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Generate correlation ID
   */
  generateCorrelationId() {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get events by correlation ID
   */
  getEventsByCorrelation(correlationId) {
    const eventIds = this.eventsByCorrelation.get(correlationId);
    if (!eventIds) return [];
    
    return Array.from(eventIds)
      .map(id => this.events.get(id))
      .filter(event => event)
      .sort((a, b) => a.timestamp - b.timestamp);
  }
  
  /**
   * Get events by type
   */
  getEventsByType(eventType, limit = 100) {
    const eventIds = this.eventsByType.get(eventType);
    if (!eventIds) return [];
    
    return Array.from(eventIds)
      .map(id => this.events.get(id))
      .filter(event => event)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
  
  /**
   * Get event timeline
   */
  getEventTimeline(limit = 100, categories = []) {
    let timeline = this.eventTimeline.slice(0, limit);
    
    if (categories.length > 0) {
      timeline = timeline.filter(item => {
        const event = this.events.get(item.id);
        return event && categories.includes(event.category);
      });
    }
    
    return timeline.map(item => {
      const event = this.events.get(item.id);
      return {
        ...item,
        data: event?.data,
        stage: event?.stage,
        category: event?.category
      };
    });
  }
  
  /**
   * Search events
   */
  searchEvents(criteria = {}) {
    const {
      types = [],
      categories = [],
      correlationId = null,
      timeRange = null,
      limit = 100,
      searchText = null
    } = criteria;
    
    let results = Array.from(this.events.values());
    
    // Filter by types
    if (types.length > 0) {
      results = results.filter(event => types.includes(event.type));
    }
    
    // Filter by categories
    if (categories.length > 0) {
      results = results.filter(event => categories.includes(event.category));
    }
    
    // Filter by correlation ID
    if (correlationId) {
      results = results.filter(event => event.correlationId === correlationId);
    }
    
    // Filter by time range
    if (timeRange) {
      const { start, end } = timeRange;
      results = results.filter(event => 
        event.timestamp >= start && event.timestamp <= end
      );
    }
    
    // Filter by search text
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      results = results.filter(event => 
        event.type.toLowerCase().includes(searchLower) ||
        JSON.stringify(event.data).toLowerCase().includes(searchLower)
      );
    }
    
    // Sort by timestamp (newest first)
    results.sort((a, b) => b.timestamp - a.timestamp);
    
    // Apply limit
    return results.slice(0, limit);
  }
  
  /**
   * Export events
   */
  exportEvents(format = 'json', criteria = {}) {
    const events = this.searchEvents(criteria);
    
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify({
          events,
          meta: {
            totalEvents: events.length,
            exportTime: new Date().toISOString(),
            criteria
          }
        }, null, 2);
        
      case 'csv':
        return this.convertEventsToCSV(events);
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
  
  /**
   * Convert events to CSV
   */
  convertEventsToCSV(events) {
    const rows = [];
    rows.push('Timestamp,Type,Category,Stage,CorrelationId,Data');
    
    events.forEach(event => {
      rows.push([
        new Date(event.timestamp).toISOString(),
        event.type,
        event.category,
        event.stage,
        event.correlationId,
        `"${JSON.stringify(event.data).replace(/"/g, '""')}"`
      ].join(','));
    });
    
    return rows.join('\n');
  }
  
  /**
   * Get comprehensive analytics
   */
  getAnalytics() {
    return {
      summary: this.getEventSummary(),
      funnels: this.analyzeFunnels(),
      correlations: this.analyzeCorrelations(),
      patterns: this.analyzePatterns(),
      performance: this.analyzePerformance(),
      anomalies: this.getRecentAnomalies(),
      metrics: {
        totalEvents: this.events.size,
        totalCorrelations: this.eventsByCorrelation.size,
        totalPatterns: this.analytics.patterns.size,
        totalAnomalies: this.analytics.anomalies.length
      }
    };
  }
  
  /**
   * Shutdown event tracker
   */
  async shutdown() {
    console.log('🛑 Shutting down Event Tracker...');
    
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Process any remaining events
    await this.processEventQueue();
    
    this.isInitialized = false;
    this.emit('shutdown');
    
    console.log('✅ Event Tracker shutdown complete');
  }
}

export default EventTracker;