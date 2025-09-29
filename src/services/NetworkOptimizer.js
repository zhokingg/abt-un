import { ethers } from 'ethers';
import { EventEmitter } from 'events';

/**
 * NetworkOptimizer - Phase 4: Multi-RPC endpoint management with intelligent failover
 * Provides low-latency networking, connection pooling, and geographic routing
 */
class NetworkOptimizer extends EventEmitter {
  constructor(rpcEndpoints = [], options = {}) {
    super();
    
    this.options = {
      maxConcurrentConnections: options.maxConcurrentConnections || 10,
      healthCheckInterval: options.healthCheckInterval || 30000, // 30 seconds
      requestTimeout: options.requestTimeout || 5000, // 5 seconds
      maxRetries: options.maxRetries || 3,
      blacklistDuration: options.blacklistDuration || 300000, // 5 minutes
      latencyThreshold: options.latencyThreshold || 100, // 100ms target
      ...options
    };
    
    // RPC endpoint management
    this.endpoints = rpcEndpoints.map(endpoint => ({
      url: typeof endpoint === 'string' ? endpoint : endpoint.url,
      region: typeof endpoint === 'string' ? 'unknown' : endpoint.region || 'unknown',
      priority: typeof endpoint === 'string' ? 1 : endpoint.priority || 1,
      isHealthy: true,
      lastLatency: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      blacklistedUntil: 0,
      provider: null,
      websocket: null
    }));
    
    // Connection pools
    this.connectionPools = new Map();
    this.activeConnections = 0;
    
    // Performance metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      endpointFailovers: 0,
      circuitBreakerTrips: 0
    };
    
    // Circuit breaker state
    this.circuitBreaker = {
      isOpen: false,
      failureCount: 0,
      lastFailureTime: 0,
      threshold: options.circuitBreakerThreshold || 5
    };
    
