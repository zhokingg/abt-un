const { ethers } = require('ethers');
const config = require('../config/config');

/**
 * Contract Manager for handling smart contract interactions
 */
class ContractManager {
  constructor(web3Provider) {
    this.web3Provider = web3Provider;
    this.provider = web3Provider?.provider;
    this.wallet = web3Provider?.wallet;
    
    // Contract addresses (to be deployed)
    this.addresses = {
      flashloanArbitrage: null,
      arbitrageRouter: null,
      profitCalculator: null,
      accessControl: null,
      emergencyStop: null
    };
    
    // Contract instances
    this.contracts = {};
    
    // Contract ABIs (simplified for key functions)
    this.abis = {
      flashloanArbitrage: [
        'function executeArbitrage(tuple(address,address,uint256,address,address,uint24,uint24,uint256,uint256)) external',
        'function checkProfitability(tuple(address,address,uint256,address,address,uint24,uint24,uint256,uint256)) external view returns (bool, tuple(uint256,uint256,uint256,uint256,bool,uint256))',
        'function extractProfit(address token, uint256 amount) external',
        'function getBalances(address[] memory tokens) external view returns (uint256[] memory)',
        'function emergencyTokenRecovery(address token, uint256 amount) external',
        'function isEmergencyStopped() external view returns (bool)',
        'event ArbitrageExecuted(address indexed tokenA, address indexed tokenB, uint256 amountIn, uint256 profit, address indexed initiator)',
        'event FlashloanExecuted(address indexed asset, uint256 amount, uint256 premium, bool success)'
      ],
      arbitrageRouter: [
        'function executeSwap(tuple(address,address,uint256,uint256,address,uint24,uint256)) external returns (uint256)',
        'function executeMultipleSwaps(tuple(address,address,uint256,uint256,address,uint24,uint256)[]) external returns (uint256[])',
        'function calculateMinAmountOut(uint256 expectedAmount, uint256 slippageBps) external pure returns (uint256)',
        'function validateSwapParams(tuple(address,address,uint256,uint256,address,uint24,uint256)) external view returns (bool)',
        'function getTokenBalance(address token) external view returns (uint256)',
        'event SwapExecuted(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, address indexed router)'
      ],
      profitCalculator: [
        'function calculateProfit(tuple(address,address,uint256,address,address,uint24,uint24,uint256), uint256, uint256) external view returns (tuple(uint256,uint256,uint256,uint256,bool,uint256))',
        'function validateArbitrageParams(tuple(address,address,uint256,address,address,uint24,uint24,uint256)) external pure returns (bool)',
        'event ProfitCalculated(address indexed tokenA, address indexed tokenB, uint256 amountIn, uint256 grossProfit, uint256 netProfit, bool isProfitable)'
      ],
      emergencyStop: [
        'function activateEmergencyStop() external',
        'function deactivateEmergencyStop() external',
        'function isEmergencyStopped() external view returns (bool)',
        'function getEmergencyStopTimeRemaining() external view returns (uint256)',
        'event EmergencyStopActivated(address indexed activatedBy, uint256 timestamp)',
        'event EmergencyStopDeactivated(address indexed deactivatedBy, uint256 timestamp)'
      ]
    };
    
    this.initialized = false;
  }
  
  /**
   * Initialize contract manager with deployed contract addresses
   */
  async initialize(contractAddresses = {}) {
    try {
      console.log('🔄 Initializing Contract Manager...');
      
      if (!this.provider) {
        throw new Error('Web3 provider not available');
      }
      
      // Update addresses if provided
      this.addresses = { ...this.addresses, ...contractAddresses };
      
      // Initialize contract instances
      await this.initializeContracts();
      
      this.initialized = true;
      console.log('✅ Contract Manager initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Contract Manager:', error.message);
      throw error;
    }
  }
  
  /**
   * Initialize contract instances
   */
  async initializeContracts() {
    for (const [contractName, address] of Object.entries(this.addresses)) {
      if (address && this.abis[contractName]) {
        try {
          this.contracts[contractName] = new ethers.Contract(
            address,
            this.abis[contractName],
            this.wallet || this.provider
          );
          
          console.log(`📄 ${contractName} contract initialized at ${address}`);
        } catch (error) {
          console.warn(`⚠️ Failed to initialize ${contractName} contract:`, error.message);
        }
      }
    }
  }
  
