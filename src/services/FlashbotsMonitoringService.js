const EventEmitter = require('events');
const config = require('../config/config');

/**
 * Flashbots Monitoring Service
 * Tracks MEV protection performance and provides comprehensive metrics
 */
class FlashbotsMonitoringService extends EventEmitter {
  constructor(flashbotsService, alertingService = null) {
    super();
    
    this.flashbotsService = flashbotsService;
    this.alertingService = alertingService;
    
    // Performance metrics
    this.metrics = {
      // Bundle statistics
      totalBundlesSubmitted: 0,
      bundlesIncluded: 0,
      bundlesMissed: 0,
      bundlesFailed: 0,
      
      // MEV protection stats
      totalMevProtected: 0,
      mevSaved: 0,
      averageBundlePriority: 0,
      
      // Performance metrics
      averageInclusionTime: 0,
      successRatePercent: 0,
      
      // Economic metrics
      totalFeesSpent: 0,
      totalProfitProtected: 0,
      costBenefitRatio: 0,
      
      // Historical data
      hourlyStats: [],
      dailyStats: []
    };
    
    // Alerting thresholds
    this.thresholds = {
      minSuccessRate: 85, // 85% minimum success rate
      maxFailureStreak: 5, // Alert after 5 consecutive failures
      maxResponseTime: 30000, // 30 seconds max response time
      minCostBenefitRatio: 2.0 // Minimum 2:1 benefit to cost ratio
    };
    
    // State tracking
    this.consecutiveFailures = 0;
    this.lastAlertTime = 0;
    this.alertCooldown = 300000; // 5 minutes between alerts
    
    this.initialized = false;
  }
  
  /**
   * Initialize monitoring service
   */
  async initialize() {
    try {
      if (!this.flashbotsService) {
        throw new Error('FlashbotsService is required');
      }
      
      // Set up event listeners for Flashbots service
      this.setupFlashbotsEventListeners();
      
      // Start periodic metric calculations
      this.startPeriodicTasks();
      
      this.initialized = true;
      console.log('✅ Flashbots Monitoring Service initialized');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Flashbots Monitoring Service:', error.message);
      return false;
    }
  }
  
  /**
   * Setup event listeners for Flashbots service
   */
  setupFlashbotsEventListeners() {
    // Bundle submission events
    this.flashbotsService.on('bundleSubmitted', (data) => {
      this.handleBundleSubmitted(data);
    });
    
    this.flashbotsService.on('bundleIncluded', (data) => {
      this.handleBundleIncluded(data);
    });
    
    this.flashbotsService.on('bundleMissed', (data) => {
      this.handleBundleMissed(data);
    });
    
    this.flashbotsService.on('bundleError', (data) => {
      this.handleBundleError(data);
    });
    
    this.flashbotsService.on('emergencyDisabled', () => {
      this.handleEmergencyDisabled();
    });
  }
  
  /**
   * Handle bundle submission event
   */
  handleBundleSubmitted(data) {
    this.metrics.totalBundlesSubmitted++;
    
    console.log(`📊 Bundle submitted: ${data.bundleId} (Total: ${this.metrics.totalBundlesSubmitted})`);
    
    // Track submission timestamp for response time calculation
    this.bundleSubmissionTimes = this.bundleSubmissionTimes || new Map();
    this.bundleSubmissionTimes.set(data.bundleId, Date.now());
    
    this.emit('metricsUpdated', this.metrics);
  }
  
  /**
   * Handle bundle inclusion event
   */
  handleBundleIncluded(data) {
    this.metrics.bundlesIncluded++;
    this.consecutiveFailures = 0; // Reset failure streak
    
    // Calculate inclusion time
    const submissionTime = this.bundleSubmissionTimes?.get(data.bundleId);
    if (submissionTime) {
      const inclusionTime = Date.now() - submissionTime;
      this.updateAverageInclusionTime(inclusionTime);
      this.bundleSubmissionTimes.delete(data.bundleId);
    }
    
    // Update success rate
    this.updateSuccessRate();
    
    console.log(`✅ Bundle included: ${data.bundleId} (Success rate: ${this.metrics.successRatePercent.toFixed(1)}%)`);
    
    this.emit('metricsUpdated', this.metrics);
    this.emit('bundleSuccess', data);
  }
  
  /**
   * Handle bundle missed event
   */
  handleBundleMissed(data) {
    this.metrics.bundlesMissed++;
    this.consecutiveFailures++;
    
    // Update success rate
    this.updateSuccessRate();
    
    console.log(`⏭️ Bundle missed: ${data.bundleId} (Consecutive failures: ${this.consecutiveFailures})`);
    
    // Check for alerting conditions
    this.checkAlertingConditions();
    
    this.emit('metricsUpdated', this.metrics);
    this.emit('bundleMissed', data);
  }
  
