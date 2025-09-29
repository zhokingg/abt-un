/**
 * Multi-chain network configurations
 * Defines supported networks and their parameters for comprehensive arbitrage support
 */

const networks = {
  // Ethereum Mainnet
  ethereum: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    shortName: 'ETH',
    rpcUrls: [
      'https://mainnet.infura.io/v3/YOUR_INFURA_KEY',
      'https://eth-mainnet.alchemyapi.io/v2/YOUR_ALCHEMY_KEY',
      'https://rpc.ankr.com/eth',
      'https://cloudflare-eth.com',
      'https://ethereum.publicnode.com',
      'https://nodes.mewapi.io/rpc/eth'
    ],
    blockExplorer: {
      name: 'Etherscan', 
      url: 'https://etherscan.io',
      apiUrl: 'https://api.etherscan.io/api'
    },
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    contracts: {
      // Uniswap V2
      uniswapV2Factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
      uniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
      uniswapV2InitCodeHash: '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
      
      // Uniswap V3
      uniswapV3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      uniswapV3Quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
      uniswapV3QuoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
      uniswapV3PositionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
      
      // SushiSwap
      sushiswapFactory: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
      sushiswapRouter: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
      
      // Flash Loan Providers
      aaveV3Pool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
      aaveV3DataProvider: '0x7B4EB56E7CD4b454BA8ff71E4518426369a138a3',
      balancerVault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
      dydxSoloMargin: '0x1E0447b19BB6EcFdAe1e4AE1694b0C3659614e4e',
      
      // Price Oracles
      chainlinkRegistry: '0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf',
      uniswapV3Oracle: '0x0F1f5A87f99f0918e6C81F16E59F3518698221Ff',
      
      // Multicall
      multicall3: '0xcA11bde05977b3631167028862bE2a173976CA11',
      
      // 1inch
      oneInchV5Router: '0x1111111254EEB25477B68fb85Ed929f73A960582'
    },
    gasSettings: {
      standard: 21000,
      eip1559: true,
      maxFeePerGas: 100, // gwei
      maxPriorityFeePerGas: 2, // gwei
      gasLimit: 500000,
      gasLimitMultiplier: 1.2
    },
    blockTime: 12, // seconds
    confirmations: 1,
    enabled: true,
    isTestnet: false,
    features: ['flashLoans', 'uniswapV2', 'uniswapV3', 'sushiswap', 'aave', 'balancer', '1inch']
  },
  
  // Polygon (Matic)
  polygon: {
    chainId: 137,
    name: 'Polygon Mainnet',
    shortName: 'MATIC',
    rpcUrls: [
      'https://polygon-rpc.com',
      'https://rpc-mainnet.matic.network',
      'https://rpc.ankr.com/polygon',
      'https://polygon.llamarpc.com',
      'https://polygon-mainnet.public.blastapi.io',
      'https://matic-mainnet.chainstacklabs.com'
    ],
    blockExplorer: {
      name: 'PolygonScan',
      url: 'https://polygonscan.com',
      apiUrl: 'https://api.polygonscan.com/api'
    },
    nativeCurrency: {
      name: 'Polygon',
      symbol: 'MATIC',
      decimals: 18
    },
    contracts: {
      // QuickSwap (Uniswap V2 fork)
      uniswapV2Factory: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32',
      uniswapV2Router: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
      
      // Uniswap V3
      uniswapV3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      uniswapV3Quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
      
      // SushiSwap
      sushiswapFactory: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
      sushiswapRouter: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
      
      // Flash Loan Providers
      aaveV3Pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
      balancerVault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
      
      // Multicall
      multicall3: '0xcA11bde05977b3631167028862bE2a173976CA11'
    },
    gasSettings: {
      standard: 21000,
      eip1559: true,
      maxFeePerGas: 300, // gwei
      maxPriorityFeePerGas: 30, // gwei
      gasLimit: 500000,
      gasLimitMultiplier: 1.2
    },
    blockTime: 2, // seconds
    confirmations: 3,
    enabled: false,
    isTestnet: false,
    features: ['flashLoans', 'uniswapV2', 'uniswapV3', 'sushiswap', 'aave', 'quickswap']
  },
  
  // Arbitrum One
  arbitrum: {
    chainId: 42161,
    name: 'Arbitrum One',
    shortName: 'ARB',
    rpcUrls: [
      'https://arb1.arbitrum.io/rpc',
      'https://rpc.ankr.com/arbitrum',
      'https://arbitrum-mainnet.infura.io/v3/YOUR_INFURA_KEY',
      'https://arbitrum.llamarpc.com',
      'https://arbitrum-one.public.blastapi.io'
    ],
    blockExplorer: {
      name: 'Arbiscan',
      url: 'https://arbiscan.io',
      apiUrl: 'https://api.arbiscan.io/api'
    },
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    contracts: {
      // Uniswap V2 (SushiSwap fork)
      uniswapV2Factory: '0xf1D7CC64Fb4452F05c498126312eBE29f30Fbcf9',
      uniswapV2Router: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24',
      
      // Uniswap V3
      uniswapV3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      uniswapV3Quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
      
      // SushiSwap
      sushiswapFactory: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
      sushiswapRouter: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
      
      // Camelot (Native DEX)
      camelotFactory: '0x6EcCab422D763aC031210895C81787E87B91425',
      camelotRouter: '0xc873fEcbd354f5A56E00E710B90EF4201db2448d',
      
      // Flash Loan Providers
      aaveV3Pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
      balancerVault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
      
      // Multicall
      multicall3: '0xcA11bde05977b3631167028862bE2a173976CA11'
    },
    gasSettings: {
      standard: 21000,
      eip1559: true,
      maxFeePerGas: 10, // gwei
      maxPriorityFeePerGas: 1, // gwei
      gasLimit: 800000,
      gasLimitMultiplier: 1.1
    },
    blockTime: 0.26, // seconds (very fast)
    confirmations: 1,
    enabled: false,
    isTestnet: false,
    features: ['flashLoans', 'uniswapV2', 'uniswapV3', 'sushiswap', 'aave', 'camelot']
  },

  // Optimism
  optimism: {
    chainId: 10,
    name: 'Optimism Mainnet',
    shortName: 'OP',
    rpcUrls: [
      'https://mainnet.optimism.io',
      'https://rpc.ankr.com/optimism',
      'https://optimism-mainnet.infura.io/v3/YOUR_INFURA_KEY',
      'https://opt-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY',
      'https://optimism.llamarpc.com'
    ],
    blockExplorer: {
      name: 'Optimistic Etherscan',
      url: 'https://optimistic.etherscan.io',
      apiUrl: 'https://api-optimistic.etherscan.io/api'
    },
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    contracts: {
      // Uniswap V3
      uniswapV3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      uniswapV3Quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
      
      // Velodrome (Native DEX)
      velodromeFactory: '0x25CbdDb98b35ab1FF77413456B31EC81A6B6B746',
      velodromeRouter: '0x9c12939390052919aF3155f41Bf4160Fd3666A6e',
      
      // Flash Loan Providers  
      aaveV3Pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
      
      // Multicall
      multicall3: '0xcA11bde05977b3631167028862bE2a173976CA11'
    },
    gasSettings: {
      standard: 21000,
      eip1559: true,
      maxFeePerGas: 10, // gwei
      maxPriorityFeePerGas: 1, // gwei
      gasLimit: 800000,
      gasLimitMultiplier: 1.1
    },
    blockTime: 2, // seconds
    confirmations: 1,
    enabled: false,
    isTestnet: false,
    features: ['flashLoans', 'uniswapV3', 'aave', 'velodrome']
  },

  // Base (Coinbase L2)
  base: {
    chainId: 8453,
    name: 'Base Mainnet',
    shortName: 'BASE',
    rpcUrls: [
      'https://mainnet.base.org',
      'https://base-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY',
      'https://rpc.ankr.com/base',
      'https://base.llamarpc.com',
      'https://base-mainnet.public.blastapi.io'
    ],
    blockExplorer: {
      name: 'BaseScan',
      url: 'https://basescan.org',
      apiUrl: 'https://api.basescan.org/api'
    },
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    contracts: {
      // Uniswap V3
      uniswapV3Factory: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
      uniswapV3Router: '0x2626664c2603336E57B271c5C0b26F421741e481',
      uniswapV3Quoter: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
      
      // SushiSwap
      sushiswapFactory: '0x71524B4f93c58fcbF659783284E38825f0622859',
      sushiswapRouter: '0x6BDED42c6DA8FBf0d2bA55B2fa120C5e0c8D7891',
      
      // Multicall
      multicall3: '0xcA11bde05977b3631167028862bE2a173976CA11'
    },
    gasSettings: {
      standard: 21000,
      eip1559: true,
      maxFeePerGas: 10, // gwei
      maxPriorityFeePerGas: 1, // gwei
      gasLimit: 500000,
      gasLimitMultiplier: 1.1
    },
    blockTime: 2, // seconds
    confirmations: 1,
    enabled: false,
    isTestnet: false,
    features: ['uniswapV3', 'sushiswap']
  },

  // Binance Smart Chain
  bsc: {
    chainId: 56,
    name: 'Binance Smart Chain',
    shortName: 'BSC',
    rpcUrls: [
      'https://bsc-dataseed1.binance.org',
      'https://bsc-dataseed2.binance.org',
      'https://bsc-dataseed.binance.org',
      'https://rpc.ankr.com/bsc',
      'https://bsc.publicnode.com'
    ],
    blockExplorer: {
      name: 'BscScan',
      url: 'https://bscscan.com',
      apiUrl: 'https://api.bscscan.com/api'
    },
    nativeCurrency: {
      name: 'Binance Coin',
      symbol: 'BNB',
      decimals: 18
    },
    contracts: {
      // PancakeSwap V2
      uniswapV2Factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
      uniswapV2Router: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
      
      // PancakeSwap V3
      uniswapV3Factory: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',
      uniswapV3Router: '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4',
      uniswapV3Quoter: '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997',
      
      // SushiSwap (limited)
      sushiswapFactory: '0xc0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
      sushiswapRouter: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
      
      // Venus (Aave alternative)
      venusComptroller: '0xfD36E2c2a6789Db23113685031d7F16329158384',
      
      // Multicall
      multicall3: '0xcA11bde05977b3631167028862bE2a173976CA11'
    },
    gasSettings: {
      standard: 21000,
      eip1559: false, // BSC doesn't support EIP-1559
      gasPrice: 5000000000, // 5 gwei
      gasLimit: 500000,
      gasLimitMultiplier: 1.2
    },
    blockTime: 3, // seconds
    confirmations: 3,
    enabled: false,
    isTestnet: false,
    features: ['uniswapV2', 'uniswapV3', 'pancakeswap', 'venus']
  },
  
  // === TESTNETS ===
  
  // Ethereum Goerli Testnet
  goerli: {
    chainId: 5,
    name: 'Goerli Testnet',
    shortName: 'GoerliETH',
    rpcUrls: [
      'https://goerli.infura.io/v3/YOUR_INFURA_KEY',
      'https://rpc.ankr.com/eth_goerli',
      'https://goerli.blockpi.network/v1/rpc/public'
    ],
    blockExplorer: {
      name: 'Goerli Etherscan',
      url: 'https://goerli.etherscan.io',
      apiUrl: 'https://api-goerli.etherscan.io/api'
    },
    nativeCurrency: {
      name: 'Goerli Ether',
      symbol: 'GoerliETH',
      decimals: 18
    },
    contracts: {
      uniswapV2Factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
      uniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
      uniswapV3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      multicall3: '0xcA11bde05977b3631167028862bE2a173976CA11'
    },
    gasSettings: {
      standard: 21000,
      eip1559: true,
      maxFeePerGas: 50,
      maxPriorityFeePerGas: 2,
      gasLimit: 500000,
      gasLimitMultiplier: 1.2
    },
    blockTime: 12,
    confirmations: 1,
    enabled: false,
    isTestnet: true,
    features: ['uniswapV2', 'uniswapV3']
  },

  // Ethereum Sepolia Testnet
  sepolia: {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    shortName: 'SepoliaETH',
    rpcUrls: [
      'https://sepolia.infura.io/v3/YOUR_INFURA_KEY',
      'https://rpc.ankr.com/eth_sepolia',
      'https://sepolia.blockpi.network/v1/rpc/public'
    ],
    blockExplorer: {
      name: 'Sepolia Etherscan',
      url: 'https://sepolia.etherscan.io',
      apiUrl: 'https://api-sepolia.etherscan.io/api'
    },
    nativeCurrency: {
      name: 'Sepolia Ether',
      symbol: 'SepoliaETH',
      decimals: 18
    },
    contracts: {
      uniswapV3Factory: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c',
      uniswapV3Router: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E',
      multicall3: '0xcA11bde05977b3631167028862bE2a173976CA11'
    },
    gasSettings: {
      standard: 21000,
      eip1559: true,
      maxFeePerGas: 50,
      maxPriorityFeePerGas: 2,
      gasLimit: 500000,
      gasLimitMultiplier: 1.2
    },
    blockTime: 12,
    confirmations: 1,
    enabled: false,
    isTestnet: true,
    features: ['uniswapV3']
  },

  // Polygon Mumbai Testnet
  mumbai: {
    chainId: 80001,
    name: 'Mumbai Testnet',
    shortName: 'MumbaiMATIC',
    rpcUrls: [
      'https://rpc-mumbai.maticvigil.com',
      'https://rpc.ankr.com/polygon_mumbai',
      'https://polygon-mumbai.g.alchemy.com/v2/YOUR_ALCHEMY_KEY'
    ],
    blockExplorer: {
      name: 'Mumbai PolygonScan',
      url: 'https://mumbai.polygonscan.com',
      apiUrl: 'https://api-testnet.polygonscan.com/api'
    },
    nativeCurrency: {
      name: 'Mumbai Matic',
      symbol: 'MumbaiMATIC',
      decimals: 18
    },
    contracts: {
      uniswapV3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      multicall3: '0xcA11bde05977b3631167028862bE2a173976CA11'
    },
    gasSettings: {
      standard: 21000,
      eip1559: true,
      maxFeePerGas: 100,
      maxPriorityFeePerGas: 30,
      gasLimit: 500000,
      gasLimitMultiplier: 1.2
    },
    blockTime: 2,
    confirmations: 3,
    enabled: false,
    isTestnet: true,
    features: ['uniswapV3']
  }
};

