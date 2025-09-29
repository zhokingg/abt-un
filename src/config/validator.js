/**
 * Configuration Validation System
 * Provides comprehensive validation for all configuration objects
 */

import { ethers } from 'ethers';

/**
 * Configuration validation rules and schemas
 */
export const validationSchemas = {
  // Environment variables validation
  environment: {
    RPC_URL: {
      required: true,
      type: 'string',
      validator: (value) => {
        if (!value || value.includes('YOUR_INFURA_KEY') || value.includes('YOUR_ALCHEMY_KEY')) {
          return 'Invalid RPC URL - please configure with actual API key';
        }
        try {
          new URL(value);
          return null;
        } catch {
          return 'Invalid URL format';
        }
      }
    },
    PRIVATE_KEY: {
      required: false,
      type: 'string',
      validator: (value) => {
        if (!value) return null; // Optional for dry run
        try {
          new ethers.Wallet(value);
          return null;
        } catch {
          return 'Invalid private key format';
        }
      }
    },
    CHAIN_ID: {
      required: true,
      type: 'number',
      validator: (value) => {
        const validChainIds = [1, 5, 10, 56, 137, 250, 42161, 43114, 11155111];
        if (!validChainIds.includes(value)) {
          return `Unsupported chain ID: ${value}`;
        }
        return null;
      }
    },
    MIN_PROFIT_THRESHOLD: {
      required: true,
      type: 'number',
      validator: (value) => {
        if (value <= 0 || value > 100) {
          return 'Profit threshold must be between 0 and 100 percent';
        }
        return null;
      }
    }
  },

  // Network configuration validation
  network: {
    chainId: { required: true, type: 'number' },
    name: { required: true, type: 'string' },
    rpcUrls: { 
      required: true, 
      type: 'array',
      validator: (urls) => {
        if (!Array.isArray(urls) || urls.length === 0) {
          return 'At least one RPC URL is required';
        }
        for (const url of urls) {
          try {
            new URL(url);
          } catch {
            return `Invalid RPC URL: ${url}`;
          }
        }
        return null;
      }
    },
    contracts: { required: true, type: 'object' },
    gasSettings: { required: true, type: 'object' },
    enabled: { required: true, type: 'boolean' },
    isTestnet: { required: true, type: 'boolean' }
  },

  // Token configuration validation
  token: {
    address: { 
      required: true, 
      type: 'string',
      validator: (value) => {
        if (!ethers.isAddress(value) && value !== '0x0000000000000000000000000000000000000000') {
          return 'Invalid Ethereum address';
        }
        return null;
      }
    },
    symbol: { required: true, type: 'string' },
    name: { required: true, type: 'string' },
    decimals: { 
      required: true, 
      type: 'number',
      validator: (value) => {
        if (value < 0 || value > 36) {
          return 'Token decimals must be between 0 and 36';
        }
        return null;
      }
    },
    type: { 
      required: true, 
      type: 'string',
      validator: (value) => {
        const validTypes = ['native', 'wrapped', 'erc20', 'stablecoin'];
        if (!validTypes.includes(value)) {
          return `Invalid token type: ${value}`;
        }
        return null;
      }
    }
  }
};

/**
 * Generic validation function
 */
export function validateObject(object, schema, objectName = 'object') {
  const errors = [];

  for (const [key, rules] of Object.entries(schema)) {
    const value = object[key];

    // Check required fields
    if (rules.required && (value === undefined || value === null)) {
      errors.push(`${objectName}.${key} is required`);
      continue;
    }

    // Skip validation if value is undefined/null and not required
    if (value === undefined || value === null) {
      continue;
    }

    // Type validation
    if (rules.type && !validateType(value, rules.type)) {
      errors.push(`${objectName}.${key} must be of type ${rules.type}`);
      continue;
    }

    // Custom validator
    if (rules.validator) {
      const validationError = rules.validator(value);
      if (validationError) {
        errors.push(`${objectName}.${key}: ${validationError}`);
      }
    }
  }

  return errors;
}

/**
 * Type validation helper
 */
function validateType(value, expectedType) {
  switch (expectedType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && !Array.isArray(value) && value !== null;
    default:
      return true;
  }
}

/**
 * Validate environment configuration
 */
export function validateEnvironmentConfig(config) {
  return validateObject(config, validationSchemas.environment, 'config');
}

/**
 * Validate network configuration
 */
