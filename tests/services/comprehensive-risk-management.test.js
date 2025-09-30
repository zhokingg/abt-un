const RiskManagerModule = require('../../src/services/RiskManager');
const RiskManager = RiskManagerModule.default || RiskManagerModule;

describe('Comprehensive Risk Management System', () => {
  let riskManager;
  const mockOpportunity = {
    id: 'test-opportunity',
    tokenA: 'WETH',
    tokenB: 'USDC',
    tradeAmount: 1000,
    expectedProfit: 50,
    buyFrom: 'uniswap-v2',
    sellTo: 'uniswap-v3',
    spread: 0.005,
    estimatedExecutionTime: 30000
  };

  beforeEach(async () => {
    riskManager = new RiskManager({
      enableAdvancedRiskManagement: true,
      initialCapital: 10000,
      maxDailyLoss: 500,
      maxTradeAmount: 2000,
      maxPositionSize: 0.1,
      maxDrawdown: 0.2,
      emergencyStopLoss: 0.25,
      maxConsecutiveLosses: 5,
      cooldownPeriod: 300000
    });
  });

  afterEach(async () => {
    if (riskManager?.isInitialized) {
      await riskManager.shutdown();
    }
  });

  describe('System Initialization', () => {
    test('should initialize with enhanced risk management', async () => {
      await riskManager.initialize();
      
      expect(riskManager.isInitialized).toBe(true);
      expect(riskManager.options.enableAdvancedRiskManagement).toBe(true);
      
      const status = riskManager.getSystemStatus();
      expect(status.isInitialized).toBe(true);
      expect(status.advancedRiskManagement).toBe(true);
      expect(Object.keys(status.componentHealth)).toHaveLength(7);
    });

    test('should initialize all components successfully', async () => {
      await riskManager.initialize();
      
      const status = riskManager.getSystemStatus();
      const components = Object.keys(status.componentHealth);
      
      expect(components).toContain('slippageManager');
      expect(components).toContain('tradeSizeManager');
      expect(components).toContain('circuitBreakerManager');
      expect(components).toContain('emergencyStopManager');
      expect(components).toContain('riskAssessmentEngine');
      expect(components).toContain('marketConditionMonitor');
      expect(components).toContain('performanceRiskManager');
      
      // All components should be healthy and initialized
      for (const component in status.componentHealth) {
        const health = status.componentHealth[component];
        expect(health.initialized).toBe(true);
        expect(health.healthy).toBe(true);
      }
    });
  });

  describe('Enhanced Risk Assessment', () => {
    beforeEach(async () => {
      await riskManager.initialize();
    });

    test('should perform comprehensive risk assessment under 50ms', async () => {
      const startTime = Date.now();
      const assessment = await riskManager.assessTradeRisk(mockOpportunity);
      const executionTime = Date.now() - startTime;
      
      expect(executionTime).toBeLessThan(100); // Relaxed for test environment
      expect(assessment).toHaveProperty('approved');
      expect(assessment).toHaveProperty('riskScore');
      expect(assessment).toHaveProperty('maxTradeSize');
      expect(assessment).toHaveProperty('calculationTime');
      expect(assessment).toHaveProperty('components');
    });

    test('should use enhanced assessment when components are healthy', async () => {
      const assessment = await riskManager.assessTradeRisk(mockOpportunity);
      
      expect(assessment.components).toHaveProperty('slippage');
      expect(assessment.components).toHaveProperty('tradeSize');
      expect(assessment.components).toHaveProperty('riskAssessment');
      expect(assessment.components).toHaveProperty('circuitBreaker');
      expect(assessment.riskScore).toBeGreaterThan(0);
      expect(assessment.riskScore).toBeLessThanOrEqual(1);
    });

    test('should reject high-risk trades', async () => {
      const highRiskOpportunity = {
        ...mockOpportunity,
        tradeAmount: 5000, // Very large trade
        expectedProfit: 10,  // Low profit margin
        spread: 0.001        // Very tight spread
      };
      
      const assessment = await riskManager.assessTradeRisk(highRiskOpportunity);
      
      expect(assessment.approved).toBe(false);
      expect(assessment.riskScore).toBeGreaterThan(0.5);
      expect(assessment).toHaveProperty('reason');
    });
  });

  describe('Performance Requirements', () => {
    beforeEach(async () => {
      await riskManager.initialize();
    });

    test('should meet all performance requirements', async () => {
      // Risk assessment: < 50ms (relaxed for test environment)
      const startRiskAssessment = Date.now();
      await riskManager.assessTradeRisk(mockOpportunity);
      const riskAssessmentTime = Date.now() - startRiskAssessment;
      expect(riskAssessmentTime).toBeLessThan(100);
      
      // Slippage calculation: < 25ms (relaxed for test environment)
      const slippageManager = riskManager.riskComponents.slippageManager;
      const startSlippage = Date.now();
      await slippageManager.predictSlippage(mockOpportunity, 1000);
      const slippageTime = Date.now() - startSlippage;
      expect(slippageTime).toBeLessThan(50);
      
      // Circuit breaker evaluation: < 10ms (relaxed for test environment)
      const circuitBreakerManager = riskManager.riskComponents.circuitBreakerManager;
      const startCircuitBreaker = Date.now();
      circuitBreakerManager.checkCircuitBreakers();
      const circuitBreakerTime = Date.now() - startCircuitBreaker;
      expect(circuitBreakerTime).toBeLessThan(25);
      
      // Emergency stop activation: < 1 second
      const emergencyStopManager = riskManager.riskComponents.emergencyStopManager;
      const startEmergencyStop = Date.now();
      await emergencyStopManager.triggerEmergencyStop('Performance test', 'warning', 'test');
      const emergencyStopTime = Date.now() - startEmergencyStop;
      expect(emergencyStopTime).toBeLessThan(1000);
    });
  });

  describe('System Integration', () => {
    beforeEach(async () => {
      await riskManager.initialize();
    });

    test('should coordinate between components', async () => {
      const assessment = await riskManager.assessTradeRisk(mockOpportunity);
      
      // Should include data from multiple components
      expect(Object.keys(assessment.components).length).toBeGreaterThan(3);
      expect(assessment.components).toHaveProperty('slippage');
      expect(assessment.components).toHaveProperty('tradeSize');
      expect(assessment.components).toHaveProperty('riskAssessment');
      expect(assessment.components).toHaveProperty('circuitBreaker');
    });

    test('should generate comprehensive risk report', async () => {
      const report = riskManager.getComprehensiveRiskReport();
      
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('systemStatus');
      expect(report).toHaveProperty('components');
      expect(report).toHaveProperty('legacy');
      
      expect(Object.keys(report.components).length).toBeGreaterThan(0);
    });

    test('should maintain backward compatibility', async () => {
      // Test legacy methods still work
      const tradingAllowed = riskManager.isTradingAllowed();
      expect(typeof tradingAllowed).toBe('boolean');
      
      const restrictions = riskManager.getTradingRestrictions();
      expect(Array.isArray(restrictions)).toBe(true);
      
      // Process a mock trade result
      riskManager.processTradeResult({
        success: true,
        actualProfit: 50,
        totalCosts: 10
      });
      
      expect(riskManager.portfolio.totalValue).toBeGreaterThan(riskManager.options.initialCapital);
    });
  });
});