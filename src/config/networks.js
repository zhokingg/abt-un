/**
 * Multi-chain network configurations
 * Defines supported networks and their parameters
 */

const networks = {
  // Ethereum Mainnet
  ethereum: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    rpcUrls: [
      'https://mainnet.infura.io/v3/YOUR_INFURA_KEY',
      'https://eth-mainnet.alchemyapi.io/v2/YOUR_ALCHEMY_KEY',
      'https://rpc.ankr.com/eth',
      'https://cloudflare-eth.com'
    ],
    blockExplorer: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    contracts: {
      uniswapV2Factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
      uniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
      uniswapV3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      uniswapV3Quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
      aaveV3Pool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
      sushiswapFactory: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
      sushiswapRouter: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F'
    },
    gasSettings: {
      standard: 21000,
      eip1559: true,
      maxFeePerGas: 100, // gwei
      maxPriorityFeePerGas: 2 // gwei
    },
    enabled: true,
    isTestnet: false
  },
  
  // Polygon
  polygon: {
    chainId: 137,
    name: 'Polygon',
    rpcUrls: [
      'https://polygon-rpc.com',
      'https://rpc-mainnet.matic.network',
      'https://rpc.ankr.com/polygon'
    ],
    blockExplorer: 'https://polygonscan.com',
    nativeCurrency: {
      name: 'Polygon',
      symbol: 'MATIC',
      decimals: 18
    },
    contracts: {
      uniswapV2Factory: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32',
      uniswapV2Router: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
      uniswapV3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      sushiswapFactory: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
      sushiswapRouter: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
      aaveV3Pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD'
    },
    gasSettings: {
      standard: 21000,
      eip1559: true,
      maxFeePerGas: 300, // gwei
      maxPriorityFeePerGas: 30 // gwei
    },
    enabled: false,
    isTestnet: false
  },
  
  // Arbitrum One
  arbitrum: {
    chainId: 42161,
    name: 'Arbitrum One',
    rpcUrls: [
      'https://arb1.arbitrum.io/rpc',
      'https://rpc.ankr.com/arbitrum'
    ],
    blockExplorer: 'https://arbiscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    contracts: {
      uniswapV2Factory: '0xf1D7CC64Fb4452F05c498126312eBE29f30Fbcf9',
      uniswapV2Router: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24',
      uniswapV3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      sushiswapFactory: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
      sushiswapRouter: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
      aaveV3Pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD'
    },
    gasSettings: {
      standard: 21000,
      eip1559: true,
      maxFeePerGas: 10, // gwei
      maxPriorityFeePerGas: 1 // gwei
    },
    enabled: false,
    isTestnet: false
  },
  
  // Optimism
  optimism: {
    chainId: 10,
    name: 'Optimism',
    rpcUrls: [
      'https://mainnet.optimism.io',
      'https://rpc.ankr.com/optimism'
    ],
    blockExplorer: 'https://optimistic.etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    contracts: {
      uniswapV3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      aaveV3Pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD'
    },
    gasSettings: {
      standard: 21000,
      eip1559: true,
      maxFeePerGas: 10, // gwei
      maxPriorityFeePerGas: 1 // gwei
    },
    enabled: false,
    isTestnet: false
  },
  
  // Testnets
  goerli: {
    chainId: 5,
    name: 'Goerli Testnet',
    rpcUrls: [
      'https://goerli.infura.io/v3/YOUR_INFURA_KEY',
      'https://rpc.ankr.com/eth_goerli'
    ],
    blockExplorer: 'https://goerli.etherscan.io',
    nativeCurrency: {
      name: 'Goerli Ether',
      symbol: 'GoerliETH',
      decimals: 18
    },
    contracts: {
      uniswapV2Factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
      uniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
      uniswapV3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564'
    },
    gasSettings: {
      standard: 21000,
      eip1559: true,
      maxFeePerGas: 50, // gwei
      maxPriorityFeePerGas: 2 // gwei
    },
    enabled: false,
    isTestnet: true
  },
  
  sepolia: {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    rpcUrls: [
      'https://sepolia.infura.io/v3/YOUR_INFURA_KEY',
      'https://rpc.ankr.com/eth_sepolia'
    ],
    blockExplorer: 'https://sepolia.etherscan.io',
    nativeCurrency: {
      name: 'Sepolia Ether',
      symbol: 'SepoliaETH',
      decimals: 18
    },
    contracts: {
      uniswapV2Factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
      uniswapV2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
      uniswapV3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564'
    },
    gasSettings: {
      standard: 21000,
      eip1559: true,
      maxFeePerGas: 50, // gwei
      maxPriorityFeePerGas: 2 // gwei
    },
    enabled: false,
    isTestnet: true
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
export function getNetworkByName(name) {
  return networks[name.toLowerCase()];
}

/**
 * Get all enabled networks
 */
export function getEnabledNetworks() {
  return Object.entries(networks)
    .filter(([_, network]) => network.enabled)
    .reduce((acc, [key, network]) => {
      acc[key] = network;
      return acc;
    }, {});
}

/**
 * Get all testnet networks
 */
export function getTestnetNetworks() {
  return Object.entries(networks)
    .filter(([_, network]) => network.isTestnet)
    .reduce((acc, [key, network]) => {
      acc[key] = network;
      return acc;
    }, {});
}

/**
 * Get mainnet networks only
 */
export function getMainnetNetworks() {
  return Object.entries(networks)
    .filter(([_, network]) => !network.isTestnet)
    .reduce((acc, [key, network]) => {
      acc[key] = network;
      return acc;
    }, {});
}

/**
 * Validate network configuration
 */
export function validateNetwork(networkConfig) {
  const required = ['chainId', 'name', 'rpcUrls', 'nativeCurrency'];
  
  for (const field of required) {
    if (!networkConfig[field]) {
      throw new Error(`Missing required network field: ${field}`);
    }
  }
  
  if (!Array.isArray(networkConfig.rpcUrls) || networkConfig.rpcUrls.length === 0) {
    throw new Error('Network must have at least one RPC URL');
  }
  
  if (typeof networkConfig.chainId !== 'number' || networkConfig.chainId <= 0) {
    throw new Error('Invalid chain ID');
  }
  
  return true;
}

export default networks;