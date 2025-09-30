import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

/**
 * Mock Price Provider for testing
 * Simulates price feeds from various sources
 */
export class MockPriceProvider extends EventEmitter {
  constructor(options = {}) {
    super();
    this.basePrices = options.basePrices ?? {
      'ETH/USD': 2000,
      'BTC/USD': 45000,
      'USDC/USD': 1.0,
      'USDT/USD': 1.0,
      'DAI/USD': 1.0
    };
    this.volatility = options.volatility ?? 0.05; // 5% price volatility
    this.latency = options.latency ?? 100; // 100ms simulated latency
  }

  // Mock price data generation
  generatePrice(pair, basePrice) {
    const variation = (Math.random() - 0.5) * 2 * this.volatility;
    return basePrice * (1 + variation);
  }

  getPrice = jest.fn(async (pair) => {
    const basePrice = this.basePrices[pair];
    if (!basePrice) return null;

    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, this.latency));

    const price = this.generatePrice(pair, basePrice);
    
    return {
      price,
      timestamp: Date.now(),
      confidence: 0.95,
      source: 'mock'
    };
  });

  getChainlinkPrice = jest.fn(async (pair) => {
    const basePrice = this.basePrices[pair];
    if (!basePrice) return null;

    return {
      price: this.generatePrice(pair, basePrice),
      timestamp: Date.now(),
      confidence: 0.98,
      source: 'chainlink',
      feedAddress: '0x1234567890123456789012345678901234567890'
    };
  });

  getDEXPrice = jest.fn(async (pair) => {
    const basePrice = this.basePrices[pair];
    if (!basePrice) return null;

    return {
      price: this.generatePrice(pair, basePrice),
      timestamp: Date.now(),
      confidence: 0.85,
      source: 'dex',
      liquidity: '1000000'
    };
  });

  getExternalAPIPrice = jest.fn(async (pair) => {
    const basePrice = this.basePrices[pair];
    if (!basePrice) return null;

    return {
      price: this.generatePrice(pair, basePrice),
      timestamp: Date.now(),
      confidence: 0.9,
      source: 'external',
      api: 'coingecko'
    };
  });

  // Utility methods for testing
  setPriceForPair(pair, price) {
    this.basePrices[pair] = price;
    return this;
  }

  setVolatility(volatility) {
    this.volatility = volatility;
    return this;
  }

  setLatency(latency) {
    this.latency = latency;
    return this;
  }

  simulateOutage() {
    this.getPrice.mockRejectedValue(new Error('Price provider outage'));
    this.getChainlinkPrice.mockRejectedValue(new Error('Chainlink feed unavailable'));
    this.getDEXPrice.mockRejectedValue(new Error('DEX query failed'));
    return this;
  }

  simulatePriceUpdate(pair, newPrice) {
    this.setPriceForPair(pair, newPrice);
    this.emit('priceUpdate', {
      pair,
      price: newPrice,
      timestamp: Date.now()
    });
  }

  reset() {
    jest.clearAllMocks();
    this.basePrices = {
      'ETH/USD': 2000,
      'BTC/USD': 45000,
      'USDC/USD': 1.0,
      'USDT/USD': 1.0,
      'DAI/USD': 1.0
    };
    this.volatility = 0.05;
    this.latency = 100;
  }
}

export default MockPriceProvider;