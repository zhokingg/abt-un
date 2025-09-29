/**
 * Token pair definitions and metadata
 * Comprehensive token configurations for arbitrage trading
 */

// Standard token definitions by network
const tokens = {
  ethereum: {
    // Native and wrapped tokens
    ETH: {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
      type: 'native',
      coingeckoId: 'ethereum',
      isStable: false
    },
    WETH: {
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      type: 'wrapped',
      coingeckoId: 'weth',
      isStable: false
    },
    
    // Stablecoins
    USDC: {
      address: '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      type: 'stablecoin',
      coingeckoId: 'usd-coin',
      isStable: true,
      pegTarget: 1.0
    },
    USDT: {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      type: 'stablecoin',
      coingeckoId: 'tether',
      isStable: true,
      pegTarget: 1.0
    },
    DAI: {
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      type: 'stablecoin',
      coingeckoId: 'dai',
      isStable: true,
      pegTarget: 1.0
    },
    BUSD: {
      address: '0x4Fabb145d64652a948d72533023f6E7A623C7C53',
      symbol: 'BUSD',
      name: 'Binance USD',
      decimals: 18,
      type: 'stablecoin',
      coingeckoId: 'binance-usd',
      isStable: true,
      pegTarget: 1.0
    },
    
    // Major altcoins
    WBTC: {
      address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      symbol: 'WBTC',
      name: 'Wrapped Bitcoin',
      decimals: 8,
      type: 'wrapped',
      coingeckoId: 'wrapped-bitcoin',
      isStable: false
    },
    LINK: {
      address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      symbol: 'LINK',
      name: 'Chainlink',
      decimals: 18,
      type: 'erc20',
      coingeckoId: 'chainlink',
      isStable: false
    },
    UNI: {
      address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      symbol: 'UNI',
      name: 'Uniswap',
      decimals: 18,
      type: 'erc20',
      coingeckoId: 'uniswap',
      isStable: false
    },
    AAVE: {
      address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
      symbol: 'AAVE',
      name: 'Aave',
      decimals: 18,
      type: 'erc20',
      coingeckoId: 'aave',
      isStable: false
    },
    COMP: {
      address: '0xc00e94Cb662C3520282E6f5717214004A7f26888',
      symbol: 'COMP',
      name: 'Compound',
      decimals: 18,
      type: 'erc20',
      coingeckoId: 'compound-governance-token',
      isStable: false
    }
  },
  
  polygon: {
    MATIC: {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'MATIC',
      name: 'Polygon',
      decimals: 18,
      type: 'native',
      coingeckoId: 'matic-network',
      isStable: false
    },
    WMATIC: {
      address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
      symbol: 'WMATIC',
      name: 'Wrapped Matic',
      decimals: 18,
      type: 'wrapped',
      coingeckoId: 'wmatic',
      isStable: false
    },
    USDC: {
      address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      type: 'stablecoin',
      coingeckoId: 'usd-coin',
      isStable: true,
      pegTarget: 1.0
    },
    USDT: {
      address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      type: 'stablecoin',
      coingeckoId: 'tether',
      isStable: true,
      pegTarget: 1.0
    },
    DAI: {
      address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      type: 'stablecoin',
      coingeckoId: 'dai',
      isStable: true,
      pegTarget: 1.0
    },
    WETH: {
      address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      type: 'wrapped',
      coingeckoId: 'weth',
      isStable: false
    }
  }
};

