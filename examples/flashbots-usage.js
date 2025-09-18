/**
 * Flashbots MEV Protection Usage Examples
 * Demonstrates how to use the integrated Flashbots functionality
 */

const EnhancedCoreArbitrageEngine = require('../src/services/enhancedCoreArbitrageEngine');
const EnhancedRpcProvider = require('../src/providers/enhancedRpcProvider');
const FlashbotsService = require('../src/services/FlashbotsService');
const FlashbotsMonitoringService = require('../src/services/FlashbotsMonitoringService');

class FlashbotsUsageExamples {
  
  /**
   * Example 1: Basic Enhanced Engine with Flashbots
   */
  async basicFlashbotsUsage() {
    console.log('📝 Example 1: Basic Flashbots Integration');
    console.log('=========================================');
    
    // Initialize enhanced engine with Flashbots support
    const engine = new EnhancedCoreArbitrageEngine();
    await engine.initialize();
    
    // The engine automatically uses Flashbots for high-value opportunities
    // No additional code needed - it's all handled automatically!
    
    console.log('✅ Enhanced engine initialized with Flashbots support');
    console.log('🔐 High-value trades (>$50) will automatically use private mempool');
    console.log('🌐 Low-value trades will use public mempool for speed');
  }
  
  /**
   * Example 2: Manual Transaction Routing
   */
  async manualRoutingExample() {
    console.log('\n📝 Example 2: Manual Transaction Routing');
    console.log('=========================================');
    
    const provider = new EnhancedRpcProvider();
    // await provider.connect(); // Uncomment in real usage
    
    // Example transaction data
    const transactionData = {
      to: '0x...',
      data: '0x...',
      value: '0',
      gasLimit: 300000
    };
    
    // Example arbitrage data with profit information
    const arbitrageData = {
      tokenA: '0x...',
      tokenB: '0x...',
      estimatedProfitUSD: 150 // High-value opportunity
    };
    
    console.log('💎 Transaction with $150 estimated profit');
    console.log('🔐 Will be routed to Flashbots private mempool');
    
    // Route transaction (would execute in real usage)
    // const result = await provider.routeTransaction(transactionData, arbitrageData);
    
    console.log('✅ Transaction routing configured');
  }
  
  /**
   * Example 3: Custom Flashbots Service Usage
   */
  async customFlashbotsService() {
    console.log('\n📝 Example 3: Direct Flashbots Service Usage');
    console.log('=============================================');
    
    // Mock provider for example
    const mockProvider = {
      provider: { getBlockNumber: () => 18000000 },
      wallet: { address: '0x...' }
    };
    
    const flashbotsService = new FlashbotsService(mockProvider);
    
    // Check if opportunity should use private mempool
    const shouldUsePrivate = flashbotsService.shouldUsePrivateMempool({}, 75);
    console.log(`💎 $75 opportunity should use private mempool: ${shouldUsePrivate}`);
    
    // Calculate MEV protection fees
    const baseFee = BigInt('25000000000'); // 25 gwei
    const gasUsed = 300000;
    const fees = flashbotsService.calculateMevProtectionFee(baseFee, gasUsed);
    
    console.log('💰 MEV Protection Fees:');
    console.log(`  - Total Fee: ${(Number(fees.totalFee) / 1e18).toFixed(6)} ETH`);
    console.log(`  - Priority Fee: ${(Number(fees.priorityFeePerGas) / 1e9).toFixed(1)} gwei`);
    
    // Get optimal target block
    // const targetBlock = await flashbotsService.getOptimalTargetBlock();
    console.log('✅ Flashbots service configured for direct usage');
  }
  
