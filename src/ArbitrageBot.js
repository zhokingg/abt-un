// src/ArbitrageBot.js
require('dotenv').config();
const { ethers } = require('ethers');
const { Token, CurrencyAmount, TradeType, Percent } = require('@uniswap/sdk-core');
const { Pair, Route, Trade } = require('@uniswap/v2-sdk');
const { Pool, Route: V3Route, Trade: V3Trade } = require('@uniswap/v3-sdk');

class ArbitrageBot {
  constructor() {
    // Handle different ethers.js versions
    try {
      // Try ethers v6 syntax
      this.provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
    } catch (error) {
      // Fallback to ethers v5 syntax
      this.provider = new ethers.providers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
    }
    
    this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    this.minProfitThreshold = parseFloat(process.env.MIN_PROFIT_THRESHOLD) || 0.5;
    this.gasPrice = ethers.parseUnits(process.env.GAS_PRICE_GWEI || '20', 'gwei');
    
    // Initialize common tokens
    this.tokens = this.initializeTokens();
    
    // Contract interfaces
    this.v2RouterABI = [
      'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
      'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
    ];
    
    this.v3QuoterABI = [
      'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)'
    ];
    
    this.v2Router = new ethers.Contract(process.env.UNISWAP_V2_ROUTER, this.v2RouterABI, this.wallet);
    this.v3Quoter = new ethers.Contract('0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6', this.v3QuoterABI, this.provider);
    
    console.log('🤖 ArbitrageBot initialized');
  }

  initializeTokens() {
    const chainId = 1; // Mainnet
    return {
      WETH: new Token(chainId, process.env.WETH_ADDRESS, 18, 'WETH', 'Wrapped Ether'),
      USDC: new Token(chainId, process.env.USDC_ADDRESS, 6, 'USDC', 'USD Coin'),
      USDT: new Token(chainId, process.env.USDT_ADDRESS, 6, 'USDT', 'Tether USD'),
      DAI: new Token(chainId, process.env.DAI_ADDRESS, 18, 'DAI', 'Dai Stablecoin')
    };
  }

  async getV2Price(tokenA, tokenB, amountIn) {
    try {
      const path = [tokenA.address, tokenB.address];
      const amounts = await this.v2Router.getAmountsOut(amountIn, path);
      return amounts[1];
    } catch (error) {
      console.error('❌ Error getting V2 price:', error.message);
      return null;
    }
  }

  async getV3Price(tokenA, tokenB, amountIn, fee = 3000) {
    try {
      const amountOut = await this.v3Quoter.quoteExactInputSingle(
        tokenA.address,
        tokenB.address,
        fee,
        amountIn,
        0
      );
      return amountOut;
    } catch (error) {
      console.error('❌ Error getting V3 price:', error.message);
      return null;
    }
  }

  async findArbitrageOpportunity(tokenA, tokenB, amountIn) {
    console.log(`🔍 Checking arbitrage opportunity for ${tokenA.symbol}/${tokenB.symbol}`);
    
    try {
      // Get prices from both V2 and V3
      const [v2Price, v3Price] = await Promise.all([
        this.getV2Price(tokenA, tokenB, amountIn),
        this.getV3Price(tokenA, tokenB, amountIn)
      ]);

      if (!v2Price || !v3Price) {
        console.log('❌ Could not fetch prices from both DEXs');
        return null;
      }

      // Calculate price difference percentage
      const priceDiff = this.calculatePriceDifference(v2Price, v3Price);
      
      console.log(`📊 V2 Price: ${ethers.formatUnits(v2Price, tokenB.decimals)} ${tokenB.symbol}`);
      console.log(`📊 V3 Price: ${ethers.formatUnits(v3Price, tokenB.decimals)} ${tokenB.symbol}`);
      console.log(`📈 Price Difference: ${priceDiff.toFixed(4)}%`);

      // Check if opportunity meets minimum profit threshold
      if (Math.abs(priceDiff) >= this.minProfitThreshold) {
        const opportunity = {
          tokenA,
          tokenB,
          amountIn,
          v2Price,
          v3Price,
          priceDifference: priceDiff,
          buyFrom: priceDiff > 0 ? 'V2' : 'V3',
          sellTo: priceDiff > 0 ? 'V3' : 'V2',
          estimatedProfit: this.calculateEstimatedProfit(amountIn, priceDiff, tokenB.decimals)
        };

        console.log(`💰 Arbitrage opportunity found!`);
        console.log(`📍 Buy from: ${opportunity.buyFrom}, Sell to: ${opportunity.sellTo}`);
        console.log(`💵 Estimated profit: $${opportunity.estimatedProfit.toFixed(2)}`);
        
        return opportunity;
      } else {
        console.log(`❌ Price difference (${priceDiff.toFixed(4)}%) below threshold (${this.minProfitThreshold}%)`);
        return null;
      }

    } catch (error) {
      console.error('❌ Error finding arbitrage opportunity:', error);
      return null;
    }
  }

