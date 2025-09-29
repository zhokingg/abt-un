# Smart Contract Infrastructure

This document outlines the smart contract infrastructure implemented for the arbitrage bot system.

## 📋 Overview

The smart contract infrastructure provides a comprehensive system for executing profitable arbitrage trades with built-in security, risk management, and fee collection mechanisms.

## 🏗️ Architecture

### Core Contracts

1. **FlashLoanArbitrage.sol** - Main arbitrage execution contract
   - Integrates with Aave V3 flash loans
   - Supports multiple DEX protocols
   - Enhanced with risk management and fee collection

2. **ArbitrageExecutor.sol** - Core atomic arbitrage execution logic
   - Ensures atomic trade execution
   - Built-in slippage protection
   - Profit validation

3. **MultiDEXRouter.sol** - Multi-DEX routing and path optimization
   - Supports Uniswap V2/V3, SushiSwap, and more
   - Intelligent path optimization
   - Gas-efficient routing

### Supporting Infrastructure

4. **ArbitrageFactory.sol** - Factory for deploying arbitrage contracts
   - Minimal proxy pattern for gas efficiency
   - CREATE2 deterministic deployment
   - Contract lifecycle management

5. **PriceOracle.sol** - Price feed aggregation
   - Multi-source price feeds (Chainlink, TWAP, etc.)
   - Price deviation detection
   - Stale price protection

6. **RiskManager.sol** - On-chain risk management
   - Circuit breakers
   - Trade validation
   - Daily volume limits
   - User risk profiling

7. **FeeManager.sol** - Fee collection and distribution
   - Protocol fees
   - Performance fees
   - Gas fee optimization
   - Multi-recipient distribution

### Security Infrastructure

8. **AccessControl.sol** - Role-based access control
9. **EmergencyStop.sol** - Emergency stop functionality

## 🚀 Deployment

### Prerequisites

```bash
npm install
```

### Compile Contracts

```bash
npm run compile
```

### Run Tests

```bash
# All contract tests
npm run test:contracts

# Integration tests
npm run test:integration

# Gas optimization tests
npm run test:gas
```

### Deploy to Network

```bash
# Local deployment
npm run deploy:localhost

# Mainnet deployment (requires .env setup)
npm run deploy:mainnet
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file with:

```env
PRIVATE_KEY=your_private_key_here
RPC_URL=your_rpc_endpoint_here
ETHERSCAN_API_KEY=your_etherscan_key_here (for verification)
```

### Network Configuration

Edit `hardhat.config.js` to add custom networks:

```javascript
networks: {
  polygon: {
    url: "https://polygon-rpc.com",
    accounts: [process.env.PRIVATE_KEY]
  }
}
```

## 🧪 Testing

### Test Structure

- `test/contracts/ContractDeployment.test.js` - Basic deployment and functionality tests
- `test/contracts/GasOptimization.test.js` - Gas usage optimization tests  
- `test/contracts/integration/ContractIntegration.test.js` - Integration with existing services

### Running Specific Tests

```bash
# Single test file
npx hardhat test test/contracts/ContractDeployment.test.js

# With gas reporting
REPORT_GAS=true npx hardhat test
```

## 💰 Gas Optimization

### Deployment Costs (Estimated)

| Contract | Gas Cost | Description |
|----------|----------|-------------|
| PriceOracle | ~2.5M | Price feed management |
| RiskManager | ~3.5M | Risk controls |
| FeeManager | ~3.0M | Fee collection |
| ArbitrageRouter | ~2.0M | Basic routing |
| MultiDEXRouter | ~4.0M | Advanced routing |
| FlashLoanArbitrage | ~3.5M | Main arbitrage logic |

### Function Call Costs

| Operation | Gas Cost | Description |
|-----------|----------|-------------|
| Price Update | ~80k | Update single price feed |
| Risk Validation | ~150k | Validate trade parameters |
| Fee Calculation | ~30k | Calculate fees (view) |
| Arbitrage Execution | ~400k+ | Full arbitrage trade |

## 🔐 Security Features

### Access Control
- Owner-only functions for critical operations
- Operator roles for routine operations
- Emergency stoppers for risk mitigation

### Risk Management
- Circuit breakers for abnormal conditions
- Daily volume limits
- User risk profiling
- Price deviation alerts

### Emergency Features
- Emergency stop functionality
- Token recovery mechanisms
- Circuit breaker activation
- Manual override capabilities

## 🤝 Integration

### JavaScript Services

The contracts integrate with existing JavaScript services:

- **ContractManager** - Manages contract interactions
- **FlashloanService** - Handles Aave integration
- **ProfitCalculator** - Off-chain profit calculations

### Event Monitoring

Key events to monitor:

```javascript
// Price updates
PriceUpdated(token, price, source, timestamp)

// Risk violations
RiskViolation(user, violationType, value, threshold)

// Circuit breakers
CircuitBreakerTriggered(breakerType, reason, duration)

// Arbitrage execution
ArbitrageExecuted(tokenA, tokenB, amountIn, profit, initiator)
```

## 🛠️ Development

### Adding New DEX Support

1. Update `MultiDEXRouter.sol` with new router type
2. Implement swap logic in `_executeSwapOnRouter`
3. Add router to initialization in constructor
4. Update tests

### Adding New Risk Parameters

1. Extend `RiskParameters` struct in `RiskManager.sol`
2. Update validation logic in `validateTrade`
3. Add configuration functions
4. Update tests

### Custom Fee Structures

1. Define new fee structure in `FeeManager.sol`
2. Implement calculation logic
3. Add configuration functions
4. Update integration

## 📊 Monitoring and Analytics

### Key Metrics to Track

- Gas usage per operation
- Success/failure rates
- Profit margins
- Risk violations
- Circuit breaker activations

### Dashboard Integration

The contracts emit events that can be indexed for dashboard display:
- Real-time arbitrage execution
- Risk management alerts  
- Fee collection metrics
- System health indicators

## 🔄 Upgrades and Maintenance

### Upgrade Strategy

The system uses a factory pattern with minimal proxies, allowing for:
- New implementation deployments
- Gradual migration of instances
- Version management
- Rollback capabilities

### Maintenance Operations

Regular maintenance tasks:
1. Price feed updates
2. Risk parameter adjustments
3. Fee structure optimization
4. Security parameter updates

## 📞 Support

For technical support or questions:
1. Check test files for usage examples
2. Review contract documentation
3. Test on localhost network first
4. Monitor events for debugging

## 🚨 Important Notes

⚠️ **Security Warnings:**
- Always test on testnets first
- Use multi-sig wallets for mainnet
- Monitor circuit breakers closely
- Keep private keys secure

⚠️ **Gas Considerations:**
- Test gas usage on fork networks
- Monitor gas prices for deployment
- Consider batch operations for efficiency
- Use CREATE2 for predictable addresses

⚠️ **Risk Management:**
- Set conservative limits initially
- Monitor risk metrics continuously  
- Have emergency procedures ready
- Regular security audits recommended