/**
 * Get network configuration by chain ID
 */
export function getNetworkByChainId(chainId) {
  return Object.values(networks).find(network => network.chainId === chainId);
}

/**
 * Get network configuration by name
 */
export function getNetwork(networkName) {
  return networks[networkName];
}

/**
 * Get all enabled networks
 */
export function getEnabledNetworks() {
  return Object.entries(networks)
    .filter(([_, config]) => config.enabled)
    .reduce((acc, [name, config]) => {
      acc[name] = config;
      return acc;
    }, {});
}

/**
 * Get all mainnet networks
 */
export function getMainnetNetworks() {
  return Object.entries(networks)
    .filter(([_, config]) => !config.isTestnet)
    .reduce((acc, [name, config]) => {
      acc[name] = config;
      return acc;
    }, {});
}

/**
 * Get all testnet networks
 */
export function getTestnetNetworks() {
  return Object.entries(networks)
    .filter(([_, config]) => config.isTestnet)
    .reduce((acc, [name, config]) => {
      acc[name] = config;
      return acc;
    }, {});
}

/**
 * Check if network supports a specific feature
 */
export function networkSupportsFeature(networkName, feature) {
  const network = networks[networkName];
  return network && network.features && network.features.includes(feature);
}

/**
 * Get networks that support a specific feature
 */