// Popular trading pairs for arbitrage
const tradingPairs = {
  ethereum: [
    // ETH pairs
    { tokenA: 'WETH', tokenB: 'USDC', category: 'major', liquidity: 'high' },
    { tokenA: 'WETH', tokenB: 'USDT', category: 'major', liquidity: 'high' },
    { tokenA: 'WETH', tokenB: 'DAI', category: 'major', liquidity: 'high' },
    { tokenA: 'WETH', tokenB: 'WBTC', category: 'major', liquidity: 'medium' },
    
    // Stablecoin pairs
    { tokenA: 'USDC', tokenB: 'USDT', category: 'stable', liquidity: 'high' },
    { tokenA: 'USDC', tokenB: 'DAI', category: 'stable', liquidity: 'high' },
    { tokenA: 'USDT', tokenB: 'DAI', category: 'stable', liquidity: 'medium' },
    { tokenA: 'DAI', tokenB: 'BUSD', category: 'stable', liquidity: 'medium' },
    
    // Altcoin pairs
    { tokenA: 'LINK', tokenB: 'WETH', category: 'altcoin', liquidity: 'medium' },
    { tokenA: 'UNI', tokenB: 'WETH', category: 'altcoin', liquidity: 'medium' },
    { tokenA: 'AAVE', tokenB: 'WETH', category: 'altcoin', liquidity: 'medium' },
    { tokenA: 'COMP', tokenB: 'WETH', category: 'altcoin', liquidity: 'low' },
    
    // BTC pairs
    { tokenA: 'WBTC', tokenB: 'USDC', category: 'major', liquidity: 'medium' },
    { tokenA: 'WBTC', tokenB: 'USDT', category: 'major', liquidity: 'medium' }
  ],
  
  polygon: [
    // MATIC pairs
    { tokenA: 'WMATIC', tokenB: 'USDC', category: 'major', liquidity: 'high' },
    { tokenA: 'WMATIC', tokenB: 'USDT', category: 'major', liquidity: 'high' },
    { tokenA: 'WMATIC', tokenB: 'DAI', category: 'major', liquidity: 'medium' },
    { tokenA: 'WMATIC', tokenB: 'WETH', category: 'major', liquidity: 'medium' },
    
    // Stablecoin pairs
    { tokenA: 'USDC', tokenB: 'USDT', category: 'stable', liquidity: 'high' },
    { tokenA: 'USDC', tokenB: 'DAI', category: 'stable', liquidity: 'medium' },
    
    // ETH pairs
    { tokenA: 'WETH', tokenB: 'USDC', category: 'major', liquidity: 'medium' },
    { tokenA: 'WETH', tokenB: 'USDT', category: 'major', liquidity: 'medium' }
  ]
};

// Risk categories for tokens
const riskCategories = {
  LOW: {
    name: 'Low Risk',
    description: 'Established tokens with high liquidity',
    tokens: ['ETH', 'WETH', 'WBTC', 'USDC', 'USDT', 'DAI'],
    maxPositionSize: 0.3, // 30% of capital
    requiredLiquidity: 1000000 // $1M minimum liquidity
  },
  MEDIUM: {
    name: 'Medium Risk',
    description: 'Popular altcoins with moderate liquidity',
    tokens: ['LINK', 'UNI', 'AAVE', 'COMP'],
    maxPositionSize: 0.15, // 15% of capital
    requiredLiquidity: 500000 // $500K minimum liquidity
  },
  HIGH: {
    name: 'High Risk',
    description: 'Smaller tokens with lower liquidity',
    tokens: [],
    maxPositionSize: 0.05, // 5% of capital
    requiredLiquidity: 100000 // $100K minimum liquidity
  }
};

/**
 * Get token information by symbol and network
 */
export function getToken(symbol, network = 'ethereum') {
  const networkTokens = tokens[network];
  if (!networkTokens) {
    throw new Error(`Network ${network} not supported`);
  }
  
  const token = networkTokens[symbol.toUpperCase()];
  if (!token) {
    throw new Error(`Token ${symbol} not found on ${network}`);
  }
  
  return { ...token, network };
}

/**
 * Get token by address
 */
export function getTokenByAddress(address, network = 'ethereum') {
  const networkTokens = tokens[network];
  if (!networkTokens) {
    throw new Error(`Network ${network} not supported`);
  }
  
  const tokenEntry = Object.entries(networkTokens).find(
    ([_, token]) => token.address.toLowerCase() === address.toLowerCase()
  );
  
  if (!tokenEntry) {
    throw new Error(`Token with address ${address} not found on ${network}`);
  }
  
  const [symbol, token] = tokenEntry;
  return { ...token, symbol, network };
}

