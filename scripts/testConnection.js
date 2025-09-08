// scripts/testConnection.js
require('dotenv').config();
const { ethers } = require('ethers');

async function testConnection() {
  try {
    console.log('🔍 Testing Alchemy connection...');
    
    // Check if environment variables are loaded
    if (!process.env.ETHEREUM_RPC_URL) {
      throw new Error('ETHEREUM_RPC_URL not found in .env file');
    }
    
    if (!process.env.PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY not found in .env file');
    }
    
    console.log('✅ Environment variables loaded');
    console.log('📡 RPC URL:', process.env.ETHEREUM_RPC_URL.replace(/\/[^\/]+$/, '/***'));
    
    // Test RPC connection
    const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
    
    // Get network info
    const network = await provider.getNetwork();
    console.log('🌐 Connected to network:', network.name, 'Chain ID:', network.chainId);
    
    // Get latest block
    const blockNumber = await provider.getBlockNumber();
    console.log('📦 Latest block:', blockNumber);
    
    // Test wallet connection
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log('👛 Wallet address:', wallet.address);
    
    // Check wallet balance
    const balance = await provider.getBalance(wallet.address);
    const balanceEth = ethers.formatEther(balance);
    console.log('💰 Wallet balance:', balanceEth, 'ETH');
    
    if (parseFloat(balanceEth) === 0) {
      console.log('⚠️  Wallet has no ETH - you will need some for gas fees');
      console.log('💡 For testnet: Get free ETH from a faucet');
      console.log('💡 For mainnet: Send a small amount for testing');
    }
    
    console.log('✅ All connections successful!');
    console.log('🚀 Ready to run the arbitrage bot');
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    
    if (error.message.includes('invalid API key')) {
      console.log('💡 Check your Alchemy API key in the .env file');
    } else if (error.message.includes('invalid private key')) {
      console.log('💡 Check your private key format in the .env file');
    }
  }
}

testConnection();
