/**
 * Protocol addresses and constants
 * Centralized constants for the arbitrage system
 */

// Protocol addresses by network
export const PROTOCOL_ADDRESSES = {
  ethereum: {
    // Uniswap V2
    UNISWAP_V2_FACTORY: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    UNISWAP_V2_ROUTER: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    UNISWAP_V2_INIT_CODE_HASH: '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
    
    // Uniswap V3
    UNISWAP_V3_FACTORY: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    UNISWAP_V3_ROUTER: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    UNISWAP_V3_QUOTER: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
    UNISWAP_V3_QUOTER_V2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
    UNISWAP_V3_POSITION_MANAGER: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    
    // SushiSwap
    SUSHISWAP_FACTORY: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
    SUSHISWAP_ROUTER: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
    
    // Aave V3
    AAVE_V3_POOL: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
    AAVE_V3_POOL_DATA_PROVIDER: '0x7B4EB56E7CD4b454BA8ff71E4518426369a138a3',
    AAVE_V3_ORACLE: '0x54586bE62E3c3580375aE3723C145253060Ca0C2',
    
    // Compound V3
    COMPOUND_V3_USDC: '0xc3d688B66703497DAA19211EEdff47f25384cdc3',
    COMPOUND_V3_ETH: '0xA17581A9E3356d9A858b789D68B4d866e593aE94',
    
    // Curve
    CURVE_REGISTRY: '0x90E00ACe148ca3b23Ac1bC8C240C2a7Dd9c2d7f5',
    CURVE_ADDRESS_PROVIDER: '0x0000000022D53366457F9d5E68Ec105046FC4383',
    
    // 1inch
    ONEINCH_V5_ROUTER: '0x1111111254EEB25477B68fb85Ed929f73A960582',
    
    // Balancer V2
    BALANCER_V2_VAULT: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    
    // MakerDAO
    MAKER_PSM_USDC: '0x89B78CfA322F6C5dE0aBcEecab66Aee45393cC5A',
    
    // Chainlink Price Feeds
    CHAINLINK_ETH_USD: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
    CHAINLINK_BTC_USD: '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c',
    CHAINLINK_USDC_USD: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6',
    
    // Flash Loan Providers
    DYDX_SOLO_MARGIN: '0x1E0447b19BB6EcFdAe1e4AE1694b0C3659614e4e',
    
    // Multicall
    MULTICALL3: '0xcA11bde05977b3631167028862bE2a173976CA11'
  },
  
  polygon: {
    // Uniswap V3
    UNISWAP_V3_FACTORY: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    UNISWAP_V3_ROUTER: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    UNISWAP_V3_QUOTER: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
    
    // QuickSwap (Uniswap V2 fork)
    QUICKSWAP_FACTORY: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32',
    QUICKSWAP_ROUTER: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
    
    // SushiSwap
    SUSHISWAP_FACTORY: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
    SUSHISWAP_ROUTER: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    
    // Aave V3
    AAVE_V3_POOL: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    
    // Multicall
    MULTICALL3: '0xcA11bde05977b3631167028862bE2a173976CA11'
  },
  
  arbitrum: {
    // Uniswap V3
    UNISWAP_V3_FACTORY: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    UNISWAP_V3_ROUTER: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    UNISWAP_V3_QUOTER: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
    
    // SushiSwap
    SUSHISWAP_FACTORY: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
    SUSHISWAP_ROUTER: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    
    // Camelot (Native DEX)
    CAMELOT_FACTORY: '0x6EcCab422D763aC031210895C81787E87B91425',
    CAMELOT_ROUTER: '0xc873fEcbd354f5A56E00E710B90EF4201db2448d',
    
    // Aave V3
    AAVE_V3_POOL: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    
    // Multicall
    MULTICALL3: '0xcA11bde05977b3631167028862bE2a173976CA11'
  }
};

// Trading constants
export const TRADING_CONSTANTS = {
  // Slippage tolerances (in percentage)
  MIN_SLIPPAGE: 0.001, // 0.1%
  DEFAULT_SLIPPAGE: 0.005, // 0.5%
  MAX_SLIPPAGE: 0.05, // 5%
  
  // Profit thresholds
  MIN_PROFIT_THRESHOLD: 0.001, // 0.1%
  DEFAULT_PROFIT_THRESHOLD: 0.005, // 0.5%
  HIGH_PROFIT_THRESHOLD: 0.02, // 2%
  
  // Trade size limits (in USD)
  MIN_TRADE_SIZE: 100,
  DEFAULT_TRADE_SIZE: 1000,
  MAX_TRADE_SIZE: 100000,
  
  // Gas limits
  SIMPLE_SWAP_GAS: 150000,
  COMPLEX_SWAP_GAS: 300000,
  FLASHLOAN_GAS: 350000,
  MEV_PROTECTION_GAS: 50000,
  
  // Time constants (in milliseconds)
  BLOCK_TIME: 12000, // 12 seconds average
  PRICE_VALIDITY: 30000, // 30 seconds
  QUOTE_VALIDITY: 10000, // 10 seconds
  MEV_WINDOW: 15000, // 15 seconds
  
  // Liquidity requirements (in USD)
  MIN_POOL_LIQUIDITY: 10000,
  RECOMMENDED_POOL_LIQUIDITY: 100000,
  HIGH_LIQUIDITY_THRESHOLD: 1000000
};

