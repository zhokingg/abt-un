import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import config from '../config/config.js';

/**
 * Enhanced Mempool Monitoring for Comprehensive MEV Protection
 * Monitors pending transactions, detects MEV opportunities, and provides protection mechanisms
 */
class MempoolMonitor extends EventEmitter {
  constructor(web3Provider, options = {}) {
    super();
    this.web3Provider = web3Provider;
    this.provider = web3Provider?.provider;
    this.isMonitoring = false;
    
    this.options = {
      enableGasAnalysis: options.enableGasAnalysis !== false,
      enableMEVDetection: options.enableMEVDetection !== false,
      enableFlashbotIntegration: options.enableFlashbotIntegration !== false,
      maxPendingTxAge: options.maxPendingTxAge || 30000, // 30 seconds
      gasAnalysisInterval: options.gasAnalysisInterval || 5000, // 5 seconds
      mevProtectionThreshold: options.mevProtectionThreshold || 1000, // $1000 value threshold
      ...options
    };
    
    // Transaction filters for DEX interactions
    this.dexSignatures = new Map([
      // Uniswap V2 Router
      ['0x38ed1739', 'swapExactTokensForTokens'],
      ['0x8803dbee', 'swapTokensForExactTokens'],
      ['0x7ff36ab5', 'swapExactETHForTokens'],
      ['0x18cbafe5', 'swapTokensForExactETH'],
      ['0x02751cec', 'removeLiquidityETHWithPermit'],
      ['0x2195995c', 'removeLiquidityWithPermit'],
      
      // Uniswap V3 Router
      ['0x414bf389', 'exactInputSingle'],
      ['0xc04b8d59', 'exactInput'],
      ['0xdb3e2198', 'exactOutputSingle'],
      ['0x09b81346', 'exactOutput'],
      ['0x42712a67', 'exactInputSingle'],
      ['0x5ae401dc', 'multicall'],
      
      // Flash loan signatures
      ['0x1426f4c2', 'flashLoan'],
      ['0x5cffe9de', 'flashLoanSimple'],
      
      // Common DEX functions
      ['0xa9059cbb', 'transfer'],
      ['0x095ea7b3', 'approve'],
      ['0x23b872dd', 'transferFrom']
    ]);
    
    // Enhanced DEX contract monitoring
    this.dexContracts = new Set([
      config.UNISWAP_V2_ROUTER,
      config.UNISWAP_V3_QUOTER,
      '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Uniswap V3 Router
      '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', // Uniswap V3 Router 2
      '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F', // Sushiswap Router
      '0x1111111254EEB25477B68fb85Ed929f73A960582', // 1inch V4 Router
      '0xDEF1C0ded9bec7F1a1670819833240f027b25EfF', // 0x Exchange Proxy
      '0x216B4B4Ba9F3e719726886d34a177484278Bfcae', // Tokenlon
    ]);
    
    // Flash loan contract addresses
    this.flashLoanContracts = new Set([
      '0x398eC7346DcD622eDc5ae82352F02bE94C62d119', // Aave V3 Pool
      '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9', // Aave V2 LendingPool
      '0xBA12222222228d8Ba445958a75a0704d566BF2C8', // Balancer V2 Vault
    ]);
    
    // Enhanced opportunity scoring system
    this.opportunityQueue = [];
    this.maxQueueSize = 2000;
    this.opportunityScoring = {
      profitThreshold: 0.005, // 0.5% minimum profit
      gasEfficiencyWeight: 0.3,
      liquidityWeight: 0.4,
      timeDecayWeight: 0.3
    };
    
    // Advanced MEV detection patterns
    this.mevPatterns = {
      frontrun: new Map(), // txHash -> { target, gasPrice, timestamp }
      sandwich: new Map(), // poolAddress -> { frontTx, backTx, timestamp }
      arbitrage: new Set(),
      liquidation: new Map(),
      flashLoan: new Set()
    };
    
    // Gas analysis data
    this.gasAnalysis = {
      currentBaseFee: 0,
      priorityFeePercentiles: [0, 0, 0], // 25th, 50th, 75th percentiles
      congestionLevel: 'low',
      optimalGasPrice: 0,
      lastUpdate: null
    };
    
    // Pending transaction tracking
    this.pendingTransactions = new Map();
    this.transactionSimulations = new Map();
    
    // Private mempool connections (for advanced MEV protection)
    this.privateMempoolConnections = {
      flashbots: null,
      eden: null,
      bloXroute: null
    };
    
    // Enhanced performance metrics
    this.stats = {
      totalTransactions: 0,
      relevantTransactions: 0,
      opportunitiesDetected: 0,
      mevOpportunities: 0,
      sandwichAttacksDetected: 0,
      frontrunningAttempts: 0,
      flashLoanOpportunities: 0,
      gasAnalysisUpdates: 0,
      simulationSuccesses: 0,
      simulationFailures: 0,
      lastUpdate: null,
      averageProcessingTime: 0
    };
    
    this.processingTimes = [];
  }

  /**
   * Initialize the enhanced mempool monitor
   */
  async initialize() {
    try {
      console.log('🔧 Initializing Enhanced MempoolMonitor...');
      
      // Initialize gas analysis
      if (this.options.enableGasAnalysis) {
        await this.initializeGasAnalysis();
      }
      
      // Initialize private mempool connections
      if (this.options.enableFlashbotIntegration) {
        await this.initializePrivateMempools();
      }
      
      console.log('✅ Enhanced MempoolMonitor initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced MempoolMonitor:', error);
      throw error;
    }
  }
  
