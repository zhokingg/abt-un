# Comprehensive Configuration Management System

## Overview

This configuration management system provides a robust, multi-chain, environment-aware configuration solution for the arbitrage bot. It supports hot-reloading, validation, security, and multi-network deployments.

## Architecture

```
src/config/
├── config.js              # Main configuration file
├── networks.js             # Multi-chain network definitions
├── tokens.js               # Token database with risk scoring
├── constants.js            # Protocol addresses and constants
├── validator.js            # Configuration validation system
├── ConfigManager.js        # Configuration lifecycle management
├── NetworkManager.js       # Multi-chain network management
├── integration-example.js  # Integration examples
├── config.test.js         # Comprehensive test suite
└── presets/               # Environment-specific configurations
    ├── development.js
    ├── production.js
    ├── testing.js
    └── staging.js
```

## Quick Start

### Basic Usage

```javascript
import configManager from './src/config/ConfigManager.js';
import networkManager from './src/config/NetworkManager.js';
import { getOptimalArbitragePairs } from './src/config/tokens.js';

// Initialize configuration
await networkManager.initialize();

// Get configuration values
const minProfit = configManager.get('MIN_PROFIT_THRESHOLD');
const riskLimits = configManager.get('PHASE4.RISK_LIMITS');

// Get optimal trading pairs
const pairs = getOptimalArbitragePairs('ethereum', 'MEDIUM');

// Switch networks
await networkManager.switchToNetwork('polygon');
```

### Environment Configuration

Set your environment in `.env`:

```bash
NODE_ENV=development
RPC_URL=https://mainnet.infura.io/v3/your-key
PRIVATE_KEY=your-private-key
MIN_PROFIT_THRESHOLD=0.5
```

## Core Components

### 1. ConfigManager

Provides centralized configuration management with hot-reload and security features.

**Features:**
- Hot configuration reloading
- Encrypted storage for sensitive data
- Event-driven configuration changes
- Validation and caching
- Environment variable overrides

**Usage:**
```javascript
import configManager from './ConfigManager.js';

// Get configuration values
const value = configManager.get('path.to.config');
const secureValue = configManager.getSecure('sensitive.data');

// Set configuration values
configManager.set('new.config', 'value');
configManager.setSecure('api.key', 'secret-key');

// Listen for changes
configManager.on('configChanged', (event) => {
  console.log(`Config changed: ${event.key} = ${event.value}`);
});
```

### 2. NetworkManager

Manages multi-chain network connections with health monitoring and automatic failover.

**Features:**
- Multi-chain provider management
- Health monitoring and automatic failover
- Connection pooling and load balancing
- Network latency optimization
- Provider blacklisting and recovery

**Usage:**
```javascript
import networkManager from './NetworkManager.js';

// Initialize network manager
await networkManager.initialize();

// Switch networks
await networkManager.switchToNetwork('arbitrum');

// Execute RPC calls with automatic failover
const result = await networkManager.executeCall('eth_getBalance', [address, 'latest']);

// Get network statistics
const stats = networkManager.getNetworkStats();
```

### 3. Token Configuration

Comprehensive token database with risk scoring and cross-chain support.

**Features:**
- Multi-chain token definitions
- Risk scoring and liquidity analysis
- Trading pair optimization
- Stablecoin arbitrage pairs
- Cross-chain token mapping

**Usage:**
```javascript
import { 
  getToken, 
  getOptimalArbitragePairs, 
  getTokenRiskCategory,
  validateTokenPair 
} from './tokens.js';

// Get token information
const weth = getToken('WETH', 'ethereum');
const usdcPolygon = getToken('USDC', 'polygon');

// Get risk category
const risk = getTokenRiskCategory('WETH');
console.log(`Risk level: ${risk.category}, Score: ${risk.riskScore}`);

// Get optimal trading pairs
const pairs = getOptimalArbitragePairs('ethereum', 'MEDIUM');

// Validate token pair
const validation = validateTokenPair('WETH', 'USDC', 'ethereum');
```

### 4. Network Configuration

Multi-chain network definitions with comprehensive protocol support.

**Supported Networks:**
- **Mainnets:** Ethereum, Polygon, Arbitrum, Optimism, Base, BSC
- **Testnets:** Goerli, Sepolia, Mumbai

**Features:**
- Multiple RPC endpoints with failover
- Gas optimization settings
- Protocol contract addresses
- Feature flags and capabilities
- Block explorer integration

