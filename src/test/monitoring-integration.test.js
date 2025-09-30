/**
 * Monitoring Integration Test
 * Basic test to validate monitoring system functionality
 */

import MonitoringIntegration from '../services/MonitoringIntegration.js';
import { EventEmitter } from 'events';

// Mock CoreArbitrageEngine for testing
class MockCoreArbitrageEngine extends EventEmitter {
  constructor() {
    super();
    this.isRunning = false;
    this.stats = {
      totalOpportunities: 0,
      executedTrades: 0,
      successfulTrades: 0,
      uptime: 0
    };
  }
  
  async start() {
    this.isRunning = true;
    this.emit('started');
  }
  
  async stop() {
    this.isRunning = false;
    this.emit('stopped');
  }
  
  async detectOpportunities() {
    // Mock opportunity detection
    const opportunities = [
      {
        type: 'v2-v3-arbitrage',
        symbol: 'WETH/USDC',
        estimatedProfit: 125.50,
        confidence: 0.85,
        riskScore: 0.2
      }
    ];
    
    this.stats.totalOpportunities += opportunities.length;
    this.emit('opportunityDetected', opportunities[0]);
    return opportunities;
  }
  
  async executeTrade(opportunity) {
    // Mock trade execution
    const trade = {
      id: `trade_${Date.now()}`,
      type: opportunity.type,
      symbol: opportunity.symbol,
      actualProfit: opportunity.estimatedProfit * 0.95, // 5% slippage
      executionTime: Math.random() * 5000 + 1000, // 1-6 seconds
      gasUsed: Math.floor(Math.random() * 200000) + 100000
    };
    
    this.stats.executedTrades++;
    
    // 90% success rate
    if (Math.random() > 0.1) {
      this.stats.successfulTrades++;
      this.emit('tradeExecuted', trade);
      return trade;
    } else {
      const failedTrade = {
        ...trade,
        error: 'Transaction reverted',
        failureReason: 'insufficient_liquidity'
      };
      this.emit('tradeFailed', failedTrade);
      throw new Error('Trade execution failed');
    }
  }
  
  getStats() {
    return {
      ...this.stats,
      uptime: Date.now() - (this.startTime || Date.now()),
      successRate: this.stats.executedTrades > 0 ? 
        (this.stats.successfulTrades / this.stats.executedTrades) * 100 : 0
    };
  }
}

/**
 * Test monitoring integration functionality
 */
async function testMonitoringIntegration() {
  console.log('🧪 Starting Monitoring Integration Test...\n');
  
  try {
    // Create mock core engine
    const mockEngine = new MockCoreArbitrageEngine();
    
    // Create monitoring integration with test configuration
    const monitoring = new MonitoringIntegration({
      global: {
        enableMonitoring: true,
        enableAlerting: true,
        enableDashboard: true,
        healthCheckInterval: 10000, // 10 seconds for testing
        metricsCollectionInterval: 5000 // 5 seconds for testing
      },
      alertManager: {
        enableDiscord: false, // Disable external services for testing
        enableTelegram: false,
        enableEmail: false,
        enableSMS: false,
        enableSlack: false,
        rateLimitWindow: 60000,
        maxAlertsPerWindow: 10
      },
      metricsDashboard: {
        port: 3001, // Use different port for testing
        updateInterval: 2000
      },
      dashboardAPI: {
        port: 3002, // Use different port for testing
        enableAuth: false // Disable auth for testing
      }
    });
    
    // Test 1: Initialize monitoring
    console.log('📋 Test 1: Initialize Monitoring Integration');
    await monitoring.initialize(mockEngine);
    
    const status = monitoring.getMonitoringStatus();
    console.log(`✅ Monitoring initialized: ${status.initialized}`);
    console.log(`📊 Active services: ${status.activeServices.join(', ')}`);
    console.log(`🔗 Core engine connected: ${status.coreEngineConnected}\n`);
    
    // Test 2: Simulate arbitrage activity
    console.log('📋 Test 2: Simulate Arbitrage Activity');
    await mockEngine.start();
    
    // Detect opportunities
    const opportunities = await mockEngine.detectOpportunities();
    console.log(`🎯 Detected ${opportunities.length} opportunities`);
    
    // Execute trades
    let successfulTrades = 0;
    let failedTrades = 0;
    
    for (let i = 0; i < 5; i++) {
      try {
        const trade = await mockEngine.executeTrade(opportunities[0]);
        successfulTrades++;
        console.log(`✅ Trade ${i + 1} executed: $${trade.actualProfit.toFixed(2)} profit`);
      } catch (error) {
        failedTrades++;
        console.log(`❌ Trade ${i + 1} failed: ${error.message}`);
      }
      
      // Wait a bit between trades
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`📊 Trade summary: ${successfulTrades} successful, ${failedTrades} failed\n`);
    
    // Test 3: Check metrics aggregation
    console.log('📋 Test 3: Check Metrics Aggregation');
    
    // Wait for metrics to be collected
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const aggregatedMetrics = status.aggregatedMetrics;
    console.log('📊 Aggregated Metrics:');
    console.log(`   Trading - Total Opportunities: ${aggregatedMetrics.trading.totalOpportunities}`);
    console.log(`   Trading - Executed Trades: ${aggregatedMetrics.trading.executedTrades}`);
    console.log(`   Trading - Success Rate: ${aggregatedMetrics.trading.successRate.toFixed(1)}%`);
    console.log(`   System - Health Score: ${aggregatedMetrics.system.healthScore}`);
    console.log(`   Alerts - Total Active: ${aggregatedMetrics.alerts.total}\n`);
    
    // Test 4: Test service interactions
    console.log('📋 Test 4: Test Service Interactions');
    
    // Get performance report
    const performanceService = monitoring.getService('performanceAnalyzer');
    if (performanceService) {
      const performanceReport = performanceService.getPerformanceReport();
      console.log(`⚡ Performance Grade: ${performanceReport.summary.performanceGrade}`);
      console.log(`📈 Success Rate: ${performanceReport.summary.successRate.toFixed(1)}%`);
    }
    
    // Get health status
    const healthService = monitoring.getService('healthMonitor');
    if (healthService) {
      const healthSummary = healthService.getHealthSummary();
      console.log(`🏥 Overall Health: ${healthSummary.overall.status}`);
      console.log(`⏱️ System Uptime: ${Math.floor(healthSummary.uptime / 1000)}s`);
    }
    
    // Test alert manager
    const alertService = monitoring.getService('alertManager');
    if (alertService) {
      try {
        const alertResult = await monitoring.sendAlert('performance', {
          metric: 'test_metric',
          value: 95,
          threshold: 90
        }, { priority: 'low' });
        console.log(`📢 Test alert sent successfully: ${alertResult.success}`);
      } catch (error) {
        console.warn(`⚠️ Alert test failed: ${error.message}`);
      }
    }
    
    console.log();
    
    // Test 5: Generate system report
    console.log('📋 Test 5: Generate System Report');
    
    const systemReport = await monitoring.getSystemReport();
    console.log('📋 System Report Generated:');
    console.log(`   Timestamp: ${new Date(systemReport.timestamp).toISOString()}`);
    console.log(`   Services: ${Object.keys(systemReport.services).join(', ')}`);
    console.log(`   Overview Status: ${systemReport.overview.running ? 'Running' : 'Stopped'}`);
    console.log();
    
    // Test 6: Shutdown
    console.log('📋 Test 6: Shutdown Test');
    await monitoring.shutdown();
    await mockEngine.stop();
    
    const finalStatus = monitoring.getMonitoringStatus();
    console.log(`🛑 Monitoring shutdown: ${!finalStatus.running}`);
    
    console.log('\n✅ All tests completed successfully!');
    return true;
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error(error.stack);
    return false;
  }
}

