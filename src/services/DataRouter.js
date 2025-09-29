import { EventEmitter } from 'events';

/**
 * DataRouter - Real-time data routing and transformation
 * Routes events to appropriate handlers, transforms data, and manages caching
 */
class DataRouter extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      maxCacheSize: options.maxCacheSize || 10000,
      cacheExpirationTime: options.cacheExpirationTime || 300000, // 5 minutes
      batchSize: options.batchSize || 100,
      batchInterval: options.batchInterval || 1000, // 1 second
      enableTransformation: options.enableTransformation !== false,
      enableCaching: options.enableCaching !== false,
      enableMetrics: options.enableMetrics !== false,
      priorityLevels: options.priorityLevels || ['low', 'medium', 'high', 'critical'],
      ...options
    };
    
    // Routing configuration
    this.routes = new Map();
    this.handlers = new Map();
    this.transformers = new Map();
    this.filters = new Map();
    
    // Data processing
    this.processingQueue = [];
    this.batchQueue = new Map();
    this.processingTimer = null;
    
    // Caching system
    this.cache = new Map();
    this.cacheStats = new Map();
    this.cacheCleanupTimer = null;
    
    // Priority queues
    this.priorityQueues = new Map();
    this.options.priorityLevels.forEach(level => {
      this.priorityQueues.set(level, []);
    });
    
    // Analytics and metrics
    this.metrics = {
      totalEvents: 0,
      processedEvents: 0,
      cachedEvents: 0,
      transformedEvents: 0,
      routedEvents: 0,
      errors: 0,
      averageProcessingTime: 0,
      cacheHitRate: 0,
      lastUpdate: null
    };
    
    // Route patterns for different event types
    this.eventPatterns = {
      price: /price|swap|trade/i,
      liquidity: /mint|burn|liquidity/i,
      transfer: /transfer|approval/i,
      block: /block|transaction/i,
      mev: /mev|sandwich|frontrun/i,
      arbitrage: /arbitrage|opportunity/i
    };
    
    this.isActive = false;
  }
  
  /**
   * Initialize the data router
   */
  async initialize() {
    try {
      console.log('🛣️ Initializing DataRouter...');
      
      // Setup default routes
      this.setupDefaultRoutes();
      
      // Start processing timer
      this.startProcessingTimer();
      
      // Start cache cleanup
      if (this.options.enableCaching) {
        this.startCacheCleanup();
      }
      
      this.isActive = true;
      console.log('✅ DataRouter initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize DataRouter:', error);
      throw error;
    }
  }
  
  /**
   * Setup default routing patterns
   */
  setupDefaultRoutes() {
    // Price-related events
    this.addRoute('price', {
      pattern: this.eventPatterns.price,
      handler: 'priceHandler',
      priority: 'high',
      cache: true,
      transform: true
    });
    
    // Liquidity events
    this.addRoute('liquidity', {
      pattern: this.eventPatterns.liquidity,
      handler: 'liquidityHandler',
      priority: 'medium',
      cache: true,
      transform: true
    });
    
    // MEV events
    this.addRoute('mev', {
      pattern: this.eventPatterns.mev,
      handler: 'mevHandler',
      priority: 'critical',
      cache: false,
      transform: true
    });
    
    // Arbitrage opportunities
    this.addRoute('arbitrage', {
      pattern: this.eventPatterns.arbitrage,
      handler: 'arbitrageHandler',
      priority: 'critical',
      cache: true,
      transform: true
    });
    
    // Block events
    this.addRoute('block', {
      pattern: this.eventPatterns.block,
      handler: 'blockHandler',
      priority: 'medium',
      cache: true,
      transform: false
    });
    
    console.log(`🗺️ Setup ${this.routes.size} default routes`);
  }
  
  /**
   * Add a routing rule
   */
  addRoute(name, config) {
    this.routes.set(name, {
      name,
      pattern: config.pattern,
      handler: config.handler,
      priority: config.priority || 'medium',
      cache: config.cache !== false,
      transform: config.transform !== false,
      filter: config.filter || null,
      metadata: config.metadata || {}
    });
  }
  
  /**
   * Add event handler
   */
  addHandler(name, handler) {
    if (typeof handler !== 'function') {
      throw new Error(`Handler ${name} must be a function`);
    }
    
    this.handlers.set(name, handler);
  }
  
  /**
   * Add data transformer
   */
  addTransformer(name, transformer) {
    if (typeof transformer !== 'function') {
      throw new Error(`Transformer ${name} must be a function`);
    }
    
    this.transformers.set(name, transformer);
  }
  
  /**
   * Add event filter
   */
  addFilter(name, filter) {
    if (typeof filter !== 'function') {
      throw new Error(`Filter ${name} must be a function`);
    }
    
    this.filters.set(name, filter);
  }
  
  /**
   * Route incoming event data
   */
  async routeEvent(eventData, metadata = {}) {
    const startTime = Date.now();
    
    try {
      this.metrics.totalEvents++;
      
      // Create processing context
      const context = {
        event: eventData,
        metadata: {
          ...metadata,
          timestamp: Date.now(),
          source: metadata.source || 'unknown',
          priority: metadata.priority || 'medium'
        },
        processing: {
          startTime,
          routes: [],
          transformations: [],
          cached: false
        }
      };
      
      // Find matching routes
      const matchingRoutes = this.findMatchingRoutes(eventData);
      
      if (matchingRoutes.length === 0) {
        console.warn('No matching routes found for event:', eventData);
        return false;
      }
      
      context.processing.routes = matchingRoutes.map(route => route.name);
      
      // Process through each matching route
      for (const route of matchingRoutes) {
        await this.processRoute(context, route);
      }
      
      // Update metrics
      this.updateMetrics(context);
      
      return true;
      
    } catch (error) {
      console.error('Error routing event:', error);
      this.metrics.errors++;
      return false;
    }
  }
  
  /**
   * Find matching routes for event data
   */
  findMatchingRoutes(eventData) {
    const matchingRoutes = [];
    
    for (const [name, route] of this.routes) {
      if (this.matchesRoute(eventData, route)) {
        matchingRoutes.push(route);
      }
    }
    
    // Sort by priority
    return matchingRoutes.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
  
  /**
   * Check if event matches route pattern
   */
  matchesRoute(eventData, route) {
    // Pattern matching
    if (route.pattern instanceof RegExp) {
      const eventString = JSON.stringify(eventData).toLowerCase();
      if (!route.pattern.test(eventString)) {
        return false;
      }
    }
    
    // Custom filter
    if (route.filter && this.filters.has(route.filter)) {
      const filterFn = this.filters.get(route.filter);
      if (!filterFn(eventData)) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Process event through a specific route
   */
  async processRoute(context, route) {
    try {
      // Check cache first
      if (route.cache && this.options.enableCaching) {
        const cached = this.checkCache(context.event, route);
        if (cached) {
          context.processing.cached = true;
          this.metrics.cachedEvents++;
          return cached;
        }
      }
      
      // Apply transformation
      let processedData = context.event;
      if (route.transform && this.options.enableTransformation) {
        processedData = await this.transformData(processedData, route);
        context.processing.transformations.push(route.name);
        this.metrics.transformedEvents++;
      }
      
      // Add to appropriate priority queue
      this.addToPriorityQueue(route.priority, {
        route,
        data: processedData,
        context
      });
      
      // Cache the result
      if (route.cache && this.options.enableCaching) {
        this.cacheData(context.event, route, processedData);
      }
      
      this.metrics.routedEvents++;
      
    } catch (error) {
      console.error(`Error processing route ${route.name}:`, error);
      this.metrics.errors++;
    }
  }
  
  /**
   * Transform data using configured transformers
   */
  async transformData(data, route) {
    // Apply route-specific transformation
    const transformerName = `${route.name}Transformer`;
    
    if (this.transformers.has(transformerName)) {
      const transformer = this.transformers.get(transformerName);
      return await transformer(data, route);
    }
    
    // Apply default transformations
    return this.applyDefaultTransformations(data, route);
  }
  
  /**
   * Apply default data transformations
   */
  applyDefaultTransformations(data, route) {
    let transformed = { ...data };
    
    // Add routing metadata
    transformed._routing = {
      route: route.name,
      priority: route.priority,
      timestamp: Date.now()
    };
    
    // Normalize common fields
    if (data.blockNumber) {
      transformed.blockNumber = parseInt(data.blockNumber);
    }
    
    if (data.timestamp && typeof data.timestamp === 'string') {
      transformed.timestamp = new Date(data.timestamp).getTime();
    }
    
    // Convert big numbers to strings for JSON serialization
    if (data.amount || data.value) {
      Object.keys(transformed).forEach(key => {
        if (typeof transformed[key] === 'bigint') {
          transformed[key] = transformed[key].toString();
        }
      });
    }
    
    return transformed;
  }
  
  /**
   * Add event to priority queue
   */
  addToPriorityQueue(priority, item) {
    const queue = this.priorityQueues.get(priority);
    if (queue) {
      queue.push(item);
      
      // Limit queue size
      if (queue.length > this.options.maxCacheSize / this.options.priorityLevels.length) {
        queue.shift(); // Remove oldest item
      }
    }
  }
  
  /**
   * Start processing timer
   */
  startProcessingTimer() {
    this.processingTimer = setInterval(() => {
      this.processPriorityQueues();
    }, this.options.batchInterval);
    
    console.log('⏰ Processing timer started');
  }
  
  /**
   * Process priority queues
   */
  async processPriorityQueues() {
    // Process queues in priority order
    for (const priority of this.options.priorityLevels) {
      const queue = this.priorityQueues.get(priority);
      
      if (queue.length > 0) {
        const batch = queue.splice(0, this.options.batchSize);
        await this.processBatch(batch, priority);
      }
    }
  }
  
  /**
   * Process a batch of events
   */
  async processBatch(batch, priority) {
    const startTime = Date.now();
    
    try {
      // Group by handler
      const handlerGroups = new Map();
      
      for (const item of batch) {
        const handlerName = item.route.handler;
        
        if (!handlerGroups.has(handlerName)) {
          handlerGroups.set(handlerName, []);
        }
        
        handlerGroups.get(handlerName).push(item);
      }
      
      // Process each handler group
      const processingPromises = [];
      
      for (const [handlerName, items] of handlerGroups) {
        if (this.handlers.has(handlerName)) {
          const handler = this.handlers.get(handlerName);
          
          processingPromises.push(
            this.processHandlerBatch(handler, items, handlerName)
          );
        }
      }
      
      await Promise.allSettled(processingPromises);
      
      this.metrics.processedEvents += batch.length;
      
      // Emit batch processed event
      this.emit('batchProcessed', {
        priority,
        batchSize: batch.length,
        processingTime: Date.now() - startTime,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error(`Error processing batch for ${priority} priority:`, error);
      this.metrics.errors++;
    }
  }
  
  /**
   * Process batch for specific handler
   */
  async processHandlerBatch(handler, items, handlerName) {
    try {
      // Extract data from items
      const eventData = items.map(item => ({
        data: item.data,
        route: item.route,
        context: item.context
      }));
      
      // Call handler with batch
      await handler(eventData);
      
      // Emit handler events
      for (const item of items) {
        this.emit(`handled:${item.route.name}`, {
          data: item.data,
          route: item.route.name,
          handler: handlerName,
          timestamp: Date.now()
        });
      }
      
    } catch (error) {
      console.error(`Error in handler ${handlerName}:`, error);
      
      for (const item of items) {
        this.emit('handlerError', {
          error: error.message,
          route: item.route.name,
          handler: handlerName,
          data: item.data,
          timestamp: Date.now()
        });
      }
    }
  }
  
  /**
   * Check cache for event data
   */
  checkCache(eventData, route) {
    if (!this.options.enableCaching) return null;
    
    const cacheKey = this.generateCacheKey(eventData, route);
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.options.cacheExpirationTime) {
      // Update cache stats
      const stats = this.cacheStats.get(cacheKey) || { hits: 0, misses: 0 };
      stats.hits++;
      this.cacheStats.set(cacheKey, stats);
      
      return cached.data;
    } else if (cached) {
      // Expired cache entry
      this.cache.delete(cacheKey);
      this.cacheStats.delete(cacheKey);
    }
    
    // Cache miss
    const stats = this.cacheStats.get(cacheKey) || { hits: 0, misses: 0 };
    stats.misses++;
    this.cacheStats.set(cacheKey, stats);
    
    return null;
  }
  
  /**
   * Cache processed data
   */
  cacheData(originalData, route, processedData) {
    if (!this.options.enableCaching) return;
    
    const cacheKey = this.generateCacheKey(originalData, route);
    
    this.cache.set(cacheKey, {
      data: processedData,
      timestamp: Date.now(),
      route: route.name
    });
    
    // Limit cache size
    if (this.cache.size > this.options.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      this.cacheStats.delete(oldestKey);
    }
  }
  
  /**
   * Generate cache key for event data
   */
  generateCacheKey(eventData, route) {
    // Create a hash-like key from event data and route
    const keyData = {
      route: route.name,
      eventType: eventData.eventName || eventData.type,
      contractAddress: eventData.contractAddress,
      blockNumber: eventData.blockNumber,
      transactionHash: eventData.transactionHash
    };
    
    return JSON.stringify(keyData);
  }
  
  /**
   * Start cache cleanup routine
   */
  startCacheCleanup() {
    this.cacheCleanupTimer = setInterval(() => {
      this.cleanupCache();
    }, this.options.cacheExpirationTime);
    
    console.log('🧹 Cache cleanup started');
  }
  
  /**
   * Clean up expired cache entries
   */
  cleanupCache() {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.options.cacheExpirationTime) {
        this.cache.delete(key);
        this.cacheStats.delete(key);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      console.log(`🧹 Cleaned up ${removedCount} expired cache entries`);
    }
  }
  
  /**
   * Update performance metrics
   */
  updateMetrics(context) {
    const processingTime = Date.now() - context.processing.startTime;
    this.metrics.averageProcessingTime = 
      (this.metrics.averageProcessingTime + processingTime) / 2;
    
    // Calculate cache hit rate
    const totalHits = Array.from(this.cacheStats.values())
      .reduce((sum, stats) => sum + stats.hits, 0);
    const totalRequests = Array.from(this.cacheStats.values())
      .reduce((sum, stats) => sum + stats.hits + stats.misses, 0);
    
    this.metrics.cacheHitRate = totalRequests > 0 ? 
      (totalHits / totalRequests) * 100 : 0;
    
    this.metrics.lastUpdate = Date.now();
  }
  
  /**
   * Get routing statistics
   */
  getStats() {
    const queueSizes = {};
    for (const [priority, queue] of this.priorityQueues) {
      queueSizes[priority] = queue.length;
    }
    
    return {
      ...this.metrics,
      routes: this.routes.size,
      handlers: this.handlers.size,
      transformers: this.transformers.size,
      cacheSize: this.cache.size,
      queueSizes,
      cacheHitRate: Math.round(this.metrics.cacheHitRate * 100) / 100
    };
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats() {
    const stats = {
      totalEntries: this.cache.size,
      totalHits: 0,
      totalMisses: 0,
      hitRate: 0,
      topRoutes: []
    };
    
    // Calculate totals
    for (const [key, cacheStats] of this.cacheStats) {
      stats.totalHits += cacheStats.hits;
      stats.totalMisses += cacheStats.misses;
    }
    
    stats.hitRate = stats.totalHits + stats.totalMisses > 0 ?
      (stats.totalHits / (stats.totalHits + stats.totalMisses)) * 100 : 0;
    
    // Get top performing routes
    const routeStats = new Map();
    for (const [key, entry] of this.cache) {
      const routeName = entry.route;
      const current = routeStats.get(routeName) || 0;
      routeStats.set(routeName, current + 1);
    }
    
    stats.topRoutes = Array.from(routeStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([route, count]) => ({ route, count }));
    
    return stats;
  }
  
  /**
   * Get route performance analytics
   */
  getRouteAnalytics() {
    const analytics = {};
    
    for (const [name, route] of this.routes) {
      analytics[name] = {
        priority: route.priority,
        cacheEnabled: route.cache,
        transformEnabled: route.transform,
        pattern: route.pattern instanceof RegExp ? route.pattern.source : route.pattern,
        metadata: route.metadata
      };
    }
    
    return analytics;
  }
  
  /**
   * Clear all caches
   */
  clearCache() {
    this.cache.clear();
    this.cacheStats.clear();
    console.log('🧹 All caches cleared');
  }
  
  /**
   * Stop the data router
   */
  async stop() {
    console.log('🛑 Stopping DataRouter...');
    
    this.isActive = false;
    
    // Stop timers
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
    }
    
    if (this.cacheCleanupTimer) {
      clearInterval(this.cacheCleanupTimer);
    }
    
    // Process remaining queues
    await this.processPriorityQueues();
    
    // Clear data structures
    this.clearCache();
    this.priorityQueues.clear();
    
    console.log('✅ DataRouter stopped');
  }
}

export default DataRouter;