const hre = require("hardhat");

async function main() {
    console.log("🚀 Starting smart contract deployment...");
    
    const [deployer] = await hre.ethers.getSigners();
    console.log("📝 Deploying contracts with account:", deployer.address);
    console.log("💰 Account balance:", (await deployer.getBalance()).toString());
    
    const deploymentResults = {};
    
    try {
        // 1. Deploy PriceOracle
        console.log("\n📈 Deploying PriceOracle...");
        const PriceOracle = await hre.ethers.getContractFactory("PriceOracle");
        const priceOracle = await PriceOracle.deploy();
        await priceOracle.deployed();
        deploymentResults.PriceOracle = priceOracle.address;
        console.log("✅ PriceOracle deployed to:", priceOracle.address);
        
        // 2. Deploy RiskManager
        console.log("\n⚠️  Deploying RiskManager...");
        const RiskManager = await hre.ethers.getContractFactory("RiskManager");
        const riskManager = await RiskManager.deploy(priceOracle.address);
        await riskManager.deployed();
        deploymentResults.RiskManager = riskManager.address;
        console.log("✅ RiskManager deployed to:", riskManager.address);
        
        // 3. Deploy FeeManager
        console.log("\n💰 Deploying FeeManager...");
        const FeeManager = await hre.ethers.getContractFactory("FeeManager");
        const feeManager = await FeeManager.deploy();
        await feeManager.deployed();
        deploymentResults.FeeManager = feeManager.address;
        console.log("✅ FeeManager deployed to:", feeManager.address);
        
        // 4. Deploy ArbitrageRouter
        console.log("\n🔄 Deploying ArbitrageRouter...");
        const ArbitrageRouter = await hre.ethers.getContractFactory("ArbitrageRouter");
        const arbitrageRouter = await ArbitrageRouter.deploy();
        await arbitrageRouter.deployed();
        deploymentResults.ArbitrageRouter = arbitrageRouter.address;
        console.log("✅ ArbitrageRouter deployed to:", arbitrageRouter.address);
        
        // 5. Deploy MultiDEXRouter
        console.log("\n🌐 Deploying MultiDEXRouter...");
        const MultiDEXRouter = await hre.ethers.getContractFactory("MultiDEXRouter");
        const multiDEXRouter = await MultiDEXRouter.deploy();
        await multiDEXRouter.deployed();
        deploymentResults.MultiDEXRouter = multiDEXRouter.address;
        console.log("✅ MultiDEXRouter deployed to:", multiDEXRouter.address);
        
        // 6. Deploy ProfitCalculator
        console.log("\n🧮 Deploying ProfitCalculator...");
        const ProfitCalculator = await hre.ethers.getContractFactory("ProfitCalculator");
        const profitCalculator = await ProfitCalculator.deploy();
        await profitCalculator.deployed();
        deploymentResults.ProfitCalculator = profitCalculator.address;
        console.log("✅ ProfitCalculator deployed to:", profitCalculator.address);
        
        // 7. Deploy ArbitrageExecutor
        console.log("\n⚡ Deploying ArbitrageExecutor...");
        const ArbitrageExecutor = await hre.ethers.getContractFactory("ArbitrageExecutor");
        const arbitrageExecutor = await ArbitrageExecutor.deploy(arbitrageRouter.address);
        await arbitrageExecutor.deployed();
        deploymentResults.ArbitrageExecutor = arbitrageExecutor.address;
        console.log("✅ ArbitrageExecutor deployed to:", arbitrageExecutor.address);
        
        console.log("\n🎉 Core contracts deployed successfully!");
        console.log("\n📋 Deployment Summary:");
        console.log("========================");
        
        for (const [name, address] of Object.entries(deploymentResults)) {
            console.log(`${name}: ${address}`);
        }
        
        // Save deployment addresses to file
        const fs = require('fs');
        const path = require('path');
        
        // Ensure deployments directory exists
        const deploymentsDir = path.join(__dirname, '../../deployments');
        if (!fs.existsSync(deploymentsDir)) {
            fs.mkdirSync(deploymentsDir, { recursive: true });
        }
        
        const deploymentInfo = {
            network: hre.network.name,
            deployer: deployer.address,
            timestamp: new Date().toISOString(),
            contracts: deploymentResults
        };
        
        const deploymentFile = path.join(deploymentsDir, `${hre.network.name}-deployment.json`);
        fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
        
        console.log(`\n💾 Deployment info saved to ${deploymentFile}`);
        
    } catch (error) {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    }
}

// Run the deployment
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });