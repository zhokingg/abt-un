const { ethers } = require('ethers');
const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

/**
 * Gas Analytics Service for Monitoring and Optimization
 * Tracks gas usage patterns, provides insights, and generates optimization recommendations
 */
class GasAnalytics extends EventEmitter {
  constructor(web3Provider) {
    super();
    this.web3Provider = web3Provider;
    this.provider = web3Provider?.provider;
    
    // Analytics storage
    this.analytics = {
      transactions: [],
      gasMetrics: new Map(),
      optimizationResults: [],
      networkConditions: []
    };
    
    // Performance tracking
    this.metrics = {
      totalTransactions: 0,
      totalGasUsed: 0n,
      totalGasCost: 0n,
      averageGasPrice: 0n,
      successRate: 0,
      gasSavings: 0n,
      costSavings: 0
    };
    
    // Gas pattern recognition
    this.patterns = {
      hourlyUsage: new Array(24).fill(0),
      dailyUsage: new Array(7).fill(0),
      strategyPerformance: new Map(),
      tokenPairEfficiency: new Map()
    };
    
    // Configuration
    this.config = {
      maxHistorySize: 10000,
      analyticsInterval: 60000, // 1 minute
      reportInterval: 3600000,  // 1 hour
      dataRetentionDays: 30,
      enableReporting: true
    };
    
    this.initializeAnalytics();
  }
  
  /**
   * Record transaction for analytics
   */
  async recordTransaction(transactionData, result) {
    try {
      const record = {
        id: this.generateTransactionId(),
        timestamp: Date.now(),
        hash: result.hash || null,
        
        // Transaction details
        gasLimit: transactionData.gasLimit.toString(),
        maxFeePerGas: transactionData.maxFeePerGas.toString(),
        maxPriorityFeePerGas: transactionData.maxPriorityFeePerGas.toString(),
        
        // Execution results
        gasUsed: result.gasUsed ? result.gasUsed.toString() : null,
        effectiveGasPrice: result.effectiveGasPrice ? result.effectiveGasPrice.toString() : null,
        status: result.status || 'pending',
        
        // Optimization data
        strategy: transactionData.strategy || 'unknown',
        mlOptimized: transactionData.mlOptimized || false,
        profitProtected: transactionData.profitProtected || false,
        
        // Cost analysis
        estimatedCost: transactionData.estimatedCostUSD || 0,
        actualCost: result.actualCostUSD || 0,
        gasSavings: transactionData.gasSavings || 0,
        
        // Network conditions
        networkCongestion: result.networkCongestion || 'unknown',
        blockNumber: result.blockNumber || null,
        
        // Arbitrage specifics
        tokenPair: transactionData.tokenPair || null,
        tradeAmount: transactionData.tradeAmount || 0,
        profitAmount: result.profitAmount || 0
      };
      
      // Store record
      this.analytics.transactions.push(record);
      
      // Update metrics
      this.updateMetrics(record);
      
      // Update patterns
      this.updatePatterns(record);
      
      // Cleanup old data
      this.cleanupOldData();
      
      console.log(`📊 Transaction recorded: ${record.id}`);
      this.emit('transactionRecorded', record);
      
    } catch (error) {
      console.error('Failed to record transaction:', error.message);
    }
  }
  
