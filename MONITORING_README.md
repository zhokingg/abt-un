# Comprehensive Monitoring and Alerting System

This repository now includes a comprehensive monitoring and alerting system designed specifically for the arbitrage bot. The system provides real-time performance tracking, health monitoring, incident management, and multi-channel alerting capabilities.

## 🏗️ Architecture Overview

The monitoring system consists of 8 main services that work together to provide comprehensive coverage:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  CoreArbitrage  │────│  Monitoring     │────│  DashboardAPI   │
│     Engine      │    │  Integration    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼──────┐    ┌─────────▼──────┐    ┌────────▼─────────┐
│ AlertManager │    │ HealthMonitor  │    │ PerformanceAnalyzer│
└──────────────┘    └────────────────┘    └──────────────────┘
        │                     │                     │
┌───────▼──────┐    ┌─────────▼──────┐    ┌────────▼─────────┐
│ LogAnalyzer  │    │Infrastructure  │    │ IncidentManager │
│              │    │   Monitor      │    │                 │
└──────────────┘    └────────────────┘    └──────────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                    ┌─────────▼──────┐
                    │ MetricsDashboard│
                    └────────────────┘
```

## 📊 Core Services

### 1. **MonitoringIntegration** (`src/services/MonitoringIntegration.js`)
- Central orchestration service that connects all monitoring components
- Integrates with CoreArbitrageEngine to capture real-time events
- Handles metrics aggregation and cross-service communication
- Provides unified shutdown and status management

### 2. **AlertManager** (`src/services/AlertManager.js`)
- Multi-channel alert distribution (Discord, Telegram, Email, Slack, SMS, Push)
- Smart throttling and rate limiting to prevent alert spam
- Priority-based alert routing and escalation
- Alert acknowledgment and correlation system

### 3. **HealthMonitor** (`src/services/HealthMonitor.js`)
- Component health tracking for all system services
- Automated health checks with configurable intervals
- Recovery procedures and self-healing mechanisms
- Overall system health scoring and trend analysis

### 4. **PerformanceAnalyzer** (`src/services/PerformanceAnalyzer.js`)
- Real-time performance metrics collection and analysis
- Bottleneck detection and performance recommendations
- SLA compliance monitoring and reporting
- Performance grading and trend analysis

### 5. **LogAnalyzer** (`src/services/LogAnalyzer.js`)
- Centralized log aggregation with structured logging
- Real-time log streaming and pattern recognition
- Anomaly detection and automated error classification
- Performance bottleneck identification from logs

### 6. **InfrastructureMonitor** (`src/services/InfrastructureMonitor.js`)
- Network performance and RPC provider monitoring
- System resource tracking (CPU, memory, disk, network)
- API rate limiting and bandwidth optimization
- Auto-optimization of network configurations

### 7. **IncidentManager** (`src/services/IncidentManager.js`)
- Automated incident detection using statistical methods
- Response automation with failover procedures
- Escalation management and recovery validation
- Comprehensive incident reporting and analysis

### 8. **DashboardAPI** (`src/services/DashboardAPI.js`)
- RESTful API for dashboard data access
- WebSocket support for real-time updates
- Mobile-responsive API endpoints
- Authentication and rate limiting

### 9. **MetricsDashboard** (`src/services/MetricsDashboard.js`)
- Real-time metrics visualization dashboard
- Performance KPIs and health indicators
- Interactive charts and system topology views
- Live data streaming with WebSocket support

## 🚀 Quick Start

### 1. Configuration Setup

Copy the example environment file and configure your settings:

```bash
cp .env.monitoring.example .env
```

Edit `.env` to configure your external services:

```bash
# Enable Discord alerts
ENABLE_DISCORD_ALERTS=true
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_TOKEN

# Enable Telegram alerts
ENABLE_TELEGRAM_ALERTS=true
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN
TELEGRAM_CHAT_IDS=123456789,987654321

# Enable email alerts
ENABLE_EMAIL_ALERTS=true
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_RECIPIENTS=admin@yourcompany.com
```

### 2. Basic Integration

```javascript
import MonitoringIntegration from './src/services/MonitoringIntegration.js';
import CoreArbitrageEngine from './src/services/coreArbitrageEngine.js';

// Initialize your core engine
const coreEngine = new CoreArbitrageEngine();

// Initialize monitoring integration
const monitoring = new MonitoringIntegration({
  global: {
    enableMonitoring: true,
    enableAlerting: true,
    enableDashboard: true
  }
});

// Connect monitoring to core engine
await monitoring.initialize(coreEngine);

// Start your core engine
await coreEngine.start();

