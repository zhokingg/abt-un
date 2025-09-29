import { EventEmitter } from 'events';
import { ethers } from 'ethers';

/**
 * OpportunityPipeline - Real-time opportunity detection and scoring
 * Coordinates price feeds, risk assessment, and trade execution
 */
class OpportunityPipeline extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      minProfitThreshold: options.minProfitThreshold || 0.005, // 0.5%
      maxRiskScore: options.maxRiskScore || 75,
      opportunityTimeout: options.opportunityTimeout || 30000, // 30 seconds
      maxConcurrentOpportunities: options.maxConcurrentOpportunities || 50,
      scoringInterval: options.scoringInterval || 1000, // 1 second
      executionDelay: options.executionDelay || 500, // 500ms
      riskAssessmentTimeout: options.riskAssessmentTimeout || 5000,
      priceValidityWindow: options.priceValidityWindow || 10000, // 10 seconds
      ...options
    };
    
    // Dependencies
    this.priceOracleManager = null;
    this.priceAggregator = null;
    this.mempoolMonitor = null;
    this.riskManager = null;
    this.cacheManager = null;
    
    // Opportunity tracking
    this.activeOpportunities = new Map();
    this.opportunityHistory = [];
    this.opportunityQueue = [];
    
    // Scoring system
    this.scoringWeights = {
      profit: 0.4,
      confidence: 0.2,
      liquidity: 0.15,
      speed: 0.1,
      risk: 0.1,
      market: 0.05
    };
    
    // Pipeline stages
    this.stages = {
      detection: new Map(),
      validation: new Map(),
      scoring: new Map(),
      riskAssessment: new Map(),
      execution: new Map()
    };
    
    // Performance metrics
    this.metrics = {
      totalOpportunities: 0,
      validatedOpportunities: 0,
      executedOpportunities: 0,
      profitableExecutions: 0,
      averageProcessingTime: 0,
      averageProfitability: 0,
      successRate: 0,
      lastUpdate: null
    };
    
    // Market conditions
    this.marketConditions = {
      volatility: 'medium',
      liquidity: 'normal',
      gasPrice: 'normal',
      congestion: 'low',
      lastUpdate: null
    };
    
    this.isActive = false;
    this.processingTimer = null;
  }
  
  /**
   * Initialize the opportunity pipeline
   */
  async initialize(dependencies = {}) {
    try {
      console.log('🔍 Initializing OpportunityPipeline...');
      
      // Set dependencies
      this.priceOracleManager = dependencies.priceOracleManager;
      this.priceAggregator = dependencies.priceAggregator;
      this.mempoolMonitor = dependencies.mempoolMonitor;
      this.riskManager = dependencies.riskManager;
      this.cacheManager = dependencies.cacheManager;
      
      // Validate dependencies
      this.validateDependencies();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Start opportunity processing
      this.startOpportunityProcessor();
      
      // Start market condition monitoring
      this.startMarketMonitoring();
      
      this.isActive = true;
      console.log('✅ OpportunityPipeline initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize OpportunityPipeline:', error);
      throw error;
    }
  }
  
  /**
   * Validate required dependencies
   */
  validateDependencies() {
    const required = ['priceOracleManager', 'priceAggregator'];
    
    for (const dep of required) {
      if (!this[dep]) {
        throw new Error(`Required dependency missing: ${dep}`);
      }
    }
  }
  
  /**
   * Setup event listeners for data sources
   */
  setupEventListeners() {
    // Price update events
    if (this.priceOracleManager) {
      this.priceOracleManager.on('priceUpdate', (data) => {
        this.handlePriceUpdate(data);
      });
      
      this.priceOracleManager.on('priceAnomaly', (data) => {
        this.handlePriceAnomaly(data);
      });
    }
    
    // Arbitrage opportunities from aggregator
    if (this.priceAggregator) {
      this.priceAggregator.on('arbitrageOpportunitiesFound', (data) => {
        this.handleArbitrageOpportunities(data);
      });
    }
    
    // Mempool opportunities
    if (this.mempoolMonitor) {
      this.mempoolMonitor.on('opportunityDetected', (data) => {
        this.handleMempoolOpportunity(data);
      });
      
      this.mempoolMonitor.on('sandwichAttackDetected', (data) => {
        this.handleMEVOpportunity(data);
      });
    }
    
    console.log('📡 Event listeners setup complete');
  }
  
  /**
   * Handle price updates
   */
  async handlePriceUpdate(data) {
    try {
      // Check for immediate arbitrage opportunities
      const opportunities = await this.detectPriceBasedOpportunities(data);
      
      for (const opportunity of opportunities) {
        await this.processOpportunity(opportunity, 'price_update');
      }
      
    } catch (error) {
      console.error('Error handling price update:', error);
    }
  }
  
  /**
   * Handle price anomalies
   */
  async handlePriceAnomaly(data) {
    try {
      // Price anomalies often indicate MEV opportunities
      const opportunity = {
        type: 'price_anomaly',
        symbol: data.symbol,
        source: data.source,
        anomalyPrice: data.price,
        expectedPrice: data.expectedPrice,
        deviation: data.deviation,
        timestamp: data.timestamp,
        urgency: 'high',
        confidence: 0.8
      };
      
      await this.processOpportunity(opportunity, 'price_anomaly');
      
    } catch (error) {
      console.error('Error handling price anomaly:', error);
    }
  }
  
  /**
   * Handle arbitrage opportunities from aggregator
   */
  async handleArbitrageOpportunities(data) {
    try {
      for (const opportunity of data.opportunities) {
        const enhancedOpportunity = {
          ...opportunity,
          type: 'arbitrage',
          symbol: data.symbol,
          detectedAt: Date.now(),
          source: 'price_aggregator'
        };
        
        await this.processOpportunity(enhancedOpportunity, 'arbitrage');
      }
      
    } catch (error) {
      console.error('Error handling arbitrage opportunities:', error);
    }
  }
  
  /**
   * Handle mempool opportunities
   */
  async handleMempoolOpportunity(data) {
    try {
      const opportunity = {
        type: 'mempool',
        txHash: data.txHash,
        analysis: data,
        timestamp: data.timestamp,
        urgency: data.mevRisk === 'high' ? 'critical' : 'medium',
        source: 'mempool_monitor'
      };
      
      await this.processOpportunity(opportunity, 'mempool');
      
    } catch (error) {
      console.error('Error handling mempool opportunity:', error);
    }
  }
  
  /**
   * Handle MEV opportunities
   */
  async handleMEVOpportunity(data) {
    try {
      const opportunity = {
        type: 'mev',
        subtype: data.type || 'sandwich',
        data: data,
        timestamp: data.timestamp,
        urgency: 'critical',
        source: 'mev_detector',
        estimatedProfit: data.estimatedProfit
      };
      
      await this.processOpportunity(opportunity, 'mev');
      
    } catch (error) {
      console.error('Error handling MEV opportunity:', error);
    }
  }
  
  /**
   * Detect price-based opportunities
   */
  async detectPriceBasedOpportunities(priceData) {
    const opportunities = [];
    
    try {
      // Get aggregated price for the symbol
      const aggregatedPrice = this.priceAggregator.getCurrentPrice(priceData.symbol);
      
      if (!aggregatedPrice || aggregatedPrice.sources < 2) {
        return opportunities; // Need multiple sources
      }
      
      // Calculate arbitrage opportunities
      const arbitrageOpps = this.priceAggregator.calculateArbitrageOpportunities(
        priceData.symbol,
        aggregatedPrice.sources
      );
      
      for (const opp of arbitrageOpps) {
        if (opp.netProfitPercentage >= this.options.minProfitThreshold * 100) {
          opportunities.push({
            type: 'price_arbitrage',
            symbol: priceData.symbol,
            ...opp,
            detectedAt: Date.now()
          });
        }
      }
      
    } catch (error) {
      console.error('Error detecting price-based opportunities:', error);
    }
    
    return opportunities;
  }
  
  /**
   * Process opportunity through pipeline stages
   */
  async processOpportunity(opportunity, source) {
    const opportunityId = this.generateOpportunityId(opportunity);
    const startTime = Date.now();
    
    try {
      this.metrics.totalOpportunities++;
      
      // Check if already processing this opportunity
      if (this.activeOpportunities.has(opportunityId)) {
        return;
      }
      
      // Create opportunity context
      const context = {
        id: opportunityId,
        opportunity,
        source,
        startTime,
        stage: 'detection',
        scores: {},
        riskAssessment: null,
        validationResults: null,
        processingTime: 0
      };
      
      // Add to active opportunities
      this.activeOpportunities.set(opportunityId, context);
      
      // Start pipeline processing
      const success = await this.runPipeline(context);
      
      // Update metrics
      context.processingTime = Date.now() - startTime;
      this.updateMetrics(context, success);
      
      // Move to history
      this.opportunityHistory.push(context);
      this.activeOpportunities.delete(opportunityId);
      
      // Limit history size
      if (this.opportunityHistory.length > 1000) {
        this.opportunityHistory.shift();
      }
      
    } catch (error) {
      console.error(`Error processing opportunity ${opportunityId}:`, error);
      this.activeOpportunities.delete(opportunityId);
    }
  }
  
  /**
   * Run opportunity through pipeline stages
   */
  async runPipeline(context) {
    try {
      // Stage 1: Validation
      context.stage = 'validation';
      const isValid = await this.validateOpportunity(context);
      
      if (!isValid) {
        context.stage = 'rejected';
        return false;
      }
      
      this.metrics.validatedOpportunities++;
      
      // Stage 2: Scoring
      context.stage = 'scoring';
      const score = await this.scoreOpportunity(context);
      context.scores.total = score;
      
      if (score < 50) { // Minimum score threshold
        context.stage = 'low_score';
        return false;
      }
      
      // Stage 3: Risk Assessment
      context.stage = 'risk_assessment';
      const riskAssessment = await this.assessRisk(context);
      context.riskAssessment = riskAssessment;
      
      if (riskAssessment.riskScore > this.options.maxRiskScore) {
        context.stage = 'high_risk';
        return false;
      }
      
      // Stage 4: Execution Decision
      context.stage = 'execution_decision';
      const shouldExecute = await this.makeExecutionDecision(context);
      
      if (!shouldExecute) {
        context.stage = 'execution_declined';
        return false;
      }
      
      // Stage 5: Queue for Execution
      context.stage = 'queued_for_execution';
      await this.queueForExecution(context);
      
      return true;
      
    } catch (error) {
      console.error('Error in pipeline processing:', error);
      context.stage = 'error';
      return false;
    }
  }
  
  /**
   * Validate opportunity
   */
  async validateOpportunity(context) {
    const { opportunity } = context;
    
    try {
      // Check if opportunity is still valid (not expired)
      const age = Date.now() - opportunity.timestamp;
      if (age > this.options.opportunityTimeout) {
        return false;
      }
      
      // Validate price data freshness
      if (opportunity.type.includes('price')) {
        const priceAge = Date.now() - opportunity.timestamp;
        if (priceAge > this.options.priceValidityWindow) {
          return false;
        }
      }
      
      // Validate profit threshold
      if (opportunity.netProfitPercentage) {
        const minProfit = this.options.minProfitThreshold * 100;
        if (opportunity.netProfitPercentage < minProfit) {
          return false;
        }
      }
      
      // Additional type-specific validation
      switch (opportunity.type) {
        case 'arbitrage':
        case 'price_arbitrage':
          return this.validateArbitrageOpportunity(opportunity);
          
        case 'mev':
          return this.validateMEVOpportunity(opportunity);
          
        case 'mempool':
          return this.validateMempoolOpportunity(opportunity);
          
        default:
          return true;
      }
      
    } catch (error) {
      console.error('Error validating opportunity:', error);
      return false;
    }
  }
  
  /**
   * Validate arbitrage opportunity
   */
  validateArbitrageOpportunity(opportunity) {
    // Check if exchanges are supported
    if (!opportunity.buyFrom || !opportunity.sellTo) {
      return false;
    }
    
    // Check liquidity requirements
    if (opportunity.liquidityScore === 'low') {
      return false;
    }
    
    // Check price impact
    if (opportunity.priceImpact && opportunity.priceImpact.total > 2) { // 2% max impact
      return false;
    }
    
    return true;
  }
  
  /**
   * Validate MEV opportunity
   */
  validateMEVOpportunity(opportunity) {
    // MEV opportunities are often time-sensitive
    const age = Date.now() - opportunity.timestamp;
    if (age > 5000) { // 5 seconds max age for MEV
      return false;
    }
    
    return true;
  }
  
  /**
   * Validate mempool opportunity
   */
  validateMempoolOpportunity(opportunity) {
    // Check if transaction is still pending
    if (opportunity.analysis && opportunity.analysis.mevRisk === 'high') {
      return true; // High MEV risk usually means good opportunity
    }
    
    return opportunity.analysis && opportunity.analysis.hasOpportunity;
  }
  
  /**
   * Score opportunity using multiple factors
   */
  async scoreOpportunity(context) {
    const { opportunity } = context;
    const weights = this.scoringWeights;
    
    try {
      let totalScore = 0;
      
      // Profit score (0-100)
      const profitScore = this.calculateProfitScore(opportunity);
      totalScore += profitScore * weights.profit;
      context.scores.profit = profitScore;
      
      // Confidence score (0-100)
      const confidenceScore = this.calculateConfidenceScore(opportunity);
      totalScore += confidenceScore * weights.confidence;
      context.scores.confidence = confidenceScore;
      
      // Liquidity score (0-100)
      const liquidityScore = this.calculateLiquidityScore(opportunity);
      totalScore += liquidityScore * weights.liquidity;
      context.scores.liquidity = liquidityScore;
      
      // Speed score (0-100) - higher for time-sensitive opportunities
      const speedScore = this.calculateSpeedScore(opportunity);
      totalScore += speedScore * weights.speed;
      context.scores.speed = speedScore;
      
      // Risk score (0-100, inverted - lower risk = higher score)
      const riskScore = this.calculateRiskScore(opportunity);
      totalScore += (100 - riskScore) * weights.risk;
      context.scores.risk = riskScore;
      
      // Market conditions score (0-100)
      const marketScore = this.calculateMarketScore(opportunity);
      totalScore += marketScore * weights.market;
      context.scores.market = marketScore;
      
      return Math.round(totalScore);
      
    } catch (error) {
      console.error('Error scoring opportunity:', error);
      return 0;
    }
  }
  
  /**
   * Calculate profit score
   */
  calculateProfitScore(opportunity) {
    if (opportunity.netProfitPercentage) {
      // Convert percentage to score (0.5% = 50, 2% = 100)
      return Math.min(opportunity.netProfitPercentage * 50, 100);
    }
    
    if (opportunity.estimatedProfit && opportunity.estimatedProfit.estimatedProfit) {
      // Assume $100 profit = 100 score
      return Math.min(opportunity.estimatedProfit.estimatedProfit / 100 * 100, 100);
    }
    
    return 50; // Default score
  }
  
  /**
   * Calculate confidence score
   */
  calculateConfidenceScore(opportunity) {
    if (opportunity.confidence) {
      return opportunity.confidence * 100;
    }
    
    // Base confidence on data sources and quality
    let confidence = 50;
    
    if (opportunity.sourceCount > 3) confidence += 20;
    if (opportunity.liquidityScore === 'high') confidence += 15;
    if (opportunity.priceImpact && opportunity.priceImpact.total < 0.5) confidence += 15;
    
    return Math.min(confidence, 100);
  }
  
  /**
   * Calculate liquidity score
   */
  calculateLiquidityScore(opportunity) {
    if (opportunity.liquidityScore) {
      const scores = { low: 20, medium: 60, high: 100 };
      return scores[opportunity.liquidityScore] || 50;
    }
    
    return 50;
  }
  
  /**
   * Calculate speed score
   */
  calculateSpeedScore(opportunity) {
    const age = Date.now() - opportunity.timestamp;
    const maxAge = this.options.opportunityTimeout;
    
    // Newer opportunities get higher scores
    return Math.max(0, 100 - (age / maxAge) * 100);
  }
  
  /**
   * Calculate risk score
   */
  calculateRiskScore(opportunity) {
    if (opportunity.riskScore) {
      return opportunity.riskScore;
    }
    
    let risk = 30; // Base risk
    
    // Add risk factors
    if (opportunity.type === 'mev') risk += 20;
    if (opportunity.slippageRisk === 'high') risk += 15;
    if (opportunity.liquidityScore === 'low') risk += 15;
    if (opportunity.urgency === 'critical') risk += 10;
    
    return Math.min(risk, 100);
  }
  
  /**
   * Calculate market conditions score
   */
  calculateMarketScore(opportunity) {
    let score = 50;
    
    // Adjust based on current market conditions
    if (this.marketConditions.volatility === 'high') score += 20;
    if (this.marketConditions.liquidity === 'high') score += 15;
    if (this.marketConditions.gasPrice === 'low') score += 15;
    
    return Math.min(score, 100);
  }
  
  /**
   * Assess risk for opportunity
   */
  async assessRisk(context) {
    try {
      const { opportunity } = context;
      
      // Use risk manager if available
      if (this.riskManager) {
        const timeout = this.options.riskAssessmentTimeout;
        const riskAssessment = await Promise.race([
          this.riskManager.assessOpportunity(opportunity),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Risk assessment timeout')), timeout)
          )
        ]);
        
        return riskAssessment;
      }
      
      // Fallback risk assessment
      return {
        riskScore: context.scores.risk || 50,
        factors: ['default_assessment'],
        recommendation: context.scores.risk < 60 ? 'proceed' : 'caution'
      };
      
    } catch (error) {
      console.error('Error in risk assessment:', error);
      return {
        riskScore: 75, // Conservative high risk
        factors: ['assessment_error'],
        recommendation: 'decline'
      };
    }
  }
  
  /**
   * Make execution decision
   */
  async makeExecutionDecision(context) {
    const { scores, riskAssessment } = context;
    
    // Check minimum requirements
    if (scores.total < 60) return false;
    if (riskAssessment.riskScore > this.options.maxRiskScore) return false;
    if (riskAssessment.recommendation === 'decline') return false;
    
    // Check system capacity
    if (this.activeOpportunities.size >= this.options.maxConcurrentOpportunities) {
      return false;
    }
    
    // Additional checks for different opportunity types
    switch (context.opportunity.type) {
      case 'mev':
        return scores.speed > 80; // MEV needs high speed score
        
      case 'arbitrage':
        return scores.profit > 40 && scores.confidence > 60;
        
      default:
        return true;
    }
  }
  
  /**
   * Queue opportunity for execution
   */
  async queueForExecution(context) {
    // Add to execution queue with priority
    const priority = this.calculateExecutionPriority(context);
    
    this.opportunityQueue.push({
      ...context,
      priority,
      queuedAt: Date.now()
    });
    
    // Sort by priority
    this.opportunityQueue.sort((a, b) => b.priority - a.priority);
    
    // Emit execution ready event
    this.emit('opportunityReady', {
      id: context.id,
      type: context.opportunity.type,
      score: context.scores.total,
      priority,
      timestamp: Date.now()
    });
  }
  
  /**
   * Calculate execution priority
   */
  calculateExecutionPriority(context) {
    let priority = context.scores.total;
    
    // Boost priority for time-sensitive opportunities
    if (context.opportunity.urgency === 'critical') priority += 20;
    if (context.opportunity.type === 'mev') priority += 15;
    
    // Reduce priority based on age
    const age = Date.now() - context.opportunity.timestamp;
    const ageScore = Math.max(0, 20 - (age / 1000)); // Reduce 1 point per second
    priority += ageScore;
    
    return Math.min(priority, 150);
  }
  
  /**
   * Start opportunity processor
   */
  startOpportunityProcessor() {
    this.processingTimer = setInterval(() => {
      this.processOpportunityQueue();
      this.cleanupExpiredOpportunities();
    }, this.options.scoringInterval);
    
    console.log('⚡ Opportunity processor started');
  }
  
  /**
   * Process opportunity queue
   */
  processOpportunityQueue() {
    // Get top priority opportunities
    const topOpportunities = this.opportunityQueue.splice(0, 5);
    
    for (const opportunity of topOpportunities) {
      this.emit('executeOpportunity', opportunity);
    }
  }
  
  /**
   * Cleanup expired opportunities
   */
  cleanupExpiredOpportunities() {
    const now = Date.now();
    const timeout = this.options.opportunityTimeout;
    
    // Clean active opportunities
    for (const [id, context] of this.activeOpportunities) {
      if (now - context.startTime > timeout) {
        this.activeOpportunities.delete(id);
      }
    }
    
    // Clean opportunity queue
    this.opportunityQueue = this.opportunityQueue.filter(
      opp => now - opp.queuedAt < timeout
    );
  }
  
  /**
   * Start market monitoring
   */
  startMarketMonitoring() {
    setInterval(() => {
      this.updateMarketConditions();
    }, 30000); // Update every 30 seconds
    
    console.log('📊 Market monitoring started');
  }
  
  /**
   * Update market conditions
   */
  async updateMarketConditions() {
    try {
      // Get gas price conditions
      if (this.mempoolMonitor) {
        const networkStatus = this.mempoolMonitor.getNetworkStatus();
        this.marketConditions.gasPrice = networkStatus.congestionLevel;
        this.marketConditions.congestion = networkStatus.congestionLevel;
      }
      
      // Get price volatility (simplified)
      this.marketConditions.volatility = 'medium'; // Would calculate from price data
      this.marketConditions.liquidity = 'normal'; // Would calculate from pool data
      this.marketConditions.lastUpdate = Date.now();
      
    } catch (error) {
      console.error('Error updating market conditions:', error);
    }
  }
  
  /**
   * Generate unique opportunity ID
   */
  generateOpportunityId(opportunity) {
    const type = opportunity.type || 'unknown';
    const symbol = opportunity.symbol || 'unknown';
    const timestamp = opportunity.timestamp || Date.now();
    const hash = this.simpleHash(`${type}-${symbol}-${timestamp}`);
    
    return `opp_${hash}`;
  }
  
  /**
   * Simple hash function
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
  
  /**
   * Update performance metrics
   */
  updateMetrics(context, success) {
    this.metrics.averageProcessingTime = 
      (this.metrics.averageProcessingTime + context.processingTime) / 2;
    
    if (success) {
      this.metrics.executedOpportunities++;
      
      // Track profitability (simplified)
      if (context.opportunity.netProfitPercentage > 0) {
        this.metrics.profitableExecutions++;
        this.metrics.averageProfitability = 
          (this.metrics.averageProfitability + context.opportunity.netProfitPercentage) / 2;
      }
    }
    
    this.metrics.successRate = this.metrics.totalOpportunities > 0 ?
      (this.metrics.executedOpportunities / this.metrics.totalOpportunities) * 100 : 0;
    
    this.metrics.lastUpdate = Date.now();
  }
  
  /**
   * Get pipeline statistics
   */
  getStats() {
    return {
      ...this.metrics,
      activeOpportunities: this.activeOpportunities.size,
      queuedOpportunities: this.opportunityQueue.length,
      historicalOpportunities: this.opportunityHistory.length,
      marketConditions: this.marketConditions,
      successRate: Math.round(this.metrics.successRate * 100) / 100,
      averageProfitability: Math.round(this.metrics.averageProfitability * 100) / 100
    };
  }
  
  /**
   * Get top opportunities currently being processed
   */
  getTopOpportunities(limit = 10) {
    return Array.from(this.activeOpportunities.values())
      .sort((a, b) => (b.scores.total || 0) - (a.scores.total || 0))
      .slice(0, limit)
      .map(context => ({
        id: context.id,
        type: context.opportunity.type,
        stage: context.stage,
        score: context.scores.total,
        profit: context.opportunity.netProfitPercentage,
        age: Date.now() - context.startTime
      }));
  }
  
  /**
   * Get opportunity history analytics
   */
  getAnalytics() {
    const typeDistribution = {};
    const stageDistribution = {};
    let totalProfit = 0;
    let profitableCount = 0;
    
    for (const context of this.opportunityHistory) {
      // Type distribution
      const type = context.opportunity.type;
      typeDistribution[type] = (typeDistribution[type] || 0) + 1;
      
      // Stage distribution
      stageDistribution[context.stage] = (stageDistribution[context.stage] || 0) + 1;
      
      // Profit tracking
      if (context.stage === 'executed' && context.opportunity.netProfitPercentage) {
        totalProfit += context.opportunity.netProfitPercentage;
        profitableCount++;
      }
    }
    
    return {
      typeDistribution,
      stageDistribution,
      averageProfit: profitableCount > 0 ? totalProfit / profitableCount : 0,
      totalOpportunities: this.opportunityHistory.length,
      profitableOpportunities: profitableCount
    };
  }
  
  /**
   * Stop the opportunity pipeline
   */
  async stop() {
    console.log('🛑 Stopping OpportunityPipeline...');
    
    this.isActive = false;
    
    // Stop processing timer
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
    }
    
    // Process remaining opportunities
    this.processOpportunityQueue();
    
    // Clear data
    this.activeOpportunities.clear();
    this.opportunityQueue = [];
    
    console.log('✅ OpportunityPipeline stopped');
  }
}

export default OpportunityPipeline;