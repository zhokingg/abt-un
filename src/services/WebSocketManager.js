import { EventEmitter } from 'events';
import { ethers } from 'ethers';

/**
 * WebSocketManager - Multi-provider WebSocket connection management
 * Handles connection health, failover, rate limiting, and message routing
 */
class WebSocketManager extends EventEmitter {
  constructor(providers = [], options = {}) {
    super();
    
    this.options = {
      maxReconnectAttempts: options.maxReconnectAttempts || 10,
      reconnectDelay: options.reconnectDelay || 5000,
      maxReconnectDelay: options.maxReconnectDelay || 30000,
      healthCheckInterval: options.healthCheckInterval || 30000,
      connectionTimeout: options.connectionTimeout || 10000,
      messageQueueSize: options.messageQueueSize || 1000,
      rateLimitRequests: options.rateLimitRequests || 100,
      rateLimitWindow: options.rateLimitWindow || 60000, // 1 minute
      enableCompression: options.enableCompression !== false,
      enableHeartbeat: options.enableHeartbeat !== false,
      heartbeatInterval: options.heartbeatInterval || 30000,
      ...options
    };
    
    // Provider configuration
    this.providers = providers.map((provider, index) => ({
      id: provider.id || `provider-${index}`,
      url: provider.url,
      priority: provider.priority || index,
      weight: provider.weight || 1,
      region: provider.region || 'unknown',
      rateLimit: provider.rateLimit || this.options.rateLimitRequests,
      
      // Connection state
      connection: null,
      status: 'disconnected', // disconnected, connecting, connected, error
      lastConnected: null,
      lastDisconnected: null,
      reconnectAttempts: 0,
      
      // Performance metrics
      latency: 0,
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      bytesReceived: 0,
      bytesSent: 0,
      
      // Rate limiting
      rateLimitWindow: [],
      rateLimitViolations: 0,
      
      // Health status
      isHealthy: true,
      lastHealthCheck: null,
      consecutiveFailures: 0
    }));
    
    // Connection management
    this.activeConnections = new Map();
    this.primaryProvider = null;
    this.failoverProvider = null;
    
    // Message handling
    this.messageQueue = [];
    this.pendingRequests = new Map();
    this.requestIdCounter = 0;
    
    // Subscription management
    this.subscriptions = new Map();
    this.subscriptionHandlers = new Map();
    
    // Performance monitoring
    this.metrics = {
      totalConnections: 0,
      successfulConnections: 0,
      failedConnections: 0,
      totalReconnections: 0,
      totalMessages: 0,
      totalErrors: 0,
      averageLatency: 0,
      uptime: Date.now(),
      lastUpdate: null
    };
    
    // Health monitoring
    this.healthCheckTimer = null;
    this.heartbeatTimer = null;
    
    this.isActive = false;
  }
  
  /**
   * Initialize WebSocket manager
   */
  async initialize() {
    try {
      console.log('🌐 Initializing WebSocketManager...');
      console.log(`  Providers: ${this.providers.length}`);
      
      // Sort providers by priority
      this.providers.sort((a, b) => a.priority - b.priority);
      
      // Initialize all providers
      await this.initializeProviders();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Start heartbeat if enabled
      if (this.options.enableHeartbeat) {
        this.startHeartbeat();
      }
      
      this.isActive = true;
      console.log('✅ WebSocketManager initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize WebSocketManager:', error);
      throw error;
    }
  }
  
  /**
   * Initialize all providers
   */
  async initializeProviders() {
    const connectionPromises = this.providers.map(provider => 
      this.connectProvider(provider)
    );
    
    const results = await Promise.allSettled(connectionPromises);
    
    let successCount = 0;
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        successCount++;
      } else {
        console.error(`Failed to connect to provider ${this.providers[index].id}:`, 
          result.reason);
      }
    });
    
    if (successCount === 0) {
      throw new Error('Failed to connect to any WebSocket provider');
    }
    
    // Select primary provider (highest priority connected provider)
    this.selectPrimaryProvider();
    
    console.log(`🔗 Connected to ${successCount}/${this.providers.length} providers`);
  }
  
  /**
   * Connect to a specific provider
   */
  async connectProvider(provider) {
    return new Promise((resolve, reject) => {
      try {
        console.log(`🔌 Connecting to ${provider.id} (${provider.url})`);
        
        provider.status = 'connecting';
        this.metrics.totalConnections++;
        
        // Create WebSocket provider with timeout
        const connectionTimeout = setTimeout(() => {
          provider.status = 'error';
          this.metrics.failedConnections++;
          reject(new Error(`Connection timeout for ${provider.id}`));
        }, this.options.connectionTimeout);
        
        // Use ethers WebSocketProvider
        const wsProvider = new ethers.WebSocketProvider(provider.url);
        
        // Set up event handlers
        wsProvider._websocket.onopen = () => {
          clearTimeout(connectionTimeout);
          
          provider.connection = wsProvider;
          provider.status = 'connected';
          provider.lastConnected = Date.now();
          provider.reconnectAttempts = 0;
          provider.isHealthy = true;
          
          this.activeConnections.set(provider.id, provider);
          this.metrics.successfulConnections++;
          
          this.setupProviderEventHandlers(provider);
          
          console.log(`✅ Connected to ${provider.id}`);
          
          this.emit('providerConnected', {
            providerId: provider.id,
            url: provider.url,
            timestamp: Date.now()
          });
          
          resolve(true);
        };
        
        wsProvider._websocket.onerror = (error) => {
          clearTimeout(connectionTimeout);
          
          provider.status = 'error';
          provider.errorCount++;
          provider.consecutiveFailures++;
          
          this.metrics.failedConnections++;
          this.metrics.totalErrors++;
          
          console.error(`❌ Connection error for ${provider.id}:`, error);
          
          this.emit('providerError', {
            providerId: provider.id,
            error: error.message,
            timestamp: Date.now()
          });
          
          reject(error);
        };
        
        wsProvider._websocket.onclose = (event) => {
          this.handleProviderDisconnection(provider, event);
        };
        
      } catch (error) {
        provider.status = 'error';
        this.metrics.failedConnections++;
        reject(error);
      }
    });
  }
  
  /**
   * Setup event handlers for a provider
   */
  setupProviderEventHandlers(provider) {
    const wsProvider = provider.connection;
    
    // Handle incoming messages
    wsProvider._websocket.onmessage = (event) => {
      this.handleProviderMessage(provider, event.data);
    };
    
    // Handle network events
    wsProvider.on('network', (newNetwork, oldNetwork) => {
      this.emit('networkChanged', {
        providerId: provider.id,
        newNetwork,
        oldNetwork,
        timestamp: Date.now()
      });
    });
    
    // Handle block events
    wsProvider.on('block', (blockNumber) => {
      this.updateProviderLatency(provider);
      
      this.emit('block', {
        providerId: provider.id,
        blockNumber,
        timestamp: Date.now()
      });
    });
  }
  
  /**
   * Handle provider message
   */
  handleProviderMessage(provider, data) {
    try {
      provider.bytesReceived += data.length;
      this.metrics.totalMessages++;
      
      const message = JSON.parse(data);
      
      // Handle JSON-RPC responses
      if (message.id && this.pendingRequests.has(message.id)) {
        this.handleRPCResponse(provider, message);
      }
      
      // Handle subscription messages
      if (message.method === 'eth_subscription') {
        this.handleSubscriptionMessage(provider, message);
      }
      
      // Emit raw message event
      this.emit('message', {
        providerId: provider.id,
        message,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error(`Error handling message from ${provider.id}:`, error);
      provider.errorCount++;
    }
  }
  
  /**
   * Handle RPC response
   */
  handleRPCResponse(provider, message) {
    const pendingRequest = this.pendingRequests.get(message.id);
    if (!pendingRequest) return;
    
    this.pendingRequests.delete(message.id);
    
    // Calculate latency
    const latency = Date.now() - pendingRequest.timestamp;
    this.updateProviderLatency(provider, latency);
    
    if (message.error) {
      provider.errorCount++;
      pendingRequest.reject(new Error(message.error.message));
    } else {
      provider.successCount++;
      pendingRequest.resolve(message.result);
    }
  }
  
  /**
   * Handle subscription message
   */
  handleSubscriptionMessage(provider, message) {
    const subscriptionId = message.params.subscription;
    const handler = this.subscriptionHandlers.get(subscriptionId);
    
    if (handler) {
      try {
        handler(message.params.result);
      } catch (error) {
        console.error(`Error in subscription handler:`, error);
      }
    }
    
    this.emit('subscription', {
      providerId: provider.id,
      subscriptionId,
      data: message.params.result,
      timestamp: Date.now()
    });
  }
  
  /**
   * Update provider latency metrics
   */
  updateProviderLatency(provider, latency = null) {
    if (latency !== null) {
      provider.latency = (provider.latency + latency) / 2;
    }
    
    // Update global average latency
    const totalLatency = this.providers.reduce((sum, p) => sum + p.latency, 0);
    this.metrics.averageLatency = totalLatency / this.providers.length;
    this.metrics.lastUpdate = Date.now();
  }
  
  /**
   * Handle provider disconnection
   */
  handleProviderDisconnection(provider, event) {
    provider.status = 'disconnected';
    provider.lastDisconnected = Date.now();
    provider.consecutiveFailures++;
    
    this.activeConnections.delete(provider.id);
    
    console.warn(`🔌 Provider ${provider.id} disconnected (code: ${event.code})`);
    
    this.emit('providerDisconnected', {
      providerId: provider.id,
      code: event.code,
      reason: event.reason,
      timestamp: Date.now()
    });
    
    // Attempt reconnection
    this.scheduleReconnection(provider);
    
    // Switch to failover if this was the primary provider
    if (this.primaryProvider && this.primaryProvider.id === provider.id) {
      this.handlePrimaryProviderFailover();
    }
  }
  
  /**
   * Schedule provider reconnection
   */
  scheduleReconnection(provider) {
    if (provider.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error(`❌ Max reconnection attempts reached for ${provider.id}`);
      provider.isHealthy = false;
      return;
    }
    
    const delay = Math.min(
      this.options.reconnectDelay * Math.pow(2, provider.reconnectAttempts),
      this.options.maxReconnectDelay
    );
    
    provider.reconnectAttempts++;
    
    setTimeout(async () => {
      if (provider.status === 'disconnected') {
        console.log(`🔄 Attempting to reconnect ${provider.id} (attempt ${provider.reconnectAttempts})`);
        
        try {
          await this.connectProvider(provider);
          this.metrics.totalReconnections++;
        } catch (error) {
          console.error(`Reconnection failed for ${provider.id}:`, error);
        }
      }
    }, delay);
  }
  
  /**
   * Handle primary provider failover
   */
  handlePrimaryProviderFailover() {
    console.warn('🚨 Primary provider failed, initiating failover...');
    
    // Find the next best provider
    const nextProvider = this.findBestProvider();
    
    if (nextProvider) {
      this.primaryProvider = nextProvider;
      this.failoverProvider = this.findBestProvider([nextProvider.id]);
      
      console.log(`✅ Failover complete. New primary: ${nextProvider.id}`);
      
      this.emit('failover', {
        oldProvider: this.primaryProvider?.id,
        newProvider: nextProvider.id,
        timestamp: Date.now()
      });
    } else {
      console.error('❌ No healthy providers available for failover');
      
      this.emit('allProvidersFailed', {
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Select primary provider
   */
  selectPrimaryProvider() {
    this.primaryProvider = this.findBestProvider();
    this.failoverProvider = this.findBestProvider([this.primaryProvider?.id]);
    
    if (this.primaryProvider) {
      console.log(`🎯 Selected primary provider: ${this.primaryProvider.id}`);
    }
  }
  
  /**
   * Find best available provider
   */
  findBestProvider(excludeIds = []) {
    const availableProviders = this.providers.filter(provider => 
      provider.status === 'connected' && 
      provider.isHealthy && 
      !excludeIds.includes(provider.id)
    );
    
    if (availableProviders.length === 0) return null;
    
    // Score providers based on multiple factors
    return availableProviders.reduce((best, provider) => {
      const score = this.calculateProviderScore(provider);
      const bestScore = best ? this.calculateProviderScore(best) : -1;
      
      return score > bestScore ? provider : best;
    }, null);
  }
  
  /**
   * Calculate provider quality score
   */
  calculateProviderScore(provider) {
    let score = 0;
    
    // Priority weight (higher priority = higher score)
    score += (10 - provider.priority) * 10;
    
    // Success rate weight
    const totalRequests = provider.successCount + provider.errorCount;
    const successRate = totalRequests > 0 ? provider.successCount / totalRequests : 1;
    score += successRate * 30;
    
    // Latency weight (lower latency = higher score)
    const latencyScore = Math.max(0, 1000 - provider.latency) / 10;
    score += latencyScore;
    
    // Consecutive failures penalty
    score -= provider.consecutiveFailures * 5;
    
    // Uptime bonus
    const uptime = provider.lastConnected ? 
      (Date.now() - provider.lastConnected) / 1000 / 60 : 0; // minutes
    score += Math.min(uptime / 10, 10); // Max 10 points for uptime
    
    return score;
  }
  
  /**
   * Send JSON-RPC request
   */
  async sendRequest(method, params = [], providerId = null) {
    const provider = providerId ? 
      this.providers.find(p => p.id === providerId) : 
      this.primaryProvider;
    
    if (!provider || provider.status !== 'connected') {
      throw new Error('No available provider for request');
    }
    
    // Check rate limiting
    if (!this.checkRateLimit(provider)) {
      throw new Error(`Rate limit exceeded for ${provider.id}`);
    }
    
    const requestId = ++this.requestIdCounter;
    const request = {
      jsonrpc: '2.0',
      id: requestId,
      method,
      params
    };
    
    return new Promise((resolve, reject) => {
      // Store pending request
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timestamp: Date.now(),
        provider: provider.id
      });
      
      // Send request
      try {
        const message = JSON.stringify(request);
        provider.connection._websocket.send(message);
        
        provider.requestCount++;
        provider.bytesSent += message.length;
        
        // Add to rate limit tracking
        provider.rateLimitWindow.push(Date.now());
        
      } catch (error) {
        this.pendingRequests.delete(requestId);
        reject(error);
      }
      
      // Set timeout
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 10000); // 10 second timeout
    });
  }
  
  /**
   * Check rate limiting for provider
   */
  checkRateLimit(provider) {
    const now = Date.now();
    const windowStart = now - this.options.rateLimitWindow;
    
    // Clean old entries
    provider.rateLimitWindow = provider.rateLimitWindow.filter(
      timestamp => timestamp > windowStart
    );
    
    if (provider.rateLimitWindow.length >= provider.rateLimit) {
      provider.rateLimitViolations++;
      return false;
    }
    
    return true;
  }
  
  /**
   * Subscribe to events
   */
  async subscribe(eventType, params = [], handler = null) {
    if (!this.primaryProvider) {
      throw new Error('No primary provider available for subscription');
    }
    
    try {
      const subscriptionId = await this.sendRequest('eth_subscribe', [eventType, ...params]);
      
      if (handler) {
        this.subscriptionHandlers.set(subscriptionId, handler);
      }
      
      this.subscriptions.set(subscriptionId, {
        eventType,
        params,
        handler,
        providerId: this.primaryProvider.id,
        timestamp: Date.now()
      });
      
      console.log(`📡 Subscribed to ${eventType} (ID: ${subscriptionId})`);
      
      return subscriptionId;
      
    } catch (error) {
      console.error(`Failed to subscribe to ${eventType}:`, error);
      throw error;
    }
  }
  
  /**
   * Unsubscribe from events
   */
  async unsubscribe(subscriptionId) {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription ${subscriptionId} not found`);
      }
      
      await this.sendRequest('eth_unsubscribe', [subscriptionId]);
      
      this.subscriptions.delete(subscriptionId);
      this.subscriptionHandlers.delete(subscriptionId);
      
      console.log(`📡 Unsubscribed from ${subscriptionId}`);
      
    } catch (error) {
      console.error(`Failed to unsubscribe from ${subscriptionId}:`, error);
      throw error;
    }
  }
  
  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthChecks();
    }, this.options.healthCheckInterval);
    
    console.log('❤️ Health monitoring started');
  }
  
  /**
   * Perform health checks on all providers
   */
  async performHealthChecks() {
    const healthPromises = this.providers
      .filter(provider => provider.status === 'connected')
      .map(provider => this.checkProviderHealth(provider));
    
    await Promise.allSettled(healthPromises);
  }
  
  /**
   * Check health of specific provider
   */
  async checkProviderHealth(provider) {
    try {
      const startTime = Date.now();
      
      // Simple health check: get latest block number
      await provider.connection.getBlockNumber();
      
      const latency = Date.now() - startTime;
      this.updateProviderLatency(provider, latency);
      
      provider.isHealthy = true;
      provider.consecutiveFailures = 0;
      provider.lastHealthCheck = Date.now();
      
    } catch (error) {
      console.warn(`❤️‍🩹 Health check failed for ${provider.id}:`, error.message);
      
      provider.consecutiveFailures++;
      provider.errorCount++;
      
      // Mark as unhealthy after multiple consecutive failures
      if (provider.consecutiveFailures >= 3) {
        provider.isHealthy = false;
        
        this.emit('providerUnhealthy', {
          providerId: provider.id,
          consecutiveFailures: provider.consecutiveFailures,
          timestamp: Date.now()
        });
      }
    }
  }
  
  /**
   * Start heartbeat
   */
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.options.heartbeatInterval);
    
    console.log('💓 Heartbeat started');
  }
  
  /**
   * Send heartbeat to all connected providers
   */
  sendHeartbeat() {
    for (const provider of this.providers) {
      if (provider.status === 'connected' && provider.connection) {
        try {
          // Send ping frame
          provider.connection._websocket.ping();
        } catch (error) {
          console.warn(`Heartbeat failed for ${provider.id}:`, error);
        }
      }
    }
  }
  
  /**
   * Get connection statistics
   */
  getStats() {
    const connectedProviders = this.providers.filter(p => p.status === 'connected').length;
    const healthyProviders = this.providers.filter(p => p.isHealthy).length;
    
    return {
      ...this.metrics,
      providers: {
        total: this.providers.length,
        connected: connectedProviders,
        healthy: healthyProviders,
        primary: this.primaryProvider?.id || null,
        failover: this.failoverProvider?.id || null
      },
      subscriptions: this.subscriptions.size,
      pendingRequests: this.pendingRequests.size,
      messageQueueSize: this.messageQueue.length
    };
  }
  
  /**
   * Get detailed provider statistics
   */
  getProviderStats() {
    return this.providers.map(provider => ({
      id: provider.id,
      url: provider.url,
      status: provider.status,
      isHealthy: provider.isHealthy,
      priority: provider.priority,
      latency: Math.round(provider.latency),
      requestCount: provider.requestCount,
      successRate: provider.requestCount > 0 ? 
        ((provider.successCount / provider.requestCount) * 100).toFixed(1) + '%' : 'N/A',
      errorCount: provider.errorCount,
      reconnectAttempts: provider.reconnectAttempts,
      consecutiveFailures: provider.consecutiveFailures,
      bytesReceived: provider.bytesReceived,
      bytesSent: provider.bytesSent,
      uptime: provider.lastConnected ? 
        Math.round((Date.now() - provider.lastConnected) / 1000) : 0
    }));
  }
  
  /**
   * Shutdown WebSocket manager
   */
  async shutdown() {
    console.log('🛑 Shutting down WebSocketManager...');
    
    this.isActive = false;
    
    // Stop timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    
    // Disconnect all providers
    for (const provider of this.providers) {
      if (provider.connection) {
        try {
          await provider.connection.destroy();
        } catch (error) {
          console.error(`Error disconnecting ${provider.id}:`, error);
        }
      }
    }
    
    // Clear data structures
    this.activeConnections.clear();
    this.pendingRequests.clear();
    this.subscriptions.clear();
    this.subscriptionHandlers.clear();
    
    console.log('✅ WebSocketManager shutdown complete');
  }
}

export default WebSocketManager;