const { ethers } = require('ethers');
const UniswapV2Fetcher = require('./uniswapV2Fetcher');
const config = require('../config/config');

class SushiswapFetcher extends UniswapV2Fetcher {
  constructor(provider) {
    super(provider);
    
    // Override with Sushiswap contract addresses
    this.router = new ethers.Contract(config.SUSHISWAP_ROUTER, this.routerABI, provider);
    this.factory = new ethers.Contract(config.SUSHISWAP_FACTORY, this.factoryABI, provider);
    
    console.log('🍣 SushiswapFetcher initialized');
  }

  /**
   * Get price for a token pair using Sushiswap
   */
  async getPrice(tokenA, tokenB, amountIn, options = {}) {
    const result = await super.getPrice(tokenA, tokenB, amountIn, options);
    
    if (result) {
      result.exchange = 'sushiswap';
    }
    
    return result;
  }

  /**
   * Health check for Sushiswap fetcher
   */
  async healthCheck() {
    try {
      // Test with a simple ETH/USDC pair
      const testAmount = ethers.parseEther('1'); // 1 ETH
      const result = await this.getPrice(
        config.TOKENS.WETH,
        config.TOKENS.USDC,
        testAmount
      );
      
      return {
        status: result ? 'healthy' : 'unhealthy',
        lastCheck: Date.now(),
        testResult: result,
        exchange: 'sushiswap'
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        lastCheck: Date.now(),
        error: error.message,
        exchange: 'sushiswap'
      };
    }
  }

  /**
   * Get Sushiswap specific information
   */
  getSushiswapInfo() {
    return {
      name: 'Sushiswap',
      protocol: 'Uniswap V2 Fork',
      router: config.SUSHISWAP_ROUTER,
      factory: config.SUSHISWAP_FACTORY,
      features: ['AMM', 'Liquidity Mining', 'Cross-chain'],
      fees: {
        standard: 0.3, // 0.3%
        lpReward: 0.25, // 0.25% to LP providers
        protocolFee: 0.05 // 0.05% to protocol
      }
    };
  }
}

module.exports = SushiswapFetcher;