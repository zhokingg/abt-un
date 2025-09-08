// src/AdvancedGraphOptimizer.js
const { ethers } = require('ethers');

class AdvancedGraphOptimizer {
  constructor(provider, tokens) {
    this.provider = provider;
    this.tokens = tokens;
    this.tokenGraph = new Map();
    this.liquidityGraph = new Map();
    this.priceImpactCache = new Map();
    this.opportunityCache = new Map();
    this.lastCacheUpdate = 0;
    this.cacheValidityMs = 30000; // 30 seconds
    
    console.log('🔧 Advanced Graph Optimizer initialized');
  }

  // Build optimized token-indexed graph with liquidity weights
  async buildOptimizedTokenGraph() {
    console.log('🌐 Building optimized token-indexed graph...');
    
    const startTime = Date.now();
    const tokenList = Object.values(this.tokens);
    
    // Clear existing graphs
    this.tokenGraph.clear();
    this.liquidityGraph.clear();
    
    // Create adjacency list with liquidity weights
    for (let i = 0; i < tokenList.length; i++) {
      for (let j = 0; j < tokenList.length; j++) {
        if (i !== j) {
          const tokenA = tokenList[i];
          const tokenB = tokenList[j];
          
          // Get liquidity data for this pair
          const liquidityData = await this.getLiquidityMetrics(tokenA, tokenB);
          
          if (liquidityData.hasLiquidity) {
            // Add to token graph
            if (!this.tokenGraph.has(tokenA.symbol)) {
              this.tokenGraph.set(tokenA.symbol, []);
            }
            
            this.tokenGraph.get(tokenA.symbol).push({
              to: tokenB.symbol,
              token: tokenB,
              weight: liquidityData.liquidityScore,
              fees: liquidityData.fees,
              slippage: liquidityData.estimatedSlippage
            });
            
            // Add to liquidity graph for fast lookups
            const pairKey = `${tokenA.symbol}-${tokenB.symbol}`;
            this.liquidityGraph.set(pairKey, liquidityData);
          }
        }
      }
    }
    
    const buildTime = Date.now() - startTime;
    console.log(`✅ Graph built in ${buildTime}ms with ${this.liquidityGraph.size} liquid pairs`);
    
    return {
      nodes: tokenList.length,
      edges: this.liquidityGraph.size,
      buildTimeMs: buildTime
    };
  }

  async getLiquidityMetrics(tokenA, tokenB) {
    try {
      // Simulate liquidity check (in production, query actual pools)
      const mockLiquidity = Math.random() * 1000000; // Random liquidity $0-1M
      const mockVolume24h = Math.random() * 100000; // Random volume $0-100K
      
      return {
        hasLiquidity: mockLiquidity > 10000, // Minimum $10K liquidity
        liquidityUSD: mockLiquidity,
        volume24h: mockVolume24h,
        liquidityScore: Math.min(mockLiquidity / 100000, 1), // Normalize to 0-1
        fees: [0.01, 0.05, 0.3, 1.0], // Available fee tiers
        estimatedSlippage: this.calculateSlippage(mockLiquidity)
      };
    } catch (error) {
      return { hasLiquidity: false };
    }
  }

  calculateSlippage(liquidityUSD) {
    // Estimate slippage based on liquidity (simplified model)
    if (liquidityUSD > 1000000) return 0.01; // 0.01% for high liquidity
    if (liquidityUSD > 100000) return 0.05; // 0.05% for medium liquidity
    if (liquidityUSD > 10000) return 0.2; // 0.2% for low liquidity
    return 1.0; // 1% for very low liquidity
  }

