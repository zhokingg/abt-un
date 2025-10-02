const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

/**
 * Deployment script for FlashLoanExecutor, ArbitrageExecutor, and MEVProtectedExecutor
 * 
 * This script deploys the three main executor contracts that enable:
 * - Flash loan execution from multiple protocols
 * - Multi-DEX arbitrage execution with gas optimization
 * - MEV-protected transaction bundling and submission
 */
async function main() {
    console.log("🚀 Starting Enhanced Executor Contracts Deployment...\n");
    
    const [deployer] = await hre.ethers.getSigners();
    console.log("📝 Deploying with account:", deployer.address);
    console.log("💰 Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");
    
    const deploymentResults = {};
    const network = hre.network.name;
    
    try {
        // ============================================
        // 1. Deploy FlashLoanExecutor
        // ============================================
        console.log("⚡ Deploying FlashLoanExecutor...");
        console.log("   - Supports Aave V3, Uniswap V3, and Balancer");
        console.log("   - Includes emergency withdrawal and pausing");
        console.log("   - Role-based access control\n");
        
        const FlashLoanExecutor = await hre.ethers.getContractFactory("FlashLoanExecutor");
        const flashLoanExecutor = await FlashLoanExecutor.deploy();
        await flashLoanExecutor.waitForDeployment();
        
        const flashLoanExecutorAddress = await flashLoanExecutor.getAddress();
        deploymentResults.FlashLoanExecutor = flashLoanExecutorAddress;
        console.log("✅ FlashLoanExecutor deployed to:", flashLoanExecutorAddress);
        console.log("   Gas used:", (await hre.ethers.provider.getTransactionReceipt(flashLoanExecutor.deploymentTransaction().hash)).gasUsed.toString());
        console.log("");
        
        // ============================================
        // 2. Deploy ArbitrageExecutor
        // ============================================
        console.log("🔄 Deploying ArbitrageExecutor...");
        console.log("   - Multi-hop, multi-DEX arbitrage support");
        console.log("   - Supports Uniswap V2/V3, SushiSwap");
        console.log("   - Gas-optimized swap batching");
        console.log("   - MEV protection hooks\n");
        
        const ArbitrageExecutor = await hre.ethers.getContractFactory("ArbitrageExecutor");
        const arbitrageExecutor = await ArbitrageExecutor.deploy();
        await arbitrageExecutor.waitForDeployment();
        
        const arbitrageExecutorAddress = await arbitrageExecutor.getAddress();
        deploymentResults.ArbitrageExecutor = arbitrageExecutorAddress;
        console.log("✅ ArbitrageExecutor deployed to:", arbitrageExecutorAddress);
        console.log("   Gas used:", (await hre.ethers.provider.getTransactionReceipt(arbitrageExecutor.deploymentTransaction().hash)).gasUsed.toString());
        console.log("");
        
        // ============================================
        // 3. Deploy MEVProtectedExecutor
        // ============================================
        console.log("🛡️  Deploying MEVProtectedExecutor...");
        console.log("   - Flashbots and private relay integration");
        console.log("   - Slippage protection");
        console.log("   - Circuit breaker and kill switch");
        console.log("   - Role-based access control\n");
        
        // Use deployer address as initial treasury
        const treasuryAddress = deployer.address;
        
        const MEVProtectedExecutor = await hre.ethers.getContractFactory("MEVProtectedExecutor");
        const mevProtectedExecutor = await MEVProtectedExecutor.deploy(treasuryAddress);
        await mevProtectedExecutor.waitForDeployment();
        
        const mevProtectedExecutorAddress = await mevProtectedExecutor.getAddress();
        deploymentResults.MEVProtectedExecutor = mevProtectedExecutorAddress;
        console.log("✅ MEVProtectedExecutor deployed to:", mevProtectedExecutorAddress);
        console.log("   Treasury set to:", treasuryAddress);
        console.log("   Gas used:", (await hre.ethers.provider.getTransactionReceipt(mevProtectedExecutor.deploymentTransaction().hash)).gasUsed.toString());
        console.log("");
        
        // ============================================
        // Post-Deployment Configuration (Optional)
        // ============================================
        console.log("⚙️  Post-deployment configuration...\n");
        
        // Add deployer as operator to all contracts
        console.log("   Adding deployer as operator to all contracts...");
        
        try {
            const tx1 = await flashLoanExecutor.addOperator(deployer.address);
            await tx1.wait();
            console.log("   ✅ FlashLoanExecutor: Operator added");
        } catch (e) {
            console.log("   ⚠️  FlashLoanExecutor: Operator already set or error:", e.message);
        }
        
        try {
            const tx2 = await arbitrageExecutor.addOperator(deployer.address);
            await tx2.wait();
            console.log("   ✅ ArbitrageExecutor: Operator added");
        } catch (e) {
            console.log("   ⚠️  ArbitrageExecutor: Operator already set or error:", e.message);
        }
        
        try {
            const tx3 = await mevProtectedExecutor.addOperator(deployer.address);
            await tx3.wait();
            console.log("   ✅ MEVProtectedExecutor: Operator added");
        } catch (e) {
            console.log("   ⚠️  MEVProtectedExecutor: Operator already set or error:", e.message);
        }
        
        console.log("");
        
        // ============================================
        // Save Deployment Information
        // ============================================
        const deploymentInfo = {
            network: network,
            deployer: deployer.address,
            timestamp: new Date().toISOString(),
            blockNumber: await hre.ethers.provider.getBlockNumber(),
            contracts: deploymentResults,
            configuration: {
                flashLoanExecutor: {
                    supportedProtocols: ["AAVE_V3", "UNISWAP_V3", "BALANCER"],
                    maxAssets: 10,
                    aaveFlashLoanFeeBps: 9
                },
                arbitrageExecutor: {
                    supportedDEXs: ["UNISWAP_V2", "UNISWAP_V3", "SUSHISWAP"],
                    maxHops: 5,
                    maxSlippageBps: 500,
                    minProfitBps: 10
                },
                mevProtectedExecutor: {
                    treasury: treasuryAddress,
                    mevProtectionFeeBps: 50,
                    maxMEVFeeBps: 500,
                    circuitBreaker: {
                        maxFailures: 5,
                        cooldownPeriod: 1800 // 30 minutes
                    }
                }
            }
        };
        
        // Ensure deployments directory exists
        const deploymentsDir = path.join(__dirname, '../../deployments');
        if (!fs.existsSync(deploymentsDir)) {
            fs.mkdirSync(deploymentsDir, { recursive: true });
        }
        
        const deploymentFile = path.join(deploymentsDir, `${network}-executors-deployment.json`);
        fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
        
        // ============================================
        // Print Summary
        // ============================================
        console.log("🎉 Deployment completed successfully!\n");
        console.log("📋 Deployment Summary:");
        console.log("========================");
        console.log(`Network: ${network}`);
        console.log(`Deployer: ${deployer.address}`);
        console.log(`Timestamp: ${deploymentInfo.timestamp}`);
        console.log(`Block Number: ${deploymentInfo.blockNumber}\n`);
        
        console.log("Deployed Contracts:");
        for (const [name, address] of Object.entries(deploymentResults)) {
            console.log(`  ${name}: ${address}`);
        }
        
        console.log(`\n💾 Deployment info saved to: ${deploymentFile}`);
        
        // ============================================
        // Next Steps
        // ============================================
        console.log("\n📝 Next Steps:");
        console.log("========================");
        console.log("1. Verify contracts on Etherscan (if on mainnet/testnet):");
        console.log(`   npx hardhat verify --network ${network} ${flashLoanExecutorAddress}`);
        console.log(`   npx hardhat verify --network ${network} ${arbitrageExecutorAddress}`);
        console.log(`   npx hardhat verify --network ${network} ${mevProtectedExecutorAddress} "${treasuryAddress}"`);
        console.log("");
        console.log("2. Configure authorized operators and relays");
        console.log("3. Set up MEV protection relay addresses");
        console.log("4. Configure slippage and circuit breaker parameters");
        console.log("5. Test with small amounts before production use");
        console.log("");
        
    } catch (error) {
        console.error("\n❌ Deployment failed:", error);
        process.exit(1);
    }
}

// Execute deployment
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
