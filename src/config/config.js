require('dotenv').config();

class ConfigValidator {
  static validateRequired(config, requiredFields) {
    const missing = [];
    for (const field of requiredFields) {
      if (!config[field] || config[field] === '' || config[field].includes('YOUR_')) {
        missing.push(field);
      }
    }
    return missing;
  }

  static validateRange(value, min, max, fieldName) {
    if (isNaN(value) || value < min || value > max) {
      throw new Error(`${fieldName} must be between ${min} and ${max}, got: ${value}`);
    }
  }

  static validateUrl(url, fieldName) {
    try {
      new URL(url);
      if (!url.startsWith('http') && !url.startsWith('ws')) {
        throw new Error(`${fieldName} must be a valid HTTP or WebSocket URL`);
      }
    } catch (error) {
      throw new Error(`${fieldName} must be a valid URL: ${error.message}`);
    }
  }
}

const config = {
  // Network Configuration
  RPC_URL: process.env.RPC_URL || process.env.ETHEREUM_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY',
  ETHEREUM_RPC_URL: process.env.ETHEREUM_RPC_URL || process.env.RPC_URL || 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY',
  CHAIN_ID: parseInt(process.env.CHAIN_ID) || 1,
  WS_RPC_URL: process.env.WS_RPC_URL || '',
  
  // Cache Configuration
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  REDIS_TTL: parseInt(process.env.REDIS_TTL) || 300,
  CACHE_ENABLED: process.env.CACHE_ENABLED === 'true' || true,
  
  // Uniswap Contract Addresses (Mainnet)
  UNISWAP_V2_FACTORY: process.env.UNISWAP_V2_FACTORY || '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
  UNISWAP_V2_ROUTER: process.env.UNISWAP_V2_ROUTER || '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  UNISWAP_V3_FACTORY: process.env.UNISWAP_V3_FACTORY || '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  UNISWAP_V3_QUOTER: process.env.UNISWAP_V3_QUOTER || '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
  
  // Sushiswap Contract Addresses (Mainnet)
  SUSHISWAP_ROUTER: process.env.SUSHISWAP_ROUTER || '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
  SUSHISWAP_FACTORY: process.env.SUSHISWAP_FACTORY || '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
  
  // Trading Configuration
  MIN_PROFIT_THRESHOLD: parseFloat(process.env.MIN_PROFIT_THRESHOLD) || 0.5, // 0.5%
  MAX_TRADE_AMOUNT: parseFloat(process.env.MAX_TRADE_AMOUNT) || 1000, // $1000
  SLIPPAGE_TOLERANCE: parseFloat(process.env.SLIPPAGE_TOLERANCE) || 0.1, // 0.1%
  MAX_GAS_PRICE: parseFloat(process.env.MAX_GAS_PRICE) || 50, // 50 gwei
  GAS_LIMIT: parseInt(process.env.GAS_LIMIT) || 300000,
  TARGET_PROFIT_USD: parseFloat(process.env.TARGET_PROFIT_USD) || 50,
  MAX_SLIPPAGE: parseFloat(process.env.MAX_SLIPPAGE) || 2.0, // 2%
  
  // Token Addresses (Mainnet)
  TOKENS: {
    WETH: process.env.WETH_ADDRESS || '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    USDC: process.env.USDC_ADDRESS || '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB',
    USDT: process.env.USDT_ADDRESS || '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI: process.env.DAI_ADDRESS || '0x6B175474E89094C44Da98b954EedeAC495271d0F'
  },
  
  // Monitoring Configuration
  PRICE_CHECK_INTERVAL: parseInt(process.env.PRICE_CHECK_INTERVAL) || 5000, // 5 seconds
  BLOCK_CONFIRMATION_COUNT: parseInt(process.env.BLOCK_CONFIRMATION_COUNT) || 1,
  HEALTH_CHECK_INTERVAL: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  ENABLE_METRICS: process.env.ENABLE_METRICS === 'true' || true,
  
  // API Configuration
  COINGECKO_API_KEY: process.env.COINGECKO_API_KEY || '',
  ALCHEMY_API_KEY: process.env.ALCHEMY_API_KEY || '',
  MORALIS_API_KEY: process.env.MORALIS_API_KEY || '',
  
  // Safety Configuration
  DRY_RUN: process.env.DRY_RUN === 'true' || true, // Default to dry run
  PRIVATE_KEY: process.env.PRIVATE_KEY || '',
  ENABLE_FLASHLOAN: process.env.ENABLE_FLASHLOAN === 'true' || false,
  MIN_LIQUIDITY_USD: parseFloat(process.env.MIN_LIQUIDITY_USD) || 10000,
  WALLET_BALANCE_THRESHOLD: parseFloat(process.env.WALLET_BALANCE_THRESHOLD) || 0.05, // 0.05 ETH
  
  // Development
  NODE_ENV: process.env.NODE_ENV || 'development',
  DEBUG: process.env.DEBUG === 'true' || false,
  ENABLE_SIMULATION: process.env.ENABLE_SIMULATION === 'true' || true
};

