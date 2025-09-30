import { EventEmitter } from 'events';

/**
 * Performance Optimization Manager
 * Handles caching, connection pooling, and resource optimization
 */
export class PerformanceOptimizer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      enableCaching: options.enableCaching !== false,
      enableConnectionPooling: options.enableConnectionPooling !== false,
      
      // Cache configuration
      cacheSize: options.cacheSize || 1000,
      cacheTTL: options.cacheTTL || 300000, // 5 minutes
      
      // Connection pool configuration
      maxConnections: options.maxConnections || 20,
      minConnections: options.minConnections || 5,
      connectionTimeout: options.connectionTimeout || 5000,
      
      // Memory optimization
      gcThreshold: options.gcThreshold || 0.8, // 80% memory usage
      heapMonitorInterval: options.heapMonitorInterval || 30000,
      
      ...options
    };
    
    this.initialized = false;
    this.cache = new Map();
    this.cacheTimestamps = new Map();
    this.connectionPools = new Map();
    this.performanceMetrics = {
      cacheHitRate: 0,
      averageResponseTime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      activeConnections: 0
    };
  }

  /**
   * Initialize performance optimizer
   */
  async initialize() {
    try {
      console.log('⚡ Initializing Performance Optimizer...');
      
      if (this.options.enableCaching) {
        await this.initializeCache();
      }
      
      if (this.options.enableConnectionPooling) {
        await this.initializeConnectionPooling();
      }
      
      // Start performance monitoring
      this.startPerformanceMonitoring();
      
      // Start memory monitoring
      this.startMemoryMonitoring();
      
      this.initialized = true;
      console.log('✅ Performance Optimizer initialized');
      
      this.emit('initialized', {
        cachingEnabled: this.options.enableCaching,
        connectionPoolingEnabled: this.options.enableConnectionPooling
      });
      
    } catch (error) {
      console.error('❌ Failed to initialize Performance Optimizer:', error.message);
      throw error;
    }
  }

  /**
   * Initialize caching system
   */
  async initializeCache() {
    console.log('🗄️ Initializing cache system...');
    
    // Start cache cleanup interval
    setInterval(() => {
      this.cleanupExpiredCache();
    }, this.options.cacheTTL / 2);
    
    console.log(`✅ Cache system initialized (size: ${this.options.cacheSize}, TTL: ${this.options.cacheTTL}ms)`);
  }

  /**
   * Initialize connection pooling
   */
  async initializeConnectionPooling() {
    console.log('🔗 Initializing connection pooling...');
    
    // Create default connection pools
    const defaultPools = ['rpc', 'database', 'redis'];
    
    for (const poolName of defaultPools) {
      this.connectionPools.set(poolName, {
        connections: [],
        available: [],
        pending: [],
        maxConnections: this.options.maxConnections,
        minConnections: this.options.minConnections,
        activeConnections: 0,
        totalConnections: 0
      });
    }
    
    console.log(`✅ Connection pooling initialized (max: ${this.options.maxConnections}, min: ${this.options.minConnections})`);
  }

  /**
   * Get cached value
   */
  getCached(key) {
    if (!this.options.enableCaching) return null;
    
    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp || Date.now() - timestamp > this.options.cacheTTL) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
      return null;
    }
    
    this.performanceMetrics.cacheHitRate = 
      (this.performanceMetrics.cacheHitRate * 0.9) + (1 * 0.1); // Exponential moving average
    
    return this.cache.get(key);
  }

  /**
   * Set cached value
   */
  setCached(key, value) {
    if (!this.options.enableCaching) return;
    
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.options.cacheSize) {
      const oldestKey = this.findOldestCacheKey();
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.cacheTimestamps.delete(oldestKey);
      }
    }
    
    this.cache.set(key, value);
    this.cacheTimestamps.set(key, Date.now());
  }

  /**
   * Clean up expired cache entries
   */
  cleanupExpiredCache() {
    const now = Date.now();
    const expiredKeys = [];
    
    for (const [key, timestamp] of this.cacheTimestamps.entries()) {
      if (now - timestamp > this.options.cacheTTL) {
        expiredKeys.push(key);
      }
    }
    
    for (const key of expiredKeys) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
    }
    
    if (expiredKeys.length > 0) {
      console.log(`🗑️ Cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }

  /**
   * Start performance monitoring
   */
  startPerformanceMonitoring() {
    setInterval(() => {
      this.updatePerformanceMetrics();
    }, 5000); // Every 5 seconds
    
    console.log('📊 Performance monitoring started');
  }

  /**
   * Start memory monitoring
   */
  startMemoryMonitoring() {
    setInterval(() => {
      this.monitorMemoryUsage();
    }, this.options.heapMonitorInterval);
    
    console.log('🧠 Memory monitoring started');
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics() {
    const memUsage = process.memoryUsage();
    
    this.performanceMetrics = {
      ...this.performanceMetrics,
      memoryUsage: memUsage.heapUsed / 1024 / 1024, // MB
      cacheSize: this.cache.size,
      timestamp: Date.now()
    };
    
    this.emit('performanceUpdate', this.performanceMetrics);
  }

  /**
   * Monitor memory usage and trigger GC if needed
   */
  monitorMemoryUsage() {
    const memUsage = process.memoryUsage();
    const heapUsageRatio = memUsage.heapUsed / memUsage.heapTotal;
    
    if (heapUsageRatio > this.options.gcThreshold) {
      console.log(`🧹 High memory usage detected (${(heapUsageRatio * 100).toFixed(1)}%), suggesting garbage collection`);
      
      if (global.gc) {
        global.gc();
        console.log('♻️ Manual garbage collection triggered');
      }
      
      this.emit('highMemoryUsage', {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        usageRatio: heapUsageRatio
      });
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return {
      ...this.performanceMetrics,
      cache: {
        size: this.cache.size,
        maxSize: this.options.cacheSize,
        hitRate: this.performanceMetrics.cacheHitRate
      }
    };
  }
}

export default PerformanceOptimizer;