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
      
      // Check if trade should be approved
      assessment.approved = this.shouldApproveTrade(assessment);
      
      if (!assessment.approved) {
        assessment.reason = this.getDeclineReason(assessment);
      }
      
      // Cache assessment
      this.cacheRiskAssessment(opportunity.id, assessment);
      
      this.emit('riskAssessment', assessment);
      
      return assessment;
      
    } catch (error) {
      console.error('Risk assessment failed:', error.message);
      
      return {
        approved: false,
        reason: 'Risk assessment failed',
        riskScore: 1.0,
        error: error.message
      };
    }
  }
  
  /**
   * Check if trading is currently allowed
   */
  isTradingAllowed() {
    const now = Date.now();
    
    // Check emergency stop
    if (this.riskState.emergencyStop) {
      return false;
    }
    
    // Check cooldown period
    if (now < this.riskState.cooldownUntil) {
      return false;
    }
    
    // Check daily loss limit
    if (Math.abs(this.riskState.dailyPnL) >= this.options.maxDailyLoss) {
      return false;
    }
    
    // Check maximum drawdown
    if (this.riskState.currentDrawdown >= this.options.maxDrawdown) {
      return false;
    }
    
    // Check consecutive losses
    if (this.riskState.consecutiveLosses >= this.options.maxConsecutiveLosses) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Get current trading restrictions
   */
  getTradingRestrictions() {
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
    
    if (Math.abs(this.riskState.dailyPnL) >= this.options.maxDailyLoss * 0.8) {
      restrictions.push({
        type: 'daily_loss_warning',
        reason: 'Approaching daily loss limit',
        current: Math.abs(this.riskState.dailyPnL),
        limit: this.options.maxDailyLoss,
        severity: 'medium'
      });
    }
    
    if (this.riskState.currentDrawdown >= this.options.maxDrawdown * 0.8) {
      restrictions.push({
        type: 'drawdown_warning',
        reason: 'Approaching maximum drawdown',
        current: this.riskState.currentDrawdown,
        limit: this.options.maxDrawdown,
        severity: 'medium'
      });
    }
    
    return restrictions;
  }
  
  /**
   * Assess portfolio impact of a trade
   */
  assessPortfolioImpact(opportunity) {
    const tradeValue = opportunity.tradeAmount;
    const portfolioPercentage = tradeValue / this.portfolio.totalValue;
    
    let riskScore = 0;
    const warnings = [];
    
    // Position size risk
    if (portfolioPercentage > this.options.maxPositionSize) {
      riskScore += 0.3;
      warnings.push('Trade size exceeds maximum position size');
    }
    
    // Concentration risk by token
    const tokenExposure = this.getTokenExposure(opportunity.tokenA) + 
                         this.getTokenExposure(opportunity.tokenB);
    
    if ((tokenExposure + tradeValue) / this.portfolio.totalValue > 0.3) {
      riskScore += 0.2;
      warnings.push('High concentration in token pair');
    }
    
    // Liquidity impact
    const availableCash = this.portfolio.cash;
    if (tradeValue > availableCash * 0.5) {
      riskScore += 0.1;
      warnings.push('Large portion of available cash');
    }
    
    return {
      riskScore: Math.min(riskScore, 1.0),
      portfolioPercentage,
      warnings,
      metrics: {
        tradeValue,
        portfolioValue: this.portfolio.totalValue,
        availableCash,
        tokenExposure
      }
    };
  }
  
  /**
   * Assess market risk for a trade
   */
  async assessMarketRisk(opportunity) {
    let riskScore = 0;
    const warnings = [];
    
    // Volatility risk
    const tokenAVolatility = this.getTokenVolatility(opportunity.tokenA);
    const tokenBVolatility = this.getTokenVolatility(opportunity.tokenB);
    const avgVolatility = (tokenAVolatility + tokenBVolatility) / 2;
    
    if (avgVolatility > this.options.volatilityThreshold) {
      riskScore += 0.3;
      warnings.push(`High volatility detected: ${(avgVolatility * 100).toFixed(1)}%`);
    }
    
    // Correlation risk
    const correlation = this.getTokenCorrelation(opportunity.tokenA, opportunity.tokenB);
    if (Math.abs(correlation) > this.options.correlationThreshold) {
      riskScore += 0.2;
      warnings.push('High correlation between tokens');
    }
    
    // Gas price risk
    const currentGasPrice = this.marketData.gasPrice.current;
    const avgGasPrice = this.marketData.gasPrice.average;
    
    if (currentGasPrice > avgGasPrice * 2) {
      riskScore += 0.2;
      warnings.push('High gas prices may impact profitability');
    }
    
    // Network congestion risk
    if (this.marketData.networkCongestion === 'high') {
      riskScore += 0.1;
      warnings.push('High network congestion');
    }
    
    return {
      riskScore: Math.min(riskScore, 1.0),
      warnings,
      metrics: {
        tokenAVolatility,
        tokenBVolatility,
        avgVolatility,
        correlation,
        gasPrice: currentGasPrice,
        networkCongestion: this.marketData.networkCongestion
      }
    };
  }
  
  /**
   * Assess liquidity risk for a trade
   */
  assessLiquidityRisk(opportunity) {
    let riskScore = 0;
    const warnings = [];
    
    // Pool liquidity assessment
    const tokenALiquidity = this.getTokenLiquidity(opportunity.tokenA);
    const tokenBLiquidity = this.getTokenLiquidity(opportunity.tokenB);
    const minLiquidity = Math.min(tokenALiquidity, tokenBLiquidity);
    
    if (minLiquidity < this.options.liquidityThreshold) {
      riskScore += 0.4;
      warnings.push('Low liquidity detected');
    }
    
    // Trade size vs liquidity
    const liquidityRatio = opportunity.tradeAmount / minLiquidity;
    if (liquidityRatio > 0.01) { // 1% of pool liquidity
      riskScore += 0.3;
      warnings.push('Large trade relative to pool liquidity');
    }
    
    // Slippage risk
    const expectedSlippage = this.calculateExpectedSlippage(opportunity);
    if (expectedSlippage > 0.005) { // 0.5%
      riskScore += 0.2;
      warnings.push(`High expected slippage: ${(expectedSlippage * 100).toFixed(2)}%`);
    }
    
    return {
      riskScore: Math.min(riskScore, 1.0),
      warnings,
      metrics: {
        tokenALiquidity,
        tokenBLiquidity,
        minLiquidity,
        liquidityRatio,
        expectedSlippage
      }
    };
  }
  
  /**
   * Assess execution risk for a trade
   */
  assessExecutionRisk(opportunity) {
    let riskScore = 0;
    const warnings = [];
    
    // MEV risk assessment
    const mevRisk = this.assessMEVRisk(opportunity);
    riskScore += mevRisk.riskScore;
    warnings.push(...mevRisk.warnings);
    
    // Execution time risk
    const expectedExecutionTime = opportunity.estimatedExecutionTime || 30000; // 30 seconds default
    if (expectedExecutionTime > 60000) { // 1 minute
      riskScore += 0.2;
      warnings.push('Long expected execution time');
    }
    
    // Smart contract risk
    const contractRisk = this.assessContractRisk(opportunity);
    riskScore += contractRisk.riskScore;
    warnings.push(...contractRisk.warnings);
    
    // Spread risk (price impact during execution)
    const spreadRisk = this.assessSpreadRisk(opportunity);
    riskScore += spreadRisk.riskScore;
    warnings.push(...spreadRisk.warnings);
    
    return {
      riskScore: Math.min(riskScore, 1.0),
      warnings,
      metrics: {
        mevRisk: mevRisk.riskScore,
        executionTime: expectedExecutionTime,
        contractRisk: contractRisk.riskScore,
        spreadRisk: spreadRisk.riskScore
      }
    };
  }
  
  /**
   * Assess MEV risk
   */
  assessMEVRisk(opportunity) {
    let riskScore = 0;
    const warnings = [];
    
    // High-value trades are more likely to be MEV targets
    if (opportunity.expectedProfit > 500) {
      riskScore += 0.2;
      warnings.push('High-value trade may attract MEV competition');
    }
    
    // Popular token pairs have higher MEV risk
    const popularPairs = ['WETH/USDC', 'WETH/USDT', 'WETH/DAI'];
    const pairName = `${opportunity.tokenA}/${opportunity.tokenB}`;
    
    if (popularPairs.includes(pairName)) {
      riskScore += 0.1;
      warnings.push('Popular trading pair with higher MEV risk');
    }
    
    // Network congestion increases MEV risk
    if (this.marketData.networkCongestion === 'high') {
      riskScore += 0.1;
      warnings.push('High network congestion increases MEV risk');
    }
    
    return { riskScore, warnings };
  }
  
  /**
   * Assess smart contract risk
   */
  assessContractRisk(opportunity) {
    let riskScore = 0;
    const warnings = [];
    
    // Contract complexity risk (simplified assessment)
    if (opportunity.exchangeA === 'Uniswap V3' || opportunity.exchangeB === 'Uniswap V3') {
      riskScore += 0.05; // V3 is more complex
      warnings.push('Complex V3 contracts increase execution risk');
    }
    
    // Flashloan complexity
    if (opportunity.requiresFlashloan) {
      riskScore += 0.1;
      warnings.push('Flashloan execution adds complexity');
    }
    
    return { riskScore, warnings };
  }
  
  /**
   * Assess spread risk (price movement during execution)
   */
  assessSpreadRisk(opportunity) {
    let riskScore = 0;
    const warnings = [];
    
    // Calculate spread decay risk based on execution time
    const timeRisk = (opportunity.estimatedExecutionTime || 30000) / 1000 / 60; // minutes
    const spreadDecay = opportunity.spread * 0.1 * timeRisk; // 10% decay per minute (simplified)
    
    if (spreadDecay > opportunity.spread * 0.5) {
      riskScore += 0.3;
      warnings.push('High risk of spread decay during execution');
    }
    
    // Market volatility impact on spread
    const avgVolatility = this.getAverageVolatility([opportunity.tokenA, opportunity.tokenB]);
    const volatilityImpact = avgVolatility * timeRisk;
    
    if (volatilityImpact > 0.01) { // 1% volatility impact
      riskScore += 0.2;
      warnings.push('Market volatility may impact spread');
    }
    
    return { riskScore, warnings };
  }
  
  /**
   * Assess concentration risk
   */
  assessConcentrationRisk(opportunity) {
    let riskScore = 0;
    const warnings = [];
    
    // Exchange concentration
    const exchangeExposure = this.getExchangeExposure(opportunity.exchangeA) + 
                            this.getExchangeExposure(opportunity.exchangeB);
    
    if (exchangeExposure / this.portfolio.totalValue > 0.5) {
      riskScore += 0.2;
      warnings.push('High concentration in specific exchanges');
    }
    
    // Token concentration
    const tokenConcentration = (this.getTokenExposure(opportunity.tokenA) + 
                               this.getTokenExposure(opportunity.tokenB) + 
                               opportunity.tradeAmount) / this.portfolio.totalValue;
    
    if (tokenConcentration > 0.4) {
      riskScore += 0.3;
      warnings.push('High concentration in token pair');
    }
    
    // Time concentration (too many trades in short period)
    const recentTrades = this.getRecentTradesCount(300000); // Last 5 minutes
    if (recentTrades > 5) {
      riskScore += 0.1;
      warnings.push('High trade frequency detected');
    }
    
    return { riskScore, warnings };
  }
  
  /**
   * Calculate overall risk score from component scores
   */
  calculateOverallRiskScore(componentScores) {
    // Weighted average with emphasis on highest risks
    const weights = [0.25, 0.25, 0.2, 0.2, 0.1]; // Portfolio, Market, Liquidity, Execution, Concentration
    const weightedScore = componentScores.reduce((sum, score, index) => sum + score * weights[index], 0);
    
    // Apply risk amplification for multiple high-risk components
    const highRiskComponents = componentScores.filter(score => score > 0.7).length;
    const amplification = highRiskComponents > 1 ? 1 + (highRiskComponents - 1) * 0.1 : 1;
    
    return Math.min(weightedScore * amplification, 1.0);
  }
  
  /**
   * Calculate maximum trade size based on risk assessment
   */
  calculateMaxTradeSize(opportunity, assessment) {
    let maxSize = opportunity.tradeAmount;
    
    // Apply position size limit
    maxSize = Math.min(maxSize, this.portfolio.totalValue * this.options.maxPositionSize);
    
    // Apply cash availability limit
    maxSize = Math.min(maxSize, this.portfolio.cash * 0.8);
    
    // Apply risk-based reduction
    const riskReduction = 1 - assessment.riskScore * 0.5; // Up to 50% reduction
    maxSize *= riskReduction;
    
    // Apply volatility-based reduction
    const avgVolatility = this.getAverageVolatility([opportunity.tokenA, opportunity.tokenB]);
    const volatilityReduction = Math.max(0.5, 1 - avgVolatility * 2);
    maxSize *= volatilityReduction;
    
    // Minimum trade size threshold
    maxSize = Math.max(maxSize, 100); // Minimum $100
    
    return Math.min(maxSize, this.options.maxTradeAmount);
  }
  
  /**
   * Determine if trade should be approved
   */
  shouldApproveTrade(assessment) {
    // High risk trades are rejected
    if (assessment.riskScore > 0.8) {
      return false;
    }
    
    // Check if max trade size is too small to be profitable
    if (assessment.maxTradeSize < 100) {
      return false;
    }
    
    // Check for critical warnings
    const criticalWarnings = assessment.metrics.portfolioImpact.warnings
      .concat(assessment.metrics.marketRisk.warnings)
      .concat(assessment.metrics.liquidityRisk.warnings)
      .filter(warning => warning.includes('Critical') || warning.includes('Emergency'));
    
    if (criticalWarnings.length > 0) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Get decline reason for rejected trades
   */
  getDeclineReason(assessment) {
    if (assessment.riskScore > 0.8) {
      return `High risk score: ${(assessment.riskScore * 100).toFixed(1)}%`;
    }
    
    if (assessment.maxTradeSize < 100) {
      return 'Trade size too small after risk adjustments';
    }
    
    return 'Trade does not meet risk criteria';
  }
  
  /**
   * Process trade result and update risk state
   */
  processTradeResult(trade) {
    // Update portfolio state
    this.updatePortfolio(trade);
    
    // Update risk state
    this.updateRiskState(trade);
    
    // Update historical data
    this.updateTradeHistory(trade);
    
    // Trigger risk metric recalculation
    this.scheduleRiskUpdate();
    
    // Check for emergency conditions
    this.checkEmergencyConditions();
    
    this.emit('tradeProcessed', {
      trade,
      riskState: this.riskState,
      portfolioValue: this.portfolio.totalValue
    });
  }
  
  /**
   * Update portfolio state after trade
   */
  updatePortfolio(trade) {
    if (trade.success) {
      this.portfolio.cash += trade.actualProfit;
      this.portfolio.totalValue += trade.actualProfit;
      
      // Update maximum portfolio value
      if (this.portfolio.totalValue > this.portfolio.maxValue) {
        this.portfolio.maxValue = this.portfolio.totalValue;
      }
    } else {
      this.portfolio.cash -= trade.totalCosts;
      this.portfolio.totalValue -= trade.totalCosts;
    }
    
    // Calculate current drawdown
    this.riskState.currentDrawdown = (this.portfolio.maxValue - this.portfolio.totalValue) / this.portfolio.maxValue;
  }
  
  /**
   * Update risk state after trade
   */
  updateRiskState(trade) {
    this.riskState.lastTradeTime = Date.now();
    
    // Update daily P&L
    if (this.isNewDay()) {
      this.riskState.dailyPnL = 0; // Reset for new day
    }
    
    if (trade.success) {
      this.riskState.dailyPnL += trade.actualProfit;
      this.riskState.consecutiveLosses = 0;
    } else {
      this.riskState.dailyPnL -= trade.totalCosts;
      this.riskState.consecutiveLosses++;
    }
  }
  
  /**
   * Check for emergency conditions
   */
  checkEmergencyConditions() {
    let shouldStop = false;
    const reasons = [];
    
    // Emergency drawdown stop
    if (this.riskState.currentDrawdown >= this.options.emergencyStopLoss) {
      shouldStop = true;
      reasons.push(`Emergency drawdown exceeded: ${(this.riskState.currentDrawdown * 100).toFixed(1)}%`);
    }
    
    // Daily loss limit
    if (Math.abs(this.riskState.dailyPnL) >= this.options.maxDailyLoss) {
      shouldStop = true;
      reasons.push(`Daily loss limit exceeded: $${Math.abs(this.riskState.dailyPnL).toFixed(2)}`);
    }
    
    // Consecutive losses
    if (this.riskState.consecutiveLosses >= this.options.maxConsecutiveLosses) {
      shouldStop = true;
      reasons.push(`Maximum consecutive losses reached: ${this.riskState.consecutiveLosses}`);
      
      // Set cooldown period
      this.riskState.cooldownUntil = Date.now() + this.options.cooldownPeriod;
    }
    
    if (shouldStop && !this.riskState.emergencyStop) {
      this.triggerEmergencyStop(reasons);
    }
  }
  
  /**
   * Trigger emergency stop
   */
  triggerEmergencyStop(reasons) {
    this.riskState.emergencyStop = true;
    
    console.log('🚨 EMERGENCY STOP TRIGGERED');
    for (const reason of reasons) {
      console.log(`   - ${reason}`);
    }
    
    this.emit('emergencyStop', {
      reasons,
      riskState: this.riskState,
      portfolioValue: this.portfolio.totalValue,
      timestamp: Date.now()
    });
  }
  
  /**
   * Reset emergency stop (manual intervention)
   */
  resetEmergencyStop() {
    this.riskState.emergencyStop = false;
    this.riskState.consecutiveLosses = 0;
    this.riskState.cooldownUntil = 0;
    
    console.log('✅ Emergency stop reset');
    
    this.emit('emergencyStopReset', {
      timestamp: Date.now()
    });
  }
  
  /**
   * Perform Monte Carlo risk simulation
   */
  async performMonteCarloSimulation(strategy, timeHorizon = 30) {
    console.log(`🎲 Running Monte Carlo simulation (${this.options.simulationRuns} runs)...`);
    
    const results = [];
    
    for (let i = 0; i < this.options.simulationRuns; i++) {
      const simulation = await this.runSingleSimulation(strategy, timeHorizon);
      results.push(simulation);
    }
    
    // Analyze results
    const analysis = this.analyzeSimulationResults(results);
    
    this.emit('monteCarloComplete', analysis);
    
    return analysis;
  }
  
  /**
   * Run single Monte Carlo simulation
   */
  async runSingleSimulation(strategy, timeHorizon) {
    // This would run a simulated trading session
    // For now, we'll return mock results
    
    const dailyReturns = [];
    let portfolioValue = this.portfolio.initialValue;
    
    for (let day = 0; day < timeHorizon; day++) {
      // Simulate daily return based on strategy and market conditions
      const dailyReturn = (Math.random() - 0.45) * 0.02; // Slightly positive bias
      dailyReturns.push(dailyReturn);
      portfolioValue *= (1 + dailyReturn);
    }
    
    return {
      finalValue: portfolioValue,
      totalReturn: (portfolioValue - this.portfolio.initialValue) / this.portfolio.initialValue,
      dailyReturns,
      maxDrawdown: this.calculateMaxDrawdown(dailyReturns),
      volatility: this.calculateVolatility(dailyReturns)
    };
  }
  
  /**
   * Analyze Monte Carlo simulation results
   */
  analyzeSimulationResults(results) {
    const returns = results.map(r => r.totalReturn);
    const finalValues = results.map(r => r.finalValue);
    
    // Sort results for percentile calculations
    const sortedReturns = returns.sort((a, b) => a - b);
    const sortedValues = finalValues.sort((a, b) => a - b);
    
    // Calculate percentiles
    const getPercentile = (arr, percentile) => {
      const index = Math.floor(arr.length * percentile / 100);
      return arr[index];
    };
    
    const analysis = {
      summary: {
        totalRuns: results.length,
        averageReturn: returns.reduce((sum, r) => sum + r, 0) / returns.length,
        medianReturn: getPercentile(sortedReturns, 50),
        volatility: this.calculateVolatility(returns),
        sharpeRatio: this.calculateSharpeRatio(returns)
      },
      risk: {
        valueAtRisk95: getPercentile(sortedReturns, 5),
        valueAtRisk99: getPercentile(sortedReturns, 1),
        maxLoss: sortedReturns[0],
        maxGain: sortedReturns[sortedReturns.length - 1],
        probabilityOfLoss: returns.filter(r => r < 0).length / returns.length
      },
      projections: {
        pessimistic: getPercentile(sortedValues, 10),
        conservative: getPercentile(sortedValues, 25),
        expected: getPercentile(sortedValues, 50),
        optimistic: getPercentile(sortedValues, 75),
        bestCase: getPercentile(sortedValues, 90)
      }
    };
    
    return analysis;
  }
  
  /**
   * Update risk metrics periodically
   */
  async updateRiskMetrics() {
    try {
      // Calculate VaR at different time horizons
      this.riskMetrics.valueAtRisk = {
        '1d': this.calculateVaR(this.returnHistory, 1),
        '7d': this.calculateVaR(this.returnHistory, 7),
        '30d': this.calculateVaR(this.returnHistory, 30)
      };
      
      // Calculate volatility
      this.riskMetrics.volatility = {
        '1d': this.calculateVolatility(this.returnHistory.slice(-1)),
        '7d': this.calculateVolatility(this.returnHistory.slice(-7)),
        '30d': this.calculateVolatility(this.returnHistory.slice(-30))
      };
      
      // Calculate Sharpe ratio
      this.riskMetrics.sharpeRatio = this.calculateSharpeRatio(this.returnHistory);
      
      // Calculate maximum drawdown
      this.riskMetrics.maxDrawdown = this.calculateMaxDrawdown(this.returnHistory);
      
      // Calculate overall risk score
      this.riskMetrics.riskScore = this.calculateRiskScore();
      
      this.lastRiskUpdate = Date.now();
      
      this.emit('riskMetricsUpdated', this.riskMetrics);
      
    } catch (error) {
      console.error('Failed to update risk metrics:', error.message);
    }
  }
  
  /**
   * Calculate Value at Risk (VaR)
   */
  calculateVaR(returns, days) {
    if (returns.length < days) return 0;
    
    const relevantReturns = returns.slice(-days);
    const sortedReturns = relevantReturns.sort((a, b) => a - b);
    const varIndex = Math.floor(sortedReturns.length * 0.05); // 95% confidence
    
    return Math.abs(sortedReturns[varIndex] || 0);
  }
  
  /**
   * Calculate volatility (standard deviation of returns)
   */
  calculateVolatility(returns) {
    if (returns.length < 2) return 0;
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }
  
  /**
   * Calculate Sharpe ratio
   */
  calculateSharpeRatio(returns) {
    if (returns.length < 2) return 0;
    
    const riskFreeRate = 0.02 / 365; // 2% annual risk-free rate, daily
    const excessReturns = returns.map(r => r - riskFreeRate);
    const avgExcessReturn = excessReturns.reduce((sum, r) => sum + r, 0) / excessReturns.length;
    const volatility = this.calculateVolatility(excessReturns);
    
    return volatility > 0 ? avgExcessReturn / volatility : 0;
  }
  
  /**
   * Calculate maximum drawdown
   */
  calculateMaxDrawdown(returns) {
    if (returns.length === 0) return 0;
    
    let maxDrawdown = 0;
    let peak = 1;
    let currentValue = 1;
    
    for (const returnValue of returns) {
      currentValue *= (1 + returnValue);
      
      if (currentValue > peak) {
        peak = currentValue;
      }
      
      const drawdown = (peak - currentValue) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    return maxDrawdown;
  }
  
  /**
   * Calculate overall risk score (0-1, higher is riskier)
   */
  calculateRiskScore() {
    let score = 0;
    
    // Drawdown component (0-0.4)
    score += Math.min(this.riskState.currentDrawdown * 2, 0.4);
    
    // Volatility component (0-0.3)
    score += Math.min(this.riskMetrics.volatility['7d'] * 10, 0.3);
    
    // Consecutive losses component (0-0.2)
    score += Math.min(this.riskState.consecutiveLosses / this.options.maxConsecutiveLosses, 1) * 0.2;
    
    // Daily P&L component (0-0.1)
    if (this.riskState.dailyPnL < 0) {
      score += Math.min(Math.abs(this.riskState.dailyPnL) / this.options.maxDailyLoss, 1) * 0.1;
    }
    
    return Math.min(score, 1.0);
  }
  
  // Helper methods for risk calculations
  
  getTokenVolatility(token) {
    return this.marketData.volatility.get(token) || 0.02; // Default 2% volatility
  }
  
  getTokenLiquidity(token) {
    return this.marketData.liquidity.get(token) || 1000000; // Default $1M liquidity
  }
  
  getTokenCorrelation(tokenA, tokenB) {
    const key = `${tokenA}_${tokenB}`;
    return this.riskMetrics.correlation.get(key) || 0.3; // Default 30% correlation
  }
  
  getTokenExposure(token) {
    return this.portfolio.positions.get(token)?.value || 0;
  }
  
  getExchangeExposure(exchange) {
    // This would calculate total exposure to a specific exchange
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
    // Simplified slippage calculation
    const liquidityRatio = opportunity.tradeAmount / this.getTokenLiquidity(opportunity.tokenA);
    return liquidityRatio * 0.5; // 0.5% slippage per 1% of liquidity
  }
  
  isNewDay() {
    const lastTradeDate = new Date(this.riskState.lastTradeTime).toDateString();
    const today = new Date().toDateString();
    return lastTradeDate !== today;
  }
  
  scheduleRiskUpdate() {
    // Update risk metrics every 5 minutes at most
    if (Date.now() - this.lastRiskUpdate > 300000) {
      setTimeout(() => this.updateRiskMetrics(), 1000);
    }
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