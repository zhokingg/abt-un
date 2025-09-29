/**
 * Comprehensive Token Database and Risk Management
 * Supports multi-chain token configurations with risk scoring and metadata
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
      isStable: false,
      riskLevel: 'LOW',
      liquidityScore: 10,
      volatilityScore: 7,
      marketCap: 'large',
      dailyVolume: 'high'
    },
    WETH: {
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      type: 'wrapped',
      coingeckoId: 'weth',
      isStable: false,
      riskLevel: 'LOW',
      liquidityScore: 10,
      volatilityScore: 7,
      marketCap: 'large',
      dailyVolume: 'high'
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
      pegTarget: 1.0,
      riskLevel: 'LOW',
      liquidityScore: 10,
      volatilityScore: 1,
      marketCap: 'large',
      dailyVolume: 'high',
      issuer: 'Circle',
      auditStatus: 'verified'
    },
    USDT: {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      type: 'stablecoin',
      coingeckoId: 'tether',
      isStable: true,
      pegTarget: 1.0,
      riskLevel: 'LOW',
      liquidityScore: 10,
      volatilityScore: 2,
      marketCap: 'large',
      dailyVolume: 'high',
      issuer: 'Tether',
      auditStatus: 'partial'
    },
    DAI: {
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      type: 'stablecoin',
      coingeckoId: 'dai',
      isStable: true,
      pegTarget: 1.0,
      riskLevel: 'LOW',
      liquidityScore: 9,
      volatilityScore: 2,
      marketCap: 'large',
      dailyVolume: 'high',
      issuer: 'MakerDAO',
      auditStatus: 'verified'
    },
    BUSD: {
      address: '0x4Fabb145d64652a948d72533023f6E7A623C7C53',
      symbol: 'BUSD',
      name: 'Binance USD',
      decimals: 18,
      type: 'stablecoin',
      coingeckoId: 'binance-usd',
      isStable: true,
      pegTarget: 1.0,
      riskLevel: 'MEDIUM',
      liquidityScore: 8,
      volatilityScore: 2,
      marketCap: 'large',
      dailyVolume: 'medium',
      issuer: 'Binance',
      auditStatus: 'verified'
    },
    FRAX: {
      address: '0x853d955aCEf822Db058eb8505911ED77F175b99e',
      symbol: 'FRAX',
      name: 'Frax',
      decimals: 18,
      type: 'stablecoin',
      coingeckoId: 'frax',
      isStable: true,
      pegTarget: 1.0,
      riskLevel: 'MEDIUM',
      liquidityScore: 6,
      volatilityScore: 3,
      marketCap: 'medium',
      dailyVolume: 'medium',
      issuer: 'Frax Finance',
      auditStatus: 'verified'
    },
    
    // Major altcoins
    WBTC: {
      address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      symbol: 'WBTC',
      name: 'Wrapped Bitcoin',
      decimals: 8,
      type: 'wrapped',
      coingeckoId: 'wrapped-bitcoin',
      isStable: false,
      riskLevel: 'LOW',
      liquidityScore: 9,
      volatilityScore: 8,
      marketCap: 'large',
      dailyVolume: 'high'
    },
    LINK: {
      address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      symbol: 'LINK',
      name: 'Chainlink',
      decimals: 18,
      type: 'erc20',
      coingeckoId: 'chainlink',
      isStable: false,
      riskLevel: 'MEDIUM',
      liquidityScore: 8,
      volatilityScore: 8,
      marketCap: 'large',
      dailyVolume: 'high'
    },
    UNI: {
      address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      symbol: 'UNI',
      name: 'Uniswap',
      decimals: 18,
      type: 'erc20',
      coingeckoId: 'uniswap',
      isStable: false,
      riskLevel: 'MEDIUM',
      liquidityScore: 8,
      volatilityScore: 9,
      marketCap: 'large',
      dailyVolume: 'high'
    },
    AAVE: {
      address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
      symbol: 'AAVE',
      name: 'Aave',
      decimals: 18,
      type: 'erc20',
      coingeckoId: 'aave',
      isStable: false,
      riskLevel: 'MEDIUM',
      liquidityScore: 7,
      volatilityScore: 9,
      marketCap: 'large',
      dailyVolume: 'medium'
    },
    COMP: {
      address: '0xc00e94Cb662C3520282E6f5717214004A7f26888',
      symbol: 'COMP',
      name: 'Compound',
      decimals: 18,
      type: 'erc20',
      coingeckoId: 'compound-governance-token',
      isStable: false,
      riskLevel: 'MEDIUM',
      liquidityScore: 6,
      volatilityScore: 9,
      marketCap: 'medium',
      dailyVolume: 'medium'
    },
    SUSHI: {
      address: '0x6B3595068778DD592e39A122f4f5a5cF09C90fE2',
      symbol: 'SUSHI',
      name: 'SushiToken',
      decimals: 18,
      type: 'erc20',
      coingeckoId: 'sushi',
      isStable: false,
      riskLevel: 'HIGH',
      liquidityScore: 6,
      volatilityScore: 9,
      marketCap: 'medium',
      dailyVolume: 'medium'
    },
    CRV: {
      address: '0xD533a949740bb3306d119CC777fa900bA034cd52',
      symbol: 'CRV',
      name: 'Curve DAO Token',
      decimals: 18,
      type: 'erc20',
      coingeckoId: 'curve-dao-token',
      isStable: false,
      riskLevel: 'HIGH',
      liquidityScore: 6,
      volatilityScore: 9,
      marketCap: 'medium',
      dailyVolume: 'medium'
    }
  },
  
  polygon: {
    // Native and wrapped tokens
    MATIC: {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'MATIC',
      name: 'Polygon',
      decimals: 18,
      type: 'native',
      coingeckoId: 'matic-network',
      isStable: false,
      riskLevel: 'MEDIUM',
      liquidityScore: 8,
      volatilityScore: 8,
      marketCap: 'large',
      dailyVolume: 'high'
    },
    WMATIC: {
      address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
      symbol: 'WMATIC',
      name: 'Wrapped Matic',
      decimals: 18,
      type: 'wrapped',
      coingeckoId: 'wmatic',
      isStable: false,
      riskLevel: 'MEDIUM',
      liquidityScore: 8,
      volatilityScore: 8,
      marketCap: 'large',
      dailyVolume: 'high'
    },
    
    // Bridge tokens
    WETH: {
      address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      type: 'wrapped',
      coingeckoId: 'weth',
      isStable: false,
      riskLevel: 'LOW',
      liquidityScore: 9,
      volatilityScore: 7,
      marketCap: 'large',
      dailyVolume: 'high'
    },
    WBTC: {
      address: '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6',
      symbol: 'WBTC',
      name: 'Wrapped Bitcoin',
      decimals: 8,
      type: 'wrapped',
      coingeckoId: 'wrapped-bitcoin',
      isStable: false,
      riskLevel: 'LOW',
      liquidityScore: 7,
      volatilityScore: 8,
      marketCap: 'large',
      dailyVolume: 'medium'
    },
    
    // Stablecoins
    USDC: {
      address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      type: 'stablecoin',
      coingeckoId: 'usd-coin',
      isStable: true,
      pegTarget: 1.0,
      riskLevel: 'LOW',
      liquidityScore: 9,
      volatilityScore: 1,
      marketCap: 'large',
      dailyVolume: 'high'
    },
    USDT: {
      address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      type: 'stablecoin',
      coingeckoId: 'tether',
      isStable: true,
      pegTarget: 1.0,
      riskLevel: 'LOW',
      liquidityScore: 9,
      volatilityScore: 2,
      marketCap: 'large',
      dailyVolume: 'high'
    },
    DAI: {
      address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      type: 'stablecoin',
      coingeckoId: 'dai',
      isStable: true,
      pegTarget: 1.0,
      riskLevel: 'LOW',
      liquidityScore: 8,
      volatilityScore: 2,
      marketCap: 'large',
      dailyVolume: 'medium'
    }
  },

  arbitrum: {
    // Native token (ETH)
    ETH: {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
      type: 'native',
      coingeckoId: 'ethereum',
      isStable: false,
      riskLevel: 'LOW',
      liquidityScore: 9,
      volatilityScore: 7,
      marketCap: 'large',
      dailyVolume: 'high'
    },
    WETH: {
      address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      type: 'wrapped',
      coingeckoId: 'weth',
      isStable: false,
      riskLevel: 'LOW',
      liquidityScore: 9,
      volatilityScore: 7,
      marketCap: 'large',
      dailyVolume: 'high'
    },
    
    // ARB governance token
    ARB: {
      address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
      symbol: 'ARB',
      name: 'Arbitrum',
      decimals: 18,
      type: 'erc20',
      coingeckoId: 'arbitrum',
      isStable: false,
      riskLevel: 'MEDIUM',
      liquidityScore: 8,
      volatilityScore: 9,
      marketCap: 'large',
      dailyVolume: 'high'
    },
    
    // Stablecoins
    USDC: {
      address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      type: 'stablecoin',
      coingeckoId: 'usd-coin',
      isStable: true,
      pegTarget: 1.0,
      riskLevel: 'LOW',
      liquidityScore: 9,
      volatilityScore: 1,
      marketCap: 'large',
      dailyVolume: 'high'
    },
    USDT: {
      address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      type: 'stablecoin',
      coingeckoId: 'tether',
      isStable: true,
      pegTarget: 1.0,
      riskLevel: 'LOW',
      liquidityScore: 9,
      volatilityScore: 2,
      marketCap: 'large',
      dailyVolume: 'high'
    },
    
    // Bridge tokens
    WBTC: {
      address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
      symbol: 'WBTC',
      name: 'Wrapped Bitcoin',
      decimals: 8,
      type: 'wrapped',
      coingeckoId: 'wrapped-bitcoin',
      isStable: false,
      riskLevel: 'LOW',
      liquidityScore: 8,
      volatilityScore: 8,
      marketCap: 'large',
      dailyVolume: 'medium'
    }
  },

  optimism: {
    // Native token (ETH)
    ETH: {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
      type: 'native',
      coingeckoId: 'ethereum',
      isStable: false,
      riskLevel: 'LOW',
      liquidityScore: 8,
      volatilityScore: 7,
      marketCap: 'large',
      dailyVolume: 'high'
    },
    WETH: {
      address: '0x4200000000000000000000000000000000000006',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      type: 'wrapped',
      coingeckoId: 'weth',
      isStable: false,
      riskLevel: 'LOW',
      liquidityScore: 8,
      volatilityScore: 7,
      marketCap: 'large',
      dailyVolume: 'high'
    },
    
    // OP governance token
    OP: {
      address: '0x4200000000000000000000000000000000000042',
      symbol: 'OP',
      name: 'Optimism',
      decimals: 18,
      type: 'erc20',
      coingeckoId: 'optimism',
      isStable: false,
      riskLevel: 'MEDIUM',
      liquidityScore: 7,
      volatilityScore: 9,
      marketCap: 'large',
      dailyVolume: 'medium'
    },
    
    // Stablecoins
    USDC: {
      address: '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      type: 'stablecoin',
      coingeckoId: 'usd-coin',
      isStable: true,
      pegTarget: 1.0,
      riskLevel: 'LOW',
      liquidityScore: 8,
      volatilityScore: 1,
      marketCap: 'large',
      dailyVolume: 'medium'
    },
    USDT: {
      address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      type: 'stablecoin',
      coingeckoId: 'tether',
      isStable: true,
      pegTarget: 1.0,
      riskLevel: 'LOW',
      liquidityScore: 7,
      volatilityScore: 2,
      marketCap: 'large',
      dailyVolume: 'medium'
    }
  },

  base: {
    // Native token (ETH)
    ETH: {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
      type: 'native',
      coingeckoId: 'ethereum',
      isStable: false,
      riskLevel: 'LOW',
      liquidityScore: 7,
      volatilityScore: 7,
      marketCap: 'large',
      dailyVolume: 'medium'
    },
    WETH: {
      address: '0x4200000000000000000000000000000000000006',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      type: 'wrapped',
      coingeckoId: 'weth',
      isStable: false,
      riskLevel: 'LOW',
      liquidityScore: 7,
      volatilityScore: 7,
      marketCap: 'large',
      dailyVolume: 'medium'
    },
    
    // Stablecoins
    USDC: {
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      type: 'stablecoin',
      coingeckoId: 'usd-coin',
      isStable: true,
      pegTarget: 1.0,
      riskLevel: 'LOW',
      liquidityScore: 7,
      volatilityScore: 1,
      marketCap: 'large',
      dailyVolume: 'medium'
    }
  },

  bsc: {
    // Native token (BNB)
    BNB: {
      address: '0x0000000000000000000000000000000000000000',
      symbol: 'BNB',
      name: 'BNB',
      decimals: 18,
      type: 'native',
      coingeckoId: 'binancecoin',
      isStable: false,
      riskLevel: 'MEDIUM',
      liquidityScore: 8,
      volatilityScore: 8,
      marketCap: 'large',
      dailyVolume: 'high'
    },
    WBNB: {
      address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      symbol: 'WBNB',
      name: 'Wrapped BNB',
      decimals: 18,
      type: 'wrapped',
      coingeckoId: 'wbnb',
      isStable: false,
      riskLevel: 'MEDIUM',
      liquidityScore: 8,
      volatilityScore: 8,
      marketCap: 'large',
      dailyVolume: 'high'
    },
    
    // Stablecoins
    USDT: {
      address: '0x55d398326f99059fF775485246999027B3197955',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 18,
      type: 'stablecoin',
      coingeckoId: 'tether',
      isStable: true,
      pegTarget: 1.0,
      riskLevel: 'LOW',
      liquidityScore: 8,
      volatilityScore: 2,
      marketCap: 'large',
      dailyVolume: 'high'
    },
    BUSD: {
      address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
      symbol: 'BUSD',
      name: 'Binance USD',
      decimals: 18,
      type: 'stablecoin',
      coingeckoId: 'binance-usd',
      isStable: true,
      pegTarget: 1.0,
      riskLevel: 'MEDIUM',
      liquidityScore: 7,
      volatilityScore: 2,
      marketCap: 'large',
      dailyVolume: 'medium'
    },
    USDC: {
      address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 18,
      type: 'stablecoin',
      coingeckoId: 'usd-coin',
      isStable: true,
      pegTarget: 1.0,
      riskLevel: 'LOW',
      liquidityScore: 7,
      volatilityScore: 1,
      marketCap: 'large',
      dailyVolume: 'medium'
    },
    
    // Bridge tokens
    BTCB: {
      address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
      symbol: 'BTCB',
      name: 'Bitcoin BEP2',
      decimals: 18,
      type: 'wrapped',
      coingeckoId: 'bitcoin-bep2',
      isStable: false,
      riskLevel: 'LOW',
      liquidityScore: 7,
      volatilityScore: 8,
      marketCap: 'large',
      dailyVolume: 'medium'
    },
    ETH: {
      address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
      symbol: 'ETH',
      name: 'Ethereum Token',
      decimals: 18,
      type: 'wrapped',
      coingeckoId: 'ethereum',
      isStable: false,
      riskLevel: 'LOW',
      liquidityScore: 7,
      volatilityScore: 7,
      marketCap: 'large',
      dailyVolume: 'medium'
    }
  }
};

// Enhanced trading pairs for arbitrage with liquidity pools and fee tiers
const tradingPairs = {
  ethereum: [
    // High liquidity ETH pairs
    { 
      tokenA: 'WETH', tokenB: 'USDC', 
      category: 'major', liquidity: 'high', volume24h: 'high',
      pools: [
        { protocol: 'uniswap-v2', fee: 0.003, liquidity: 500000000 },
        { protocol: 'uniswap-v3', fee: 0.0005, liquidity: 300000000 },
        { protocol: 'uniswap-v3', fee: 0.003, liquidity: 200000000 },
        { protocol: 'sushiswap', fee: 0.003, liquidity: 100000000 }
      ]
    },
    { 
      tokenA: 'WETH', tokenB: 'USDT', 
      category: 'major', liquidity: 'high', volume24h: 'high',
      pools: [
        { protocol: 'uniswap-v2', fee: 0.003, liquidity: 400000000 },
        { protocol: 'uniswap-v3', fee: 0.0005, liquidity: 250000000 },
        { protocol: 'uniswap-v3', fee: 0.003, liquidity: 150000000 },
        { protocol: 'sushiswap', fee: 0.003, liquidity: 80000000 }
      ]
    },
    { 
      tokenA: 'WETH', tokenB: 'DAI', 
      category: 'major', liquidity: 'high', volume24h: 'medium',
      pools: [
        { protocol: 'uniswap-v2', fee: 0.003, liquidity: 200000000 },
        { protocol: 'uniswap-v3', fee: 0.003, liquidity: 100000000 },
        { protocol: 'sushiswap', fee: 0.003, liquidity: 50000000 }
      ]
    },
    { 
      tokenA: 'WETH', tokenB: 'WBTC', 
      category: 'major', liquidity: 'medium', volume24h: 'medium',
      pools: [
        { protocol: 'uniswap-v2', fee: 0.003, liquidity: 100000000 },
        { protocol: 'uniswap-v3', fee: 0.003, liquidity: 80000000 },
        { protocol: 'sushiswap', fee: 0.003, liquidity: 30000000 }
      ]
    },
    
    // Stablecoin pairs (high arbitrage potential)
    { 
      tokenA: 'USDC', tokenB: 'USDT', 
      category: 'stable', liquidity: 'high', volume24h: 'high',
      pools: [
        { protocol: 'uniswap-v2', fee: 0.003, liquidity: 300000000 },
        { protocol: 'uniswap-v3', fee: 0.0001, liquidity: 200000000 },
        { protocol: 'uniswap-v3', fee: 0.0005, liquidity: 150000000 },
        { protocol: 'curve', fee: 0.0004, liquidity: 500000000 }
      ]
    },
    { 
      tokenA: 'USDC', tokenB: 'DAI', 
      category: 'stable', liquidity: 'high', volume24h: 'medium',
      pools: [
        { protocol: 'uniswap-v2', fee: 0.003, liquidity: 150000000 },
        { protocol: 'uniswap-v3', fee: 0.0001, liquidity: 100000000 },
        { protocol: 'curve', fee: 0.0004, liquidity: 300000000 }
      ]
    },
    { 
      tokenA: 'USDT', tokenB: 'DAI', 
      category: 'stable', liquidity: 'medium', volume24h: 'medium',
      pools: [
        { protocol: 'uniswap-v2', fee: 0.003, liquidity: 80000000 },
        { protocol: 'uniswap-v3', fee: 0.0001, liquidity: 60000000 },
        { protocol: 'curve', fee: 0.0004, liquidity: 200000000 }
      ]
    },
    
    // Altcoin pairs
    { 
      tokenA: 'LINK', tokenB: 'WETH', 
      category: 'altcoin', liquidity: 'medium', volume24h: 'medium',
      pools: [
        { protocol: 'uniswap-v2', fee: 0.003, liquidity: 50000000 },
        { protocol: 'uniswap-v3', fee: 0.003, liquidity: 40000000 },
        { protocol: 'sushiswap', fee: 0.003, liquidity: 20000000 }
      ]
    },
    { 
      tokenA: 'UNI', tokenB: 'WETH', 
      category: 'altcoin', liquidity: 'medium', volume24h: 'medium',
      pools: [
        { protocol: 'uniswap-v2', fee: 0.003, liquidity: 60000000 },
        { protocol: 'uniswap-v3', fee: 0.003, liquidity: 50000000 },
        { protocol: 'sushiswap', fee: 0.003, liquidity: 15000000 }
      ]
    },
    { 
      tokenA: 'AAVE', tokenB: 'WETH', 
      category: 'altcoin', liquidity: 'medium', volume24h: 'low',
      pools: [
        { protocol: 'uniswap-v2', fee: 0.003, liquidity: 30000000 },
        { protocol: 'uniswap-v3', fee: 0.003, liquidity: 25000000 },
        { protocol: 'sushiswap', fee: 0.003, liquidity: 10000000 }
      ]
    }
  ],
  
  polygon: [
    // MATIC pairs
    { 
      tokenA: 'WMATIC', tokenB: 'USDC', 
      category: 'major', liquidity: 'high', volume24h: 'high',
      pools: [
        { protocol: 'quickswap', fee: 0.003, liquidity: 50000000 },
        { protocol: 'uniswap-v3', fee: 0.0005, liquidity: 30000000 },
        { protocol: 'sushiswap', fee: 0.003, liquidity: 20000000 }
      ]
    },
    { 
      tokenA: 'WMATIC', tokenB: 'USDT', 
      category: 'major', liquidity: 'high', volume24h: 'high',
      pools: [
        { protocol: 'quickswap', fee: 0.003, liquidity: 40000000 },
        { protocol: 'uniswap-v3', fee: 0.0005, liquidity: 25000000 },
        { protocol: 'sushiswap', fee: 0.003, liquidity: 15000000 }
      ]
    },
    { 
      tokenA: 'WMATIC', tokenB: 'WETH', 
      category: 'major', liquidity: 'medium', volume24h: 'medium',
      pools: [
        { protocol: 'quickswap', fee: 0.003, liquidity: 30000000 },
        { protocol: 'uniswap-v3', fee: 0.003, liquidity: 20000000 },
        { protocol: 'sushiswap', fee: 0.003, liquidity: 10000000 }
      ]
    },
    
    // Stablecoin pairs
    { 
      tokenA: 'USDC', tokenB: 'USDT', 
      category: 'stable', liquidity: 'high', volume24h: 'medium',
      pools: [
        { protocol: 'quickswap', fee: 0.003, liquidity: 80000000 },
        { protocol: 'uniswap-v3', fee: 0.0001, liquidity: 50000000 },
        { protocol: 'curve', fee: 0.0004, liquidity: 100000000 }
      ]
    },
    
    // Cross-chain pairs
    { 
      tokenA: 'WETH', tokenB: 'USDC', 
      category: 'major', liquidity: 'medium', volume24h: 'medium',
      pools: [
        { protocol: 'quickswap', fee: 0.003, liquidity: 40000000 },
        { protocol: 'uniswap-v3', fee: 0.0005, liquidity: 30000000 },
        { protocol: 'sushiswap', fee: 0.003, liquidity: 15000000 }
      ]
    }
  ],

  arbitrum: [
    // ARB pairs
    { 
      tokenA: 'ARB', tokenB: 'WETH', 
      category: 'major', liquidity: 'high', volume24h: 'high',
      pools: [
        { protocol: 'uniswap-v3', fee: 0.003, liquidity: 100000000 },
        { protocol: 'camelot', fee: 0.003, liquidity: 50000000 },
        { protocol: 'sushiswap', fee: 0.003, liquidity: 30000000 }
      ]
    },
    { 
      tokenA: 'ARB', tokenB: 'USDC', 
      category: 'major', liquidity: 'medium', volume24h: 'medium',
      pools: [
        { protocol: 'uniswap-v3', fee: 0.003, liquidity: 60000000 },
        { protocol: 'camelot', fee: 0.003, liquidity: 30000000 }
      ]
    },
    
    // ETH pairs
    { 
      tokenA: 'WETH', tokenB: 'USDC', 
      category: 'major', liquidity: 'high', volume24h: 'high',
      pools: [
        { protocol: 'uniswap-v3', fee: 0.0005, liquidity: 150000000 },
        { protocol: 'uniswap-v3', fee: 0.003, liquidity: 100000000 },
        { protocol: 'camelot', fee: 0.003, liquidity: 40000000 },
        { protocol: 'sushiswap', fee: 0.003, liquidity: 30000000 }
      ]
    },
    { 
      tokenA: 'WETH', tokenB: 'USDT', 
      category: 'major', liquidity: 'high', volume24h: 'medium',
      pools: [
        { protocol: 'uniswap-v3', fee: 0.0005, liquidity: 80000000 },
        { protocol: 'uniswap-v3', fee: 0.003, liquidity: 60000000 },
        { protocol: 'sushiswap', fee: 0.003, liquidity: 20000000 }
      ]
    },
    
    // Stablecoin pairs
    { 
      tokenA: 'USDC', tokenB: 'USDT', 
      category: 'stable', liquidity: 'high', volume24h: 'medium',
      pools: [
        { protocol: 'uniswap-v3', fee: 0.0001, liquidity: 100000000 },
        { protocol: 'uniswap-v3', fee: 0.0005, liquidity: 50000000 },
        { protocol: 'curve', fee: 0.0004, liquidity: 80000000 }
      ]
    }
  ],

  optimism: [
    // OP pairs
    { 
      tokenA: 'OP', tokenB: 'WETH', 
      category: 'major', liquidity: 'medium', volume24h: 'medium',
      pools: [
        { protocol: 'uniswap-v3', fee: 0.003, liquidity: 40000000 },
        { protocol: 'velodrome', fee: 0.002, liquidity: 30000000 }
      ]
    },
    
    // ETH pairs
    { 
      tokenA: 'WETH', tokenB: 'USDC', 
      category: 'major', liquidity: 'medium', volume24h: 'medium',
      pools: [
        { protocol: 'uniswap-v3', fee: 0.0005, liquidity: 60000000 },
        { protocol: 'uniswap-v3', fee: 0.003, liquidity: 40000000 },
        { protocol: 'velodrome', fee: 0.002, liquidity: 20000000 }
      ]
    },
    
    // Stablecoin pairs
    { 
      tokenA: 'USDC', tokenB: 'USDT', 
      category: 'stable', liquidity: 'medium', volume24h: 'low',
      pools: [
        { protocol: 'uniswap-v3', fee: 0.0001, liquidity: 30000000 },
        { protocol: 'velodrome', fee: 0.001, liquidity: 20000000 }
      ]
    }
  ],

  base: [
    // ETH pairs
    { 
      tokenA: 'WETH', tokenB: 'USDC', 
      category: 'major', liquidity: 'medium', volume24h: 'medium',
      pools: [
        { protocol: 'uniswap-v3', fee: 0.0005, liquidity: 40000000 },
        { protocol: 'uniswap-v3', fee: 0.003, liquidity: 30000000 }
      ]
    }
  ],

  bsc: [
    // BNB pairs
    { 
      tokenA: 'WBNB', tokenB: 'USDT', 
      category: 'major', liquidity: 'high', volume24h: 'high',
      pools: [
        { protocol: 'pancakeswap-v2', fee: 0.0025, liquidity: 200000000 },
        { protocol: 'pancakeswap-v3', fee: 0.0025, liquidity: 100000000 }
      ]
    },
    { 
      tokenA: 'WBNB', tokenB: 'BUSD', 
      category: 'major', liquidity: 'high', volume24h: 'high',
      pools: [
        { protocol: 'pancakeswap-v2', fee: 0.0025, liquidity: 150000000 },
        { protocol: 'pancakeswap-v3', fee: 0.0025, liquidity: 80000000 }
      ]
    },
    { 
      tokenA: 'WBNB', tokenB: 'ETH', 
      category: 'major', liquidity: 'medium', volume24h: 'medium',
      pools: [
        { protocol: 'pancakeswap-v2', fee: 0.0025, liquidity: 80000000 },
        { protocol: 'pancakeswap-v3', fee: 0.0025, liquidity: 50000000 }
      ]
    },
    
    // Stablecoin pairs
    { 
      tokenA: 'USDT', tokenB: 'BUSD', 
      category: 'stable', liquidity: 'high', volume24h: 'medium',
      pools: [
        { protocol: 'pancakeswap-v2', fee: 0.0025, liquidity: 100000000 },
        { protocol: 'pancakeswap-v3', fee: 0.0001, liquidity: 80000000 }
      ]
    },
    { 
      tokenA: 'USDT', tokenB: 'USDC', 
      category: 'stable', liquidity: 'medium', volume24h: 'low',
      pools: [
        { protocol: 'pancakeswap-v2', fee: 0.0025, liquidity: 60000000 },
        { protocol: 'pancakeswap-v3', fee: 0.0001, liquidity: 40000000 }
      ]
    }
  ]
};

// Enhanced risk categories with detailed scoring
const riskCategories = {
  LOW: {
    name: 'Low Risk',
    description: 'Blue-chip tokens with highest liquidity and stability',
    riskScore: 1,
    tokens: ['ETH', 'WETH', 'WBTC', 'USDC', 'USDT', 'DAI', 'BNB', 'MATIC'],
    maxPositionSize: 0.4, // 40% of capital
    requiredLiquidity: 50000000, // $50M minimum liquidity
    maxSlippage: 0.001, // 0.1%
    minDailyVolume: 10000000, // $10M
    allowedProtocols: ['uniswap-v2', 'uniswap-v3', 'sushiswap', 'curve', 'balancer'],
    requiresAudit: false
  },
  MEDIUM: {
    name: 'Medium Risk',
    description: 'Established altcoins with good liquidity',
    riskScore: 5,
    tokens: ['LINK', 'UNI', 'AAVE', 'COMP', 'ARB', 'OP', 'SUSHI', 'CRV'],
    maxPositionSize: 0.2, // 20% of capital
    requiredLiquidity: 10000000, // $10M minimum liquidity
    maxSlippage: 0.005, // 0.5%
    minDailyVolume: 1000000, // $1M
    allowedProtocols: ['uniswap-v2', 'uniswap-v3', 'sushiswap'],
    requiresAudit: true
  },
  HIGH: {
    name: 'High Risk',
    description: 'Smaller tokens with moderate liquidity',
    riskScore: 8,
    tokens: ['FRAX'], // Dynamic list based on market conditions
    maxPositionSize: 0.05, // 5% of capital
    requiredLiquidity: 1000000, // $1M minimum liquidity
    maxSlippage: 0.02, // 2%
    minDailyVolume: 100000, // $100K
    allowedProtocols: ['uniswap-v3'],
    requiresAudit: true
  },
  VERY_HIGH: {
    name: 'Very High Risk',
    description: 'Experimental or low-liquidity tokens',
    riskScore: 10,
    tokens: [],
    maxPositionSize: 0.01, // 1% of capital
    requiredLiquidity: 100000, // $100K minimum liquidity
    maxSlippage: 0.05, // 5%
    minDailyVolume: 10000, // $10K
    allowedProtocols: ['uniswap-v3'],
    requiresAudit: true
  }
};

// Liquidity pool configurations
const liquidityPools = {
  uniswap_v2: {
    name: 'Uniswap V2',
    fee: 0.003, // 0.3%
    type: 'constant_product',
    gasEfficiency: 'medium',
    liquidityDepth: 'high'
  },
  uniswap_v3: {
    name: 'Uniswap V3',
    fees: [0.0001, 0.0005, 0.003, 0.01], // Multiple fee tiers
    type: 'concentrated_liquidity',
    gasEfficiency: 'low',
    liquidityDepth: 'variable'
  },
  sushiswap: {
    name: 'SushiSwap',
    fee: 0.003, // 0.3%
    type: 'constant_product',
    gasEfficiency: 'medium',
    liquidityDepth: 'medium'
  },
  curve: {
    name: 'Curve Finance',
    fee: 0.0004, // 0.04%
    type: 'stable_swap',
    gasEfficiency: 'high',
    liquidityDepth: 'high',
    specialization: 'stablecoins'
  },
  balancer: {
    name: 'Balancer',
    fees: [0.0001, 0.001, 0.003, 0.01],
    type: 'weighted_pools',
    gasEfficiency: 'low',
    liquidityDepth: 'medium'
  }
};

/**
 * Enhanced utility functions for token management
 */

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
  
  return { ...token, symbol: symbol.toUpperCase(), network };
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
 * Get token risk category with enhanced scoring
 */
