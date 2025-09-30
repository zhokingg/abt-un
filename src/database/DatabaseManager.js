import { EventEmitter } from 'events';
import pkg from 'pg';
const { Pool } = pkg;

/**
 * Database Manager for Arbitrage Bot
 * Handles PostgreSQL connections, transactions, and data operations
 */
export class DatabaseManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      host: options.host || process.env.DB_HOST || 'localhost',
      port: options.port || process.env.DB_PORT || 5432,
      database: options.database || process.env.DB_NAME || 'arbitrage_bot',
      user: options.user || process.env.DB_USER || 'postgres',
      password: options.password || process.env.DB_PASSWORD || '',
      
      // Connection pool settings
      max: options.max || 20,
      idleTimeoutMillis: options.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: options.connectionTimeoutMillis || 2000,
      
      // SSL configuration
      ssl: options.ssl || (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false),
      
      // Application settings
      application_name: 'arbitrage-bot',
      
      ...options
    };
    
    this.pool = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 5;
  }

  /**
   * Initialize database connection pool
   */
  async initialize() {
    try {
      console.log('🔌 Initializing database connection...');
      
      this.pool = new Pool(this.options);
      
      // Handle pool events
      this.pool.on('connect', (client) => {
        console.log('📊 Database client connected');
        this.emit('connect', { client });
      });
      
      this.pool.on('error', (err, client) => {
        console.error('❌ Database pool error:', err.message);
        this.emit('error', { error: err, client });
      });
      
      this.pool.on('remove', (client) => {
        console.log('🗑️ Database client removed from pool');
        this.emit('clientRemoved', { client });
      });
      
      // Test the connection
      await this.testConnection();
      
      this.isConnected = true;
      console.log('✅ Database connection established');
      
      this.emit('initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize database:', error.message);
      this.emit('initializationError', { error });
      throw error;
    }
  }

  /**
   * Test database connection
   */
  async testConnection() {
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT NOW() as current_time, version() as version');
      console.log('🏥 Database connection test successful:', result.rows[0].current_time);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Execute a query with connection pooling
   */
  async query(text, params = []) {
    const start = Date.now();
    
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      this.emit('query', {
        text,
        duration,
        rows: result.rowCount
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      
      this.emit('queryError', {
        text,
        error: error.message,
        duration
      });
      
      throw error;
    }
  }

  /**
   * Execute a transaction
   */
  async transaction(callback) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const result = await callback(client);
      
      await client.query('COMMIT');
      
      this.emit('transaction', {
        type: 'commit',
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      
      this.emit('transaction', {
        type: 'rollback',
        error: error.message,
        timestamp: Date.now()
      });
      
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Record a trade in the database
   */
  async recordTrade(tradeData) {
    const queryText = `
      INSERT INTO arbitrage.trades (
        opportunity_id, token_pair, trade_type, token_a_address, token_b_address,
        token_a_symbol, token_b_symbol, amount_in, amount_out, expected_amount_out,
        expected_profit, actual_profit, profit_percentage, gas_cost, gas_used,
        gas_price, flashloan_fee, slippage, execution_time, block_number,
        tx_hash, buy_exchange, sell_exchange, status, detected_at, executed_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26
      ) RETURNING id
    `;
    
    const values = [
      tradeData.opportunityId,
      tradeData.tokenPair,
      tradeData.tradeType || 'simple',
      tradeData.tokenAAddress,
      tradeData.tokenBAddress,
      tradeData.tokenASymbol,
      tradeData.tokenBSymbol,
      tradeData.amountIn,
      tradeData.amountOut,
      tradeData.expectedAmountOut,
      tradeData.expectedProfit,
      tradeData.actualProfit,
      tradeData.profitPercentage,
      tradeData.gasCost,
      tradeData.gasUsed,
      tradeData.gasPrice,
      tradeData.flashloanFee || 0,
      tradeData.slippage,
      tradeData.executionTime,
      tradeData.blockNumber,
      tradeData.txHash,
      tradeData.buyExchange,
      tradeData.sellExchange,
      tradeData.status || 'pending',
      tradeData.detectedAt,
      tradeData.executedAt
    ];
    
    const result = await this.query(queryText, values);
    return result.rows[0].id;
  }

  /**
   * Record a risk assessment
   */
  async recordRiskAssessment(riskData) {
    const queryText = `
      INSERT INTO arbitrage.risk_assessments (
        opportunity_id, trade_id, risk_score, volatility_score, liquidity_score,
        gas_score, confidence_score, market_condition, volatility_level,
        recommended_size, max_slippage, approved, rejection_reason, risk_factors
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      ) RETURNING id
    `;
    
    const values = [
      riskData.opportunityId,
      riskData.tradeId,
      riskData.riskScore,
      riskData.volatilityScore,
      riskData.liquidityScore,
      riskData.gasScore,
      riskData.confidenceScore,
      riskData.marketCondition,
      riskData.volatilityLevel,
      riskData.recommendedSize,
      riskData.maxSlippage,
      riskData.approved,
      riskData.rejectionReason,
      JSON.stringify(riskData.riskFactors || {})
    ];
    
    const result = await this.query(queryText, values);
    return result.rows[0].id;
  }

  /**
   * Record performance metrics
   */
  async recordPerformanceMetric(metricData) {
    const queryText = `
      INSERT INTO analytics.performance_metrics (
        metric_type, metric_name, metric_value, metric_unit,
        token_pair, exchange, network, aggregation_level,
        metadata, timestamp
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      ) RETURNING id
    `;
    
    const values = [
      metricData.metricType,
      metricData.metricName,
      metricData.metricValue,
      metricData.metricUnit,
      metricData.tokenPair,
      metricData.exchange,
      metricData.network || 'ethereum',
      metricData.aggregationLevel || 'raw',
      JSON.stringify(metricData.metadata || {}),
      metricData.timestamp || new Date()
    ];
    
    const result = await this.query(queryText, values);
    return result.rows[0].id;
  }

  /**
   * Get trading statistics
   */
  async getTradingStats(days = 7) {
    const queryText = `
      SELECT 
        COUNT(*) as total_trades,
        COUNT(*) FILTER (WHERE status = 'confirmed') as successful_trades,
        COUNT(*) FILTER (WHERE status IN ('failed', 'reverted')) as failed_trades,
        ROUND(COUNT(*) FILTER (WHERE status = 'confirmed')::decimal / NULLIF(COUNT(*), 0) * 100, 2) as success_rate,
        SUM(actual_profit) FILTER (WHERE status = 'confirmed') as total_profit,
        SUM(gas_cost) as total_gas_cost,
        AVG(execution_time) FILTER (WHERE status = 'confirmed') as avg_execution_time,
        COUNT(DISTINCT token_pair) as unique_pairs_traded
      FROM arbitrage.trades
      WHERE created_at >= NOW() - INTERVAL '${days} days'
    `;
    
    const result = await this.query(queryText);
    return result.rows[0];
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(metricType, hours = 24) {
    const queryText = `
      SELECT 
        metric_name,
        AVG(metric_value) as avg_value,
        MIN(metric_value) as min_value,
        MAX(metric_value) as max_value,
        COUNT(*) as sample_count,
        metric_unit
      FROM analytics.performance_metrics
      WHERE metric_type = $1 
        AND timestamp >= NOW() - INTERVAL '${hours} hours'
      GROUP BY metric_name, metric_unit
      ORDER BY metric_name
    `;
    
    const result = await this.query(queryText, [metricType]);
    return result.rows;
  }

  /**
   * Health check for database
   */
  async healthCheck() {
    try {
      const connectionTest = await this.testConnection();
      const poolStats = {
        totalConnections: this.pool.totalCount,
        idleConnections: this.pool.idleCount,
        waitingRequests: this.pool.waitingCount
      };
      
      return {
        status: 'healthy',
        connected: this.isConnected,
        connectionTime: connectionTest.current_time,
        version: connectionTest.version,
        poolStats
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Close database connections
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      console.log('🔌 Database connections closed');
      this.emit('closed');
    }
  }
}

export default DatabaseManager;