  calculatePriceDifference(price1, price2) {
    const p1 = parseFloat(ethers.formatEther(price1));
    const p2 = parseFloat(ethers.formatEther(price2));
    return ((p2 - p1) / p1) * 100;
  }

  calculateEstimatedProfit(amountIn, priceDiffPercent, decimals) {
    const inputAmount = parseFloat(ethers.formatUnits(amountIn, decimals));
    const profitAmount = inputAmount * (Math.abs(priceDiffPercent) / 100);
    return profitAmount;
  }

  async estimateGasCost(transaction) {
    try {
      const gasEstimate = await this.provider.estimateGas(transaction);
      const gasCost = gasEstimate * this.gasPrice;
      return parseFloat(ethers.formatEther(gasCost));
    } catch (error) {
      console.error('❌ Error estimating gas cost:', error);
      return 0.01; // Default fallback
    }
  }

  async executeArbitrage(opportunity) {
    console.log('🚀 Executing arbitrage...');
    
    try {
      // This is a simplified version - in production you'd need more sophisticated execution
      console.log(`📝 Would execute: Buy ${opportunity.tokenA.symbol} from ${opportunity.buyFrom}`);
      console.log(`📝 Then sell ${opportunity.tokenA.symbol} to ${opportunity.sellTo}`);
      console.log(`💰 Expected profit: $${opportunity.estimatedProfit.toFixed(2)}`);
      
      // TODO: Implement actual transaction execution
      // This would involve:
      // 1. Check token balances and allowances
      // 2. Execute buy transaction on cheaper DEX
      // 3. Execute sell transaction on more expensive DEX
      // 4. Handle slippage and MEV protection
      
      return { success: true, txHash: 'mock_tx_hash' };
      
    } catch (error) {
      console.error('❌ Error executing arbitrage:', error);
      return { success: false, error: error.message };
    }
  }

  async scanForOpportunities() {
    console.log('🔍 Scanning for arbitrage opportunities...');
    
    const tokenPairs = [
      [this.tokens.WETH, this.tokens.USDC],
      [this.tokens.WETH, this.tokens.USDT],
      [this.tokens.USDC, this.tokens.USDT],
      [this.tokens.USDC, this.tokens.DAI]
    ];

    const amountIn = ethers.parseEther('1'); // 1 ETH or equivalent

    for (const [tokenA, tokenB] of tokenPairs) {
      const opportunity = await this.findArbitrageOpportunity(tokenA, tokenB, amountIn);
      
      if (opportunity) {
        // In production, you'd want to execute immediately or add to a priority queue
        console.log('💡 Opportunity found, would execute if profitable after gas costs');
        
        // For now, just log it
        await this.executeArbitrage(opportunity);
      }
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  async start() {
    console.log('🚀 Starting V2/V3 Arbitrage Bot...');
    console.log(`💰 Minimum profit threshold: ${this.minProfitThreshold}%`);
    
    // Run initial scan
    await this.scanForOpportunities();
    
    // Set up continuous monitoring (every 30 seconds)
    setInterval(async () => {
      await this.scanForOpportunities();
    }, 30000);
  }
}

module.exports = ArbitrageBot;