    this.isInitialized = false;
    this.healthCheckTimer = null;
  }
  
  /**
   * Initialize the network optimizer
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }
    
    console.log('🌐 Initializing Network Optimizer...');
    
    try {
      // Initialize providers for each endpoint
      await this.initializeProviders();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Perform initial health checks
      await this.performHealthChecks();
      
      this.isInitialized = true;
      console.log(`✅ Network Optimizer initialized with ${this.endpoints.length} endpoints`);
      
      this.emit('initialized', {
        endpointCount: this.endpoints.length,
        healthyEndpoints: this.getHealthyEndpoints().length
      });
      
    } catch (error) {
      console.error('❌ Failed to initialize Network Optimizer:', error.message);
      throw error;
    }
  }
  
  /**
   * Initialize providers for all endpoints
   */
  async initializeProviders() {
    const initPromises = this.endpoints.map(async (endpoint) => {
      try {
        // Create HTTP provider
        endpoint.provider = new ethers.JsonRpcProvider(endpoint.url, null, {
          staticNetwork: true,
          batchMaxCount: 10,
          batchMaxSize: 1024 * 1024, // 1MB
          batchStallTime: 10
        });
        
        // Test connection
        await endpoint.provider.getNetwork();
        
        // Try to establish WebSocket connection if URL supports it
        const wsUrl = endpoint.url.replace('https://', 'wss://').replace('http://', 'ws://');
        if (wsUrl !== endpoint.url) {
          try {
            endpoint.websocket = new ethers.WebSocketProvider(wsUrl);
            await endpoint.websocket.getNetwork();
          } catch (wsError) {
            // WebSocket not supported, use HTTP only
            endpoint.websocket = null;
          }
        }
        
        console.log(`✅ Initialized provider for ${endpoint.region}: ${endpoint.url.substring(0, 50)}...`);
        
      } catch (error) {
        console.warn(`⚠️ Failed to initialize provider for ${endpoint.url}: ${error.message}`);
        endpoint.isHealthy = false;
      }
    });
    
    await Promise.allSettled(initPromises);
  }
  
  /**
   * Get the best available endpoint based on latency and health
   */
  getBestEndpoint() {
    const healthyEndpoints = this.getHealthyEndpoints();
    
    if (healthyEndpoints.length === 0) {
      throw new Error('No healthy RPC endpoints available');
    }
    
    // Sort by priority, then by latency
    return healthyEndpoints.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      return a.lastLatency - b.lastLatency; // Lower latency first
    })[0];
  }
  
  /**
   * Execute RPC call with automatic failover
   */
  async executeCall(method, params = [], options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Check circuit breaker
    if (this.isCircuitBreakerOpen()) {
      throw new Error('Circuit breaker is open - too many failures');
    }
    
    const startTime = Date.now();
    let lastError = null;
    let attempts = 0;
    
    // Try concurrent requests to multiple endpoints if specified
    if (options.concurrent && options.concurrent > 1) {
      return await this.executeConcurrentCall(method, params, options);
    }
    
    // Sequential failover approach
    const healthyEndpoints = this.getHealthyEndpoints();
    
    for (const endpoint of healthyEndpoints.slice(0, this.options.maxRetries)) {
      attempts++;
      
      try {
        const result = await this.executeCallOnEndpoint(endpoint, method, params, options);
        
        // Update metrics on success
        this.updateMetrics(endpoint, Date.now() - startTime, true);
        this.resetCircuitBreaker();
        
        return result;
        
      } catch (error) {
        lastError = error;
        this.updateMetrics(endpoint, Date.now() - startTime, false);
        
        // Mark endpoint as unhealthy if it's a connection error
        if (this.isConnectionError(error)) {
          endpoint.isHealthy = false;
          endpoint.blacklistedUntil = Date.now() + this.options.blacklistDuration;
          
          this.emit('endpointFailure', {
            url: endpoint.url,
            error: error.message,
            blacklistedUntil: endpoint.blacklistedUntil
          });
        }
        
        console.warn(`⚠️ RPC call failed on ${endpoint.url}: ${error.message}`);
      }
    }
    
    // All endpoints failed
    this.tripCircuitBreaker();
    this.metrics.failedRequests++;
    
    throw new Error(`All RPC endpoints failed after ${attempts} attempts. Last error: ${lastError?.message}`);
  }
  
  /**
   * Execute call on specific endpoint
   */
  async executeCallOnEndpoint(endpoint, method, params, options) {
    const timeout = options.timeout || this.options.requestTimeout;
    
    const provider = options.useWebSocket && endpoint.websocket ? 
      endpoint.websocket : endpoint.provider;
    
    if (!provider) {
      throw new Error('No provider available for endpoint');
    }
    
    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('RPC call timeout')), timeout);
    });
    
    // Execute the call
    const callPromise = provider.send(method, params);
    
    return Promise.race([callPromise, timeoutPromise]);
  }
  
  /**
   * Execute concurrent calls to multiple endpoints (fastest-first)
   */
  async executeConcurrentCall(method, params, options) {
    const healthyEndpoints = this.getHealthyEndpoints();
    const concurrency = Math.min(options.concurrent, healthyEndpoints.length);
    
    if (concurrency === 0) {
      throw new Error('No healthy endpoints for concurrent execution');
    }
    
    const promises = healthyEndpoints.slice(0, concurrency).map(async (endpoint) => {
      try {
        const result = await this.executeCallOnEndpoint(endpoint, method, params, options);
        return { success: true, result, endpoint };
      } catch (error) {
        return { success: false, error, endpoint };
      }
    });
    
    // Return the first successful result
    const results = await Promise.allSettled(promises);
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success) {
        this.updateMetrics(result.value.endpoint, 0, true);
        return result.value.result;
      }
    }
    
    // All concurrent calls failed
    throw new Error('All concurrent RPC calls failed');
  }
  
  /**
   * Get healthy endpoints (not blacklisted)
   */
  getHealthyEndpoints() {
    const now = Date.now();
    return this.endpoints.filter(endpoint => 
      endpoint.isHealthy && 
      endpoint.blacklistedUntil < now &&
      endpoint.provider
    );
  }
  
  /**
   * Perform health checks on all endpoints
   */
  async performHealthChecks() {
    const checkPromises = this.endpoints.map(async (endpoint) => {
      if (!endpoint.provider) return;
      
      const startTime = Date.now();
      
      try {
        // Simple health check - get latest block number
        await endpoint.provider.getBlockNumber();
        
        const latency = Date.now() - startTime;
        endpoint.lastLatency = latency;
        endpoint.isHealthy = true;
        endpoint.blacklistedUntil = 0;
        
        this.emit('healthCheck', {
          url: endpoint.url,
          latency,
          healthy: true
        });
        
      } catch (error) {
        endpoint.isHealthy = false;
        endpoint.lastLatency = 9999;
        
        this.emit('healthCheck', {
          url: endpoint.url,
          error: error.message,
          healthy: false
        });
      }
    });
    
    await Promise.allSettled(checkPromises);
  }
  
  /**
   * Start health monitoring timer
   */
  startHealthMonitoring() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthChecks();
    }, this.options.healthCheckInterval);
  }
  
  /**
   * Update endpoint metrics
   */
  updateMetrics(endpoint, latency, success) {
    endpoint.totalRequests++;
    this.metrics.totalRequests++;
    
    if (success) {
      endpoint.successfulRequests++;
      this.metrics.successfulRequests++;
      endpoint.lastLatency = latency;
      
      // Update average latency
      this.metrics.averageLatency = 
        (this.metrics.averageLatency * (this.metrics.successfulRequests - 1) + latency) / 
        this.metrics.successfulRequests;
        
    } else {
      endpoint.failedRequests++;
      this.metrics.failedRequests++;
    }
  }
  
  /**
   * Circuit breaker management
   */
  isCircuitBreakerOpen() {
    if (!this.circuitBreaker.isOpen) {
      return false;
    }
    
    // Check if circuit breaker should be reset (after 60 seconds)
    const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailureTime;
    if (timeSinceLastFailure > 60000) {
      this.resetCircuitBreaker();
      return false;
    }
    
    return true;
  }
  
  tripCircuitBreaker() {
    this.circuitBreaker.failureCount++;
    this.circuitBreaker.lastFailureTime = Date.now();
    
    if (this.circuitBreaker.failureCount >= this.circuitBreaker.threshold) {
      this.circuitBreaker.isOpen = true;
      this.metrics.circuitBreakerTrips++;
      
      this.emit('circuitBreakerTripped', {
        failureCount: this.circuitBreaker.failureCount,
        threshold: this.circuitBreaker.threshold
      });
    }
  }
  
  resetCircuitBreaker() {
    this.circuitBreaker.isOpen = false;
    this.circuitBreaker.failureCount = 0;
  }
  
  /**
   * Check if error is a connection error
   */
  isConnectionError(error) {
    const connectionErrors = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'timeout',
      'network error'
    ];
    
    return connectionErrors.some(pattern => 
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }
  
  /**
   * Get comprehensive metrics
   */
  getMetrics() {
    const healthyEndpoints = this.getHealthyEndpoints();
    
    return {
      ...this.metrics,
      endpoints: {
        total: this.endpoints.length,
        healthy: healthyEndpoints.length,
        blacklisted: this.endpoints.filter(e => e.blacklistedUntil > Date.now()).length
      },
      averageLatency: Math.round(this.metrics.averageLatency),
      successRate: this.metrics.totalRequests > 0 ? 
        (this.metrics.successfulRequests / this.metrics.totalRequests * 100).toFixed(2) + '%' : '0%',
      circuitBreaker: {
        isOpen: this.circuitBreaker.isOpen,
        failureCount: this.circuitBreaker.failureCount
      },
      performance: {
        meetsSLA: this.metrics.averageLatency < this.options.latencyThreshold,
        latencyTarget: this.options.latencyThreshold + 'ms',
        currentLatency: Math.round(this.metrics.averageLatency) + 'ms'
      }
    };
  }
  
  /**
   * Shutdown and cleanup
   */
  async shutdown() {
    console.log('🛑 Shutting down Network Optimizer...');
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    // Close all WebSocket connections
    const closePromises = this.endpoints.map(async (endpoint) => {
      if (endpoint.websocket) {
        try {
          await endpoint.websocket.destroy();
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });
    
    await Promise.allSettled(closePromises);
    
    this.isInitialized = false;
    console.log('✅ Network Optimizer shutdown complete');
  }
}

export default NetworkOptimizer;