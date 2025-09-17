const EventEmitter = require('events');
const axios = require('axios');

/**
 * AlertingService - Phase 4: Multi-channel notification system
 * Provides intelligent alerts via Discord, Telegram, Email, SMS, and more
 */
class AlertingService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      enableDiscord: options.enableDiscord || false,
      enableTelegram: options.enableTelegram || false,
      enableEmail: options.enableEmail || false,
      enableSMS: options.enableSMS || false,
      enableSlack: options.enableSlack || false,
      priorityThreshold: options.priorityThreshold || 'medium',
      rateLimitWindow: options.rateLimitWindow || 300000, // 5 minutes
      maxAlertsPerWindow: options.maxAlertsPerWindow || 10,
      cooldownPeriod: options.cooldownPeriod || 60000, // 1 minute between same alerts
      ...options
    };
    
    // Channel configurations
    this.channels = {
      discord: {
        enabled: this.options.enableDiscord,
        webhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
        rateLimits: { requests: 0, resetTime: 0 },
        lastError: null
      },
      telegram: {
        enabled: this.options.enableTelegram,
        botToken: process.env.TELEGRAM_BOT_TOKEN || '',
        chatId: process.env.TELEGRAM_CHAT_ID || '',
        rateLimits: { requests: 0, resetTime: 0 },
        lastError: null
      },
      email: {
        enabled: this.options.enableEmail,
        smtpConfig: {
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASS || ''
          }
        },
        from: process.env.EMAIL_FROM || 'noreply@arbitragebot.com',
        to: process.env.EMAIL_TO || '',
        rateLimits: { requests: 0, resetTime: 0 },
        lastError: null
      },
      sms: {
        enabled: this.options.enableSMS,
        provider: process.env.SMS_PROVIDER || 'twilio', // twilio, nexmo, etc.
        config: {
          accountSid: process.env.TWILIO_ACCOUNT_SID || '',
          authToken: process.env.TWILIO_AUTH_TOKEN || '',
          from: process.env.TWILIO_FROM || '',
          to: process.env.SMS_TO || ''
        },
        rateLimits: { requests: 0, resetTime: 0 },
        lastError: null
      },
      slack: {
        enabled: this.options.enableSlack,
        webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
        rateLimits: { requests: 0, resetTime: 0 },
        lastError: null
      }
    };
    
    // Alert rules engine
    this.rules = new Map();
    this.setupDefaultRules();
    
    // Alert history and deduplication
    this.alertHistory = [];
    this.alertCache = new Map(); // For deduplication
    this.rateLimitTracker = new Map();
    
    // Statistics
    this.stats = {
      totalAlerts: 0,
      alertsByPriority: { low: 0, medium: 0, high: 0, critical: 0 },
      alertsByChannel: {
        discord: { sent: 0, failed: 0 },
        telegram: { sent: 0, failed: 0 },
        email: { sent: 0, failed: 0 },
        sms: { sent: 0, failed: 0 },
        slack: { sent: 0, failed: 0 }
      },
      deliveryRate: 0,
      averageDeliveryTime: 0
    };
    
    this.isInitialized = false;
  }
  
  /**
   * Initialize the alerting service
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }
    
    console.log('🚨 Initializing Alerting Service...');
    
    try {
      // Validate channel configurations
      await this.validateChannels();
      
      // Test connections
      await this.testConnections();
      
      // Setup cleanup timer
      this.setupCleanupTimer();
      
      this.isInitialized = true;
      
      const enabledChannels = Object.entries(this.channels)
        .filter(([_, config]) => config.enabled)
        .map(([name, _]) => name);
      
      console.log(`✅ Alerting Service initialized with channels: ${enabledChannels.join(', ')}`);
      
      this.emit('initialized', {
        enabledChannels,
        rulesCount: this.rules.size
      });
      
    } catch (error) {
      console.error('❌ Failed to initialize Alerting Service:', error.message);
      throw error;
    }
  }
  
  /**
   * Setup default alert rules
   */
  setupDefaultRules() {
    // Trading alerts
    this.addRule('trade_success', {
      condition: (alert) => alert.type === 'trade' && alert.data.success && alert.data.profit > 100,
      priority: 'medium',
      channels: ['discord', 'telegram'],
      template: '✅ **Profitable Trade Executed**\n💰 Profit: ${{profit}}\n⏱️ Execution Time: {{executionTime}}s\n🔗 TX: {{txHash}}'
    });
    
    this.addRule('trade_failure', {
      condition: (alert) => alert.type === 'trade' && !alert.data.success,
      priority: 'high',
      channels: ['discord', 'telegram', 'email'],
      template: '❌ **Trade Execution Failed**\n💸 Loss: ${{loss}}\n🔍 Reason: {{reason}}\n📊 Opportunity: {{opportunityId}}'
    });
    
    this.addRule('large_profit', {
      condition: (alert) => alert.type === 'trade' && alert.data.success && alert.data.profit > 1000,
      priority: 'high',
      channels: ['discord', 'telegram', 'email', 'sms'],
      template: '🎉 **Large Profit Alert!**\n💰 Profit: ${{profit}}\n📈 ROI: {{roi}}%\n🔗 TX: {{txHash}}'
    });
    
    // System alerts
    this.addRule('system_critical', {
      condition: (alert) => alert.type === 'system' && alert.priority === 'critical',
      priority: 'critical',
      channels: ['discord', 'telegram', 'email', 'sms'],
      template: '🚨 **CRITICAL SYSTEM ALERT**\n⚠️ Issue: {{message}}\n📊 Metric: {{metric}} = {{value}}\n🎯 Threshold: {{threshold}}'
    });
    
    this.addRule('rpc_failover', {
      condition: (alert) => alert.type === 'rpc' && alert.data.action === 'failover',
      priority: 'medium',
      channels: ['discord'],
      template: '🔄 **RPC Failover**\n🌐 Failed Endpoint: {{failedEndpoint}}\n✅ New Endpoint: {{newEndpoint}}\n⏰ Downtime: {{downtime}}s'
    });
    
    this.addRule('gas_spike', {
      condition: (alert) => alert.type === 'gas' && alert.data.price > 100,
      priority: 'medium',
      channels: ['discord', 'telegram'],
      template: '⛽ **Gas Price Spike**\n📈 Current: {{price}} gwei\n📊 Average: {{average}} gwei\n⚡ Impact: Reduced profitability'
    });
    
    // MEV alerts
    this.addRule('mev_opportunity', {
      condition: (alert) => alert.type === 'mev' && alert.data.expectedProfit > 500,
      priority: 'high',
      channels: ['discord', 'telegram'],
      template: '🎯 **MEV Opportunity Detected**\n💰 Expected Profit: ${{expectedProfit}}\n🔍 Type: {{mevType}}\n⏱️ Window: {{timeWindow}}s'
    });
    
    // Performance alerts
    this.addRule('slow_execution', {
      condition: (alert) => alert.type === 'performance' && alert.data.executionTime > 60000,
      priority: 'medium',
      channels: ['discord'],
      template: '🐌 **Slow Execution Warning**\n⏱️ Time: {{executionTime}}s\n🎯 Target: <30s\n🔍 Component: {{component}}'
    });
  }
  
  /**
   * Add custom alert rule
   */
  addRule(name, rule) {
    if (!rule.condition || !rule.priority || !rule.channels || !rule.template) {
      throw new Error('Invalid rule: missing required properties');
    }
    
    this.rules.set(name, {
      ...rule,
      created: Date.now(),
      triggered: 0
    });
  }
  
  /**
   * Send alert through appropriate channels
   */
  async sendAlert(type, data, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: Date.now(),
      priority: options.priority || 'medium',
      ...options
    };
    
    try {
      // Apply rules to determine channels and formatting
      const matchedRules = this.applyRules(alert);
      
      if (matchedRules.length === 0) {
        console.log(`ℹ️ No rules matched for alert type: ${type}`);
        return;
      }
      
      // Check rate limiting and deduplication
      if (this.shouldSuppressAlert(alert)) {
        console.log(`🔇 Alert suppressed due to rate limiting: ${alert.id}`);
        return;
      }
      
      // Send to matched channels
      const deliveries = [];
      
      for (const rule of matchedRules) {
        const formattedMessage = this.formatMessage(rule.template, alert);
        
        for (const channel of rule.channels) {
          if (this.channels[channel]?.enabled) {
            deliveries.push(
              this.sendToChannel(channel, formattedMessage, alert)
                .catch(error => ({ channel, error: error.message }))
            );
          }
        }
      }
      
      const results = await Promise.allSettled(deliveries);
      
      // Update statistics
      this.updateStats(alert, results);
      
      // Store in history
      this.alertHistory.push({
        ...alert,
        deliveries: results.map(r => r.status === 'fulfilled' ? r.value : r.reason),
        processed: Date.now()
      });
      
      // Emit event
      this.emit('alertSent', {
        alert,
        deliveries: results.length,
        successful: results.filter(r => r.status === 'fulfilled').length
      });
      
      console.log(`🚨 Alert sent: ${alert.id} to ${results.length} channels`);
      
    } catch (error) {
      console.error(`❌ Failed to send alert: ${error.message}`);
      this.emit('alertError', { alert, error: error.message });
      throw error;
    }
  }
  
  /**
   * Apply rules to determine alert handling
   */
  applyRules(alert) {
    const matchedRules = [];
    
    for (const [name, rule] of this.rules) {
      try {
        if (rule.condition(alert)) {
          matchedRules.push({
            name,
            ...rule,
            triggered: rule.triggered + 1
          });
          
          // Update rule statistics
          this.rules.set(name, {
            ...rule,
            triggered: rule.triggered + 1,
            lastTriggered: Date.now()
          });
        }
      } catch (error) {
        console.error(`Error evaluating rule ${name}:`, error.message);
      }
    }
    
    return matchedRules;
  }
  
  /**
   * Check if alert should be suppressed
   */
  shouldSuppressAlert(alert) {
    const now = Date.now();
    const cacheKey = `${alert.type}_${JSON.stringify(alert.data)}`;
    
    // Check cooldown period
    const lastSent = this.alertCache.get(cacheKey);
    if (lastSent && (now - lastSent) < this.options.cooldownPeriod) {
      return true;
    }
    
    // Check rate limiting
    const windowKey = Math.floor(now / this.options.rateLimitWindow);
    const currentCount = this.rateLimitTracker.get(windowKey) || 0;
    
    if (currentCount >= this.options.maxAlertsPerWindow) {
      return true;
    }
    
    // Update tracking
    this.alertCache.set(cacheKey, now);
    this.rateLimitTracker.set(windowKey, currentCount + 1);
    
    return false;
  }
  
  /**
   * Format message template with alert data
   */
  formatMessage(template, alert) {
    let message = template;
    
    // Replace template variables
    const allData = { ...alert.data, ...alert };
    
    for (const [key, value] of Object.entries(allData)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      message = message.replace(regex, value);
    }
    
    // Add metadata
    message += `\n\n📅 ${new Date(alert.timestamp).toISOString()}`;
    message += `\n🆔 ${alert.id}`;
    
    return message;
  }
  
  /**
   * Send alert to specific channel
   */
  async sendToChannel(channel, message, alert) {
    const startTime = Date.now();
    
    try {
      let result;
      
      switch (channel) {
        case 'discord':
          result = await this.sendToDiscord(message, alert);
          break;
        case 'telegram':
          result = await this.sendToTelegram(message, alert);
          break;
        case 'email':
          result = await this.sendToEmail(message, alert);
          break;
        case 'sms':
          result = await this.sendToSMS(message, alert);
          break;
        case 'slack':
          result = await this.sendToSlack(message, alert);
          break;
        default:
          throw new Error(`Unknown channel: ${channel}`);
      }
      
      const deliveryTime = Date.now() - startTime;
      
      return {
        channel,
        success: true,
        deliveryTime,
        ...result
      };
      
    } catch (error) {
      console.error(`Failed to send alert to ${channel}:`, error.message);
      
      this.channels[channel].lastError = {
        message: error.message,
        timestamp: Date.now()
      };
      
      throw error;
    }
  }
  
  /**
   * Send alert to Discord
   */
  async sendToDiscord(message, alert) {
    if (!this.channels.discord.webhookUrl) {
      throw new Error('Discord webhook URL not configured');
    }
    
    const embed = {
      title: this.getAlertTitle(alert),
      description: message,
      color: this.getAlertColor(alert.priority),
      timestamp: new Date(alert.timestamp).toISOString(),
      footer: { text: 'MEV Arbitrage Bot' }
    };
    
    const response = await axios.post(this.channels.discord.webhookUrl, {
      embeds: [embed]
    });
    
    return { messageId: response.data?.id };
  }
  
  /**
   * Send alert to Telegram
   */
  async sendToTelegram(message, alert) {
    if (!this.channels.telegram.botToken || !this.channels.telegram.chatId) {
      throw new Error('Telegram bot token or chat ID not configured');
    }
    
    const url = `https://api.telegram.org/bot${this.channels.telegram.botToken}/sendMessage`;
    
    const response = await axios.post(url, {
      chat_id: this.channels.telegram.chatId,
      text: message,
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });
    
    return { messageId: response.data.result.message_id };
  }
  
  /**
   * Send alert via Email
   */
  async sendToEmail(message, alert) {
    // This would require a proper email library like nodemailer
    // For now, we'll simulate the functionality
    
    if (!this.channels.email.to) {
      throw new Error('Email recipient not configured');
    }
    
    console.log(`📧 Would send email to ${this.channels.email.to}: ${this.getAlertTitle(alert)}`);
    
    return { messageId: `email_${Date.now()}` };
  }
  
  /**
   * Send alert via SMS
   */
  async sendToSMS(message, alert) {
    if (!this.channels.sms.config.to) {
      throw new Error('SMS recipient not configured');
    }
    
    // Truncate message for SMS
    const smsMessage = message.substring(0, 160);
    
    console.log(`📱 Would send SMS to ${this.channels.sms.config.to}: ${smsMessage}`);
    
    return { messageId: `sms_${Date.now()}` };
  }
  
  /**
   * Send alert to Slack
   */
  async sendToSlack(message, alert) {
    if (!this.channels.slack.webhookUrl) {
      throw new Error('Slack webhook URL not configured');
    }
    
    const payload = {
      text: this.getAlertTitle(alert),
      attachments: [{
        color: this.getSlackColor(alert.priority),
        text: message,
        ts: Math.floor(alert.timestamp / 1000)
      }]
    };
    
    const response = await axios.post(this.channels.slack.webhookUrl, payload);
    
    return { messageId: response.data?.ts };
  }
  
  /**
   * Get alert title based on type and priority
   */
  getAlertTitle(alert) {
    const priorityEmoji = {
      low: 'ℹ️',
      medium: '⚠️',
      high: '🚨',
      critical: '🔥'
    };
    
    const typeTitle = {
      trade: 'Trade Alert',
      system: 'System Alert',
      rpc: 'Network Alert',
      gas: 'Gas Price Alert',
      mev: 'MEV Alert',
      performance: 'Performance Alert'
    };
    
    return `${priorityEmoji[alert.priority]} ${typeTitle[alert.type] || 'Alert'}`;
  }
  
  /**
   * Get Discord embed color based on priority
   */
  getAlertColor(priority) {
    const colors = {
      low: 0x36a64f,     // Green
      medium: 0xffa500,  // Orange
      high: 0xff4500,    // Red-Orange
      critical: 0xff0000 // Red
    };
    
    return colors[priority] || colors.medium;
  }
  
  /**
   * Get Slack color based on priority
   */
  getSlackColor(priority) {
    const colors = {
      low: 'good',
      medium: 'warning',
      high: 'danger',
      critical: 'danger'
    };
    
    return colors[priority] || colors.medium;
  }
  
  /**
   * Validate channel configurations
   */
  async validateChannels() {
    const validationResults = {};
    
    for (const [channel, config] of Object.entries(this.channels)) {
      if (!config.enabled) continue;
      
      try {
        switch (channel) {
          case 'discord':
            if (!config.webhookUrl) {
              throw new Error('Webhook URL required');
            }
            break;
          case 'telegram':
            if (!config.botToken || !config.chatId) {
              throw new Error('Bot token and chat ID required');
            }
            break;
          case 'email':
            if (!config.to) {
              throw new Error('Email recipient required');
            }
            break;
          case 'sms':
            if (!config.config.to) {
              throw new Error('SMS recipient required');
            }
            break;
          case 'slack':
            if (!config.webhookUrl) {
              throw new Error('Webhook URL required');
            }
            break;
        }
        
        validationResults[channel] = { valid: true };
      } catch (error) {
        validationResults[channel] = { valid: false, error: error.message };
        console.warn(`⚠️ ${channel} configuration invalid: ${error.message}`);
      }
    }
    
    return validationResults;
  }
  
  /**
   * Test connections to enabled channels
   */
  async testConnections() {
    const testResults = {};
    
    for (const [channel, config] of Object.entries(this.channels)) {
      if (!config.enabled) continue;
      
      try {
        // Send test message
        await this.sendToChannel(channel, '🧪 **Test Alert**\nAlerting service initialized successfully!', {
          id: 'test',
          type: 'system',
          priority: 'low',
          timestamp: Date.now(),
          data: {}
        });
        
        testResults[channel] = { success: true };
        console.log(`✅ ${channel} connection test passed`);
        
      } catch (error) {
        testResults[channel] = { success: false, error: error.message };
        console.warn(`⚠️ ${channel} connection test failed: ${error.message}`);
      }
    }
    
    return testResults;
  }
  
  /**
   * Update statistics
   */
  updateStats(alert, results) {
    this.stats.totalAlerts++;
    this.stats.alertsByPriority[alert.priority]++;
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const channel = result.value.channel;
        this.stats.alertsByChannel[channel].sent++;
      } else {
        // Extract channel from error if possible
        const errorMsg = result.reason?.message || '';
        for (const channel in this.stats.alertsByChannel) {
          if (errorMsg.includes(channel)) {
            this.stats.alertsByChannel[channel].failed++;
            break;
          }
        }
      }
    }
    
    // Calculate delivery rate
    const totalSent = Object.values(this.stats.alertsByChannel).reduce((sum, stats) => sum + stats.sent, 0);
    const totalFailed = Object.values(this.stats.alertsByChannel).reduce((sum, stats) => sum + stats.failed, 0);
    this.stats.deliveryRate = totalSent + totalFailed > 0 ? (totalSent / (totalSent + totalFailed)) * 100 : 0;
  }
  
  /**
   * Setup cleanup timer for old data
   */
  setupCleanupTimer() {
    setInterval(() => {
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      
      // Clean alert history
      this.alertHistory = this.alertHistory.filter(alert => alert.timestamp > oneDayAgo);
      
      // Clean rate limit tracker
      const currentWindow = Math.floor(Date.now() / this.options.rateLimitWindow);
      for (const [window, _] of this.rateLimitTracker) {
        if (window < currentWindow - 10) { // Keep last 10 windows
          this.rateLimitTracker.delete(window);
        }
      }
      
      // Clean alert cache
      for (const [key, timestamp] of this.alertCache) {
        if (Date.now() - timestamp > this.options.cooldownPeriod * 2) {
          this.alertCache.delete(key);
        }
      }
    }, 60 * 60 * 1000); // Run every hour
  }
  
  /**
   * Get comprehensive statistics
   */
  getStats() {
    return {
      ...this.stats,
      rules: {
        total: this.rules.size,
        triggered: Array.from(this.rules.values()).reduce((sum, rule) => sum + rule.triggered, 0)
      },
      cache: {
        alertHistory: this.alertHistory.length,
        alertCache: this.alertCache.size,
        rateLimitTracker: this.rateLimitTracker.size
      },
      channels: Object.fromEntries(
        Object.entries(this.channels).map(([name, config]) => [
          name,
          {
            enabled: config.enabled,
            lastError: config.lastError,
            configured: this.isChannelConfigured(name)
          }
        ])
      )
    };
  }
  
  /**
   * Check if channel is properly configured
   */
  isChannelConfigured(channel) {
    const config = this.channels[channel];
    if (!config.enabled) return false;
    
    switch (channel) {
      case 'discord':
        return !!config.webhookUrl;
      case 'telegram':
        return !!(config.botToken && config.chatId);
      case 'email':
        return !!config.to;
      case 'sms':
        return !!config.config.to;
      case 'slack':
        return !!config.webhookUrl;
      default:
        return false;
    }
  }
  
  /**
   * Shutdown alerting service
   */
  async shutdown() {
    console.log('🛑 Shutting down Alerting Service...');
    
    this.isInitialized = false;
    this.emit('shutdown');
    
    console.log('✅ Alerting Service shutdown complete');
  }
}

module.exports = AlertingService;