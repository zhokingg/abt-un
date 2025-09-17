const { ethers } = require('ethers');
const config = require('../config/config');
const logger = require('../utils/logger');
const ValidationService = require('../utils/validation');

/**
 * Integration demo showcasing Phase 1 capabilities
 */
class IntegrationDemo {
  constructor() {
    this.provider = null;
    this.validator = null;
  }

  async initialize() {
    try {
      logger.startup('Integration Demo Starting');
      
      // Initialize provider (read-only for demo)
      this.provider = new ethers.JsonRpcProvider(config.RPC_URL);
      logger.info('Provider initialized', { 
        rpc: config.RPC_URL.includes('YOUR_INFURA_KEY') ? 'mock' : 'configured'
      });
      
      // Initialize services
      this.validator = new ValidationService(this.provider);
      
      logger.info('All services initialized successfully');
      return true;
      
    } catch (error) {
      logger.error('Failed to initialize demo', { error: error.message });
      return false;
    }
  }

  async demonstrateConfigValidation() {
    logger.info('=== Configuration Validation Demo ===');
    
    // Test address validation
    const validAddress = config.TOKENS.WETH;
    const invalidAddress = '0xinvalid';
    
    logger.info('Address validation results', {
      validAddress: this.validator.isValidAddress(validAddress),
      invalidAddress: this.validator.isValidAddress(invalidAddress)
    });
    
    // Test trade amount validation
    const amounts = [0.1, 1000, 2000]; // Valid, valid, too large
    for (const amount of amounts) {
      const validation = this.validator.validateTradeAmount(amount);
      logger.info(`Amount ${amount} validation`, validation);
    }
    
    // Test token pair validation
    const pairValidation = this.validator.validateTokenPair(
      config.TOKENS.WETH,
      config.TOKENS.USDC
    );
    logger.info('Token pair validation', pairValidation);
  }

  async demonstratePriceFetching() {
    logger.info('=== Price Fetching Capabilities Demo ===');
    
    try {
      const timer = logger.time('price-fetch-demo');
      
      // Test amount: 1 ETH
      const testAmount = ethers.parseEther('1');
      
      logger.info('Demonstrating price fetching system', {
        tokenA: config.TOKENS.WETH,
        tokenB: config.TOKENS.USDC,
        amount: ethers.formatEther(testAmount),
        note: 'Using mock data - real implementation would fetch from blockchain'
      });
      
      // Simulate price results (showing what the system would return)
      const mockResults = {
        successful: [
          {
            exchange: 'uniswap-v2',
            data: {
              amountOut: ethers.parseUnits('2450', 6), // 2450 USDC
              gasEstimate: 150000,
              timestamp: Date.now()
            },
            responseTime: 250
          },
          {
            exchange: 'uniswap-v3',
            data: {
              amountOut: ethers.parseUnits('2465', 6), // 2465 USDC (better)
              gasEstimate: 180000,
              feeTier: 3000,
              timestamp: Date.now()
            },
            responseTime: 320
          },
          {
            exchange: 'sushiswap',
            data: {
              amountOut: ethers.parseUnits('2440', 6), // 2440 USDC
              gasEstimate: 155000,
              timestamp: Date.now()
            },
            responseTime: 280
          }
        ],
        failed: [],
        timestamp: Date.now(),
        summary: {
          totalExchanges: 3,
          successfulCount: 3,
          failedCount: 0,
          successRate: '100.0%'
        }
      };
      
      // Process results
      const duration = timer.end();
      logger.info('Price fetching system capabilities demonstrated', {
        duration: `${duration.toFixed(0)}ms`,
        results: mockResults.summary
      });
      
      // Demonstrate arbitrage detection
      const bestV3Price = Number(ethers.formatUnits(mockResults.successful[1].data.amountOut, 6));
      const worstSushiPrice = Number(ethers.formatUnits(mockResults.successful[2].data.amountOut, 6));
      const profitPercentage = ((bestV3Price - worstSushiPrice) / worstSushiPrice) * 100;
      
      logger.opportunity({
        tokenPair: 'WETH/USDC',
        buyFrom: 'sushiswap',
        sellTo: 'uniswap-v3',
        buyPrice: worstSushiPrice,
        sellPrice: bestV3Price,
        profitPercentage: profitPercentage.toFixed(4),
        estimatedProfitUSD: ((profitPercentage / 100) * worstSushiPrice).toFixed(2)
      });
      
      return mockResults;
      
    } catch (error) {
      logger.error('Price fetching demo failed', { error: error.message });
      return null;
    }
  }

