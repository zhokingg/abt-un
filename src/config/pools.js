/**
 * Pool configuration for V2/V3 monitoring
 */

const TARGET_POOLS = {
  v2: [
    {
      address: "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6", // ETH/USDC V2
      token0: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
      token1: "0xA0b86a33E6417aFD4c0A1fD3eC7D1FdBB52A8A8C", // USDC
      fee: 3000,
      decimals: [18, 6],
      symbols: ["WETH", "USDC"],
      priority: 1
    }
  ],
  v3: [
    {
      address: "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640", // ETH/USDC V3 0.05%
      token0: "0xA0b86a33E6417aFD4c0A1fD3eC7D1FdBB52A8A8C", // USDC
      token1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
      fee: 500,
      tickSpacing: 10,
      decimals: [6, 18],
      symbols: ["USDC", "WETH"],
      priority: 1
    }
  ]
};

const POOL_PAIRS = [
  {
    id: "ETH_USDC_v2_v3",
    v2Pool: "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
    v3Pool: "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640",
    tokens: ["WETH", "USDC"],
    priority: 1,
    minProfitUSD: 10
  }
];

module.exports = {
  TARGET_POOLS,
  POOL_PAIRS
};