  /**
   * Analyze gas usage patterns and generate insights
   */
  async analyzeGasPatterns() {
    try {
      console.log('🔍 Analyzing gas usage patterns...');
      
      const analysis = {
        timestamp: Date.now(),
        
        // Basic statistics
        totalTransactions: this.analytics.transactions.length,
        averageGasUsed: this.calculateAverageGasUsed(),
        averageGasPrice: this.calculateAverageGasPrice(),
        successRate: this.calculateSuccessRate(),
        
        // Cost analysis
        totalCosts: this.calculateTotalCosts(),
        averageCostPerTransaction: this.calculateAverageCostPerTransaction(),
        gasSavings: this.calculateGasSavings(),
        
        // Pattern analysis
        hourlyPatterns: this.analyzeHourlyPatterns(),
        strategyEfficiency: this.analyzeStrategyEfficiency(),
        networkImpact: this.analyzeNetworkImpact(),
        
        // Optimization insights
        optimizationRecommendations: this.generateOptimizationRecommendations()
      };
      
      console.log('✅ Gas pattern analysis completed');
      this.emit('analysisCompleted', analysis);
      
      return analysis;
      
    } catch (error) {
      console.error('Gas pattern analysis failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Generate gas optimization recommendations
   */
  generateOptimizationRecommendations() {
    const recommendations = [];
    
    // Analyze strategy performance
    const strategyStats = this.analyzeStrategyStats();
    const bestStrategy = this.findBestPerformingStrategy(strategyStats);
    
    if (bestStrategy) {
      recommendations.push({
        type: 'STRATEGY_OPTIMIZATION',
        priority: 'HIGH',
        description: `Consider using ${bestStrategy.name} strategy more frequently`,
        impact: `Potential ${(bestStrategy.savings * 100).toFixed(1)}% gas savings`,
        data: bestStrategy
      });
    }
    
    // Analyze timing patterns
    const timingAnalysis = this.analyzeOptimalTiming();
    if (timingAnalysis.bestHours.length > 0) {
      recommendations.push({
        type: 'TIMING_OPTIMIZATION',
        priority: 'MEDIUM',
        description: `Execute more transactions during low-gas periods`,
        impact: `Best hours: ${timingAnalysis.bestHours.join(', ')}`,
        data: timingAnalysis
      });
    }
    
    // Analyze gas limit efficiency
    const gasLimitAnalysis = this.analyzeGasLimitEfficiency();
    if (gasLimitAnalysis.overestimation > 0.15) {
      recommendations.push({
        type: 'GAS_LIMIT_OPTIMIZATION',
        priority: 'MEDIUM',
        description: 'Reduce gas limit overestimation',
        impact: `${(gasLimitAnalysis.overestimation * 100).toFixed(1)}% overestimation detected`,
        data: gasLimitAnalysis
      });
    }
    
    // Analyze batch opportunities
    const batchAnalysis = this.analyzeBatchOpportunities();
    if (batchAnalysis.batchable > 0) {
      recommendations.push({
        type: 'BATCH_OPTIMIZATION',
        priority: 'HIGH',
        description: 'Implement batch processing for multiple operations',
        impact: `${batchAnalysis.batchable} transactions could be batched`,
        data: batchAnalysis
      });
    }
    
    return recommendations;
  }
  
  /**
   * Generate comprehensive analytics report
   */
  async generateAnalyticsReport(options = {}) {
    try {
      const timeRange = options.timeRange || 24 * 60 * 60 * 1000; // 24 hours
      const since = Date.now() - timeRange;
      
      const recentTransactions = this.analytics.transactions.filter(
        tx => tx.timestamp >= since
      );
      
      const report = {
        metadata: {
          generatedAt: new Date().toISOString(),
          timeRange: `${timeRange / (60 * 60 * 1000)} hours`,
          transactionCount: recentTransactions.length
        },
        
        summary: {
          totalGasUsed: this.sumGasUsed(recentTransactions),
          totalCostUSD: this.sumCosts(recentTransactions),
          averageGasPrice: this.calculateAverageGasPrice(recentTransactions),
          successRate: this.calculateSuccessRate(recentTransactions),
          gasSavingsUSD: this.calculateGasSavings(recentTransactions)
        },
        
        performance: {
          strategyBreakdown: this.analyzeStrategyBreakdown(recentTransactions),
          networkConditions: this.analyzeNetworkConditions(recentTransactions),
          costEfficiency: this.analyzeCostEfficiency(recentTransactions)
        },
        
        insights: {
          topSavingStrategies: this.findTopSavingStrategies(recentTransactions),
          costliestTransactions: this.findCostliestTransactions(recentTransactions),
          mostEfficientTokenPairs: this.findMostEfficientTokenPairs(recentTransactions)
        },
        
        recommendations: this.generateOptimizationRecommendations(),
        
        charts: {
          hourlyGasUsage: this.generateHourlyGasChart(recentTransactions),
          strategyComparison: this.generateStrategyComparisonChart(recentTransactions),
          costTrends: this.generateCostTrendChart(recentTransactions)
        }
      };
      
      // Save report if enabled
      if (this.config.enableReporting) {
        await this.saveReport(report);
      }
      
      console.log('📈 Analytics report generated');
      this.emit('reportGenerated', report);
      
      return report;
      
    } catch (error) {
      console.error('Failed to generate analytics report:', error.message);
      throw error;
    }
  }
  
  /**
   * Get real-time gas analytics dashboard data
   */
  getDashboardData() {
    const recent = this.getRecentTransactions(60 * 60 * 1000); // Last hour
    
    return {
      realTime: {
        currentGasPrice: this.getCurrentGasPrice(),
        networkCongestion: this.getCurrentCongestionLevel(),
        transactionsLastHour: recent.length,
        successRate: this.calculateSuccessRate(recent)
      },
      
      metrics: {
        totalGasUsed: this.metrics.totalGasUsed.toString(),
        totalGasCost: ethers.formatEther(this.metrics.totalGasCost),
        averageGasPrice: ethers.formatUnits(this.metrics.averageGasPrice, 'gwei'),
        gasSavings: ethers.formatEther(this.metrics.gasSavings)
      },
      
      trends: {
        hourlyPattern: this.patterns.hourlyUsage,
        strategyPerformance: Array.from(this.patterns.strategyPerformance.entries()),
        recentTransactions: recent.slice(-10) // Last 10 transactions
      },
      
      alerts: this.generateAlerts()
    };
  }
  
  /**
   * Initialize analytics system
   */
  initializeAnalytics() {
    // Periodic analytics updates
    setInterval(() => {
      this.updateRealTimeMetrics().catch(console.error);
    }, this.config.analyticsInterval);
    
    // Periodic reporting
    if (this.config.enableReporting) {
      setInterval(() => {
        this.generateAnalyticsReport().catch(console.error);
      }, this.config.reportInterval);
    }
    
    // Data cleanup
    setInterval(() => {
      this.cleanupOldData();
    }, 24 * 60 * 60 * 1000); // Daily cleanup
    
    console.log('📊 Gas analytics initialized');
  }
  
  /**
   * Helper methods for calculations
   */
  
  calculateAverageGasUsed(transactions = null) {
    const txs = transactions || this.analytics.transactions;
    if (txs.length === 0) return 0;
    
    const total = txs.reduce((sum, tx) => {
      return sum + BigInt(tx.gasUsed || 0);
    }, 0n);
    
    return Number(total / BigInt(txs.length));
  }
  
  calculateAverageGasPrice(transactions = null) {
    const txs = transactions || this.analytics.transactions;
    if (txs.length === 0) return 0n;
    
    const total = txs.reduce((sum, tx) => {
      return sum + BigInt(tx.effectiveGasPrice || 0);
    }, 0n);
    
    return total / BigInt(txs.length);
  }
  
  calculateSuccessRate(transactions = null) {
    const txs = transactions || this.analytics.transactions;
    if (txs.length === 0) return 0;
    
    const successful = txs.filter(tx => tx.status === 'success').length;
    return successful / txs.length;
  }
  
  calculateTotalCosts() {
    return this.analytics.transactions.reduce((total, tx) => {
      return total + (tx.actualCost || 0);
    }, 0);
  }
  
  calculateAverageCostPerTransaction() {
    const total = this.calculateTotalCosts();
    return this.analytics.transactions.length > 0 ? 
      total / this.analytics.transactions.length : 0;
  }
  
  calculateGasSavings(transactions = null) {
    const txs = transactions || this.analytics.transactions;
    return txs.reduce((total, tx) => total + (tx.gasSavings || 0), 0);
  }
  
  analyzeHourlyPatterns() {
    const hourlyStats = new Array(24).fill().map(() => ({
      transactions: 0,
      totalGasUsed: 0,
      averageGasPrice: 0,
      successRate: 0
    }));
    
    this.analytics.transactions.forEach(tx => {
      const hour = new Date(tx.timestamp).getHours();
      hourlyStats[hour].transactions++;
      hourlyStats[hour].totalGasUsed += parseInt(tx.gasUsed || 0);
    });
    
    return hourlyStats;
  }
  
  analyzeStrategyEfficiency() {
    const strategies = new Map();
    
    this.analytics.transactions.forEach(tx => {
      if (!strategies.has(tx.strategy)) {
        strategies.set(tx.strategy, {
          count: 0,
          totalGasUsed: 0,
          totalCost: 0,
          successCount: 0,
          gasSavings: 0
        });
      }
      
      const stats = strategies.get(tx.strategy);
      stats.count++;
      stats.totalGasUsed += parseInt(tx.gasUsed || 0);
      stats.totalCost += tx.actualCost || 0;
      stats.gasSavings += tx.gasSavings || 0;
      
      if (tx.status === 'success') {
        stats.successCount++;
      }
    });
    
    // Calculate efficiency metrics
    for (const [strategy, stats] of strategies) {
      stats.averageGasUsed = stats.count > 0 ? stats.totalGasUsed / stats.count : 0;
      stats.averageCost = stats.count > 0 ? stats.totalCost / stats.count : 0;
      stats.successRate = stats.count > 0 ? stats.successCount / stats.count : 0;
      stats.avgSavings = stats.count > 0 ? stats.gasSavings / stats.count : 0;
    }
    
    return Object.fromEntries(strategies);
  }
  
  updateMetrics(record) {
    this.metrics.totalTransactions++;
    
    if (record.gasUsed) {
      this.metrics.totalGasUsed += BigInt(record.gasUsed);
    }
    
    if (record.actualCost) {
      this.metrics.totalGasCost += ethers.parseEther(record.actualCost.toString());
    }
    
    if (record.gasSavings) {
      this.metrics.gasSavings += ethers.parseEther(record.gasSavings.toString());
    }
    
    // Recalculate averages
    if (this.metrics.totalTransactions > 0 && this.metrics.totalGasUsed > 0n) {
      this.metrics.averageGasPrice = this.metrics.totalGasCost / this.metrics.totalGasUsed;
    }
    
    this.metrics.successRate = this.calculateSuccessRate();
  }
  
  updatePatterns(record) {
    // Update hourly pattern
    const hour = new Date(record.timestamp).getHours();
    this.patterns.hourlyUsage[hour]++;
    
    // Update strategy performance
    if (!this.patterns.strategyPerformance.has(record.strategy)) {
      this.patterns.strategyPerformance.set(record.strategy, {
        count: 0,
        successRate: 0,
        avgGasSavings: 0
      });
    }
    
    const strategyStats = this.patterns.strategyPerformance.get(record.strategy);
    strategyStats.count++;
    
    // Update token pair efficiency if available
    if (record.tokenPair) {
      if (!this.patterns.tokenPairEfficiency.has(record.tokenPair)) {
        this.patterns.tokenPairEfficiency.set(record.tokenPair, {
          count: 0,
          avgGasUsed: 0,
          avgProfit: 0
        });
      }
      
      const pairStats = this.patterns.tokenPairEfficiency.get(record.tokenPair);
      pairStats.count++;
    }
  }
  
  cleanupOldData() {
    const cutoffTime = Date.now() - (this.config.dataRetentionDays * 24 * 60 * 60 * 1000);
    
    this.analytics.transactions = this.analytics.transactions.filter(
      tx => tx.timestamp >= cutoffTime
    );
    
    // Limit total size
    if (this.analytics.transactions.length > this.config.maxHistorySize) {
      this.analytics.transactions = this.analytics.transactions.slice(-this.config.maxHistorySize);
    }
  }
  
  generateTransactionId() {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  getRecentTransactions(timeRange) {
    const since = Date.now() - timeRange;
    return this.analytics.transactions.filter(tx => tx.timestamp >= since);
  }
  
  getCurrentGasPrice() {
    const recent = this.getRecentTransactions(5 * 60 * 1000); // Last 5 minutes
    if (recent.length === 0) return 0;
    
    const total = recent.reduce((sum, tx) => sum + parseInt(tx.effectiveGasPrice || 0), 0);
    return total / recent.length;
  }
  
  getCurrentCongestionLevel() {
    // Simplified congestion detection
    const recentGasPrice = this.getCurrentGasPrice();
    
    if (recentGasPrice > 100) return 'HIGH';
    if (recentGasPrice > 50) return 'MEDIUM';
    return 'LOW';
  }
  
  generateAlerts() {
    const alerts = [];
    
    // High gas price alert
    const currentGasPrice = this.getCurrentGasPrice();
    if (currentGasPrice > 100) {
      alerts.push({
        type: 'HIGH_GAS_PRICE',
        severity: 'WARNING',
        message: `Current gas price is high: ${currentGasPrice.toFixed(1)} gwei`
      });
    }
    
    // Low success rate alert
    const recentSuccessRate = this.calculateSuccessRate(this.getRecentTransactions(60 * 60 * 1000));
    if (recentSuccessRate < 0.8) {
      alerts.push({
        type: 'LOW_SUCCESS_RATE',
        severity: 'ERROR',
        message: `Success rate dropped to ${(recentSuccessRate * 100).toFixed(1)}%`
      });
    }
    
    return alerts;
  }
  
  async saveReport(report) {
    try {
      const filename = `gas-analytics-report-${new Date().toISOString().split('T')[0]}.json`;
      const filepath = path.join(process.cwd(), 'reports', filename);
      
      // Ensure reports directory exists
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      
      await fs.writeFile(filepath, JSON.stringify(report, null, 2));
      console.log(`📄 Report saved: ${filepath}`);
      
    } catch (error) {
      console.error('Failed to save report:', error.message);
    }
  }
  
  async updateRealTimeMetrics() {
    // Update real-time metrics from blockchain
    // This would fetch current network conditions, gas prices, etc.
  }
  
  // Additional helper methods for specific analyses
  analyzeStrategyStats() { /* Implementation */ }
  findBestPerformingStrategy() { /* Implementation */ }
  analyzeOptimalTiming() { /* Implementation */ }
  analyzeGasLimitEfficiency() { /* Implementation */ }
  analyzeBatchOpportunities() { /* Implementation */ }
  analyzeNetworkImpact() { /* Implementation */ }
  analyzeStrategyBreakdown() { /* Implementation */ }
  analyzeNetworkConditions() { /* Implementation */ }
  analyzeCostEfficiency() { /* Implementation */ }
  findTopSavingStrategies() { /* Implementation */ }
  findCostliestTransactions() { /* Implementation */ }
  findMostEfficientTokenPairs() { /* Implementation */ }
  generateHourlyGasChart() { /* Implementation */ }
  generateStrategyComparisonChart() { /* Implementation */ }
  generateCostTrendChart() { /* Implementation */ }
  sumGasUsed() { /* Implementation */ }
  sumCosts() { /* Implementation */ }
}

module.exports = GasAnalytics;