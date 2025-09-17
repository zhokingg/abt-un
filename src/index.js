// src/index.js
require('dotenv').config();
const CoreArbitrageEngine = require('./services/coreArbitrageEngine');

async function main() {
  try {
    console.log('🚀 V2/V3 Arbitrage Bot Starting (Phase 2)...');
    console.log('⚡ Core Arbitrage Engine with Advanced MEV Detection');
    
    // Initialize the Core Arbitrage Engine
    const engine = new CoreArbitrageEngine();
    
    // Set up event listeners for monitoring
    engine.on('engineStarted', (data) => {
      console.log('✅ Engine started successfully');
      console.log(`📊 Monitoring ${data.monitoredPairs} token pairs`);
    });
    
    engine.on('opportunityExecuted', (data) => {
      console.log(`⚡ Opportunity executed: ${data.opportunityId}`);
      console.log(`💰 Expected profit: $${data.expectedProfit.toFixed(2)}`);
    });
    
    engine.on('mevOpportunity', (data) => {
      console.log(`🎯 MEV opportunity detected: ${data.type}`);
    });
    
    engine.on('engineError', (data) => {
      console.error(`❌ Engine error: ${data.error}`);
    });
    
    // Initialize and start the engine
    await engine.initialize();
    await engine.start();
    
    // Set up graceful shutdown handlers
    const shutdown = async () => {
      console.log('\n👋 Shutting down arbitrage bot...');
      try {
        await engine.stop();
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error.message);
        process.exit(1);
      }
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    
    // Keep the process running
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught exception:', error.message);
      shutdown();
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
      shutdown();
    });
    
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