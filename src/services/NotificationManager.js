import { EventEmitter } from 'events';

/**
 * NotificationManager - Smart notification management and delivery
 * Provides scheduling, preferences, digest notifications, and delivery confirmation
 */
class NotificationManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      enableScheduling: options.enableScheduling !== false,
      enableDigests: options.enableDigests !== false,
      digestInterval: options.digestInterval || 3600000, // 1 hour
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 5000, // 5 seconds
      confirmationTimeout: options.confirmationTimeout || 30000, // 30 seconds
      quietHoursStart: options.quietHoursStart || 22, // 10 PM
      quietHoursEnd: options.quietHoursEnd || 7, // 7 AM
      timezone: options.timezone || 'UTC',
      ...options
    };
    
    // Notification types configuration
    this.notificationTypes = {
      trade_success: {
        priority: 'medium',
        category: 'trading',
        title: '✅ Trade Successful',
        template: 'Trade executed successfully: {{profit}} profit in {{executionTime}}ms',
        channels: ['discord', 'telegram'],
        digestible: true,
        requireConfirmation: false
      },
      trade_failure: {
        priority: 'high',
        category: 'trading',
        title: '❌ Trade Failed',
        template: 'Trade execution failed: {{reason}}',
        channels: ['discord', 'telegram', 'email'],
        digestible: false,
        requireConfirmation: true
      },
      opportunity_detected: {
        priority: 'low',
        category: 'opportunity',
        title: '🎯 Opportunity Detected',
        template: 'Arbitrage opportunity: {{spread}}% spread on {{tokenPair}}',
        channels: ['discord'],
        digestible: true,
        requireConfirmation: false
      },
      system_error: {
        priority: 'critical',
        category: 'system',
        title: '🚨 System Error',
        template: 'System error detected: {{error}}',
        channels: ['discord', 'telegram', 'email', 'sms'],
        digestible: false,
        requireConfirmation: true,
        escalation: true
      },
      performance_milestone: {
        priority: 'medium',
        category: 'performance',
        title: '🎉 Performance Milestone',
        template: 'Performance milestone reached: {{milestone}}',
        channels: ['discord', 'email'],
        digestible: false,
        requireConfirmation: false
      },
      risk_threshold: {
        priority: 'high',
        category: 'risk',
        title: '⚠️ Risk Threshold Exceeded',
        template: 'Risk threshold exceeded: {{metric}} = {{value}} (threshold: {{threshold}})',
        channels: ['discord', 'telegram', 'email'],
        digestible: false,
        requireConfirmation: true,
        escalation: true
      },
      circuit_breaker: {
        priority: 'critical',
        category: 'system',
        title: '🛑 Circuit Breaker Activated',
        template: 'Circuit breaker activated: {{reason}}',
        channels: ['discord', 'telegram', 'email', 'sms'],
        digestible: false,
        requireConfirmation: true,
        escalation: true
      },
      market_condition: {
        priority: 'low',
        category: 'market',
        title: '📊 Market Condition Alert',
        template: 'Market condition change: {{condition}}',
        channels: ['discord'],
        digestible: true,
        requireConfirmation: false
      },
      config_change: {
        priority: 'medium',
        category: 'configuration',
        title: '⚙️ Configuration Changed',
        template: 'Configuration updated: {{changes}}',
        channels: ['discord', 'email'],
        digestible: false,
        requireConfirmation: false
      },
      maintenance_reminder: {
        priority: 'low',
        category: 'maintenance',
        title: '🔧 Maintenance Reminder',
        template: 'Scheduled maintenance: {{description}} at {{scheduledTime}}',
        channels: ['discord', 'email'],
        digestible: false,
        requireConfirmation: false,
        scheduling: {
          advance: 3600000, // 1 hour before
          repeat: [1800000, 300000] // 30 min and 5 min before
        }
      }
    };
    
    // User/role preferences
    this.preferences = {
      default: {
        channels: ['discord'],
        priorities: ['critical', 'high', 'medium'],
        categories: ['all'],
        quietHours: true,
        digestEnabled: true,
        digestFrequency: 'hourly',
        language: 'en'
      },
      admin: {
        channels: ['discord', 'telegram', 'email'],
        priorities: ['critical', 'high', 'medium', 'low'],
        categories: ['all'],
        quietHours: false,
        digestEnabled: true,
        digestFrequency: 'hourly',
        language: 'en'
      },
      trader: {
        channels: ['discord', 'telegram'],
        priorities: ['critical', 'high', 'medium'],
        categories: ['trading', 'opportunity', 'risk'],
        quietHours: true,
        digestEnabled: true,
        digestFrequency: 'hourly',
        language: 'en'
      },
      monitor: {
        channels: ['discord'],
        priorities: ['critical', 'high'],
        categories: ['system', 'risk'],
        quietHours: false,
        digestEnabled: false,
        digestFrequency: 'never',
        language: 'en'
      }
    };
    
    // Notification queue and tracking
    this.notificationQueue = [];
    this.pendingNotifications = new Map(); // id -> notification
    this.sentNotifications = new Map(); // id -> delivery info
    this.failedNotifications = new Map(); // id -> failure info
    this.digestQueue = new Map(); // category -> notifications[]
    
    // Delivery tracking
    this.deliveryStats = {
      total: 0,
      successful: 0,
      failed: 0,
      pending: 0,
      byChannel: new Map(),
      byPriority: new Map(),
      byType: new Map()
    };
    
    // Scheduling
    this.scheduledNotifications = new Map(); // id -> schedule info
    this.recurringNotifications = new Map(); // id -> recurrence info
    
    // External services (injected)
    this.alertingService = options.alertingService || null;
    this.logManager = options.logManager || null;
    
    // Processing intervals
    this.processingInterval = null;
    this.digestInterval = null;
    this.cleanupInterval = null;
    this.retryInterval = null;
    
    // State
    this.isInitialized = false;
    this.isProcessing = false;
  }
  
  /**
   * Initialize notification management
   */
  async initialize() {
    console.log('📬 Initializing Notification Manager...');
    
    try {
      // Start processing queues
      this.startProcessing();
      
      // Start digest processing if enabled
      if (this.options.enableDigests) {
        this.startDigestProcessing();
      }
      
      // Start scheduled notifications if enabled
      if (this.options.enableScheduling) {
        this.startScheduledProcessing();
      }
      
      // Start retry processing
      this.startRetryProcessing();
      
      // Setup cleanup
      this.setupCleanup();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      console.log('✅ Notification Manager initialized successfully');
      
    } catch (error) {
      console.error('❌ Notification Manager initialization failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Send notification
   */
  async sendNotification(type, data = {}, options = {}) {
    const notificationId = this.generateNotificationId();
    
    // Get notification type configuration
    const typeConfig = this.notificationTypes[type];
    if (!typeConfig) {
      throw new Error(`Unknown notification type: ${type}`);
    }
    
    // Create notification object
    const notification = {
      id: notificationId,
      type,
      timestamp: Date.now(),
      data: { ...data },
      priority: options.priority || typeConfig.priority,
      category: typeConfig.category,
      title: options.title || typeConfig.title,
      message: this.renderTemplate(typeConfig.template, data),
      channels: options.channels || typeConfig.channels,
      recipients: options.recipients || ['default'],
      requireConfirmation: options.requireConfirmation !== undefined ? 
        options.requireConfirmation : typeConfig.requireConfirmation,
      digestible: typeConfig.digestible,
      status: 'queued',
      attempts: 0,
      maxRetries: options.maxRetries || this.options.maxRetries,
      scheduledFor: options.scheduledFor || null,
      escalation: typeConfig.escalation || false,
      metadata: options.metadata || {}
    };
    
    // Handle scheduling
    if (notification.scheduledFor && notification.scheduledFor > Date.now()) {
      return this.scheduleNotification(notification);
    }
    
    // Handle digest notifications
    if (typeConfig.digestible && this.shouldDigest(notification)) {
      return this.addToDigest(notification);
    }
    
    // Add to immediate processing queue
    this.notificationQueue.push(notification);
    this.pendingNotifications.set(notificationId, notification);
    
    // Log notification
    if (this.logManager) {
      this.logManager.getLogger().business('notification_queued', {
        notificationId,
        type,
        priority: notification.priority
      });
    }
    
    this.emit('notificationQueued', notification);
    
    return notificationId;
  }
  
  /**
   * Render message template
   */
  renderTemplate(template, data) {
    let message = template;
    
    Object.entries(data).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      message = message.replace(new RegExp(placeholder, 'g'), value);
    });
    
    return message;
  }
  
  /**
   * Check if notification should be digested
   */
  shouldDigest(notification) {
    if (!this.options.enableDigests || !notification.digestible) {
      return false;
    }
    
    // Check recipient preferences
    for (const recipient of notification.recipients) {
      const prefs = this.preferences[recipient] || this.preferences.default;
      if (prefs.digestEnabled && prefs.digestFrequency !== 'never') {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Add notification to digest
   */
  addToDigest(notification) {
    const digestKey = `${notification.category}_${notification.priority}`;
    
    if (!this.digestQueue.has(digestKey)) {
      this.digestQueue.set(digestKey, []);
    }
    
    this.digestQueue.get(digestKey).push(notification);
    
    this.emit('notificationDigested', notification);
    
    return notification.id;
  }
  
  /**
   * Schedule notification
   */
  scheduleNotification(notification) {
    this.scheduledNotifications.set(notification.id, {
      notification,
      scheduledFor: notification.scheduledFor,
      created: Date.now()
    });
    
    this.emit('notificationScheduled', notification);
    
    return notification.id;
  }
  
  /**
   * Start processing queues
   */
  startProcessing() {
    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing && this.notificationQueue.length > 0) {
        await this.processNotificationQueue();
      }
    }, 1000); // Process every second
  }
  
  /**
   * Process notification queue
   */
  async processNotificationQueue() {
    this.isProcessing = true;
    
    try {
      while (this.notificationQueue.length > 0) {
        const notification = this.notificationQueue.shift();
        await this.processNotification(notification);
      }
    } catch (error) {
      console.error('Notification processing failed:', error.message);
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Process single notification
   */
  async processNotification(notification) {
    try {
      // Check if notification should be sent now
      if (!this.shouldSendNow(notification)) {
        // Reschedule or skip
        if (notification.scheduledFor && notification.scheduledFor > Date.now()) {
          this.scheduleNotification(notification);
        }
        return;
      }
      
      // Filter recipients and channels based on preferences
      const filteredDelivery = this.filterDelivery(notification);
      
      if (filteredDelivery.length === 0) {
        this.markAsSkipped(notification, 'No valid recipients after filtering');
        return;
      }
      
      // Send to each channel/recipient combination
      const deliveryResults = [];
      
      for (const delivery of filteredDelivery) {
        const result = await this.deliverNotification(notification, delivery);
        deliveryResults.push(result);
      }
      
      // Update notification status
      const successCount = deliveryResults.filter(r => r.success).length;
      const totalCount = deliveryResults.length;
      
      if (successCount === totalCount) {
        this.markAsSuccess(notification, deliveryResults);
      } else if (successCount > 0) {
        this.markAsPartialSuccess(notification, deliveryResults);
      } else {
        this.markAsFailure(notification, deliveryResults);
      }
      
    } catch (error) {
      console.error(`Failed to process notification ${notification.id}:`, error.message);
      this.markAsFailure(notification, [{ 
        success: false, 
        error: error.message, 
        channel: 'unknown', 
        recipient: 'unknown' 
      }]);
    }
  }
  
  /**
   * Check if notification should be sent now
   */
  shouldSendNow(notification) {
    // Check quiet hours for each recipient
    for (const recipient of notification.recipients) {
      const prefs = this.preferences[recipient] || this.preferences.default;
      
      if (prefs.quietHours && this.isQuietHours() && notification.priority !== 'critical') {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Check if current time is within quiet hours
   */
  isQuietHours() {
    const now = new Date();
    const hour = now.getHours();
    
    const start = this.options.quietHoursStart;
    const end = this.options.quietHoursEnd;
    
    if (start < end) {
      return hour >= start || hour < end;
    } else {
      return hour >= start && hour < end;
    }
  }
  
  /**
   * Filter delivery based on preferences
   */
  filterDelivery(notification) {
    const deliveryPlan = [];
    
    for (const recipient of notification.recipients) {
      const prefs = this.preferences[recipient] || this.preferences.default;
      
      // Check if priority is allowed
      if (!prefs.priorities.includes(notification.priority)) {
        continue;
      }
      
      // Check if category is allowed
      if (!prefs.categories.includes('all') && 
          !prefs.categories.includes(notification.category)) {
        continue;
      }
      
      // Get allowed channels for this recipient
      const allowedChannels = notification.channels.filter(channel => 
        prefs.channels.includes(channel)
      );
      
      // Add to delivery plan
      allowedChannels.forEach(channel => {
        deliveryPlan.push({
          recipient,
          channel,
          preferences: prefs
        });
      });
    }
    
    return deliveryPlan;
  }
  
  /**
   * Deliver notification to specific channel/recipient
   */
  async deliverNotification(notification, delivery) {
    const { recipient, channel, preferences } = delivery;
    const startTime = Date.now();
    
    try {
      if (!this.alertingService) {
        throw new Error('AlertingService not available');
      }
      
      // Prepare notification data for delivery
      const deliveryData = {
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        category: notification.category,
        data: notification.data,
        recipient,
        channel,
        language: preferences.language || 'en'
      };
      
      // Send through alerting service
      const result = await this.alertingService.sendAlert(
        notification.type,
        deliveryData,
        { 
          channels: [channel],
          priority: notification.priority
        }
      );
      
      const duration = Date.now() - startTime;
      
      // Update statistics
      this.updateDeliveryStats(channel, notification.priority, notification.type, true, duration);
      
      return {
        success: true,
        channel,
        recipient,
        duration,
        result
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Update statistics
      this.updateDeliveryStats(channel, notification.priority, notification.type, false, duration);
      
      return {
        success: false,
        channel,
        recipient,
        duration,
        error: error.message
      };
    }
  }
  
  /**
   * Update delivery statistics
   */
  updateDeliveryStats(channel, priority, type, success, duration) {
    this.deliveryStats.total++;
    
    if (success) {
      this.deliveryStats.successful++;
    } else {
      this.deliveryStats.failed++;
    }
    
    // By channel
    const channelStats = this.deliveryStats.byChannel.get(channel) || {
      total: 0, successful: 0, failed: 0, avgDuration: 0, durations: []
    };
    channelStats.total++;
    channelStats.durations.push(duration);
    channelStats.avgDuration = channelStats.durations.reduce((a, b) => a + b, 0) / channelStats.durations.length;
    
    if (success) {
      channelStats.successful++;
    } else {
      channelStats.failed++;
    }
    
    // Keep only recent durations
    if (channelStats.durations.length > 100) {
      channelStats.durations = channelStats.durations.slice(-100);
    }
    
    this.deliveryStats.byChannel.set(channel, channelStats);
    
    // By priority
    const priorityStats = this.deliveryStats.byPriority.get(priority) || { total: 0, successful: 0, failed: 0 };
    priorityStats.total++;
    if (success) {
      priorityStats.successful++;
    } else {
      priorityStats.failed++;
    }
    this.deliveryStats.byPriority.set(priority, priorityStats);
    
    // By type
    const typeStats = this.deliveryStats.byType.get(type) || { total: 0, successful: 0, failed: 0 };
    typeStats.total++;
    if (success) {
      typeStats.successful++;
    } else {
      typeStats.failed++;
    }
    this.deliveryStats.byType.set(type, typeStats);
  }
  
  /**
   * Mark notification as successful
   */
  markAsSuccess(notification, deliveryResults) {
    notification.status = 'sent';
    notification.sentAt = Date.now();
    notification.deliveryResults = deliveryResults;
    
    this.sentNotifications.set(notification.id, {
      notification,
      deliveryResults,
      sentAt: notification.sentAt
    });
    
    this.pendingNotifications.delete(notification.id);
    
    // Handle confirmation requirement
    if (notification.requireConfirmation) {
      this.setupConfirmationTimeout(notification);
    }
    
    this.emit('notificationSent', notification);
    
    // Log success
    if (this.logManager) {
      this.logManager.getLogger().business('notification_sent', {
        notificationId: notification.id,
        type: notification.type,
        channels: deliveryResults.map(r => r.channel),
        duration: Date.now() - notification.timestamp
      });
    }
  }
  
  /**
   * Mark notification as partial success
   */
  markAsPartialSuccess(notification, deliveryResults) {
    notification.status = 'partial';
    notification.sentAt = Date.now();
    notification.deliveryResults = deliveryResults;
    
    // Retry failed deliveries
    const failedDeliveries = deliveryResults.filter(r => !r.success);
    if (failedDeliveries.length > 0 && notification.attempts < notification.maxRetries) {
      this.scheduleRetry(notification, failedDeliveries);
    } else {
      this.sentNotifications.set(notification.id, {
        notification,
        deliveryResults,
        sentAt: notification.sentAt
      });
      this.pendingNotifications.delete(notification.id);
    }
    
    this.emit('notificationPartiallyDelivered', notification);
  }
  
  /**
   * Mark notification as failed
   */
  markAsFailure(notification, deliveryResults) {
    notification.attempts++;
    
    if (notification.attempts < notification.maxRetries) {
      // Schedule retry
      this.scheduleRetry(notification, deliveryResults);
    } else {
      // Final failure
      notification.status = 'failed';
      notification.failedAt = Date.now();
      notification.deliveryResults = deliveryResults;
      
      this.failedNotifications.set(notification.id, {
        notification,
        deliveryResults,
        failedAt: notification.failedAt
      });
      
      this.pendingNotifications.delete(notification.id);
      
      this.emit('notificationFailed', notification);
      
      // Handle escalation if configured
      if (notification.escalation) {
        this.handleEscalation(notification);
      }
    }
    
    // Log failure
    if (this.logManager) {
      this.logManager.getLogger().error('notification_delivery_failed', {
        notificationId: notification.id,
        type: notification.type,
        attempts: notification.attempts,
        errors: deliveryResults.filter(r => !r.success).map(r => r.error)
      });
    }
  }
  
  /**
   * Mark notification as skipped
   */
  markAsSkipped(notification, reason) {
    notification.status = 'skipped';
    notification.skippedAt = Date.now();
    notification.skipReason = reason;
    
    this.pendingNotifications.delete(notification.id);
    
    this.emit('notificationSkipped', { notification, reason });
  }
  
  /**
   * Schedule notification retry
   */
  scheduleRetry(notification, failedDeliveries) {
    const retryDelay = this.options.retryDelay * Math.pow(2, notification.attempts); // Exponential backoff
    const retryTime = Date.now() + retryDelay;
    
    notification.nextRetry = retryTime;
    notification.failedDeliveries = failedDeliveries;
    
    this.emit('notificationRetryScheduled', { 
      notification, 
      retryTime, 
      attempt: notification.attempts + 1 
    });
  }
  
  /**
   * Handle notification escalation
   */
  async handleEscalation(notification) {
    try {
      // Create escalation notification
      const escalationNotification = {
        ...notification,
        id: this.generateNotificationId(),
        type: 'escalation',
        title: `🚨 ESCALATION: ${notification.title}`,
        message: `Original notification failed to deliver after ${notification.attempts} attempts:\n${notification.message}`,
        priority: 'critical',
        channels: ['discord', 'telegram', 'email', 'sms'],
        recipients: ['admin'],
        requireConfirmation: true,
        digestible: false,
        escalation: false, // Prevent infinite escalation
        attempts: 0
      };
      
      // Add to immediate processing queue
      this.notificationQueue.unshift(escalationNotification);
      this.pendingNotifications.set(escalationNotification.id, escalationNotification);
      
      this.emit('notificationEscalated', { original: notification, escalation: escalationNotification });
      
    } catch (error) {
      console.error('Failed to escalate notification:', error.message);
    }
  }
  
  /**
   * Setup confirmation timeout
   */
  setupConfirmationTimeout(notification) {
    setTimeout(() => {
      if (this.sentNotifications.has(notification.id)) {
        const sentData = this.sentNotifications.get(notification.id);
        if (!sentData.confirmed) {
          this.emit('notificationUnconfirmed', notification);
          
          // Handle unconfirmed critical notifications
          if (notification.priority === 'critical') {
            this.handleEscalation(notification);
          }
        }
      }
    }, this.options.confirmationTimeout);
  }
  
  /**
   * Confirm notification delivery
   */
  confirmNotification(notificationId, confirmedBy = 'unknown') {
    const sentData = this.sentNotifications.get(notificationId);
    if (sentData) {
      sentData.confirmed = true;
      sentData.confirmedAt = Date.now();
      sentData.confirmedBy = confirmedBy;
      
      this.emit('notificationConfirmed', { 
        notificationId, 
        confirmedBy, 
        confirmedAt: sentData.confirmedAt 
      });
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Start digest processing
   */
  startDigestProcessing() {
    this.digestInterval = setInterval(() => {
      this.processDigests();
    }, this.options.digestInterval);
  }
  
  /**
   * Process digest notifications
   */
  async processDigests() {
    if (this.digestQueue.size === 0) return;
    
    try {
      for (const [digestKey, notifications] of this.digestQueue.entries()) {
        if (notifications.length === 0) continue;
        
        // Create digest notification
        const digestNotification = this.createDigestNotification(digestKey, notifications);
        
        // Send digest
        this.notificationQueue.push(digestNotification);
        this.pendingNotifications.set(digestNotification.id, digestNotification);
        
        // Clear processed notifications
        this.digestQueue.set(digestKey, []);
      }
      
    } catch (error) {
      console.error('Digest processing failed:', error.message);
    }
  }
  
  /**
   * Create digest notification
   */
  createDigestNotification(digestKey, notifications) {
    const [category, priority] = digestKey.split('_');
    const count = notifications.length;
    
    // Group by type
    const byType = new Map();
    notifications.forEach(notification => {
      const type = notification.type;
      if (!byType.has(type)) {
        byType.set(type, []);
      }
      byType.get(type).push(notification);
    });
    
    // Create summary
    const summary = Array.from(byType.entries())
      .map(([type, notifs]) => `${notifs.length}x ${type}`)
      .join(', ');
    
    return {
      id: this.generateNotificationId(),
      type: 'digest',
      timestamp: Date.now(),
      data: { 
        digestKey, 
        count, 
        notifications: notifications.map(n => ({
          id: n.id,
          type: n.type,
          timestamp: n.timestamp,
          message: n.message
        }))
      },
      priority: priority,
      category: 'system',
      title: `📊 ${category.toUpperCase()} Digest (${count} notifications)`,
      message: `Summary: ${summary}\n\nLast hour activity in ${category} category.`,
      channels: ['discord', 'email'],
      recipients: ['default'],
      requireConfirmation: false,
      digestible: false,
      status: 'queued',
      attempts: 0,
      maxRetries: this.options.maxRetries,
      scheduledFor: null,
      escalation: false,
      metadata: { isDigest: true, originalCount: count }
    };
  }
  
  /**
   * Start scheduled notification processing
   */
  startScheduledProcessing() {
    setInterval(() => {
      this.processScheduledNotifications();
    }, 30000); // Check every 30 seconds
  }
  
  /**
   * Process scheduled notifications
   */
  processScheduledNotifications() {
    const now = Date.now();
    const toProcess = [];
    
    this.scheduledNotifications.forEach((scheduleInfo, notificationId) => {
      if (scheduleInfo.scheduledFor <= now) {
        toProcess.push(notificationId);
      }
    });
    
    toProcess.forEach(notificationId => {
      const scheduleInfo = this.scheduledNotifications.get(notificationId);
      if (scheduleInfo) {
        // Add to processing queue
        this.notificationQueue.push(scheduleInfo.notification);
        this.pendingNotifications.set(notificationId, scheduleInfo.notification);
        
        // Remove from scheduled
        this.scheduledNotifications.delete(notificationId);
        
        this.emit('scheduledNotificationTriggered', scheduleInfo.notification);
      }
    });
  }
  
  /**
   * Start retry processing
   */
  startRetryProcessing() {
    this.retryInterval = setInterval(() => {
      this.processRetries();
    }, 5000); // Check every 5 seconds
  }
  
  /**
   * Process notification retries
   */
  processRetries() {
    const now = Date.now();
    const toRetry = [];
    
    this.pendingNotifications.forEach((notification, notificationId) => {
      if (notification.nextRetry && notification.nextRetry <= now) {
        toRetry.push(notification);
      }
    });
    
    toRetry.forEach(notification => {
      // Add to processing queue
      this.notificationQueue.push(notification);
      
      this.emit('notificationRetryTriggered', notification);
    });
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
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
    let cleanedCount = 0;
    
    // Cleanup sent notifications
    this.sentNotifications.forEach((sentData, notificationId) => {
      if (sentData.sentAt < cutoff) {
        this.sentNotifications.delete(notificationId);
        cleanedCount++;
      }
    });
    
    // Cleanup failed notifications
    this.failedNotifications.forEach((failData, notificationId) => {
      if (failData.failedAt < cutoff) {
        this.failedNotifications.delete(notificationId);
        cleanedCount++;
      }
    });
    
    // Cleanup scheduled notifications that are too old
    this.scheduledNotifications.forEach((scheduleInfo, notificationId) => {
      if (scheduleInfo.created < cutoff) {
        this.scheduledNotifications.delete(notificationId);
        cleanedCount++;
      }
    });
    
    if (cleanedCount > 0) {
      console.log(`🧹 Notification cleanup: removed ${cleanedCount} old notifications`);
    }
  }
  
  /**
   * Generate unique notification ID
   */
  generateNotificationId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Update user preferences
   */
  updatePreferences(userId, preferences) {
    this.preferences[userId] = {
      ...this.preferences[userId] || this.preferences.default,
      ...preferences
    };
    
    this.emit('preferencesUpdated', { userId, preferences: this.preferences[userId] });
  }
  
  /**
   * Get notification statistics
   */
  getStatistics() {
    return {
      delivery: {
        ...this.deliveryStats,
        successRate: this.deliveryStats.total > 0 ? 
          (this.deliveryStats.successful / this.deliveryStats.total) * 100 : 0,
        byChannel: Object.fromEntries(
          Array.from(this.deliveryStats.byChannel.entries()).map(([channel, stats]) => [
            channel,
            {
              ...stats,
              successRate: stats.total > 0 ? (stats.successful / stats.total) * 100 : 0
            }
          ])
        ),
        byPriority: Object.fromEntries(this.deliveryStats.byPriority),
        byType: Object.fromEntries(this.deliveryStats.byType)
      },
      queue: {
        pending: this.notificationQueue.length,
        processing: this.isProcessing,
        scheduled: this.scheduledNotifications.size,
        digest: Array.from(this.digestQueue.values()).reduce((sum, arr) => sum + arr.length, 0)
      },
      storage: {
        sent: this.sentNotifications.size,
        failed: this.failedNotifications.size,
        pending: this.pendingNotifications.size
      }
    };
  }
  
  /**
   * Get notification history
   */
  getHistory(limit = 100, filter = {}) {
    const history = [];
    
    // Add sent notifications
    this.sentNotifications.forEach(sentData => {
      if (this.matchesFilter(sentData.notification, filter)) {
        history.push({
          ...sentData.notification,
          status: 'sent',
          deliveryResults: sentData.deliveryResults,
          sentAt: sentData.sentAt,
          confirmed: sentData.confirmed || false
        });
      }
    });
    
    // Add failed notifications
    this.failedNotifications.forEach(failData => {
      if (this.matchesFilter(failData.notification, filter)) {
        history.push({
          ...failData.notification,
          status: 'failed',
          deliveryResults: failData.deliveryResults,
          failedAt: failData.failedAt
        });
      }
    });
    
    // Sort by timestamp and limit
    return history
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
  
  /**
   * Check if notification matches filter
   */
  matchesFilter(notification, filter) {
    if (filter.type && notification.type !== filter.type) return false;
    if (filter.priority && notification.priority !== filter.priority) return false;
    if (filter.category && notification.category !== filter.category) return false;
    if (filter.status && notification.status !== filter.status) return false;
    
    if (filter.timeRange) {
      const { start, end } = filter.timeRange;
      if (notification.timestamp < start || notification.timestamp > end) return false;
    }
    
    return true;
  }
  
  /**
   * Cancel scheduled notification
   */
  cancelScheduledNotification(notificationId) {
    const scheduleInfo = this.scheduledNotifications.get(notificationId);
    if (scheduleInfo) {
      this.scheduledNotifications.delete(notificationId);
      this.emit('scheduledNotificationCancelled', scheduleInfo.notification);
      return true;
    }
    return false;
  }
  
  /**
   * Pause notifications for specific recipient
   */
  pauseNotifications(recipient, duration = 3600000) { // 1 hour default
    const resumeTime = Date.now() + duration;
    
    if (!this.preferences[recipient]) {
      this.preferences[recipient] = { ...this.preferences.default };
    }
    
    this.preferences[recipient].paused = true;
    this.preferences[recipient].pausedUntil = resumeTime;
    
    // Setup auto-resume
    setTimeout(() => {
      if (this.preferences[recipient]) {
        this.preferences[recipient].paused = false;
        delete this.preferences[recipient].pausedUntil;
        
        this.emit('notificationsResumed', { recipient });
      }
    }, duration);
    
    this.emit('notificationsPaused', { recipient, resumeTime });
  }
  
  /**
   * Resume notifications for recipient
   */
  resumeNotifications(recipient) {
    if (this.preferences[recipient]) {
      this.preferences[recipient].paused = false;
      delete this.preferences[recipient].pausedUntil;
      
      this.emit('notificationsResumed', { recipient });
      return true;
    }
    return false;
  }
  
  /**
   * Shutdown notification manager
   */
  async shutdown() {
    console.log('🛑 Shutting down Notification Manager...');
    
    // Clear intervals
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    if (this.digestInterval) {
      clearInterval(this.digestInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
    }
    
    // Process remaining notifications
    if (this.notificationQueue.length > 0) {
      console.log(`📤 Processing ${this.notificationQueue.length} remaining notifications...`);
      await this.processNotificationQueue();
    }
    
    this.isInitialized = false;
    this.emit('shutdown');
    
    console.log('✅ Notification Manager shutdown complete');
  }
}

export default NotificationManager;