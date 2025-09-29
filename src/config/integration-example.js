/**
 * Integration Example: Using the Enhanced Configuration System
 * Demonstrates how to integrate the new configuration management system
 * with the existing CoreArbitrageEngine and other services
 */

import configManager from './ConfigManager.js';
import networkManager from './NetworkManager.js';
import { validateCompleteConfiguration } from './validator.js';
import { getOptimalArbitragePairs, getTokenRiskCategory } from './tokens.js';
import { getEnabledNetworks } from './networks.js';

/**
 * Enhanced CoreArbitrageEngine Integration
 */
export class EnhancedArbitrageEngine {
  constructor(options = {}) {
    this.configManager = configManager;
    this.networkManager = networkManager;
    this.isInitialized = false;
    this.supportedNetworks = new Set();
    this.activePairs = new Map();
    this.riskLimits = new Map();
    
    // Setup configuration event listeners
    this.setupConfigurationListeners();
  }

  /**
   * Initialize the enhanced arbitrage engine
   */
  async initialize() {
    try {
      console.log('🚀 Initializing Enhanced Arbitrage Engine...');
      
      // 1. Validate complete configuration
      console.log('📋 Validating configuration...');
      const validation = await validateCompleteConfiguration(this.configManager.exportConfig());
      
      if (!validation.isValid) {
        console.error('❌ Configuration validation failed:');
        validation.errors.forEach(error => console.error(`  - ${error}`));
        throw new Error('Configuration validation failed');
      }
      
      if (validation.warnings.length > 0) {
        console.warn('⚠️ Configuration warnings:');
        validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
      }

      // 2. Initialize network manager
      console.log('🌐 Initializing network management...');
      await this.networkManager.initialize();
      
      // 3. Setup supported networks
      console.log('🔗 Setting up supported networks...');
      this.setupSupportedNetworks();
      
      // 4. Load trading pairs and risk management
      console.log('📊 Loading trading pairs and risk settings...');
      this.loadTradingConfiguration();
      
      // 5. Setup monitoring and health checks
      console.log('📈 Setting up monitoring...');
      this.setupMonitoring();
      
      this.isInitialized = true;
      console.log('✅ Enhanced Arbitrage Engine initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced Arbitrage Engine:', error.message);
      throw error;
    }
  }

  /**
   * Setup configuration event listeners
   */
  setupConfigurationListeners() {
    // Listen for configuration changes
    this.configManager.on('configChanged', (event) => {
      console.log(`🔄 Configuration changed: ${event.key} = ${event.value}`);
      this.handleConfigurationChange(event);
    });

    // Listen for network changes
    this.networkManager.on('networkChanged', (event) => {
      console.log(`🔄 Network changed: ${event.previous} → ${event.current}`);
      this.handleNetworkChange(event);
    });

    // Listen for provider health changes
    this.networkManager.on('providerHealthChanged', (event) => {
      if (!event.isHealthy) {
        console.warn(`⚠️ Provider unhealthy: ${event.provider} on ${event.network}`);
      }
    });
  }

  /**
   * Setup supported networks based on configuration
   */
  setupSupportedNetworks() {
    const enabledNetworks = getEnabledNetworks();
    
    for (const [networkName, networkConfig] of Object.entries(enabledNetworks)) {
      this.supportedNetworks.add(networkName);
      console.log(`✅ Network enabled: ${networkConfig.name} (Chain ID: ${networkConfig.chainId})`);
    }
    
    if (this.supportedNetworks.size === 0) {
      throw new Error('No networks are enabled in configuration');
    }
  }

  /**
   * Load trading configuration for all supported networks
   */
  loadTradingConfiguration() {
    const riskTolerance = this.configManager.get('RISK_TOLERANCE', 'MEDIUM');
    
    for (const networkName of this.supportedNetworks) {
      try {
        // Get optimal trading pairs for this network
        const optimalPairs = getOptimalArbitragePairs(networkName, riskTolerance);
        this.activePairs.set(networkName, optimalPairs);
        
        // Setup risk limits for this network
        const networkRiskLimits = this.calculateNetworkRiskLimits(networkName);
        this.riskLimits.set(networkName, networkRiskLimits);
        
        console.log(`📊 Loaded ${optimalPairs.length} trading pairs for ${networkName}`);
        
      } catch (error) {
        console.warn(`⚠️ Failed to load trading config for ${networkName}: ${error.message}`);
      }
    }
  }