  /**
   * Initialize gas analysis system
   */
  async initializeGasAnalysis() {
    try {
      // Get initial gas data
      await this.updateGasAnalysis();
      
      // Set up periodic gas analysis updates
      setInterval(() => {
        this.updateGasAnalysis().catch(console.error);
      }, this.options.gasAnalysisInterval);
      
      console.log('⛽ Gas analysis system initialized');
    } catch (error) {
      console.error('Failed to initialize gas analysis:', error);
    }
  }
  
  /**
   * Initialize private mempool connections
   */
  async initializePrivateMempools() {
    try {
      // Flashbots connection would be initialized here
      // this.privateMempoolConnections.flashbots = await setupFlashbots();
      
      console.log('🔐 Private mempool connections initialized');
    } catch (error) {
      console.error('Failed to initialize private mempools:', error);
    }
  }
  
  /**
   * Update gas analysis data
   */
  async updateGasAnalysis() {
    try {
      const startTime = Date.now();
      
      // Get latest block
      const latestBlock = await this.provider.getBlock('latest', true);
      if (!latestBlock || !latestBlock.transactions.length) return;
      
      // Extract gas prices from recent transactions
      const gasPrices = latestBlock.transactions
        .map(tx => ({
          gasPrice: tx.gasPrice ? parseInt(tx.gasPrice) : 0,
          maxFeePerGas: tx.maxFeePerGas ? parseInt(tx.maxFeePerGas) : 0,
          maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? parseInt(tx.maxPriorityFeePerGas) : 0
        }))
        .filter(gas => gas.gasPrice > 0 || gas.maxFeePerGas > 0);
      
      if (gasPrices.length === 0) return;
      
      // Calculate gas statistics
      const baseFee = latestBlock.baseFeePerGas ? parseInt(latestBlock.baseFeePerGas) : 0;
      const priorityFees = gasPrices
        .map(g => g.maxPriorityFeePerGas || Math.max(0, g.gasPrice - baseFee))
        .filter(fee => fee > 0)
        .sort((a, b) => a - b);
      
      // Calculate percentiles
      this.gasAnalysis = {
        currentBaseFee: baseFee,
        priorityFeePercentiles: [
          priorityFees[Math.floor(priorityFees.length * 0.25)] || 0,
          priorityFees[Math.floor(priorityFees.length * 0.5)] || 0,
          priorityFees[Math.floor(priorityFees.length * 0.75)] || 0
        ],
        congestionLevel: this.calculateCongestionLevel(priorityFees),
        optimalGasPrice: baseFee + this.gasAnalysis.priorityFeePercentiles[1],
        lastUpdate: Date.now(),
        processingTime: Date.now() - startTime
      };
      
      this.stats.gasAnalysisUpdates++;
      
      this.emit('gasAnalysisUpdated', this.gasAnalysis);
      
    } catch (error) {
      console.error('Error updating gas analysis:', error);
    }
  }
  
  /**
   * Calculate network congestion level
   */
  calculateCongestionLevel(priorityFees) {
    if (priorityFees.length === 0) return 'low';
    
    const medianFee = priorityFees[Math.floor(priorityFees.length * 0.5)];
    const avgFee = priorityFees.reduce((sum, fee) => sum + fee, 0) / priorityFees.length;
    
    // Convert to gwei for comparison
    const medianGwei = medianFee / 1e9;
    const avgGwei = avgFee / 1e9;
    
    if (medianGwei > 50 || avgGwei > 60) return 'high';
    if (medianGwei > 20 || avgGwei > 25) return 'medium';
    return 'low';
  }
  
  /**
   * Simulate transaction execution
   */
  async simulateTransaction(tx) {
    try {
      const startTime = Date.now();
      
      // Create call data for simulation
      const callData = {
        to: tx.to,
        data: tx.data,
        value: tx.value || '0x0',
        from: tx.from || ethers.ZeroAddress,
        gasLimit: tx.gasLimit || '0x5f5e100' // 100M gas limit for simulation
      };
      
      // Simulate the call
      const result = await this.provider.call(callData, 'latest');
      
      const simulation = {
        success: true,
        result,
        gasUsed: tx.gasLimit,
        processingTime: Date.now() - startTime,
        timestamp: Date.now()
      };
      
      this.transactionSimulations.set(tx.hash, simulation);
      this.stats.simulationSuccesses++;
      
      return simulation;
      
    } catch (error) {
      const simulation = {
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime,
        timestamp: Date.now()
      };
      
      this.transactionSimulations.set(tx.hash, simulation);
      this.stats.simulationFailures++;
      
      return simulation;
    }
  }
  
  /**
   * Detect advanced MEV patterns
   */
  async detectAdvancedMEVPatterns(tx, analysis) {
    // Detect sandwich attacks
    await this.detectSandwichAttacks(tx, analysis);
    
    // Detect front-running attempts
    await this.detectFrontRunning(tx, analysis);
    
    // Detect flash loan opportunities
    await this.detectFlashLoanOpportunities(tx, analysis);
    
    // Detect liquidation opportunities
    await this.detectLiquidationOpportunities(tx, analysis);
  }
  
