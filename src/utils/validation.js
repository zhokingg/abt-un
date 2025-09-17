const { ethers } = require('ethers');
const config = require('../config/config');
const logger = require('./logger');

class ValidationService {
  constructor(provider, wallet = null) {
    this.provider = provider;
    this.wallet = wallet;
    this.gasCache = new Map();
    this.gasCacheTTL = 30000; // 30 seconds
  }

  /**
   * Validate Ethereum address format
   */
  isValidAddress(address) {
    try {
      return ethers.isAddress(address);
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate token pair inputs
   */
  validateTokenPair(tokenA, tokenB) {
    const errors = [];
    
    if (!tokenA || !this.isValidAddress(tokenA)) {
      errors.push('Invalid tokenA address');
    }
    
    if (!tokenB || !this.isValidAddress(tokenB)) {
      errors.push('Invalid tokenB address');
    }
    
    if (tokenA && tokenB && tokenA.toLowerCase() === tokenB.toLowerCase()) {
      errors.push('TokenA and TokenB cannot be the same');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate trade amount
   */
  validateTradeAmount(amount, minAmount = 0, maxAmount = config.MAX_TRADE_AMOUNT) {
    const errors = [];
    
    if (!amount || isNaN(amount) || amount <= 0) {
      errors.push('Amount must be a positive number');
    }
    
    if (amount < minAmount) {
      errors.push(`Amount must be at least ${minAmount}`);
    }
    
    if (amount > maxAmount) {
      errors.push(`Amount cannot exceed ${maxAmount}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      amount: parseFloat(amount)
    };
  }

  /**
   * Check wallet balance
   */
  async checkWalletBalance(tokenAddress = null, minBalance = null) {
    try {
      if (!this.wallet) {
        return {
          isValid: false,
          error: 'No wallet configured',
          balance: '0'
        };
      }
      
      const address = await this.wallet.getAddress();
      
      if (!tokenAddress || tokenAddress === config.TOKENS.WETH) {
        // Check ETH balance
        const balance = await this.provider.getBalance(address);
        const ethBalance = parseFloat(ethers.formatEther(balance));
        const requiredBalance = minBalance || config.WALLET_BALANCE_THRESHOLD;
        
        return {
          isValid: ethBalance >= requiredBalance,
          balance: ethBalance.toString(),
          balanceFormatted: `${ethBalance.toFixed(6)} ETH`,
          required: requiredBalance,
          sufficient: ethBalance >= requiredBalance,
          error: ethBalance < requiredBalance ? `Insufficient ETH balance: ${ethBalance.toFixed(6)} < ${requiredBalance}` : null
        };
      } else {
        // Check ERC20 token balance
        const tokenContract = new ethers.Contract(tokenAddress, [
          'function balanceOf(address owner) external view returns (uint256)',
          'function decimals() external view returns (uint8)',
          'function symbol() external view returns (string)'
        ], this.provider);
        
        const [balance, decimals, symbol] = await Promise.all([
          tokenContract.balanceOf(address),
          tokenContract.decimals(),
          tokenContract.symbol()
        ]);
        
        const tokenBalance = parseFloat(ethers.formatUnits(balance, decimals));
        const requiredBalance = minBalance || 0;
        
        return {
          isValid: tokenBalance >= requiredBalance,
          balance: tokenBalance.toString(),
          balanceFormatted: `${tokenBalance.toFixed(6)} ${symbol}`,
          symbol,
          decimals,
          required: requiredBalance,
          sufficient: tokenBalance >= requiredBalance,
          error: tokenBalance < requiredBalance ? `Insufficient ${symbol} balance: ${tokenBalance.toFixed(6)} < ${requiredBalance}` : null
        };
      }
      
    } catch (error) {
      logger.error('Error checking wallet balance', { error: error.message, tokenAddress });
      return {
        isValid: false,
        error: error.message,
        balance: '0'
      };
    }
  }

  /**
   * Estimate and validate gas costs
   */
  async estimateGasCost(transaction, options = {}) {
    try {
      const { 
        maxGasPrice = config.MAX_GAS_PRICE,
        gasMultiplier = 1.2 
      } = options;
      
      // Check cache first
      const cacheKey = JSON.stringify(transaction);
      const cached = this.gasCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.gasCacheTTL) {
        return cached.data;
      }
      
      // Get current gas price
      const gasPrice = await this.provider.getGasPrice();
      const gasPriceGWei = parseFloat(ethers.formatUnits(gasPrice, 'gwei'));
      
      // Estimate gas limit
      const gasLimit = await this.provider.estimateGas(transaction);
      const adjustedGasLimit = BigInt(Math.floor(Number(gasLimit) * gasMultiplier));
      
      // Calculate costs
      const gasCost = gasPrice * adjustedGasLimit;
      const gasCostETH = parseFloat(ethers.formatEther(gasCost));
      const gasCostUSD = gasCostETH * 2000; // Mock ETH price
      
      const result = {
        gasPrice: gasPrice.toString(),
        gasPriceGwei: gasPriceGwei,
        gasLimit: gasLimit.toString(),
        adjustedGasLimit: adjustedGasLimit.toString(),
        gasCost: gasCost.toString(),
        gasCostETH,
        gasCostUSD,
        isValid: gasPriceGwei <= maxGasPrice,
        exceedsMaxGasPrice: gasPriceGwei > maxGasPrice,
        timestamp: Date.now()
      };
      
      // Cache result
      this.gasCache.set(cacheKey, { data: result, timestamp: Date.now() });
      
      return result;
      
    } catch (error) {
      logger.error('Error estimating gas cost', { error: error.message, transaction });
      return {
        isValid: false,
        error: error.message,
        gasPrice: '0',
        gasCostETH: 0,
        gasCostUSD: 0
      };
    }
  }

  /**
   * Validate slippage tolerance
   */
  validateSlippage(slippage) {
    const errors = [];
    
    if (isNaN(slippage) || slippage < 0) {
      errors.push('Slippage must be a positive number');
    }
    
    if (slippage > config.MAX_SLIPPAGE) {
      errors.push(`Slippage cannot exceed ${config.MAX_SLIPPAGE}%`);
    }
    
    if (slippage < 0.1) {
      errors.push('Slippage too low, trades may fail');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      slippage: parseFloat(slippage)
    };
  }

  /**
   * Validate arbitrage opportunity
   */
  async validateArbitrageOpportunity(opportunity) {
    const validationResults = {
      isValid: true,
      errors: [],
      warnings: [],
      checks: {}
    };
    
    try {
      // Check profit threshold
      if (opportunity.profitPercentage < config.MIN_PROFIT_THRESHOLD) {
        validationResults.errors.push(`Profit ${opportunity.profitPercentage.toFixed(2)}% below threshold ${config.MIN_PROFIT_THRESHOLD}%`);
        validationResults.isValid = false;
      }
      validationResults.checks.profitThreshold = opportunity.profitPercentage >= config.MIN_PROFIT_THRESHOLD;
      
      // Check gas costs vs profit
      if (opportunity.gasCostUSD >= opportunity.estimatedProfitUSD * 0.8) {
        validationResults.warnings.push('Gas costs consume >80% of profit');
      }
      validationResults.checks.gasCostRatio = opportunity.gasCostUSD < opportunity.estimatedProfitUSD * 0.8;
      
      // Check net profit
      if (opportunity.netProfitUSD <= 0) {
        validationResults.errors.push('Net profit is negative after gas costs');
        validationResults.isValid = false;
      }
      validationResults.checks.positiveNetProfit = opportunity.netProfitUSD > 0;
      
      // Check wallet balance
      if (this.wallet) {
        const balanceCheck = await this.checkWalletBalance();
        if (!balanceCheck.sufficient) {
          validationResults.errors.push(balanceCheck.error);
          validationResults.isValid = false;
        }
        validationResults.checks.sufficientBalance = balanceCheck.sufficient;
      }
      
      // Check if opportunity is too old
      const opportunityAge = Date.now() - opportunity.timestamp;
      if (opportunityAge > 30000) { // 30 seconds
        validationResults.warnings.push('Opportunity is older than 30 seconds');
      }
      validationResults.checks.freshOpportunity = opportunityAge <= 30000;
      
      // Check exchange availability (mock check)
      const exchanges = [opportunity.buyFrom, opportunity.sellTo];
      for (const exchange of exchanges) {
        if (!['uniswap-v2', 'uniswap-v3', 'sushiswap'].includes(exchange)) {
          validationResults.errors.push(`Unsupported exchange: ${exchange}`);
          validationResults.isValid = false;
        }
      }
      validationResults.checks.supportedExchanges = true;
      
    } catch (error) {
      validationResults.errors.push(`Validation error: ${error.message}`);
      validationResults.isValid = false;
    }
    
    return validationResults;
  }

  /**
   * Simulate transaction execution (dry run)
   */
  async simulateTransaction(transaction, options = {}) {
    try {
      const { skipGasCheck = false } = options;
      
      const simulation = {
        isValid: true,
        errors: [],
        warnings: [],
        simulation: {}
      };
      
      // Gas estimation
      if (!skipGasCheck) {
        const gasEstimate = await this.estimateGasCost(transaction);
        simulation.simulation.gas = gasEstimate;
        
        if (!gasEstimate.isValid) {
          simulation.errors.push('Gas estimation failed');
          simulation.isValid = false;
        }
      }
      
      // Balance check
      if (this.wallet) {
        const balanceCheck = await this.checkWalletBalance();
        simulation.simulation.balance = balanceCheck;
        
        if (!balanceCheck.sufficient) {
          simulation.errors.push('Insufficient balance for transaction');
          simulation.isValid = false;
        }
      }
      
      // Call simulation (static call)
      try {
        if (transaction.to && transaction.data) {
          const result = await this.provider.call(transaction);
          simulation.simulation.callResult = result;
        }
      } catch (callError) {
        simulation.errors.push(`Transaction would revert: ${callError.message}`);
        simulation.isValid = false;
      }
      
      return simulation;
      
    } catch (error) {
      logger.error('Error simulating transaction', { error: error.message, transaction });
      return {
        isValid: false,
        errors: [`Simulation failed: ${error.message}`],
        warnings: [],
        simulation: {}
      };
    }
  }

  /**
   * Comprehensive safety check
   */
  async performSafetyCheck(operation, data) {
    const safetyCheck = {
      passed: true,
      errors: [],
      warnings: [],
      checks: {},
      timestamp: Date.now()
    };
    
    try {
      // DRY RUN check
      if (config.DRY_RUN && operation === 'trade') {
        safetyCheck.warnings.push('DRY RUN mode - no real transactions will be executed');
      }
      safetyCheck.checks.dryRunMode = config.DRY_RUN;
      
      // Network check
      const network = await this.provider.getNetwork();
      if (network.chainId !== config.CHAIN_ID) {
        safetyCheck.errors.push(`Wrong network: expected ${config.CHAIN_ID}, got ${network.chainId}`);
        safetyCheck.passed = false;
      }
      safetyCheck.checks.correctNetwork = network.chainId === config.CHAIN_ID;
      
      // Gas price check
      const gasPrice = await this.provider.getGasPrice();
      const gasPriceGwei = parseFloat(ethers.formatUnits(gasPrice, 'gwei'));
      if (gasPriceGwei > config.MAX_GAS_PRICE) {
        safetyCheck.warnings.push(`High gas price: ${gasPriceGwei.toFixed(1)} gwei`);
      }
      safetyCheck.checks.reasonableGasPrice = gasPriceGwei <= config.MAX_GAS_PRICE;
      
      // Operation-specific checks
      switch (operation) {
        case 'arbitrage':
          const arbValidation = await this.validateArbitrageOpportunity(data);
          if (!arbValidation.isValid) {
            safetyCheck.errors.push(...arbValidation.errors);
            safetyCheck.passed = false;
          }
          safetyCheck.warnings.push(...arbValidation.warnings);
          safetyCheck.checks.arbitrageValidation = arbValidation.isValid;
          break;
          
        case 'trade':
          if (data.transaction) {
            const simulation = await this.simulateTransaction(data.transaction);
            if (!simulation.isValid) {
              safetyCheck.errors.push(...simulation.errors);
              safetyCheck.passed = false;
            }
            safetyCheck.checks.transactionSimulation = simulation.isValid;
          }
          break;
      }
      
    } catch (error) {
      safetyCheck.errors.push(`Safety check failed: ${error.message}`);
      safetyCheck.passed = false;
    }
    
    return safetyCheck;
  }

  /**
   * Clear gas cache
   */
  clearGasCache() {
    this.gasCache.clear();
  }

  /**
   * Get validation statistics
   */
  getStats() {
    return {
      gasCacheSize: this.gasCache.size,
      gasCacheTTL: this.gasCacheTTL,
      hasWallet: !!this.wallet,
      hasProvider: !!this.provider
    };
  }
}

module.exports = ValidationService;
