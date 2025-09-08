const { ethers } = require('ethers');
const config = require('../config/config');

class Web3Provider {
  constructor() {
    this.provider = null;
    this.wallet = null;
    this.connected = false;
    this.lastBlockNumber = 0;
  }

  async connect() {
    try {
      console.log('🌐 Connecting to Ethereum network...');
      
      // Create provider
      this.provider = new ethers.providers.JsonRpcProvider(config.RPC_URL);
      
      // Test connection
      const network = await this.provider.getNetwork();
      console.log(`✅ Connected to ${network.name} (Chain ID: ${network.chainId})`);
      
      // Get current block
      this.lastBlockNumber = await this.provider.getBlockNumber();
      console.log(`📦 Current block: ${this.lastBlockNumber}`);
      
      // Create wallet if private key is provided
      if (config.PRIVATE_KEY && config.PRIVATE_KEY.length > 0) {
        this.wallet = new ethers.Wallet(config.PRIVATE_KEY, this.provider);
        const address = await this.wallet.getAddress();
        console.log(`👛 Wallet connected: ${address}`);
        
        // Check balance
        const balance = await this.provider.getBalance(address);
        const ethBalance = ethers.utils.formatEther(balance);
        console.log(`💰 ETH Balance: ${ethBalance}`);
        
        if (parseFloat(ethBalance) < 0.01) {
          console.warn('⚠️  Low ETH balance - may not be able to execute trades');
        }
      } else {
        console.log('📖 Running in read-only mode (no private key)');
      }
      
      this.connected = true;
      
      // Set up block listener for real-time updates
      this.setupBlockListener();
      
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to Web3:', error.message);
      this.connected = false;
      return false;
    }
  }

  setupBlockListener() {
    if (!this.provider) return;
    
    this.provider.on('block', (blockNumber) => {
      if (blockNumber > this.lastBlockNumber) {
        this.lastBlockNumber = blockNumber;
        // Emit block update event for other services
        this.onNewBlock && this.onNewBlock(blockNumber);
      }
    });
  }

  getProvider() {
    if (!this.connected) {
      throw new Error('Web3 provider not connected');
    }
    return this.provider;
  }

  getWallet() {
    if (!this.wallet) {
      throw new Error('Wallet not available - check private key configuration');
    }
    return this.wallet;
  }

  async getBlockNumber() {
    if (!this.provider) return null;
    try {
      return await this.provider.getBlockNumber();
    } catch (error) {
      console.error('Error getting block number:', error.message);
      return null;
    }
  }

  async getGasPrice() {
    if (!this.provider) return null;
    try {
      const gasPrice = await this.provider.getGasPrice();
      return gasPrice;
    } catch (error) {
      console.error('Error getting gas price:', error.message);
      return null;
    }
  }

  async estimateGas(transaction) {
    if (!this.provider) return null;
    try {
      return await this.provider.estimateGas(transaction);
    } catch (error) {
      console.error('Error estimating gas:', error.message);
      return null;
    }
  }

  isConnected() {
    return this.connected;
  }

  // Event handler for new blocks
  onNewBlock(callback) {
    this.onNewBlock = callback;
  }

  disconnect() {
    if (this.provider) {
      this.provider.removeAllListeners();
    }
    this.connected = false;
    console.log('🔌 Disconnected from Web3 provider');
  }
}

module.exports = Web3Provider;