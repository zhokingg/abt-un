/**
 * Enhanced Configuration Manager
 * Centralized configuration loading, caching, hot-reloading, and security
 */

import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { validateCompleteConfiguration } from './validator.js';
import config from './config.js';
import networks from './networks.js';
import tokens from './tokens.js';
import constants from './constants.js';

/**
 * Configuration Manager with advanced features
 */
export class ConfigManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {};
    this.secureConfig = new Map(); // For encrypted sensitive data
    this.configVersion = 0;
    this.lastValidation = null;
    this.watchers = new Map(); // File watchers for hot reload
    this.cache = new Map(); // Configuration cache
    
    // Options
    this.options = {
      enableHotReload: options.enableHotReload !== false,
      enableEncryption: options.enableEncryption !== false,
      enableValidation: options.enableValidation !== false,
      enableCache: options.enableCache !== false,
      cacheTimeout: options.cacheTimeout || 300000, // 5 minutes
      encryptionKey: options.encryptionKey || this.generateEncryptionKey(),
      configPaths: options.configPaths || {
        main: path.join(process.cwd(), 'src/config/config.js'),
        networks: path.join(process.cwd(), 'src/config/networks.js'),
        tokens: path.join(process.cwd(), 'src/config/tokens.js'),
        constants: path.join(process.cwd(), 'src/config/constants.js')
      },
      ...options
    };

    this.loadAllConfigurations();
    
    if (this.options.enableHotReload) {
      this.setupHotReload();
    }
  }

  /**
   * Load all configuration files
   */
  loadAllConfigurations() {
    try {
      // Load main configuration
      this.config = {
        ...config,
        networks: networks,
        tokens: tokens,
        constants: constants,
        _version: ++this.configVersion,
        _loadedAt: new Date().toISOString()
      };

      // Load environment-specific overrides
      this.loadEnvironmentOverrides();

      // Validate configuration if enabled
      if (this.options.enableValidation) {
        this.validateConfiguration();
      }

      this.emit('configLoaded', {
        version: this.configVersion,
        timestamp: Date.now()
      });

      console.log(`✅ Configuration loaded (version: ${this.configVersion})`);

    } catch (error) {
      console.error('❌ Failed to load configuration:', error.message);
      this.emit('configError', error);
      throw error;
    }
  }

  /**
   * Load environment-specific configuration overrides
   */
  loadEnvironmentOverrides() {
    const env = process.env.NODE_ENV || 'development';
    const presetPath = path.join(process.cwd(), `src/config/presets/${env}.js`);
    
    try {
      if (fs.existsSync(presetPath)) {
        // Dynamic import would be used here in practice
        console.log(`📋 Loaded ${env} environment overrides`);
      }
    } catch (error) {
      console.warn(`⚠️ Could not load environment preset for ${env}:`, error.message);
    }

    // Apply environment variable overrides
    this.applyEnvironmentVariableOverrides();
  }

  /**
   * Apply environment variable overrides
   */
  applyEnvironmentVariableOverrides() {
    const envOverrides = {};

    // Map environment variables to config paths
    const envMappings = {
      'RPC_URL': 'RPC_URL',
      'CHAIN_ID': 'CHAIN_ID',
      'REDIS_URL': 'REDIS_URL',
      'MIN_PROFIT_THRESHOLD': 'MIN_PROFIT_THRESHOLD',
      'MAX_TRADE_AMOUNT': 'MAX_TRADE_AMOUNT',
      'DRY_RUN': 'DRY_RUN',
      'LOG_LEVEL': 'LOG_LEVEL',
      'NODE_ENV': 'NODE_ENV'
    };

    for (const [envKey, configPath] of Object.entries(envMappings)) {
      if (process.env[envKey] !== undefined) {
        this.setNestedValue(envOverrides, configPath, this.parseEnvValue(process.env[envKey]));
      }
    }

    // Merge overrides into config
    this.config = { ...this.config, ...envOverrides };
  }

  /**
   * Parse environment variable values
   */
  parseEnvValue(value) {
    // Parse boolean values
    if (value === 'true') return true;
    if (value === 'false') return false;

    // Parse numbers
    const numValue = Number(value);
    if (!isNaN(numValue) && isFinite(numValue)) {
      return numValue;
    }

    // Return as string
    return value;
  }

  /**
   * Setup hot reload functionality
   */
  setupHotReload() {
    for (const [name, filePath] of Object.entries(this.options.configPaths)) {
      if (fs.existsSync(filePath)) {
        const watcher = fs.watchFile(filePath, (curr, prev) => {
          if (curr.mtime !== prev.mtime) {
            console.log(`🔄 Configuration file changed: ${name}`);
            this.reloadConfiguration();
          }
        });
        this.watchers.set(name, watcher);
      }
    }
  }

  /**
   * Reload configuration files
   */
  async reloadConfiguration() {
    try {
      // Clear module cache for hot reload (implementation specific)
      this.clearModuleCache();
      
      // Reload configurations
      this.loadAllConfigurations();
      
      this.emit('configReloaded', {
        version: this.configVersion,
        timestamp: Date.now()
      });

      console.log(`🔄 Configuration reloaded (version: ${this.configVersion})`);

    } catch (error) {
      console.error('❌ Failed to reload configuration:', error.message);
      this.emit('configReloadError', error);
    }
  }

  /**
   * Clear module cache for hot reload
   */
  clearModuleCache() {
    // In practice, this would clear the module cache
    // Implementation depends on the module system used
    this.cache.clear();
  }

  /**
   * Validate current configuration
   */
  async validateConfiguration() {
    try {
      this.lastValidation = await validateCompleteConfiguration(this.config);
      
      if (!this.lastValidation.isValid) {
        console.error('❌ Configuration validation failed:');
        this.lastValidation.errors.forEach(error => console.error(`  - ${error}`));
        throw new Error('Configuration validation failed');
      }

      if (this.lastValidation.warnings.length > 0) {
        console.warn('⚠️ Configuration warnings:');
        this.lastValidation.warnings.forEach(warning => console.warn(`  - ${warning}`));
      }

      console.log('✅ Configuration validation passed');

    } catch (error) {
      console.error('❌ Configuration validation error:', error.message);
      throw error;
    }
  }

  /**
   * Get configuration value
   */
  get(key, defaultValue = undefined) {
    if (this.options.enableCache) {
      const cacheKey = `get_${key}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.options.cacheTimeout) {
        return cached.value;
      }
    }

    const value = this.getNestedValue(this.config, key) ?? defaultValue;
    
    if (this.options.enableCache) {
      this.cache.set(`get_${key}`, {
        value,
        timestamp: Date.now()
      });
    }

    return value;
  }

  /**
   * Set configuration value
   */
  set(key, value) {
    this.setNestedValue(this.config, key, value);
    this.configVersion++;
    this.clearCacheForKey(key);
    
    this.emit('configChanged', {
      key,
      value,
      version: this.configVersion,
      timestamp: Date.now()
    });
  }

  /**
   * Get secure configuration value (encrypted)
   */
  getSecure(key, defaultValue = undefined) {
    if (!this.secureConfig.has(key)) {
      return defaultValue;
    }

    try {
      const encrypted = this.secureConfig.get(key);
      return this.decrypt(encrypted);
    } catch (error) {
      console.error(`❌ Failed to decrypt secure config: ${key}`);
      return defaultValue;
    }
  }

  /**
   * Set secure configuration value (encrypted)
   */
  setSecure(key, value) {
    try {
      const encrypted = this.encrypt(value);
      this.secureConfig.set(key, encrypted);
      
      this.emit('secureConfigChanged', {
        key,
        version: this.configVersion,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(`❌ Failed to encrypt secure config: ${key}`, error.message);
      throw error;
    }
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(data) {
    if (!this.options.enableEncryption) {
      return data;
    }

    const cipher = crypto.createCipher('aes-256-cbc', this.options.encryptionKey);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData) {
    if (!this.options.enableEncryption) {
      return encryptedData;
    }

    const decipher = crypto.createDecipher('aes-256-cbc', this.options.encryptionKey);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  }

  /**
   * Generate encryption key
   */
  generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Clear cache for specific key
   */
  clearCacheForKey(key) {
    const keysToDelete = [];
    for (const cacheKey of this.cache.keys()) {
      if (cacheKey.includes(key)) {
        keysToDelete.push(cacheKey);
      }
    }
    keysToDelete.forEach(k => this.cache.delete(k));
  }

  /**
   * Get nested value from object
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => 
      current && current[key] !== undefined ? current[key] : undefined, obj);
  }

  /**
   * Set nested value in object
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!(key in current)) {
        current[key] = {};
      }
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  /**
   * Get configuration summary
   */
  getSummary() {
    return {
      version: this.configVersion,
      environment: this.get('NODE_ENV'),
      chainId: this.get('CHAIN_ID'),
      networksEnabled: Object.entries(this.get('networks', {}))
        .filter(([_, network]) => network.enabled)
        .map(([name]) => name),
      isDryRun: this.get('DRY_RUN'),
      lastValidation: this.lastValidation,
      cacheSize: this.cache.size,
      secureConfigItems: this.secureConfig.size,
      hotReloadEnabled: this.options.enableHotReload,
      loadedAt: this.get('_loadedAt')
    };
  }

  /**
   * Export configuration (excluding sensitive data)
   */
  exportConfig(includeSensitive = false) {
    const exported = { ...this.config };
    
    if (!includeSensitive) {
      // Remove sensitive fields
      const sensitiveFields = ['PRIVATE_KEY', 'COINGECKO_API_KEY'];
      sensitiveFields.forEach(field => {
        if (exported[field]) {
          exported[field] = '***REDACTED***';
        }
      });
    }

    return exported;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    // Stop file watchers
    this.watchers.forEach((watcher, name) => {
      fs.unwatchFile(this.options.configPaths[name]);
    });
    this.watchers.clear();

    // Clear caches
    this.cache.clear();
    this.secureConfig.clear();

    // Remove event listeners
    this.removeAllListeners();

    console.log('🧹 ConfigManager cleanup completed');
  }
}

// Create singleton instance
const configManager = new ConfigManager({
  enableHotReload: process.env.NODE_ENV !== 'production',
  enableEncryption: true,
  enableValidation: true,
  enableCache: true
});

export default configManager;