// Gas price constants (in gwei)
export const GAS_CONSTANTS = {
  // Base gas prices
  VERY_SLOW: 10,
  SLOW: 20,
  STANDARD: 30,
  FAST: 50,
  VERY_FAST: 100,
  
  // Max gas prices by network
  ETHEREUM_MAX: 300,
  POLYGON_MAX: 500,
  ARBITRUM_MAX: 50,
  OPTIMISM_MAX: 50,
  
  // Gas optimization
  OPTIMIZATION_THRESHOLD: 0.1, // 10% savings minimum
  BATCH_SIZE_THRESHOLD: 5, // Minimum trades for batching
  
  // EIP-1559 constants
  BASE_FEE_MULTIPLIER: 1.125, // 12.5% increase per block when full
  MAX_PRIORITY_FEE: 10 // gwei
};

// Protocol fees (in percentage)
export const PROTOCOL_FEES = {
  UNISWAP_V2: 0.003, // 0.3%
  UNISWAP_V3_LOW: 0.0005, // 0.05%
  UNISWAP_V3_MEDIUM: 0.003, // 0.3%
  UNISWAP_V3_HIGH: 0.01, // 1%
  SUSHISWAP: 0.003, // 0.3%
  CURVE: 0.0004, // 0.04% average
  BALANCER: 0.002, // 0.2% average
  
  // Flash loan fees
  AAVE_FLASH_LOAN: 0.0009, // 0.09%
  DYDX_FLASH_LOAN: 0.0002, // 0.02%
  UNISWAP_V3_FLASH: 0 // No fee, but must repay in same transaction
};

// Risk management constants
export const RISK_CONSTANTS = {
  // Position size limits (percentage of total capital)
  MAX_POSITION_SIZE: 0.3, // 30%
  RECOMMENDED_POSITION_SIZE: 0.1, // 10%
  CONSERVATIVE_POSITION_SIZE: 0.05, // 5%
  
  // Drawdown limits
  MAX_DAILY_DRAWDOWN: 0.05, // 5%
  MAX_TOTAL_DRAWDOWN: 0.2, // 20%
  STOP_LOSS_THRESHOLD: 0.03, // 3%
  
  // Volatility thresholds
  LOW_VOLATILITY: 0.02, // 2%
  MEDIUM_VOLATILITY: 0.05, // 5%
  HIGH_VOLATILITY: 0.1, // 10%
  
  // Correlation limits
  MAX_CORRELATION: 0.8, // 80%
  DIVERSIFICATION_THRESHOLD: 0.6 // 60%
};

// Performance constants
export const PERFORMANCE_CONSTANTS = {
  // Latency targets (in milliseconds)
  PRICE_UPDATE_TARGET: 1000,
  QUOTE_RESPONSE_TARGET: 500,
  EXECUTION_TARGET: 5000,
  
  // Success rate targets (percentage)
  MIN_SUCCESS_RATE: 80,
  TARGET_SUCCESS_RATE: 95,
  
  // Throughput targets
  MAX_CONCURRENT_TRADES: 10,
  MAX_QUOTES_PER_SECOND: 100,
  
  // Cache settings
  PRICE_CACHE_TTL: 10000, // 10 seconds
  LIQUIDITY_CACHE_TTL: 30000, // 30 seconds
  ROUTE_CACHE_TTL: 60000 // 1 minute
};

// Network constants
export const NETWORK_CONSTANTS = {
  // Chain IDs
  ETHEREUM_MAINNET: 1,
  ETHEREUM_GOERLI: 5,
  ETHEREUM_SEPOLIA: 11155111,
  POLYGON_MAINNET: 137,
  POLYGON_MUMBAI: 80001,
  ARBITRUM_ONE: 42161,
  ARBITRUM_GOERLI: 421613,
  OPTIMISM_MAINNET: 10,
  OPTIMISM_GOERLI: 420,
  
  // Block confirmations
  ETHEREUM_CONFIRMATIONS: 2,
  POLYGON_CONFIRMATIONS: 5,
  ARBITRUM_CONFIRMATIONS: 1,
  OPTIMISM_CONFIRMATIONS: 1,
  
  // RPC rate limits (requests per second)
  INFURA_RATE_LIMIT: 10,
  ALCHEMY_RATE_LIMIT: 25,
  PUBLIC_RPC_RATE_LIMIT: 5
};

