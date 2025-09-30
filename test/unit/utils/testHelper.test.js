import { describe, test, expect } from '@jest/globals';

/**
 * Simple test to verify ES modules configuration
 */
describe('Test Infrastructure', () => {
  test('should support ES modules', () => {
    expect(1 + 1).toBe(2);
  });

  test('should support async/await', async () => {
    const result = await Promise.resolve('test');
    expect(result).toBe('test');
  });

  test('should handle JSON operations', () => {
    const testData = {
      opportunity: {
        id: 'test-1',
        profit: 10.5
      }
    };
    
    const serialized = JSON.stringify(testData);
    const deserialized = JSON.parse(serialized);
    
    expect(deserialized.opportunity.profit).toBe(10.5);
  });
});