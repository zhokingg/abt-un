# Smart Contract Executors Documentation

## Overview

This repository contains three core smart contract executors that enable secure, gas-optimized, and MEV-protected DeFi arbitrage:

1. **FlashLoanExecutor** - Multi-protocol flash loan execution
2. **ArbitrageExecutor** - Multi-DEX arbitrage execution with gas optimization
3. **MEVProtectedExecutor** - MEV-protected transaction bundling and submission

## Contracts

### 1. FlashLoanExecutor.sol

A unified flash loan executor supporting multiple DeFi protocols.

#### Features
- ✅ **Multi-Protocol Support**: Aave V3, Uniswap V3, Balancer (extensible)
- ✅ **Emergency Controls**: Pausable operations and emergency withdrawal
- ✅ **Access Control**: Role-based permissions for operators
- ✅ **Event Monitoring**: Comprehensive event emission for analytics
- ✅ **Reentrancy Protection**: Built-in security against reentrancy attacks
- ✅ **Fee Tracking**: Automatic flash loan fee calculation

#### Key Functions

```solidity
// Execute a flash loan from specified protocol
function executeFlashLoan(FlashLoanParams memory params) external returns (bool success)

// Aave V3 flash loan callback
function executeOperation(
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata premiums,
    address initiator,
    bytes calldata params
) external override returns (bool success)

// Update protocol configuration
function updateProtocol(Protocol protocol, address pool, bool isActive) external onlyOwner

// Emergency withdrawal
function emergencyWithdraw(address token, uint256 amount, address recipient) external onlyOwner
```

#### Usage Example

```javascript
const flashLoanParams = {
  protocol: Protocol.AAVE_V3,
  assets: [wethAddress],
  amounts: [ethers.parseEther("10")],
  userData: encodedCalldata,
  initiator: botAddress
};

await flashLoanExecutor.executeFlashLoan(flashLoanParams);
```

### 2. ArbitrageExecutor.sol

Multi-hop, multi-DEX arbitrage executor with advanced features.

#### Features
- ✅ **Multi-DEX Support**: Uniswap V2/V3, SushiSwap, and extensible to others
- ✅ **Multi-Hop Routes**: Support up to 5 hops in a single arbitrage
- ✅ **Slippage Protection**: Configurable slippage limits
- ✅ **Gas Optimization**: Optimized swap batching
- ✅ **MEV Protection Hooks**: Integration points for Flashbots/private relays
- ✅ **Dynamic Configuration**: Runtime updates to DEX routers and parameters

#### Key Functions

```solidity
// Execute arbitrage through multiple DEX hops
function executeArbitrage(ArbitrageRoute calldata route) external returns (ExecutionResult memory)

// Register or update DEX router
function registerRouter(DEXType dexType, address router, bool status) external onlyOwner

// Update slippage configuration
function updateSlippageConfig(
    uint256 maxSlippageBps,
    uint256 minProfitBps,
    bool enableDynamicSlippage
) external onlyOwner

// Estimate gas for route
function estimateGas(ArbitrageRoute calldata route) external view returns (uint256)
```

#### Usage Example

```javascript
const route = {
  hops: [
    {
      dexType: DEXType.UNISWAP_V2,
      router: uniV2RouterAddress,
      tokenIn: wethAddress,
      tokenOut: usdcAddress,
      fee: 0,
      extraData: "0x"
    },
    {
      dexType: DEXType.SUSHISWAP,
      router: sushiRouterAddress,
      tokenIn: usdcAddress,
      tokenOut: wethAddress,
      fee: 0,
      extraData: "0x"
    }
  ],
  amountIn: ethers.parseEther("1"),
  minAmountOut: ethers.parseEther("1.01"),
  deadline: Math.floor(Date.now() / 1000) + 300,
  recipient: botAddress
};

const result = await arbitrageExecutor.executeArbitrage(route);
```

### 3. MEVProtectedExecutor.sol

MEV-protected transaction executor with circuit breakers and kill switch.

