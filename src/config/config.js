require('dotenv').config();

const config = {
  // Network Configuration
  RPC_URL: process.env.RPC_URL || 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY',
  CHAIN_ID: parseInt(process.env.CHAIN_ID) || 1,
  
  // Redis Configuration
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // Uniswap Contract Addresses (Mainnet)
  UNISWAP_V2_FACTORY: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
  UNISWAP_V2_ROUTER: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  UNISWAP_V3_FACTORY: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  UNISWAP_V3_QUOTER: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
  
  // Trading Configuration
  MIN_PROFIT_THRESHOLD: parseFloat(process.env.MIN_PROFIT_THRESHOLD) || 0.5, // 0.5%
  MAX_TRADE_AMOUNT: parseFloat(process.env.MAX_TRADE_AMOUNT) || 1000, // $1000
  SLIPPAGE_TOLERANCE: parseFloat(process.env.SLIPPAGE_TOLERANCE) || 0.1, // 0.1%
  
  // Token Addresses (Mainnet)
  TOKENS: {
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    USDC: '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F'
  },
  
  // Monitoring Configuration
  PRICE_CHECK_INTERVAL: parseInt(process.env.PRICE_CHECK_INTERVAL) || 5000, // 5 seconds
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  
  // API Configuration
  COINGECKO_API_KEY: process.env.COINGECKO_API_KEY || '',
  
  // Safety Configuration
  DRY_RUN: process.env.DRY_RUN === 'true' || true, // Default to dry run
  PRIVATE_KEY: process.env.PRIVATE_KEY || '',
  
  // Development
  NODE_ENV: process.env.NODE_ENV || 'development'
};

// Validation
if (!config.RPC_URL.includes('YOUR_INFURA_KEY') && config.NODE_ENV === 'production') {
  console.log('✅ RPC URL configured');
} else if (config.NODE_ENV === 'production') {
  console.warn('⚠️  Warning: Using default RPC URL in production');
}

module.exports = config;