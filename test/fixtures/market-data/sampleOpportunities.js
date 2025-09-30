/**
 * Sample arbitrage opportunities for testing
 */

export const PROFITABLE_OPPORTUNITY = {
  id: 'test-opportunity-profitable-1',
  tokenPair: 'WETH-USDC',
  tokenA: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
  tokenB: '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB', // USDC
  buyExchange: 'uniswap_v2',
  sellExchange: 'uniswap_v3',
  buyPrice: 2000.00,
  sellPrice: 2010.50,
  profitPercentage: 0.525,
  estimatedProfit: 10.50,
  gasEstimate: 300000,
  gasPriceGwei: 20,
  estimatedGasCost: 5.25,
  netProfit: 5.25,
  amountIn: '1000000', // 1 USDC (6 decimals)
  expectedAmountOut: '500250000000000', // ~0.5 ETH (18 decimals)
  slippage: 0.5,
  confidence: 0.85,
  timestamp: Date.now(),
  blockNumber: 18500000,
  minLiquidity: '100000000000000000000', // 100 ETH
  flashloanRequired: false
};

export const FLASHLOAN_OPPORTUNITY = {
  id: 'test-opportunity-flashloan-1',
  tokenPair: 'WETH-USDC',
  tokenA: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  tokenB: '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB',
  buyExchange: 'sushiswap',
  sellExchange: 'uniswap_v3',
  buyPrice: 1995.00,
  sellPrice: 2015.75,
  profitPercentage: 1.04,
  estimatedProfit: 207.50,
  gasEstimate: 450000,
  gasPriceGwei: 25,
  estimatedGasCost: 9.38,
  netProfit: 198.12,
  amountIn: '20000000000', // 20,000 USDC
  expectedAmountOut: '10050000000000000000', // ~10 ETH
  slippage: 0.3,
  confidence: 0.92,
  timestamp: Date.now(),
  blockNumber: 18500001,
  minLiquidity: '500000000000000000000', // 500 ETH
  flashloanRequired: true,
  flashloanProvider: 'aave',
  flashloanFee: 0.09, // 0.09% fee
  flashloanAmount: '20000000000' // 20,000 USDC
};

export const UNPROFITABLE_OPPORTUNITY = {
  id: 'test-opportunity-unprofitable-1',
  tokenPair: 'WETH-USDC',
  tokenA: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  tokenB: '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB',
  buyExchange: 'uniswap_v2',
  sellExchange: 'sushiswap',
  buyPrice: 2005.00,
  sellPrice: 2003.25,
  profitPercentage: -0.087,
  estimatedProfit: -1.75,
  gasEstimate: 280000,
  gasPriceGwei: 30,
  estimatedGasCost: 7.00,
  netProfit: -8.75,
  amountIn: '1000000',
  expectedAmountOut: '498750000000000',
  slippage: 0.5,
  confidence: 0.78,
  timestamp: Date.now(),
  blockNumber: 18500002,
  minLiquidity: '50000000000000000000', // 50 ETH
  flashloanRequired: false
};

export const HIGH_RISK_OPPORTUNITY = {
  id: 'test-opportunity-high-risk-1',
  tokenPair: 'SHIB-USDC',
  tokenA: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', // SHIB
  tokenB: '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB', // USDC
  buyExchange: 'uniswap_v2',
  sellExchange: 'uniswap_v3',
  buyPrice: 0.000008500,
  sellPrice: 0.000009200,
  profitPercentage: 8.24,
  estimatedProfit: 82.35,
  gasEstimate: 350000,
  gasPriceGwei: 40,
  estimatedGasCost: 11.67,
  netProfit: 70.68,
  amountIn: '1000000', // 1 USDC
  expectedAmountOut: '108235294117647058823529', // Large amount of SHIB
  slippage: 2.5, // High slippage for volatile token
  confidence: 0.45, // Low confidence due to volatility
  timestamp: Date.now(),
  blockNumber: 18500003,
  minLiquidity: '10000000000000000000', // 10 ETH equivalent
  flashloanRequired: false,
  riskFactors: ['high_volatility', 'low_liquidity', 'meme_token']
};

export const EXPIRED_OPPORTUNITY = {
  id: 'test-opportunity-expired-1',
  tokenPair: 'WETH-USDC',
  tokenA: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  tokenB: '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB',
  buyExchange: 'uniswap_v2',
  sellExchange: 'uniswap_v3',
  buyPrice: 2000.00,
  sellPrice: 2012.00,
  profitPercentage: 0.6,
  estimatedProfit: 12.00,
  gasEstimate: 300000,
  gasPriceGwei: 20,
  estimatedGasCost: 5.25,
  netProfit: 6.75,
  amountIn: '1000000',
  expectedAmountOut: '500000000000000',
  slippage: 0.5,
  confidence: 0.85,
  timestamp: Date.now() - 300000, // 5 minutes ago
  blockNumber: 18499995, // Old block
  minLiquidity: '100000000000000000000',
  flashloanRequired: false,
  isExpired: true
};

export const SAMPLE_OPPORTUNITIES = [
  PROFITABLE_OPPORTUNITY,
  FLASHLOAN_OPPORTUNITY,
  UNPROFITABLE_OPPORTUNITY,
  HIGH_RISK_OPPORTUNITY,
  EXPIRED_OPPORTUNITY
];

export default {
  PROFITABLE_OPPORTUNITY,
  FLASHLOAN_OPPORTUNITY,
  UNPROFITABLE_OPPORTUNITY,
  HIGH_RISK_OPPORTUNITY,
  EXPIRED_OPPORTUNITY,
  SAMPLE_OPPORTUNITIES
};