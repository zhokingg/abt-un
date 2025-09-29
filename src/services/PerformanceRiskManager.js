import { EventEmitter } from 'events';

/**
 * PerformanceRiskManager - Performance-based risk adjustment
 * Provides adaptive risk parameters, drawdown management, and ML integration points
 */
class PerformanceRiskManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      // Performance tracking windows
      shortTermWindow: options.shortTermWindow || 24, // Hours
      mediumTermWindow: options.mediumTermWindow || 168, // 1 week
      longTermWindow: options.longTermWindow || 720, // 30 days
      
      // Adaptive adjustment parameters
      performanceAdjustmentFactor: options.performanceAdjustmentFactor || 0.2,
      winStreakBonus: options.winStreakBonus || 0.1,
      lossStreakPenalty: options.lossStreakPenalty || 0.2,
      
      // Drawdown management
      maxDrawdownThreshold: options.maxDrawdownThreshold || 0.15, // 15%
      drawdownRecoveryFactor: options.drawdownRecoveryFactor || 0.5,
      emergencyDrawdownThreshold: options.emergencyDrawdownThreshold || 0.25, // 25%
      
      // Risk scaling parameters
      minRiskScale: options.minRiskScale || 0.2, // 20% minimum
      maxRiskScale: options.maxRiskScale || 2.0, // 200% maximum
      riskAdjustmentDecay: options.riskAdjustmentDecay || 0.95, // Daily decay
      
      // Performance thresholds
      excellentPerformanceThreshold: options.excellentPerformanceThreshold || 0.05, // 5% daily return
      poorPerformanceThreshold: options.poorPerformanceThreshold || -0.02, // -2% daily return
      
      // Machine learning parameters
      enableMLAdjustments: options.enableMLAdjustments !== false,
      mlModelUpdateInterval: options.mlModelUpdateInterval || 86400000, // 24 hours
      mlTrainingWindow: options.mlTrainingWindow || 2160, // 90 days in hours
      
      // Time-based adjustments
      weekendRiskReduction: options.weekendRiskReduction || 0.8, // 20% reduction
      holidayRiskReduction: options.holidayRiskReduction || 0.7, // 30% reduction
      lowVolumeRiskReduction: options.lowVolumeRiskReduction || 0.9, // 10% reduction
      
      ...options
    };
    
    // Performance tracking
    this.performanceMetrics = {
      // Short-term metrics (24 hours)
      shortTerm: {
        totalReturn: 0,
        winRate: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        volatility: 0,
        tradesCount: 0,
        averageReturn: 0
      },
      
      // Medium-term metrics (1 week)
      mediumTerm: {
        totalReturn: 0,
        winRate: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        volatility: 0,
        tradesCount: 0,
        averageReturn: 0
      },
      
      // Long-term metrics (30 days)
      longTerm: {
        totalReturn: 0,
        winRate: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        volatility: 0,
        tradesCount: 0,
        averageReturn: 0
      }
    };
    
    // Risk adjustment state
    this.riskAdjustments = {
      performanceBased: 1.0, // Multiplier based on recent performance
      drawdownBased: 1.0, // Multiplier based on current drawdown
      streakBased: 1.0, // Multiplier based on win/loss streaks
      timeBased: 1.0, // Multiplier based on time patterns
      mlBased: 1.0, // Multiplier from ML model
      overall: 1.0 // Combined multiplier
    };
    
    // Performance history
    this.performanceHistory = [];
    this.drawdownHistory = [];
    this.streakHistory = [];
    
    // Current state tracking
    this.currentState = {
      drawdown: 0,
      peakValue: 0,
      currentValue: 0,
      winStreak: 0,
      lossStreak: 0,
      lastTradeResult: null,
      consecutiveWins: 0,
      consecutiveLosses: 0
    };
    
    // ML model state
    this.mlModel = {
      isEnabled: this.options.enableMLAdjustments,
      lastTraining: null,
      accuracy: 0,
      features: [],
      predictions: [],
      trainingData: []
    };
    
    // Time-based patterns
    this.timePatterns = {
      hourlyPerformance: new Array(24).fill(0),
      dailyPerformance: new Array(7).fill(0),
      monthlyPerformance: new Array(12).fill(0),
      lastUpdated: Date.now()
    };
    
    // Risk parameter history
    this.riskParameterHistory = [];
    
    this.isInitialized = false;
  }
  
  /**
   * Initialize performance risk manager
   */
  async initialize() {
    if (this.isInitialized) return;
    
    console.log('📊 Initializing Performance Risk Manager...');
    
    try {
      // Load historical performance data
      await this.loadHistoricalPerformance();
      
      // Initialize ML model if enabled
      if (this.mlModel.isEnabled) {
        await this.initializeMLModel();
      }
      
      // Calculate initial metrics
      this.updatePerformanceMetrics();
      
      // Setup performance monitoring
      this.setupPerformanceMonitoring();
      
      // Initialize time-based patterns
      await this.initializeTimePatterns();
      
      this.isInitialized = true;
      console.log('✅ Performance Risk Manager initialized');
      
      this.emit('initialized', {
        mlEnabled: this.mlModel.isEnabled,
        performanceMetrics: this.performanceMetrics,
        currentAdjustments: this.riskAdjustments
      });
      
    } catch (error) {
      console.error('❌ Failed to initialize Performance Risk Manager:', error.message);
      throw error;
    }
  }
  
  /**
   * Process trade result and update performance metrics
   */
  processTradeResult(tradeResult) {
    const { success, pnl, tradeAmount, timestamp, metadata = {} } = tradeResult;
    
    // Update current state
    this.updateCurrentState(success, pnl, tradeAmount);
    
    // Add to performance history
    this.performanceHistory.push({
      timestamp: timestamp || Date.now(),
      success,
      pnl,
      tradeAmount,
      returnPercentage: pnl / tradeAmount,
      metadata
    });
    
    // Keep only relevant history
    this.cleanupHistory();
    
    // Update performance metrics
    this.updatePerformanceMetrics();
    
    // Update time-based patterns
    this.updateTimePatterns(tradeResult);
    
    // Recalculate risk adjustments
    this.recalculateRiskAdjustments();
    
    // Update ML model if enabled
    if (this.mlModel.isEnabled) {
      this.updateMLModel(tradeResult);
    }
    
    this.emit('tradeProcessed', {
      result: tradeResult,
      newAdjustments: this.riskAdjustments,
      performanceMetrics: this.performanceMetrics
    });
  }
  
  /**
   * Get current risk adjustment multiplier
   */
  getCurrentRiskAdjustment(baseRiskParams = {}) {
    const adjustment = this.riskAdjustments.overall;
    
    const adjustedParams = {
      ...baseRiskParams,
      multiplier: adjustment,
      components: {
        performance: this.riskAdjustments.performanceBased,
        drawdown: this.riskAdjustments.drawdownBased,
        streak: this.riskAdjustments.streakBased,
        time: this.riskAdjustments.timeBased,
        ml: this.riskAdjustments.mlBased
      },
      reasoning: this.generateAdjustmentReasoning(),
      confidence: this.calculateAdjustmentConfidence()
    };
    
    return adjustedParams;
  }
  
  /**
   * Update current portfolio state
   */
  updateCurrentState(success, pnl, tradeAmount) {
    // Update value tracking
    this.currentState.currentValue += pnl;
    
    if (this.currentState.currentValue > this.currentState.peakValue) {
      this.currentState.peakValue = this.currentState.currentValue;
    }
    
    // Update drawdown
    this.currentState.drawdown = this.currentState.peakValue > 0 ? 
      (this.currentState.peakValue - this.currentState.currentValue) / this.currentState.peakValue : 0;
    
    // Update streaks
    if (success && pnl > 0) {
      this.currentState.winStreak++;
      this.currentState.consecutiveWins++;
      this.currentState.lossStreak = 0;
      this.currentState.consecutiveLosses = 0;
    } else {
      this.currentState.lossStreak++;
      this.currentState.consecutiveLosses++;
      this.currentState.winStreak = 0;
      this.currentState.consecutiveWins = 0;
    }
    
    this.currentState.lastTradeResult = { success, pnl, tradeAmount, timestamp: Date.now() };
    
    // Record drawdown history
    this.drawdownHistory.push({
      timestamp: Date.now(),
      drawdown: this.currentState.drawdown,
      value: this.currentState.currentValue,
      peak: this.currentState.peakValue
    });
    
    // Record streak history
    this.streakHistory.push({
      timestamp: Date.now(),
      winStreak: this.currentState.winStreak,
      lossStreak: this.currentState.lossStreak,
      type: success ? 'win' : 'loss'
    });
  }
  
  /**
   * Update performance metrics for all time windows
   */
  updatePerformanceMetrics() {
    const now = Date.now();
    
    // Update short-term metrics (24 hours)
    this.performanceMetrics.shortTerm = this.calculateMetricsForWindow(
      now - this.options.shortTermWindow * 3600000
    );
    
    // Update medium-term metrics (1 week)
    this.performanceMetrics.mediumTerm = this.calculateMetricsForWindow(
      now - this.options.mediumTermWindow * 3600000
    );
    
    // Update long-term metrics (30 days)
    this.performanceMetrics.longTerm = this.calculateMetricsForWindow(
      now - this.options.longTermWindow * 3600000
    );
  }
  
  /**
   * Calculate performance metrics for a specific time window
   */
  calculateMetricsForWindow(startTime) {
    const windowTrades = this.performanceHistory.filter(trade => trade.timestamp >= startTime);
    
    if (windowTrades.length === 0) {
      return {
        totalReturn: 0,
        winRate: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        volatility: 0,
        tradesCount: 0,
        averageReturn: 0
      };
    }
    
    // Calculate basic metrics
    const totalReturn = windowTrades.reduce((sum, trade) => sum + trade.pnl, 0);
    const wins = windowTrades.filter(trade => trade.success && trade.pnl > 0);
    const winRate = wins.length / windowTrades.length;
    const averageReturn = totalReturn / windowTrades.length;
    
    // Calculate returns array for advanced metrics
    const returns = windowTrades.map(trade => trade.returnPercentage);
    
    // Calculate volatility (standard deviation of returns)
    const volatility = this.calculateVolatility(returns);
    
    // Calculate Sharpe ratio
    const sharpeRatio = this.calculateSharpeRatio(returns);
    
    // Calculate max drawdown in this window
    const maxDrawdown = this.calculateMaxDrawdownForWindow(windowTrades);
    
    return {
      totalReturn,
      winRate,
      sharpeRatio,
      maxDrawdown,
      volatility,
      tradesCount: windowTrades.length,
      averageReturn
    };
  }
  
  /**
   * Recalculate all risk adjustments
   */
  recalculateRiskAdjustments() {
    // Performance-based adjustment
    this.riskAdjustments.performanceBased = this.calculatePerformanceBasedAdjustment();
    
    // Drawdown-based adjustment
    this.riskAdjustments.drawdownBased = this.calculateDrawdownBasedAdjustment();
    
    // Streak-based adjustment
    this.riskAdjustments.streakBased = this.calculateStreakBasedAdjustment();
    
    // Time-based adjustment
    this.riskAdjustments.timeBased = this.calculateTimeBasedAdjustment();
    
    // ML-based adjustment
    if (this.mlModel.isEnabled) {
      this.riskAdjustments.mlBased = this.calculateMLBasedAdjustment();
    }
    
    // Combine all adjustments
    this.riskAdjustments.overall = this.combineRiskAdjustments();
    
    // Apply bounds
    this.riskAdjustments.overall = Math.max(
      this.options.minRiskScale,
      Math.min(this.options.maxRiskScale, this.riskAdjustments.overall)
    );
    
    // Record adjustment history
    this.riskParameterHistory.push({
      timestamp: Date.now(),
      adjustments: { ...this.riskAdjustments },
      performance: { ...this.performanceMetrics },
      state: { ...this.currentState }
    });
    
    // Keep only recent history
    if (this.riskParameterHistory.length > 1000) {
      this.riskParameterHistory = this.riskParameterHistory.slice(-1000);
    }
  }
  
  /**
   * Calculate performance-based risk adjustment
   */
  calculatePerformanceBasedAdjustment() {
    const shortTerm = this.performanceMetrics.shortTerm;
    const mediumTerm = this.performanceMetrics.mediumTerm;
    
    // Weight recent performance more heavily
    const recentPerformance = shortTerm.averageReturn * 0.6 + mediumTerm.averageReturn * 0.4;
    
    let adjustment = 1.0;
    
    // Excellent performance - increase risk taking
    if (recentPerformance > this.options.excellentPerformanceThreshold) {
      adjustment = 1.0 + this.options.performanceAdjustmentFactor;
    }
    // Poor performance - decrease risk taking
    else if (recentPerformance < this.options.poorPerformanceThreshold) {
      adjustment = 1.0 - this.options.performanceAdjustmentFactor;
    }
    // Average performance - slight adjustments based on Sharpe ratio
    else {
      const sharpeAdjustment = Math.max(-0.1, Math.min(0.1, shortTerm.sharpeRatio * 0.05));
      adjustment = 1.0 + sharpeAdjustment;
    }
    
    return adjustment;
  }
  
  /**
   * Calculate drawdown-based risk adjustment
   */
  calculateDrawdownBasedAdjustment() {
    const currentDrawdown = this.currentState.drawdown;
    
    if (currentDrawdown === 0) return 1.0;
    
    // Reduce risk as drawdown increases
    let adjustment = 1.0;
    
    if (currentDrawdown > this.options.emergencyDrawdownThreshold) {
      // Emergency drawdown - drastically reduce risk
      adjustment = 0.2;
    } else if (currentDrawdown > this.options.maxDrawdownThreshold) {
      // High drawdown - significantly reduce risk
      const excessDrawdown = currentDrawdown - this.options.maxDrawdownThreshold;
      adjustment = 1.0 - (excessDrawdown / this.options.maxDrawdownThreshold) * 0.6;
    } else {
      // Moderate drawdown - slight risk reduction
      adjustment = 1.0 - (currentDrawdown / this.options.maxDrawdownThreshold) * 0.3;
    }
    
    return Math.max(0.1, adjustment);
  }
  
  /**
   * Calculate streak-based risk adjustment
   */
  calculateStreakBasedAdjustment() {
    let adjustment = 1.0;
    
    // Win streak bonus
    if (this.currentState.winStreak > 0) {
      const bonus = Math.min(this.currentState.winStreak * this.options.winStreakBonus, 0.5);
      adjustment += bonus;
    }
    
    // Loss streak penalty
    if (this.currentState.lossStreak > 0) {
      const penalty = Math.min(this.currentState.lossStreak * this.options.lossStreakPenalty, 0.8);
      adjustment -= penalty;
    }
    
    return Math.max(0.1, adjustment);
  }
  
  /**
   * Calculate time-based risk adjustment
   */
  calculateTimeBasedAdjustment() {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    const hour = now.getHours();
    
    let adjustment = 1.0;
    
    // Weekend adjustment
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      adjustment *= this.options.weekendRiskReduction;
    }
    
    // Holiday adjustment (simplified check)
    if (this.isHoliday(now)) {
      adjustment *= this.options.holidayRiskReduction;
    }
    
    // Low volume hours (assuming UTC)
    if (hour < 6 || hour > 22) {
      adjustment *= this.options.lowVolumeRiskReduction;
    }
    
    // Pattern-based adjustment
    const hourlyPattern = this.timePatterns.hourlyPerformance[hour];
    const dailyPattern = this.timePatterns.dailyPerformance[dayOfWeek];
    
    if (hourlyPattern < -0.01) adjustment *= 0.9; // Poor hourly performance
    if (hourlyPattern > 0.01) adjustment *= 1.1; // Good hourly performance
    
    if (dailyPattern < -0.01) adjustment *= 0.9; // Poor daily performance
    if (dailyPattern > 0.01) adjustment *= 1.1; // Good daily performance
    
    return adjustment;
  }
  
  /**
   * Calculate ML-based risk adjustment
   */
  calculateMLBasedAdjustment() {
    if (!this.mlModel.isEnabled || this.mlModel.predictions.length === 0) {
      return 1.0;
    }
    
    // Get latest ML prediction
    const latestPrediction = this.mlModel.predictions[this.mlModel.predictions.length - 1];
    
    // Convert prediction to risk adjustment
    // Assuming prediction is probability of success (0-1)
    const confidence = latestPrediction.confidence || 0.5;
    const prediction = latestPrediction.value || 0.5;
    
    // Adjust risk based on prediction and confidence
    let adjustment = 1.0;
    
    if (confidence > 0.7) {
      if (prediction > 0.6) {
        adjustment = 1.0 + (prediction - 0.5) * 0.4; // Increase risk for high confidence positive predictions
      } else if (prediction < 0.4) {
        adjustment = 1.0 - (0.5 - prediction) * 0.4; // Decrease risk for high confidence negative predictions
      }
    }
    
    return adjustment;
  }
  
  /**
   * Combine all risk adjustments
   */
  combineRiskAdjustments() {
    const adjustments = this.riskAdjustments;
    
    // Weighted combination of adjustments
    const weights = {
      performance: 0.3,
      drawdown: 0.25,
      streak: 0.2,
      time: 0.15,
      ml: 0.1
    };
    
    const combined = 
      adjustments.performanceBased * weights.performance +
      adjustments.drawdownBased * weights.drawdown +
      adjustments.streakBased * weights.streak +
      adjustments.timeBased * weights.time +
      adjustments.mlBased * weights.ml;
    
    return combined;
  }
  
  /**
   * Update time-based performance patterns
   */
  updateTimePatterns(tradeResult) {
    const timestamp = new Date(tradeResult.timestamp || Date.now());
    const hour = timestamp.getHours();
    const dayOfWeek = timestamp.getDay();
    const month = timestamp.getMonth();
    
    const returnPercentage = tradeResult.pnl / tradeResult.tradeAmount;
    
    // Update hourly pattern with exponential moving average
    const alpha = 0.1; // Learning rate
    this.timePatterns.hourlyPerformance[hour] = 
      (1 - alpha) * this.timePatterns.hourlyPerformance[hour] + alpha * returnPercentage;
    
    // Update daily pattern
    this.timePatterns.dailyPerformance[dayOfWeek] = 
      (1 - alpha) * this.timePatterns.dailyPerformance[dayOfWeek] + alpha * returnPercentage;
    
    // Update monthly pattern
    this.timePatterns.monthlyPerformance[month] = 
      (1 - alpha) * this.timePatterns.monthlyPerformance[month] + alpha * returnPercentage;
    
    this.timePatterns.lastUpdated = Date.now();
  }
  
  // ML Model Integration
  
  /**
   * Initialize ML model
   */
  async initializeMLModel() {
    console.log('🤖 Initializing ML model for performance prediction...');
    
    try {
      // Load training data
      await this.loadMLTrainingData();
      
      // Train initial model
      await this.trainMLModel();
      
      this.mlModel.lastTraining = Date.now();
      
      console.log('✅ ML model initialized');
      
    } catch (error) {
      console.warn('⚠️ ML model initialization failed:', error.message);
      this.mlModel.isEnabled = false;
    }
  }
  
  /**
   * Update ML model with new trade result
   */
  updateMLModel(tradeResult) {
    // Add to training data
    const features = this.extractFeatures(tradeResult);
    const target = tradeResult.success ? 1 : 0;
    
    this.mlModel.trainingData.push({
      features,
      target,
      timestamp: tradeResult.timestamp || Date.now()
    });
    
    // Keep only recent training data
    const cutoff = Date.now() - this.options.mlTrainingWindow * 3600000;
    this.mlModel.trainingData = this.mlModel.trainingData.filter(
      data => data.timestamp > cutoff
    );
    
    // Retrain model periodically
    if (Date.now() - this.mlModel.lastTraining > this.options.mlModelUpdateInterval) {
      this.scheduleMLRetraining();
    }
  }
  
  /**
   * Extract features for ML model
   */
  extractFeatures(tradeResult) {
    return [
      // Performance features
      this.performanceMetrics.shortTerm.winRate,
      this.performanceMetrics.shortTerm.sharpeRatio,
      this.performanceMetrics.shortTerm.volatility,
      
      // State features
      this.currentState.drawdown,
      this.currentState.winStreak,
      this.currentState.lossStreak,
      
      // Time features
      new Date().getHours() / 24,
      new Date().getDay() / 7,
      
      // Market features (would be integrated with market data)
      Math.random(), // Placeholder for market volatility
      Math.random(), // Placeholder for market trend
      
      // Trade features
      tradeResult.tradeAmount / 10000, // Normalized trade amount
      (tradeResult.metadata?.expectedProfit || 0) / tradeResult.tradeAmount
    ];
  }
  
  /**
   * Generate ML prediction for current conditions
   */
  generateMLPrediction() {
    if (!this.mlModel.isEnabled || this.mlModel.trainingData.length < 50) {
      return { value: 0.5, confidence: 0 };
    }
    
    // Extract current features
    const currentFeatures = this.extractFeaturesForPrediction();
    
    // Simple ML prediction (in practice, would use a proper ML library)
    const prediction = this.simpleMLPredict(currentFeatures);
    
    // Add to predictions history
    this.mlModel.predictions.push({
      timestamp: Date.now(),
      features: currentFeatures,
      value: prediction.value,
      confidence: prediction.confidence
    });
    
    // Keep only recent predictions
    if (this.mlModel.predictions.length > 1000) {
      this.mlModel.predictions = this.mlModel.predictions.slice(-1000);
    }
    
    return prediction;
  }
  
  /**
   * Simple ML prediction (placeholder for actual ML implementation)
   */
  simpleMLPredict(features) {
    // This is a simplified placeholder
    // In practice, would use libraries like TensorFlow.js or brain.js
    
    const recentData = this.mlModel.trainingData.slice(-100);
    if (recentData.length < 10) return { value: 0.5, confidence: 0 };
    
    // Calculate similarity-based prediction
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (const data of recentData) {
      const similarity = this.calculateFeatureSimilarity(features, data.features);
      const weight = Math.pow(similarity, 2); // Square to emphasize close matches
      
      weightedSum += data.target * weight;
      totalWeight += weight;
    }
    
    const prediction = totalWeight > 0 ? weightedSum / totalWeight : 0.5;
    const confidence = Math.min(totalWeight / recentData.length, 1.0);
    
    return { value: prediction, confidence };
  }
  
  /**
   * Calculate similarity between feature vectors
   */
  calculateFeatureSimilarity(features1, features2) {
    if (features1.length !== features2.length) return 0;
    
    let sumSquaredDiff = 0;
    for (let i = 0; i < features1.length; i++) {
      sumSquaredDiff += Math.pow(features1[i] - features2[i], 2);
    }
    
    const distance = Math.sqrt(sumSquaredDiff);
    return 1 / (1 + distance); // Convert distance to similarity
  }
  
  // Utility methods
  
  calculateVolatility(returns) {
    if (returns.length < 2) return 0;
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }
  
  calculateSharpeRatio(returns) {
    if (returns.length < 2) return 0;
    
    const riskFreeRate = 0.02 / 365; // 2% annual risk-free rate, daily
    const excessReturns = returns.map(r => r - riskFreeRate);
    const avgExcessReturn = excessReturns.reduce((sum, r) => sum + r, 0) / excessReturns.length;
    const volatility = this.calculateVolatility(excessReturns);
    
    return volatility > 0 ? avgExcessReturn / volatility : 0;
  }
  
  calculateMaxDrawdownForWindow(trades) {
    let maxDrawdown = 0;
    let peak = 0;
    let current = 0;
    
    for (const trade of trades) {
      current += trade.pnl;
      
      if (current > peak) {
        peak = current;
      }
      
      const drawdown = peak > 0 ? (peak - current) / peak : 0;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    return maxDrawdown;
  }
  
  isHoliday(date) {
    // Simplified holiday check (would implement proper holiday calendar)
    const month = date.getMonth();
    const day = date.getDate();
    
    // New Year's Day
    if (month === 0 && day === 1) return true;
    
    // Christmas
    if (month === 11 && day === 25) return true;
    
    return false;
  }
  
  generateAdjustmentReasoning() {
    const reasons = [];
    
    if (this.riskAdjustments.performanceBased > 1.1) {
      reasons.push('Strong recent performance (+10% risk)');
    } else if (this.riskAdjustments.performanceBased < 0.9) {
      reasons.push('Weak recent performance (-10% risk)');
    }
    
    if (this.riskAdjustments.drawdownBased < 0.8) {
      reasons.push(`High drawdown: ${(this.currentState.drawdown * 100).toFixed(1)}%`);
    }
    
    if (this.currentState.lossStreak > 2) {
      reasons.push(`${this.currentState.lossStreak} consecutive losses`);
    }
    
    if (this.currentState.winStreak > 3) {
      reasons.push(`${this.currentState.winStreak} consecutive wins`);
    }
    
    return reasons;
  }
  
  calculateAdjustmentConfidence() {
    let confidence = 1.0;
    
    // Reduce confidence with limited data
    if (this.performanceHistory.length < 50) {
      confidence *= this.performanceHistory.length / 50;
    }
    
    // Reduce confidence during high volatility
    if (this.performanceMetrics.shortTerm.volatility > 0.1) {
      confidence *= 0.8;
    }
    
    // Increase confidence with ML model accuracy
    if (this.mlModel.isEnabled && this.mlModel.accuracy > 0.6) {
      confidence = Math.min(confidence * 1.2, 1.0);
    }
    
    return confidence;
  }
  
  cleanupHistory() {
    const cutoff = Date.now() - this.options.longTermWindow * 3600000;
    
    this.performanceHistory = this.performanceHistory.filter(
      trade => trade.timestamp > cutoff
    );
    
    this.drawdownHistory = this.drawdownHistory.filter(
      entry => entry.timestamp > cutoff
    );
    
    this.streakHistory = this.streakHistory.filter(
      entry => entry.timestamp > cutoff
    );
  }
  
  // Setup and initialization methods
  
  setupPerformanceMonitoring() {
    // Update metrics every hour
    setInterval(() => {
      this.updatePerformanceMetrics();
      this.recalculateRiskAdjustments();
    }, 3600000);
    
    // Apply daily decay to adjustments
    setInterval(() => {
      this.applyDailyDecay();
    }, 86400000);
    
    // Generate ML predictions periodically
    if (this.mlModel.isEnabled) {
      setInterval(() => {
        this.generateMLPrediction();
      }, 3600000); // Every hour
    }
  }
  
  applyDailyDecay() {
    // Apply decay to extreme adjustments to prevent them from persisting too long
    const decay = this.options.riskAdjustmentDecay;
    
    // Decay performance-based adjustments towards 1.0
    this.riskAdjustments.performanceBased = 
      1.0 + (this.riskAdjustments.performanceBased - 1.0) * decay;
    
    // Decay streak-based adjustments towards 1.0
    this.riskAdjustments.streakBased = 
      1.0 + (this.riskAdjustments.streakBased - 1.0) * decay;
    
    // Recalculate overall adjustment
    this.riskAdjustments.overall = this.combineRiskAdjustments();
  }
  
  async loadHistoricalPerformance() {
    console.log('📚 Loading historical performance data...');
    
    // This would load historical performance data for initialization
    // For now, initialize with baseline values
    this.currentState.peakValue = 10000;
    this.currentState.currentValue = 10000;
  }
  
  async initializeTimePatterns() {
    console.log('⏰ Initializing time-based patterns...');
    
    // This would analyze historical data to identify time-based patterns
    // For now, initialize with neutral values
    this.timePatterns.hourlyPerformance.fill(0);
    this.timePatterns.dailyPerformance.fill(0);
    this.timePatterns.monthlyPerformance.fill(0);
  }
  
  async loadMLTrainingData() {
    // This would load historical trading data for ML training
    console.log('🤖 Loading ML training data...');
  }
  
  async trainMLModel() {
    // This would train the ML model with historical data
    console.log('🤖 Training ML model...');
    this.mlModel.accuracy = 0.6; // Placeholder accuracy
  }
  
  scheduleMLRetraining() {
    // Schedule ML model retraining
    setTimeout(async () => {
      try {
        await this.trainMLModel();
        this.mlModel.lastTraining = Date.now();
        console.log('🤖 ML model retrained');
      } catch (error) {
        console.error('ML retraining failed:', error.message);
      }
    }, 1000); // Schedule for immediate execution
  }
  
  extractFeaturesForPrediction() {
    // Extract current features for prediction
    return [
      this.performanceMetrics.shortTerm.winRate,
      this.performanceMetrics.shortTerm.sharpeRatio,
      this.performanceMetrics.shortTerm.volatility,
      this.currentState.drawdown,
      this.currentState.winStreak,
      this.currentState.lossStreak,
      new Date().getHours() / 24,
      new Date().getDay() / 7,
      Math.random(), // Market volatility placeholder
      Math.random(), // Market trend placeholder
      0.1, // Average trade size placeholder
      0.05 // Average expected profit placeholder
    ];
  }
  
  /**
   * Get comprehensive performance risk report
   */
  getPerformanceRiskReport() {
    return {
      summary: {
        currentAdjustment: this.riskAdjustments.overall,
        adjustmentConfidence: this.calculateAdjustmentConfidence(),
        performanceRating: this.getPerformanceRating(),
        riskLevel: this.getCurrentRiskLevel()
      },
      
      performanceMetrics: this.performanceMetrics,
      
      currentState: this.currentState,
      
      riskAdjustments: {
        current: this.riskAdjustments,
        reasoning: this.generateAdjustmentReasoning(),
        history: this.riskParameterHistory.slice(-20)
      },
      
      patterns: {
        timePatterns: this.timePatterns,
        streakAnalysis: this.analyzeStreakPatterns(),
        drawdownAnalysis: this.analyzeDrawdownPatterns()
      },
      
      mlModel: this.mlModel.isEnabled ? {
        enabled: true,
        accuracy: this.mlModel.accuracy,
        lastTraining: this.mlModel.lastTraining,
        recentPredictions: this.mlModel.predictions.slice(-10)
      } : { enabled: false },
      
      recommendations: this.getPerformanceRecommendations()
    };
  }
  
  getPerformanceRating() {
    const shortTerm = this.performanceMetrics.shortTerm;
    
    if (shortTerm.sharpeRatio > 2 && shortTerm.winRate > 0.6) {
      return 'EXCELLENT';
    } else if (shortTerm.sharpeRatio > 1 && shortTerm.winRate > 0.5) {
      return 'GOOD';
    } else if (shortTerm.sharpeRatio > 0 && shortTerm.winRate > 0.4) {
      return 'AVERAGE';
    } else {
      return 'POOR';
    }
  }
  
  getCurrentRiskLevel() {
    const adjustment = this.riskAdjustments.overall;
    
    if (adjustment > 1.5) return 'HIGH';
    if (adjustment > 1.2) return 'ELEVATED';
    if (adjustment < 0.5) return 'VERY_LOW';
    if (adjustment < 0.8) return 'LOW';
    return 'NORMAL';
  }
  
  analyzeStreakPatterns() {
    const recentStreaks = this.streakHistory.slice(-50);
    
    const winStreaks = recentStreaks.filter(s => s.type === 'win').map(s => s.winStreak);
    const lossStreaks = recentStreaks.filter(s => s.type === 'loss').map(s => s.lossStreak);
    
    return {
      averageWinStreak: winStreaks.length > 0 ? winStreaks.reduce((sum, s) => sum + s, 0) / winStreaks.length : 0,
      averageLossStreak: lossStreaks.length > 0 ? lossStreaks.reduce((sum, s) => sum + s, 0) / lossStreaks.length : 0,
      maxWinStreak: Math.max(...winStreaks, 0),
      maxLossStreak: Math.max(...lossStreaks, 0),
      currentStreak: this.currentState.winStreak > 0 ? 
        { type: 'win', length: this.currentState.winStreak } :
        { type: 'loss', length: this.currentState.lossStreak }
    };
  }
  
  analyzeDrawdownPatterns() {
    const recentDrawdowns = this.drawdownHistory.slice(-100);
    
    const drawdowns = recentDrawdowns.map(d => d.drawdown);
    const maxDrawdown = Math.max(...drawdowns, 0);
    const avgDrawdown = drawdowns.reduce((sum, d) => sum + d, 0) / drawdowns.length;
    
    return {
      current: this.currentState.drawdown,
      maximum: maxDrawdown,
      average: avgDrawdown,
      frequency: drawdowns.filter(d => d > 0.05).length / drawdowns.length,
      recoveryTime: this.calculateAverageRecoveryTime()
    };
  }
  
  calculateAverageRecoveryTime() {
    // Calculate average time to recover from drawdowns
    // This is a simplified calculation
    return 24; // Hours (placeholder)
  }
  
  getPerformanceRecommendations() {
    const recommendations = [];
    
    if (this.currentState.drawdown > this.options.maxDrawdownThreshold) {
      recommendations.push({
        priority: 'critical',
        category: 'drawdown',
        title: 'High Drawdown Alert',
        description: `Current drawdown: ${(this.currentState.drawdown * 100).toFixed(1)}%`,
        action: 'Consider reducing risk or taking a break from trading'
      });
    }
    
    if (this.currentState.lossStreak > 5) {
      recommendations.push({
        priority: 'high',
        category: 'streak',
        title: 'Extended Loss Streak',
        description: `${this.currentState.lossStreak} consecutive losses`,
        action: 'Review strategy and consider risk parameter adjustment'
      });
    }
    
    if (this.performanceMetrics.shortTerm.sharpeRatio < 0) {
      recommendations.push({
        priority: 'medium',
        category: 'performance',
        title: 'Negative Risk-Adjusted Returns',
        description: `Sharpe ratio: ${this.performanceMetrics.shortTerm.sharpeRatio.toFixed(2)}`,
        action: 'Analyze strategy effectiveness and market conditions'
      });
    }
    
    if (!this.mlModel.isEnabled) {
      recommendations.push({
        priority: 'low',
        category: 'optimization',
        title: 'ML Model Disabled',
        description: 'Machine learning risk adjustments are not active',
        action: 'Consider enabling ML model for enhanced risk management'
      });
    }
    
    return recommendations;
  }
  
  /**
   * Shutdown performance risk manager
   */
  async shutdown() {
    console.log('📊 Shutting down Performance Risk Manager...');
    this.emit('shutdown');
  }
}

export default PerformanceRiskManager;