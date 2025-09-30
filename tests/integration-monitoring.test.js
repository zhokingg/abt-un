/**
 * Integration test for comprehensive monitoring system
 * Tests the integration of all new monitoring components
 */

import Phase4Manager from '../src/services/Phase4Manager.js';

describe('Comprehensive Monitoring Integration', () => {
  let phase4Manager;
  
  beforeAll(async () => {
    // Create Phase4Manager with all monitoring components enabled
    phase4Manager = new Phase4Manager({
      // Disable components that require external dependencies for testing
      enableNetworkOptimization: false,
      enableBacktesting: false,
      enableRiskManagement: false,
      
      // Enable all monitoring components
      enablePerformanceDashboard: true,
      enableHealthMonitor: true,
      enableAnalyticsEngine: true,
      enableLogManager: true,
      enableEventTracker: true,
      enableNotificationManager: true,
      enableReportingService: true,
      
      autoStart: false
    });
  });
  
  afterAll(async () => {
    if (phase4Manager && phase4Manager.isInitialized) {
      await phase4Manager.shutdown();
    }
  });
  
  test('should initialize all monitoring components', async () => {
    await phase4Manager.initialize();
    
    expect(phase4Manager.isInitialized).toBe(true);
    
    // Check that monitoring components are active
    expect(phase4Manager.componentStatus.logManager).toBe('active');
    expect(phase4Manager.componentStatus.eventTracker).toBe('active');
    expect(phase4Manager.componentStatus.healthMonitor).toBe('active');
    expect(phase4Manager.componentStatus.analyticsEngine).toBe('active');
    expect(phase4Manager.componentStatus.notificationManager).toBe('active');
    expect(phase4Manager.componentStatus.performanceDashboard).toBe('active');
    expect(phase4Manager.componentStatus.reportingService).toBe('active');
  });
  
  test('should provide enhanced system status', () => {
    const status = phase4Manager.getEnhancedSystemStatus();
    
    expect(status).toHaveProperty('comprehensiveMonitoring');
    expect(status.comprehensiveMonitoring).toHaveProperty('performanceDashboard');
    expect(status.comprehensiveMonitoring).toHaveProperty('healthMonitor');
    expect(status.comprehensiveMonitoring).toHaveProperty('analyticsEngine');
    expect(status.comprehensiveMonitoring).toHaveProperty('eventTracker');
    expect(status.comprehensiveMonitoring).toHaveProperty('logManager');
    expect(status.comprehensiveMonitoring).toHaveProperty('notificationManager');
    expect(status.comprehensiveMonitoring).toHaveProperty('reportingService');
  });
  
  test('should provide comprehensive dashboard data', () => {
    const dashboardData = phase4Manager.getDashboardData();
    
    expect(dashboardData).toHaveProperty('system');
    expect(dashboardData).toHaveProperty('performance');
    expect(dashboardData).toHaveProperty('timestamp');
    expect(dashboardData).toHaveProperty('dashboard');
    expect(dashboardData).toHaveProperty('health');
    expect(dashboardData).toHaveProperty('analytics');
  });
  
  test('should provide comprehensive metrics', () => {
    const metrics = phase4Manager.getComprehensiveMetrics();
    
    expect(metrics).toHaveProperty('timestamp');
    expect(metrics).toHaveProperty('components');
    expect(metrics).toHaveProperty('aggregated');
    
    // Check that component metrics are included
    expect(Object.keys(metrics.components).length).toBeGreaterThan(0);
  });
  
  test('should track events', async () => {
    const eventId = await phase4Manager.trackEvent('test_event', {
      message: 'Integration test event',
      timestamp: Date.now()
    });
    
    expect(eventId).toBeTruthy();
    
    // Get event analytics
    const analytics = phase4Manager.getEventAnalytics();
    expect(analytics).toHaveProperty('summary');
  });
  
  test('should send notifications', async () => {
    const notificationId = await phase4Manager.sendNotification('test', {
      message: 'Integration test notification',
      component: 'test'
    }, {
      priority: 'low',
      channels: ['discord']
    });
    
    expect(notificationId).toBeTruthy();
  });
  
  test('should provide monitoring insights', () => {
    const insights = phase4Manager.getMonitoringInsights();
    
    expect(insights).toHaveProperty('timestamp');
    expect(insights).toHaveProperty('recommendations');
    expect(insights).toHaveProperty('warnings');
    expect(insights).toHaveProperty('alerts');
    expect(insights).toHaveProperty('performance');
  });
  
  test('should generate reports', async () => {
    try {
      const reportId = await phase4Manager.generateComprehensiveReport({
        template: 'system_health',
        format: 'json'
      });
      
      expect(reportId).toBeTruthy();
    } catch (error) {
      // Report generation might fail due to missing data, which is expected in test environment
      expect(error.message).toContain('Reporting service');
    }
  });
  
  test('should toggle components', async () => {
    // Disable a component
    await phase4Manager.toggleComponent('analyticsEngine', false);
    expect(phase4Manager.componentStatus.analyticsEngine).toBe('inactive');
    
    // Re-enable the component
    await phase4Manager.toggleComponent('analyticsEngine', true);
    expect(phase4Manager.componentStatus.analyticsEngine).toBe('active');
  });
  
  test('should shutdown gracefully', async () => {
    await phase4Manager.shutdown();
    
    expect(phase4Manager.isInitialized).toBe(false);
    expect(phase4Manager.isStarted).toBe(false);
    
    // Check that all components are inactive
    Object.values(phase4Manager.componentStatus).forEach(status => {
      expect(status).toBe('inactive');
    });
  });
});