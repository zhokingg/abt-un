const { ethers } = require('ethers');
const { Token, Pool, Route, Trade, TradeType, Percent } = require('@uniswap/v3-sdk');
const { CurrencyAmount } = require('@uniswap/sdk-core');
const config = require('../config/config');

class UniswapV3Fetcher {
  constructor(provider) {
    this.provider = provider;
    this.chainId = config.CHAIN_ID;
    
    // Uniswap V3 Quoter ABI
    this.quoterABI = [
      'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)',
      'function quoteExactOutputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountOut, uint160 sqrtPriceLimitX96) external returns (uint256 amountIn)'
    ];
    
    // Uniswap V3 Factory ABI
    this.factoryABI = [
      'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)',
      'function feeAmountTickSpacing(uint24 fee) external view returns (int24)'
    ];
    
    // Uniswap V3 Pool ABI
    this.poolABI = [
      'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
      'function liquidity() external view returns (uint128)',
      'function token0() external view returns (address)',
      'function token1() external view returns (address)',
      'function fee() external view returns (uint24)',
      'function tickSpacing() external view returns (int24)'
    ];
    
    // Initialize contracts
    this.quoter = new ethers.Contract(config.UNISWAP_V3_QUOTER, this.quoterABI, provider);
    this.factory = new ethers.Contract(config.UNISWAP_V3_FACTORY, this.factoryABI, provider);
    
    // Common fee tiers for Uniswap V3
    this.feeTiers = [500, 3000, 10000]; // 0.05%, 0.3%, 1%
    
    console.log('🦄 UniswapV3Fetcher initialized');
  }

  /**
   * Get price for a token pair using Uniswap V3 quoter
   */
  async getPrice(tokenA, tokenB, amountIn, options = {}) {
    try {
      const { feeTier = 3000, slippageTolerance = config.SLIPPAGE_TOLERANCE } = options;
      
      // Validate inputs
      if (!tokenA || !tokenB || !amountIn) {
        throw new Error('Missing required parameters: tokenA, tokenB, amountIn');
      }
      
      // Try to get quote for the specified fee tier
      let amountOut;
      let usedFeeTier = feeTier;
      
      try {
        amountOut = await this.quoter.quoteExactInputSingle(
          tokenA,
          tokenB,
          feeTier,
          amountIn,
          0 // No price limit
        );
      } catch (error) {
        // If the specified fee tier fails, try other common fee tiers
        console.log(`Fee tier ${feeTier} failed, trying alternatives...`);
        
        for (const alternativeFee of this.feeTiers) {
          if (alternativeFee === feeTier) continue;
          
          try {
            amountOut = await this.quoter.quoteExactInputSingle(
              tokenA,
              tokenB,
              alternativeFee,
              amountIn,
              0
            );
            usedFeeTier = alternativeFee;
            console.log(`✅ Using fee tier ${alternativeFee} instead`);
            break;
          } catch (altError) {
            continue;
          }
        }
        
        if (!amountOut) {
          throw new Error(`No valid pool found for ${tokenA}/${tokenB}`);
        }
      }
      
      // Get pool information
      const poolInfo = await this.getPoolInfo(tokenA, tokenB, usedFeeTier);
      
      return {
        amountOut,
        feeTier: usedFeeTier,
        poolInfo,
        exchange: 'uniswap-v3',
        timestamp: Date.now(),
        gasEstimate: await this.estimateGasForSwap(tokenA, tokenB, usedFeeTier)
      };
      
    } catch (error) {
      console.error(`❌ Error getting Uniswap V3 price for ${tokenA}/${tokenB}:`, error.message);
      return null;
    }
  }

  /**
   * Get pool information for a token pair
   */
  async getPoolInfo(tokenA, tokenB, feeTier) {
    try {
      const poolAddress = await this.factory.getPool(tokenA, tokenB, feeTier);
      
      if (poolAddress === ethers.ZeroAddress) {
        throw new Error(`Pool does not exist for ${tokenA}/${tokenB} with fee ${feeTier}`);
      }
      
      const poolContract = new ethers.Contract(poolAddress, this.poolABI, this.provider);
      
      const [slot0, liquidity, token0, token1] = await Promise.all([
        poolContract.slot0(),
        poolContract.liquidity(),
        poolContract.token0(),
        poolContract.token1()
      ]);
      
      const sqrtPriceX96 = slot0.sqrtPriceX96;
      const tick = slot0.tick;
      
      // Calculate price from sqrtPriceX96
      const price = this.sqrtPriceX96ToPrice(sqrtPriceX96, tokenA, tokenB, token0);
      
      return {
        poolAddress,
        feeTier,
        liquidity: liquidity.toString(),
        sqrtPriceX96: sqrtPriceX96.toString(),
        tick: Number(tick),
        price,
        token0,
        token1,
        lastUpdate: Date.now()
      };
      
    } catch (error) {
      console.error(`❌ Error getting pool info for ${tokenA}/${tokenB}:`, error.message);
      return null;
    }
  }

