const EventEmitter = require('events');
const CoreArbitrageEngine = require('./coreArbitrageEngine');
const FlashloanService = require('./flashloanService');
const ContractManager = require('./contractManager');
const EnhancedTransactionBuilder = require('./enhancedTransactionBuilder');
const EnhancedProfitCalculator = require('./enhancedProfitCalculator');
const config = require('../config/config');

/**
 * Enhanced Core Arbitrage Engine - Phase 3 Implementation
 * Extends Phase 2 engine with flashloan arbitrage capabilities
 */
class EnhancedCoreArbitrageEngine extends CoreArbitrageEngine {
  constructor() {
    super();
    
    // Phase 3 services
    this.flashloanService = null;
    this.contractManager = null;
    this.enhancedTransactionBuilder = null;
    this.enhancedProfitCalculator = null;
    
    // Flashloan-specific configuration
    this.flashloanConfig = {
      enabled: true,
      maxTradeAmount: 1000000, // $1M max
      minProfitThreshold: 0.1, // 0.1% minimum profit
      maxRiskLevel: 0.3, // 30% max risk
      preferredProviders: ['aave', 'dydx', 'balancer'],
      emergencyStopEnabled: true
    };
    
    // Enhanced opportunity tracking
    this.flashloanOpportunities = new Map();
    this.executionQueue = [];
    this.activeExecutions = new Map();
    
    // Performance metrics
    this.phase3Metrics = {
      flashloanExecutions: 0,
      successfulFlashloans: 0,
      totalFlashloanProfit: 0,
      averageExecutionTime: 0,
      riskAdjustedReturn: 0
    };
  }
  
  /**
   * Initialize the enhanced arbitrage engine with flashloan capabilities
   */
  async initialize(contractAddresses = {}) {
    try {
      console.log('🚀 Initializing Enhanced Core Arbitrage Engine (Phase 3)...');
      
      // Initialize Phase 2 components first
      await super.initialize();
      
      // Initialize Phase 3 components
      console.log('🔧 Initializing Phase 3 services...');
      
      // Initialize flashloan service
      this.flashloanService = new FlashloanService(this.web3Provider);
      await this.flashloanService.initialize();
      console.log('✅ Flashloan Service initialized');
      
      // Initialize contract manager
      this.contractManager = new ContractManager(this.web3Provider);
      await this.contractManager.initialize(contractAddresses);
      console.log('✅ Contract Manager initialized');
      
      // Initialize enhanced services
      this.enhancedTransactionBuilder = new EnhancedTransactionBuilder(
        this.web3Provider,
        this.flashloanService,
        this.contractManager
      );
      console.log('✅ Enhanced Transaction Builder initialized');
      
      this.enhancedProfitCalculator = new EnhancedProfitCalculator(
        this.web3Provider,
        this.flashloanService
      );
      console.log('✅ Enhanced Profit Calculator initialized');
      
      // Set up Phase 3 event listeners
      this.setupPhase3EventListeners();
      
      console.log('✅ Enhanced Core Arbitrage Engine initialized successfully');
      console.log('📊 Flashloan capabilities: ENABLED');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced Core Arbitrage Engine:', error.message);
      throw error;
    }
  }
  
  /**
   * Set up Phase 3 specific event listeners
   */
  setupPhase3EventListeners() {
    // Enhanced transaction builder events
    this.enhancedTransactionBuilder.on('flashloanTransactionComplete', this.handleFlashloanTransactionComplete.bind(this));
    
    // Contract manager events (if any)
    
    // Flashloan service events (if any)
    
    console.log('✅ Phase 3 event listeners configured');
  }
  