  /**
   * Handle bundle error event
   */
  handleBundleError(data) {
    this.metrics.bundlesFailed++;
    this.consecutiveFailures++;
    
    // Update success rate
    this.updateSuccessRate();
    
    console.error(`❌ Bundle error: ${data.bundleId || 'Unknown'} - ${data.error || 'Unknown error'}`);
    
    // Check for alerting conditions
    this.checkAlertingConditions();
    
    this.emit('metricsUpdated', this.metrics);
    this.emit('bundleError', data);
  }
  
  /**
   * Handle emergency disabled event
   */
  handleEmergencyDisabled() {
    console.log('🚨 Flashbots emergency disabled - monitoring will continue for statistics');
    
    if (this.alertingService) {
      this.alertingService.sendAlert({
        type: 'critical',
        title: 'Flashbots Emergency Disabled',
        message: 'Flashbots MEV protection has been emergency disabled. All transactions will route to public mempool.',
        timestamp: new Date().toISOString()
      });
    }
    
    this.emit('emergencyDisabled');
  }
  
  /**
   * Update average inclusion time
   */
  updateAverageInclusionTime(newTime) {
    const totalIncluded = this.metrics.bundlesIncluded;
    if (totalIncluded === 1) {
      this.metrics.averageInclusionTime = newTime;
    } else {
      // Calculate running average
      this.metrics.averageInclusionTime = 
        ((this.metrics.averageInclusionTime * (totalIncluded - 1)) + newTime) / totalIncluded;
    }
  }
  
  /**
   * Update success rate percentage
   */
  updateSuccessRate() {
    const totalBundles = this.metrics.totalBundlesSubmitted;
    if (totalBundles > 0) {
      this.metrics.successRatePercent = (this.metrics.bundlesIncluded / totalBundles) * 100;
    }
  }
  
  /**
   * Check alerting conditions and send alerts if necessary
   */
  checkAlertingConditions() {
    const now = Date.now();
    
    // Rate limiting - don't spam alerts
    if (now - this.lastAlertTime < this.alertCooldown) {
      return;
    }
    
    // Check for consecutive failures
    if (this.consecutiveFailures >= this.thresholds.maxFailureStreak) {
      this.sendAlert('warning', 'High Flashbots Failure Rate', 
        `${this.consecutiveFailures} consecutive bundle failures detected`);
    }
    
    // Check for low success rate
    if (this.metrics.successRatePercent > 0 && 
        this.metrics.successRatePercent < this.thresholds.minSuccessRate &&
        this.metrics.totalBundlesSubmitted >= 10) {
      this.sendAlert('warning', 'Low Flashbots Success Rate', 
        `Success rate is ${this.metrics.successRatePercent.toFixed(1)}% (threshold: ${this.thresholds.minSuccessRate}%)`);
    }
  }
  
  /**
   * Send alert via alerting service
   */
  sendAlert(level, title, message) {
    this.lastAlertTime = Date.now();
    
    if (this.alertingService) {
      this.alertingService.sendAlert({
        type: level,
        title: `Flashbots Alert: ${title}`,
        message,
        timestamp: new Date().toISOString(),
        metrics: this.getCompactMetrics()
      });
    }
    
    console.log(`🚨 Flashbots Alert [${level.toUpperCase()}]: ${title} - ${message}`);
    this.emit('alert', { level, title, message });
  }
  
  /**
   * Start periodic tasks for metrics calculation
   */
  startPeriodicTasks() {
    // Update hourly stats every hour
    setInterval(() => {
      this.updateHourlyStats();
    }, 60 * 60 * 1000); // 1 hour
    
    // Update daily stats every day
    setInterval(() => {
      this.updateDailyStats();
    }, 24 * 60 * 60 * 1000); // 24 hours
    
    // Clean up old submission times every 10 minutes
    setInterval(() => {
      this.cleanupOldSubmissions();
    }, 10 * 60 * 1000); // 10 minutes
  }
  
  /**
   * Update hourly statistics
   */
  updateHourlyStats() {
    const hourlySnapshot = {
      timestamp: Date.now(),
      bundlesSubmitted: this.metrics.totalBundlesSubmitted,
      bundlesIncluded: this.metrics.bundlesIncluded,
      successRate: this.metrics.successRatePercent,
      averageInclusionTime: this.metrics.averageInclusionTime
    };
    
    this.metrics.hourlyStats.push(hourlySnapshot);
    
    // Keep only last 24 hours
    if (this.metrics.hourlyStats.length > 24) {
      this.metrics.hourlyStats = this.metrics.hourlyStats.slice(-24);
    }
  }
  
