import { EventEmitter } from 'events';
import SlippageManager from './SlippageManager.js';
import TradeSizeManager from './TradeSizeManager.js';
import CircuitBreakerManager from './CircuitBreakerManager.js';
import EmergencyStopManager from './EmergencyStopManager.js';
import RiskAssessmentEngine from './RiskAssessmentEngine.js';
import MarketConditionMonitor from './MarketConditionMonitor.js';
import PerformanceRiskManager from './PerformanceRiskManager.js';

/**
 * RiskManager - Enhanced with comprehensive risk management components
 * Coordinates all risk management systems and provides unified risk assessment
 */
class RiskManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      // Legacy options for backward compatibility
      maxDailyLoss: options.maxDailyLoss || 1000,
      maxTradeAmount: options.maxTradeAmount || 1000,
      maxPositionSize: options.maxPositionSize || 0.1,
      maxDrawdown: options.maxDrawdown || 0.2,
      volatilityThreshold: options.volatilityThreshold || 0.05,
      correlationThreshold: options.correlationThreshold || 0.8,
      liquidityThreshold: options.liquidityThreshold || 100000,
      emergencyStopLoss: options.emergencyStopLoss || 0.05,
      maxConsecutiveLosses: options.maxConsecutiveLosses || 5,
      cooldownPeriod: options.cooldownPeriod || 300000,
      simulationRuns: options.simulationRuns || 1000,
      confidenceLevel: options.confidenceLevel || 0.95,
      
      // Enhanced risk management options
      enableAdvancedRiskManagement: options.enableAdvancedRiskManagement !== false,
      riskAssessmentTimeout: options.riskAssessmentTimeout || 5000, // 5 seconds
      
      ...options
    };
    
    // Initialize risk management components
    this.riskComponents = {
      slippageManager: new SlippageManager(options.slippage || {}),
      tradeSizeManager: new TradeSizeManager(options.tradeSize || {}),
      circuitBreakerManager: new CircuitBreakerManager(options.circuitBreaker || {}),
      emergencyStopManager: new EmergencyStopManager(options.emergencyStop || {}),
      riskAssessmentEngine: new RiskAssessmentEngine(options.riskAssessment || {}),
      marketConditionMonitor: new MarketConditionMonitor(options.marketCondition || {}),
      performanceRiskManager: new PerformanceRiskManager(options.performanceRisk || {})
    };
    
    // Legacy risk state for backward compatibility
    this.riskState = {
      currentDrawdown: 0,
      dailyPnL: 0,
      consecutiveLosses: 0,
      lastTradeTime: 0,
      emergencyStop: false,
      cooldownUntil: 0,
      totalExposure: 0
    };
    
    // Legacy portfolio tracking
    this.portfolio = {
      totalValue: options.initialCapital || 10000,
      cash: options.initialCapital || 10000,
      positions: new Map(),
      maxValue: options.initialCapital || 10000,
      initialValue: options.initialCapital || 10000
    };
    
    // Legacy risk metrics
    this.riskMetrics = {
      valueAtRisk: { '1d': 0, '7d': 0, '30d': 0 },
      expectedShortfall: { '1d': 0, '7d': 0, '30d': 0 },
      sharpeRatio: 0,
      sortinoRatio: 0,
      maxDrawdown: 0,
      volatility: { '1d': 0, '7d': 0, '30d': 0 },
      beta: 0,
      correlation: new Map(),
      riskScore: 0
    };
    
    // Legacy historical data
    this.priceHistory = new Map();
    this.returnHistory = [];
    this.tradeHistory = [];
    this.riskAssessmentCache = new Map();
    this.lastRiskUpdate = 0;
    
    // Legacy market data
    this.marketData = {
      volatility: new Map(),
      liquidity: new Map(),
      gasPrice: { current: 20, average: 25, volatility: 0.3 },
      networkCongestion: 'normal'
    };
    
    // Component initialization status
    this.componentStatus = new Map();
    
    this.isInitialized = false;
  }
  
  /**
   * Initialize the enhanced risk manager and all components
   */
  async initialize() {
    if (this.isInitialized) return;
    
    console.log('🛡️ Initializing Enhanced Risk Manager...');
    
    try {
      if (this.options.enableAdvancedRiskManagement) {
        // Initialize all risk management components
        await this.initializeRiskComponents();
        
        // Setup component event handlers
        this.setupComponentEventHandlers();
      }
      
      // Initialize legacy components for backward compatibility
      await this.initializeLegacyComponents();
      
      this.isInitialized = true;
      
      console.log('✅ Enhanced Risk Manager initialized');
      console.log(`🎯 Components active: ${Array.from(this.componentStatus.entries())
        .filter(([_, status]) => status.initialized)
        .map(([name, _]) => name)
        .join(', ')}`);
      
      this.emit('initialized', {
        advancedRiskManagement: this.options.enableAdvancedRiskManagement,
        componentStatus: Object.fromEntries(this.componentStatus),
        limits: this.options,
        initialMetrics: this.riskMetrics
      });
      
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced Risk Manager:', error.message);
      throw error;
    }
  }
  
  /**
   * Initialize all risk management components
   */
  async initializeRiskComponents() {
    const initPromises = [];
    
    for (const [componentName, component] of Object.entries(this.riskComponents)) {
      const initPromise = this.initializeComponent(componentName, component);
      initPromises.push(initPromise);
      
      this.componentStatus.set(componentName, {
        initialized: false,
        healthy: false,
        lastUpdate: null,
        errors: []
      });
    }
    
    // Initialize components in parallel with timeout
    const results = await Promise.allSettled(initPromises);
    
    // Process results
    results.forEach((result, index) => {
      const componentName = Object.keys(this.riskComponents)[index];
      const status = this.componentStatus.get(componentName);
      
      if (result.status === 'fulfilled') {
        status.initialized = true;
        status.healthy = true;
        status.lastUpdate = Date.now();
        console.log(`✅ ${componentName} initialized successfully`);
      } else {
        status.initialized = false;
        status.healthy = false;
        status.errors.push(result.reason.message);
        console.warn(`⚠️ ${componentName} initialization failed:`, result.reason.message);
      }
    });
  }
  
  /**
   * Initialize a single component with timeout
   */
  async initializeComponent(componentName, component) {
    return Promise.race([
      component.initialize(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Initialization timeout for ${componentName}`)), 
        this.options.riskAssessmentTimeout)
      )
    ]);
  }
  
  /**
   * Setup event handlers for component coordination  
   */
  setupComponentEventHandlers() {
    // Emergency stop coordination
    this.riskComponents.emergencyStopManager.on('emergencyStop', (data) => {
      this.handleEmergencyStop(data);
    });
    
    // Circuit breaker coordination
    this.riskComponents.circuitBreakerManager.on('circuitBreakerTriggered', (data) => {
      this.handleCircuitBreakerTrigger(data);
    });
    
    // Market condition changes
    this.riskComponents.marketConditionMonitor.on('volatilityRegimeChange', (data) => {
      this.handleMarketConditionChange('volatility', data);
    });
    
    this.riskComponents.marketConditionMonitor.on('liquidityRegimeChange', (data) => {
      this.handleMarketConditionChange('liquidity', data);
    });
    
    // Performance risk adjustments
    this.riskComponents.performanceRiskManager.on('tradeProcessed', (data) => {
      this.handlePerformanceUpdate(data);
    });
    
    // Component health monitoring
    setInterval(() => {
      this.monitorComponentHealth();
    }, 60000); // Every minute
  }
  
  /**
   * Enhanced trade risk assessment using all components
   */
  async assessTradeRisk(opportunity, tradeAmount = null) {
    if (!this.isInitialized) await this.initialize();
    
    const startTime = performance.now();
    
    try {
      // Check emergency stop first
      if (this.isEmergencyActive()) {
        return {
          approved: false,
          reason: 'Emergency stop active',
          riskScore: 1.0,
          restrictions: this.getEmergencyRestrictions()
        };
      }
      
      // Check circuit breakers
      if (!this.isTradingAllowed()) {
        return {
          approved: false,
          reason: 'Circuit breakers active',
          riskScore: 1.0,
          restrictions: this.getCircuitBreakerRestrictions()
        };
      }
      
      const assessment = {
        opportunityId: opportunity.id,
        timestamp: Date.now(),
        approved: true,
        riskScore: 0,
        maxTradeSize: tradeAmount || opportunity.tradeAmount,
        warnings: [],
        restrictions: [],
        metrics: {},
        components: {}
      };
      
      if (this.options.enableAdvancedRiskManagement) {
        // Run enhanced risk assessment
        await this.runEnhancedRiskAssessment(opportunity, tradeAmount, assessment);
      } else {
        // Run legacy risk assessment
        await this.runLegacyRiskAssessment(opportunity, assessment);
      }
      
      // Final approval decision
      assessment.approved = this.makeFinalApprovalDecision(assessment);
      if (!assessment.approved && !assessment.reason) {
        assessment.reason = this.generateDeclineReason(assessment);
      }
      
      assessment.calculationTime = performance.now() - startTime;
      
      // Cache assessment
      this.cacheRiskAssessment(opportunity.id, assessment);
      
      this.emit('riskAssessment', assessment);
      
      return assessment;
      
    } catch (error) {
      console.error('Enhanced risk assessment failed:', error.message);
      
      // Fallback to conservative assessment
      return {
        approved: false,
        reason: 'Risk assessment system error',
        riskScore: 1.0,
        error: error.message,
        calculationTime: performance.now() - startTime
      };
    }
  }
  
  /**
   * Run enhanced risk assessment using all components
   */
  async runEnhancedRiskAssessment(opportunity, tradeAmount, assessment) {
    const assessmentPromises = [];
    
    // Risk Assessment Engine
    if (this.isComponentHealthy('riskAssessmentEngine')) {
      assessmentPromises.push(
        this.runComponentAssessment('riskAssessmentEngine', 
          () => this.riskComponents.riskAssessmentEngine.assessOpportunityRisk(opportunity, tradeAmount)
        )
      );
    }
    
    // Slippage Assessment
    if (this.isComponentHealthy('slippageManager')) {
      assessmentPromises.push(
        this.runComponentAssessment('slippageManager',
          () => this.riskComponents.slippageManager.calculateDynamicSlippage(opportunity, tradeAmount || opportunity.tradeAmount)
        )
      );
    }
    
    // Trade Size Assessment
    if (this.isComponentHealthy('tradeSizeManager')) {
      assessmentPromises.push(
        this.runComponentAssessment('tradeSizeManager',
          () => this.riskComponents.tradeSizeManager.calculateOptimalTradeSize(opportunity, tradeAmount)
        )
      );
    }
    
    // Performance Risk Assessment
    if (this.isComponentHealthy('performanceRiskManager')) {
      assessmentPromises.push(
        this.runComponentAssessment('performanceRiskManager',
          () => Promise.resolve(this.riskComponents.performanceRiskManager.getCurrentRiskAdjustment())
        )
      );
    }
    
    // Wait for all assessments with timeout
    const results = await Promise.allSettled(assessmentPromises);
    
    // Process results
    results.forEach((result, index) => {
      const componentName = ['riskAssessmentEngine', 'slippageManager', 'tradeSizeManager', 'performanceRiskManager'][index];
      
      if (result.status === 'fulfilled' && result.value) {
        assessment.components[componentName] = result.value.data;
        
        // Integrate component results
        this.integrateComponentAssessment(componentName, result.value.data, assessment);
      } else {
        console.warn(`Component ${componentName} assessment failed:`, result.reason?.message);
        assessment.warnings.push(`${componentName} assessment unavailable`);
      }
    });
    
    // Calculate overall risk score
    assessment.riskScore = this.calculateEnhancedRiskScore(assessment);
  }
  
  /**
   * Run component assessment with timeout and error handling
   */
  async runComponentAssessment(componentName, assessmentFn) {
    try {
      const result = await Promise.race([
        assessmentFn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`${componentName} assessment timeout`)), 2000)
        )
      ]);
      
      return { componentName, data: result, success: true };
      
    } catch (error) {
      console.warn(`${componentName} assessment failed:`, error.message);
      this.recordComponentError(componentName, error);
      return { componentName, data: null, success: false, error: error.message };
    }
  }
  
  /**
   * Integrate component assessment results
   */
  integrateComponentAssessment(componentName, data, assessment) {
    switch (componentName) {
      case 'riskAssessmentEngine':
        if (data.overallScore) {
          assessment.riskScore = Math.max(assessment.riskScore, data.overallScore);
        }
        if (data.warnings) {
          assessment.warnings.push(...data.warnings.map(w => w.message || w));
        }
        break;
        
      case 'slippageManager':
        if (data.slippage?.final) {
          assessment.metrics.slippage = data.slippage.final;
          if (data.recommendation?.action === 'REJECT') {
            assessment.restrictions.push({
              type: 'slippage',
              reason: data.recommendation.reason,
              severity: 'high'
            });
          }
        }
        break;
        
      case 'tradeSizeManager':
        if (data.optimal?.amount) {
          assessment.maxTradeSize = Math.min(assessment.maxTradeSize, data.optimal.amount);
          if (data.recommendation?.action === 'REJECT') {
            assessment.restrictions.push({
              type: 'trade_size',
              reason: data.recommendation.reason,
              severity: 'high'
            });
          }
        }
        break;
        
      case 'performanceRiskManager':
        if (data.multiplier) {
          assessment.metrics.performanceMultiplier = data.multiplier;
          if (data.multiplier < 0.5) {
            assessment.warnings.push('Performance-based risk reduction active');
          }
        }
        break;
    }
  }
  
  /**
   * Calculate enhanced risk score from all components
   */
  calculateEnhancedRiskScore(assessment) {
    let riskScore = 0;
    let componentCount = 0;
    
    // Risk Assessment Engine score (primary)
    if (assessment.components.riskAssessmentEngine?.overallScore) {
      riskScore += assessment.components.riskAssessmentEngine.overallScore * 0.4;
      componentCount += 0.4;
    }
    
    // Slippage risk
    if (assessment.metrics.slippage) {
      const slippageRisk = Math.min(assessment.metrics.slippage / 0.02, 1.0); // 2% max slippage
      riskScore += slippageRisk * 0.3;
      componentCount += 0.3;
    }
    
    // Performance risk adjustment
    if (assessment.metrics.performanceMultiplier) {
      const perfRisk = Math.max(0, 2 - assessment.metrics.performanceMultiplier) / 2;
      riskScore += perfRisk * 0.2;
      componentCount += 0.2;
    }
    
    // Circuit breaker penalties
    if (assessment.restrictions.length > 0) {
      riskScore += 0.1;
      componentCount += 0.1;
    }
    
    return componentCount > 0 ? riskScore / componentCount : 0.5;
  }
  
  /**
   * Make final approval decision
   */
  makeFinalApprovalDecision(assessment) {
    // High risk score rejection
    if (assessment.riskScore > 0.8) {
      assessment.reason = `High risk score: ${(assessment.riskScore * 100).toFixed(1)}%`;
      return false;
    }
    
    // Critical restrictions
    const criticalRestrictions = assessment.restrictions.filter(r => r.severity === 'high');
    if (criticalRestrictions.length > 0) {
      assessment.reason = criticalRestrictions[0].reason;
      return false;
    }
    
    // Trade size too small
    if (assessment.maxTradeSize < 100) {
      assessment.reason = 'Trade size too small after risk adjustments';
      return false;
    }
    
    return true;
  }
  
  /**
   * Process trade result through all components
   */
  processTradeResult(tradeResult) {
    // Update legacy state
    this.updateLegacyState(tradeResult);
    
    if (this.options.enableAdvancedRiskManagement) {
      // Process through enhanced components
      if (this.isComponentHealthy('performanceRiskManager')) {
        this.riskComponents.performanceRiskManager.processTradeResult(tradeResult);
      }
      
      if (this.isComponentHealthy('tradeSizeManager')) {
        this.riskComponents.tradeSizeManager.releaseCapital(
          tradeResult.tradeId,
          tradeResult.pnl
        );
      }
      
      if (this.isComponentHealthy('circuitBreakerManager')) {
        this.riskComponents.circuitBreakerManager.recordTradeResult(tradeResult);
      }
      
      if (this.isComponentHealthy('slippageManager') && tradeResult.actualSlippage) {
        this.riskComponents.slippageManager.updateRealizedSlippage(
          tradeResult.tradeId,
          tradeResult.predictedSlippage || 0,
          tradeResult.actualSlippage
        );
      }
    }
    
    this.emit('tradeProcessed', {
      tradeResult,
      riskState: this.riskState,
      portfolioValue: this.portfolio.totalValue
    });
  }
  
  // Component health and monitoring
  
  isComponentHealthy(componentName) {
    const status = this.componentStatus.get(componentName);
    return status && status.initialized && status.healthy;
  }
  
  recordComponentError(componentName, error) {
    const status = this.componentStatus.get(componentName);
    if (status) {
      status.errors.push({
        timestamp: Date.now(),
        message: error.message
      });
      
      // Keep only recent errors
      if (status.errors.length > 10) {
        status.errors = status.errors.slice(-10);
      }
      
      // Mark as unhealthy if too many recent errors
      const recentErrors = status.errors.filter(e => Date.now() - e.timestamp < 300000);
      if (recentErrors.length > 3) {
        status.healthy = false;
      }
    }
  }
  
  monitorComponentHealth() {
    for (const [componentName, status] of this.componentStatus) {
      if (status.initialized) {
        // Check if component has been responsive
        const timeSinceUpdate = Date.now() - (status.lastUpdate || 0);
        if (timeSinceUpdate > 600000) { // 10 minutes
          status.healthy = false;
          console.warn(`⚠️ ${componentName} appears unhealthy (no updates for ${Math.round(timeSinceUpdate / 60000)} minutes)`);
        }
        
        // Clear old errors
        status.errors = status.errors.filter(e => Date.now() - e.timestamp < 3600000);
      }
    }
  }
  
  // Emergency and circuit breaker handling
  
  isEmergencyActive() {
    return this.isComponentHealthy('emergencyStopManager') ? 
      this.riskComponents.emergencyStopManager.isEmergencyActive() :
      this.riskState.emergencyStop;
  }
  
  isTradingAllowed() {
    // Check emergency stop
    if (this.isEmergencyActive()) return false;
    
    // Check circuit breakers
    if (this.isComponentHealthy('circuitBreakerManager')) {
      return this.riskComponents.circuitBreakerManager.isTradingAllowed();
    }
    
    // Legacy check
    return this.isLegacyTradingAllowed();
  }
  
  getEmergencyRestrictions() {
    if (this.isComponentHealthy('emergencyStopManager')) {
      return this.riskComponents.emergencyStopManager.getEmergencyStatus();
    }
    return { isActive: this.riskState.emergencyStop };
  }
  
  getCircuitBreakerRestrictions() {
    if (this.isComponentHealthy('circuitBreakerManager')) {
      return this.riskComponents.circuitBreakerManager.getTradingRestrictions();
    }
    return this.getLegacyTradingRestrictions();
  }
  
  handleEmergencyStop(data) {
    console.log('🚨 Emergency stop coordinated across all systems');
    this.riskState.emergencyStop = true;
    
    // Trigger circuit breakers
    if (this.isComponentHealthy('circuitBreakerManager')) {
      this.riskComponents.circuitBreakerManager.emergencyShutdown(data.reason);
    }
    
    this.emit('systemEmergencyStop', data);
  }
  
  handleCircuitBreakerTrigger(data) {
    console.log(`⚡ Circuit breaker coordination: ${data.name}`);
    
    // Update legacy state for critical breakers
    if (['dailyLoss', 'drawdown', 'emergency'].includes(data.name)) {
      this.riskState.emergencyStop = true;
    }
    
    this.emit('circuitBreakerCoordinated', data);
  }
  
  handleMarketConditionChange(type, data) {
    console.log(`📊 Market condition change: ${type}`);
    
    // Adjust risk parameters based on market conditions
    if (type === 'volatility' && data.to === 'extreme') {
      // Increase risk thresholds during extreme volatility
      this.temporaryRiskAdjustment = 1.5;
    }
    
    if (type === 'liquidity' && data.to === 'critical') {
      // Reduce trade sizes during liquidity crisis
      this.temporaryRiskAdjustment = 0.5;
    }
    
    this.emit('marketConditionCoordinated', { type, data });
  }
  
  handlePerformanceUpdate(data) {
    // Coordinate performance-based adjustments across systems
    const adjustment = data.newAdjustments.overall;
    
    if (adjustment < 0.5) {
      console.log('📉 Performance-based risk reduction coordinated');
    } else if (adjustment > 1.5) {
      console.log('📈 Performance-based risk increase coordinated');
    }
    
    this.emit('performanceRiskCoordinated', data);
  }
  
  // Legacy methods for backward compatibility
  
  async initializeLegacyComponents() {
    await this.loadHistoricalData();
    await this.updateRiskMetrics();
    this.setupRiskMonitoring();
  }
  
  async runLegacyRiskAssessment(opportunity, assessment) {
    // 1. Portfolio impact assessment
    const portfolioImpact = this.assessPortfolioImpact(opportunity);
    assessment.metrics.portfolioImpact = portfolioImpact;
    
    // 2. Market risk assessment
    const marketRisk = await this.assessMarketRisk(opportunity);
    assessment.metrics.marketRisk = marketRisk;
    
    // 3. Liquidity risk assessment
    const liquidityRisk = this.assessLiquidityRisk(opportunity);
    assessment.metrics.liquidityRisk = liquidityRisk;
    
    // 4. Execution risk assessment
    const executionRisk = this.assessExecutionRisk(opportunity);
    assessment.metrics.executionRisk = executionRisk;
    
    // 5. Concentration risk assessment
    const concentrationRisk = this.assessConcentrationRisk(opportunity);
    assessment.metrics.concentrationRisk = concentrationRisk;
    
    // Calculate overall risk score
    assessment.riskScore = this.calculateOverallRiskScore([
      portfolioImpact.riskScore,
      marketRisk.riskScore,
      liquidityRisk.riskScore,
      executionRisk.riskScore,
      concentrationRisk.riskScore
    ]);
    
    // Determine maximum trade size
    assessment.maxTradeSize = this.calculateMaxTradeSize(opportunity, assessment);
    
    // Collect warnings
    assessment.warnings.push(...portfolioImpact.warnings);
    assessment.warnings.push(...marketRisk.warnings);
    assessment.warnings.push(...liquidityRisk.warnings);
    assessment.warnings.push(...executionRisk.warnings);
    assessment.warnings.push(...concentrationRisk.warnings);
  }
  
  updateLegacyState(tradeResult) {
    this.updatePortfolio(tradeResult);
    this.updateRiskState(tradeResult);
    this.updateTradeHistory(tradeResult);
    this.scheduleRiskUpdate();
    this.checkEmergencyConditions();
  }
  
  isLegacyTradingAllowed() {
    const now = Date.now();
    
    if (this.riskState.emergencyStop) return false;
    if (now < this.riskState.cooldownUntil) return false;
    if (Math.abs(this.riskState.dailyPnL) >= this.options.maxDailyLoss) return false;
    if (this.riskState.currentDrawdown >= this.options.maxDrawdown) return false;
    if (this.riskState.consecutiveLosses >= this.options.maxConsecutiveLosses) return false;
    
    return true;
  }
  
  getLegacyTradingRestrictions() {
    const restrictions = [];
    const now = Date.now();
    
    if (this.riskState.emergencyStop) {
      restrictions.push({
        type: 'emergency_stop',
        reason: 'Emergency stop activated',
        severity: 'critical'
      });
    }
    
    if (now < this.riskState.cooldownUntil) {
      restrictions.push({
        type: 'cooldown',
        reason: 'Cooldown period active',
        remainingTime: this.riskState.cooldownUntil - now,
        severity: 'high'
      });
    }
    
    return restrictions;
  }
  
  generateDeclineReason(assessment) {
    if (assessment.riskScore > 0.8) {
      return `High risk score: ${(assessment.riskScore * 100).toFixed(1)}%`;
    }
    
    if (assessment.maxTradeSize < 100) {
      return 'Trade size too small after risk adjustments';
    }
    
    if (assessment.restrictions.length > 0) {
      return assessment.restrictions[0].reason;
    }
    
    return 'Trade does not meet risk criteria';
  }
  
  cacheRiskAssessment(opportunityId, assessment) {
    this.riskAssessmentCache.set(opportunityId, {
      assessment,
      timestamp: Date.now()
    });
    
    // Clean old cache entries
    const oneHourAgo = Date.now() - 3600000;
    for (const [id, entry] of this.riskAssessmentCache) {
      if (entry.timestamp < oneHourAgo) {
        this.riskAssessmentCache.delete(id);
      }
    }
  }
  
  // Helper methods for legacy compatibility
  
  getTokenVolatility(token) {
    return this.marketData.volatility.get(token) || 0.02;
  }
  
  getTokenLiquidity(token) {
    return this.marketData.liquidity.get(token) || 1000000;
  }
  
  getTokenCorrelation(tokenA, tokenB) {
    const key = `${tokenA}_${tokenB}`;
    return this.riskMetrics.correlation.get(key) || 0.3;
  }
  
  getTokenExposure(token) {
    return this.portfolio.positions.get(token)?.value || 0;
  }
  
  getExchangeExposure(exchange) {
    return 0; // Placeholder
  }
  
  getRecentTradesCount(timeWindow) {
    const cutoff = Date.now() - timeWindow;
    return this.tradeHistory.filter(trade => trade.timestamp > cutoff).length;
  }
  
  getAverageVolatility(tokens) {
    const volatilities = tokens.map(token => this.getTokenVolatility(token));
    return volatilities.reduce((sum, vol) => sum + vol, 0) / volatilities.length;
  }
  
  calculateExpectedSlippage(opportunity) {
    const liquidityRatio = opportunity.tradeAmount / this.getTokenLiquidity(opportunity.tokenA);
    return liquidityRatio * 0.5;
  }
  
  updateTradeHistory(trade) {
    this.tradeHistory.push({ ...trade, timestamp: Date.now() });
    if (this.tradeHistory.length > 1000) {
      this.tradeHistory = this.tradeHistory.slice(-1000);
    }
  }
  
  updatePortfolio(trade) {
    if (trade.success) {
      this.portfolio.cash += trade.actualProfit || trade.pnl;
      this.portfolio.totalValue += trade.actualProfit || trade.pnl;
      
      if (this.portfolio.totalValue > this.portfolio.maxValue) {
        this.portfolio.maxValue = this.portfolio.totalValue;
      }
    } else {
      const loss = trade.totalCosts || Math.abs(trade.pnl || 0);
      this.portfolio.cash -= loss;
      this.portfolio.totalValue -= loss;
    }
    
    this.riskState.currentDrawdown = (this.portfolio.maxValue - this.portfolio.totalValue) / this.portfolio.maxValue;
  }
  
  updateRiskState(trade) {
    this.riskState.lastTradeTime = Date.now();
    
    if (this.isNewDay()) {
      this.riskState.dailyPnL = 0;
    }
    
    if (trade.success) {
      this.riskState.dailyPnL += trade.actualProfit || trade.pnl;
      this.riskState.consecutiveLosses = 0;
    } else {
      this.riskState.dailyPnL -= Math.abs(trade.pnl || 0);
      this.riskState.consecutiveLosses++;
    }
  }
  
  isNewDay() {
    const lastTradeDate = new Date(this.riskState.lastTradeTime).toDateString();
    const today = new Date().toDateString();
    return lastTradeDate !== today;
  }
  
  scheduleRiskUpdate() {
    if (Date.now() - this.lastRiskUpdate > 300000) {
      setTimeout(() => this.updateRiskMetrics(), 1000);
    }
  }
  
  checkEmergencyConditions() {
    let shouldStop = false;
    const reasons = [];
    
    if (this.riskState.currentDrawdown >= this.options.emergencyStopLoss) {
      shouldStop = true;
      reasons.push(`Emergency drawdown exceeded: ${(this.riskState.currentDrawdown * 100).toFixed(1)}%`);
    }
    
    if (Math.abs(this.riskState.dailyPnL) >= this.options.maxDailyLoss) {
      shouldStop = true;
      reasons.push(`Daily loss limit exceeded: $${Math.abs(this.riskState.dailyPnL).toFixed(2)}`);
    }
    
    if (this.riskState.consecutiveLosses >= this.options.maxConsecutiveLosses) {
      shouldStop = true;
      reasons.push(`Maximum consecutive losses reached: ${this.riskState.consecutiveLosses}`);
      this.riskState.cooldownUntil = Date.now() + this.options.cooldownPeriod;
    }
    
    if (shouldStop && !this.riskState.emergencyStop) {
      this.triggerEmergencyStop(reasons);
    }
  }
  
  triggerEmergencyStop(reasons) {
    this.riskState.emergencyStop = true;
    
    console.log('🚨 EMERGENCY STOP TRIGGERED');
    reasons.forEach(reason => console.log(`   - ${reason}`));
    
    this.emit('emergencyStop', {
      reasons,
      riskState: this.riskState,
      portfolioValue: this.portfolio.totalValue,
      timestamp: Date.now()
    });
  }
  
  async loadHistoricalData() {
    // Generate sample return history for initialization
    for (let i = 0; i < 30; i++) {
      this.returnHistory.push((Math.random() - 0.5) * 0.04);
    }
  }
  
  async updateRiskMetrics() {
    try {
      // Basic risk metrics calculation
      this.riskMetrics.riskScore = this.calculateRiskScore();
      this.lastRiskUpdate = Date.now();
      this.emit('riskMetricsUpdated', this.riskMetrics);
    } catch (error) {
      console.error('Failed to update risk metrics:', error.message);
    }
  }
  
  calculateRiskScore() {
    let score = 0;
    score += Math.min(this.riskState.currentDrawdown * 2, 0.4);
    score += Math.min(this.riskState.consecutiveLosses / this.options.maxConsecutiveLosses, 1) * 0.2;
    if (this.riskState.dailyPnL < 0) {
      score += Math.min(Math.abs(this.riskState.dailyPnL) / this.options.maxDailyLoss, 1) * 0.1;
    }
    return Math.min(score, 1.0);
  }
  
  setupRiskMonitoring() {
    setInterval(async () => {
      await this.updateRiskMetrics();
    }, 300000);
  }
  
  // Enhanced methods for comprehensive risk management
  
  /**
   * Get comprehensive system status
   */
  getSystemStatus() {
    const componentHealth = {};
    
    for (const [name, status] of this.componentStatus) {
      componentHealth[name] = {
        healthy: status.healthy,
        initialized: status.initialized,
        lastUpdate: status.lastUpdate,
        errorCount: status.errors.length
      };
    }
    
    return {
      isInitialized: this.isInitialized,
      advancedRiskManagement: this.options.enableAdvancedRiskManagement,
      emergencyStop: this.isEmergencyActive(),
      tradingAllowed: this.isTradingAllowed(),
      componentHealth,
      systemRiskScore: this.calculateSystemRiskScore(),
      recommendations: this.getSystemRecommendations()
    };
  }
  
  calculateSystemRiskScore() {
    let systemRisk = this.riskMetrics.riskScore || 0;
    
    // Adjust based on component health
    const unhealthyComponents = Array.from(this.componentStatus.values())
      .filter(status => status.initialized && !status.healthy).length;
    
    if (unhealthyComponents > 0) {
      systemRisk += unhealthyComponents * 0.1; // 10% risk increase per unhealthy component
    }
    
    return Math.min(systemRisk, 1.0);
  }
  
  getSystemRecommendations() {
    const recommendations = [];
    
    // Check component health
    for (const [name, status] of this.componentStatus) {
      if (status.initialized && !status.healthy) {
        recommendations.push({
          priority: 'high',
          category: 'system',
          title: `${name} Component Unhealthy`,
          description: `Risk management component is experiencing issues`,
          action: 'Check component logs and restart if necessary'
        });
      }
    }
    
    // Check system risk
    const systemRisk = this.calculateSystemRiskScore();
    if (systemRisk > 0.7) {
      recommendations.push({
        priority: 'critical',
        category: 'risk',
        title: 'High System Risk',
        description: `System risk score: ${(systemRisk * 100).toFixed(1)}%`,
        action: 'Consider emergency shutdown or reduced operations'
      });
    }
    
    return recommendations;
  }
  
  /**
   * Get comprehensive risk report combining all components
   */
  getComprehensiveRiskReport() {
    const report = {
      timestamp: Date.now(),
      systemStatus: this.getSystemStatus(),
      
      // Legacy risk data
      legacy: {
        riskState: this.riskState,
        portfolio: this.portfolio,
        riskMetrics: this.riskMetrics,
        restrictions: this.getTradingRestrictions()
      },
      
      // Component reports
      components: {}
    };
    
    // Get reports from healthy components
    if (this.options.enableAdvancedRiskManagement) {
      if (this.isComponentHealthy('slippageManager')) {
        report.components.slippage = this.riskComponents.slippageManager.getSlippageReport();
      }
      
      if (this.isComponentHealthy('tradeSizeManager')) {
        report.components.tradeSize = this.riskComponents.tradeSizeManager.getSizingReport();
      }
      
      if (this.isComponentHealthy('circuitBreakerManager')) {
        report.components.circuitBreaker = this.riskComponents.circuitBreakerManager.getCircuitBreakerStatus();
      }
      
      if (this.isComponentHealthy('emergencyStopManager')) {
        report.components.emergencyStop = this.riskComponents.emergencyStopManager.getEmergencyReport();
      }
      
      if (this.isComponentHealthy('riskAssessmentEngine')) {
        report.components.riskAssessment = this.riskComponents.riskAssessmentEngine.getRiskAssessmentReport();
      }
      
      if (this.isComponentHealthy('marketConditionMonitor')) {
        report.components.marketCondition = this.riskComponents.marketConditionMonitor.getMarketAnalysis();
      }
      
      if (this.isComponentHealthy('performanceRiskManager')) {
        report.components.performanceRisk = this.riskComponents.performanceRiskManager.getPerformanceRiskReport();
      }
    }
    
    return report;
  }
  
  getTradingRestrictions() {
    if (this.options.enableAdvancedRiskManagement) {
      return this.getCircuitBreakerRestrictions();
    }
    return this.getLegacyTradingRestrictions();
  }
  
  /**
   * Manual emergency shutdown of all systems
   */
  async emergencyShutdown(reason = 'Manual shutdown') {
    console.log('🚨 MANUAL EMERGENCY SHUTDOWN INITIATED');
    console.log(`   Reason: ${reason}`);
    
    if (this.isComponentHealthy('emergencyStopManager')) {
      await this.riskComponents.emergencyStopManager.triggerEmergencyStop(
        reason, 'emergency', 'manual'
      );
    } else {
      this.triggerEmergencyStop([reason]);
    }
    
    this.emit('manualEmergencyShutdown', {
      reason,
      timestamp: Date.now()
    });
  }
  
  /**
   * Comprehensive shutdown of all risk management systems
   */
  async shutdown() {
    console.log('🛑 Shutting down Enhanced Risk Manager...');
    
    if (this.options.enableAdvancedRiskManagement) {
      // Shutdown all components
      const shutdownPromises = [];
      
      for (const [componentName, component] of Object.entries(this.riskComponents)) {
        if (this.componentStatus.get(componentName)?.initialized) {
          console.log(`   Shutting down ${componentName}...`);
          shutdownPromises.push(
            component.shutdown().catch(error => 
              console.warn(`Failed to shutdown ${componentName}:`, error.message)
            )
          );
        }
      }
      
      // Wait for all components to shutdown
      await Promise.allSettled(shutdownPromises);
    }
    
    this.emit('shutdown');
    console.log('✅ Enhanced Risk Manager shutdown complete');
  }
}

export default RiskManager;
module.exports = RiskManager;