  /**
   * Calculate risk limits for a specific network
   */
  calculateNetworkRiskLimits(networkName) {
    const globalRiskLimits = this.configManager.get('PHASE4.RISK_LIMITS', {});
    const networkMultiplier = this.getNetworkRiskMultiplier(networkName);
    
    return {
      maxTradeAmount: globalRiskLimits.maxTradeAmount * networkMultiplier,
      maxPositionSize: globalRiskLimits.maxPositionSize,
      maxDailyLoss: globalRiskLimits.maxDailyLoss * networkMultiplier,
      emergencyStopLoss: globalRiskLimits.emergencyStopLoss
    };
  }

  /**
   * Get risk multiplier based on network characteristics
   */
  getNetworkRiskMultiplier(networkName) {
    const networkMultipliers = {
      ethereum: 1.0,    // Full exposure on Ethereum
      polygon: 0.8,     // Slightly reduced on Polygon
      arbitrum: 0.9,    // Almost full on Arbitrum
      optimism: 0.8,    // Reduced on Optimism
      base: 0.6,        // Conservative on Base
      bsc: 0.7          // Moderate on BSC
    };
    
    return networkMultipliers[networkName] || 0.5; // Default conservative
  }

  /**
   * Setup monitoring and health checks
   */
  setupMonitoring() {
    const monitoringConfig = this.configManager.get('PHASE4.MONITORING', {});
    
    if (monitoringConfig.enableMetrics) {
      setInterval(() => {
        this.collectMetrics();
      }, monitoringConfig.metricsInterval || 30000);
    }
    
    if (monitoringConfig.enableFileLogging) {
      this.setupFileLogging();
    }
  }

  /**
   * Collect and report system metrics
   */
  collectMetrics() {
    const metrics = {
      timestamp: new Date().toISOString(),
      configVersion: this.configManager.get('_version'),
      activeNetworks: Array.from(this.supportedNetworks),
      networkStats: this.networkManager.getNetworkStats(),
      activePairs: this.getActivePairsCount(),
      systemHealth: this.getSystemHealth()
    };
    
    // Emit metrics for external monitoring systems
    this.configManager.emit('metrics', metrics);
  }

  /**
   * Get count of active trading pairs across all networks
   */
  getActivePairsCount() {
    let total = 0;
    for (const pairs of this.activePairs.values()) {
      total += pairs.length;
    }
    return total;
  }

  /**
   * Get overall system health status
   */
  getSystemHealth() {
    const healthChecks = {
      configurationValid: true,
      networksHealthy: this.checkNetworkHealth(),
      tradingPairsLoaded: this.activePairs.size > 0,
      riskLimitsConfigured: this.riskLimits.size > 0
    };
    
    const allHealthy = Object.values(healthChecks).every(check => check === true);
    
    return {
      status: allHealthy ? 'healthy' : 'degraded',
      checks: healthChecks
    };
  }

