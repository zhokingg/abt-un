/**
 * Comprehensive Monitoring Configuration Example
 * This file shows all configuration options for the new monitoring components
 */

export const MONITORING_CONFIG = {
  // Performance Dashboard Configuration
  PERFORMANCE_DASHBOARD: {
    updateInterval: 1000, // 1 second for real-time updates
    metricsRetention: 24 * 60 * 60 * 1000, // 24 hours
    enableWebSocket: true,
    webSocketPort: 8080,
    maxConnections: 100
  },
  
  // Health Monitor Configuration
  HEALTH_MONITOR: {
    checkInterval: 30000, // 30 seconds
    rpcTimeout: 5000, // 5 seconds
    memoryThreshold: 0.8, // 80%
    cpuThreshold: 0.8, // 80%
    diskThreshold: 0.9, // 90%
    networkTimeout: 10000, // 10 seconds
    healthyThreshold: 0.8, // 80% checks must pass
    maxRetries: 3
  },
  
  // Analytics Engine Configuration
  ANALYTICS_ENGINE: {
    analysisInterval: 300000, // 5 minutes
    dataRetention: 30 * 24 * 60 * 60 * 1000, // 30 days
    predictionWindow: 24 * 60 * 60 * 1000, // 24 hours
    minDataPoints: 100,
    confidenceThreshold: 0.7,
    anomalyThreshold: 2.5 // Standard deviations
  },
  
  // Log Manager Configuration
  LOG_MANAGER: {
    logLevel: 'info',
    logDirectory: './logs',
    maxFileSize: 100 * 1024 * 1024, // 100MB
    maxFiles: 10,
    retentionDays: 30,
    enableConsole: true,
    enableFile: true,
    enableAnalysis: true,
    analysisInterval: 300000, // 5 minutes
    patternThreshold: 5 // 5 occurrences to identify pattern
  },
  
  // Event Tracker Configuration
  EVENT_TRACKER: {
    retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
    correlationWindow: 5 * 60 * 1000, // 5 minutes
    maxEvents: 100000,
    enableAnalysis: true,
    analysisInterval: 300000, // 5 minutes
    funnelTimeout: 30 * 60 * 1000 // 30 minutes
  },
  
  // Notification Manager Configuration
  NOTIFICATION_MANAGER: {
    enableScheduling: true,
    enableDigests: true,
    digestInterval: 3600000, // 1 hour
    maxRetries: 3,
    retryDelay: 5000, // 5 seconds
    confirmationTimeout: 30000, // 30 seconds
    quietHoursStart: 22, // 10 PM
    quietHoursEnd: 7, // 7 AM
    timezone: 'UTC'
  },
  
  // Reporting Service Configuration
  REPORTING_SERVICE: {
    reportDirectory: './reports',
    enableAutomation: true,
    defaultTimezone: 'UTC',
    maxReportAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    enableDelivery: true
  },
  
  // Alert Channel Configurations
  ALERTING: {
    enableDiscord: true,
    enableTelegram: true,
    enableEmail: true,
    enableSMS: false,
    enableSlack: false,
    
    // Priority thresholds
    priorityThreshold: 'medium',
    rateLimitWindow: 300000, // 5 minutes
    maxAlertsPerWindow: 10,
    cooldownPeriod: 60000, // 1 minute
    
    // Channel-specific settings
    channels: {
      discord: {
        enabled: true,
        webhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
        rateLimits: { requests: 0, resetTime: 0 }
      },
      telegram: {
        enabled: true,
        botToken: process.env.TELEGRAM_BOT_TOKEN || '',
        chatId: process.env.TELEGRAM_CHAT_ID || '',
        rateLimits: { requests: 0, resetTime: 0 }
      },
      email: {
        enabled: true,
        to: process.env.ALERT_EMAIL || '',
        smtpConfig: {
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASS || ''
          }
        }
      },
      sms: {
        enabled: false,
        config: {
          accountSid: process.env.TWILIO_ACCOUNT_SID || '',
          authToken: process.env.TWILIO_AUTH_TOKEN || '',
          from: process.env.TWILIO_PHONE_NUMBER || '',
          to: process.env.ALERT_PHONE_NUMBER || ''
        }
      },
      slack: {
        enabled: false,
        webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
        channel: process.env.SLACK_CHANNEL || '#alerts'
      }
    }
  },
  
  // Dashboard Port (for WebSocket server)
  DASHBOARD_PORT: parseInt(process.env.DASHBOARD_PORT) || 8080,
  
  // Log Level (global)
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};

// Environment Variables Documentation
export const ENV_VARS_DOCUMENTATION = {
  // Dashboard Configuration
  DASHBOARD_PORT: 'Port for the WebSocket dashboard server (default: 8080)',
  
  // Logging Configuration
  LOG_LEVEL: 'Global log level: error, warn, info, debug, trace (default: info)',
  
  // Alert Channels
  DISCORD_WEBHOOK_URL: 'Discord webhook URL for alerts',
  TELEGRAM_BOT_TOKEN: 'Telegram bot token for notifications',
  TELEGRAM_CHAT_ID: 'Telegram chat ID for sending messages',
  ALERT_EMAIL: 'Email address for alert notifications',
  
  // SMTP Configuration
  SMTP_HOST: 'SMTP server hostname (default: smtp.gmail.com)',
  SMTP_PORT: 'SMTP server port (default: 587)',
  SMTP_SECURE: 'Use SSL/TLS for SMTP (true/false)',
  SMTP_USER: 'SMTP username',
  SMTP_PASS: 'SMTP password or app-specific password',
  
  // SMS Configuration (Twilio)
  TWILIO_ACCOUNT_SID: 'Twilio Account SID for SMS',
  TWILIO_AUTH_TOKEN: 'Twilio Auth Token',
  TWILIO_PHONE_NUMBER: 'Twilio phone number (from)',
  ALERT_PHONE_NUMBER: 'Phone number for SMS alerts (to)',
  
  // Slack Configuration
  SLACK_WEBHOOK_URL: 'Slack webhook URL for notifications',
  SLACK_CHANNEL: 'Slack channel for alerts (default: #alerts)'
};

// Example .env file content
export const EXAMPLE_ENV_CONTENT = `
# Comprehensive Monitoring Configuration
DASHBOARD_PORT=8080
LOG_LEVEL=info

# Discord Alerts
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_URL

# Telegram Notifications
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN
TELEGRAM_CHAT_ID=YOUR_CHAT_ID

# Email Alerts
ALERT_EMAIL=alerts@yourcompany.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# SMS Alerts (Optional - Twilio)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
ALERT_PHONE_NUMBER=+1987654321

# Slack Notifications (Optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
SLACK_CHANNEL=#alerts
`;

export default MONITORING_CONFIG;