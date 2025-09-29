const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Gas Optimization Tests", function () {
    let deployer, user1;
    let contracts = {};
    let gasReports = [];
    
    before(async function () {
        [deployer, user1] = await ethers.getSigners();
        
        // Deploy core contracts
        const PriceOracle = await ethers.getContractFactory("PriceOracle");
        contracts.priceOracle = await PriceOracle.deploy();
        await contracts.priceOracle.deployed();
        
        const RiskManager = await ethers.getContractFactory("RiskManager");
        contracts.riskManager = await RiskManager.deploy(contracts.priceOracle.address);
        await contracts.riskManager.deployed();
        
        const FeeManager = await ethers.getContractFactory("FeeManager");
        contracts.feeManager = await FeeManager.deploy();
        await contracts.feeManager.deployed();
        
        const ArbitrageRouter = await ethers.getContractFactory("ArbitrageRouter");
        contracts.arbitrageRouter = await ArbitrageRouter.deploy();
        await contracts.arbitrageRouter.deployed();
        
        const ProfitCalculator = await ethers.getContractFactory("ProfitCalculator");
        contracts.profitCalculator = await ProfitCalculator.deploy();
        await contracts.profitCalculator.deployed();
        
        console.log("📦 Core contracts deployed for gas testing");
    });
    
    describe("Contract Deployment Gas Costs", function () {
        it("Should measure PriceOracle deployment gas", async function () {
            const PriceOracle = await ethers.getContractFactory("PriceOracle");
            const deployTx = await PriceOracle.getDeployTransaction();
            const estimatedGas = await deployer.estimateGas(deployTx);
            
            gasReports.push({
                contract: "PriceOracle",
                operation: "deployment",
                gasUsed: estimatedGas.toString()
            });
            
            console.log(`📊 PriceOracle deployment gas: ${estimatedGas.toString()}`);
            expect(estimatedGas).to.be.lt(ethers.utils.parseUnits("3000000", "wei")); // Less than 3M gas
        });
        
        it("Should measure RiskManager deployment gas", async function () {
            const RiskManager = await ethers.getContractFactory("RiskManager");
            const deployTx = await RiskManager.getDeployTransaction(contracts.priceOracle.address);
            const estimatedGas = await deployer.estimateGas(deployTx);
            
            gasReports.push({
                contract: "RiskManager",
                operation: "deployment",
                gasUsed: estimatedGas.toString()
            });
            
            console.log(`📊 RiskManager deployment gas: ${estimatedGas.toString()}`);
            expect(estimatedGas).to.be.lt(ethers.utils.parseUnits("4000000", "wei")); // Less than 4M gas
        });
        
        it("Should measure FeeManager deployment gas", async function () {
            const FeeManager = await ethers.getContractFactory("FeeManager");
            const deployTx = await FeeManager.getDeployTransaction();
            const estimatedGas = await deployer.estimateGas(deployTx);
            
            gasReports.push({
                contract: "FeeManager",
                operation: "deployment",
                gasUsed: estimatedGas.toString()
            });
            
            console.log(`📊 FeeManager deployment gas: ${estimatedGas.toString()}`);
            expect(estimatedGas).to.be.lt(ethers.utils.parseUnits("3500000", "wei")); // Less than 3.5M gas
        });
    });
    
    describe("Function Call Gas Costs", function () {
        it("Should measure price update gas cost", async function () {
            const mockToken = "0x" + "1".repeat(40);
            
            // Add price feed first
            const addFeedTx = await contracts.priceOracle.addPriceFeed(
                mockToken,
                "0x" + "2".repeat(40), // Mock feed address
                0, // CHAINLINK
                3600, // 1 hour heartbeat
                18 // 18 decimals
            );
            const addFeedReceipt = await addFeedTx.wait();
            
            gasReports.push({
                contract: "PriceOracle",
                operation: "addPriceFeed",
                gasUsed: addFeedReceipt.gasUsed.toString()
            });
            
            // Test price update
            const updateTx = await contracts.priceOracle.updatePrice(
                mockToken,
                ethers.utils.parseUnits("100", 18), // $100
                10000 // 100% confidence
            );
            const updateReceipt = await updateTx.wait();
            
            gasReports.push({
                contract: "PriceOracle",
                operation: "updatePrice",
                gasUsed: updateReceipt.gasUsed.toString()
            });
            
            console.log(`📊 Price update gas: ${updateReceipt.gasUsed.toString()}`);
            expect(updateReceipt.gasUsed).to.be.lt(150000); // Less than 150k gas
        });
        
        it("Should measure risk validation gas cost", async function () {
            const mockToken = "0x" + "1".repeat(40);
            
            // Add allowed token first
            await contracts.riskManager.addAllowedToken(mockToken);
            
            // Test trade validation
            const tx = await contracts.riskManager.validateTrade(
                user1.address,
                mockToken,
                ethers.utils.parseEther("1000"), // $1000
                ethers.utils.parseEther("10"),   // $10 profit
                ethers.utils.parseUnits("20", "gwei") // 20 gwei gas price
            );
            const receipt = await tx.wait();
            
            gasReports.push({
                contract: "RiskManager",
                operation: "validateTrade",
                gasUsed: receipt.gasUsed.toString()
            });
            
            console.log(`📊 Risk validation gas: ${receipt.gasUsed.toString()}`);
            expect(receipt.gasUsed).to.be.lt(200000); // Less than 200k gas
        });
        
        it("Should measure fee calculation gas cost", async function () {
            const mockToken = ethers.constants.AddressZero;
            const tradeAmount = ethers.utils.parseEther("1000");
            const profit = ethers.utils.parseEther("10");
            const gasUsed = 300000;
            const gasPrice = ethers.utils.parseUnits("20", "gwei");
            
            // This is a view function, so we estimate gas
            const estimatedGas = await contracts.feeManager.estimateGas.calculateFees(
                mockToken,
                tradeAmount,
                profit,
                gasUsed,
                gasPrice
            );
            
            gasReports.push({
                contract: "FeeManager",
                operation: "calculateFees",
                gasUsed: estimatedGas.toString()
            });
            
            console.log(`📊 Fee calculation gas: ${estimatedGas.toString()}`);
            expect(estimatedGas).to.be.lt(50000); // Less than 50k gas for view functions
        });
        
        it("Should measure profit calculation gas cost", async function () {
            const params = {
                tokenA: "0x" + "1".repeat(40),
                tokenB: "0x" + "2".repeat(40),
                amountIn: ethers.utils.parseEther("1000"),
                routerA: "0x" + "3".repeat(40),
                routerB: "0x" + "4".repeat(40),
                feeA: 3000, // 0.3%
                feeB: 3000, // 0.3%
                minProfitBps: 50 // 0.5%
            };
            
            const gasPrice = ethers.utils.parseUnits("20", "gwei");
            const flashLoanFeeBps = 9; // 0.09%
            
            // Estimate gas for profit calculation
            const estimatedGas = await contracts.profitCalculator.estimateGas.calculateProfit(
                params,
                gasPrice,
                flashLoanFeeBps
            );
            
            gasReports.push({
                contract: "ProfitCalculator",
                operation: "calculateProfit",
                gasUsed: estimatedGas.toString()
            });
            
            console.log(`📊 Profit calculation gas: ${estimatedGas.toString()}`);
            expect(estimatedGas).to.be.lt(300000); // Less than 300k gas
        });
    });
    
    describe("Batch Operations Gas Efficiency", function () {
        it("Should measure batch price updates", async function () {
            const tokens = [
                "0x" + "5".repeat(40),
                "0x" + "6".repeat(40),
                "0x" + "7".repeat(40)
            ];
            
            // Add price feeds for all tokens
            for (let i = 0; i < tokens.length; i++) {
                await contracts.priceOracle.addPriceFeed(
                    tokens[i],
                    "0x" + (i + 5).toString().repeat(40),
                    0, // CHAINLINK
                    3600, // 1 hour heartbeat
                    18 // 18 decimals
                );
            }
            
            // Measure individual updates
            let totalIndividualGas = 0;
            for (let i = 0; i < tokens.length; i++) {
                const tx = await contracts.priceOracle.updatePrice(
                    tokens[i],
                    ethers.utils.parseUnits((100 + i).toString(), 18),
                    10000
                );
                const receipt = await tx.wait();
                totalIndividualGas += receipt.gasUsed.toNumber();
            }
            
            gasReports.push({
                contract: "PriceOracle",
                operation: "batchPriceUpdates",
                gasUsed: totalIndividualGas.toString()
            });
            
            console.log(`📊 Batch price updates gas: ${totalIndividualGas}`);
            
            // Gas should scale reasonably with number of updates
            const avgGasPerUpdate = totalIndividualGas / tokens.length;
            expect(avgGasPerUpdate).to.be.lt(100000); // Less than 100k gas per update
        });
    });
    
    describe("Gas Optimization Comparison", function () {
        it("Should compare standard vs optimized operations", async function () {
            // This test would compare gas usage between different implementation approaches
            // For now, we'll validate that our implementations are within reasonable bounds
            
            const totalDeploymentGas = gasReports
                .filter(report => report.operation === "deployment")
                .reduce((sum, report) => sum + parseInt(report.gasUsed), 0);
            
            console.log(`📊 Total deployment gas: ${totalDeploymentGas}`);
            
            // Total deployment should be under 15M gas
            expect(totalDeploymentGas).to.be.lt(15000000);
        });
    });
    
    after(async function () {
        console.log("\n📊 Gas Usage Report:");
        console.log("===================");
        
        // Group by contract
        const byContract = {};
        gasReports.forEach(report => {
            if (!byContract[report.contract]) {
                byContract[report.contract] = [];
            }
            byContract[report.contract].push(report);
        });
        
        for (const [contract, reports] of Object.entries(byContract)) {
            console.log(`\n${contract}:`);
            reports.forEach(report => {
                const gasUsed = parseInt(report.gasUsed);
                const gasInK = (gasUsed / 1000).toFixed(1);
                console.log(`  ${report.operation}: ${gasInK}k gas`);
            });
        }
        
        console.log("\n✅ Gas optimization tests completed!");
    });
});