console.log('🚀 System running with comprehensive monitoring!');
```

### 3. Dashboard Access

Once initialized, access your monitoring dashboard at:

- **Web Dashboard**: http://localhost:3000
- **API Endpoints**: http://localhost:3000/api/*
- **WebSocket**: ws://localhost:3000/ws

## 📈 Key Features

### Real-time Performance Metrics
- **Trading Performance**: Profit/loss tracking, win rate, execution times
- **System Performance**: CPU, memory, network latency monitoring
- **Market Metrics**: Opportunity detection rates, market conditions
- **Risk Metrics**: Current exposure, risk distribution analysis

### Multi-Channel Alerting
- **Discord**: Rich embeds with color-coded priorities
- **Telegram**: Interactive bot commands and status queries
- **Email**: Detailed reports with attachments
- **Slack**: Channel-specific routing and mentions
- **SMS**: Critical emergency notifications via Twilio
- **Push**: Browser and mobile app notifications

### Intelligent Monitoring
- **Anomaly Detection**: Statistical analysis for unusual patterns
- **Bottleneck Identification**: Automated performance issue detection
- **Health Scoring**: Component-level and overall system health
- **Predictive Alerts**: Early warning based on trend analysis

### Automated Response
- **Self-Healing**: Automatic recovery for common issues
- **Failover Management**: Seamless switching to backup systems
- **Incident Escalation**: Progressive alert severity increases
- **Recovery Validation**: Automated verification of fixes

## 🔧 Advanced Configuration

### Performance Targets

```javascript
const monitoring = new MonitoringIntegration({
  performanceAnalyzer: {
    performanceTargets: {
      rpcLatency: 100,        // 100ms max RPC latency
      executionTime: 30000,   // 30s max trade execution
      successRate: 95,        // 95% minimum success rate
      memoryUsage: 512,       // 512MB max memory usage
      cpuUsage: 70           // 70% max CPU usage
    }
  }
});
```

### Alert Configuration

```javascript
const monitoring = new MonitoringIntegration({
  alertManager: {
    rateLimitWindow: 60000,    // 1 minute rate limit window
    maxAlertsPerWindow: 50,    // Max 50 alerts per minute
    enableDiscord: true,
    enableTelegram: true,
    enableEmail: true,
    discordWebhook: 'YOUR_DISCORD_WEBHOOK',
    telegramBotToken: 'YOUR_BOT_TOKEN'
  }
});
```

### Health Monitoring

```javascript
const monitoring = new MonitoringIntegration({
  healthMonitor: {
    healthCheckInterval: 30000,  // Check every 30 seconds
    enableAutoRecovery: true,    // Enable automatic recovery
    uptimeThreshold: 99.5,       // 99.5% uptime requirement
    maxRecoveryAttempts: 3       // Max 3 recovery attempts
  }
});
```

## 📊 API Reference

### Dashboard Endpoints

- `GET /api/dashboard` - Dashboard overview
- `GET /api/metrics` - All metrics
- `GET /api/metrics/trading` - Trading performance
- `GET /api/metrics/system` - System resources
- `GET /api/health` - Health status
- `GET /api/alerts` - Active alerts
- `GET /api/logs` - Recent logs

### WebSocket Events

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:3000/ws');

// Listen for real-time updates
ws.on('message', (data) => {
  const update = JSON.parse(data);
  
  switch (update.type) {
    case 'metrics_update':
      // Handle metrics update
      break;
    case 'alert_triggered':
      // Handle new alert
      break;
    case 'health_status':
      // Handle health status change
      break;
  }
});
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all monitoring tests
node src/test/monitoring-integration.test.js

# Test individual services
node -e "
import AlertManager from './src/services/AlertManager.js';
const alertManager = new AlertManager();
await alertManager.initialize();
console.log('✅ AlertManager working!');
await alertManager.stop();
"
```

## 📋 Monitoring Checklist

### Essential Setup
- [ ] Configure at least one alert channel (Discord/Telegram/Email)
- [ ] Set appropriate performance targets for your environment
- [ ] Configure RPC provider endpoints
- [ ] Set up log directory with proper permissions
- [ ] Configure database connection (if using persistent storage)

### Production Deployment
- [ ] Enable authentication for dashboard API
- [ ] Configure SSL/TLS for web endpoints
- [ ] Set up log rotation and archival
- [ ] Configure monitoring system monitoring (meta-monitoring)
- [ ] Set up backup alert channels for redundancy
- [ ] Configure rate limiting for API endpoints
- [ ] Enable audit logging for compliance

### Performance Optimization
- [ ] Enable Redis caching for improved performance
- [ ] Configure InfluxDB/TimescaleDB for metrics storage
- [ ] Optimize alert thresholds based on historical data
- [ ] Enable auto-optimization for network settings
- [ ] Configure proper resource limits

## 🚨 Troubleshooting

### Common Issues

**"No notification channels are enabled"**
- Enable at least one alert channel in configuration
- Verify webhook URLs and API tokens are correct

**"Cannot read properties of undefined"**
- Check that all required dependencies are installed
- Verify environment variables are properly set

**"Port already in use"**
- Change dashboard port in configuration
- Check for conflicting services

**"Health checks failing"**
- Verify RPC provider URLs are accessible
- Check network connectivity and firewall settings

### Debug Mode

Enable detailed logging:

```bash
NODE_ENV=development LOG_LEVEL=debug node your-app.js
```

### Health Check URLs

Monitor system health:
- http://localhost:3000/health
- http://localhost:3000/api/health
- http://localhost:3000/api/meta/metrics

## 📚 Additional Resources

### Configuration Files
- `src/config/monitoring.js` - Main configuration system
- `.env.monitoring.example` - Environment variables example
- `src/services/MonitoringIntegration.js` - Integration service

### Documentation
- Individual service files contain detailed JSDoc comments
- Configuration options are documented in environment example
- API endpoints include response examples

### Support
- Check logs in the configured log directory
- Monitor system health via dashboard
- Review incident history for recurring issues

---

## 🎯 Success Metrics

Your monitoring system is working correctly when:

- ✅ All services show "active" status in dashboard
- ✅ Real-time metrics are updating every 1-5 seconds
- ✅ Test alerts are delivered to configured channels
- ✅ Health checks pass with >95% success rate
- ✅ Performance grades show A or B rating
- ✅ No critical incidents in the last 24 hours

---

**🎉 Congratulations! You now have a production-ready monitoring and alerting system for your arbitrage bot.**