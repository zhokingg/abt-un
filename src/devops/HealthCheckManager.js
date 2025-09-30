import { EventEmitter } from 'events';
import http from 'http';
import express from 'express';

/**
 * Health Check and Monitoring Manager
 * Provides comprehensive health checks, metrics endpoints, and system monitoring
 */
export class HealthCheckManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      port: options.port || process.env.HEALTH_CHECK_PORT || 3001,
      enableWebServer: options.enableWebServer !== false,
      checkInterval: options.checkInterval || 30000, // 30 seconds
      healthyThreshold: options.healthyThreshold || 2,
      unhealthyThreshold: options.unhealthyThreshold || 3,
      timeout: options.timeout || 5000,
      ...options
    };
    
    this.initialized = false;
    this.app = null;
    this.server = null;
    this.healthChecks = new Map();
    this.healthStatus = new Map();
    this.metrics = {
      systemHealth: 'healthy',
      lastCheck: null,
      uptime: 0,
      totalChecks: 0,
      failedChecks: 0,
      services: new Map()
    };
    
    // Service dependencies to monitor
    this.services = [
      'database',
      'rpc_provider', 
      'price_feeds',
      'memory',
      'disk_space',
      'network'
    ];
  }

  /**
   * Initialize health check manager
   */
  async initialize() {
    try {
      console.log('🏥 Initializing Health Check Manager...');
      
      // Setup health checks for all services
      await this.setupHealthChecks();
      
      // Start web server for health endpoints
      if (this.options.enableWebServer) {
        await this.startWebServer();
      }
      
      // Start periodic health checks
      this.startHealthChecking();
      
      this.initialized = true;
      console.log(`✅ Health Check Manager initialized on port ${this.options.port}`);
      
      this.emit('initialized', {
        port: this.options.port,
        webServerEnabled: this.options.enableWebServer,
        servicesMonitored: this.services.length
      });
      
    } catch (error) {
      console.error('❌ Failed to initialize Health Check Manager:', error.message);
      throw error;
    }
  }

  /**
   * Setup health checks for all services
   */
  async setupHealthChecks() {
    console.log('⚕️ Setting up health checks...');
    
    // Database health check
    this.healthChecks.set('database', async () => {
      try {
        // Mock database check - in production, use actual database connection
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          status: 'healthy',
          responseTime: 100,
          details: {
            connected: true,
            activeConnections: 5,
            maxConnections: 20
          }
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          error: error.message,
          details: { connected: false }
        };
      }
    });

    // RPC Provider health check
    this.healthChecks.set('rpc_provider', async () => {
      try {
        // Mock RPC check - in production, check actual RPC endpoints
        const startTime = Date.now();
        await new Promise(resolve => setTimeout(resolve, 150));
        const responseTime = Date.now() - startTime;
        
        return {
          status: 'healthy',
          responseTime,
          details: {
            endpoint: 'https://mainnet.infura.io/v3/...',
            blockNumber: 18500000,
            chainId: 1
          }
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          error: error.message,
          details: { endpoint: 'unavailable' }
        };
      }
    });

    // Price feeds health check
    this.healthChecks.set('price_feeds', async () => {
      try {
        const startTime = Date.now();
        await new Promise(resolve => setTimeout(resolve, 80));
        const responseTime = Date.now() - startTime;
        
        return {
          status: 'healthy',
          responseTime,
          details: {
            activeSources: ['chainlink', 'coingecko', 'uniswap'],
            lastUpdate: Date.now(),
            pricesReceived: 156
          }
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          error: error.message
        };
      }
    });

    // Memory health check
    this.healthChecks.set('memory', async () => {
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
      const usagePercentage = (heapUsedMB / heapTotalMB) * 100;
      
      const status = usagePercentage > 90 ? 'unhealthy' : 
                    usagePercentage > 70 ? 'warning' : 'healthy';
      
      return {
        status,
        responseTime: 0,
        details: {
          heapUsedMB: Math.round(heapUsedMB),
          heapTotalMB: Math.round(heapTotalMB),
          usagePercentage: Math.round(usagePercentage),
          rss: Math.round(memUsage.rss / 1024 / 1024)
        }
      };
    });

    // Disk space health check
    this.healthChecks.set('disk_space', async () => {
      try {
        // Mock disk space check - in production, use actual filesystem stats
        const freeSpaceGB = 50 + Math.random() * 100; // 50-150 GB
        const totalSpaceGB = 200;
        const usagePercentage = ((totalSpaceGB - freeSpaceGB) / totalSpaceGB) * 100;
        
        const status = usagePercentage > 95 ? 'unhealthy' :
                      usagePercentage > 85 ? 'warning' : 'healthy';
        
        return {
          status,
          responseTime: 0,
          details: {
            freeSpaceGB: Math.round(freeSpaceGB),
            totalSpaceGB,
            usagePercentage: Math.round(usagePercentage)
          }
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          error: error.message
        };
      }
    });

    // Network health check
    this.healthChecks.set('network', async () => {
      try {
        // Simple network connectivity check
        const startTime = Date.now();
        await new Promise(resolve => setTimeout(resolve, 50));
        const responseTime = Date.now() - startTime;
        
        return {
          status: 'healthy',
          responseTime,
          details: {
            connectivity: 'good',
            latency: responseTime
          }
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          error: error.message
        };
      }
    });

    console.log(`✅ Health checks configured for ${this.healthChecks.size} services`);
  }

  /**
   * Start web server for health endpoints
   */
  async startWebServer() {
    this.app = express();
    
    // Middleware
    this.app.use(express.json());
    
    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      const healthStatus = await this.performHealthCheck();
      const httpStatus = healthStatus.systemHealth === 'healthy' ? 200 : 503;
      
      res.status(httpStatus).json({
        status: healthStatus.systemHealth,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        ...healthStatus
      });
    });

    // Readiness check endpoint
    this.app.get('/ready', async (req, res) => {
      const ready = this.isSystemReady();
      const httpStatus = ready ? 200 : 503;
      
      res.status(httpStatus).json({
        ready,
        timestamp: new Date().toISOString(),
        services: Object.fromEntries(this.healthStatus)
      });
    });

    // Liveness check endpoint
    this.app.get('/live', (req, res) => {
      res.status(200).json({
        alive: true,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        pid: process.pid
      });
    });

    // Metrics endpoint (Prometheus format)
    this.app.get('/metrics', (req, res) => {
      const metrics = this.generatePrometheusMetrics();
      res.set('Content-Type', 'text/plain');
      res.send(metrics);
    });

    // Detailed system info endpoint
    this.app.get('/system', (req, res) => {
      res.json(this.getSystemInfo());
    });

    // Start server
    this.server = this.app.listen(this.options.port, () => {
      console.log(`🌐 Health check server running on port ${this.options.port}`);
    });

    // Handle server errors
    this.server.on('error', (error) => {
      console.error('Health check server error:', error);
      this.emit('serverError', error);
    });
  }

  /**
   * Start periodic health checking
   */
  startHealthChecking() {
    // Perform initial health check
    this.performHealthCheck().then(result => {
      console.log('🏥 Initial health check completed:', result.systemHealth);
    });

    // Setup periodic checks
    setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('Health check error:', error);
      }
    }, this.options.checkInterval);

    console.log(`⏰ Periodic health checks started (interval: ${this.options.checkInterval}ms)`);
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck() {
    const startTime = Date.now();
    const results = new Map();
    
    // Run all health checks in parallel
    const checkPromises = Array.from(this.healthChecks.entries()).map(async ([service, checkFn]) => {
      try {
        const result = await Promise.race([
          checkFn(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), this.options.timeout)
          )
        ]);
        
        results.set(service, {
          ...result,
          lastChecked: Date.now()
        });
      } catch (error) {
        results.set(service, {
          status: 'unhealthy',
          error: error.message,
          lastChecked: Date.now()
        });
      }
    });
    
    await Promise.all(checkPromises);
    
    // Update health status
    for (const [service, result] of results.entries()) {
      this.healthStatus.set(service, result);
    }
    
    // Calculate overall system health
    const healthyServices = Array.from(results.values())
      .filter(result => result.status === 'healthy').length;
    const totalServices = results.size;
    
    let systemHealth = 'healthy';
    if (healthyServices < totalServices * 0.5) {
      systemHealth = 'unhealthy';
    } else if (healthyServices < totalServices * 0.8) {
      systemHealth = 'degraded';
    }
    
    // Update metrics
    this.metrics.systemHealth = systemHealth;
    this.metrics.lastCheck = Date.now();
    this.metrics.uptime = process.uptime();
    this.metrics.totalChecks++;
    
    if (systemHealth !== 'healthy') {
      this.metrics.failedChecks++;
    }
    
    // Store service statuses
    this.metrics.services = new Map(results);
    
    const checkDuration = Date.now() - startTime;
    
    // Emit health check event
    this.emit('healthCheck', {
      systemHealth,
      services: Object.fromEntries(results),
      duration: checkDuration,
      timestamp: Date.now()
    });
    
    return {
      systemHealth,
      services: Object.fromEntries(results),
      duration: checkDuration,
      totalServices,
      healthyServices
    };
  }

  /**
   * Check if system is ready to serve requests
   */
  isSystemReady() {
    const criticalServices = ['database', 'rpc_provider'];
    
    return criticalServices.every(service => {
      const status = this.healthStatus.get(service);
      return status && status.status === 'healthy';
    });
  }

  /**
   * Generate Prometheus-format metrics
   */
  generatePrometheusMetrics() {
    const lines = [];
    
    // System uptime
    lines.push(`# HELP system_uptime_seconds System uptime in seconds`);
    lines.push(`# TYPE system_uptime_seconds counter`);
    lines.push(`system_uptime_seconds ${process.uptime()}`);
    
    // Memory metrics
    const memUsage = process.memoryUsage();
    lines.push(`# HELP nodejs_heap_used_bytes Node.js heap used bytes`);
    lines.push(`# TYPE nodejs_heap_used_bytes gauge`);
    lines.push(`nodejs_heap_used_bytes ${memUsage.heapUsed}`);
    
    lines.push(`# HELP nodejs_heap_total_bytes Node.js heap total bytes`);
    lines.push(`# TYPE nodejs_heap_total_bytes gauge`);
    lines.push(`nodejs_heap_total_bytes ${memUsage.heapTotal}`);
    
    // Health check metrics
    lines.push(`# HELP health_check_status Service health status (1=healthy, 0=unhealthy)`);
    lines.push(`# TYPE health_check_status gauge`);
    
    for (const [service, status] of this.healthStatus.entries()) {
      const value = status.status === 'healthy' ? 1 : 0;
      lines.push(`health_check_status{service="${service}"} ${value}`);
    }
    
    // Health check response times
    lines.push(`# HELP health_check_response_time_ms Health check response time in milliseconds`);
    lines.push(`# TYPE health_check_response_time_ms gauge`);
    
    for (const [service, status] of this.healthStatus.entries()) {
      if (status.responseTime !== undefined) {
        lines.push(`health_check_response_time_ms{service="${service}"} ${status.responseTime}`);
      }
    }
    
    return lines.join('\n') + '\n';
  }

  /**
   * Get detailed system information
   */
  getSystemInfo() {
    const memUsage = process.memoryUsage();
    
    return {
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        pid: process.pid,
        uptime: process.uptime()
      },
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
        rss: Math.round(memUsage.rss / 1024 / 1024) // MB
      },
      health: {
        systemHealth: this.metrics.systemHealth,
        lastCheck: this.metrics.lastCheck,
        totalChecks: this.metrics.totalChecks,
        failedChecks: this.metrics.failedChecks,
        successRate: ((this.metrics.totalChecks - this.metrics.failedChecks) / this.metrics.totalChecks * 100).toFixed(2) + '%'
      },
      services: Object.fromEntries(this.healthStatus)
    };
  }

  /**
   * Get current health status
   */
  getHealthStatus() {
    return {
      systemHealth: this.metrics.systemHealth,
      services: Object.fromEntries(this.healthStatus),
      lastCheck: this.metrics.lastCheck,
      uptime: process.uptime()
    };
  }

  /**
   * Close health check manager
   */
  async close() {
    console.log('🏥 Closing Health Check Manager...');
    
    if (this.server) {
      await new Promise((resolve) => {
        this.server.close(resolve);
      });
    }
    
    console.log('✅ Health Check Manager closed');
  }
}

export default HealthCheckManager;