#### Features
- ✅ **Flashbots Integration**: Bundle submission to Flashbots relay
- ✅ **Private Relay Support**: Compatible with various private mempools
- ✅ **Slippage Protection**: Front-running and sandwich attack protection
- ✅ **Circuit Breaker**: Automatic halt on repeated failures
- ✅ **Kill Switch**: Emergency shutdown mechanism
- ✅ **Bundle Management**: Track and manage transaction bundles
- ✅ **Role-Based Access**: Separate roles for operators and relay operators

#### Key Functions

```solidity
// Submit MEV-protected transaction bundle
function submitBundle(
    BundleTransaction[] calldata transactions,
    uint256 targetBlock,
    ProtectionStrategy strategy
) external returns (uint256 bundleId)

// Execute bundle (called by authorized relays)
function executeBundle(uint256 bundleId) external returns (bool success)

// Check slippage protection
function checkSlippage(
    uint256 expectedOutput,
    uint256 actualOutput,
    uint256 bundleId
) external view returns (bool withinLimits)

// Circuit breaker controls
function resetCircuitBreaker() external
function activateKillSwitch() external onlyOwner
function deactivateKillSwitch() external onlyOwner
```

#### Usage Example

```javascript
const transactions = [
  {
    target: arbitrageExecutorAddress,
    data: executionCalldata,
    value: 0,
    gasLimit: 500000,
    maxPriorityFee: ethers.parseUnits("2", "gwei"),
    maxFeePerGas: ethers.parseUnits("100", "gwei")
  }
];

const bundleId = await mevProtectedExecutor.submitBundle(
  transactions,
  targetBlock,
  ProtectionStrategy.FLASHBOTS
);

// Later, authorized relay executes
await mevProtectedExecutor.connect(relay).executeBundle(bundleId);
```

## Deployment

### Prerequisites

```bash
npm install
```

### Deploy Contracts

```bash
# Deploy to localhost/hardhat network
npx hardhat run scripts/deployment/deploy-executors.js --network localhost

# Deploy to testnet (e.g., Goerli)
npx hardhat run scripts/deployment/deploy-executors.js --network goerli

# Deploy to mainnet
npx hardhat run scripts/deployment/deploy-executors.js --network mainnet
```

### Configuration

1. Copy the configuration template:
```bash
cp scripts/deployment/executor-config.template.js scripts/deployment/executor-config.js
```

2. Edit `executor-config.js` with your specific parameters:
   - Network addresses (DEX routers, token addresses, etc.)
   - Treasury address for fee collection
   - Operator and relay addresses
   - Slippage and gas limits
   - Circuit breaker parameters

### Post-Deployment Setup

After deployment, configure the contracts:

```javascript
// 1. Add operators
await flashLoanExecutor.addOperator(operatorAddress);
await arbitrageExecutor.addOperator(operatorAddress);
await mevProtectedExecutor.addOperator(operatorAddress);

// 2. Authorize MEV relays
await mevProtectedExecutor.setRelayAuthorization(flashbotsRelayAddress, true);

// 3. Configure slippage protection
await arbitrageExecutor.updateSlippageConfig(100, 50, false); // 1% slippage, 0.5% min profit

// 4. Set MEV protection relay
await arbitrageExecutor.setMEVProtectionRelay(mevProtectedExecutorAddress);
```

## Security Considerations

### Access Control

All contracts inherit from `EmergencyStop` which provides:
- Owner-only administrative functions
- Operator role for execution
- Emergency stopper role for pausing

### Emergency Mechanisms

1. **Pause/Unpause**: All contracts can be paused by owner
2. **Emergency Withdrawal**: Rescue tokens when contracts are paused
3. **Circuit Breaker**: Automatic halt on repeated failures (MEVProtectedExecutor)
4. **Kill Switch**: Complete shutdown mechanism (MEVProtectedExecutor)

### Best Practices

1. **Use Multisig**: Deploy owner address as multisig wallet
2. **Start Small**: Test with small amounts before scaling
3. **Monitor Events**: Set up monitoring for all contract events
4. **Regular Audits**: Conduct security audits before mainnet deployment
5. **Gradual Rollout**: Start on testnet, then mainnet with limits
6. **Update Treasury**: Change treasury from deployer to secure multisig

## Gas Optimization

### FlashLoanExecutor
- Uses `memory` for struct parameters
- Minimal storage reads/writes
- Optimized loop iterations

