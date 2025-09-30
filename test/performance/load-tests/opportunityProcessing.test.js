import { jest, describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import { MockWeb3Provider } from '../../mocks/providers/mockWeb3Provider.js';
import { MockPriceProvider } from '../../mocks/providers/mockPriceProvider.js';
import { SAMPLE_OPPORTUNITIES } from '../../fixtures/market-data/sampleOpportunities.js';

// Mock dependencies
jest.unstable_mockModule('../../../src/providers/web3Provider.js', () => ({
  default: MockWeb3Provider
}));

const { default: CoreArbitrageEngine } = await import('../../../src/services/coreArbitrageEngine.js');
const { default: config } = await import('../../../src/config/config.js');

describe('Opportunity Processing - Load Tests', () => {
  let engine;
  let mockWeb3Provider;
  let performanceMetrics;

  beforeAll(() => {
    config.NODE_ENV = 'test';
    config.DRY_RUN = true;
    
    // Performance test configuration
    config.PERFORMANCE_TARGETS = {
      maxLatency: 100, // 100ms
      minThroughput: 1000, // 1000 ops/second
      maxMemoryMB: 512,
      maxCPUPercent: 80
    };
  });

  beforeEach(async () => {
    engine = new CoreArbitrageEngine();
    mockWeb3Provider = new MockWeb3Provider();
    performanceMetrics = {
      startTime: Date.now(),
      memoryStart: process.memoryUsage(),
      operationsCompleted: 0,
      latencies: [],
      errors: [],
      throughputSamples: []
    };
    
    await engine.initialize();
  });

  afterEach(async () => {
    if (engine && engine.isRunning) {
      await engine.stop();
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  describe('High-Frequency Opportunity Processing', () => {
    test('should process 1000+ opportunities per second', async () => {
      const targetOperations = 1000;
      const testDurationMs = 1000; // 1 second
      
      await engine.start();
      
      // Generate large batch of opportunities
      const opportunities = [];
      for (let i = 0; i < targetOperations; i++) {
        opportunities.push({
          ...SAMPLE_OPPORTUNITIES[i % SAMPLE_OPPORTUNITIES.length],
          id: `load-test-${i}`,
          timestamp: Date.now() + i
        });
      }
      
      const startTime = Date.now();
      let processedCount = 0;
      
      // Process opportunities in parallel batches
      const batchSize = 50;
      const processingPromises = [];
      
      for (let i = 0; i < opportunities.length; i += batchSize) {
        const batch = opportunities.slice(i, i + batchSize);
        
        const batchPromise = Promise.all(
          batch.map(async (opp) => {
            const opStartTime = Date.now();
            try {
              await engine.evaluateOpportunity(opp);
              const latency = Date.now() - opStartTime;
              performanceMetrics.latencies.push(latency);
              processedCount++;
            } catch (error) {
              performanceMetrics.errors.push(error);
            }
          })
        );
        
        processingPromises.push(batchPromise);
        
        // Yield control periodically
        if (i % (batchSize * 5) === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }
      
      await Promise.all(processingPromises);
      
      const endTime = Date.now();
      const actualDuration = endTime - startTime;
      const throughput = (processedCount / actualDuration) * 1000; // ops/second
      
      console.log(`Processed ${processedCount} opportunities in ${actualDuration}ms`);
      console.log(`Throughput: ${throughput.toFixed(2)} ops/second`);
      
      expect(processedCount).toBeGreaterThanOrEqual(targetOperations * 0.95); // 95% success rate
      expect(throughput).toBeGreaterThanOrEqual(config.PERFORMANCE_TARGETS.minThroughput);
    });

    test('should maintain low latency under high load', async () => {
      const testDuration = 5000; // 5 seconds
      const targetLatency = config.PERFORMANCE_TARGETS.maxLatency;
      
      await engine.start();
      
      const startTime = Date.now();
      const latencies = [];
      let operationCount = 0;
      
      // Continuous processing loop
      while (Date.now() - startTime < testDuration) {
        const opportunity = {
          ...SAMPLE_OPPORTUNITIES[operationCount % SAMPLE_OPPORTUNITIES.length],
          id: `latency-test-${operationCount}`,
          timestamp: Date.now()
        };
        
        const opStart = Date.now();
        try {
          await engine.evaluateOpportunity(opportunity);
          const latency = Date.now() - opStart;
          latencies.push(latency);
          operationCount++;
        } catch (error) {
          performanceMetrics.errors.push(error);
        }
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setImmediate(resolve));
      }
      
      const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
      const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];
      const p99Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.99)];
      
      console.log(`Average latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`P95 latency: ${p95Latency}ms`);
      console.log(`P99 latency: ${p99Latency}ms`);
      console.log(`Total operations: ${operationCount}`);
      
      expect(avgLatency).toBeLessThan(targetLatency);
      expect(p95Latency).toBeLessThan(targetLatency * 2);
      expect(p99Latency).toBeLessThan(targetLatency * 5);
    });

    test('should handle concurrent opportunity evaluation', async () => {
      const concurrentRequests = 100;
      const opportunitiesPerRequest = 10;
      
      await engine.start();
      
      const startTime = Date.now();
      
      // Create concurrent evaluation requests
      const concurrentPromises = Array.from({ length: concurrentRequests }, async (_, reqIndex) => {
        const requestLatencies = [];
        
        for (let i = 0; i < opportunitiesPerRequest; i++) {
          const opportunity = {
            ...SAMPLE_OPPORTUNITIES[i % SAMPLE_OPPORTUNITIES.length],
            id: `concurrent-${reqIndex}-${i}`,
            timestamp: Date.now()
          };
          
          const opStart = Date.now();
          try {
            await engine.evaluateOpportunity(opportunity);
            requestLatencies.push(Date.now() - opStart);
          } catch (error) {
            performanceMetrics.errors.push(error);
          }
        }
        
        return requestLatencies;
      });
      
      const results = await Promise.all(concurrentPromises);
      const endTime = Date.now();
      
      const allLatencies = results.flat();
      const totalOperations = allLatencies.length;
      const duration = endTime - startTime;
      const throughput = (totalOperations / duration) * 1000;
      
      console.log(`Concurrent test: ${totalOperations} ops in ${duration}ms`);
      console.log(`Concurrent throughput: ${throughput.toFixed(2)} ops/second`);
      
      expect(performanceMetrics.errors.length).toBeLessThan(totalOperations * 0.01); // <1% error rate
      expect(throughput).toBeGreaterThan(500); // Reasonable concurrent throughput
    });
  });

  describe('Memory and Resource Usage', () => {
    test('should maintain memory usage under limits during sustained load', async () => {
      const testDuration = 10000; // 10 seconds
      const memoryLimit = config.PERFORMANCE_TARGETS.maxMemoryMB * 1024 * 1024; // Convert to bytes
      
      await engine.start();
      
      const startTime = Date.now();
      const memorySnapshots = [];
      let operationCount = 0;
      
      // Monitor memory usage during continuous operation
      const memoryMonitor = setInterval(() => {
        const memUsage = process.memoryUsage();
        memorySnapshots.push({
          timestamp: Date.now(),
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          rss: memUsage.rss
        });
      }, 1000);
      
      try {
        while (Date.now() - startTime < testDuration) {
          const opportunity = {
            ...SAMPLE_OPPORTUNITIES[operationCount % SAMPLE_OPPORTUNITIES.length],
            id: `memory-test-${operationCount}`,
            timestamp: Date.now()
          };
          
          await engine.evaluateOpportunity(opportunity);
          operationCount++;
          
          // Periodic checks
          if (operationCount % 100 === 0) {
            const currentMemory = process.memoryUsage();
            if (currentMemory.heapUsed > memoryLimit) {
              console.warn(`Memory usage exceeded limit: ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
            }
          }
        }
      } finally {
        clearInterval(memoryMonitor);
      }
      
      const maxMemoryUsed = Math.max(...memorySnapshots.map(s => s.heapUsed));
      const avgMemoryUsed = memorySnapshots.reduce((sum, s) => sum + s.heapUsed, 0) / memorySnapshots.length;
      
      console.log(`Operations completed: ${operationCount}`);
      console.log(`Max memory used: ${(maxMemoryUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Avg memory used: ${(avgMemoryUsed / 1024 / 1024).toFixed(2)}MB`);
      
      expect(maxMemoryUsed).toBeLessThan(memoryLimit);
      
      // Check for memory leaks - memory should not grow continuously
      const firstHalf = memorySnapshots.slice(0, Math.floor(memorySnapshots.length / 2));
      const secondHalf = memorySnapshots.slice(Math.floor(memorySnapshots.length / 2));
      
      const firstHalfAvg = firstHalf.reduce((sum, s) => sum + s.heapUsed, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, s) => sum + s.heapUsed, 0) / secondHalf.length;
      
      const memoryGrowthRate = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;
      
      console.log(`Memory growth rate: ${(memoryGrowthRate * 100).toFixed(2)}%`);
      expect(memoryGrowthRate).toBeLessThan(0.5); // Less than 50% growth
    });

    test('should handle garbage collection efficiently', async () => {
      if (!global.gc) {
        console.log('Garbage collection not available, skipping test');
        return;
      }
      
      await engine.start();
      
      const iterations = 1000;
      const gcStats = [];
      
      for (let i = 0; i < iterations; i++) {
        const opportunity = {
          ...SAMPLE_OPPORTUNITIES[i % SAMPLE_OPPORTUNITIES.length],
          id: `gc-test-${i}`,
          timestamp: Date.now()
        };
        
        await engine.evaluateOpportunity(opportunity);
        
        // Force GC every 100 operations
        if (i % 100 === 0) {
          const beforeGC = process.memoryUsage();
          const gcStart = Date.now();
          
          global.gc();
          
          const gcDuration = Date.now() - gcStart;
          const afterGC = process.memoryUsage();
          
          gcStats.push({
            iteration: i,
            gcDuration,
            memoryFreed: beforeGC.heapUsed - afterGC.heapUsed,
            heapUsedBefore: beforeGC.heapUsed,
            heapUsedAfter: afterGC.heapUsed
          });
        }
      }
      
      const avgGCDuration = gcStats.reduce((sum, stat) => sum + stat.gcDuration, 0) / gcStats.length;
      const totalMemoryFreed = gcStats.reduce((sum, stat) => sum + stat.memoryFreed, 0);
      
      console.log(`Average GC duration: ${avgGCDuration.toFixed(2)}ms`);
      console.log(`Total memory freed: ${(totalMemoryFreed / 1024 / 1024).toFixed(2)}MB`);
      
      expect(avgGCDuration).toBeLessThan(50); // GC should be fast
      expect(totalMemoryFreed).toBeGreaterThan(0); // Should free some memory
    });
  });

  describe('Error Handling Under Load', () => {
    test('should maintain stability with mixed success/failure scenarios', async () => {
      const totalOperations = 1000;
      const errorRate = 0.1; // 10% errors
      
      await engine.start();
      
      // Mock random failures
      const originalEvaluate = engine.evaluateOpportunity;
      engine.evaluateOpportunity = jest.fn().mockImplementation(async (opportunity) => {
        if (Math.random() < errorRate) {
          throw new Error('Simulated processing error');
        }
        return originalEvaluate.call(engine, opportunity);
      });
      
      const startTime = Date.now();
      let successCount = 0;
      let errorCount = 0;
      
      const operations = Array.from({ length: totalOperations }, (_, i) => ({
        ...SAMPLE_OPPORTUNITIES[i % SAMPLE_OPPORTUNITIES.length],
        id: `stability-test-${i}`,
        timestamp: Date.now()
      }));
      
      const results = await Promise.allSettled(
        operations.map(async (opportunity) => {
          try {
            await engine.evaluateOpportunity(opportunity);
            successCount++;
          } catch (error) {
            errorCount++;
            throw error;
          }
        })
      );
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`Stability test completed in ${duration}ms`);
      console.log(`Success: ${successCount}, Errors: ${errorCount}`);
      console.log(`Actual error rate: ${(errorCount / totalOperations * 100).toFixed(2)}%`);
      
      expect(successCount).toBeGreaterThan(totalOperations * 0.8); // At least 80% success
      expect(errorCount).toBeLessThan(totalOperations * 0.2); // Less than 20% errors
      
      // System should remain responsive
      const throughput = (totalOperations / duration) * 1000;
      expect(throughput).toBeGreaterThan(100); // Minimum throughput even with errors
    });

    test('should recover gracefully from service failures', async () => {
      const testOperations = 500;
      
      await engine.start();
      
      let operationCount = 0;
      let recoveryCount = 0;
      const failureWindows = [];
      
      // Simulate intermittent service failures
      const originalEvaluate = engine.evaluateOpportunity;
      engine.evaluateOpportunity = jest.fn().mockImplementation(async (opportunity) => {
        operationCount++;
        
        // Simulate service failure every 100 operations for 10 operations
        const cyclePosition = operationCount % 100;
        const isInFailureWindow = cyclePosition >= 50 && cyclePosition < 60;
        
        if (isInFailureWindow) {
          failureWindows.push(operationCount);
          throw new Error('Service temporarily unavailable');
        }
        
        // Simulate recovery after failure window
        if (cyclePosition === 60) {
          recoveryCount++;
        }
        
        return originalEvaluate.call(engine, opportunity);
      });
      
      const operations = Array.from({ length: testOperations }, (_, i) => ({
        ...SAMPLE_OPPORTUNITIES[i % SAMPLE_OPPORTUNITIES.length],
        id: `recovery-test-${i}`,
        timestamp: Date.now()
      }));
      
      const results = await Promise.allSettled(
        operations.map(opp => engine.evaluateOpportunity(opp))
      );
      
      const successfulResults = results.filter(r => r.status === 'fulfilled');
      const failedResults = results.filter(r => r.status === 'rejected');
      
      console.log(`Recovery test: ${successfulResults.length} successful, ${failedResults.length} failed`);
      console.log(`Recovery cycles: ${recoveryCount}`);
      
      expect(successfulResults.length).toBeGreaterThan(testOperations * 0.8);
      expect(recoveryCount).toBeGreaterThan(0); // Should have recovered at least once
    });
  });

  describe('Real-Time Performance Metrics', () => {
    test('should provide accurate performance metrics during load', async () => {
      const testDuration = 5000; // 5 seconds
      
      await engine.start();
      
      const startTime = Date.now();
      let operationCount = 0;
      
      // Run continuous operations while monitoring metrics
      const metricsSnapshots = [];
      const metricsInterval = setInterval(() => {
        const metrics = engine.getMetrics();
        metricsSnapshots.push({
          timestamp: Date.now(),
          ...metrics
        });
      }, 500); // Every 500ms
      
      try {
        while (Date.now() - startTime < testDuration) {
          const opportunity = {
            ...SAMPLE_OPPORTUNITIES[operationCount % SAMPLE_OPPORTUNITIES.length],
            id: `metrics-test-${operationCount}`,
            timestamp: Date.now()
          };
          
          await engine.evaluateOpportunity(opportunity);
          operationCount++;
          
          // Brief pause to allow metrics collection
          if (operationCount % 50 === 0) {
            await new Promise(resolve => setImmediate(resolve));
          }
        }
      } finally {
        clearInterval(metricsInterval);
      }
      
      const finalMetrics = engine.getMetrics();
      
      console.log('Final Performance Metrics:');
      console.log(`Total operations: ${finalMetrics.opportunitiesEvaluated}`);
      console.log(`Success rate: ${(finalMetrics.successRate * 100).toFixed(2)}%`);
      console.log(`Average execution time: ${finalMetrics.averageEvaluationTime.toFixed(2)}ms`);
      console.log(`Throughput: ${(finalMetrics.opportunitiesEvaluated / (testDuration / 1000)).toFixed(2)} ops/sec`);
      
      expect(finalMetrics.opportunitiesEvaluated).toBe(operationCount);
      expect(finalMetrics.averageEvaluationTime).toBeLessThan(config.PERFORMANCE_TARGETS.maxLatency);
      expect(finalMetrics.successRate).toBeGreaterThan(0.9); // 90% success rate
      
      // Verify metrics trend over time
      expect(metricsSnapshots.length).toBeGreaterThan(5);
      const firstSnapshot = metricsSnapshots[0];
      const lastSnapshot = metricsSnapshots[metricsSnapshots.length - 1];
      
      expect(lastSnapshot.opportunitiesEvaluated).toBeGreaterThan(firstSnapshot.opportunitiesEvaluated);
    });
  });
});