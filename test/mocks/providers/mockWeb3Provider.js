import { jest } from '@jest/globals';

/**
 * Mock Web3Provider for testing
 * Provides consistent blockchain interaction mocking
 */
export class MockWeb3Provider {
  constructor(options = {}) {
    this.isConnectedValue = options.isConnected ?? true;
    this.blockNumber = options.blockNumber ?? 12345;
    this.gasPrice = options.gasPrice ?? '20000000000';
    this.networkId = options.networkId ?? 1;
  }

  connect = jest.fn().mockResolvedValue(true);
  disconnect = jest.fn().mockResolvedValue(true);
  isConnected = jest.fn(() => this.isConnectedValue);

  provider = {
    getBlockNumber: jest.fn(() => Promise.resolve(this.blockNumber)),
    getGasPrice: jest.fn(() => Promise.resolve(this.gasPrice)),
    getNetwork: jest.fn(() => Promise.resolve({ chainId: this.networkId })),
    getBalance: jest.fn(() => Promise.resolve('1000000000000000000')), // 1 ETH
    waitForTransaction: jest.fn(() => Promise.resolve({
      status: 1,
      gasUsed: '400000',
      blockNumber: this.blockNumber + 1
    })),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
    estimateGas: jest.fn(() => Promise.resolve('500000')),
    sendTransaction: jest.fn(() => Promise.resolve({
      hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      wait: () => Promise.resolve({ status: 1 })
    }))
  };

  // Utility methods for test setup
  setConnected(connected) {
    this.isConnectedValue = connected;
    return this;
  }

  setBlockNumber(blockNumber) {
    this.blockNumber = blockNumber;
    this.provider.getBlockNumber.mockResolvedValue(blockNumber);
    return this;
  }

  setGasPrice(gasPrice) {
    this.gasPrice = gasPrice;
    this.provider.getGasPrice.mockResolvedValue(gasPrice);
    return this;
  }

  simulateNetworkError() {
    this.provider.getBlockNumber.mockRejectedValue(new Error('Network error'));
    this.provider.getGasPrice.mockRejectedValue(new Error('Network error'));
    return this;
  }

  reset() {
    jest.clearAllMocks();
    this.isConnectedValue = true;
    this.blockNumber = 12345;
    this.gasPrice = '20000000000';
  }
}

export default MockWeb3Provider;