  /**
   * Enhanced opportunity evaluation with flashloan analysis
   */
  async evaluateFlashloanOpportunity(opportunity) {
    try {
      console.log(`🔍 Evaluating flashloan opportunity: ${opportunity.id}`);
      
      // Check if flashloans are enabled
      if (!this.flashloanConfig.enabled) {
        console.log('⏭️ Flashloans disabled, skipping');
        return { suitable: false, reason: 'Flashloans disabled' };
      }
      
      // Check trade amount limits
      if (opportunity.tradeAmountUSD > this.flashloanConfig.maxTradeAmount) {
        console.log('⏭️ Trade amount exceeds maximum, skipping');
        return { suitable: false, reason: 'Trade amount too large' };
      }
      
      // Enhanced profit calculation with flashloan costs
      const profitAnalysis = await this.enhancedProfitCalculator.calculateFlashloanArbitrageProfit(
        opportunity,
        opportunity.tradeAmountUSD || config.MAX_TRADE_AMOUNT
      );
      
      // Check profitability with enhanced criteria
      const suitable = this.isFlashloanOpportunitySuitable(profitAnalysis);
      
      if (suitable.result) {
        // Store opportunity for potential execution
        this.flashloanOpportunities.set(opportunity.id, {
          opportunity,
          profitAnalysis,
          timestamp: Date.now(),
          status: 'evaluated'
        });
        
        console.log(`✅ Flashloan opportunity suitable: ${opportunity.id}`);
        console.log(`💰 Expected profit: $${profitAnalysis.enhancedNetProfit.toFixed(2)} (${profitAnalysis.enhancedROI.toFixed(2)}%)`);
        console.log(`📊 Risk level: ${profitAnalysis.risk.riskLevel}`);
        console.log(`🎯 Execution probability: ${(profitAnalysis.executionProbability * 100).toFixed(1)}%`);
        
        // Emit event for monitoring
        this.emit('flashloanOpportunityFound', {
          opportunity,
          profitAnalysis,
          suitable
        });
      }
      
      return {
        suitable: suitable.result,
        reason: suitable.reason,
        profitAnalysis
      };
      
    } catch (error) {
      console.error('❌ Error evaluating flashloan opportunity:', error.message);
      return {
        suitable: false,
        reason: 'Evaluation error',
        error: error.message
      };
    }
  }
  
  /**
   * Check if flashloan opportunity meets execution criteria
   */
  isFlashloanOpportunitySuitable(profitAnalysis) {
    // Check minimum profit threshold
    if (profitAnalysis.enhancedROI < this.flashloanConfig.minProfitThreshold) {
      return { result: false, reason: 'Profit below threshold' };
    }
    
    // Check risk level
    if (profitAnalysis.risk.totalRisk > this.flashloanConfig.maxRiskLevel) {
      return { result: false, reason: 'Risk too high' };
    }
    
    // Check execution probability
    if (profitAnalysis.executionProbability < 0.5) {
      return { result: false, reason: 'Low execution probability' };
    }
    
    // Check if contracts are in emergency stop
    if (this.flashloanConfig.emergencyStopEnabled) {
      // This would be checked async in practice
    }
    
    return { result: true, reason: 'All criteria met' };
  }
  