**Usage:**
```javascript
import { 
  getNetworkByChainId, 
  getEnabledNetworks, 
  networkSupportsFeature 
} from './networks.js';

// Get network by chain ID
const ethereum = getNetworkByChainId(1);

// Check feature support
const hasUniswapV3 = networkSupportsFeature('ethereum', 'uniswapV3');

// Get enabled networks
const enabled = getEnabledNetworks();
```

## Environment Presets

### Development (`presets/development.js`)

**Characteristics:**
- Dry run mode enabled
- Debug logging
- Hot-reload enabled
- Relaxed risk limits
- Local Redis instance

**Use Case:** Local development and debugging

### Production (`presets/production.js`)

**Characteristics:**
- Live trading enabled
- Strict risk management
- Comprehensive monitoring
- Full alerting system
- Optimized performance targets

**Use Case:** Live production trading

### Testing (`presets/testing.js`)

**Characteristics:**
- Testnet networks only
- Mocking enabled
- Fast execution
- Minimal external dependencies
- Deterministic behavior

**Use Case:** Automated testing and CI/CD

### Staging (`presets/staging.js`)

**Characteristics:**
- Production-like settings
- Dry run for safety
- Comprehensive validation
- Feature flags enabled
- End-to-end testing

**Use Case:** Pre-production validation

## Configuration Validation

The system includes comprehensive validation for all configuration components:

```javascript
import { validateCompleteConfiguration } from './validator.js';

// Validate entire configuration
const validation = await validateCompleteConfiguration(config);

if (!validation.isValid) {
  console.error('Configuration errors:', validation.errors);
}

if (validation.warnings.length > 0) {
  console.warn('Configuration warnings:', validation.warnings);
}
```

**Validation Features:**
- RPC connectivity testing
- Contract address verification
- Token configuration validation
- Environment variable checking
- Network accessibility testing

## Risk Management

The system includes sophisticated risk management with multi-level scoring:

```javascript
import { calculateTokenRiskScore, getTokenRiskCategory } from './tokens.js';

// Get token risk information
const riskCategory = getTokenRiskCategory('WETH');
const riskScore = calculateTokenRiskScore('WETH', 'ethereum');

console.log(`Risk Category: ${riskCategory.category}`);
console.log(`Risk Score: ${riskScore}/10`);
console.log(`Max Position Size: ${riskCategory.maxPositionSize * 100}%`);
```

**Risk Categories:**
- **LOW:** Blue-chip tokens (WETH, WBTC, USDC, USDT)
- **MEDIUM:** Established altcoins (LINK, UNI, AAVE)
- **HIGH:** Smaller tokens with moderate liquidity
- **VERY_HIGH:** Experimental or low-liquidity tokens

## Integration Example

See `integration-example.js` for a complete example of integrating the configuration system with the CoreArbitrageEngine.

```javascript
import { EnhancedArbitrageEngine } from './integration-example.js';

// Create and initialize enhanced engine
const engine = new EnhancedArbitrageEngine();
await engine.initialize();

// Execute arbitrage with configuration-aware risk management
const result = await engine.executeArbitrage({
  tokenA: 'WETH',
  tokenB: 'USDC',
  network: 'ethereum',
  expectedProfit: 0.8,
  tradeAmount: 1000
});
```

## Environment Variables

### Required Variables

```bash
# Network Configuration
RPC_URL=https://mainnet.infura.io/v3/your-project-id
CHAIN_ID=1

# Security
PRIVATE_KEY=your-private-key-here

# Trading Parameters
MIN_PROFIT_THRESHOLD=0.5
MAX_TRADE_AMOUNT=10000
```

### Optional Variables

```bash
# Additional RPC Endpoints
RPC_URL_SECONDARY=https://eth-mainnet.alchemyapi.io/v2/your-key
RPC_URL_TERTIARY=https://rpc.ankr.com/eth

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true
ENABLE_ALERTS=true

# Gas Optimization
GAS_OPTIMIZATION_ENABLED=true
GAS_STRATEGY_DEFAULT=BALANCED_OPTIMIZATION

# Flashbots
FLASHBOTS_ENABLED=true
FLASHBOTS_PROFIT_THRESHOLD=100
```

## Performance Optimization

### Caching

The system includes multiple levels of caching:

