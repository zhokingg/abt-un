import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import config from '../config/config.js';

/**
 * BlockchainProvider - Ethereum provider management with failover
 * Manages multiple RPC endpoints with automatic failover and load balancing
 */
class BlockchainProvider extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      healthCheckInterval: options.healthCheckInterval || 30000,
      failoverThreshold: options.failoverThreshold || 3,
      loadBalancing: options.loadBalancing !== false,
      ...options
    };
    
    // RPC endpoints configuration
    this.endpoints = this.initializeEndpoints(options.endpoints);
    this.currentEndpointIndex = 0;
    this.activeProvider = null;
    this.wallet = null;
    
    // Health monitoring
    this.endpointHealth = new Map();
    this.healthCheckTimer = null;
    
    // Performance metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      failovers: 0,
      averageResponseTime: 0,
      endpointStats: {},
      lastRequestTime: null
    };
    
    this.isConnected = false;
  }
  
  initializeEndpoints(customEndpoints) {
    const defaultEndpoints = config.PHASE4?.RPC_ENDPOINTS || [
      {
        url: config.RPC_URL,
        region: 'primary',
        priority: 1
      }
    ];
    
    const endpoints = customEndpoints || defaultEndpoints;
    
    return endpoints.map((endpoint, index) => ({
      id: `endpoint_${index}`,
      ...endpoint,
      provider: null,
      isHealthy: true,
      consecutiveFailures: 0,
      lastUsed: 0,
      responseTime: 0,
      requestCount: 0
    }));
  }
  
  async initialize() {
    try {
      console.log('🌐 Initializing Blockchain Provider...');
      console.log(`   Available endpoints: ${this.endpoints.length}`);
      console.log(`   Load balancing: ${this.options.loadBalancing ? 'enabled' : 'disabled'}`);
      console.log(`   Health checks: every ${this.options.healthCheckInterval}ms`);
      
      // Initialize all endpoints
      for (const endpoint of this.endpoints) {
        try {
          endpoint.provider = new ethers.JsonRpcProvider(endpoint.url);
          this.endpointHealth.set(endpoint.id, {
            isHealthy: true,
            lastCheck: Date.now(),
            consecutiveFailures: 0,
            averageResponseTime: 0
          });
          
          this.metrics.endpointStats[endpoint.id] = {
            requests: 0,
            successes: 0,
            failures: 0,
            averageResponseTime: 0
          };
        } catch (error) {
          console.warn(`⚠️ Failed to initialize endpoint ${endpoint.id}:`, error.message);
          endpoint.isHealthy = false;
        }
      }
      
      // Set initial active provider
      await this.selectActiveProvider();
      
      // Set up wallet if private key is available
      if (config.PRIVATE_KEY && this.activeProvider) {
        this.wallet = new ethers.Wallet(config.PRIVATE_KEY, this.activeProvider);
        console.log(`👛 Wallet initialized: ${await this.wallet.getAddress()}`);
      }
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      this.isConnected = true;
      this.startTime = Date.now();
      this.emit('initialized');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Blockchain Provider:', error.message);
      throw error;
    }
  }
  
  async selectActiveProvider() {
    const healthyEndpoints = this.endpoints.filter(ep => ep.isHealthy);
    
    if (healthyEndpoints.length === 0) {
      throw new Error('No healthy endpoints available');
    }
    
    let selectedEndpoint;
    
    if (this.options.loadBalancing) {
      // Select endpoint with lowest load
      selectedEndpoint = healthyEndpoints.reduce((best, current) => 
        current.requestCount < best.requestCount ? current : best
      );
    } else {
      // Select by priority
      selectedEndpoint = healthyEndpoints.sort((a, b) => a.priority - b.priority)[0];
    }
    
    if (this.activeProvider !== selectedEndpoint.provider) {
      console.log(`🔄 Switching to endpoint: ${selectedEndpoint.id} (${selectedEndpoint.region})`);
      this.activeProvider = selectedEndpoint.provider;
      this.currentEndpointIndex = this.endpoints.indexOf(selectedEndpoint);
      
      // Update wallet provider if exists
      if (this.wallet) {
        this.wallet = this.wallet.connect(this.activeProvider);
      }
      
      this.emit('providerChanged', {
        endpointId: selectedEndpoint.id,
        region: selectedEndpoint.region
      });
    }
  }
  
  async executeWithFailover(operation, retries = this.options.maxRetries) {
    this.metrics.totalRequests++;
    const startTime = Date.now();
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      const currentEndpoint = this.endpoints[this.currentEndpointIndex];
      
      try {
        // Update endpoint stats
        currentEndpoint.requestCount++;
        currentEndpoint.lastUsed = Date.now();
        
        // Execute the operation
        const result = await operation(this.activeProvider);
        
        // Record success
        const responseTime = Date.now() - startTime;
        this.recordSuccess(currentEndpoint.id, responseTime);
        
        return result;
        
      } catch (error) {
        console.warn(`⚠️ Request failed on ${currentEndpoint.id} (attempt ${attempt + 1}):`, error.message);
        
        // Record failure
        this.recordFailure(currentEndpoint.id);
        
        // If this was the last attempt, throw the error
        if (attempt === retries) {
          this.metrics.failedRequests++;
          throw error;
        }
        
        // Try to failover to next healthy endpoint
        try {
          await this.failoverToNextEndpoint();
        } catch (failoverError) {
          console.error('❌ Failover failed:', failoverError.message);
          throw error; // Throw original error if failover fails
        }
        
        // Wait before retrying
        await this.sleep(this.options.retryDelay * (attempt + 1));
      }
    }
  }
  
  async failoverToNextEndpoint() {
    const currentEndpoint = this.endpoints[this.currentEndpointIndex];
    currentEndpoint.consecutiveFailures++;
    
    // Mark endpoint as unhealthy if too many failures
    if (currentEndpoint.consecutiveFailures >= this.options.failoverThreshold) {
      console.log(`❌ Marking endpoint ${currentEndpoint.id} as unhealthy`);
      currentEndpoint.isHealthy = false;
      this.endpointHealth.get(currentEndpoint.id).isHealthy = false;
    }
    
    // Find next healthy endpoint
    const healthyEndpoints = this.endpoints.filter(ep => ep.isHealthy);
    
    if (healthyEndpoints.length === 0) {
      throw new Error('No healthy endpoints available for failover');
    }
    
    // Select next endpoint
    await this.selectActiveProvider();
    this.metrics.failovers++;
    
    console.log(`🔄 Failed over to endpoint: ${this.endpoints[this.currentEndpointIndex].id}`);
  }
  
  recordSuccess(endpointId, responseTime) {
    const endpoint = this.endpoints.find(ep => ep.id === endpointId);
    if (endpoint) {
      endpoint.consecutiveFailures = 0;
      endpoint.responseTime = responseTime;
    }
    
    const health = this.endpointHealth.get(endpointId);
    if (health) {
      health.isHealthy = true;
      health.averageResponseTime = (health.averageResponseTime + responseTime) / 2;
    }
    
    const stats = this.metrics.endpointStats[endpointId];
    if (stats) {
      stats.requests++;
      stats.successes++;
      stats.averageResponseTime = (stats.averageResponseTime + responseTime) / 2;
    }
    
    this.metrics.successfulRequests++;
    this.metrics.averageResponseTime = (this.metrics.averageResponseTime + responseTime) / 2;
    this.metrics.lastRequestTime = Date.now();
  }
  
  recordFailure(endpointId) {
    const stats = this.metrics.endpointStats[endpointId];
    if (stats) {
      stats.requests++;
      stats.failures++;
    }
  }
  
  startHealthMonitoring() {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks();
    }, this.options.healthCheckInterval);
    
    console.log('🏥 Health monitoring started');
  }
  
  async performHealthChecks() {
    const checkPromises = this.endpoints.map(endpoint => 
      this.checkEndpointHealth(endpoint).catch(error => {
        console.warn(`Health check failed for ${endpoint.id}:`, error.message);
        return false;
      })
    );
    
    const results = await Promise.allSettled(checkPromises);
    
    let healthyCount = 0;
    results.forEach((result, index) => {
      const endpoint = this.endpoints[index];
      const isHealthy = result.status === 'fulfilled' && result.value;
      
      endpoint.isHealthy = isHealthy;
      if (isHealthy) {
        healthyCount++;
        endpoint.consecutiveFailures = 0;
      }
      
      const health = this.endpointHealth.get(endpoint.id);
      if (health) {
        health.isHealthy = isHealthy;
        health.lastCheck = Date.now();
        if (!isHealthy) {
          health.consecutiveFailures++;
        }
      }
    });
    
    this.emit('healthCheckCompleted', {
      totalEndpoints: this.endpoints.length,
      healthyEndpoints: healthyCount,
      timestamp: Date.now()
    });
    
    // Switch provider if current one is unhealthy
    const currentEndpoint = this.endpoints[this.currentEndpointIndex];
    if (!currentEndpoint.isHealthy && healthyCount > 0) {
      try {
        await this.selectActiveProvider();
      } catch (error) {
        console.error('❌ Failed to switch to healthy provider:', error.message);
      }
    }
  }
  
  async checkEndpointHealth(endpoint) {
    if (!endpoint.provider) return false;
    
    try {
      const startTime = Date.now();
      const blockNumber = await endpoint.provider.getBlockNumber();
      const responseTime = Date.now() - startTime;
      
      // Consider healthy if responds within reasonable time and returns valid block number
      const isHealthy = responseTime < 5000 && blockNumber > 0;
      
      if (isHealthy) {
        const health = this.endpointHealth.get(endpoint.id);
        if (health) {
          health.averageResponseTime = (health.averageResponseTime + responseTime) / 2;
        }
      }
      
      return isHealthy;
    } catch (error) {
      return false;
    }
  }
  
  // Wrapper methods for common provider operations
  async getBlockNumber() {
    return this.executeWithFailover(provider => provider.getBlockNumber());
  }
  
  async getBlock(blockHashOrBlockTag, includeTransactions = false) {
    return this.executeWithFailover(provider => 
      provider.getBlock(blockHashOrBlockTag, includeTransactions)
    );
  }
  
  async getTransaction(hash) {
    return this.executeWithFailover(provider => provider.getTransaction(hash));
  }
  
  async getTransactionReceipt(hash) {
    return this.executeWithFailover(provider => provider.getTransactionReceipt(hash));
  }
  
  async getFeeData() {
    return this.executeWithFailover(provider => provider.getFeeData());
  }
  
  async getBalance(address, blockTag = 'latest') {
    return this.executeWithFailover(provider => provider.getBalance(address, blockTag));
  }
  
  async sendTransaction(transaction) {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }
    
    return this.executeWithFailover(async (provider) => {
      const tx = await this.wallet.sendTransaction(transaction);
      return tx;
    });
  }
  
  async call(transaction, blockTag = 'latest') {
    return this.executeWithFailover(provider => provider.call(transaction, blockTag));
  }
  
  async estimateGas(transaction) {
    return this.executeWithFailover(provider => provider.estimateGas(transaction));
  }
  
  getProvider() {
    return this.activeProvider;
  }
  
  getWallet() {
    return this.wallet;
  }
  
  getEndpointStatus() {
    return this.endpoints.map(endpoint => ({
      id: endpoint.id,
      url: endpoint.url,
      region: endpoint.region,
      priority: endpoint.priority,
      isHealthy: endpoint.isHealthy,
      isActive: endpoint === this.endpoints[this.currentEndpointIndex],
      consecutiveFailures: endpoint.consecutiveFailures,
      requestCount: endpoint.requestCount,
      lastUsed: endpoint.lastUsed,
      responseTime: endpoint.responseTime
    }));
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalRequests > 0 ? 
        (this.metrics.successfulRequests / this.metrics.totalRequests) * 100 : 0,
      currentEndpoint: this.endpoints[this.currentEndpointIndex]?.id,
      healthyEndpoints: this.endpoints.filter(ep => ep.isHealthy).length,
      totalEndpoints: this.endpoints.length,
      uptime: this.isConnected ? Date.now() - (this.startTime || Date.now()) : 0
    };
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  shutdown() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    // Clean up providers
    for (const endpoint of this.endpoints) {
      if (endpoint.provider) {
        endpoint.provider.removeAllListeners();
      }
    }
    
    this.isConnected = false;
    
    console.log('🌐 Blockchain Provider shutdown complete');
    this.emit('shutdown');
  }
}

export default BlockchainProvider;