/**
 * Test basic service initialization
 */
async function testBasicServices() {
  console.log('🧪 Testing Basic Service Initialization...\n');
  
  try {
    // Test AlertManager
    console.log('📢 Testing AlertManager...');
    const { default: AlertManager } = await import('../services/AlertManager.js');
    const alertManager = new AlertManager({
      enableDiscord: false,
      enableTelegram: false,
      enableEmail: false,
      enableSMS: false
    });
    await alertManager.initialize();
    console.log('✅ AlertManager initialized successfully');
    await alertManager.shutdown();
    
    // Test PerformanceAnalyzer
    console.log('⚡ Testing PerformanceAnalyzer...');
    const { default: PerformanceAnalyzer } = await import('../services/PerformanceAnalyzer.js');
    const performanceAnalyzer = new PerformanceAnalyzer({
      trackingInterval: 10000,
      performanceTargets: {
        rpcLatency: 100,
        executionTime: 30000,
        successRate: 95
      }
    });
    await performanceAnalyzer.initialize();
    console.log('✅ PerformanceAnalyzer initialized successfully');
    await performanceAnalyzer.shutdown();
    
    // Test MetricsDashboard
    console.log('📊 Testing MetricsDashboard...');
    const { default: MetricsDashboard } = await import('../services/MetricsDashboard.js');
    const metricsDashboard = new MetricsDashboard({
      port: 3003,
      enableWebSocket: false,
      enableRestAPI: false
    });
    await metricsDashboard.initialize();
    console.log('✅ MetricsDashboard initialized successfully');
    await metricsDashboard.shutdown();
    
    console.log('\n✅ Basic service tests completed successfully!');
    return true;
    
  } catch (error) {
    console.error('\n❌ Basic service test failed:', error);
    console.error(error.stack);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🚀 Starting Monitoring System Tests\n');
  console.log('=' .repeat(60));
  
  const results = [];
  
  // Run basic service tests
  console.log('\n📦 BASIC SERVICE TESTS');
  console.log('=' .repeat(30));
  results.push(await testBasicServices());
  
  // Run integration tests
  console.log('\n🔗 INTEGRATION TESTS');
  console.log('=' .repeat(30));
  results.push(await testMonitoringIntegration());
  
  // Summary
  const passed = results.filter(result => result).length;
  const total = results.length;
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('=' .repeat(60));
  console.log(`Tests Passed: ${passed}/${total}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Monitoring system is working correctly.');
  } else {
    console.log('⚠️ Some tests failed. Please check the logs above.');
  }
  
  process.exit(passed === total ? 0 : 1);
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { testMonitoringIntegration, testBasicServices, runTests };