export function getTokenRiskCategory(symbol) {
  for (const [category, config] of Object.entries(riskCategories)) {
    if (config.tokens.includes(symbol.toUpperCase())) {
      return { category, ...config };
    }
  }
  
  return { category: 'VERY_HIGH', ...riskCategories.VERY_HIGH };
}

/**
 * Calculate token risk score based on multiple factors
 */
export function calculateTokenRiskScore(symbol, network = 'ethereum') {
  try {
    const token = getToken(symbol, network);
    const riskCategory = getTokenRiskCategory(symbol);
    
    let score = riskCategory.riskScore;
    
    // Adjust based on liquidity score
    score += (10 - token.liquidityScore) * 0.5;
    
    // Adjust based on volatility
    score += token.volatilityScore * 0.3;
    
    // Adjust based on market cap
    const marketCapAdjustment = {
      'large': -1,
      'medium': 0,
      'small': 2
    };
    score += marketCapAdjustment[token.marketCap] || 3;
    
    return Math.min(10, Math.max(1, Math.round(score * 10) / 10));
  } catch {
    return 10; // Maximum risk for unknown tokens
  }
}

/**
 * Validate token pair with enhanced risk analysis
 */
export function validateTokenPair(tokenA, tokenB, network = 'ethereum') {
  try {
    const tokenAInfo = getToken(tokenA, network);
    const tokenBInfo = getToken(tokenB, network);
    
    if (tokenA === tokenB) {
      throw new Error('Cannot trade token with itself');
    }
    
    const riskA = getTokenRiskCategory(tokenA);
    const riskB = getTokenRiskCategory(tokenB);
    const riskScoreA = calculateTokenRiskScore(tokenA, network);
    const riskScoreB = calculateTokenRiskScore(tokenB, network);
    
    return {
      valid: true,
      tokenA: tokenAInfo,
      tokenB: tokenBInfo,
      riskA: { ...riskA, score: riskScoreA },
      riskB: { ...riskB, score: riskScoreB },
      averageRisk: (riskScoreA + riskScoreB) / 2,
      recommendation: getPairRecommendation(riskScoreA, riskScoreB)
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}

/**
 * Get pair recommendation based on risk scores
 */
function getPairRecommendation(riskA, riskB) {
  const avgRisk = (riskA + riskB) / 2;
  
  if (avgRisk <= 3) {
    return {
      level: 'RECOMMENDED',
      message: 'Low risk pair suitable for high-frequency trading',
      maxPositionSize: 0.4
    };
  } else if (avgRisk <= 6) {
    return {
      level: 'ACCEPTABLE',
      message: 'Medium risk pair, monitor closely',
      maxPositionSize: 0.2
    };
  } else {
    return {
      level: 'CAUTION',
      message: 'High risk pair, use small position sizes',
      maxPositionSize: 0.05
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
    'HIGH': ['LOW', 'MEDIUM', 'HIGH'],
    'VERY_HIGH': ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']
  };
  
  const allowed = allowedRisks[riskTolerance] || ['LOW'];
  
  return getTradingPairs(network)
    .filter(pair => pair.liquidity === 'high' || pair.liquidity === 'medium')
    .filter(pair => {
      const riskA = getTokenRiskCategory(pair.tokenA);
      const riskB = getTokenRiskCategory(pair.tokenB);
      return allowed.includes(riskA.category) && allowed.includes(riskB.category);
    })
    .map(pair => ({
      ...pair,
      riskScore: (
        calculateTokenRiskScore(pair.tokenA, network) + 
        calculateTokenRiskScore(pair.tokenB, network)
      ) / 2,
      validation: validateTokenPair(pair.tokenA, pair.tokenB, network)
    }))
    .sort((a, b) => {
      // Primary sort: liquidity (high > medium > low)
      const liquidityOrder = { high: 3, medium: 2, low: 1 };
      const liquidityDiff = liquidityOrder[b.liquidity] - liquidityOrder[a.liquidity];
      if (liquidityDiff !== 0) return liquidityDiff;
      
      // Secondary sort: risk score (lower risk first)
      return a.riskScore - b.riskScore;
    });
}

/**
 * Get pairs suitable for stablecoin arbitrage
 */
export function getStablecoinArbitragePairs(network = 'ethereum') {
  return getTradingPairs(network, 'stable')
    .filter(pair => pair.liquidity === 'high')
    .map(pair => ({
      ...pair,
      expectedVolatility: 'low',
      arbitrageType: 'stablecoin',
      optimalProtocols: pair.pools
        .filter(pool => pool.protocol === 'curve' || pool.fee <= 0.0005)
        .sort((a, b) => b.liquidity - a.liquidity)
    }));
}

/**
 * Get cross-chain token mapping
 */
export function getCrossChainTokens(symbol) {
  const crossChainMap = {};
  
  for (const [network, networkTokens] of Object.entries(tokens)) {
    if (networkTokens[symbol.toUpperCase()]) {
      crossChainMap[network] = networkTokens[symbol.toUpperCase()];
    }
  }
  
  return crossChainMap;
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

/**
 * Get token summary statistics
 */
export function getTokenSummary() {
  const summary = {
    totalNetworks: Object.keys(tokens).length,
    totalTokens: 0,
    tokensByNetwork: {},
    tokensByRisk: {},
    stablecoins: 0,
    nativeTokens: 0
  };

  for (const [network, networkTokens] of Object.entries(tokens)) {
    const networkTokenCount = Object.keys(networkTokens).length;
    summary.totalTokens += networkTokenCount;
    summary.tokensByNetwork[network] = networkTokenCount;

    for (const [symbol, token] of Object.entries(networkTokens)) {
      if (token.isStable) summary.stablecoins++;
      if (token.type === 'native') summary.nativeTokens++;
      
      const risk = getTokenRiskCategory(symbol);
      summary.tokensByRisk[risk.category] = (summary.tokensByRisk[risk.category] || 0) + 1;
    }
  }

  return summary;
}

/**
 * Get supported networks for a token
 */
export function getTokenNetworks(symbol) {
  const networks = [];
  
  for (const [network, networkTokens] of Object.entries(tokens)) {
    if (networkTokens[symbol.toUpperCase()]) {
      networks.push({
        network,
        token: networkTokens[symbol.toUpperCase()]
      });
    }
  }
  
  return networks;
}

export default {
  tokens,
  tradingPairs,
  riskCategories,
  liquidityPools,
  getToken,
  getTokenByAddress,
  getNetworkTokens,
  getStablecoins,
  getTradingPairs,
  getHighLiquidityPairs,
  getTokenRiskCategory,
  calculateTokenRiskScore,
  validateTokenPair,
  getOptimalArbitragePairs,
  getStablecoinArbitragePairs,
  getCrossChainTokens,
  isStablecoin,
  getTokenDecimals,
  getTokenSummary,
  getTokenNetworks
};