// Validation
function validateConfig() {
  const errors = [];
  
  try {
    // Validate numeric ranges
    ConfigValidator.validateRange(config.MIN_PROFIT_THRESHOLD, 0, 100, 'MIN_PROFIT_THRESHOLD');
    ConfigValidator.validateRange(config.MAX_TRADE_AMOUNT, 1, 1000000, 'MAX_TRADE_AMOUNT');
    ConfigValidator.validateRange(config.SLIPPAGE_TOLERANCE, 0, 10, 'SLIPPAGE_TOLERANCE');
    ConfigValidator.validateRange(config.MAX_GAS_PRICE, 1, 1000, 'MAX_GAS_PRICE');
    ConfigValidator.validateRange(config.GAS_LIMIT, 21000, 8000000, 'GAS_LIMIT');
    ConfigValidator.validateRange(config.MAX_SLIPPAGE, 0, 50, 'MAX_SLIPPAGE');
    
    // Validate URLs if not using defaults
    if (!config.RPC_URL.includes('YOUR_INFURA_KEY')) {
      ConfigValidator.validateUrl(config.RPC_URL, 'RPC_URL');
    }
    
    if (config.WS_RPC_URL && config.WS_RPC_URL !== '') {
      ConfigValidator.validateUrl(config.WS_RPC_URL, 'WS_RPC_URL');
    }
    
    // Production environment validation
    if (config.NODE_ENV === 'production') {
      const requiredProd = ['RPC_URL', 'PRIVATE_KEY'];
      const missing = ConfigValidator.validateRequired({
        RPC_URL: config.RPC_URL,
        PRIVATE_KEY: config.PRIVATE_KEY
      }, requiredProd);
      
      if (missing.length > 0) {
        errors.push(`Production environment missing required fields: ${missing.join(', ')}`);
      }
      
      if (config.RPC_URL.includes('YOUR_INFURA_KEY')) {
        errors.push('Production environment cannot use default RPC URL');
      }
      
      if (config.DRY_RUN) {
        console.warn('⚠️  Warning: DRY_RUN is enabled in production');
      }
    }
    
    // Address validation (basic format check)
    const addresses = [
      'UNISWAP_V2_FACTORY', 'UNISWAP_V2_ROUTER', 'UNISWAP_V3_FACTORY', 
      'UNISWAP_V3_QUOTER', 'SUSHISWAP_ROUTER', 'SUSHISWAP_FACTORY'
    ];
    
    for (const addr of addresses) {
      if (config[addr] && !config[addr].match(/^0x[a-fA-F0-9]{40}$/)) {
        errors.push(`Invalid Ethereum address format for ${addr}: ${config[addr]}`);
      }
    }
    
    // Token address validation
    for (const [token, address] of Object.entries(config.TOKENS)) {
      if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
        errors.push(`Invalid token address for ${token}: ${address}`);
      }
    }
    
  } catch (error) {
    errors.push(error.message);
  }
  
  if (errors.length > 0) {
    console.error('❌ Configuration validation failed:');
    errors.forEach(error => console.error(`   - ${error}`));
    
    if (config.NODE_ENV === 'production') {
      throw new Error('Configuration validation failed in production environment');
    } else {
      console.warn('⚠️  Configuration warnings in development environment');
    }
  } else {
    console.log('✅ Configuration validation passed');
  }
}

// Initialize and validate configuration
try {
  validateConfig();
  
  // Log configuration status
  if (!config.RPC_URL.includes('YOUR_INFURA_KEY') && config.NODE_ENV === 'production') {
    console.log('✅ RPC URL configured');
  } else if (config.NODE_ENV === 'production') {
    console.warn('⚠️  Warning: Using default RPC URL in production');
  }
  
  if (config.CACHE_ENABLED) {
    console.log('✅ Redis caching enabled');
  }
  
  if (config.DRY_RUN) {
    console.log('🧪 Running in DRY RUN mode - no real transactions will be executed');
  }
  
} catch (error) {
  console.error('❌ Configuration initialization failed:', error.message);
  process.exit(1);
}

module.exports = config;