  /**
   * Detect sandwich attacks
   */
  async detectSandwichAttacks(tx, analysis) {
    if (!analysis.isSwap) return;
    
    const poolAddress = analysis.poolAddress;
    if (!poolAddress) return;
    
    // Check if there's already a front transaction for this pool
    const existingSandwich = this.mevPatterns.sandwich.get(poolAddress);
    
    if (existingSandwich && Date.now() - existingSandwich.timestamp < 30000) {
      // Potential back-run transaction
      this.mevPatterns.sandwich.set(poolAddress, {
        ...existingSandwich,
        backTx: tx,
        completed: true,
        backTimestamp: Date.now()
      });
      
      this.stats.sandwichAttacksDetected++;
      
      this.emit('sandwichAttackDetected', {
        poolAddress,
        frontTx: existingSandwich.frontTx,
        backTx: tx,
        targetTx: existingSandwich.targetTx,
        estimatedProfit: this.calculateSandwichProfit(existingSandwich, tx),
        timestamp: Date.now()
      });
      
    } else if (analysis.largeSwap && analysis.priceImpact > 0.01) {
      // Potential front-run transaction
      this.mevPatterns.sandwich.set(poolAddress, {
        frontTx: tx,
        targetTx: analysis.targetTransaction,
        timestamp: Date.now(),
        completed: false
      });
    }
  }
  
