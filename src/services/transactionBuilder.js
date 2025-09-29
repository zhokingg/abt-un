import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import config from '../config/config.js';

/**
 * Transaction Builder and Secure Sender for Arbitrage Operations
 * Handles transaction construction, signing, sending, and monitoring
 */
class TransactionBuilder extends EventEmitter {
  constructor(web3Provider) {
    super();
    this.web3Provider = web3Provider;
    this.provider = web3Provider?.provider;
    this.wallet = web3Provider?.wallet;
    
    // Transaction tracking
    this.pendingTransactions = new Map();
    this.completedTransactions = new Map();
    this.failedTransactions = new Map();
    
    // Gas optimization strategies
    this.gasStrategies = {
      ECONOMY: { multiplier: 1.0, priority: 'low' },
      STANDARD: { multiplier: 1.1, priority: 'medium' },
      FAST: { multiplier: 1.25, priority: 'high' },
      URGENT: { multiplier: 1.5, priority: 'urgent' }
    };
    
    // Retry configuration
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 2000, // 2 seconds
      backoffMultiplier: 2,
      gasIncreasePerRetry: 0.1 // 10% gas increase per retry
    };
    
    // Batch transaction settings
    this.batchConfig = {
      maxBatchSize: 5,
      batchTimeout: 10000, // 10 seconds
      currentBatch: []
    };
    