  /**
   * Execute arbitrage using flashloan contract
   */
  async executeArbitrage(arbitrageData, options = {}) {
    try {
      console.log('🚀 Executing arbitrage via smart contract...');
      
      if (!this.contracts.flashloanArbitrage) {
        throw new Error('FlashloanArbitrage contract not initialized');
      }
      
      // Validate parameters
      await this.validateArbitrageExecution(arbitrageData);
      
      // Prepare transaction options
      const txOptions = {
        gasLimit: options.gasLimit || 500000,
        gasPrice: options.gasPrice || await this.provider.getGasPrice(),
        ...options
      };
      
      console.log('📝 Transaction options:', {
        gasLimit: txOptions.gasLimit,
        gasPrice: ethers.formatUnits(txOptions.gasPrice, 'gwei') + ' gwei'
      });
      
      // Execute the transaction
      const tx = await this.contracts.flashloanArbitrage.executeArbitrage(
        arbitrageData,
        txOptions
      );
      
      console.log(`📤 Transaction submitted: ${tx.hash}`);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      console.log(`✅ Arbitrage executed successfully in block ${receipt.blockNumber}`);
      
      // Parse execution results
      const results = await this.parseArbitrageResults(receipt);
      
      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
        results
      };
      
    } catch (error) {
      console.error('❌ Arbitrage execution failed:', error.message);
      
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }
  
  /**
   * Check profitability before execution
   */
  async checkProfitability(arbitrageData, gasPrice) {
    try {
      if (!this.contracts.flashloanArbitrage) {
        throw new Error('FlashloanArbitrage contract not initialized');
      }
      
      const [isProfitable, profitResult] = await this.contracts.flashloanArbitrage.checkProfitability(
        arbitrageData
      );
      
      return {
        isProfitable,
        grossProfit: profitResult.grossProfit.toString(),
        netProfit: profitResult.netProfit.toString(),
        gasCost: profitResult.gasCost.toString(),
        flashLoanFee: profitResult.flashLoanFee.toString(),
        profitPercentage: profitResult.profitPercentage.toString()
      };
      
    } catch (error) {
      console.error('Error checking profitability:', error.message);
      return {
        isProfitable: false,
        error: error.message
      };
    }
  }
  