  /**
   * Update daily statistics
   */
  updateDailyStats() {
    const dailySnapshot = {
      timestamp: Date.now(),
      bundlesSubmitted: this.metrics.totalBundlesSubmitted,
      bundlesIncluded: this.metrics.bundlesIncluded,
      successRate: this.metrics.successRatePercent,
      totalMevProtected: this.metrics.totalMevProtected
    };
    
    this.metrics.dailyStats.push(dailySnapshot);
    
    // Keep only last 30 days
    if (this.metrics.dailyStats.length > 30) {
      this.metrics.dailyStats = this.metrics.dailyStats.slice(-30);
    }
  }
  
  /**
   * Clean up old bundle submission times
   */
  cleanupOldSubmissions() {
    if (!this.bundleSubmissionTimes) return;
    
    const cutoff = Date.now() - (60 * 60 * 1000); // 1 hour ago
    
    for (const [bundleId, timestamp] of this.bundleSubmissionTimes) {
      if (timestamp < cutoff) {
        this.bundleSubmissionTimes.delete(bundleId);
      }
    }
  }
  
  /**
   * Get comprehensive metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      thresholds: this.thresholds,
      health: this.getHealthStatus(),
      lastUpdated: Date.now()
    };
  }
  
  /**
   * Get compact metrics for alerts
   */
  getCompactMetrics() {
    return {
      bundlesSubmitted: this.metrics.totalBundlesSubmitted,
      successRate: `${this.metrics.successRatePercent.toFixed(1)}%`,
      consecutiveFailures: this.consecutiveFailures,
      avgInclusionTime: `${(this.metrics.averageInclusionTime / 1000).toFixed(1)}s`
    };
  }
  
  /**
   * Get health status
   */
  getHealthStatus() {
    const isHealthy = 
      this.metrics.successRatePercent >= this.thresholds.minSuccessRate &&
      this.consecutiveFailures < this.thresholds.maxFailureStreak &&
      this.metrics.averageInclusionTime < this.thresholds.maxResponseTime;
    
    return {
      status: isHealthy ? 'healthy' : 'degraded',
      issues: this.getHealthIssues()
    };
  }
  
  /**
   * Get current health issues
   */
  getHealthIssues() {
    const issues = [];
    
    if (this.metrics.successRatePercent < this.thresholds.minSuccessRate) {
      issues.push(`Low success rate: ${this.metrics.successRatePercent.toFixed(1)}%`);
    }
    
    if (this.consecutiveFailures >= this.thresholds.maxFailureStreak) {
      issues.push(`High failure streak: ${this.consecutiveFailures} consecutive failures`);
    }
    
    if (this.metrics.averageInclusionTime > this.thresholds.maxResponseTime) {
      issues.push(`High response time: ${(this.metrics.averageInclusionTime / 1000).toFixed(1)}s`);
    }
    
    return issues;
  }
  
  /**
   * Reset metrics (for testing or manual reset)
   */
  resetMetrics() {
    this.metrics = {
      totalBundlesSubmitted: 0,
      bundlesIncluded: 0,
      bundlesMissed: 0,
      bundlesFailed: 0,
      totalMevProtected: 0,
      mevSaved: 0,
      averageBundlePriority: 0,
      averageInclusionTime: 0,
      successRatePercent: 0,
      totalFeesSpent: 0,
      totalProfitProtected: 0,
      costBenefitRatio: 0,
      hourlyStats: [],
      dailyStats: []
    };
    
    this.consecutiveFailures = 0;
    console.log('📊 Flashbots metrics reset');
  }
  
  /**
   * Get monitoring report
   */
  getReport() {
    const health = this.getHealthStatus();
    
    return {
      summary: {
        status: health.status,
        successRate: `${this.metrics.successRatePercent.toFixed(1)}%`,
        totalBundles: this.metrics.totalBundlesSubmitted,
        avgInclusionTime: `${(this.metrics.averageInclusionTime / 1000).toFixed(1)}s`
      },
      metrics: this.getMetrics(),
      issues: health.issues,
      recommendations: this.getRecommendations()
    };
  }
  
  /**
   * Get performance recommendations
   */
  getRecommendations() {
    const recommendations = [];
    
    if (this.metrics.successRatePercent < 90 && this.metrics.totalBundlesSubmitted > 10) {
      recommendations.push('Consider increasing priority fees for better bundle inclusion');
    }
    
    if (this.metrics.averageInclusionTime > 20000) {
      recommendations.push('Average inclusion time is high - check network congestion');
    }
    
    if (this.consecutiveFailures > 2) {
      recommendations.push('Multiple recent failures - consider checking Flashbots relay status');
    }
    
    return recommendations;
  }
}

module.exports = FlashbotsMonitoringService;