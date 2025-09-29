import { EventEmitter } from 'events';
import axios from 'axios';

/**
 * AlertManager - Multi-channel notification system
 * Manages alerts for opportunities, system events, and performance monitoring
 */
class AlertManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      enableDiscord: options.enableDiscord !== false,
      enableTelegram: options.enableTelegram !== false,
      enableEmail: options.enableEmail !== false,
      enableSlack: options.enableSlack !== false,
      enableWebhooks: options.enableWebhooks !== false,
      
      // Rate limiting
      rateLimitWindow: options.rateLimitWindow || 60000, // 1 minute
      maxAlertsPerWindow: options.maxAlertsPerWindow || 50,
      
      // Alert throttling
      throttleEnabled: options.throttleEnabled !== false,
      throttleWindow: options.throttleWindow || 30000, // 30 seconds
      maxDuplicateAlerts: options.maxDuplicateAlerts || 3,
      
      // Priority levels
      priorityLevels: ['low', 'medium', 'high', 'critical'],
      defaultPriority: options.defaultPriority || 'medium',
      
      // Retry configuration
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      
      ...options
    };
    
    // Channel configurations
    this.channels = {
      discord: {
        enabled: this.options.enableDiscord,
        webhookUrl: options.discordWebhook,
        rateLimitPerMinute: 30,
        supportedFormats: ['text', 'embed', 'file']
      },
      telegram: {
        enabled: this.options.enableTelegram,
        botToken: options.telegramBotToken,
        chatIds: options.telegramChatIds || [],
        rateLimitPerMinute: 20,
        supportedFormats: ['text', 'markdown', 'html']
      },
      email: {
        enabled: this.options.enableEmail,
        smtpConfig: options.smtpConfig,
        recipients: options.emailRecipients || [],
        rateLimitPerMinute: 10,
        supportedFormats: ['text', 'html']
      },
      slack: {
        enabled: this.options.enableSlack,
        webhookUrl: options.slackWebhook,
        channel: options.slackChannel || '#alerts',
        rateLimitPerMinute: 30,
        supportedFormats: ['text', 'blocks', 'attachments']
      },
      webhooks: {
        enabled: this.options.enableWebhooks,
        endpoints: options.webhookEndpoints || [],
        rateLimitPerMinute: 100,
        supportedFormats: ['json']
      }
    };
    
    // Alert tracking
    this.alertHistory = [];
    this.alertQueue = [];
    this.duplicateTracker = new Map();
    this.rateLimitTracker = new Map();
    
    // Performance metrics
    this.metrics = {
      totalAlerts: 0,
      successfulAlerts: 0,
      failedAlerts: 0,
      throttledAlerts: 0,
      rateLimitedAlerts: 0,
      averageDeliveryTime: 0,
      lastUpdate: null,
      channelStats: {}
    };
    
    // Alert templates
    this.templates = {
      opportunity: {
        title: '🎯 Arbitrage Opportunity Detected',
        fields: ['type', 'symbol', 'profit', 'confidence', 'risk'],
        priority: 'high',
        channels: ['discord', 'telegram']
      },
      execution: {
        title: '⚡ Trade Executed',
        fields: ['type', 'symbol', 'profit', 'status'],
        priority: 'high',
        channels: ['discord', 'telegram', 'slack']
      },
      error: {
        title: '❌ System Error',
        fields: ['service', 'error', 'timestamp'],
        priority: 'critical',
        channels: ['discord', 'slack', 'email']
      },
      performance: {
        title: '📊 Performance Alert',
        fields: ['metric', 'value', 'threshold'],
        priority: 'medium',
        channels: ['slack']
      },
      mev: {
        title: '🚨 MEV Opportunity',
        fields: ['type', 'estimatedProfit', 'risk'],
        priority: 'critical',
        channels: ['discord', 'telegram']
      }
    };
    
    this.isActive = false;
    this.processingTimer = null;
  }
  
  /**
   * Initialize the alert manager
   */
  async initialize() {
    try {
      console.log('🚨 Initializing AlertManager...');
      
      // Initialize channels
      await this.initializeChannels();
      
      // Start alert processor
      this.startAlertProcessor();
      
      // Initialize metrics tracking
      this.initializeMetrics();
      
      this.isActive = true;
      console.log('✅ AlertManager initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize AlertManager:', error);
      throw error;
    }
  }
  
  /**
   * Initialize notification channels
   */
  async initializeChannels() {
    const enabledChannels = [];
    
    for (const [channelName, config] of Object.entries(this.channels)) {
      if (config.enabled) {
        try {
          await this.testChannel(channelName);
          enabledChannels.push(channelName);
          console.log(`  ✅ ${channelName} channel initialized`);
        } catch (error) {
          console.warn(`  ⚠️ ${channelName} channel failed to initialize:`, error.message);
          config.enabled = false;
        }
      }
    }
    
    if (enabledChannels.length === 0) {
      console.warn('⚠️ No notification channels are enabled');
    } else {
      console.log(`📡 Initialized ${enabledChannels.length} notification channels`);
    }
  }
  
  /**
   * Test channel connectivity
   */
  async testChannel(channelName) {
    const config = this.channels[channelName];
    
    switch (channelName) {
      case 'discord':
        if (!config.webhookUrl) {
          throw new Error('Discord webhook URL not configured');
        }
        break;
        
      case 'telegram':
        if (!config.botToken || config.chatIds.length === 0) {
          throw new Error('Telegram bot token or chat IDs not configured');
        }
        break;
        
      case 'email':
        if (!config.smtpConfig || config.recipients.length === 0) {
          throw new Error('Email SMTP config or recipients not configured');
        }
        break;
        
      case 'slack':
        if (!config.webhookUrl) {
          throw new Error('Slack webhook URL not configured');
        }
        break;
        
      case 'webhooks':
        if (config.endpoints.length === 0) {
          throw new Error('No webhook endpoints configured');
        }
        break;
    }
  }
  
  /**
   * Initialize metrics tracking
   */
  initializeMetrics() {
    for (const channelName of Object.keys(this.channels)) {
      this.metrics.channelStats[channelName] = {
        sent: 0,
        successful: 0,
        failed: 0,
        averageLatency: 0
      };
    }
  }
  
  /**
   * Send alert through multiple channels
   */
  async sendAlert(alertType, data, options = {}) {
    const startTime = Date.now();
    
    try {
      // Get alert template
      const template = this.templates[alertType];
      if (!template) {
        throw new Error(`Unknown alert type: ${alertType}`);
      }
      
      // Create alert context
      const alert = {
        id: this.generateAlertId(),
        type: alertType,
        data,
        template,
        priority: options.priority || template.priority,
        channels: options.channels || template.channels,
        timestamp: Date.now(),
        attempts: 0
      };
      
      // Check rate limiting
      if (!this.checkRateLimit()) {
        this.metrics.rateLimitedAlerts++;
        console.warn('Alert rate limit exceeded, queuing alert');
        this.alertQueue.push(alert);
        return { success: false, reason: 'rate_limited' };
      }
      
      // Check for duplicate alerts
      if (this.options.throttleEnabled && this.isDuplicateAlert(alert)) {
        this.metrics.throttledAlerts++;
        console.log(`Throttling duplicate alert: ${alert.type}`);
        return { success: false, reason: 'throttled' };
      }
      
      // Process alert
      const result = await this.processAlert(alert);
      
      // Update metrics
      this.updateMetrics(alert, result, Date.now() - startTime);
      
      return result;
      
    } catch (error) {
      console.error('Error sending alert:', error);
      this.metrics.failedAlerts++;
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Process alert through selected channels
   */
  async processAlert(alert) {
    const results = {};
    const promises = [];
    
    for (const channelName of alert.channels) {
      const channelConfig = this.channels[channelName];
      
      if (!channelConfig || !channelConfig.enabled) {
        results[channelName] = { success: false, reason: 'channel_disabled' };
        continue;
      }
      
      promises.push(
        this.sendToChannel(channelName, alert)
          .then(result => {
            results[channelName] = result;
          })
          .catch(error => {
            results[channelName] = { success: false, error: error.message };
          })
      );
    }
    
    await Promise.allSettled(promises);
    
    // Determine overall success
    const successful = Object.values(results).filter(r => r.success).length;
    const total = Object.keys(results).length;
    
    // Track alert
    this.trackAlert(alert, results);
    
    return {
      success: successful > 0,
      channels: results,
      successRate: total > 0 ? (successful / total) * 100 : 0
    };
  }
  
  /**
   * Send alert to specific channel
   */
  async sendToChannel(channelName, alert) {
    const startTime = Date.now();
    
    try {
      let result;
      
      switch (channelName) {
        case 'discord':
          result = await this.sendDiscordAlert(alert);
          break;
        case 'telegram':
          result = await this.sendTelegramAlert(alert);
          break;
        case 'email':
          result = await this.sendEmailAlert(alert);
          break;
        case 'slack':
          result = await this.sendSlackAlert(alert);
          break;
        case 'webhooks':
          result = await this.sendWebhookAlert(alert);
          break;
        default:
          throw new Error(`Unsupported channel: ${channelName}`);
      }
      
      // Update channel metrics
      const latency = Date.now() - startTime;
      this.updateChannelMetrics(channelName, true, latency);
      
      return { success: true, latency };
      
    } catch (error) {
      this.updateChannelMetrics(channelName, false, Date.now() - startTime);
      throw error;
    }
  }
  
  /**
   * Send Discord alert
   */
  async sendDiscordAlert(alert) {
    const webhook = this.channels.discord.webhookUrl;
    if (!webhook) {
      throw new Error('Discord webhook not configured');
    }
    
    const embed = this.createDiscordEmbed(alert);
    
    const response = await axios.post(webhook, {
      embeds: [embed]
    });
    
    if (response.status !== 204) {
      throw new Error(`Discord API error: ${response.status}`);
    }
    
    return response.data;
  }
  
  /**
   * Create Discord embed
   */
  createDiscordEmbed(alert) {
    const colors = {
      low: 0x95a5a6,      // Gray
      medium: 0xf39c12,   // Orange
      high: 0xe74c3c,     // Red
      critical: 0x9b59b6  // Purple
    };
    
    const embed = {
      title: alert.template.title,
      color: colors[alert.priority] || colors.medium,
      timestamp: new Date(alert.timestamp).toISOString(),
      fields: []
    };
    
    // Add data fields
    for (const field of alert.template.fields) {
      if (alert.data[field] !== undefined) {
        embed.fields.push({
          name: this.capitalizeFirst(field),
          value: this.formatValue(alert.data[field]),
          inline: true
        });
      }
    }
    
    // Add footer
    embed.footer = {
      text: `Alert ID: ${alert.id} | Priority: ${alert.priority.toUpperCase()}`
    };
    
    return embed;
  }
  
  /**
   * Send Telegram alert
   */
  async sendTelegramAlert(alert) {
    const config = this.channels.telegram;
    if (!config.botToken || config.chatIds.length === 0) {
      throw new Error('Telegram not configured');
    }
    
    const message = this.createTelegramMessage(alert);
    
    const promises = config.chatIds.map(chatId => {
      const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
      
      return axios.post(url, {
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });
    });
    
    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    
    if (successful === 0) {
      throw new Error('All Telegram messages failed');
    }
    
    return { sent: successful, total: config.chatIds.length };
  }
  
  /**
   * Create Telegram message
   */
  createTelegramMessage(alert) {
    let message = `*${alert.template.title}*\n\n`;
    
    for (const field of alert.template.fields) {
      if (alert.data[field] !== undefined) {
        message += `*${this.capitalizeFirst(field)}:* ${this.formatValue(alert.data[field])}\n`;
      }
    }
    
    message += `\n_Priority:_ ${alert.priority.toUpperCase()}`;
    message += `\n_Time:_ ${new Date(alert.timestamp).toLocaleString()}`;
    message += `\n_Alert ID:_ \`${alert.id}\``;
    
    return message;
  }
  
  /**
   * Send Email alert
   */
  async sendEmailAlert(alert) {
    // Email implementation would require nodemailer or similar
    console.log('Email alert (mock):', alert.template.title);
    return { success: true, mock: true };
  }
  
  /**
   * Send Slack alert
   */
  async sendSlackAlert(alert) {
    const webhook = this.channels.slack.webhookUrl;
    if (!webhook) {
      throw new Error('Slack webhook not configured');
    }
    
    const payload = this.createSlackPayload(alert);
    
    const response = await axios.post(webhook, payload);
    
    if (response.status !== 200) {
      throw new Error(`Slack API error: ${response.status}`);
    }
    
    return response.data;
  }
  
  /**
   * Create Slack payload
   */
  createSlackPayload(alert) {
    const colors = {
      low: '#95a5a6',
      medium: '#f39c12',
      high: '#e74c3c',
      critical: '#9b59b6'
    };
    
    const fields = alert.template.fields.map(field => {
      if (alert.data[field] !== undefined) {
        return {
          title: this.capitalizeFirst(field),
          value: this.formatValue(alert.data[field]),
          short: true
        };
      }
      return null;
    }).filter(Boolean);
    
    return {
      channel: this.channels.slack.channel,
      attachments: [{
        color: colors[alert.priority] || colors.medium,
        title: alert.template.title,
        fields,
        footer: `Alert ID: ${alert.id}`,
        ts: Math.floor(alert.timestamp / 1000)
      }]
    };
  }
  
  /**
   * Send Webhook alert
   */
  async sendWebhookAlert(alert) {
    const endpoints = this.channels.webhooks.endpoints;
    if (endpoints.length === 0) {
      throw new Error('No webhook endpoints configured');
    }
    
    const payload = {
      alertId: alert.id,
      type: alert.type,
      priority: alert.priority,
      timestamp: alert.timestamp,
      data: alert.data
    };
    
    const promises = endpoints.map(endpoint => {
      return axios.post(endpoint.url, payload, {
        headers: endpoint.headers || {}
      });
    });
    
    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    
    if (successful === 0) {
      throw new Error('All webhook calls failed');
    }
    
    return { sent: successful, total: endpoints.length };
  }
  
  /**
   * Check rate limiting
   */
  checkRateLimit() {
    const now = Date.now();
    const windowStart = now - this.options.rateLimitWindow;
    
    // Clean old entries
    this.rateLimitTracker = new Map(
      Array.from(this.rateLimitTracker.entries())
        .filter(([timestamp]) => timestamp > windowStart)
    );
    
    // Check if under limit
    if (this.rateLimitTracker.size >= this.options.maxAlertsPerWindow) {
      return false;
    }
    
    // Add current timestamp
    this.rateLimitTracker.set(now, true);
    return true;
  }
  
  /**
   * Check for duplicate alerts
   */
  isDuplicateAlert(alert) {
    const key = `${alert.type}-${JSON.stringify(alert.data)}`;
    const now = Date.now();
    const windowStart = now - this.options.throttleWindow;
    
    // Clean old entries
    for (const [trackKey, timestamps] of this.duplicateTracker) {
      const validTimestamps = timestamps.filter(ts => ts > windowStart);
      if (validTimestamps.length === 0) {
        this.duplicateTracker.delete(trackKey);
      } else {
        this.duplicateTracker.set(trackKey, validTimestamps);
      }
    }
    
    // Check duplicates
    const existing = this.duplicateTracker.get(key) || [];
    if (existing.length >= this.options.maxDuplicateAlerts) {
      return true;
    }
    
    // Add current timestamp
    existing.push(now);
    this.duplicateTracker.set(key, existing);
    
    return false;
  }
  
  /**
   * Track alert in history
   */
  trackAlert(alert, results) {
    this.alertHistory.push({
      ...alert,
      results,
      processedAt: Date.now()
    });
    
    // Limit history size
    if (this.alertHistory.length > 1000) {
      this.alertHistory.shift();
    }
  }
  
  /**
   * Update metrics
   */
  updateMetrics(alert, result, deliveryTime) {
    this.metrics.totalAlerts++;
    
    if (result.success) {
      this.metrics.successfulAlerts++;
    } else {
      this.metrics.failedAlerts++;
    }
    
    this.metrics.averageDeliveryTime = 
      (this.metrics.averageDeliveryTime + deliveryTime) / 2;
    
    this.metrics.lastUpdate = Date.now();
  }
  
  /**
   * Update channel-specific metrics
   */
  updateChannelMetrics(channelName, success, latency) {
    const stats = this.metrics.channelStats[channelName];
    if (!stats) return;
    
    stats.sent++;
    
    if (success) {
      stats.successful++;
    } else {
      stats.failed++;
    }
    
    stats.averageLatency = (stats.averageLatency + latency) / 2;
  }
  
  /**
   * Start alert processor for queued alerts
   */
  startAlertProcessor() {
    this.processingTimer = setInterval(() => {
      this.processAlertQueue();
    }, 5000); // Process every 5 seconds
    
    console.log('⏰ Alert processor started');
  }
  
  /**
   * Process queued alerts
   */
  async processAlertQueue() {
    if (this.alertQueue.length === 0) return;
    
    const alert = this.alertQueue.shift();
    
    try {
      await this.processAlert(alert);
    } catch (error) {
      console.error('Error processing queued alert:', error);
      
      // Retry logic
      alert.attempts++;
      if (alert.attempts < this.options.maxRetries) {
        setTimeout(() => {
          this.alertQueue.push(alert);
        }, this.options.retryDelay * alert.attempts);
      }
    }
  }
  
  /**
   * Generate unique alert ID
   */
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Format value for display
   */
  formatValue(value) {
    if (typeof value === 'number') {
      if (value > 1000000) {
        return `${(value / 1000000).toFixed(2)}M`;
      } else if (value > 1000) {
        return `${(value / 1000).toFixed(2)}K`;
      } else if (value < 1 && value > 0) {
        return `${(value * 100).toFixed(2)}%`;
      }
      return value.toFixed(4);
    }
    
    if (typeof value === 'string' && value.length > 50) {
      return value.substring(0, 47) + '...';
    }
    
    return String(value);
  }
  
  /**
   * Capitalize first letter
   */
  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/([A-Z])/g, ' $1');
  }
  
  /**
   * Get alert statistics
   */
  getStats() {
    const successRate = this.metrics.totalAlerts > 0 ?
      (this.metrics.successfulAlerts / this.metrics.totalAlerts) * 100 : 0;
    
    return {
      ...this.metrics,
      successRate: Math.round(successRate * 100) / 100,
      queueSize: this.alertQueue.length,
      duplicateTrackerSize: this.duplicateTracker.size,
      rateLimitTrackerSize: this.rateLimitTracker.size,
      enabledChannels: Object.entries(this.channels)
        .filter(([, config]) => config.enabled)
        .map(([name]) => name)
    };
  }
  
  /**
   * Get alert history
   */
  getHistory(limit = 50) {
    return this.alertHistory
      .slice(-limit)
      .map(alert => ({
        id: alert.id,
        type: alert.type,
        priority: alert.priority,
        timestamp: alert.timestamp,
        success: alert.results ? Object.values(alert.results).some(r => r.success) : false,
        channels: alert.channels
      }));
  }
  
  /**
   * Test all channels
   */
  async testAllChannels() {
    const testAlert = {
      id: 'test_' + Date.now(),
      type: 'test',
      data: {
        message: 'This is a test alert',
        timestamp: new Date().toISOString()
      },
      template: {
        title: '🧪 Test Alert',
        fields: ['message', 'timestamp']
      },
      priority: 'low',
      channels: Object.keys(this.channels).filter(name => this.channels[name].enabled),
      timestamp: Date.now()
    };
    
    return await this.processAlert(testAlert);
  }
  
  /**
   * Stop the alert manager
   */
  async stop() {
    console.log('🛑 Stopping AlertManager...');
    
    this.isActive = false;
    
    // Stop processing timer
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
    }
    
    // Process remaining queued alerts
    while (this.alertQueue.length > 0) {
      const alert = this.alertQueue.shift();
      try {
        await this.processAlert(alert);
      } catch (error) {
        console.error('Error processing final alert:', error);
      }
    }
    
    console.log('✅ AlertManager stopped');
  }
}

export default AlertManager;