// Error codes
export const ERROR_CODES = {
  // Network errors
  RPC_ERROR: 'RPC_ERROR',
  NETWORK_CONGESTION: 'NETWORK_CONGESTION',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  
  // Trading errors
  SLIPPAGE_EXCEEDED: 'SLIPPAGE_EXCEEDED',
  INSUFFICIENT_LIQUIDITY: 'INSUFFICIENT_LIQUIDITY',
  PRICE_IMPACT_TOO_HIGH: 'PRICE_IMPACT_TOO_HIGH',
  DEADLINE_EXCEEDED: 'DEADLINE_EXCEEDED',
  
  // MEV errors
  TRANSACTION_REVERTED: 'TRANSACTION_REVERTED',
  FRONTRUN_DETECTED: 'FRONTRUN_DETECTED',
  GAS_PRICE_TOO_LOW: 'GAS_PRICE_TOO_LOW',
  
  // System errors
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR'
};

// Event types
export const EVENT_TYPES = {
  // Engine events
  ENGINE_STARTED: 'engineStarted',
  ENGINE_STOPPED: 'engineStopped',
  ENGINE_ERROR: 'engineError',
  
  // Opportunity events
  OPPORTUNITY_DETECTED: 'opportunityDetected',
  OPPORTUNITY_EXECUTED: 'opportunityExecuted',
  OPPORTUNITY_FAILED: 'opportunityFailed',
  
  // MEV events
  MEV_OPPORTUNITY: 'mevOpportunity',
  FRONTRUN_DETECTED: 'frontrunDetected',
  SANDWICH_DETECTED: 'sandwichDetected',
  
  // System events
  HEALTH_CHECK: 'healthCheck',
  EMERGENCY_STOP: 'emergencyStop',
  RATE_LIMIT_HIT: 'rateLimitHit',
  
  // Price events
  PRICE_UPDATE: 'priceUpdate',
  PRICE_DEVIATION: 'priceDeviation',
  LIQUIDITY_CHANGE: 'liquidityChange'
};

// Contract ABIs (simplified signatures)
export const CONTRACT_SIGNATURES = {
  // ERC20
  TRANSFER: '0xa9059cbb',
  TRANSFER_FROM: '0x23b872dd',
  APPROVE: '0x095ea7b3',
  BALANCE_OF: '0x70a08231',
  
  // Uniswap V2
  SWAP_EXACT_TOKENS_FOR_TOKENS: '0x38ed1739',
  SWAP_EXACT_ETH_FOR_TOKENS: '0x7ff36ab5',
  SWAP_EXACT_TOKENS_FOR_ETH: '0x18cbafe5',
  GET_AMOUNTS_OUT: '0xd06ca61f',
  
  // Uniswap V3
  EXACT_INPUT_SINGLE: '0x414bf389',
  EXACT_INPUT: '0xc04b8d59',
  EXACT_OUTPUT_SINGLE: '0xdb3e2198',
  EXACT_OUTPUT: '0x09b81346',
  
  // Flash loans
  FLASH_LOAN: '0xab9c4b5d',
  FLASH_LOAN_SIMPLE: '0x42b0b77c'
};

// Utility functions
export function getProtocolAddress(protocol, network = 'ethereum') {
  const networkAddresses = PROTOCOL_ADDRESSES[network];
  if (!networkAddresses) {
    throw new Error(`Network ${network} not supported`);
  }
  
  const address = networkAddresses[protocol];
  if (!address) {
    throw new Error(`Protocol ${protocol} not found on ${network}`);
  }
  
  return address;
}

export function getProtocolFee(protocol) {
  const fee = PROTOCOL_FEES[protocol];
  if (fee === undefined) {
    throw new Error(`Unknown protocol: ${protocol}`);
  }
  
  return fee;
}

export function getChainId(network) {
  const chainIds = {
    ethereum: NETWORK_CONSTANTS.ETHEREUM_MAINNET,
    polygon: NETWORK_CONSTANTS.POLYGON_MAINNET,
    arbitrum: NETWORK_CONSTANTS.ARBITRUM_ONE,
    optimism: NETWORK_CONSTANTS.OPTIMISM_MAINNET
  };
  
  const chainId = chainIds[network];
  if (!chainId) {
    throw new Error(`Unknown network: ${network}`);
  }
  
  return chainId;
}

export function isTestnet(chainId) {
  const testnets = [
    NETWORK_CONSTANTS.ETHEREUM_GOERLI,
    NETWORK_CONSTANTS.ETHEREUM_SEPOLIA,
    NETWORK_CONSTANTS.POLYGON_MUMBAI,
    NETWORK_CONSTANTS.ARBITRUM_GOERLI,
    NETWORK_CONSTANTS.OPTIMISM_GOERLI
  ];
  
  return testnets.includes(chainId);
}

export default {
  PROTOCOL_ADDRESSES,
  TRADING_CONSTANTS,
  GAS_CONSTANTS,
  PROTOCOL_FEES,
  RISK_CONSTANTS,
  PERFORMANCE_CONSTANTS,
  NETWORK_CONSTANTS,
  ERROR_CODES,
  EVENT_TYPES,
  CONTRACT_SIGNATURES,
  getProtocolAddress,
  getProtocolFee,
  getChainId,
  isTestnet
};