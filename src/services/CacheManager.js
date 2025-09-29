import { EventEmitter } from 'events';
import { createClient } from 'redis';
import config from '../config/config.js';

/**
 * CacheManager - High-performance caching with Redis integration
 * Provides TTL management, cache invalidation, and distributed caching
 */
class CacheManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      redisUrl: options.redisUrl || config.REDIS_URL || 'redis://localhost:6379',
      keyPrefix: options.keyPrefix || 'arbitrage:',
      defaultTTL: options.defaultTTL || 300, // 5 minutes
      maxMemoryUsage: options.maxMemoryUsage || 100 * 1024 * 1024, // 100MB
      compressionThreshold: options.compressionThreshold || 1024, // 1KB
      enableCompression: options.enableCompression !== false,
      enableDistributed: options.enableDistributed !== false,
      batchSize: options.batchSize || 100,
      pipelineEnabled: options.pipelineEnabled !== false,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000,
      ...options
    };
    
    // Redis clients
    this.redisClient = null;
    this.redisSubscriber = null;
    this.redisPublisher = null;
    
    // In-memory cache for frequently accessed data
    this.memoryCache = new Map();
    this.memoryCacheStats = new Map();
    
    // Cache categories with different TTL and strategies
    this.cacheCategories = new Map([
      ['prices', { ttl: 30, strategy: 'write-through' }],
      ['opportunities', { ttl: 60, strategy: 'write-behind' }],
      ['pools', { ttl: 300, strategy: 'cache-aside' }],
      ['tokens', { ttl: 3600, strategy: 'cache-aside' }],
      ['transactions', { ttl: 86400, strategy: 'write-through' }],
      ['analytics', { ttl: 300, strategy: 'write-behind' }]
    ]);
    
    // Write-behind queue for async writes
    this.writeBehindQueue = [];
    this.writeBehindTimer = null;
    
    // Performance metrics
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      memoryHits: 0,
      redisHits: 0,
      compressionSaves: 0,
      totalBytes: 0,
      lastUpdate: null
    };
    
    // Connection state
    this.isConnected = false;
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    
    this.isActive = false;
  }
  
  /**
   * Initialize the cache manager
   */
  async initialize() {
    try {
      console.log('💾 Initializing CacheManager...');
      console.log(`  Redis URL: ${this.options.redisUrl}`);
      
      // Connect to Redis
      await this.connectRedis();
      
      // Setup write-behind processing
      this.startWriteBehindProcessor();
      
      // Setup memory cache cleanup
      this.startMemoryCacheCleanup();
      
      this.isActive = true;
      console.log('✅ CacheManager initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize CacheManager:', error);
      throw error;
    }
  }
  
  /**
   * Connect to Redis cluster
   */
  async connectRedis() {
    try {
      // Create main Redis client
      this.redisClient = createClient({
        url: this.options.redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > this.options.retryAttempts) {
              return new Error('Max reconnection attempts reached');
            }
            return Math.min(retries * this.options.retryDelay, 3000);
          }
        }
      });
      
      // Setup event handlers
      this.redisClient.on('connect', () => {
        console.log('📡 Connected to Redis');
        this.isConnected = true;
        this.isReconnecting = false;
        this.reconnectAttempts = 0;
        this.emit('connected');
      });
      
      this.redisClient.on('error', (error) => {
        console.error('❌ Redis connection error:', error);
        this.metrics.errors++;
        this.isConnected = false;
        this.emit('error', error);
      });
      
      this.redisClient.on('reconnecting', () => {
        console.log('🔄 Reconnecting to Redis...');
        this.isReconnecting = true;
        this.reconnectAttempts++;
        this.emit('reconnecting');
      });
      
      this.redisClient.on('end', () => {
        console.log('🔌 Redis connection ended');
        this.isConnected = false;
        this.emit('disconnected');
      });
      
      // Connect
      await this.redisClient.connect();
      
      // Create subscriber and publisher for distributed features
      if (this.options.enableDistributed) {
        await this.setupDistributedCaching();
      }
      
      console.log('✅ Redis connection established');
      
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }
  
  /**
   * Setup distributed caching with pub/sub
   */
  async setupDistributedCaching() {
    try {
      // Create subscriber client
      this.redisSubscriber = this.redisClient.duplicate();
      await this.redisSubscriber.connect();
      
      // Create publisher client
      this.redisPublisher = this.redisClient.duplicate();
      await this.redisPublisher.connect();
      
      // Subscribe to cache invalidation events
      await this.redisSubscriber.subscribe(
        `${this.options.keyPrefix}invalidate`,
        (message) => {
          this.handleCacheInvalidation(message);
        }
      );
      
      console.log('🌐 Distributed caching enabled');
      
    } catch (error) {
      console.error('Failed to setup distributed caching:', error);
    }
  }
  
  /**
   * Handle distributed cache invalidation
   */
  handleCacheInvalidation(message) {
    try {
      const { key, pattern } = JSON.parse(message);
      
      if (key) {
        // Invalidate specific key from memory cache
        this.memoryCache.delete(key);
      } else if (pattern) {
        // Invalidate keys matching pattern
        for (const cacheKey of this.memoryCache.keys()) {
          if (cacheKey.includes(pattern)) {
            this.memoryCache.delete(cacheKey);
          }
        }
      }
      
      this.emit('cacheInvalidated', { key, pattern });
      
    } catch (error) {
      console.error('Error handling cache invalidation:', error);
    }
  }
  
  /**
   * Get value from cache with fallback strategy
   */
  async get(key, category = 'default') {
    const fullKey = this.buildKey(key, category);
    
    try {
      // Check memory cache first
      const memoryResult = this.memoryCache.get(fullKey);
      if (memoryResult && !this.isExpired(memoryResult)) {
        this.metrics.hits++;
        this.metrics.memoryHits++;
        this.updateCacheStats(fullKey, 'hit');
        return this.deserializeValue(memoryResult.value);
      }
      
      // Check Redis cache
      if (this.isConnected) {
        const redisResult = await this.redisClient.get(fullKey);
        
        if (redisResult) {
          const deserializedValue = this.deserializeValue(redisResult);
          
          // Update memory cache
          this.setMemoryCache(fullKey, redisResult, category);
          
          this.metrics.hits++;
          this.metrics.redisHits++;
          this.updateCacheStats(fullKey, 'hit');
          
          return deserializedValue;
        }
      }
      
      // Cache miss
      this.metrics.misses++;
      this.updateCacheStats(fullKey, 'miss');
      
      return null;
      
    } catch (error) {
      console.error(`Cache get error for key ${fullKey}:`, error);
      this.metrics.errors++;
      return null;
    }
  }
  
  /**
   * Set value in cache with TTL and strategy
   */
  async set(key, value, ttl = null, category = 'default') {
    const fullKey = this.buildKey(key, category);
    const categoryConfig = this.cacheCategories.get(category) || {};
    const effectiveTTL = ttl || categoryConfig.ttl || this.options.defaultTTL;
    
    try {
      const serializedValue = this.serializeValue(value);
      
      // Always update memory cache
      this.setMemoryCache(fullKey, serializedValue, category, effectiveTTL);
      
      // Handle different caching strategies
      switch (categoryConfig.strategy) {
        case 'write-through':
          await this.writeThrough(fullKey, serializedValue, effectiveTTL);
          break;
          
        case 'write-behind':
          this.writeBehind(fullKey, serializedValue, effectiveTTL);
          break;
          
        case 'cache-aside':
        default:
          if (this.isConnected) {
            await this.redisClient.setEx(fullKey, effectiveTTL, serializedValue);
          }
          break;
      }
      
      this.metrics.sets++;
      this.updateCacheStats(fullKey, 'set');
      
      return true;
      
    } catch (error) {
      console.error(`Cache set error for key ${fullKey}:`, error);
      this.metrics.errors++;
      return false;
    }
  }
  
  /**
   * Write-through caching strategy
   */
  async writeThrough(key, value, ttl) {
    if (this.isConnected) {
      await this.redisClient.setEx(key, ttl, value);
    }
  }
  
  /**
   * Write-behind caching strategy
   */
  writeBehind(key, value, ttl) {
    this.writeBehindQueue.push({
      key,
      value,
      ttl,
      timestamp: Date.now()
    });
  }
  
  /**
   * Set multiple keys atomically
   */
  async setMultiple(entries, category = 'default') {
    if (!Array.isArray(entries) || entries.length === 0) {
      return false;
    }
    
    try {
      const categoryConfig = this.cacheCategories.get(category) || {};
      const defaultTTL = categoryConfig.ttl || this.options.defaultTTL;
      
      // Prepare data for memory cache
      const memoryUpdates = [];
      const redisUpdates = [];
      
      for (const entry of entries) {
        const fullKey = this.buildKey(entry.key, category);
        const serializedValue = this.serializeValue(entry.value);
        const ttl = entry.ttl || defaultTTL;
        
        memoryUpdates.push({ key: fullKey, value: serializedValue, ttl });
        redisUpdates.push({ key: fullKey, value: serializedValue, ttl });
      }
      
      // Update memory cache
      for (const update of memoryUpdates) {
        this.setMemoryCache(update.key, update.value, category, update.ttl);
      }
      
      // Update Redis using pipeline for efficiency
      if (this.isConnected && this.options.pipelineEnabled) {
        const pipeline = this.redisClient.multi();
        
        for (const update of redisUpdates) {
          pipeline.setEx(update.key, update.ttl, update.value);
        }
        
        await pipeline.exec();
      }
      
      this.metrics.sets += entries.length;
      
      return true;
      
    } catch (error) {
      console.error('Error setting multiple cache entries:', error);
      this.metrics.errors++;
      return false;
    }
  }
  
  /**
   * Delete key from cache
   */
  async delete(key, category = 'default') {
    const fullKey = this.buildKey(key, category);
    
    try {
      // Remove from memory cache
      this.memoryCache.delete(fullKey);
      this.memoryCacheStats.delete(fullKey);
      
      // Remove from Redis
      if (this.isConnected) {
        await this.redisClient.del(fullKey);
      }
      
      // Notify other instances if distributed
      if (this.options.enableDistributed && this.redisPublisher) {
        await this.redisPublisher.publish(
          `${this.options.keyPrefix}invalidate`,
          JSON.stringify({ key: fullKey })
        );
      }
      
      this.metrics.deletes++;
      
      return true;
      
    } catch (error) {
      console.error(`Cache delete error for key ${fullKey}:`, error);
      this.metrics.errors++;
      return false;
    }
  }
  
  /**
   * Delete keys matching pattern
   */
  async deletePattern(pattern, category = 'default') {
    try {
      const fullPattern = this.buildKey(pattern, category);
      
      // Remove from memory cache
      for (const key of this.memoryCache.keys()) {
        if (key.includes(pattern)) {
          this.memoryCache.delete(key);
          this.memoryCacheStats.delete(key);
        }
      }
      
      // Remove from Redis
      if (this.isConnected) {
        const keys = await this.redisClient.keys(fullPattern);
        if (keys.length > 0) {
          await this.redisClient.del(keys);
        }
      }
      
      // Notify other instances
      if (this.options.enableDistributed && this.redisPublisher) {
        await this.redisPublisher.publish(
          `${this.options.keyPrefix}invalidate`,
          JSON.stringify({ pattern })
        );
      }
      
      return true;
      
    } catch (error) {
      console.error(`Error deleting pattern ${pattern}:`, error);
      this.metrics.errors++;
      return false;
    }
  }
  
  /**
   * Check if key exists
   */
  async exists(key, category = 'default') {
    const fullKey = this.buildKey(key, category);
    
    try {
      // Check memory cache first
      if (this.memoryCache.has(fullKey)) {
        const entry = this.memoryCache.get(fullKey);
        if (!this.isExpired(entry)) {
          return true;
        }
      }
      
      // Check Redis
      if (this.isConnected) {
        const exists = await this.redisClient.exists(fullKey);
        return exists === 1;
      }
      
      return false;
      
    } catch (error) {
      console.error(`Error checking existence of key ${fullKey}:`, error);
      return false;
    }
  }
  
  /**
   * Get TTL for key
   */
  async getTTL(key, category = 'default') {
    const fullKey = this.buildKey(key, category);
    
    try {
      if (this.isConnected) {
        return await this.redisClient.ttl(fullKey);
      }
      
      return -1;
      
    } catch (error) {
      console.error(`Error getting TTL for key ${fullKey}:`, error);
      return -1;
    }
  }
  
  /**
   * Set memory cache entry
   */
  setMemoryCache(key, value, category, ttl) {
    const entry = {
      value,
      category,
      timestamp: Date.now(),
      ttl: ttl * 1000, // Convert to milliseconds
      size: value.length
    };
    
    this.memoryCache.set(key, entry);
    this.metrics.totalBytes += entry.size;
    
    // Cleanup if memory usage is too high
    if (this.metrics.totalBytes > this.options.maxMemoryUsage) {
      this.cleanupMemoryCache();
    }
  }
  
  /**
   * Check if cache entry is expired
   */
  isExpired(entry) {
    return Date.now() - entry.timestamp > entry.ttl;
  }
  
  /**
   * Build full cache key
   */
  buildKey(key, category) {
    return `${this.options.keyPrefix}${category}:${key}`;
  }
  
  /**
   * Serialize value for storage
   */
  serializeValue(value) {
    let serialized = JSON.stringify(value);
    
    // Compress large values if enabled
    if (this.options.enableCompression && 
        serialized.length > this.options.compressionThreshold) {
      // Simple compression simulation (in real implementation, use zlib)
      this.metrics.compressionSaves++;
    }
    
    return serialized;
  }
  
  /**
   * Deserialize value from storage
   */
  deserializeValue(value) {
    try {
      return JSON.parse(value);
    } catch (error) {
      console.error('Error deserializing cache value:', error);
      return null;
    }
  }
  
  /**
   * Update cache statistics
   */
  updateCacheStats(key, operation) {
    const stats = this.memoryCacheStats.get(key) || {
      hits: 0,
      misses: 0,
      sets: 0,
      lastAccess: null
    };
    
    stats[operation === 'hit' ? 'hits' : operation === 'miss' ? 'misses' : 'sets']++;
    stats.lastAccess = Date.now();
    
    this.memoryCacheStats.set(key, stats);
    this.metrics.lastUpdate = Date.now();
  }
  
  /**
   * Start write-behind processor
   */
  startWriteBehindProcessor() {
    this.writeBehindTimer = setInterval(async () => {
      await this.processWriteBehindQueue();
    }, 1000); // Process every second
    
    console.log('⏰ Write-behind processor started');
  }
  
  /**
   * Process write-behind queue
   */
  async processWriteBehindQueue() {
    if (this.writeBehindQueue.length === 0 || !this.isConnected) {
      return;
    }
    
    try {
      const batch = this.writeBehindQueue.splice(0, this.options.batchSize);
      
      if (this.options.pipelineEnabled) {
        const pipeline = this.redisClient.multi();
        
        for (const item of batch) {
          pipeline.setEx(item.key, item.ttl, item.value);
        }
        
        await pipeline.exec();
      } else {
        for (const item of batch) {
          await this.redisClient.setEx(item.key, item.ttl, item.value);
        }
      }
      
    } catch (error) {
      console.error('Error processing write-behind queue:', error);
      this.metrics.errors++;
    }
  }
  
  /**
   * Start memory cache cleanup
   */
  startMemoryCacheCleanup() {
    setInterval(() => {
      this.cleanupMemoryCache();
    }, 60000); // Cleanup every minute
    
    console.log('🧹 Memory cache cleanup started');
  }
  
  /**
   * Cleanup expired memory cache entries
   */
  cleanupMemoryCache() {
    let removedCount = 0;
    let freedBytes = 0;
    
    // Remove expired entries
    for (const [key, entry] of this.memoryCache) {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key);
        this.memoryCacheStats.delete(key);
        freedBytes += entry.size;
        removedCount++;
      }
    }
    
    // If still over memory limit, remove LRU entries
    while (this.metrics.totalBytes > this.options.maxMemoryUsage && 
           this.memoryCache.size > 0) {
      
      // Find least recently used entry
      let lruKey = null;
      let lruTime = Date.now();
      
      for (const [key, stats] of this.memoryCacheStats) {
        if (stats.lastAccess < lruTime) {
          lruTime = stats.lastAccess;
          lruKey = key;
        }
      }
      
      if (lruKey) {
        const entry = this.memoryCache.get(lruKey);
        this.memoryCache.delete(lruKey);
        this.memoryCacheStats.delete(lruKey);
        
        if (entry) {
          freedBytes += entry.size;
          removedCount++;
        }
      } else {
        break; // Safety break
      }
    }
    
    this.metrics.totalBytes -= freedBytes;
    
    if (removedCount > 0) {
      console.log(`🧹 Cleaned up ${removedCount} memory cache entries, freed ${freedBytes} bytes`);
    }
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.metrics.hits + this.metrics.misses > 0 ?
      (this.metrics.hits / (this.metrics.hits + this.metrics.misses)) * 100 : 0;
    
    return {
      ...this.metrics,
      hitRate: Math.round(hitRate * 100) / 100,
      memoryCacheSize: this.memoryCache.size,
      writeBehindQueueSize: this.writeBehindQueue.length,
      memoryUsage: this.metrics.totalBytes,
      memoryUsagePercent: (this.metrics.totalBytes / this.options.maxMemoryUsage) * 100,
      isConnected: this.isConnected,
      isReconnecting: this.isReconnecting
    };
  }
  
  /**
   * Get detailed cache analytics
   */
  getAnalytics() {
    const categoryStats = new Map();
    
    // Analyze cache by category
    for (const [key, entry] of this.memoryCache) {
      const category = entry.category;
      const stats = categoryStats.get(category) || {
        count: 0,
        totalSize: 0,
        averageSize: 0
      };
      
      stats.count++;
      stats.totalSize += entry.size;
      stats.averageSize = stats.totalSize / stats.count;
      
      categoryStats.set(category, stats);
    }
    
    return {
      categories: Object.fromEntries(categoryStats),
      topKeys: this.getTopKeys(10),
      memoryDistribution: this.getMemoryDistribution()
    };
  }
  
  /**
   * Get top accessed keys
   */
  getTopKeys(limit = 10) {
    return Array.from(this.memoryCacheStats.entries())
      .sort((a, b) => (b[1].hits + b[1].sets) - (a[1].hits + a[1].sets))
      .slice(0, limit)
      .map(([key, stats]) => ({
        key: key.replace(this.options.keyPrefix, ''),
        hits: stats.hits,
        misses: stats.misses,
        sets: stats.sets,
        lastAccess: stats.lastAccess
      }));
  }
  
  /**
   * Get memory usage distribution
   */
  getMemoryDistribution() {
    const distribution = {};
    
    for (const [key, entry] of this.memoryCache) {
      const category = entry.category;
      distribution[category] = (distribution[category] || 0) + entry.size;
    }
    
    return distribution;
  }
  
  /**
   * Clear all caches
   */
  async clearAll() {
    try {
      // Clear memory cache
      this.memoryCache.clear();
      this.memoryCacheStats.clear();
      this.metrics.totalBytes = 0;
      
      // Clear Redis cache
      if (this.isConnected) {
        const keys = await this.redisClient.keys(`${this.options.keyPrefix}*`);
        if (keys.length > 0) {
          await this.redisClient.del(keys);
        }
      }
      
      console.log('🧹 All caches cleared');
      
    } catch (error) {
      console.error('Error clearing caches:', error);
    }
  }
  
  /**
   * Shutdown cache manager
   */
  async shutdown() {
    console.log('🛑 Shutting down CacheManager...');
    
    this.isActive = false;
    
    // Stop timers
    if (this.writeBehindTimer) {
      clearInterval(this.writeBehindTimer);
    }
    
    // Process remaining write-behind queue
    await this.processWriteBehindQueue();
    
    // Close Redis connections
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    
    if (this.redisSubscriber) {
      await this.redisSubscriber.quit();
    }
    
    if (this.redisPublisher) {
      await this.redisPublisher.quit();
    }
    
    console.log('✅ CacheManager shutdown complete');
  }
}

export default CacheManager;