```javascript
// Configuration caching (5 minutes default)
const value = configManager.get('cached.value');

// Network provider caching
const provider = networkManager.getCurrentProvider('ethereum');

// Token lookup caching
const token = getToken('WETH', 'ethereum'); // Cached after first lookup
```

### Connection Pooling

Network connections are pooled and load-balanced:

```javascript
// Connection pool automatically manages provider rotation
const result = await networkManager.executeCall('eth_call', [callData]);
```

### Lazy Loading

Large configuration objects are loaded on-demand:

```javascript
// Token data loaded only when accessed
const polygonTokens = getNetworkTokens('polygon');
```

## Security Features

### Encrypted Storage

Sensitive configuration data is encrypted:

```javascript
// Store encrypted sensitive data
configManager.setSecure('api.keys.coingecko', 'sensitive-api-key');

// Retrieve and decrypt
const apiKey = configManager.getSecure('api.keys.coingecko');
```

### Access Control

Configuration changes can be restricted:

```javascript
// Set up access control (in production)
configManager.options.enableAccessControl = true;
configManager.options.requireTLS = true;
```

### Audit Logging

All configuration changes are logged:

```javascript
configManager.on('configChanged', (event) => {
  console.log(`[AUDIT] ${event.timestamp}: ${event.key} changed by ${event.user}`);
});
```

## Testing

The system includes comprehensive tests:

```bash
# Run all configuration tests
npm test src/config/config.test.js

# Run specific test suites
npm test -- --testNamePattern="ConfigManager"
npm test -- --testNamePattern="NetworkManager"
npm test -- --testNamePattern="Tokens"
```

## Monitoring and Observability

### Metrics Collection

```javascript
// System automatically collects metrics
configManager.on('metrics', (metrics) => {
  console.log('System metrics:', metrics);
});
```

### Health Checks

```javascript
// Check system health
const health = engine.getSystemHealth();
console.log(`System status: ${health.status}`);
```

### Network Monitoring

```javascript
// Monitor network health
networkManager.on('providerHealthChanged', (event) => {
  if (!event.isHealthy) {
    console.warn(`Provider ${event.provider} is unhealthy`);
  }
});
```

## Troubleshooting

### Common Issues

1. **RPC Connection Failures**
   ```javascript
   // Check RPC connectivity
   const result = await validateRpcConnectivity(rpcUrl, chainId);
   if (!result.isValid) {
     console.error('RPC Error:', result.error);
   }
   ```

2. **Configuration Validation Errors**
   ```javascript
   // Validate specific configuration
   const errors = validateEnvironmentConfig(config);
   console.log('Validation errors:', errors);
   ```

3. **Token Lookup Failures**
   ```javascript
   // Check if token exists
   try {
     const token = getToken('SYMBOL', 'network');
   } catch (error) {
     console.error('Token not found:', error.message);
   }
   ```

### Debug Mode

Enable debug mode for detailed logging:

```bash
NODE_ENV=development
LOG_LEVEL=debug
```

## Migration Guide

### From Legacy Configuration

To migrate from the legacy configuration system:

1. **Update imports:**
   ```javascript
   // Old
   import config from './config/config.js';
   
   // New
   import configManager from './config/ConfigManager.js';
   ```

2. **Update configuration access:**
   ```javascript
   // Old
   const minProfit = config.MIN_PROFIT_THRESHOLD;
   
   // New
   const minProfit = configManager.get('MIN_PROFIT_THRESHOLD');
   ```

3. **Add network management:**
   ```javascript
   // New
   import networkManager from './config/NetworkManager.js';
   await networkManager.initialize();
   ```

4. **Update token handling:**
   ```javascript
   // Old
   const tokens = config.TOKENS;
   
   // New
   import { getNetworkTokens } from './config/tokens.js';
   const tokens = getNetworkTokens('ethereum');
   ```

## Best Practices

1. **Use environment presets** for different deployment environments
2. **Validate configuration** before starting the application
3. **Monitor network health** and implement automatic failover
4. **Cache frequently accessed** configuration values
5. **Use risk scoring** to make informed trading decisions
6. **Implement proper error handling** for configuration failures
7. **Regularly update** token and network configurations
8. **Test configuration changes** in staging before production

## Contributing

When adding new configuration features:

1. Update the appropriate configuration file
2. Add validation rules in `validator.js`
3. Include comprehensive tests
4. Update this documentation
5. Consider backward compatibility

## License

This configuration management system is part of the arbitrage bot project and follows the same license terms.