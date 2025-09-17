const winston = require('winston');
const path = require('path');
const config = require('../config/config');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let logMessage = `${timestamp} [${level}] ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta)}`;
    }
    
    return logMessage;
  })
);

// File format (no colors)
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create winston logger
const logger = winston.createLogger({
  level: config.LOG_LEVEL || 'info',
  defaultMeta: { 
    service: 'arbitrage-bot',
    version: '1.0.0',
    environment: config.NODE_ENV
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat,
      handleExceptions: true
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Separate file for errors
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 3,
      tailable: true
    })
  ]
});

// Enhanced logging methods
class EnhancedLogger {
  constructor(baseLogger) {
    this.logger = baseLogger;
    this.startTime = Date.now();
  }

  // Standard log levels
  error(message, meta = {}) {
    this.logger.error(message, { ...meta, timestamp: new Date().toISOString() });
  }

  warn(message, meta = {}) {
    this.logger.warn(message, { ...meta, timestamp: new Date().toISOString() });
  }

  info(message, meta = {}) {
    this.logger.info(message, { ...meta, timestamp: new Date().toISOString() });
  }

  debug(message, meta = {}) {
    this.logger.debug(message, { ...meta, timestamp: new Date().toISOString() });
  }

  // Specialized logging methods for arbitrage bot
  opportunity(opportunity, meta = {}) {
    this.logger.info('🎯 Arbitrage Opportunity Found', {
      type: 'opportunity',
      opportunity,
      ...meta,
      timestamp: new Date().toISOString()
    });
  }

  performance(operation, duration, meta = {}) {
    this.logger.debug('⚡ Performance', {
      type: 'performance',
      operation,
      duration_ms: duration,
      ...meta,
      timestamp: new Date().toISOString()
    });
  }

  health(service, status, meta = {}) {
    const level = status === 'healthy' ? 'info' : 'warn';
    this.logger[level](`🏥 Health Check: ${service}`, {
      type: 'health_check',
      service,
      status,
      ...meta,
      timestamp: new Date().toISOString()
    });
  }

  startup(message, meta = {}) {
    this.logger.info(`🚀 ${message}`, {
      type: 'startup',
      uptime: this.getUptime(),
      ...meta,
      timestamp: new Date().toISOString()
    });
  }

  // Utility methods
  getUptime() {
    return Date.now() - this.startTime;
  }

  // Performance timing helper
  time(label) {
    const startTime = process.hrtime.bigint();
    
    return {
      end: () => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        this.performance(label, duration);
        return duration;
      }
    };
  }

  // Log configuration on startup
  logConfig() {
    this.startup('Configuration loaded', {
      rpc_configured: !config.RPC_URL.includes('YOUR_INFURA_KEY'),
      cache_enabled: config.CACHE_ENABLED,
      dry_run: config.DRY_RUN,
      log_level: config.LOG_LEVEL,
      node_env: config.NODE_ENV
    });
  }
}

// Create enhanced logger instance
const enhancedLogger = new EnhancedLogger(logger);

module.exports = enhancedLogger;