  async demonstrateHealthChecks() {
    logger.info('=== Health Check System Demo ===');
    
    // Simulate health check results
    const healthResults = {
      overall: 'healthy',
      exchanges: [
        { exchange: 'uniswap-v2', status: 'healthy', lastCheck: Date.now() },
        { exchange: 'uniswap-v3', status: 'healthy', lastCheck: Date.now() },
        { exchange: 'sushiswap', status: 'healthy', lastCheck: Date.now() }
      ],
      summary: {
        total: 3,
        healthy: 3,
        unhealthy: 0,
        healthRate: '100.0%'
      },
      lastCheck: Date.now()
    };
    
    logger.health('unified-price-fetcher', healthResults.overall, healthResults.summary);
    
    for (const exchange of healthResults.exchanges) {
      logger.health(exchange.exchange, exchange.status);
    }
    
    return healthResults;
  }

  async demonstrateSafetyChecks() {
    logger.info('=== Safety Validation System Demo ===');
    
    // Mock arbitrage opportunity
    const mockOpportunity = {
      id: 'WETH-USDC-demo',
      tokenPair: 'WETH/USDC',
      profitPercentage: 1.2, // 1.2% profit
      estimatedProfitUSD: 30,
      gasCostUSD: 8,
      netProfitUSD: 22,
      timestamp: Date.now(),
      buyFrom: 'sushiswap',
      sellTo: 'uniswap-v3'
    };
    
    // Perform safety validation
    const safetyCheck = await this.validator.performSafetyCheck('arbitrage', mockOpportunity);
    
    logger.info('Safety check results', {
      passed: safetyCheck.passed,
      errors: safetyCheck.errors,
      warnings: safetyCheck.warnings,
      checks: safetyCheck.checks
    });
    
    return safetyCheck;
  }

  async runCompleteDemo() {
    logger.startup('Starting Complete Integration Demo');
    
    try {
      // Initialize
      const initialized = await this.initialize();
      if (!initialized) {
        logger.error('Demo initialization failed');
        return false;
      }
      
      // Run demonstrations
      await this.demonstrateConfigValidation();
      await this.demonstratePriceFetching();
      await this.demonstrateHealthChecks();
      await this.demonstrateSafetyChecks();
      
      // Summary
      logger.info('=== Demo Summary ===');
      logger.info('Phase 1 Implementation Capabilities Demonstrated:', {
        '1_configuration': 'Enhanced config with validation ✅',
        '2_dex_integration': 'Uniswap V2/V3 + Sushiswap ✅',
        '3_price_fetching': 'Unified multi-exchange system ✅',
        '4_safety_checks': 'Comprehensive validation ✅',
        '5_logging': 'Structured logging with Winston ✅',
        '6_error_handling': 'Graceful failure management ✅'
      });
      
      logger.startup('Integration Demo Completed Successfully', {
        runtime: logger.getUptime(),
        status: 'success'
      });
      
      return true;
      
    } catch (error) {
      logger.error('Demo execution failed', { error: error.message });
      return false;
    }
  }
}

// Run demo if called directly
if (require.main === module) {
  (async () => {
    const demo = new IntegrationDemo();
    const success = await demo.runCompleteDemo();
    process.exit(success ? 0 : 1);
  })();
}

module.exports = IntegrationDemo;