### ArbitrageExecutor
- Gas-optimized swap routing
- Batch approval transactions
- Efficient validation checks

### MEVProtectedExecutor
- Packed struct storage
- View functions for pre-execution checks
- Minimal state updates

## Testing

### Unit Tests

```bash
# Run all contract tests
npm run test:contracts

# Run specific test file
npx hardhat test test/contracts/FlashLoanExecutor.test.js
```

### Integration Tests

```bash
# Run integration tests with mainnet fork
npm run test:integration
```

### Gas Benchmarking

```bash
# Run gas optimization tests
npm run test:gas
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   DeFi Arbitrage Bot                    │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              MEVProtectedExecutor                       │
│  • Bundle Management                                    │
│  • Slippage Protection                                  │
│  • Circuit Breaker                                      │
└─────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
    ┌───────────────────┐   ┌──────────────────────┐
    │ FlashLoanExecutor │   │  ArbitrageExecutor   │
    │  • Aave V3        │   │  • Uniswap V2/V3     │
    │  • Uniswap V3     │   │  • SushiSwap         │
    │  • Balancer       │   │  • Multi-hop routes  │
    └───────────────────┘   └──────────────────────┘
                │                       │
                └───────────┬───────────┘
                            ▼
                ┌─────────────────────┐
                │   DEX Protocols     │
                │  • Uniswap          │
                │  • SushiSwap        │
                │  • Aave             │
                └─────────────────────┘
```

## Events Reference

### FlashLoanExecutor Events

```solidity
event FlashLoanExecuted(Protocol protocol, address initiator, address[] assets, uint256[] amounts, uint256[] premiums, bool success)
event FlashLoanFailed(Protocol protocol, address initiator, string reason)
event ProtocolAdded(Protocol protocol, address pool, address addressesProvider)
event ProtocolUpdated(Protocol protocol, address newPool, bool isActive)
event EmergencyWithdrawal(address token, address recipient, uint256 amount)
```

### ArbitrageExecutor Events

```solidity
event ArbitrageExecuted(address executor, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 profit, uint256 gasUsed)
event ArbitrageFailed(address executor, address tokenIn, uint256 amountIn, string reason)
event RouteExecuted(uint256 routeId, uint256 hopsExecuted, uint256 totalGasUsed)
event DEXRouterRegistered(DEXType dexType, address router, bool status)
event SlippageConfigUpdated(uint256 maxSlippageBps, uint256 minProfitBps, bool enableDynamicSlippage)
event MEVProtectionRelayUpdated(address oldRelay, address newRelay)
```

### MEVProtectedExecutor Events

```solidity
event BundleSubmitted(uint256 bundleId, address submitter, uint256 targetBlock, ProtectionStrategy strategy, uint256 transactionCount)
event BundleStatusUpdated(uint256 bundleId, BundleStatus oldStatus, BundleStatus newStatus, uint256 blockNumber)
event BundleIncluded(uint256 bundleId, uint256 blockNumber, uint256 gasUsed, uint256 effectiveGasPrice)
event BundleFailed(uint256 bundleId, string reason)
event SlippageProtectionTriggered(uint256 bundleId, uint256 expectedOutput, uint256 actualOutput, uint256 slippage)
event CircuitBreakerTripped(uint256 timestamp, uint256 failureCount, uint256 cooldownUntil)
event CircuitBreakerReset(uint256 timestamp)
event KillSwitchActivated(address activator, uint256 timestamp)
event KillSwitchDeactivated(address deactivator, uint256 timestamp)
event RelayAuthorized(address relay, bool authorized)
```

## License

MIT License - See LICENSE file for details

## Support

For issues, questions, or contributions:
- GitHub Issues: [Create an issue](https://github.com/your-repo/issues)
- Documentation: [Read the docs](https://your-docs-url.com)
- Discord: [Join our community](https://discord.gg/your-invite)

## Disclaimer

These contracts are provided as-is. Always conduct thorough testing and auditing before deploying to mainnet. DeFi arbitrage involves significant risks including but not limited to:
- Smart contract vulnerabilities
- Impermanent loss
- Gas cost volatility
- MEV competition
- Market manipulation

Use at your own risk.
