const { ethers } = require('ethers');
const { Token, Pair, Route, Trade, TradeType, Percent } = require('@uniswap/v2-sdk');
const { CurrencyAmount } = require('@uniswap/sdk-core');
const config = require('../config/config');

class UniswapV2Fetcher {
  constructor(provider) {
    this.provider = provider;
    this.chainId = config.CHAIN_ID;
    
    // Uniswap V2 Router ABI (minimal required functions)
    this.routerABI = [
      'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
      'function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts)',
      'function factory() external pure returns (address)',
      'function WETH() external pure returns (address)'
    ];
    
    // Uniswap V2 Factory ABI
    this.factoryABI = [
      'function getPair(address tokenA, address tokenB) external view returns (address pair)',
      'function allPairs(uint) external view returns (address pair)',
      'function allPairsLength() external view returns (uint)'
    ];
    
    // Uniswap V2 Pair ABI
    this.pairABI = [
      'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
      'function token0() external view returns (address)',
      'function token1() external view returns (address)',
      'function totalSupply() external view returns (uint)',
      'function balanceOf(address owner) external view returns (uint)'
    ];
    
    // Initialize contracts
    this.router = new ethers.Contract(config.UNISWAP_V2_ROUTER, this.routerABI, provider);
    this.factory = new ethers.Contract(config.UNISWAP_V2_FACTORY, this.factoryABI, provider);
    
    console.log('🦄 UniswapV2Fetcher initialized');
  }

  /**
   * Get price for a token pair using getAmountsOut
   */
  async getPrice(tokenA, tokenB, amountIn, options = {}) {
    try {
      const { useWETH = true, slippageTolerance = config.SLIPPAGE_TOLERANCE } = options;
      
      // Validate inputs
      if (!tokenA || !tokenB || !amountIn) {
        throw new Error('Missing required parameters: tokenA, tokenB, amountIn');
      }
      
      const path = useWETH && tokenA !== config.TOKENS.WETH && tokenB !== config.TOKENS.WETH
        ? [tokenA, config.TOKENS.WETH, tokenB]
        : [tokenA, tokenB];
      
      // Get amounts out
      const amounts = await this.router.getAmountsOut(amountIn, path);
      const amountOut = amounts[amounts.length - 1];
      
      // Calculate price impact
      const priceImpact = await this.calculatePriceImpact(tokenA, tokenB, amountIn, amountOut);
      
      return {
        amountOut,
        path,
        priceImpact,
        exchange: 'uniswap-v2',
        timestamp: Date.now(),
        gasEstimate: await this.estimateGasForSwap(path, amountIn)
      };
      
    } catch (error) {
      console.error(`❌ Error getting Uniswap V2 price for ${tokenA}/${tokenB}:`, error.message);
      return null;
    }
  }

  /**
   * Get reserves for a token pair
   */
  async getReserves(tokenA, tokenB) {
    try {
      const pairAddress = await this.factory.getPair(tokenA, tokenB);
      
      if (pairAddress === ethers.ZeroAddress) {
        throw new Error(`Pair does not exist for ${tokenA}/${tokenB}`);
      }
      
      const pairContract = new ethers.Contract(pairAddress, this.pairABI, this.provider);
      const [reserve0, reserve1, timestamp] = await pairContract.getReserves();
      
      // Get token addresses to determine which reserve belongs to which token
      const token0 = await pairContract.token0();
      const token1 = await pairContract.token1();
      
      const tokenAReserve = tokenA.toLowerCase() === token0.toLowerCase() ? reserve0 : reserve1;
      const tokenBReserve = tokenA.toLowerCase() === token0.toLowerCase() ? reserve1 : reserve0;
      
      return {
        tokenAReserve,
        tokenBReserve,
        pairAddress,
        timestamp: Number(timestamp),
        lastUpdate: Date.now()
      };
      
    } catch (error) {
      console.error(`❌ Error getting reserves for ${tokenA}/${tokenB}:`, error.message);
      return null;
    }
  }

  /**
   * Calculate price impact for a trade
   */
  async calculatePriceImpact(tokenA, tokenB, amountIn, amountOut) {
    try {
      const reserves = await this.getReserves(tokenA, tokenB);
      if (!reserves) return { percentage: 0, impact: 'unknown' };
      
      // Calculate spot price (current market price)
      const spotPrice = Number(reserves.tokenBReserve) / Number(reserves.tokenAReserve);
      
      // Calculate execution price
      const executionPrice = Number(amountOut) / Number(amountIn);
      
      // Calculate price impact percentage
      const priceImpactPercent = Math.abs((executionPrice - spotPrice) / spotPrice) * 100;
      
      let impact = 'low';
      if (priceImpactPercent > 1) impact = 'medium';
      if (priceImpactPercent > 3) impact = 'high';
      if (priceImpactPercent > 5) impact = 'very-high';
      
      return {
        percentage: priceImpactPercent,
        impact,
        spotPrice,
        executionPrice
      };
      
    } catch (error) {
      console.error('Error calculating price impact:', error.message);
      return { percentage: 0, impact: 'unknown' };
    }
  }

  /**
   * Health check for the fetcher
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
        testResult: result
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        lastCheck: Date.now(),
        error: error.message
      };
    }
  }
}

module.exports = UniswapV2Fetcher;