  /**
   * Check if networks are healthy
   */
  checkNetworkHealth() {
    const networkStats = this.networkManager.getNetworkStats();
    
    for (const [networkName, stats] of Object.entries(networkStats)) {
      if (stats.healthyProviders === 0) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Handle configuration changes
   */
  handleConfigurationChange(event) {
    const { key, value } = event;
    
    // Handle specific configuration changes
    if (key.startsWith('RISK_LIMITS')) {
      this.updateRiskLimits();
    } else if (key.includes('PROFIT_THRESHOLD')) {
      this.updateTradingParameters();
    } else if (key.includes('NETWORK')) {
      this.handleNetworkConfigChange();
    }
  }

  /**
   * Handle network changes
   */
  handleNetworkChange(event) {
    const { current, previous } = event;
    
    // Update active pairs for the new network
    if (this.activePairs.has(current)) {
      console.log(`🔄 Switched to ${current} with ${this.activePairs.get(current).length} active pairs`);
    }
  }

  /**
   * Update risk limits based on new configuration
   */
  updateRiskLimits() {
    console.log('🔄 Updating risk limits...');
    
    for (const networkName of this.supportedNetworks) {
      const newLimits = this.calculateNetworkRiskLimits(networkName);
      this.riskLimits.set(networkName, newLimits);
    }
    
    console.log('✅ Risk limits updated');
  }

  /**
   * Update trading parameters
   */
  updateTradingParameters() {
    console.log('🔄 Updating trading parameters...');
    this.loadTradingConfiguration();
    console.log('✅ Trading parameters updated');
  }

  /**
   * Handle network configuration changes
   */
  handleNetworkConfigChange() {
    console.log('🔄 Network configuration changed, reinitializing...');
    
    // Reinitialize network-related components
    this.setupSupportedNetworks();
    this.loadTradingConfiguration();
  }

  /**
   * Execute arbitrage opportunity with enhanced configuration
   */
  async executeArbitrage(opportunity) {
    const { tokenA, tokenB, network, expectedProfit } = opportunity;
    
    try {
      // 1. Validate opportunity against risk limits
      const riskLimits = this.riskLimits.get(network);
      if (!this.validateOpportunityRisk(opportunity, riskLimits)) {
        return { success: false, reason: 'Risk limits exceeded' };
      }
      
      // 2. Get token risk information
      const tokenARisk = getTokenRiskCategory(tokenA);
      const tokenBRisk = getTokenRiskCategory(tokenB);
      
      if (tokenARisk.riskScore > 7 || tokenBRisk.riskScore > 7) {
        return { success: false, reason: 'Token risk too high' };
      }
      
      // 3. Switch to the correct network if needed
      if (this.networkManager.currentNetwork !== network) {
        await this.networkManager.switchToNetwork(network);
      }
      
      // 4. Execute the trade using the best provider
      const provider = this.networkManager.getCurrentProvider(network);
      const result = await this.executeTrade(opportunity, provider);
      
      // 5. Update metrics
      this.updateTradingMetrics(result);
      
      return result;
      
    } catch (error) {
      console.error(`❌ Arbitrage execution failed: ${error.message}`);
      return { success: false, reason: error.message };
    }
  }

  /**
   * Validate opportunity against risk limits
   */
  validateOpportunityRisk(opportunity, riskLimits) {
    if (opportunity.tradeAmount > riskLimits.maxTradeAmount) {
      return false;
    }
    
    if (opportunity.expectedProfit < this.configManager.get('MIN_PROFIT_THRESHOLD')) {
      return false;
    }
    
    return true;
  }

  /**
   * Execute the actual trade (placeholder)
   */
  async executeTrade(opportunity, provider) {
    // This would contain the actual trading logic
    // For now, return a mock result
    return {
      success: true,
      profit: opportunity.expectedProfit,
      gasUsed: 150000,
      transactionHash: '0x...'
    };
  }

  /**
   * Update trading metrics
   */
  updateTradingMetrics(result) {
    // Update internal metrics based on trade result
    const metrics = {
      timestamp: Date.now(),
      success: result.success,
      profit: result.profit || 0,
      gasUsed: result.gasUsed || 0
    };
    
    this.configManager.emit('tradeCompleted', metrics);
  }

  /**
   * Get system status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      configVersion: this.configManager.get('_version'),
      currentNetwork: this.networkManager.currentNetwork,
      supportedNetworks: Array.from(this.supportedNetworks),
      activePairs: this.getActivePairsCount(),
      systemHealth: this.getSystemHealth(),
      riskLimits: Object.fromEntries(this.riskLimits)
    };
  }

  /**
   * Cleanup resources
   */
  async destroy() {
    console.log('🧹 Cleaning up Enhanced Arbitrage Engine...');
    
    this.configManager.removeAllListeners();
    this.networkManager.destroy();
    this.activePairs.clear();
    this.riskLimits.clear();
    this.supportedNetworks.clear();
    
    console.log('✅ Cleanup completed');
  }
}

/**
 * Example usage of the enhanced configuration system
 */
export async function demonstrateConfigurationSystem() {
  console.log('🎯 Demonstrating Enhanced Configuration System');
  
  try {
    // 1. Create and initialize the enhanced engine
    const engine = new EnhancedArbitrageEngine();
    await engine.initialize();
    
    // 2. Show system status
    console.log('\n📊 System Status:');
    console.log(JSON.stringify(engine.getStatus(), null, 2));
    
    // 3. Demonstrate configuration changes
    console.log('\n🔧 Testing configuration hot-reload...');
    configManager.set('MIN_PROFIT_THRESHOLD', 0.75);
    
    // 4. Demonstrate network switching
    console.log('\n🌐 Testing network switching...');
    const supportedNetworks = Array.from(engine.supportedNetworks);
    if (supportedNetworks.length > 1) {
      await networkManager.switchToNetwork(supportedNetworks[1]);
    }
    
    // 5. Show network statistics
    console.log('\n📈 Network Statistics:');
    console.log(JSON.stringify(networkManager.getNetworkStats(), null, 2));
    
    // 6. Clean up
    await engine.destroy();
    
    console.log('\n✅ Configuration system demonstration completed');
    
  } catch (error) {
    console.error('❌ Demonstration failed:', error.message);
  }
}

export default EnhancedArbitrageEngine;