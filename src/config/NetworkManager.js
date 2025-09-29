/**
 * Network Manager for Multi-Chain Support
 * Handles dynamic network switching, RPC provider health monitoring, and failover
 */

import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import networks from './networks.js';
import { validateRpcConnectivity } from './validator.js';

/**
 * Network Manager with advanced multi-chain capabilities
 */
export class NetworkManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.networks = networks;
    this.providers = new Map(); // Network name -> provider instances
    this.providerHealth = new Map(); // Provider URL -> health metrics
    this.currentNetwork = null;
    this.connectionPools = new Map(); // Network -> connection pool
    
    // Options
    this.options = {
      healthCheckInterval: options.healthCheckInterval || 30000, // 30 seconds
      maxRetries: options.maxRetries || 3,
      timeoutMs: options.timeoutMs || 5000,
      enableHealthMonitoring: options.enableHealthMonitoring !== false,
      enableConnectionPooling: options.enableConnectionPooling !== false,
      maxConnectionsPerPool: options.maxConnectionsPerPool || 10,
      latencyThreshold: options.latencyThreshold || 1000, // 1 second
      enableAutoFailover: options.enableAutoFailover !== false,
      ...options
    };

    this.healthCheckTimer = null;
    this.latencyMetrics = new Map(); // Provider URL -> latency history
    
    this.initialize();
  }

  /**
   * Initialize the network manager
   */
  async initialize() {
    console.log('🌐 Initializing NetworkManager...');
    
    try {
      // Initialize providers for enabled networks
      await this.initializeProviders();
      
      // Start health monitoring
      if (this.options.enableHealthMonitoring) {
        this.startHealthMonitoring();
      }
      
      // Set default network
      const enabledNetworks = Object.entries(this.networks)
        .filter(([_, config]) => config.enabled);
      
      if (enabledNetworks.length > 0) {
        await this.switchToNetwork(enabledNetworks[0][0]);
      }
      
      console.log('✅ NetworkManager initialized');
      this.emit('initialized');

    } catch (error) {
      console.error('❌ Failed to initialize NetworkManager:', error.message);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Initialize providers for all enabled networks
   */
  async initializeProviders() {
    const initPromises = [];

    for (const [networkName, networkConfig] of Object.entries(this.networks)) {
      if (!networkConfig.enabled) {
        continue;
      }

      initPromises.push(this.initializeNetworkProviders(networkName, networkConfig));
    }

    await Promise.allSettled(initPromises);
  }

  /**
   * Initialize providers for a specific network
   */
  async initializeNetworkProviders(networkName, networkConfig) {
    const providers = [];
    
    for (let i = 0; i < networkConfig.rpcUrls.length; i++) {
      const rpcUrl = networkConfig.rpcUrls[i];
      
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl, {
          chainId: networkConfig.chainId,
          name: networkConfig.name
        });

        // Test initial connectivity
        const healthCheck = await this.checkProviderHealth(provider, rpcUrl, networkConfig.chainId);
        
        providers.push({
          provider,
          url: rpcUrl,
          priority: i + 1,
          health: healthCheck,
          isHealthy: healthCheck.isHealthy,
          lastUsed: 0,
          requestCount: 0,
          errorCount: 0
        });

        // Initialize health metrics
        this.providerHealth.set(rpcUrl, {
          isHealthy: healthCheck.isHealthy,
          latency: healthCheck.latency || 0,
          lastCheck: Date.now(),
          consecutiveFailures: 0,
          totalRequests: 0,
          successfulRequests: 0,
          errorRate: 0
        });

        console.log(`✅ Initialized provider for ${networkName}: ${rpcUrl.substring(0, 50)}...`);

      } catch (error) {
        console.warn(`⚠️ Failed to initialize provider ${rpcUrl}:`, error.message);
        
        // Still track failed providers for potential recovery
        this.providerHealth.set(rpcUrl, {
          isHealthy: false,
          latency: 0,
          lastCheck: Date.now(),
          consecutiveFailures: 1,
          totalRequests: 0,
          successfulRequests: 0,
          errorRate: 1,
          error: error.message
        });
      }
    }

    if (providers.length > 0) {
      this.providers.set(networkName, providers);
      
      // Initialize connection pool if enabled
      if (this.options.enableConnectionPooling) {
        this.initializeConnectionPool(networkName, providers);
      }
    } else {
      console.warn(`⚠️ No healthy providers found for network: ${networkName}`);
    }
  }

  /**
   * Initialize connection pool for a network
   */
  initializeConnectionPool(networkName, providers) {
    const pool = {
      providers: providers.slice(), // Copy array
      activeConnections: 0,
      maxConnections: this.options.maxConnectionsPerPool,
      roundRobinIndex: 0
    };
    
    this.connectionPools.set(networkName, pool);
  }

  /**
   * Get the best available provider for a network
   */
  getBestProvider(networkName = this.currentNetwork) {
    if (!networkName) {
      throw new Error('No network specified and no current network set');
    }

    const providers = this.providers.get(networkName);
    if (!providers || providers.length === 0) {
      throw new Error(`No providers available for network: ${networkName}`);
    }

    // Filter healthy providers
    const healthyProviders = providers.filter(p => p.isHealthy);
    
    if (healthyProviders.length === 0) {
      // No healthy providers, try to use any available provider
      console.warn(`⚠️ No healthy providers for ${networkName}, using fallback`);
      return providers[0];
    }

    // Sort by priority and latency
    const sortedProviders = healthyProviders.sort((a, b) => {
      const aHealth = this.providerHealth.get(a.url);
      const bHealth = this.providerHealth.get(b.url);
      
      // Primary sort by priority
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      
      // Secondary sort by latency
      return (aHealth?.latency || 1000) - (bHealth?.latency || 1000);
    });

    return sortedProviders[0];
  }

  /**
   * Switch to a different network
   */
  async switchToNetwork(networkName) {
    if (!this.networks[networkName]) {
      throw new Error(`Unknown network: ${networkName}`);
    }

    if (!this.networks[networkName].enabled) {
      throw new Error(`Network ${networkName} is not enabled`);
    }

    if (!this.providers.has(networkName)) {
      throw new Error(`No providers available for network: ${networkName}`);
    }

    const previousNetwork = this.currentNetwork;
    this.currentNetwork = networkName;
    
    console.log(`🔄 Switched to network: ${networkName} (Chain ID: ${this.networks[networkName].chainId})`);
    
    this.emit('networkChanged', {
      previous: previousNetwork,
      current: networkName,
      chainId: this.networks[networkName].chainId,
      timestamp: Date.now()
    });

    return this.getBestProvider(networkName);
  }

  /**
   * Execute RPC call with automatic failover
   */
  async executeCall(method, params = [], options = {}) {
    const networkName = options.network || this.currentNetwork;
    const maxRetries = options.maxRetries || this.options.maxRetries;
    
    if (!networkName) {
      throw new Error('No network specified');
    }

    const providers = this.providers.get(networkName);
    if (!providers || providers.length === 0) {
      throw new Error(`No providers available for network: ${networkName}`);
    }

    let lastError;
    let attempts = 0;

    // Try each provider in order of preference
    for (const providerInfo of providers) {
      if (attempts >= maxRetries) {
        break;
      }

      try {
        const startTime = Date.now();
        const result = await this.executeCallOnProvider(
          providerInfo.provider,
          method,
          params,
          options
        );
        
        const latency = Date.now() - startTime;
        
        // Update metrics
        this.updateProviderMetrics(providerInfo.url, true, latency);
        providerInfo.lastUsed = Date.now();
        providerInfo.requestCount++;

        return result;

      } catch (error) {
        lastError = error;
        attempts++;
        
        // Update metrics
        this.updateProviderMetrics(providerInfo.url, false);
        providerInfo.errorCount++;
        
        console.warn(`⚠️ RPC call failed on ${providerInfo.url}: ${error.message}`);
        
        // Mark provider as unhealthy if too many consecutive failures
        const health = this.providerHealth.get(providerInfo.url);
        if (health) {
          health.consecutiveFailures++;
          if (health.consecutiveFailures >= 3) {
            providerInfo.isHealthy = false;
            health.isHealthy = false;
            console.warn(`⚠️ Provider marked as unhealthy: ${providerInfo.url}`);
          }
        }
      }
    }

    throw new Error(`All providers failed for network ${networkName}. Last error: ${lastError?.message}`);
  }

  /**
   * Execute RPC call on specific provider
   */
  async executeCallOnProvider(provider, method, params, options) {
    const timeout = options.timeout || this.options.timeoutMs;
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('RPC call timeout')), timeout);
    });

    const callPromise = provider.send(method, params);
    
    return Promise.race([callPromise, timeoutPromise]);
  }

  /**
   * Update provider metrics
   */
  updateProviderMetrics(providerUrl, success, latency = null) {
    const health = this.providerHealth.get(providerUrl);
    if (!health) return;

    health.totalRequests++;
    health.lastCheck = Date.now();

    if (success) {
      health.successfulRequests++;
      health.consecutiveFailures = 0;
      
      if (latency !== null) {
        health.latency = latency;
        
        // Update latency history
        if (!this.latencyMetrics.has(providerUrl)) {
          this.latencyMetrics.set(providerUrl, []);
        }
        const history = this.latencyMetrics.get(providerUrl);
        history.push(latency);
        
        // Keep only last 100 measurements
        if (history.length > 100) {
          history.shift();
        }
      }
    } else {
      health.consecutiveFailures++;
    }

    health.errorRate = 1 - (health.successfulRequests / health.totalRequests);
  }

  /**
   * Check provider health
   */
  async checkProviderHealth(provider, url, expectedChainId) {
    try {
      const startTime = Date.now();
      
      const [network, blockNumber] = await Promise.all([
        provider.getNetwork(),
        provider.getBlockNumber()
      ]);
      
      const latency = Date.now() - startTime;
      
      const isHealthy = Number(network.chainId) === expectedChainId && 
                       blockNumber > 0 && 
                       latency < this.options.latencyThreshold;

      return {
        isHealthy,
        latency,
        blockNumber,
        chainId: Number(network.chainId),
        timestamp: Date.now()
      };

    } catch (error) {
      return {
        isHealthy: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.options.healthCheckInterval);

    console.log('🔍 Health monitoring started');
  }

  /**
   * Perform health check on all providers
   */
  async performHealthCheck() {
    const healthPromises = [];

    for (const [networkName, providers] of this.providers.entries()) {
      const networkConfig = this.networks[networkName];
      
      for (const providerInfo of providers) {
        healthPromises.push(
          this.checkProviderHealth(providerInfo.provider, providerInfo.url, networkConfig.chainId)
            .then(health => {
              const oldHealth = providerInfo.isHealthy;
              providerInfo.isHealthy = health.isHealthy;
              this.providerHealth.set(providerInfo.url, {
                ...this.providerHealth.get(providerInfo.url),
                ...health
              });

              // Emit events for health changes
              if (oldHealth !== health.isHealthy) {
                this.emit('providerHealthChanged', {
                  network: networkName,
                  provider: providerInfo.url,
                  isHealthy: health.isHealthy,
                  timestamp: Date.now()
                });
              }
            })
            .catch(error => {
              console.warn(`Health check failed for ${providerInfo.url}:`, error.message);
            })
        );
      }
    }

    await Promise.allSettled(healthPromises);
  }

  /**
   * Get network statistics
   */
  getNetworkStats(networkName = null) {
    if (networkName) {
      return this.getSingleNetworkStats(networkName);
    }

    const stats = {};
    for (const [name] of this.providers.entries()) {
      stats[name] = this.getSingleNetworkStats(name);
    }
    return stats;
  }

  /**
   * Get statistics for a single network
   */
  getSingleNetworkStats(networkName) {
    const providers = this.providers.get(networkName);
    if (!providers) {
      return null;
    }

    const stats = {
      network: networkName,
      chainId: this.networks[networkName]?.chainId,
      totalProviders: providers.length,
      healthyProviders: providers.filter(p => p.isHealthy).length,
      providers: []
    };

    for (const provider of providers) {
      const health = this.providerHealth.get(provider.url);
      const latencyHistory = this.latencyMetrics.get(provider.url) || [];
      
      stats.providers.push({
        url: provider.url.substring(0, 50) + '...',
        priority: provider.priority,
        isHealthy: provider.isHealthy,
        requestCount: provider.requestCount,
        errorCount: provider.errorCount,
        successRate: provider.requestCount > 0 ? 
          ((provider.requestCount - provider.errorCount) / provider.requestCount * 100).toFixed(2) + '%' :
          'N/A',
        averageLatency: latencyHistory.length > 0 ?
          Math.round(latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length) + 'ms' :
          'N/A',
        lastUsed: provider.lastUsed ? new Date(provider.lastUsed).toISOString() : 'Never'
      });
    }

    return stats;
  }

  /**
   * Get current provider for network
   */
  getCurrentProvider(networkName = this.currentNetwork) {
    return this.getBestProvider(networkName)?.provider;
  }

  /**
   * Get supported networks
   */
  getSupportedNetworks() {
    return Object.entries(this.networks)
      .filter(([_, config]) => config.enabled)
      .map(([name, config]) => ({
        name,
        chainId: config.chainId,
        displayName: config.name,
        isTestnet: config.isTestnet,
        blockExplorer: config.blockExplorer,
        nativeCurrency: config.nativeCurrency
      }));
  }

  /**
   * Add new network dynamically
   */
  async addNetwork(networkName, networkConfig) {
    this.networks[networkName] = networkConfig;
    
    if (networkConfig.enabled) {
      await this.initializeNetworkProviders(networkName, networkConfig);
    }
    
    this.emit('networkAdded', { name: networkName, config: networkConfig });
  }

  /**
   * Remove network
   */
  removeNetwork(networkName) {
    if (this.currentNetwork === networkName) {
      throw new Error('Cannot remove currently active network');
    }

    delete this.networks[networkName];
    this.providers.delete(networkName);
    this.connectionPools.delete(networkName);
    
    this.emit('networkRemoved', { name: networkName });
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    this.providers.clear();
    this.providerHealth.clear();
    this.connectionPools.clear();
    this.latencyMetrics.clear();
    this.removeAllListeners();

    console.log('🧹 NetworkManager cleanup completed');
  }
}

// Create singleton instance
const networkManager = new NetworkManager();

export default networkManager;