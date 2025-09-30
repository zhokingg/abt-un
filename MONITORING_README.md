# Comprehensive Monitoring & Alerting System

## Overview

The enhanced arbitrage bot now includes a comprehensive monitoring and alerting system that provides real-time performance tracking, advanced analytics, intelligent notifications, and automated reporting capabilities. This system offers enterprise-grade observability and operational excellence.

## 🏗️ Architecture

The monitoring system consists of 7 main components:

### 1. **PerformanceDashboard** (`src/services/PerformanceDashboard.js`)
- **Real-time P&L tracking** with profit/loss visualization
- **Trade execution statistics** (success rate, average execution time)
- **System health indicators** (CPU, memory, network latency)
- **WebSocket server** for live dashboard updates
- **Historical performance charts** with data export capabilities

### 2. **HealthMonitor** (`src/services/HealthMonitor.js`)
- **Infrastructure monitoring** (RPC providers, database, network, disk, memory, CPU)
- **Application health checks** (arbitrage engine, price feeds, mempool monitor)
- **Performance metrics tracking** with response time and availability monitoring
- **Anomaly detection** and automated issue identification
- **Comprehensive health reporting** with trend analysis

### 3. **AnalyticsEngine** (`src/services/AnalyticsEngine.js`)
- **Performance analytics** by token pair, time period, and strategy
- **Risk-adjusted performance metrics** (Sharpe ratio, Sortino ratio)
- **Predictive analytics** with machine learning integration points
- **Anomaly detection** using statistical baselines
- **Pattern recognition** and trend analysis
- **Optimization insights** and actionable recommendations

### 4. **LogManager** (`src/services/LogManager.js`)
- **Winston integration** with multiple transports and log levels
- **Structured logging** with contextual information and correlation tracking
- **Real-time log streaming** for live monitoring
- **Pattern recognition** and log analysis
- **Audit trail maintenance** for compliance requirements
- **Log search and filtering** capabilities

### 5. **EventTracker** (`src/services/EventTracker.js`)
- **Business event tracking** for complete arbitrage lifecycle
- **Event correlation analysis** and funnel metrics
- **Pattern detection** and anomaly identification
- **Root cause analysis** through event sequence correlation
- **Performance impact analysis** of different events
- **Comprehensive event analytics** and reporting

### 6. **NotificationManager** (`src/services/NotificationManager.js`)
- **Multi-channel delivery** (Discord, Telegram, Email, SMS, Slack)
- **Smart scheduling** with quiet hours and user preferences
- **Digest notifications** for low-priority events
- **Delivery confirmation** and retry mechanisms
- **Priority-based routing** and escalation procedures
- **Template management** and customization

### 7. **ReportingService** (`src/services/ReportingService.js`)
- **Automated report generation** (daily, weekly, monthly)
- **Custom report templates** with flexible sections
- **Multi-format output** (JSON, HTML, Markdown, CSV)
- **Scheduled delivery** to stakeholders
- **Performance analytics** and trend reporting
- **Compliance reporting** capabilities

## 🚀 Quick Start

### 1. Installation

The monitoring components are automatically included when you initialize the Phase4Manager:

```javascript
import Phase4Manager from './services/Phase4Manager.js';

const phase4Manager = new Phase4Manager({
  // Enable all monitoring components
  enablePerformanceDashboard: true,
  enableHealthMonitor: true,
  enableAnalyticsEngine: true,
  enableLogManager: true,
  enableEventTracker: true,
  enableNotificationManager: true,
  enableReportingService: true
});

await phase4Manager.initialize();
```

### 2. Configuration

Copy the monitoring configuration example:

```bash
cp src/config/monitoring.config.example.js src/config/monitoring.config.js
```

Update your `.env` file with the required configuration:

```env
# Dashboard Configuration
DASHBOARD_PORT=8080
LOG_LEVEL=info

# Discord Alerts
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_URL

# Email Alerts
ALERT_EMAIL=alerts@yourcompany.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### 3. Dependencies

Install the additional WebSocket dependency:

```bash
npm install ws@^8.18.0
```

## 📊 Usage Examples

### Real-time Performance Monitoring

```javascript
// Get comprehensive dashboard data
const dashboardData = phase4Manager.getDashboardData();
console.log('Current P&L:', dashboardData.dashboard.metrics.pnl.netPnL);
console.log('Success Rate:', dashboardData.dashboard.metrics.trades.successRate);

// Get enhanced system status
const status = phase4Manager.getEnhancedSystemStatus();
console.log('System Health:', status.healthStatus.overall);
console.log('Active Components:', Object.values(status.componentStatus).filter(s => s === 'active').length);
```

### Event Tracking

```javascript
// Track business events
const correlationId = 'trade_123';

await phase4Manager.trackEvent('opportunity_detected', {
  tokenPair: 'USDC/WETH',
  spread: 2.5,
  confidence: 0.85
}, correlationId);

await phase4Manager.trackEvent('opportunity_executed', {
  tokenPair: 'USDC/WETH',
  profit: 125.50,
  executionTime: 15000
}, correlationId);

