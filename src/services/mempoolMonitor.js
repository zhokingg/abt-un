import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import config from '../config/config.js';

/**
 * Mempool Monitoring for MEV Opportunity Detection
 * Monitors pending transactions for arbitrage opportunities
 */
class MempoolMonitor extends EventEmitter {
  constructor(web3Provider) {
    super();
    this.web3Provider = web3Provider;
    this.provider = web3Provider?.provider;
    this.isMonitoring = false;
    
    // Transaction filters for DEX interactions
    this.dexSignatures = new Map([
      // Uniswap V2 Router
      ['0x38ed1739', 'swapExactTokensForTokens'],
      ['0x8803dbee', 'swapTokensForExactTokens'],
      ['0x7ff36ab5', 'swapExactETHForTokens'],
      ['0x18cbafe5', 'swapTokensForExactETH'],
      
      // Uniswap V3 Router
      ['0x414bf389', 'exactInputSingle'],
      ['0xc04b8d59', 'exactInput'],
      ['0xdb3e2198', 'exactOutputSingle'],
      ['0x09b81346', 'exactOutput'],
      
      // Common DEX functions
      ['0xa9059cbb', 'transfer'],
      ['0x095ea7b3', 'approve'],
      ['0x23b872dd', 'transferFrom']
    ]);
    
    // DEX contract addresses to monitor
    this.dexContracts = new Set([
      config.UNISWAP_V2_ROUTER,
      config.UNISWAP_V3_QUOTER,
      '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Uniswap V3 Router
      '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F', // Sushiswap Router
    ]);
    
    // Opportunity scoring system
    this.opportunityQueue = [];
    this.maxQueueSize = 1000;
    
    // MEV detection patterns
    this.mevPatterns = {
      frontrun: new Set(),
      sandwich: new Map(),
      arbitrage: new Set()
    };
    
    // Performance metrics
    this.stats = {
      totalTransactions: 0,
      relevantTransactions: 0,
      opportunitiesDetected: 0,
      mevOpportunities: 0,
      lastUpdate: null
    };
  }

  /**
   * Start mempool monitoring
   */
  async startMonitoring() {
    console.log('🕵️ Starting mempool monitoring...');
    
    if (!this.provider) {
      throw new Error('Web3 provider not available');
    }
    
    try {
      this.isMonitoring = true;
      
      // Listen for pending transactions
      this.provider.on('pending', async (txHash) => {
        if (this.isMonitoring) {
          await this.processPendingTransaction(txHash);
        }
      });
      
      // Start opportunity processing
      this.startOpportunityProcessing();
      
      console.log('✅ Mempool monitoring started');
      
    } catch (error) {
      console.error('❌ Failed to start mempool monitoring:', error.message);
      throw error;
    }
  }

  /**
   * Process pending transaction for opportunities
   */
  async processPendingTransaction(txHash) {
    try {
      this.stats.totalTransactions++;
      
      // Get transaction details
      const tx = await this.provider.getTransaction(txHash);
      
      if (!tx || !tx.to) return;
      
      // Filter for DEX interactions
      if (!this.isDEXTransaction(tx)) return;
      
      this.stats.relevantTransactions++;
      
      // Analyze transaction for MEV opportunities
      const analysis = await this.analyzeTransaction(tx);
      
      if (analysis.hasOpportunity) {
        this.stats.opportunitiesDetected++;
        
        // Add to opportunity queue
        this.addOpportunity(analysis);
        
        // Emit opportunity detected event
        this.emit('opportunityDetected', analysis);
      }
      
      // Check for MEV patterns
      await this.detectMEVPatterns(tx, analysis);
      
    } catch (error) {
      // Silently handle errors to avoid spam (most pending tx requests fail)
      if (!error.message.includes('transaction not found')) {
        console.error(`❌ Error processing pending tx ${txHash}:`, error.message);
      }
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
      mevPatternsDetected: {
        frontrun: this.mevPatterns.frontrun.size,
        sandwich: this.mevPatterns.sandwich.size,
        arbitrage: this.mevPatterns.arbitrage.size
      }
    };
  }

  /**
   * Stop mempool monitoring
   */
  async stopMonitoring() {
    console.log('🛑 Stopping mempool monitoring...');
    
    this.isMonitoring = false;
    
    // Remove event listeners
    if (this.provider) {
      this.provider.removeAllListeners('pending');
    }
    
    // Clear queues and patterns
    this.opportunityQueue = [];
    this.mevPatterns.frontrun.clear();
    this.mevPatterns.sandwich.clear();
    this.mevPatterns.arbitrage.clear();
    
    console.log('✅ Mempool monitoring stopped');
  }
}

export default MempoolMonitor;