export function getNetworksByFeature(feature) {
  return Object.entries(networks)
    .filter(([_, config]) => config.features && config.features.includes(feature))
    .reduce((acc, [name, config]) => {
      acc[name] = config;
      return acc;
    }, {});
}

/**
 * Get primary RPC URL for a network (with fallback handling)
 */
export function getPrimaryRpcUrl(networkName) {
  const network = networks[networkName];
  if (!network || !network.rpcUrls || network.rpcUrls.length === 0) {
    throw new Error(`No RPC URLs configured for network: ${networkName}`);
  }
  
  // Return first non-placeholder URL
  for (const url of network.rpcUrls) {
    if (!url.includes('YOUR_INFURA_KEY') && !url.includes('YOUR_ALCHEMY_KEY')) {
      return url;
    }
  }
  
  // If all URLs are placeholders, return the first one with a warning
  console.warn(`⚠️ All RPC URLs for ${networkName} contain placeholders`);
  return network.rpcUrls[0];
}

/**
 * Validate network configuration
 */
export function validateNetworkConfig(networkName) {
  const network = networks[networkName];
  if (!network) {
    return { isValid: false, error: `Network ${networkName} not found` };
  }

  const requiredFields = ['chainId', 'name', 'rpcUrls', 'nativeCurrency', 'contracts'];
  for (const field of requiredFields) {
    if (!network[field]) {
      return { isValid: false, error: `Missing required field: ${field}` };
    }
  }

  if (!Array.isArray(network.rpcUrls) || network.rpcUrls.length === 0) {
    return { isValid: false, error: 'At least one RPC URL is required' };
  }

  return { isValid: true };
}

/**
 * Get network summary for display
 */
export function getNetworkSummary() {
  const summary = {
    total: Object.keys(networks).length,
    enabled: 0,
    mainnets: 0,
    testnets: 0,
    byFeature: {}
  };

  for (const [_, config] of Object.entries(networks)) {
    if (config.enabled) summary.enabled++;
    if (config.isTestnet) {
      summary.testnets++;
    } else {
      summary.mainnets++;
    }

    if (config.features) {
      for (const feature of config.features) {
        summary.byFeature[feature] = (summary.byFeature[feature] || 0) + 1;
      }
    }
  }

  return summary;
}

export default networks;