// Get event analytics
const analytics = phase4Manager.getEventAnalytics();
console.log('Total Events:', analytics.summary.totalEvents);
console.log('Conversion Rate:', analytics.funnels.arbitrage_flow.overallConversion);
```

### Smart Notifications

```javascript
// Send notifications with priority routing
await phase4Manager.sendNotification('trade_success', {
  profit: 150.75,
  executionTime: 25000,
  txHash: '0xabc123...'
}, {
  priority: 'medium',
  recipients: ['trader', 'admin'],
  channels: ['discord', 'telegram']
});

// Send critical system alerts
await phase4Manager.sendNotification('system_error', {
  error: 'RPC provider failure',
  component: 'networkOptimizer',
  severity: 'high'
}, {
  priority: 'critical',
  recipients: ['admin'],
  channels: ['discord', 'telegram', 'email', 'sms']
});
```

### Report Generation

```javascript
// Generate automated reports
const reportId = await phase4Manager.generateComprehensiveReport({
  template: 'daily_performance',
  format: 'html',
  timeRange: {
    start: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
    end: Date.now()
  }
});

console.log('Report generated:', reportId);

// Get reporting statistics
const reportingService = phase4Manager.components.reportingService;
const stats = reportingService.getStatistics();
console.log('Total Reports:', stats.total);
console.log('Success Rate:', ((stats.completed / stats.total) * 100).toFixed(1) + '%');
```

### Advanced Analytics

```javascript
// Get monitoring insights and recommendations
const insights = phase4Manager.getMonitoringInsights();

console.log('Recommendations:');
insights.recommendations.forEach(rec => {
  console.log(`- ${rec.title}: ${rec.description}`);
});

console.log('Warnings:');
insights.warnings.forEach(warning => {
  console.log(`- ${warning.title}: ${warning.message}`);
});

// Get comprehensive metrics
const metrics = phase4Manager.getComprehensiveMetrics();
console.log('Active Components:', Object.keys(metrics.components).length);
console.log('System Uptime:', Math.floor(metrics.aggregated.system.uptime / 60000), 'minutes');
```

## 🎛️ Dashboard Access

The system provides a real-time WebSocket dashboard accessible at:

```
ws://localhost:8080
```

### WebSocket API

Connect to the WebSocket server to receive real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:8080');

ws.on('message', (data) => {
  const message = JSON.parse(data);
  
  switch (message.type) {
    case 'metrics':
      console.log('Real-time metrics:', message.data);
      break;
    case 'logEntry':
      console.log('New log entry:', message.data);
      break;
    case 'history':
      console.log('Historical data:', message.data);
      break;
  }
});

// Subscribe to specific metrics
ws.send(JSON.stringify({
  type: 'subscribe',
  metrics: ['pnl', 'trades', 'system']
}));

// Request historical data
ws.send(JSON.stringify({
  type: 'getHistory',
  timeRange: 3600000 // Last hour
}));
```

## 📈 Report Templates

The system includes several built-in report templates:

### Daily Performance Report
- Executive summary with key metrics
- Trading performance analysis
- P&L breakdown and trends
- Opportunity analysis
- System health status
- Risk metrics overview

### Weekly Analysis Report
- Comprehensive weekly performance review
- Market analysis and impact
- Strategy performance comparison
- Risk analysis and recommendations
- System performance metrics
- Optimization recommendations

### Monthly Review Report
- Monthly performance highlights
- Profitability trends and analysis
- Market condition correlation
- Strategy evolution insights
- Risk assessment summary
- Compliance status report
- Future outlook and planning

### System Health Report
- System overview and uptime metrics
- Component health status
- Performance metrics analysis
- Error analysis and trends
- Resource utilization statistics
- Alert summary and resolution

## 🔧 Configuration Options

### Performance Dashboard

```javascript
PERFORMANCE_DASHBOARD: {
  updateInterval: 1000,        // Real-time update frequency
  metricsRetention: 86400000,  // 24 hours data retention
  enableWebSocket: true,       // Enable WebSocket server
  webSocketPort: 8080,         // WebSocket port
  maxConnections: 100          // Max concurrent connections
}
```

### Health Monitor

```javascript
HEALTH_MONITOR: {
  checkInterval: 30000,        // Health check frequency
  memoryThreshold: 0.8,        // 80% memory threshold
  cpuThreshold: 0.8,           // 80% CPU threshold
  networkTimeout: 10000,       // Network timeout
  healthyThreshold: 0.8        // 80% checks must pass
}
```

### Analytics Engine

```javascript
ANALYTICS_ENGINE: {
  analysisInterval: 300000,    // 5 minute analysis frequency
  dataRetention: 2592000000,   // 30 days data retention
  anomalyThreshold: 2.5,       // Standard deviation threshold
  confidenceThreshold: 0.7     // Prediction confidence threshold
}
```

### Notification Manager

```javascript
NOTIFICATION_MANAGER: {
  enableScheduling: true,      // Enable scheduled notifications
  enableDigests: true,         // Enable digest notifications
  digestInterval: 3600000,     // 1 hour digest frequency
  quietHoursStart: 22,         // Quiet hours start (10 PM)
  quietHoursEnd: 7,            // Quiet hours end (7 AM)
  maxRetries: 3                // Max delivery retries
}
```