  /**
   * Example 4: Monitoring Integration
   */
  async monitoringExample() {
    console.log('\n📝 Example 4: Flashbots Monitoring');
    console.log('===================================');
    
    const mockFlashbotsService = new FlashbotsService();
    const monitoring = new FlashbotsMonitoringService(mockFlashbotsService);
    
    // Initialize monitoring
    // await monitoring.initialize(); // Uncomment in real usage
    
    // Get metrics (mock data for example)
    const sampleMetrics = {
      totalBundlesSubmitted: 45,
      bundlesIncluded: 42,
      successRatePercent: 93.3,
      averageInclusionTime: 11200,
      totalMevProtected: 2850
    };
    
    console.log('📊 Sample Metrics:');
    console.log(`  - Success Rate: ${sampleMetrics.successRatePercent.toFixed(1)}%`);
    console.log(`  - Bundles Submitted: ${sampleMetrics.totalBundlesSubmitted}`);
    console.log(`  - Avg Inclusion Time: ${(sampleMetrics.averageInclusionTime / 1000).toFixed(1)}s`);
    console.log(`  - MEV Protected: $${sampleMetrics.totalMevProtected}`);
    
    // Set up event listeners
    monitoring.on('bundleIncluded', (data) => {
      console.log(`✅ Bundle included: ${data.bundleId}`);
    });
    
    monitoring.on('bundleMissed', (data) => {
      console.log(`⏭️ Bundle missed: ${data.bundleId}`);
    });
    
    monitoring.on('alert', (alert) => {
      console.log(`🚨 Alert: ${alert.title} - ${alert.message}`);
    });
    
    console.log('✅ Monitoring configured with event listeners');
  }
  
  /**
   * Example 5: Configuration Examples
   */
  configurationExamples() {
    console.log('\n📝 Example 5: Configuration Options');
    console.log('====================================');
    
    console.log('🔧 Environment Variables (.env):');
    console.log(`
# Enable Flashbots MEV Protection
FLASHBOTS_ENABLED=true

# Private key for Flashbots authentication (can be same as PRIVATE_KEY)
FLASHBOTS_SIGNER_PRIVATE_KEY=your_private_key_here

# Profit threshold for private mempool routing
FLASHBOTS_PROFIT_THRESHOLD=50  # $50 USD minimum

# Gas fee configuration
FLASHBOTS_PRIORITY_FEE=2       # 2 gwei base priority fee
FLASHBOTS_MAX_BASE_FEE=100     # 100 gwei maximum base fee

# Reliability settings
FLASHBOTS_MAX_RETRIES=3        # Retry failed bundles 3 times
FLASHBOTS_TIMEOUT=30000        # 30 second timeout
FLASHBOTS_FALLBACK_PUBLIC=true # Fallback to public mempool
    `);
    
    console.log('💡 Usage Patterns:');
    console.log('  - High-value arbitrage: Automatic private mempool');
    console.log('  - Low-value arbitrage: Fast public mempool execution');
    console.log('  - Failed bundles: Automatic fallback with retry logic');
    console.log('  - Network congestion: Dynamic fee adjustment');
  }
  
  /**
   * Example 6: Error Handling and Fallback
   */
  async errorHandlingExample() {
    console.log('\n📝 Example 6: Error Handling & Fallback');
    console.log('=======================================');
    
    console.log('🛡️ Built-in Error Handling:');
    console.log('  1. Flashbots unavailable → Automatic fallback to public mempool');
    console.log('  2. Bundle submission fails → Retry with exponential backoff');
    console.log('  3. Network congestion → Dynamic fee adjustment');
    console.log('  4. Consecutive failures → Alert system activation');
    
    console.log('\n🔄 Fallback Scenarios:');
    console.log('  - Flashbots relay down → Public mempool with MEV protection');
    console.log('  - Bundle inclusion timeout → Retry with higher fees');
    console.log('  - Signer key issues → Graceful degradation to public execution');
    console.log('  - Network connectivity → Queue transactions for retry');
    
    console.log('\n📊 Monitoring Integration:');
    console.log('  - Success rate tracking with alerts');
    console.log('  - Performance metrics collection');
    console.log('  - Cost-benefit analysis');
    console.log('  - Historical data for optimization');
  }
  
  /**
   * Run all examples
   */
  async runAllExamples() {
    console.log('🚀 Flashbots MEV Protection - Usage Examples');
    console.log('===========================================\n');
    
    await this.basicFlashbotsUsage();
    await this.manualRoutingExample();
    await this.customFlashbotsService();
    await this.monitoringExample();
    this.configurationExamples();
    await this.errorHandlingExample();
    
    console.log('\n✅ All examples completed!');
    console.log('\n🎯 Key Takeaways:');
    console.log('  • Flashbots integration is automatic and seamless');
    console.log('  • High-value trades get MEV protection automatically');
    console.log('  • Comprehensive monitoring and alerting included');
    console.log('  • Robust fallback ensures continued operation');
    console.log('  • Zero additional costs beyond standard gas fees');
  }
}

// Run examples if called directly
if (require.main === module) {
  const examples = new FlashbotsUsageExamples();
  examples.runAllExamples().catch(console.error);
}

module.exports = FlashbotsUsageExamples;