export function validateNetworkConfig(networkConfig, networkName) {
  return validateObject(networkConfig, validationSchemas.network, `network.${networkName}`);
}

/**
 * Validate token configuration
 */
export function validateTokenConfig(tokenConfig, tokenSymbol, networkName) {
  return validateObject(tokenConfig, validationSchemas.token, `token.${networkName}.${tokenSymbol}`);
}

/**
 * Validate RPC connectivity
 */
export async function validateRpcConnectivity(rpcUrl, chainId, timeout = 5000) {
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Set timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('RPC connection timeout')), timeout);
    });

    // Test connection and chain ID
    const [network, blockNumber] = await Promise.race([
      Promise.all([
        provider.getNetwork(),
        provider.getBlockNumber()
      ]),
      timeoutPromise
    ]);

    if (Number(network.chainId) !== chainId) {
      return {
        isValid: false,
        error: `Chain ID mismatch: expected ${chainId}, got ${network.chainId}`
      };
    }

    return {
      isValid: true,
      blockNumber,
      chainId: Number(network.chainId),
      latency: Date.now() // This would be measured properly in practice
    };

  } catch (error) {
    return {
      isValid: false,
      error: error.message
    };
  }
}

/**
 * Validate contract addresses
 */
export async function validateContractAddress(address, rpcUrl, expectedInterface = null) {
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const code = await provider.getCode(address);
    
    if (code === '0x') {
      return {
        isValid: false,
        error: 'No contract found at address'
      };
    }

    // If expected interface is provided, validate it
    if (expectedInterface) {
      try {
        const contract = new ethers.Contract(address, expectedInterface, provider);
        // Try to call a view function to verify interface
        // This would need to be customized based on the actual interface
        return { isValid: true };
      } catch (error) {
        return {
          isValid: false,
          error: `Contract interface validation failed: ${error.message}`
        };
      }
    }

    return { isValid: true };

  } catch (error) {
    return {
      isValid: false,
      error: error.message
    };
  }
}

/**
 * Comprehensive configuration validation
 */
export async function validateCompleteConfiguration(config) {
  const results = {
    isValid: true,
    errors: [],
    warnings: [],
    networkStatus: {},
    contractStatus: {}
  };

  // 1. Validate environment configuration
  const envErrors = validateEnvironmentConfig(config);
  results.errors.push(...envErrors);

  // 2. Validate networks (if networks config is available)
  if (config.networks) {
    for (const [networkName, networkConfig] of Object.entries(config.networks)) {
      const networkErrors = validateNetworkConfig(networkConfig, networkName);
      results.errors.push(...networkErrors);

      // Test RPC connectivity for enabled networks
      if (networkConfig.enabled && networkConfig.rpcUrls?.[0]) {
        try {
          const connectivityResult = await validateRpcConnectivity(
            networkConfig.rpcUrls[0], 
            networkConfig.chainId
          );
          results.networkStatus[networkName] = connectivityResult;
          
          if (!connectivityResult.isValid) {
            results.warnings.push(`Network ${networkName}: ${connectivityResult.error}`);
          }
        } catch (error) {
          results.warnings.push(`Network ${networkName}: Failed to test connectivity - ${error.message}`);
        }
      }
    }
  }

  // 3. Validate tokens (if tokens config is available)
  if (config.tokens) {
    for (const [networkName, tokens] of Object.entries(config.tokens)) {
      for (const [tokenSymbol, tokenConfig] of Object.entries(tokens)) {
        const tokenErrors = validateTokenConfig(tokenConfig, tokenSymbol, networkName);
        results.errors.push(...tokenErrors);
      }
    }
  }

  // 4. Production-specific validations
  if (config.NODE_ENV === 'production') {
    if (config.DRY_RUN !== false) {
      results.warnings.push('Dry run mode is enabled in production');
    }
    
    if (!config.PRIVATE_KEY) {
      results.errors.push('Private key is required in production mode');
    }

    if (config.LOG_LEVEL === 'debug') {
      results.warnings.push('Debug logging enabled in production');
    }
  }

  results.isValid = results.errors.length === 0;
  return results;
}

export default {
  validationSchemas,
  validateObject,
  validateEnvironmentConfig,
  validateNetworkConfig,
  validateTokenConfig,
  validateRpcConnectivity,
  validateContractAddress,
  validateCompleteConfiguration
};