## 🚨 Alert Configuration

### Priority Levels
- **Critical**: Immediate attention required (system failures, security issues)
- **High**: Important issues that need prompt attention (performance degradation)
- **Medium**: Standard operational alerts (successful trades, milestones)
- **Low**: Informational notifications (scheduled reports, routine events)

### Channel Configuration

```javascript
// Discord
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_URL

// Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

// Email (SMTP)
ALERT_EMAIL=alerts@company.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-password

// SMS (Twilio)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
ALERT_PHONE_NUMBER=+1987654321
```

## 📊 Performance Metrics

The system tracks comprehensive performance metrics:

### Trading Metrics
- Total trades executed
- Success rate and failure analysis
- Average execution time
- Profit/Loss tracking
- Gas cost optimization
- Slippage analysis

### System Metrics
- CPU and memory utilization
- Network latency and connectivity
- RPC provider health and failover
- Database connection status
- WebSocket connection health
- Error rates and patterns

### Business Metrics
- Opportunity detection rate
- Conversion funnel analysis
- Market condition correlation
- Strategy performance comparison
- Risk-adjusted returns
- Compliance adherence

## 🔍 Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   ```bash
   # Check if port is available
   netstat -tulpn | grep 8080
   
   # Verify configuration
   echo $DASHBOARD_PORT
   ```

2. **Alert Delivery Failed**
   ```bash
   # Check Discord webhook
   curl -X POST $DISCORD_WEBHOOK_URL -H "Content-Type: application/json" -d '{"content":"Test message"}'
   
   # Verify email configuration
   echo $SMTP_HOST $SMTP_PORT $SMTP_USER
   ```

3. **Log Analysis Not Working**
   ```bash
   # Check log directory permissions
   ls -la ./logs/
   
   # Verify Winston configuration
   grep -r "winston" src/services/LogManager.js
   ```

4. **Report Generation Failed**
   ```bash
   # Check report directory
   ls -la ./reports/
   
   # Verify dependencies
   npm list winston ws
   ```

### Debug Mode

Enable debug logging for troubleshooting:

```bash
LOG_LEVEL=debug npm start
```

### Health Check Endpoint

The system provides health check information:

```javascript
// Get comprehensive health status
const health = phase4Manager.getEnhancedSystemStatus();
console.log(JSON.stringify(health, null, 2));
```

## 🎯 Best Practices

### 1. Configuration Management
- Use environment variables for sensitive configuration
- Keep monitoring configuration separate from trading configuration
- Regularly review and update alert thresholds
- Test notification channels regularly

### 2. Performance Optimization
- Configure appropriate data retention periods
- Monitor WebSocket connection limits
- Use digest notifications for low-priority alerts
- Schedule reports during low-activity periods

### 3. Security Considerations
- Secure WebSocket connections with authentication
- Use encrypted channels for sensitive notifications
- Regularly rotate API keys and webhooks
- Monitor for unusual access patterns

### 4. Operational Excellence
- Set up automated report delivery
- Configure escalation procedures for critical alerts
- Maintain comprehensive documentation
- Regularly review and optimize monitoring rules

## 📚 API Reference

### Phase4Manager Methods

```javascript
// Dashboard and metrics
getDashboardData()                    // Get real-time dashboard data
getComprehensiveMetrics()            // Get all component metrics
getEnhancedSystemStatus()            // Get enhanced system status
getMonitoringInsights()              // Get insights and recommendations

// Event tracking
trackEvent(type, data, correlationId) // Track business events
getEventAnalytics()                   // Get event analytics

// Notifications and reporting
sendNotification(type, data, options) // Send smart notifications
generateComprehensiveReport(options)  // Generate reports

// Component management
toggleComponent(name, enable)         // Enable/disable components
```

### Component Access

```javascript
// Direct component access
const dashboard = phase4Manager.components.performanceDashboard;
const healthMonitor = phase4Manager.components.healthMonitor;
const analytics = phase4Manager.components.analyticsEngine;
const logManager = phase4Manager.components.logManager;
const eventTracker = phase4Manager.components.eventTracker;
const notifications = phase4Manager.components.notificationManager;
const reporting = phase4Manager.components.reportingService;
```

## 🧪 Testing

Run the comprehensive monitoring demo:

```bash
npm run demo:monitoring
```

Run integration tests:

```bash
npm test tests/integration-monitoring.test.js
```

## 📄 License

This monitoring system is part of the enhanced arbitrage bot and follows the same license terms as the main project.

## 🤝 Contributing

Contributions to improve the monitoring system are welcome! Please follow the existing code patterns and include appropriate tests.

## 📞 Support

For support with the monitoring system:
1. Check this documentation
2. Review the configuration examples
3. Run the debug mode
4. Check the health status endpoints
5. Review the generated logs and reports

The comprehensive monitoring system provides enterprise-grade observability for your arbitrage bot, enabling you to optimize performance, manage risk, and maintain operational excellence.