  /**
   * Detect front-running attempts
   */
  async detectFrontRunning(tx, analysis) {
    if (!analysis.isSwap) return;
    
    const gasPrice = tx.gasPrice || tx.maxFeePerGas;
    if (!gasPrice) return;
    
    // Check for unusually high gas prices (potential front-running)
    const avgGasPrice = this.gasAnalysis.optimalGasPrice || 0;
    const gasPremium = (parseInt(gasPrice) - avgGasPrice) / avgGasPrice;
    
    if (gasPremium > 0.5) { // 50% above average
      this.mevPatterns.frontrun.set(tx.hash, {
        tx,
        gasPrice: parseInt(gasPrice),
        gasPremium,
        timestamp: Date.now(),
        suspicionLevel: gasPremium > 2 ? 'high' : 'medium'
      });
      
      this.stats.frontrunningAttempts++;
      
      this.emit('frontRunningDetected', {
        transaction: tx,
        gasPrice: parseInt(gasPrice),
        gasPremium,
        avgGasPrice,
        suspicionLevel: gasPremium > 2 ? 'high' : 'medium',
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Detect flash loan opportunities
   */
  async detectFlashLoanOpportunities(tx, analysis) {
    // Check if transaction interacts with flash loan contracts
    const isFlashLoan = this.flashLoanContracts.has(tx.to) || 
                       (tx.data && tx.data.startsWith('0x1426f4c2')); // flashLoan signature
    
    if (isFlashLoan) {
      this.mevPatterns.flashLoan.add(tx.hash);
      this.stats.flashLoanOpportunities++;
      
      this.emit('flashLoanOpportunityDetected', {
        transaction: tx,
        analysis,
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Detect liquidation opportunities
   */
  async detectLiquidationOpportunities(tx, analysis) {
    // Look for transactions that might trigger liquidations
    if (analysis.defiProtocol && (analysis.isLending || analysis.isBorrowing)) {
      const liquidationRisk = await this.assessLiquidationRisk(tx, analysis);
      
      if (liquidationRisk.isHighRisk) {
        this.mevPatterns.liquidation.set(tx.hash, {
          tx,
          risk: liquidationRisk,
          timestamp: Date.now()
        });
        
        this.emit('liquidationOpportunityDetected', {
          transaction: tx,
          liquidationRisk,
          timestamp: Date.now()
        });
      }
    }
  }
  
  /**
   * Assess liquidation risk for DeFi transactions
   */
  async assessLiquidationRisk(tx, analysis) {
    // Simplified liquidation risk assessment
    return {
      isHighRisk: false,
      riskScore: 0,
      reason: 'assessment_not_implemented'
    };
  }
  
  /**
   * Calculate estimated profit from sandwich attack
   */
  calculateSandwichProfit(sandwich, backTx) {
    // Simplified profit calculation
    // In reality, this would require complex analysis of the swap amounts and pool states
    return {
      estimatedProfit: 0,
      confidence: 0.5,
      method: 'simplified'
    };
  }
  
  /**
   * Enhanced opportunity scoring
   */
  scoreOpportunity(analysis) {
    let score = 0;
    const weights = this.opportunityScoring;
    
    // Base profit score
    if (analysis.profitPercentage) {
      score += Math.min(analysis.profitPercentage * 20, 50); // Max 50 points for profit
    }
    
    // Gas efficiency score
    if (analysis.gasEfficiency) {
      score += analysis.gasEfficiency * weights.gasEfficiencyWeight * 30;
    }
    
    // Liquidity score
    if (analysis.liquidity) {
      score += Math.min(analysis.liquidity / 1000000, 1) * weights.liquidityWeight * 30; // $1M = max score
    }
    
    // Time decay (fresher opportunities score higher)
    const age = Date.now() - analysis.timestamp;
    const timeDecay = Math.max(0, 1 - age / 30000); // 30 second decay
    score *= (1 + timeDecay * weights.timeDecayWeight);
    
    // MEV protection bonus
    if (analysis.mevProtected) {
      score *= 1.2;
    }
    
    return Math.min(score, 100);
  }
  
  /**
   * Submit transaction to private mempool
   */
  async submitToPrivateMempool(txData, provider = 'flashbots') {
    try {
      if (!this.privateMempoolConnections[provider]) {
        throw new Error(`Private mempool ${provider} not connected`);
      }
      
      // Implementation would depend on the specific private mempool
      console.log(`📦 Submitting transaction to ${provider} private mempool`);
      
      this.emit('privateMempoolSubmission', {
        provider,
        txHash: txData.hash,
        timestamp: Date.now()
      });
      
      return { success: true, provider };
      
    } catch (error) {
      console.error(`Failed to submit to private mempool ${provider}:`, error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Start mempool monitoring
   */
  async startMonitoring() {
    console.log('🕵️ Starting enhanced mempool monitoring...');
    
    if (!this.provider) {
      throw new Error('Web3 provider not available');
    }
    
    try {
      this.isMonitoring = true;
      
      // Initialize components
      await this.initialize();
      
      // Listen for pending transactions
      this.provider.on('pending', async (txHash) => {
        if (this.isMonitoring) {
          await this.processPendingTransaction(txHash);
        }
      });
      
      // Start opportunity processing
      this.startOpportunityProcessing();
      
      // Start cleanup routine
      this.startCleanupRoutine();
      
      console.log('✅ Enhanced mempool monitoring started');
      
    } catch (error) {
      console.error('❌ Failed to start mempool monitoring:', error.message);
      throw error;
    }
  }

  /**
   * Enhanced process pending transaction for opportunities
   */
  async processPendingTransaction(txHash) {
    const startTime = Date.now();
    
    try {
      this.stats.totalTransactions++;
      
      // Get transaction details with timeout
      const tx = await Promise.race([
        this.provider.getTransaction(txHash),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction fetch timeout')), 3000)
        )
      ]);
      
      if (!tx || !tx.to) return;
      
      // Store pending transaction
      this.pendingTransactions.set(txHash, {
        tx,
        timestamp: Date.now(),
        processed: false
      });
      
      // Filter for relevant transactions
      if (!this.isRelevantTransaction(tx)) return;
      
      this.stats.relevantTransactions++;
      
      // Enhanced transaction analysis
      const analysis = await this.enhancedAnalyzeTransaction(tx);
      
      if (analysis.hasOpportunity) {
        this.stats.opportunitiesDetected++;
        
        // Score the opportunity
        analysis.score = this.scoreOpportunity(analysis);
        
        // Add to priority queue
        this.addPriorityOpportunity(analysis);
        
        // Emit opportunity detected event
        this.emit('opportunityDetected', analysis);
      }
      
      // Advanced MEV pattern detection
      if (this.options.enableMEVDetection) {
        await this.detectAdvancedMEVPatterns(tx, analysis);
      }
      
      // Transaction simulation if enabled
      if (analysis.shouldSimulate) {
        await this.simulateTransaction(tx);
      }
      
      // Mark as processed
      const pendingTx = this.pendingTransactions.get(txHash);
      if (pendingTx) {
        pendingTx.processed = true;
        pendingTx.analysis = analysis;
      }
      
    } catch (error) {
      // Handle errors gracefully (many pending tx requests will fail)
      if (!error.message.includes('transaction not found') && 
          !error.message.includes('timeout')) {
        console.error(`❌ Error processing pending tx ${txHash}:`, error.message);
      }
    } finally {
      // Track processing time
      const processingTime = Date.now() - startTime;
      this.processingTimes.push(processingTime);
      
      // Keep only last 1000 processing times
      if (this.processingTimes.length > 1000) {
        this.processingTimes.shift();
      }
      
      // Update average processing time
      this.stats.averageProcessingTime = 
        this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
    }
  }

  /**
   * Enhanced transaction relevance check
   */
  isRelevantTransaction(tx) {
    // Check if it's a DEX transaction
    if (this.isDEXTransaction(tx)) return true;
    
    // Check if it's a flash loan transaction
    if (this.isFlashLoanTransaction(tx)) return true;
    
    // Check if it's a DeFi protocol transaction
    if (this.isDeFiTransaction(tx)) return true;
    
    // Check if it has high value
    if (tx.value && parseInt(tx.value) > ethers.parseEther('1')) return true;
    
    return false;
  }

  /**
   * Check if transaction is a flash loan
   */
  isFlashLoanTransaction(tx) {
    return this.flashLoanContracts.has(tx.to) ||
           (tx.data && (
             tx.data.startsWith('0x1426f4c2') || // flashLoan
             tx.data.startsWith('0x5cffe9de')    // flashLoanSimple
           ));
  }

  /**
   * Check if transaction is DeFi related
   */
  isDeFiTransaction(tx) {
    // Add known DeFi protocol addresses
    const defiProtocols = new Set([
      '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9', // Aave V2
      '0x398eC7346DcD622eDc5ae82352F02bE94C62d119', // Aave V3
      '0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B', // Compound
      '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB', // Maker
    ]);
    
    return defiProtocols.has(tx.to);
  }

  /**
   * Enhanced transaction analysis
   */
  async enhancedAnalyzeTransaction(tx) {
    const analysis = {
      txHash: tx.hash,
      timestamp: Date.now(),
      hasOpportunity: false,
      shouldSimulate: false,
      mevRisk: 'low',
      gasEfficiency: 0,
      estimatedValue: 0
    };
    
    try {
      // Basic transaction categorization
      analysis.isDEX = this.isDEXTransaction(tx);
      analysis.isFlashLoan = this.isFlashLoanTransaction(tx);
      analysis.isDeFi = this.isDeFiTransaction(tx);
      
      // Decode transaction data if possible
      if (tx.data && tx.data.length > 10) {
        const methodId = tx.data.slice(0, 10);
        analysis.method = this.dexSignatures.get(methodId) || 'unknown';
        analysis.decodedData = await this.decodeTransactionData(tx);
      }
      
      // Gas analysis
      analysis.gasPrice = tx.gasPrice || tx.maxFeePerGas;
      analysis.gasLimit = tx.gasLimit;
      analysis.gasEfficiency = this.calculateGasEfficiency(tx);
      
      // Value analysis
      analysis.ethValue = tx.value ? parseFloat(ethers.formatEther(tx.value)) : 0;
      analysis.estimatedValue = await this.estimateTransactionValue(tx);
      
      // MEV risk assessment
      analysis.mevRisk = this.assessMEVRisk(tx, analysis);
      
      // Determine if this creates an opportunity
      analysis.hasOpportunity = this.detectOpportunityFromTransaction(tx, analysis);
      
      // Determine if simulation is needed
      analysis.shouldSimulate = analysis.hasOpportunity || 
                               analysis.estimatedValue > this.options.mevProtectionThreshold;
      
      return analysis;
      
    } catch (error) {
      console.error('Error in enhanced transaction analysis:', error);
      return analysis;
    }
  }

  /**
   * Decode transaction data
   */
  async decodeTransactionData(tx) {
    try {
      // This would implement actual ABI decoding
      // For now, return basic structure
      return {
        method: this.dexSignatures.get(tx.data.slice(0, 10)),
        parameters: []
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Calculate gas efficiency score
   */
  calculateGasEfficiency(tx) {
    const gasPrice = parseInt(tx.gasPrice || tx.maxFeePerGas || 0);
    const gasLimit = parseInt(tx.gasLimit || 0);
    
    if (gasPrice === 0 || gasLimit === 0) return 0;
    
    const optimalGas = this.gasAnalysis.optimalGasPrice || gasPrice;
    const efficiency = Math.max(0, 1 - Math.abs(gasPrice - optimalGas) / optimalGas);
    
    return efficiency;
  }

  /**
   * Estimate transaction value
   */
  async estimateTransactionValue(tx) {
    // Basic value estimation
    let value = tx.value ? parseFloat(ethers.formatEther(tx.value)) : 0;
    
    // Add estimated value from DEX swaps (simplified)
    if (this.isDEXTransaction(tx)) {
      value += 1000; // Assume $1000 average swap value
    }
    
    return value;
  }

  /**
   * Assess MEV risk level
   */
  assessMEVRisk(tx, analysis) {
    let riskScore = 0;
    
    // High value transactions are higher risk
    if (analysis.estimatedValue > 10000) riskScore += 3;
    else if (analysis.estimatedValue > 1000) riskScore += 2;
    else if (analysis.estimatedValue > 100) riskScore += 1;
    
    // DEX transactions have inherent MEV risk
    if (analysis.isDEX) riskScore += 2;
    
    // Flash loans are high MEV risk
    if (analysis.isFlashLoan) riskScore += 4;
    
    // High gas price indicates urgency/competition
    const gasPrice = parseInt(tx.gasPrice || tx.maxFeePerGas || 0);
    const optimalGas = this.gasAnalysis.optimalGasPrice || gasPrice;
    if (gasPrice > optimalGas * 1.5) riskScore += 2;
    if (gasPrice > optimalGas * 2) riskScore += 1;
    
    if (riskScore >= 6) return 'high';
    if (riskScore >= 3) return 'medium';
    return 'low';
  }

  /**
   * Detect opportunity from transaction
   */
  detectOpportunityFromTransaction(tx, analysis) {
    // Large DEX swaps can create arbitrage opportunities
    if (analysis.isDEX && analysis.estimatedValue > 5000) {
      return true;
    }
    
    // Flash loan transactions often indicate MEV opportunities
    if (analysis.isFlashLoan) {
      return true;
    }
    
    // High value transactions with competitive gas pricing
    if (analysis.estimatedValue > 10000 && analysis.mevRisk === 'high') {
      return true;
    }
    
    return false;
  }

  /**
   * Add opportunity to priority queue
   */
  addPriorityOpportunity(analysis) {
    // Remove old opportunities if queue is full
    if (this.opportunityQueue.length >= this.maxQueueSize) {
      this.opportunityQueue.sort((a, b) => b.score - a.score);
      this.opportunityQueue = this.opportunityQueue.slice(0, this.maxQueueSize - 1);
    }
    
    this.opportunityQueue.push(analysis);
    
    // Sort by score (highest first)
    this.opportunityQueue.sort((a, b) => b.score - a.score);
  }

  /**
   * Start cleanup routine for old data
   */
  startCleanupRoutine() {
    setInterval(() => {
      this.cleanupOldData();
    }, 60000); // Clean up every minute
  }

  /**
   * Clean up old data
   */
  cleanupOldData() {
    const now = Date.now();
    const maxAge = this.options.maxPendingTxAge * 2; // Double the max age for cleanup
    
    // Clean pending transactions
    for (const [txHash, data] of this.pendingTransactions) {
      if (now - data.timestamp > maxAge) {
        this.pendingTransactions.delete(txHash);
      }
    }
    
    // Clean transaction simulations
    for (const [txHash, simulation] of this.transactionSimulations) {
      if (now - simulation.timestamp > maxAge) {
        this.transactionSimulations.delete(txHash);
      }
    }
    
    // Clean MEV patterns
    for (const [poolAddress, sandwich] of this.mevPatterns.sandwich) {
      if (now - sandwich.timestamp > maxAge) {
        this.mevPatterns.sandwich.delete(poolAddress);
      }
    }
    
    for (const [txHash, frontrun] of this.mevPatterns.frontrun) {
      if (now - frontrun.timestamp > maxAge) {
        this.mevPatterns.frontrun.delete(txHash);
      }
    }
    
    // Clean opportunity queue
    this.opportunityQueue = this.opportunityQueue.filter(
      opp => now - opp.timestamp < this.options.maxPendingTxAge
    );
    
    console.log(`🧹 Cleaned up old mempool data. Pending TXs: ${this.pendingTransactions.size}`);
  }
  }

  /**
   * Check if transaction is DEX-related
   */
  isDEXTransaction(tx) {
    // Check if transaction is to a known DEX contract
    if (this.dexContracts.has(tx.to.toLowerCase())) {
      return true;
    }
    
    // Check if transaction data matches DEX function signatures
    if (tx.data && tx.data.length >= 10) {
      const signature = tx.data.slice(0, 10).toLowerCase();
      return this.dexSignatures.has(signature);
    }
    
    return false;
  }

  /**
   * Analyze transaction for arbitrage opportunities
   */
  async analyzeTransaction(tx) {
    const analysis = {
      txHash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.value,
      gasPrice: tx.gasPrice,
      gasLimit: tx.gasLimit,
      timestamp: Date.now(),
      hasOpportunity: false,
      opportunityType: null,
      tokens: [],
      estimatedValue: 0,
      priority: 0
    };
    
    try {
      // Decode transaction data
      const decodedData = await this.decodeTransactionData(tx);
      
      if (decodedData) {
        analysis.decodedData = decodedData;
        analysis.tokens = this.extractTokens(decodedData);
        
        // Check for arbitrage opportunity
        const arbitrageOpportunity = await this.checkArbitrageOpportunity(analysis);
        
        if (arbitrageOpportunity) {
          analysis.hasOpportunity = true;
          analysis.opportunityType = 'arbitrage';
          analysis.estimatedValue = arbitrageOpportunity.value;
          analysis.priority = this.calculatePriority(arbitrageOpportunity);
          analysis.opportunity = arbitrageOpportunity;
        }
      }
      
    } catch (error) {
      console.error('Error analyzing transaction:', error.message);
    }
    
    return analysis;
  }

  /**
   * Decode transaction data to extract swap information
   */
  async decodeTransactionData(tx) {
    if (!tx.data || tx.data.length < 10) return null;
    
    const signature = tx.data.slice(0, 10).toLowerCase();
    const functionName = this.dexSignatures.get(signature);
    
    if (!functionName) return null;
    
    try {
      // Simplified decoding - in production, use proper ABI decoding
      return {
        signature,
        functionName,
        data: tx.data,
        // Add more sophisticated decoding here
        estimatedTokens: this.extractTokensFromData(tx.data),
        estimatedAmount: this.extractAmountFromData(tx.data)
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract token addresses from transaction data
   */
  extractTokensFromData(data) {
    const tokens = [];
    
    // Simple pattern matching for token addresses (0x followed by 40 hex chars)
    const tokenPattern = /0x[a-fA-F0-9]{40}/g;
    const matches = data.match(tokenPattern);
    
    if (matches) {
      // Filter for known token addresses
      matches.forEach(address => {
        const lowerAddress = address.toLowerCase();
        if (this.isKnownToken(lowerAddress)) {
          tokens.push(lowerAddress);
        }
      });
    }
    
    return [...new Set(tokens)]; // Remove duplicates
  }

  /**
   * Extract amount from transaction data (simplified)
   */
  extractAmountFromData(data) {
    // This is a simplified extraction - in production, use proper ABI decoding
    try {
      if (data.length >= 74) {
        const amountHex = data.slice(10, 74); // Skip function selector
        return ethers.getBigInt('0x' + amountHex);
      }
    } catch (error) {
      // Ignore errors in simplified parsing
    }
    return BigInt(0);
  }

  /**
   * Check if address is a known token
   */
  isKnownToken(address) {
    const knownTokens = Object.values(config.TOKENS).map(addr => addr.toLowerCase());
    return knownTokens.includes(address);
  }

  /**
   * Extract token information from decoded data
   */
  extractTokens(decodedData) {
    return decodedData.estimatedTokens || [];
  }

  /**
   * Check for arbitrage opportunity based on transaction analysis
   */
  async checkArbitrageOpportunity(analysis) {
    if (!analysis.tokens || analysis.tokens.length < 2) {
      return null;
    }
    
    try {
      // Look for potential arbitrage between the tokens being swapped
      const [tokenA, tokenB] = analysis.tokens;
      
      // This would integrate with price monitoring to check current spreads
      const opportunity = {
        tokenA,
        tokenB,
        triggeredBy: analysis.txHash,
        detectedAt: Date.now(),
        value: Math.random() * 100 + 10, // Mock value $10-110
        confidence: this.calculateConfidence(analysis),
        type: 'mempool_triggered'
      };
      
      // Only return if confidence is high enough
      return opportunity.confidence > 0.7 ? opportunity : null;
      
    } catch (error) {
      console.error('Error checking arbitrage opportunity:', error.message);
      return null;
    }
  }

  /**
   * Calculate confidence score for opportunity
   */
  calculateConfidence(analysis) {
    let confidence = 0.5; // Base confidence
    
    // Higher gas price suggests urgency/profitability
    if (analysis.gasPrice) {
      const gasPriceGwei = parseFloat(ethers.formatUnits(analysis.gasPrice, 'gwei'));
      if (gasPriceGwei > 50) confidence += 0.2;
      else if (gasPriceGwei > 30) confidence += 0.1;
    }
    
    // Known high-value tokens increase confidence
    const highValueTokens = [
      config.TOKENS.WETH,
      config.TOKENS.USDC,
      config.TOKENS.USDT
    ].map(addr => addr.toLowerCase());
    
    const hasHighValueToken = analysis.tokens.some(token => 
      highValueTokens.includes(token.toLowerCase())
    );
    
    if (hasHighValueToken) confidence += 0.15;
    
    // Large transaction amounts increase confidence
    if (analysis.decodedData?.estimatedAmount) {
      const amount = analysis.decodedData.estimatedAmount;
      if (amount > ethers.parseEther('10')) confidence += 0.1;
      if (amount > ethers.parseEther('100')) confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate priority score for opportunity
   */
  calculatePriority(opportunity) {
    let priority = 0;
    
    // Value-based priority
    priority += Math.min(opportunity.value / 10, 50); // Up to 50 points for value
    
    // Confidence-based priority
    priority += opportunity.confidence * 30; // Up to 30 points for confidence
    
    // Time decay (newer opportunities get higher priority)
    const age = Date.now() - opportunity.detectedAt;
    const timeDecay = Math.max(0, 20 - (age / 1000)); // Decay over 20 seconds
    priority += timeDecay;
    
    return Math.round(priority);
  }

  /**
   * Add opportunity to priority queue
   */
  addOpportunity(analysis) {
    if (!analysis.hasOpportunity) return;
    
    // Add to queue with priority sorting
    this.opportunityQueue.push(analysis);
    
    // Sort by priority (highest first)
    this.opportunityQueue.sort((a, b) => b.priority - a.priority);
    
    // Maintain queue size
    if (this.opportunityQueue.length > this.maxQueueSize) {
      this.opportunityQueue = this.opportunityQueue.slice(0, this.maxQueueSize);
    }
  }

  /**
   * Detect MEV patterns (front-running, sandwich attacks)
   */
  async detectMEVPatterns(tx, analysis) {
    const gasPrice = tx.gasPrice ? parseFloat(ethers.formatUnits(tx.gasPrice, 'gwei')) : 0;
    
    // Detect potential front-running (high gas price transactions)
    if (gasPrice > 100) { // Very high gas price
      this.mevPatterns.frontrun.add(tx.hash);
      this.stats.mevOpportunities++;
      
      this.emit('mevDetected', {
        type: 'frontrun',
        txHash: tx.hash,
        gasPrice,
        analysis
      });
    }
    
    // Detect potential sandwich attacks (similar tokens, timing)
    if (analysis.tokens.length > 0) {
      const tokenKey = analysis.tokens.sort().join('-');
      const now = Date.now();
      
      if (!this.mevPatterns.sandwich.has(tokenKey)) {
        this.mevPatterns.sandwich.set(tokenKey, []);
      }
      
      const recentTxs = this.mevPatterns.sandwich.get(tokenKey);
      recentTxs.push({ hash: tx.hash, timestamp: now, gasPrice });
      
      // Clean old transactions (older than 30 seconds)
      const cutoff = now - 30000;
      const filtered = recentTxs.filter(tx => tx.timestamp > cutoff);
      this.mevPatterns.sandwich.set(tokenKey, filtered);
      
      // Detect sandwich pattern (3+ transactions in short time)
      if (filtered.length >= 3) {
        this.stats.mevOpportunities++;
        
        this.emit('mevDetected', {
          type: 'sandwich',
          tokenKey,
          transactions: filtered,
          analysis
        });
      }
    }
  }

  /**
   * Start opportunity processing loop
   */
  startOpportunityProcessing() {
    setInterval(() => {
      if (this.isMonitoring && this.opportunityQueue.length > 0) {
        this.processOpportunityQueue();
      }
    }, 1000); // Process every second
  }

  /**
   * Process high-priority opportunities from queue
   */
  processOpportunityQueue() {
    const now = Date.now();
    const maxAge = 30000; // 30 seconds
    
    // Remove expired opportunities
    this.opportunityQueue = this.opportunityQueue.filter(
      op => (now - op.timestamp) < maxAge
    );
    
    // Process top opportunities
    const topOpportunities = this.opportunityQueue.slice(0, 5);
    
    topOpportunities.forEach(opportunity => {
      this.emit('highPriorityOpportunity', opportunity);
    });
    
    // Update stats
    this.stats.lastUpdate = now;
    }

  /**
   * Check if transaction is DEX-related
   */
  isDEXTransaction(tx) {
    if (!tx.to || !tx.data) return false;
    
    // Check if contract address is a known DEX
    if (this.dexContracts.has(tx.to)) return true;
    
    // Check if method signature is a DEX function
    const methodId = tx.data.slice(0, 10);
    return this.dexSignatures.has(methodId);
  }

  /**
   * Analyze transaction for opportunities (legacy method)
   */
  async analyzeTransaction(tx) {
    // Delegate to enhanced analysis
    return await this.enhancedAnalyzeTransaction(tx);
  }

  /**
   * Add opportunity to queue (legacy method)
   */
  addOpportunity(analysis) {
    this.addPriorityOpportunity(analysis);
  }

  /**
   * Detect MEV patterns (legacy method)
   */
  async detectMEVPatterns(tx, analysis) {
    if (this.options.enableMEVDetection) {
      await this.detectAdvancedMEVPatterns(tx, analysis);
    }
  }

  /**
   * Start opportunity processing loop
   */
  startOpportunityProcessing() {
    // Process high-priority opportunities every 100ms
    setInterval(() => {
      this.processOpportunityQueue();
    }, 100);
    
    console.log('🔄 Opportunity processing started');
  }

  /**
   * Process high-priority opportunities from queue
   */
  processOpportunityQueue() {
    const now = Date.now();
    const freshOpportunities = this.opportunityQueue.filter(
      op => (now - op.timestamp) < this.options.maxPendingTxAge
    );
    
    // Update queue with fresh opportunities
    this.opportunityQueue = freshOpportunities;
    
    // Process top 5 opportunities
    const topOpportunities = this.getTopOpportunities(5);
    
    for (const opportunity of topOpportunities) {
      this.emit('processOpportunity', opportunity);
    }
  }

  /**
   * Get optimal gas price for opportunity execution
   */
  getOptimalGasPrice(priority = 'medium') {
    const { currentBaseFee, priorityFeePercentiles } = this.gasAnalysis;
    
    let priorityFee;
    switch (priority) {
      case 'low':
        priorityFee = priorityFeePercentiles[0] || ethers.parseUnits('1', 9); // 1 gwei
        break;
      case 'high':
        priorityFee = priorityFeePercentiles[2] || ethers.parseUnits('3', 9); // 3 gwei
        break;
      default:
        priorityFee = priorityFeePercentiles[1] || ethers.parseUnits('2', 9); // 2 gwei
    }
    
    return {
      maxFeePerGas: currentBaseFee + priorityFee,
      maxPriorityFeePerGas: priorityFee,
      gasPrice: currentBaseFee + priorityFee // For legacy transactions
    };
  }

  /**
   * Get MEV protection recommendations
   */
  getMEVProtectionRecommendations(analysis) {
    const recommendations = {
      usePrivateMempool: false,
      optimalGasPrice: this.getOptimalGasPrice('medium'),
      protectionLevel: 'basic',
      flashbotsRecommended: false
    };
    
    // High-value transactions should use private mempool
    if (analysis.estimatedValue > this.options.mevProtectionThreshold) {
      recommendations.usePrivateMempool = true;
      recommendations.protectionLevel = 'advanced';
    }
    
    // High MEV risk transactions should use Flashbots
    if (analysis.mevRisk === 'high') {
      recommendations.flashbotsRecommended = true;
      recommendations.protectionLevel = 'maximum';
      recommendations.optimalGasPrice = this.getOptimalGasPrice('high');
    }
    
    return recommendations;
  }

  /**
   * Get network congestion status
   */
  getNetworkStatus() {
    return {
      congestionLevel: this.gasAnalysis.congestionLevel,
      baseFee: this.gasAnalysis.currentBaseFee,
      optimalGasPrice: this.gasAnalysis.optimalGasPrice,
      lastUpdate: this.gasAnalysis.lastUpdate,
      recommendations: this.getTrafficRecommendations()
    };
  }

  /**
   * Get traffic-based recommendations
   */
  getTrafficRecommendations() {
    const { congestionLevel } = this.gasAnalysis;
    
    switch (congestionLevel) {
      case 'high':
        return {
          action: 'delay_non_critical',
          message: 'Network congestion is high. Consider delaying non-critical transactions.',
          waitTime: '5-10 minutes'
        };
      case 'medium':
        return {
          action: 'proceed_with_caution',
          message: 'Network congestion is moderate. Use optimal gas pricing.',
          waitTime: '2-5 minutes'
        };
      default:
        return {
          action: 'proceed_normally',
          message: 'Network congestion is low. Good time for transactions.',
          waitTime: '1-2 minutes'
        };
    }
  }

  /**
   * Get detailed analytics
   */
  getAnalytics() {
    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    
    return {
      performance: {
        ...this.stats,
        successRate: this.stats.totalTransactions > 0 ? 
          (this.stats.relevantTransactions / this.stats.totalTransactions * 100).toFixed(2) + '%' : '0%',
        opportunityRate: this.stats.relevantTransactions > 0 ?
          (this.stats.opportunitiesDetected / this.stats.relevantTransactions * 100).toFixed(2) + '%' : '0%'
      },
      gasAnalysis: this.gasAnalysis,
      mevProtection: {
        patternsDetected: {
          sandwich: this.mevPatterns.sandwich.size,
          frontrun: this.mevPatterns.frontrun.size,
          flashLoan: this.mevPatterns.flashLoan.size,
          liquidation: this.mevPatterns.liquidation.size
        },
        protectionActive: this.options.enableMEVDetection,
        privateMempoolConnected: Object.values(this.privateMempoolConnections)
          .some(conn => conn !== null)
      },
      queueStatus: {
        currentSize: this.opportunityQueue.length,
        maxSize: this.maxQueueSize,
        averageScore: this.opportunityQueue.length > 0 ?
          this.opportunityQueue.reduce((sum, op) => sum + op.score, 0) / this.opportunityQueue.length : 0
      }
    };
  }

  /**
   * Get top opportunities from queue
   */
  getTopOpportunities(limit = 10) {
    return this.opportunityQueue
      .slice(0, limit)
      .filter(op => (Date.now() - op.timestamp) < 60000); // Last minute only
  }

  /**
   * Get monitoring statistics
   */
  getStats() {
    return {
      ...this.stats,
      queueSize: this.opportunityQueue.length,
      pendingTransactions: this.pendingTransactions.size,
      simulationsStored: this.transactionSimulations.size,
      mevPatternsDetected: {
        frontrun: this.mevPatterns.frontrun.size,
        sandwich: this.mevPatterns.sandwich.size,
        arbitrage: this.mevPatterns.arbitrage.size,
        flashLoan: this.mevPatterns.flashLoan.size,
        liquidation: this.mevPatterns.liquidation.size
      },
      gasAnalysis: this.gasAnalysis
    };
  }

  /**
   * Stop mempool monitoring
   */
  async stopMonitoring() {
    console.log('🛑 Stopping enhanced mempool monitoring...');
    
    this.isMonitoring = false;
    
    // Remove event listeners
    if (this.provider) {
      this.provider.removeAllListeners('pending');
    }
    
    // Close private mempool connections
    for (const [provider, connection] of Object.entries(this.privateMempoolConnections)) {
      if (connection && typeof connection.close === 'function') {
        connection.close();
      }
    }
    
    // Clear all data structures
    this.opportunityQueue = [];
    this.pendingTransactions.clear();
    this.transactionSimulations.clear();
    this.mevPatterns.frontrun.clear();
    this.mevPatterns.sandwich.clear();
    this.mevPatterns.arbitrage.clear();
    this.mevPatterns.flashLoan.clear();
    this.mevPatterns.liquidation.clear();
    
    console.log('✅ Enhanced mempool monitoring stopped');
  }
}

export default MempoolMonitor;