  /**
   * Extract profits from the contract
   */
  async extractProfit(tokenAddress, amount, options = {}) {
    try {
      console.log(`💰 Extracting profit: ${amount} of ${tokenAddress}`);
      
      if (!this.contracts.flashloanArbitrage) {
        throw new Error('FlashloanArbitrage contract not initialized');
      }
      
      const txOptions = {
        gasLimit: options.gasLimit || 100000,
        gasPrice: options.gasPrice || await this.provider.getGasPrice(),
        ...options
      };
      
      const tx = await this.contracts.flashloanArbitrage.extractProfit(
        tokenAddress,
        amount,
        txOptions
      );
      
      const receipt = await tx.wait();
      
      console.log(`✅ Profit extracted successfully: ${tx.hash}`);
      
      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
      
    } catch (error) {
      console.error('❌ Profit extraction failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get contract balances for multiple tokens
   */
  async getContractBalances(tokenAddresses) {
    try {
      if (!this.contracts.flashloanArbitrage) {
        throw new Error('FlashloanArbitrage contract not initialized');
      }
      
      const balances = await this.contracts.flashloanArbitrage.getBalances(tokenAddresses);
      
      const balanceMap = {};
      tokenAddresses.forEach((address, index) => {
        balanceMap[address] = balances[index].toString();
      });
      
      return balanceMap;
      
    } catch (error) {
      console.error('Error getting contract balances:', error.message);
      return {};
    }
  }
  
  /**
   * Emergency stop functions
   */
  async activateEmergencyStop(options = {}) {
    try {
      if (!this.contracts.emergencyStop) {
        throw new Error('EmergencyStop contract not initialized');
      }
      
      const tx = await this.contracts.emergencyStop.activateEmergencyStop(options);
      await tx.wait();
      
      console.log('🛑 Emergency stop activated');
      return { success: true, txHash: tx.hash };
      
    } catch (error) {
      console.error('❌ Failed to activate emergency stop:', error.message);
      return { success: false, error: error.message };
    }
  }
  
  async deactivateEmergencyStop(options = {}) {
    try {
      if (!this.contracts.emergencyStop) {
        throw new Error('EmergencyStop contract not initialized');
      }
      
      const tx = await this.contracts.emergencyStop.deactivateEmergencyStop(options);
      await tx.wait();
      
      console.log('✅ Emergency stop deactivated');
      return { success: true, txHash: tx.hash };
      
    } catch (error) {
      console.error('❌ Failed to deactivate emergency stop:', error.message);
      return { success: false, error: error.message };
    }
  }
  
  async isEmergencyStopped() {
    try {
      if (!this.contracts.emergencyStop) {
        return false;
      }
      
      return await this.contracts.emergencyStop.isEmergencyStopped();
      
    } catch (error) {
      console.error('Error checking emergency stop status:', error.message);
      return false;
    }
  }
  
  /**
   * Validate arbitrage execution parameters
   */
  async validateArbitrageExecution(arbitrageData) {
    // Basic validation
    if (!arbitrageData.tokenA || !arbitrageData.tokenB) {
      throw new Error('Invalid token addresses');
    }
    
    if (!arbitrageData.amountIn || BigInt(arbitrageData.amountIn) <= 0) {
      throw new Error('Invalid amount');
    }
    
    if (!arbitrageData.routerA || !arbitrageData.routerB) {
      throw new Error('Invalid router addresses');
    }
    
    // Check emergency stop
    const emergencyStopped = await this.isEmergencyStopped();
    if (emergencyStopped) {
      throw new Error('Contract is in emergency stop mode');
    }
    
    // Validate with contract if available
    if (this.contracts.profitCalculator) {
      const isValid = await this.contracts.profitCalculator.validateArbitrageParams(arbitrageData);
      if (!isValid) {
        throw new Error('Invalid arbitrage parameters');
      }
    }
    
    console.log('✅ Arbitrage parameters validated');
  }
  
  /**
   * Parse arbitrage execution results from transaction receipt
   */
  async parseArbitrageResults(receipt) {
    const results = {
      profit: '0',
      gasUsed: receipt.gasUsed.toString(),
      events: []
    };
    
    try {
      // Parse ArbitrageExecuted events
      const arbitrageEvents = receipt.logs
        .filter(log => {
          try {
            const parsed = this.contracts.flashloanArbitrage.interface.parseLog(log);
            return parsed.name === 'ArbitrageExecuted';
          } catch {
            return false;
          }
        })
        .map(log => this.contracts.flashloanArbitrage.interface.parseLog(log));
      
      if (arbitrageEvents.length > 0) {
        results.profit = arbitrageEvents[0].args.profit.toString();
        results.events.push({
          name: 'ArbitrageExecuted',
          args: arbitrageEvents[0].args
        });
      }
      
    } catch (error) {
      console.warn('Error parsing arbitrage results:', error.message);
    }
    
    return results;
  }
  
  /**
   * Get contract manager status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      contracts: Object.keys(this.contracts).map(name => ({
        name,
        address: this.addresses[name],
        initialized: !!this.contracts[name]
      })),
      wallet: this.wallet ? this.wallet.address : null
    };
  }
  
  /**
   * Update contract addresses (for upgrades)
   */
  async updateContractAddresses(newAddresses) {
    console.log('🔄 Updating contract addresses...');
    
    this.addresses = { ...this.addresses, ...newAddresses };
    await this.initializeContracts();
    
    console.log('✅ Contract addresses updated');
  }
  
  /**
   * Estimate gas for arbitrage execution
   */
  async estimateArbitrageGas(arbitrageData) {
    try {
      if (!this.contracts.flashloanArbitrage) {
        // Return default estimate if contract not available
        return {
          gasLimit: 500000,
          estimated: false
        };
      }
      
      const gasEstimate = await this.contracts.flashloanArbitrage.executeArbitrage.estimateGas(
        arbitrageData
      );
      
      // Add 20% buffer
      const gasLimit = (gasEstimate * BigInt(120)) / BigInt(100);
      
      return {
        gasLimit: gasLimit.toString(),
        estimated: true,
        baseEstimate: gasEstimate.toString()
      };
      
    } catch (error) {
      console.warn('Gas estimation failed, using default:', error.message);
      return {
        gasLimit: 500000,
        estimated: false,
        error: error.message
      };
    }
  }
}

module.exports = ContractManager;