  // Optimized multi-hop arbitrage detection with deduplication
  findOptimizedArbitragePaths(startToken, maxHops = 4) {
    console.log(`🔍 Finding optimized arbitrage paths from ${startToken}...`);
    
    const startTime = Date.now();
    const paths = new Set(); // Use Set for automatic deduplication
    const pathsArray = [];
    
    // DFS with optimizations
    const dfs = (currentPath, visited, currentWeight) => {
      const currentToken = currentPath[currentPath.length - 1];
      
      // Early termination if weight too low
      if (currentWeight < 0.1) return;
      
      // Check if we can complete the arbitrage loop
      if (currentPath.length >= 3 && currentPath.length <= maxHops) {
        const connections = this.tokenGraph.get(currentToken) || [];
        const returnConnection = connections.find(conn => conn.to === startToken);
        
        if (returnConnection) {
          const completePath = [...currentPath, startToken];
          const pathKey = this.generateCanonicalPathKey(completePath);
          
          if (!paths.has(pathKey)) {
            paths.add(pathKey);
            pathsArray.push({
              path: completePath,
              weight: currentWeight * returnConnection.weight,
              estimatedSlippage: this.calculatePathSlippage(completePath),
              hops: completePath.length - 1
            });
          }
        }
      }
      
      // Continue exploring
      if (currentPath.length < maxHops) {
        const connections = this.tokenGraph.get(currentToken) || [];
        
        // Sort connections by weight (prioritize high liquidity)
        const sortedConnections = connections
          .filter(conn => !visited.has(conn.to) && conn.to !== startToken)
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 5); // Limit to top 5 connections for performance
        
        for (const connection of sortedConnections) {
          visited.add(connection.to);
          currentPath.push(connection.to);
          
          dfs(currentPath, visited, currentWeight * connection.weight);
          
          currentPath.pop();
          visited.delete(connection.to);
        }
      }
    };
    
    const visited = new Set([startToken]);
    dfs([startToken], visited, 1.0);
    
