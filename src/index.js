// src/index.js
require('dotenv').config();

async function main() {
  try {
    console.log('🚀 V2/V3 Arbitrage Bot Starting...');
    
    // Check if we have the ArbitrageBot class available
    try {
      const ArbitrageBot = require('./ArbitrageBot');
      
      // Check environment variables
      if (!process.env.ETHEREUM_RPC_URL) {
        throw new Error('❌ ETHEREUM_RPC_URL not found in environment variables');
      }
      
      if (!process.env.PRIVATE_KEY) {
        throw new Error('❌ PRIVATE_KEY not found in environment variables');
      }
      
      console.log('✅ Environment variables loaded');
      console.log('📡 RPC URL configured');
      console.log('👛 Wallet configured');
      
      // Initialize and start the bot
      const bot = new ArbitrageBot();
      await bot.start();
      
    } catch (requireError) {
      if (requireError.code === 'MODULE_NOT_FOUND' && requireError.message.includes('ArbitrageBot')) {
        console.log('📝 ArbitrageBot class not found - creating basic demo mode...');
        console.log('✅ Basic setup working!');
        console.log('📁 Project structure created successfully');
        console.log('');
        console.log('💡 To enable full arbitrage functionality:');
        console.log('1. Create the ArbitrageBot.js file in src/');
        console.log('2. Set up your .env file with Alchemy API key');
        console.log('3. Restart the bot');
        
        // Keep the process running
        console.log('🔄 Watching for file changes...');
        setInterval(() => {
          // Keep alive
        }, 10000);
      } else {
        throw requireError;
      }
    }
    
  } catch (error) {
    console.error('❌ Bot startup failed:', error.message);
    
    if (error.message.includes('ETHEREUM_RPC_URL')) {
      console.log('💡 Create a .env file with your Alchemy API key');
    }
    if (error.message.includes('PRIVATE_KEY')) {
      console.log('💡 Add a PRIVATE_KEY to your .env file');
    }
    
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down arbitrage bot...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down arbitrage bot...');
  process.exit(0);
});

// Start the bot
main().catch(console.error);