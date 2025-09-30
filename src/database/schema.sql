-- Arbitrage Bot Database Schema
-- PostgreSQL implementation for comprehensive data management

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create schemas for organization
CREATE SCHEMA IF NOT EXISTS arbitrage;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS security;

-- Set search path
SET search_path TO arbitrage, analytics, security, public;

-- ============================================================================
-- CORE TRADING TABLES
-- ============================================================================

-- Trade execution history
CREATE TABLE arbitrage.trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id VARCHAR(255) NOT NULL,
    token_pair VARCHAR(100) NOT NULL,
    trade_type VARCHAR(50) NOT NULL CHECK (trade_type IN ('simple', 'flashloan', 'triangular')),
    
    -- Token information
    token_a_address VARCHAR(42) NOT NULL,
    token_b_address VARCHAR(42) NOT NULL,
    token_a_symbol VARCHAR(20) NOT NULL,
    token_b_symbol VARCHAR(20) NOT NULL,
    
    -- Trade amounts (stored as strings to preserve precision)
    amount_in DECIMAL(36,18) NOT NULL,
    amount_out DECIMAL(36,18) NOT NULL,
    expected_amount_out DECIMAL(36,18) NOT NULL,
    
    -- Profit calculations
    expected_profit DECIMAL(36,18) NOT NULL,
    actual_profit DECIMAL(36,18),
    profit_percentage DECIMAL(8,6),
    
    -- Costs
    gas_cost DECIMAL(36,18) NOT NULL,
    gas_used BIGINT,
    gas_price DECIMAL(36,18) NOT NULL,
    flashloan_fee DECIMAL(36,18) DEFAULT 0,
    
    -- Execution details
    slippage DECIMAL(8,6),
    execution_time INTEGER, -- milliseconds
    block_number BIGINT NOT NULL,
    tx_hash VARCHAR(66) UNIQUE,
    
    -- Exchanges used
    buy_exchange VARCHAR(50) NOT NULL,
    sell_exchange VARCHAR(50) NOT NULL,
    
    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'reverted')),
    
    -- Timestamps
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Risk assessment history
CREATE TABLE arbitrage.risk_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id VARCHAR(255) NOT NULL,
    trade_id UUID REFERENCES arbitrage.trades(id),
    
    -- Risk scores (0-1 scale)
    risk_score DECIMAL(5,4) NOT NULL,
    volatility_score DECIMAL(5,4) NOT NULL,
    liquidity_score DECIMAL(5,4) NOT NULL,
    gas_score DECIMAL(5,4) NOT NULL,
    confidence_score DECIMAL(5,4) NOT NULL,
    
    -- Market conditions
    market_condition VARCHAR(50) NOT NULL,
    volatility_level VARCHAR(20) NOT NULL CHECK (volatility_level IN ('low', 'medium', 'high', 'extreme')),
    
    -- Recommendations
    recommended_size DECIMAL(36,18),
    max_slippage DECIMAL(8,6),
    
    -- Decision
    approved BOOLEAN NOT NULL,
    rejection_reason TEXT,
    
    -- Risk factors
    risk_factors JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance metrics table with comprehensive coverage
CREATE TABLE analytics.performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_type VARCHAR(100) NOT NULL, -- 'latency', 'throughput', 'profit', 'gas_usage', etc.
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(36,18) NOT NULL,
    metric_unit VARCHAR(20), -- 'ms', 'ops/sec', 'USD', 'wei', 'percent'
    
    -- Context
    token_pair VARCHAR(100),
    exchange VARCHAR(50),
    network VARCHAR(50) DEFAULT 'ethereum',
    
    -- Aggregation level
    aggregation_level VARCHAR(20) DEFAULT 'raw' CHECK (aggregation_level IN ('raw', 'minute', 'hour', 'day')),
    
    -- Additional metadata
    metadata JSONB,
    
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_trades_opportunity_id ON arbitrage.trades(opportunity_id);
CREATE INDEX idx_trades_token_pair ON arbitrage.trades(token_pair);
CREATE INDEX idx_trades_status ON arbitrage.trades(status);
CREATE INDEX idx_trades_created_at_desc ON arbitrage.trades(created_at DESC);
CREATE INDEX idx_performance_metrics_type_name ON analytics.performance_metrics(metric_type, metric_name);
CREATE INDEX idx_performance_metrics_timestamp ON analytics.performance_metrics(timestamp DESC);