    // Performance metrics
    this.stats = {
      totalTransactions: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      totalGasUsed: BigInt(0),
      totalGasCost: BigInt(0),
      averageConfirmationTime: 0
    };
  }

  /**
   * Build arbitrage transaction
   */
  async buildArbitrageTransaction(opportunity, tradeAmount) {
    console.log(`🔨 Building arbitrage transaction for ${opportunity.tokenPair}...`);
    
    try {
      // Validate inputs
      if (!opportunity || !tradeAmount || tradeAmount <= 0) {
        throw new Error('Invalid opportunity or trade amount');
      }
      
      // Get optimal gas strategy
      const gasStrategy = await this.getOptimalGasStrategy(opportunity);
      
      // Build transaction data
      const txData = await this.constructTransactionData(opportunity, tradeAmount);
      
      // Estimate gas
      const gasEstimate = await this.estimateGas(txData);
      
      // Build complete transaction
      const transaction = {
        to: txData.to,
        data: txData.data,
        value: txData.value || '0x0',
        gasLimit: this.addGasBuffer(gasEstimate),
        gasPrice: gasStrategy.gasPrice,
        maxFeePerGas: gasStrategy.maxFeePerGas,
        maxPriorityFeePerGas: gasStrategy.maxPriorityFeePerGas,
        type: gasStrategy.type, // EIP-1559 or legacy
        nonce: await this.getNextNonce(),
        chainId: config.CHAIN_ID,
        
        // Metadata for tracking
        metadata: {
          opportunityId: opportunity.id,
          tokenPair: opportunity.tokenPair,
          expectedProfit: opportunity.expectedProfit,
          strategy: gasStrategy.name,
          buildTime: Date.now()
        }
      };
      
      console.log(`✅ Transaction built successfully`);
      console.log(`   Gas Limit: ${transaction.gasLimit}`);
      console.log(`   Gas Strategy: ${gasStrategy.name}`);
      
      return transaction;
      
    } catch (error) {
      console.error('❌ Error building transaction:', error.message);
      throw error;
    }
  }

  /**
   * Construct transaction data for arbitrage
   */
  async constructTransactionData(opportunity, tradeAmount) {
    // This would construct the actual DEX interaction data
    // For now, return a mock structure
    
    const buyExchange = opportunity.buyExchange;
    const sellExchange = opportunity.sellExchange;
    
    if (buyExchange.includes('v2') && sellExchange.includes('v3')) {
      return this.buildV2ToV3ArbitrageData(opportunity, tradeAmount);
    } else if (buyExchange.includes('v3') && sellExchange.includes('v2')) {
      return this.buildV3ToV2ArbitrageData(opportunity, tradeAmount);
    } else {
      throw new Error(`Unsupported arbitrage path: ${buyExchange} -> ${sellExchange}`);
    }
  }

  /**
   * Build V2 to V3 arbitrage transaction data
   */
  buildV2ToV3ArbitrageData(opportunity, tradeAmount) {
    // Mock implementation - in production, this would encode actual contract calls
    return {
      to: config.UNISWAP_V2_ROUTER, // Start with V2 router
      data: this.encodeArbitrageCall(opportunity, tradeAmount),
      value: '0x0' // ERC20 arbitrage, no ETH value
    };
  }

  /**
   * Build V3 to V2 arbitrage transaction data
   */
  buildV3ToV2ArbitrageData(opportunity, tradeAmount) {
    // Mock implementation
    return {
      to: config.UNISWAP_V3_QUOTER, // Start with V3 router
      data: this.encodeArbitrageCall(opportunity, tradeAmount),
      value: '0x0'
    };
  }

  /**
   * Encode arbitrage contract call (simplified)
   */
  encodeArbitrageCall(opportunity, tradeAmount) {
    // This would use ethers ABI encoding in production
    // Mock encoded data for demonstration
    const mockCalldata = '0x38ed1739' + // swapExactTokensForTokens selector
      ethers.zeroPadValue(ethers.toBeHex(tradeAmount), 32).slice(2) + // amount
      ethers.zeroPadValue(ethers.toBeHex(0), 32).slice(2) + // min amount out
      '0000000000000000000000000000000000000000000000000000000000000080' + // path offset
      '0000000000000000000000000000000000000000000000000000000000000000'; // deadline
    
    return mockCalldata;
  }

  /**
   * Get optimal gas strategy based on opportunity and network conditions
   */
  async getOptimalGasStrategy(opportunity) {
    try {
      // Get current gas prices
      const feeData = await this.provider.getFeeData();
      
      // Determine strategy based on opportunity value
      let strategyName = 'STANDARD';
      
      if (opportunity.expectedProfit > 1000) {
        strategyName = 'URGENT'; // High-value opportunities need fast execution
      } else if (opportunity.expectedProfit > 500) {
        strategyName = 'FAST';
      } else if (opportunity.expectedProfit > 100) {
        strategyName = 'STANDARD';
      } else {
        strategyName = 'ECONOMY';
      }
      
      const strategy = this.gasStrategies[strategyName];
      
      // Apply strategy multipliers
      const baseGasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');
      const gasPrice = baseGasPrice * BigInt(Math.floor(strategy.multiplier * 100)) / BigInt(100);
      
      // EIP-1559 support
      const maxFeePerGas = feeData.maxFeePerGas ? 
        feeData.maxFeePerGas * BigInt(Math.floor(strategy.multiplier * 100)) / BigInt(100) : null;
      const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ? 
        feeData.maxPriorityFeePerGas * BigInt(Math.floor(strategy.multiplier * 100)) / BigInt(100) : null;
      
      return {
        name: strategyName,
        gasPrice,
        maxFeePerGas,
        maxPriorityFeePerGas,
        type: maxFeePerGas ? 2 : 0, // EIP-1559 or legacy
        multiplier: strategy.multiplier,
        priority: strategy.priority
      };
      
    } catch (error) {
      console.error('❌ Error getting gas strategy:', error.message);
      // Fallback to standard strategy
      return {
        name: 'STANDARD',
        gasPrice: ethers.parseUnits('25', 'gwei'),
        maxFeePerGas: null,
        maxPriorityFeePerGas: null,
        type: 0,
        multiplier: 1.1,
        priority: 'medium'
      };
    }
  }

  /**
   * Estimate gas for transaction
   */
  async estimateGas(txData) {
    try {
      const gasEstimate = await this.provider.estimateGas({
        to: txData.to,
        data: txData.data,
        value: txData.value || '0x0',
        from: this.wallet?.address
      });
      
      return gasEstimate;
      
    } catch (error) {
      console.error('❌ Gas estimation failed:', error.message);
      // Return fallback gas estimate
      return BigInt(300000); // 300k gas fallback
    }
  }

  /**
   * Add safety buffer to gas estimate
   */
  addGasBuffer(gasEstimate, bufferPercentage = 20) {
    const buffer = gasEstimate * BigInt(bufferPercentage) / BigInt(100);
    return gasEstimate + buffer;
  }

  /**
   * Get next nonce for the wallet
   */
  async getNextNonce() {
    if (!this.wallet) {
      throw new Error('Wallet not available');
    }
    
    try {
      return await this.provider.getTransactionCount(this.wallet.address, 'pending');
    } catch (error) {
      console.error('❌ Error getting nonce:', error.message);
      throw error;
    }
  }

  /**
   * Sign and send transaction with retry mechanism
   */
  async sendTransaction(transaction, retryCount = 0) {
    const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`📤 Sending transaction ${txId} (attempt ${retryCount + 1}/${this.retryConfig.maxRetries + 1})`);
    
    try {
      if (!this.wallet) {
        throw new Error('Wallet not configured');
      }
      
      // Sign transaction
      const signedTx = await this.wallet.signTransaction(transaction);
      
      // Send transaction
      const txResponse = await this.provider.sendTransaction(signedTx);
      
      // Track pending transaction
      this.trackPendingTransaction(txId, txResponse, transaction.metadata);
      
      console.log(`✅ Transaction sent: ${txResponse.hash}`);
      
      // Start monitoring transaction
      this.monitorTransaction(txId, txResponse);
      
      return {
        id: txId,
        hash: txResponse.hash,
        response: txResponse
      };
      
    } catch (error) {
      console.error(`❌ Transaction ${txId} failed:`, error.message);
      
      // Check if retry is warranted
      if (this.shouldRetry(error, retryCount)) {
        console.log(`🔄 Retrying transaction ${txId}...`);
        
        // Increase gas price for retry
        const updatedTransaction = await this.prepareRetryTransaction(transaction, retryCount);
        
        // Wait before retry
        await this.delay(this.calculateRetryDelay(retryCount));
        
        return this.sendTransaction(updatedTransaction, retryCount + 1);
      } else {
        // Track failed transaction
        this.trackFailedTransaction(txId, error, transaction.metadata);
        throw error;
      }
    }
  }

  /**
   * Check if transaction should be retried
   */
  shouldRetry(error, retryCount) {
    if (retryCount >= this.retryConfig.maxRetries) {
      return false;
    }
    
    // Retry on specific error types
    const retryableErrors = [
      'replacement transaction underpriced',
      'nonce too low',
      'network congestion',
      'timeout'
    ];
    
    return retryableErrors.some(retryableError => 
      error.message.toLowerCase().includes(retryableError)
    );
  }

  /**
   * Prepare transaction for retry with updated parameters
   */
  async prepareRetryTransaction(originalTx, retryCount) {
    const gasIncrease = 1 + (this.retryConfig.gasIncreasePerRetry * (retryCount + 1));
    
    // Update gas price
    let newGasPrice = originalTx.gasPrice;
    if (newGasPrice) {
      newGasPrice = originalTx.gasPrice * BigInt(Math.floor(gasIncrease * 100)) / BigInt(100);
    }
    
    // Update EIP-1559 fees if applicable
    let newMaxFeePerGas = originalTx.maxFeePerGas;
    let newMaxPriorityFeePerGas = originalTx.maxPriorityFeePerGas;
    
    if (newMaxFeePerGas) {
      newMaxFeePerGas = originalTx.maxFeePerGas * BigInt(Math.floor(gasIncrease * 100)) / BigInt(100);
    }
    
    if (newMaxPriorityFeePerGas) {
      newMaxPriorityFeePerGas = originalTx.maxPriorityFeePerGas * BigInt(Math.floor(gasIncrease * 100)) / BigInt(100);
    }
    
    // Get fresh nonce
    const newNonce = await this.getNextNonce();
    
    return {
      ...originalTx,
      gasPrice: newGasPrice,
      maxFeePerGas: newMaxFeePerGas,
      maxPriorityFeePerGas: newMaxPriorityFeePerGas,
      nonce: newNonce,
      metadata: {
        ...originalTx.metadata,
        retryCount: retryCount + 1,
        retryTime: Date.now()
      }
    };
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  calculateRetryDelay(retryCount) {
    return this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, retryCount);
  }

  /**
   * Monitor transaction confirmation
   */
  async monitorTransaction(txId, txResponse) {
    try {
      console.log(`👀 Monitoring transaction ${txResponse.hash}...`);
      
      // Wait for confirmation
      const receipt = await txResponse.wait();
      
      if (receipt.status === 1) {
        console.log(`✅ Transaction ${txResponse.hash} confirmed in block ${receipt.blockNumber}`);
        this.trackSuccessfulTransaction(txId, receipt);
      } else {
        console.log(`❌ Transaction ${txResponse.hash} failed`);
        this.trackFailedTransaction(txId, new Error('Transaction reverted'), {});
      }
      
    } catch (error) {
      console.error(`❌ Error monitoring transaction ${txResponse.hash}:`, error.message);
      this.trackFailedTransaction(txId, error, {});
    }
  }

  /**
   * Track pending transaction
   */
  trackPendingTransaction(txId, txResponse, metadata) {
    this.pendingTransactions.set(txId, {
      id: txId,
      hash: txResponse.hash,
      sentAt: Date.now(),
      metadata,
      response: txResponse
    });
    
    this.stats.totalTransactions++;
    
    this.emit('transactionSent', {
      id: txId,
      hash: txResponse.hash,
      metadata
    });
  }

  /**
   * Track successful transaction
   */
  trackSuccessfulTransaction(txId, receipt) {
    const pending = this.pendingTransactions.get(txId);
    
    if (pending) {
      const confirmationTime = Date.now() - pending.sentAt;
      
      this.completedTransactions.set(txId, {
        ...pending,
        receipt,
        confirmedAt: Date.now(),
        confirmationTime,
        gasUsed: receipt.gasUsed,
        gasCost: receipt.gasUsed * receipt.effectiveGasPrice
      });
      
      this.pendingTransactions.delete(txId);
      
      // Update stats
      this.stats.successfulTransactions++;
      this.stats.totalGasUsed += receipt.gasUsed;
      this.stats.totalGasCost += (receipt.gasUsed * receipt.effectiveGasPrice);
      this.updateAverageConfirmationTime(confirmationTime);
      
      this.emit('transactionConfirmed', {
        id: txId,
        hash: pending.hash,
        receipt,
        confirmationTime
      });
    }
  }

  /**
   * Track failed transaction
   */
  trackFailedTransaction(txId, error, metadata) {
    const pending = this.pendingTransactions.get(txId);
    
    const failedTx = {
      id: txId,
      error: error.message,
      failedAt: Date.now(),
      metadata
    };
    
    if (pending) {
      failedTx.hash = pending.hash;
      failedTx.sentAt = pending.sentAt;
      this.pendingTransactions.delete(txId);
    }
    
    this.failedTransactions.set(txId, failedTx);
    this.stats.failedTransactions++;
    
    this.emit('transactionFailed', failedTx);
  }

  /**
   * Update average confirmation time
   */
  updateAverageConfirmationTime(newTime) {
    const total = this.stats.successfulTransactions;
    this.stats.averageConfirmationTime = 
      ((this.stats.averageConfirmationTime * (total - 1)) + newTime) / total;
  }

  /**
   * Batch multiple transactions for gas efficiency
   */
  async batchTransactions(transactions) {
    console.log(`📦 Batching ${transactions.length} transactions...`);
    
    // This would implement transaction batching via multicall or similar
    // For now, send transactions in sequence
    const results = [];
    
    for (const tx of transactions) {
      try {
        const result = await this.sendTransaction(tx);
        results.push(result);
      } catch (error) {
        results.push({ error: error.message, transaction: tx });
      }
    }
    
    return results;
  }

  /**
   * Get transaction status
   */
  getTransactionStatus(txId) {
    if (this.pendingTransactions.has(txId)) {
      return { status: 'pending', transaction: this.pendingTransactions.get(txId) };
    }
    
    if (this.completedTransactions.has(txId)) {
      return { status: 'confirmed', transaction: this.completedTransactions.get(txId) };
    }
    
    if (this.failedTransactions.has(txId)) {
      return { status: 'failed', transaction: this.failedTransactions.get(txId) };
    }
    
    return { status: 'unknown' };
  }

  /**
   * Get comprehensive statistics
   */
  getStats() {
    return {
      ...this.stats,
      pending: this.pendingTransactions.size,
      completed: this.completedTransactions.size,
      failed: this.failedTransactions.size,
      successRate: this.stats.totalTransactions > 0 ? 
        (this.stats.successfulTransactions / this.stats.totalTransactions) * 100 : 0,
      averageGasCost: this.stats.successfulTransactions > 0 ?
        parseFloat(ethers.formatEther(this.stats.totalGasCost / BigInt(this.stats.successfulTransactions))) : 0
    };
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup and stop transaction builder
   */
  async cleanup() {
    console.log('🧹 Cleaning up transaction builder...');
    
    // Wait for pending transactions to complete
    const pendingHashes = Array.from(this.pendingTransactions.values()).map(tx => tx.hash);
    
    if (pendingHashes.length > 0) {
      console.log(`⏳ Waiting for ${pendingHashes.length} pending transactions...`);
      // In production, implement proper waiting logic
    }
    
    // Clear tracking maps
    this.pendingTransactions.clear();
    
    console.log('✅ Transaction builder cleanup completed');
  }
}

export default TransactionBuilder;