/**
 * Get all tokens for a network
 */
export function getNetworkTokens(network = 'ethereum') {
  const networkTokens = tokens[network];
  if (!networkTokens) {
    throw new Error(`Network ${network} not supported`);
  }
  
  return Object.entries(networkTokens).map(([symbol, token]) => ({
    symbol,
    ...token,
    network
  }));
}

/**
 * Get stablecoins for a network
 */
export function getStablecoins(network = 'ethereum') {
  return getNetworkTokens(network).filter(token => token.isStable);
}

/**
 * Get trading pairs for a network
 */
export function getTradingPairs(network = 'ethereum', category = null) {
  const pairs = tradingPairs[network] || [];
  
  if (category) {
    return pairs.filter(pair => pair.category === category);
  }
  
  return pairs;
}

/**
 * Get high liquidity pairs
 */
export function getHighLiquidityPairs(network = 'ethereum') {
  return getTradingPairs(network).filter(pair => pair.liquidity === 'high');
}

/**
 * Get token risk category
 */
export function getTokenRiskCategory(symbol) {
  for (const [category, config] of Object.entries(riskCategories)) {
    if (config.tokens.includes(symbol.toUpperCase())) {
      return { category, ...config };
    }
  }
  
  return { category: 'HIGH', ...riskCategories.HIGH };
}

/**
 * Validate token pair
 */
export function validateTokenPair(tokenA, tokenB, network = 'ethereum') {
  try {
    const tokenAInfo = getToken(tokenA, network);
    const tokenBInfo = getToken(tokenB, network);
    
    if (tokenA === tokenB) {
      throw new Error('Cannot trade token with itself');
    }
    
    return {
      valid: true,
      tokenA: tokenAInfo,
      tokenB: tokenBInfo,
      riskA: getTokenRiskCategory(tokenA),
      riskB: getTokenRiskCategory(tokenB)
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}

/**
 * Get optimal pairs for arbitrage based on liquidity and risk
 */
export function getOptimalArbitragePairs(network = 'ethereum', riskTolerance = 'MEDIUM') {
  const allowedRisks = {
    'LOW': ['LOW'],
    'MEDIUM': ['LOW', 'MEDIUM'],
    'HIGH': ['LOW', 'MEDIUM', 'HIGH']
  };
  
  const allowed = allowedRisks[riskTolerance] || ['LOW'];
  
  return getTradingPairs(network)
    .filter(pair => pair.liquidity === 'high' || pair.liquidity === 'medium')
    .filter(pair => {
      const riskA = getTokenRiskCategory(pair.tokenA);
      const riskB = getTokenRiskCategory(pair.tokenB);
      return allowed.includes(riskA.category) && allowed.includes(riskB.category);
    })
    .sort((a, b) => {
      // Sort by liquidity (high > medium > low)
      const liquidityOrder = { high: 3, medium: 2, low: 1 };
      return liquidityOrder[b.liquidity] - liquidityOrder[a.liquidity];
    });
}

/**
 * Check if token is stablecoin
 */
export function isStablecoin(symbol, network = 'ethereum') {
  try {
    const token = getToken(symbol, network);
    return token.isStable;
  } catch {
    return false;
  }
}

/**
 * Get token decimals
 */
export function getTokenDecimals(symbol, network = 'ethereum') {
  try {
    const token = getToken(symbol, network);
    return token.decimals;
  } catch {
    return 18; // Default for ERC20
  }
}

export default {
  tokens,
  tradingPairs,
  riskCategories,
  getToken,
  getTokenByAddress,
  getNetworkTokens,
  getStablecoins,
  getTradingPairs,
  getHighLiquidityPairs,
  getTokenRiskCategory,
  validateTokenPair,
  getOptimalArbitragePairs,
  isStablecoin,
  getTokenDecimals
};