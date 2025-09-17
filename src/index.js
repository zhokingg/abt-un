// src/index.js
require('dotenv').config();
const CoreArbitrageEngine = require('./services/coreArbitrageEngine');
const Phase4Manager = require('./services/Phase4Manager');

async function main() {
  try {
    console.log('🚀 V2/V3 Arbitrage Bot Starting (Phase 4)...');
    console.log('⚡ Enhanced Performance & Safety with Advanced MEV Detection');
    console.log('🛡️ Risk Management | 📊 Performance Analysis | 🚨 Multi-Channel Alerts');
    
    // Initialize Phase 4 Manager first
    const phase4Manager = new Phase4Manager({
      enableNetworkOptimization: true,
      enableRiskManagement: true,
      enableMonitoring: true,
      enableAlerting: true,
      enablePerformanceAnalysis: true,
      enableBacktesting: false, // Can be enabled for strategy validation
      autoStart: true
    });
    
    await phase4Manager.initialize();
    
    // Initialize the Core Arbitrage Engine
    const engine = new CoreArbitrageEngine();
    
    // Set up enhanced event listeners with Phase 4 integration
    engine.on('engineStarted', async (data) => {
      console.log('✅ Engine started successfully');
      console.log(`📊 Monitoring ${data.monitoredPairs} token pairs`);
      
      // Send startup notification through Phase 4 alerting
      await phase4Manager.sendAlert('system', {
        message: 'Arbitrage engine started successfully',
        monitoredPairs: data.monitoredPairs,
        phase: 'Phase 4'
      }, { priority: 'low' });
    });
    
    engine.on('opportunityDetected', async (opportunity) => {
      // Enhanced opportunity processing with Phase 4 risk assessment
      const riskAssessment = await phase4Manager.assessTradeRisk(opportunity);
      
      if (!riskAssessment.approved) {
        console.log(`⚠️ Opportunity ${opportunity.id} rejected by risk management: ${riskAssessment.reason}`);
        return;
      }
      
      // Adjust trade size based on risk assessment
      const adjustedOpportunity = {
        ...opportunity,
        tradeAmount: Math.min(opportunity.tradeAmount, riskAssessment.maxTradeSize)
      };
      
      console.log(`🎯 Risk-assessed opportunity: ${adjustedOpportunity.id}`);
      console.log(`💰 Adjusted trade size: $${adjustedOpportunity.tradeAmount.toFixed(2)}`);
      console.log(`🛡️ Risk score: ${(riskAssessment.riskScore * 100).toFixed(1)}%`);
    });
    
    engine.on('opportunityExecuted', async (data) => {
      console.log(`⚡ Opportunity executed: ${data.opportunityId}`);
      console.log(`💰 Expected profit: $${data.expectedProfit.toFixed(2)}`);
      
      // Process trade result through Phase 4 components
      await phase4Manager.processTradeResult({
        id: data.tradeId || `trade_${Date.now()}`,
        opportunityId: data.opportunityId,
        success: data.success !== false,
        actualProfit: data.actualProfit || data.expectedProfit,
        executionTime: data.executionTime || 30000,
        txHash: data.txHash,
        totalCosts: data.gasCost || 50
      });
    });
    
    engine.on('mevOpportunity', async (data) => {
      console.log(`🎯 MEV opportunity detected: ${data.type}`);
      
      // Send MEV alert through Phase 4 system
      await phase4Manager.sendAlert('mev', {
        type: data.type,
        expectedProfit: data.expectedProfit,
        timeWindow: data.timeWindow
      }, { priority: 'high' });
    });
    
    engine.on('engineError', async (data) => {
      console.error(`❌ Engine error: ${data.error}`);
      
      // Enhanced error reporting through Phase 4 monitoring
      phase4Manager.logEvent('arbitrage', 'engine_error', {
        error: data.error,
        component: 'CoreArbitrageEngine',
        timestamp: Date.now()
      });
      
      await phase4Manager.sendAlert('system', {
        message: 'Arbitrage engine error',
        error: data.error,
        component: 'CoreArbitrageEngine'
      }, { priority: 'high' });
    });
    
    // Phase 4 specific event handlers
    phase4Manager.on('emergencyStop', async (data) => {
      console.log('🚨 EMERGENCY STOP - Pausing arbitrage engine');
      await engine.pause();
    });
    
    phase4Manager.on('healthCheck', (status) => {
      if (status.overall === 'critical') {
        console.log('⚠️ Critical system health - Consider manual intervention');
      }
    });
    
    // Initialize and start the engine
    await engine.initialize();
    await engine.start();
    
    // Enhanced shutdown handlers with Phase 4 cleanup
    const shutdown = async () => {
      console.log('\n👋 Shutting down arbitrage bot (Phase 4)...');
      try {
        await engine.stop();
        await phase4Manager.shutdown();
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error.message);
        process.exit(1);
      }
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    
    // Enhanced error handling with Phase 4 monitoring
    process.on('uncaughtException', async (error) => {
      console.error('❌ Uncaught exception:', error.message);
      
      // Log critical error through Phase 4
      phase4Manager.logEvent('process', 'uncaught_exception', {
        error: error.message,
        stack: error.stack
      });
      
      await phase4Manager.sendAlert('system', {
        message: 'Critical uncaught exception',
        error: error.message
      }, { priority: 'critical' });
      
      shutdown();
    });
    
    process.on('unhandledRejection', async (reason, promise) => {
      console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
      
      // Log unhandled rejection through Phase 4
      phase4Manager.logEvent('process', 'unhandled_rejection', {
        reason: reason?.message || reason,
        promise: promise?.toString()
      });
      
      await phase4Manager.sendAlert('system', {
        message: 'Unhandled promise rejection',
        reason: reason?.message || reason
      }, { priority: 'high' });
      
      shutdown();
    });
    
    // Display Phase 4 status
    console.log('\n📊 Phase 4 Status Dashboard:');
    const systemStatus = phase4Manager.getSystemStatus();
    console.log(`   Active Components: ${systemStatus.activeComponents.join(', ')}`);
    console.log(`   System Health: ${systemStatus.healthStatus.overall}`);
    console.log(`   Risk Management: ${systemStatus.componentStatus.riskManager === 'active' ? '✅ Active' : '❌ Inactive'}`);
    console.log(`   Performance Monitoring: ${systemStatus.componentStatus.performanceAnalyzer === 'active' ? '✅ Active' : '❌ Inactive'}`);
    console.log(`   Network Optimization: ${systemStatus.componentStatus.networkOptimizer === 'active' ? '✅ Active' : '❌ Inactive'}`);
    console.log(`   Multi-Channel Alerts: ${systemStatus.componentStatus.alertingService === 'active' ? '✅ Active' : '❌ Inactive'}`);
    
    // Start performance monitoring dashboard (optional)
    setInterval(() => {
      const metrics = phase4Manager.aggregatedMetrics;
      if (metrics.performance?.lastUpdate && Date.now() - metrics.performance.lastUpdate < 60000) {
        console.log(`\n📈 Performance Update: Memory ${process.memoryUsage().heapUsed / 1024 / 1024}MB | Uptime ${Math.floor(process.uptime())}s`);
      }
    }, 300000); // Every 5 minutes
    
  } catch (error) {
    console.error('❌ Bot startup failed:', error.message);
    
    if (error.message.includes('RPC URL')) {
      console.log('💡 Set RPC_URL in your .env file with your Infura/Alchemy key');
    }
    if (error.message.includes('Private key')) {
      console.log('💡 Add PRIVATE_KEY to your .env file (or set DRY_RUN=true for testing)');
    }
    
    console.log('\n📋 Required environment variables:');
    console.log('- RPC_URL: Your Ethereum RPC endpoint');
    console.log('- PRIVATE_KEY: Your wallet private key (optional if DRY_RUN=true)');
    console.log('- DRY_RUN: Set to "true" for testing without real transactions');
    
    process.exit(1);
  }
}

// Start the bot
main().catch(console.error);