    // Sort by weight and filter duplicates
    const optimizedPaths = pathsArray
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 20); // Return top 20 paths
    
    const searchTime = Date.now() - startTime;
    console.log(`✅ Found ${optimizedPaths.length} unique paths in ${searchTime}ms`);
    
    return optimizedPaths;
  }

  generateCanonicalPathKey(path) {
    // Generate canonical key for deduplication
    // Normalize path direction (A->B->C->A same as A->C->B->A reversed)
    const pathCopy = [...path];
    const startIndex = pathCopy.indexOf(Math.min(...pathCopy.map(token => 
      typeof token === 'string' ? token : token.symbol
    )));
    
    // Rotate array to start with lexicographically smallest token
    const rotated = [
      ...pathCopy.slice(startIndex),
      ...pathCopy.slice(0, startIndex)
    ];
    
    return rotated.join('-');
  }

  calculatePathSlippage(path) {
    let totalSlippage = 0;
    
    for (let i = 0; i < path.length - 1; i++) {
      const pairKey = `${path[i]}-${path[i + 1]}`;
      const liquidityData = this.liquidityGraph.get(pairKey);
      
      if (liquidityData) {
        totalSlippage += liquidityData.estimatedSlippage;
      }
    }
    
    return totalSlippage;
  }

  // Optimal trade size calculation with price impact modeling
  async calculateOptimalTradeSize(opportunity, maxTradeUSD = 10000) {
    console.log('📊 Calculating optimal trade size...');
    
    const tradeSizes = [];
    const stepSize = maxTradeUSD / 20; // Test 20 different sizes
    
    for (let tradeSize = stepSize; tradeSize <= maxTradeUSD; tradeSize += stepSize) {
      const analysis = await this.analyzeTradeSize(opportunity, tradeSize);
      tradeSizes.push({
        tradeSize,
        expectedProfit: analysis.expectedProfit,
        priceImpact: analysis.priceImpact,
        slippage: analysis.slippage,
        gasCost: analysis.gasC.estimatedGasUSD,
        netProfit: analysis.expectedProfit - analysis.estimatedGasUSD,
        roi: ((analysis.expectedProfit - analysis.estimatedGasUSD) / tradeSize) * 100
      });
    }
    
    // Find optimal size (highest net profit with acceptable slippage)
    const optimal = tradeSizes
      .filter(trade => trade.slippage < 0.5 && trade.priceImpact < 1.0) // Max 0.5% slippage, 1% price impact
      .sort((a, b) => b.netProfit - a.netProfit)[0];
    
    console.log(`💡 Optimal trade size: $${optimal?.tradeSize || 0} (Net profit: $${optimal?.netProfit.toFixed(2) || 0})`);
    
    return {
      optimalSize: optimal?.tradeSize || 0,
      expectedNetProfit: optimal?.netProfit || 0,
      maxProfitableSize: tradeSizes[tradeSizes.length - 1]?.tradeSize || 0,
      analysis: tradeSizes
    };
  }

  async analyzeTradeSize(opportunity, tradeSizeUSD) {
    // Simplified price impact modeling
    const baseSlippage = opportunity.estimatedSlippage || 0.1;
    const liquidityImpact = Math.sqrt(tradeSizeUSD / 100000); // Square root price impact model
    
    const totalSlippage = baseSlippage + (liquidityImpact * 0.1);
    const priceImpact = liquidityImpact * 0.05; // Price impact typically smaller than slippage
    
    const grossProfit = (opportunity.profitPercentage / 100) * tradeSizeUSD;
    const slippageCost = totalSlippage * tradeSizeUSD / 100;
    const expectedProfit = grossProfit - slippageCost;
    
    // Estimate gas costs (more complex trades = higher gas)
    const baseGas = 150000;
    const hopMultiplier = (opportunity.hops || 2) * 0.5;
    const estimatedGas = baseGas * (1 + hopMultiplier);
    const estimatedGasUSD = estimatedGas * 20 * 0.000000001 * 2000; // 20 gwei * ETH price
    
    return {
      expectedProfit,
      priceImpact,
      slippage: totalSlippage,
      estimatedGasUSD,
      netProfit: expectedProfit - estimatedGasUSD
    };
  }

  // Dynamic gas pricing strategy
  async getDynamicGasStrategy() {
    try {
      const feeData = await this.provider.getFeeData();
      const currentGasPrice = feeData.gasPrice;
      const gasPriceGwei = parseFloat(ethers.formatUnits(currentGasPrice, 'gwei'));
      
      // Get network congestion level
      const congestionLevel = this.assessNetworkCongestion(gasPriceGwei);
      
      let strategy;
      if (congestionLevel === 'low') {
        strategy = {
          mode: 'standard',
          gasPrice: currentGasPrice,
          priorityFee: ethers.parseUnits('1', 'gwei'),
          speedup: false
        };
      } else if (congestionLevel === 'medium') {
        strategy = {
          mode: 'fast',
          gasPrice: currentGasPrice * 110n / 100n, // 10% higher
          priorityFee: ethers.parseUnits('2', 'gwei'),
          speedup: true
        };
      } else {
        strategy = {
          mode: 'urgent',
          gasPrice: currentGasPrice * 125n / 100n, // 25% higher
          priorityFee: ethers.parseUnits('5', 'gwei'),
          speedup: true
        };
      }
      
      console.log(`⛽ Dynamic gas strategy: ${strategy.mode} (${gasPriceGwei.toFixed(1)} gwei)`);
      return strategy;
      
    } catch (error) {
      console.error('❌ Gas strategy calculation failed:', error.message);
      return { mode: 'standard', gasPrice: ethers.parseUnits('20', 'gwei') };
    }
  }

  assessNetworkCongestion(gasPriceGwei) {
    if (gasPriceGwei < 20) return 'low';
    if (gasPriceGwei < 50) return 'medium';
    return 'high';
  }

  // Advanced risk assessment scoring
  calculateRiskScore(opportunity) {
    let riskScore = 0;
    const factors = [];
    
    // Liquidity risk (higher for multi-hop)
    const liquidityRisk = (opportunity.hops || 2) * 10;
    riskScore += liquidityRisk;
    factors.push({ factor: 'Liquidity Risk', score: liquidityRisk, reason: `${opportunity.hops || 2} hops` });
    
    // Slippage risk
    const slippageRisk = (opportunity.estimatedSlippage || 0.1) * 200;
    riskScore += slippageRisk;
    factors.push({ factor: 'Slippage Risk', score: slippageRisk, reason: `${(opportunity.estimatedSlippage || 0.1).toFixed(2)}% slippage` });
    
    // Price impact risk
    const priceImpactRisk = (opportunity.priceImpact || 0.1) * 100;
    riskScore += priceImpactRisk;
    factors.push({ factor: 'Price Impact', score: priceImpactRisk, reason: `${(opportunity.priceImpact || 0.1).toFixed(2)}% impact` });
    
    // Gas risk (network congestion)
    const gasRisk = gasPriceGwei > 50 ? 30 : (gasPriceGwei > 20 ? 15 : 5);
    riskScore += gasRisk;
    factors.push({ factor: 'Gas Risk', score: gasRisk, reason: `${gasPriceGwei}gwei gas price` });
    
    // Normalize to 0-100 scale
    const normalizedScore = Math.min(riskScore, 100);
    
    let riskLevel;
    if (normalizedScore < 30) riskLevel = 'LOW';
    else if (normalizedScore < 60) riskLevel = 'MEDIUM';
    else riskLevel = 'HIGH';
    
    return {
      score: normalizedScore,
      level: riskLevel,
      factors,
      recommendation: normalizedScore < 50 ? 'PROCEED' : 'CAUTION'
    };
  }

  // Performance metrics for sub-5 second analysis
  async performOptimizedAnalysis(startTokens = ['WETH', 'USDC']) {
    console.log('\n⚡ OPTIMIZED ARBITRAGE ANALYSIS (Target: <5 seconds)');
    console.log('='.repeat(60));
    
    const startTime = Date.now();
    const results = {
      graphBuildTime: 0,
      pathFindingTime: 0,
      optimizationTime: 0,
      totalOpportunities: 0,
      viableOpportunities: 0,
      bestOpportunity: null
    };
    
    try {
      // 1. Build optimized graph (target: <1 second)
      const graphStart = Date.now();
      await this.buildOptimizedTokenGraph();
      results.graphBuildTime = Date.now() - graphStart;
      
      // 2. Find arbitrage paths (target: <2 seconds)
      const pathStart = Date.now();
      const allPaths = [];
      
      for (const startToken of startTokens) {
        const paths = this.findOptimizedArbitragePaths(startToken, 4);
        allPaths.push(...paths);
      }
      
      results.pathFindingTime = Date.now() - pathStart;
      results.totalOpportunities = allPaths.length;
      
      // 3. Optimize and score opportunities (target: <2 seconds)
      const optimizeStart = Date.now();
      const scoredOpportunities = allPaths.map(opportunity => {
        const riskScore = this.calculateRiskScore(opportunity);
        const adjustedWeight = opportunity.weight * (100 - riskScore.score) / 100;
        
        return {
          ...opportunity,
          riskScore,
          adjustedScore: adjustedWeight,
          viable: riskScore.recommendation === 'PROCEED' && adjustedWeight > 0.1
        };
      });
      
      // Sort by adjusted score
      scoredOpportunities.sort((a, b) => b.adjustedScore - a.adjustedScore);
      
      results.optimizationTime = Date.now() - optimizeStart;
      results.viableOpportunities = scoredOpportunities.filter(op => op.viable).length;
      results.bestOpportunity = scoredOpportunities[0] || null;
      
      const totalTime = Date.now() - startTime;
      
      // Display performance metrics
      console.log(`⏱️  PERFORMANCE METRICS:`);
      console.log(`   Graph Build: ${results.graphBuildTime}ms`);
      console.log(`   Path Finding: ${results.pathFindingTime}ms`);
      console.log(`   Optimization: ${results.optimizationTime}ms`);
      console.log(`   Total Time: ${totalTime}ms ${totalTime < 5000 ? '✅' : '❌'}`);
      console.log('');
      console.log(`📊 ANALYSIS RESULTS:`);
      console.log(`   Total Paths: ${results.totalOpportunities}`);
      console.log(`   Viable Opportunities: ${results.viableOpportunities}`);
      
      if (results.bestOpportunity) {
        const best = results.bestOpportunity;
        console.log(`   Best Opportunity: ${best.path.join(' → ')}`);
        console.log(`   Risk Level: ${best.riskScore.level}`);
        console.log(`   Adjusted Score: ${best.adjustedScore.toFixed(4)}`);
      }
      
      return {
        ...results,
        totalTime,
        targetMet: totalTime < 5000,
        opportunities: scoredOpportunities.slice(0, 10) // Return top 10
      };
      
    } catch (error) {
      console.error('❌ Optimized analysis failed:', error.message);
      return results;
    }
  }
}

module.exports = AdvancedGraphOptimizer;