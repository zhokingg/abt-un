/**
 * Configuration Template for Executor Contracts
 * 
 * Copy this file to `executor-config.js` and customize for your deployment
 */

module.exports = {
  // Network configuration
  networks: {
    mainnet: {
      // Aave V3 addresses
      aavePoolAddressesProvider: "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e",
      
      // DEX Router addresses
      uniswapV2Router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
      uniswapV3Router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      sushiswapRouter: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
      
      // Token addresses
      weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      dai: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      
      // Flashbots relay (mainnet)
      flashbotsRelay: "0xDAFEA492D9c6733ae3d56b7Ed1ADB60692c98Bc5",
    },
    
    goerli: {
      aavePoolAddressesProvider: "0xC911B590248d127aD18546B186cC6B324e99F02c",
      uniswapV2Router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
      uniswapV3Router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      weth: "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
      usdc: "0x07865c6E87B9F70255377e024ace6630C1Eaa37F",
    },
    
    sepolia: {
      aavePoolAddressesProvider: "0x0496275d34753A48320CA58103d5220d394FF77F",
      uniswapV2Router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
      uniswapV3Router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      weth: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
    },
    
    localhost: {
      // For testing, use mainnet fork addresses
      aavePoolAddressesProvider: "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e",
      uniswapV2Router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
      uniswapV3Router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      sushiswapRouter: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
    }
  },
  
  // FlashLoanExecutor configuration
  flashLoanExecutor: {
    // Maximum number of assets in a single flash loan
    maxAssets: 10,
    
    // Protocol fees (in basis points)
    aaveFlashLoanFeeBps: 9,  // 0.09%
    
    // Supported protocols (will be initialized in constructor)
    supportedProtocols: ["AAVE_V3"],
    
    // Emergency configurations
    emergencyStopDuration: 86400, // 24 hours
  },
  
  // ArbitrageExecutor configuration
  arbitrageExecutor: {
    // Maximum number of hops in arbitrage route
    maxHops: 5,
    
    // Slippage protection (basis points)
    maxSlippageBps: 500,  // 5%
    minProfitBps: 10,     // 0.1%
    
    // Gas optimization threshold
    gasOptimizationThreshold: 200000,
    
    // Supported DEX types
    supportedDEXs: ["UNISWAP_V2", "UNISWAP_V3", "SUSHISWAP"],
  },
  
  // MEVProtectedExecutor configuration
  mevProtectedExecutor: {
    // Treasury address (receives MEV protection fees)
    // Set to deployer initially, should be updated to multisig
    treasuryAddress: null, // Will be set to deployer if null
    
    // MEV protection fee (basis points)
    mevProtectionFeeBps: 50,  // 0.5%
    maxMEVFeeBps: 500,        // 5% maximum
    
    // Slippage protection
    slippageProtection: {
      maxSlippageBps: 100,           // 1%
      priceImpactThreshold: 200,     // 2%
      frontRunCheckWindow: 3,        // 3 blocks
      enabled: true
    },
    
    // Circuit breaker configuration
    circuitBreaker: {
      maxFailures: 5,
      windowDuration: 3600,      // 1 hour
      cooldownPeriod: 1800,      // 30 minutes
    },
    
    // Authorized relays (add addresses after deployment)
    authorizedRelays: [
      // Add relay addresses here
    ],
  },
  
  // Access control configuration
  accessControl: {
    // Operators (can execute trades)
    operators: [
      // Add operator addresses here
    ],
    
    // Emergency stoppers (can pause contracts)
    emergencyStoppers: [
      // Add emergency stopper addresses here
    ],
  },
  
  // Gas configuration
  gas: {
    // Gas price limits (in gwei)
    maxGasPrice: 500,
    
    // Gas limits for different operations
    limits: {
      flashLoan: 1000000,
      arbitrage: 800000,
      mevBundle: 1200000,
    }
  },
  
  // Monitoring and alerts
  monitoring: {
    // Enable event emission for all operations
    enableEvents: true,
    
    // Alert thresholds
    alerts: {
      minProfitUSD: 100,
      maxLossUSD: 50,
      maxFailuresPerHour: 5,
    }
  }
};