  /**
   * Convert sqrtPriceX96 to human-readable price
   */
  sqrtPriceX96ToPrice(sqrtPriceX96, tokenA, tokenB, token0) {
    try {
      const Q96 = 2 ** 96;
      const price = (Number(sqrtPriceX96) / Q96) ** 2;
      
      // Adjust for token order (token0 vs token1)
      const isToken0 = tokenA.toLowerCase() === token0.toLowerCase();
      return isToken0 ? price : 1 / price;
      
    } catch (error) {
      console.error('Error converting sqrtPriceX96 to price:', error.message);
      return 0;
    }
  }

  /**
   * Get the best price across all fee tiers
   */
  async getBestPrice(tokenA, tokenB, amountIn) {
    try {
      const pricePromises = this.feeTiers.map(feeTier =>
        this.getPrice(tokenA, tokenB, amountIn, { feeTier })
      );
      
      const prices = await Promise.allSettled(pricePromises);
      const validPrices = prices
        .filter(result => result.status === 'fulfilled' && result.value)
        .map(result => result.value);
      
      if (validPrices.length === 0) {
        return null;
      }
      
      // Find the price with the highest amountOut
      const bestPrice = validPrices.reduce((best, current) => 
        Number(current.amountOut) > Number(best.amountOut) ? current : best
      );
      
      bestPrice.alternatives = validPrices.length;
      
      return bestPrice;
      
    } catch (error) {
      console.error(`❌ Error getting best V3 price for ${tokenA}/${tokenB}:`, error.message);
      return null;
    }
  }

  /**
   * Get liquidity for all fee tiers of a token pair
   */
  async getAllPoolLiquidity(tokenA, tokenB) {
    try {
      const liquidityPromises = this.feeTiers.map(async (feeTier) => {
        try {
          const poolInfo = await this.getPoolInfo(tokenA, tokenB, feeTier);
          return poolInfo ? { feeTier, ...poolInfo } : null;
        } catch (error) {
          return null;
        }
      });
      
      const results = await Promise.allSettled(liquidityPromises);
      
      return results
        .filter(result => result.status === 'fulfilled' && result.value)
        .map(result => result.value)
        .sort((a, b) => Number(b.liquidity) - Number(a.liquidity));
      
    } catch (error) {
      console.error(`❌ Error getting pool liquidity for ${tokenA}/${tokenB}:`, error.message);
      return [];
    }
  }

  /**
   * Estimate gas for a V3 swap
   */
  async estimateGasForSwap(tokenA, tokenB, feeTier) {
    try {
      // V3 swaps generally use more gas than V2
      let gasEstimate = 180000; // Base gas for V3 swap
      
      // Add gas for higher fee tiers (more complex)
      if (feeTier >= 10000) gasEstimate += 20000;
      
      return gasEstimate;
      
    } catch (error) {
      console.error('Error estimating V3 gas:', error.message);
      return 250000; // Conservative estimate
    }
  }

  /**
   * Check if pools have sufficient liquidity
   */
  async hasLiquidity(tokenA, tokenB, minLiquidityUSD = config.MIN_LIQUIDITY_USD) {
    try {
      const pools = await this.getAllPoolLiquidity(tokenA, tokenB);
      
      if (pools.length === 0) return false;
      
      // Calculate approximate USD liquidity (simplified)
      const totalLiquidity = pools.reduce((sum, pool) => {
        const mockETHPrice = 2000;
        const estimatedUSD = (Number(pool.liquidity) / 1e18) * mockETHPrice;
        return sum + estimatedUSD;
      }, 0);
      
      return totalLiquidity >= minLiquidityUSD;
      
    } catch (error) {
      console.error(`Error checking V3 liquidity for ${tokenA}/${tokenB}:`, error.message);
      return false;
    }
  }

  /**
   * Get multiple prices in batch
   */
  async getBatchPrices(requests) {
    const results = await Promise.allSettled(
      requests.map(({ tokenA, tokenB, amountIn, options }) =>
        this.getPrice(tokenA, tokenB, amountIn, options)
      )
    );
    
    return results.map((result, index) => ({
      request: requests[index],
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null
    }));
  }

  /**
   * Health check for the V3 fetcher
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
        exchange: 'uniswap-v3'
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        lastCheck: Date.now(),
        error: error.message,
        exchange: 'uniswap-v3'
      };
    }
  }

  /**
   * Get Uniswap V3 specific information
   */
  getUniswapV3Info() {
    return {
      name: 'Uniswap V3',
      protocol: 'Concentrated Liquidity AMM',
      quoter: config.UNISWAP_V3_QUOTER,
      factory: config.UNISWAP_V3_FACTORY,
      feeTiers: this.feeTiers,
      features: ['Concentrated Liquidity', 'Multiple Fee Tiers', 'Capital Efficiency']
    };
  }
}

module.exports = UniswapV3Fetcher;