  /**
   * Execute flashloan arbitrage
   */
  async executeFlashloanArbitrage(opportunityId, options = {}) {
    try {
      console.log(`🚀 Executing flashloan arbitrage: ${opportunityId}`);
      
      // Get opportunity data
      const opportunityData = this.flashloanOpportunities.get(opportunityId);
      if (!opportunityData) {
        throw new Error('Opportunity not found');
      }
      
      const { opportunity, profitAnalysis } = opportunityData;
      
      // Pre-execution validation
      await this.validateFlashloanExecution(opportunity, profitAnalysis);
      
      // Prepare arbitrage data for smart contract
      const arbitrageData = this.prepareArbitrageData(opportunity, profitAnalysis);
      
      // Build enhanced transaction
      const transactionData = await this.enhancedTransactionBuilder.buildFlashloanArbitrageTransaction(
        arbitrageData,
        options
      );
      
      // Execute transaction
      const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Track execution
      this.activeExecutions.set(executionId, {
        opportunityId,
        arbitrageData,
        transactionData,
        startTime: Date.now(),
        status: 'executing'
      });
      
      // Update opportunity status
      opportunityData.status = 'executing';
      opportunityData.executionId = executionId;
      
      // Send transaction
      const txResponse = await this.enhancedTransactionBuilder.sendFlashloanTransaction(
        transactionData.transaction,
        arbitrageData,
        options
      );
      
      // Update metrics
      this.phase3Metrics.flashloanExecutions++;
      
      console.log(`📤 Flashloan arbitrage transaction sent: ${txResponse.hash}`);
      
      // Emit execution event
      this.emit('flashloanArbitrageExecuted', {
        executionId,
        opportunityId,
        txHash: txResponse.hash,
        expectedProfit: profitAnalysis.enhancedNetProfit
      });
      
      return {
        success: true,
        executionId,
        txHash: txResponse.hash,
        expectedProfit: profitAnalysis.enhancedNetProfit
      };
      
    } catch (error) {
      console.error('❌ Flashloan arbitrage execution failed:', error.message);
      
      // Update execution tracking
      const executionData = Array.from(this.activeExecutions.values())
        .find(exec => exec.opportunityId === opportunityId);
      
      if (executionData) {
        executionData.status = 'failed';
        executionData.error = error.message;
      }
      
      // Emit failure event
      this.emit('flashloanArbitrageError', {
        opportunityId,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Handle flashloan transaction completion
   */
  async handleFlashloanTransactionComplete(event) {
    try {
      const { txHash, success, gasUsed, arbitrageData } = event;
      
      console.log(`${success ? '✅' : '❌'} Flashloan transaction completed: ${txHash}`);
      
      // Find execution data
      const executionData = Array.from(this.activeExecutions.values())
        .find(exec => exec.arbitrageData === arbitrageData);
      
      if (executionData) {
        executionData.status = success ? 'completed' : 'failed';
        executionData.endTime = Date.now();
        executionData.gasUsed = gasUsed;
        executionData.executionTime = executionData.endTime - executionData.startTime;
        
        // Update metrics
        if (success) {
          this.phase3Metrics.successfulFlashloans++;
          
          // Get actual profit from contract if available
          const profit = await this.getActualProfit(txHash);
          if (profit) {
            this.phase3Metrics.totalFlashloanProfit += parseFloat(profit);
            executionData.actualProfit = profit;
          }
          
          // Update average execution time
          this.updateAverageExecutionTime(executionData.executionTime);
        }
        
        // Clean up active execution after delay
        setTimeout(() => {
          this.activeExecutions.delete(executionData.executionId);
        }, 300000); // 5 minutes
      }
      
      // Emit completion event
      this.emit('flashloanExecutionComplete', {
        txHash,
        success,
        gasUsed,
        executionData
      });
      
    } catch (error) {
      console.error('❌ Error handling flashloan transaction completion:', error.message);
    }
  }
  
  /**
   * Prepare arbitrage data for smart contract execution
   */
  prepareArbitrageData(opportunity, profitAnalysis) {
    const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes from now
    
    return {
      tokenA: opportunity.tokenA.address,
      tokenB: opportunity.tokenB.address,
      amountIn: ethers.parseUnits(
        (opportunity.tradeAmountUSD || config.MAX_TRADE_AMOUNT).toString(),
        opportunity.tokenA.decimals || 6
      ).toString(),
      routerA: this.getRouterAddress(opportunity.buyFrom),
      routerB: this.getRouterAddress(opportunity.sellTo),
      feeA: this.getPoolFee(opportunity.buyFrom, opportunity.tokenA, opportunity.tokenB),
      feeB: this.getPoolFee(opportunity.sellTo, opportunity.tokenA, opportunity.tokenB),
      minProfitBps: Math.floor(this.flashloanConfig.minProfitThreshold * 100), // Convert to basis points
      deadline
    };
  }
  
  /**
   * Validate flashloan execution conditions
   */
  async validateFlashloanExecution(opportunity, profitAnalysis) {
    // Check contract emergency stop status
    const emergencyStopped = await this.contractManager.isEmergencyStopped();
    if (emergencyStopped) {
      throw new Error('Contracts are in emergency stop mode');
    }
    
    // Check flashloan availability
    const availability = await this.flashloanService.getFlashloanAvailability(
      opportunity.tokenA.address,
      ethers.parseUnits(
        (opportunity.tradeAmountUSD || config.MAX_TRADE_AMOUNT).toString(),
        opportunity.tokenA.decimals || 6
      )
    );
    
    if (availability.length === 0 || !availability[0].available) {
      throw new Error('Insufficient flashloan liquidity');
    }
    
    // Re-check profitability (prices may have changed)
    const currentProfitCheck = await this.contractManager.checkProfitability(
      this.prepareArbitrageData(opportunity, profitAnalysis),
      await this.web3Provider.provider.getGasPrice()
    );
    
    if (!currentProfitCheck.isProfitable) {
      throw new Error('Opportunity no longer profitable');
    }
    
    console.log('✅ Flashloan execution validation passed');
  }
  
  /**
   * Enhanced start method with flashloan capabilities
   */
  async start() {
    try {
      // Start Phase 2 engine
      await super.start();
      
      if (this.flashloanConfig.enabled) {
        console.log('🚀 Flashloan arbitrage monitoring: ACTIVE');
        
        // Start flashloan-specific monitoring loops
        this.startFlashloanMonitoring();
      }
      
    } catch (error) {
      console.error('❌ Failed to start enhanced arbitrage engine:', error.message);
      throw error;
    }
  }
  
  /**
   * Start flashloan-specific monitoring
   */
  startFlashloanMonitoring() {
    // Monitor flashloan opportunities
    setInterval(async () => {
      if (!this.isPaused && this.isRunning) {
        await this.processFlashloanOpportunities();
      }
    }, 2000); // Check every 2 seconds
    
    // Clean up old opportunities
    setInterval(() => {
      this.cleanupOldOpportunities();
    }, 60000); // Clean up every minute
  }
  
  /**
   * Process pending flashloan opportunities
   */
  async processFlashloanOpportunities() {
    try {
      const pendingOpportunities = Array.from(this.flashloanOpportunities.values())
        .filter(op => op.status === 'evaluated')
        .sort((a, b) => b.profitAnalysis.enhancedNetProfit - a.profitAnalysis.enhancedNetProfit)
        .slice(0, 3); // Process top 3 opportunities
      
      for (const opData of pendingOpportunities) {
        // Check if we're not already executing too many
        if (this.activeExecutions.size >= 2) {
          break; // Limit concurrent executions
        }
        
        // Re-evaluate opportunity
        const evaluation = await this.evaluateFlashloanOpportunity(opData.opportunity);
        
        if (evaluation.suitable) {
          // Execute if still suitable
          await this.executeFlashloanArbitrage(opData.opportunity.id);
        } else {
          // Remove if no longer suitable
          this.flashloanOpportunities.delete(opData.opportunity.id);
        }
      }
      
    } catch (error) {
      console.error('❌ Error processing flashloan opportunities:', error.message);
    }
  }
  
  /**
   * Clean up old opportunities and executions
   */
  cleanupOldOpportunities() {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes
    
    // Clean up old opportunities
    for (const [id, data] of this.flashloanOpportunities.entries()) {
      if (now - data.timestamp > maxAge) {
        this.flashloanOpportunities.delete(id);
      }
    }
    
    // Clean up completed executions
    for (const [id, data] of this.activeExecutions.entries()) {
      if (data.status === 'completed' || data.status === 'failed') {
        if (now - (data.endTime || data.startTime) > maxAge) {
          this.activeExecutions.delete(id);
        }
      }
    }
  }
  
  /**
   * Get enhanced metrics including flashloan performance
   */
  getEnhancedMetrics() {
    const baseMetrics = super.getMetrics();
    
    return {
      ...baseMetrics,
      phase3: {
        ...this.phase3Metrics,
        flashloanSuccessRate: this.phase3Metrics.flashloanExecutions > 0 
          ? (this.phase3Metrics.successfulFlashloans / this.phase3Metrics.flashloanExecutions) * 100 
          : 0,
        activeOpportunities: this.flashloanOpportunities.size,
        activeExecutions: this.activeExecutions.size,
        averageProfit: this.phase3Metrics.successfulFlashloans > 0
          ? this.phase3Metrics.totalFlashloanProfit / this.phase3Metrics.successfulFlashloans
          : 0
      }
    };
  }
  
  /**
   * Emergency stop all flashloan operations
   */
  async emergencyStopFlashloans() {
    try {
      console.log('🛑 Emergency stopping flashloan operations...');
      
      // Disable flashloan config
      this.flashloanConfig.enabled = false;
      
      // Activate contract emergency stop
      await this.contractManager.activateEmergencyStop();
      
      // Clear pending opportunities
      this.flashloanOpportunities.clear();
      
      console.log('✅ Flashloan emergency stop activated');
      
      this.emit('emergencyStopActivated', { timestamp: Date.now() });
      
    } catch (error) {
      console.error('❌ Error activating emergency stop:', error.message);
      throw error;
    }
  }
  
  /**
   * Helper methods
   */
  
  getRouterAddress(exchange) {
    const routers = {
      'uniswap-v2': config.UNISWAP_V2_ROUTER,
      'uniswap-v3': '0xE592427A0AEce92De3Edee1F18E0157C05861564', // V3 SwapRouter
      'sushiswap': '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F'
    };
    
    return routers[exchange] || config.UNISWAP_V2_ROUTER;
  }
  
  getPoolFee(exchange, tokenA, tokenB) {
    if (exchange.includes('v3')) {
      // Return common V3 fees - would be dynamically determined in production
      return 3000; // 0.3%
    }
    return 0; // V2 pools
  }
  
  async getActualProfit(txHash) {
    try {
      // Get profit from contract events - simplified
      return '0'; // Would parse from transaction logs
      
    } catch (error) {
      console.warn('Error getting actual profit:', error.message);
      return '0';
    }
  }
  
  updateAverageExecutionTime(executionTime) {
    const count = this.phase3Metrics.successfulFlashloans;
    const currentAvg = this.phase3Metrics.averageExecutionTime;
    
    this.phase3Metrics.averageExecutionTime = 
      (currentAvg * (count - 1) + executionTime) / count;
  }
}

module.exports = EnhancedCoreArbitrageEngine;