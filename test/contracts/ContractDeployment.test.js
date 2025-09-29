const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Smart Contract Infrastructure Deployment", function () {
    let deployer, user1, user2;
    let contracts = {};
    
    before(async function () {
        [deployer, user1, user2] = await ethers.getSigners();
        console.log("Testing with deployer:", deployer.address);
    });
    
    describe("Core Infrastructure Deployment", function () {
        it("Should deploy PriceOracle successfully", async function () {
            const PriceOracle = await ethers.getContractFactory("PriceOracle");
            contracts.priceOracle = await PriceOracle.deploy();
            await contracts.priceOracle.deployed();
            
            expect(contracts.priceOracle.address).to.not.equal(ethers.constants.AddressZero);
            console.log("✅ PriceOracle deployed to:", contracts.priceOracle.address);
        });
        
        it("Should deploy RiskManager successfully", async function () {
            const RiskManager = await ethers.getContractFactory("RiskManager");
            contracts.riskManager = await RiskManager.deploy(contracts.priceOracle.address);
            await contracts.riskManager.deployed();
            
            expect(contracts.riskManager.address).to.not.equal(ethers.constants.AddressZero);
            console.log("✅ RiskManager deployed to:", contracts.riskManager.address);
        });
        
        it("Should deploy FeeManager successfully", async function () {
            const FeeManager = await ethers.getContractFactory("FeeManager");
            contracts.feeManager = await FeeManager.deploy();
            await contracts.feeManager.deployed();
            
            expect(contracts.feeManager.address).to.not.equal(ethers.constants.AddressZero);
            console.log("✅ FeeManager deployed to:", contracts.feeManager.address);
        });
        
        it("Should deploy ArbitrageRouter successfully", async function () {
            const ArbitrageRouter = await ethers.getContractFactory("ArbitrageRouter");
            contracts.arbitrageRouter = await ArbitrageRouter.deploy();
            await contracts.arbitrageRouter.deployed();
            
            expect(contracts.arbitrageRouter.address).to.not.equal(ethers.constants.AddressZero);
            console.log("✅ ArbitrageRouter deployed to:", contracts.arbitrageRouter.address);
        });
        
        it("Should deploy MultiDEXRouter successfully", async function () {
            const MultiDEXRouter = await ethers.getContractFactory("MultiDEXRouter");
            contracts.multiDEXRouter = await MultiDEXRouter.deploy();
            await contracts.multiDEXRouter.deployed();
            
            expect(contracts.multiDEXRouter.address).to.not.equal(ethers.constants.AddressZero);
            console.log("✅ MultiDEXRouter deployed to:", contracts.multiDEXRouter.address);
        });
        
        it("Should deploy ProfitCalculator successfully", async function () {
            const ProfitCalculator = await ethers.getContractFactory("ProfitCalculator");
            contracts.profitCalculator = await ProfitCalculator.deploy();
            await contracts.profitCalculator.deployed();
            
            expect(contracts.profitCalculator.address).to.not.equal(ethers.constants.AddressZero);
            console.log("✅ ProfitCalculator deployed to:", contracts.profitCalculator.address);
        });
        
        it("Should deploy ArbitrageExecutor successfully", async function () {
            const ArbitrageExecutor = await ethers.getContractFactory("ArbitrageExecutor");
            contracts.arbitrageExecutor = await ArbitrageExecutor.deploy(contracts.arbitrageRouter.address);
            await contracts.arbitrageExecutor.deployed();
            
            expect(contracts.arbitrageExecutor.address).to.not.equal(ethers.constants.AddressZero);
            console.log("✅ ArbitrageExecutor deployed to:", contracts.arbitrageExecutor.address);
        });
        
        it("Should deploy ArbitrageFactory successfully", async function () {
            // Create mock implementation addresses for the factory
            const ArbitrageFactory = await ethers.getContractFactory("ArbitrageFactory");
            contracts.arbitrageFactory = await ArbitrageFactory.deploy(
                contracts.arbitrageExecutor.address, // Use as flashloan impl
                contracts.arbitrageExecutor.address,
                contracts.multiDEXRouter.address
            );
            await contracts.arbitrageFactory.deployed();
            
            expect(contracts.arbitrageFactory.address).to.not.equal(ethers.constants.AddressZero);
            console.log("✅ ArbitrageFactory deployed to:", contracts.arbitrageFactory.address);
        });
    });
    
    describe("Contract Integration Tests", function () {
        it("Should have correct ownership setup", async function () {
            expect(await contracts.priceOracle.owner()).to.equal(deployer.address);
            expect(await contracts.riskManager.owner()).to.equal(deployer.address);
            expect(await contracts.feeManager.owner()).to.equal(deployer.address);
        });
        
        it("Should have correct access control setup", async function () {
            // Check that deployer is operator
            expect(await contracts.priceOracle.operators(deployer.address)).to.be.true;
            expect(await contracts.riskManager.operators(deployer.address)).to.be.true;
        });
        
        it("Should have correct emergency stop functionality", async function () {
            // Test emergency stop
            await contracts.priceOracle.activateEmergencyStop();
            expect(await contracts.priceOracle.isEmergencyStopped()).to.be.true;
            
            // Test deactivate
            await contracts.priceOracle.deactivateEmergencyStop();
            expect(await contracts.priceOracle.isEmergencyStopped()).to.be.false;
        });
        
        it("Should have initialized supported DEXs in MultiDEXRouter", async function () {
            const activeRouters = await contracts.multiDEXRouter.getActiveRouters();
            expect(activeRouters.length).to.be.greaterThan(0);
            console.log("✅ Active routers count:", activeRouters.length);
        });
        
        it("Should have correct fee structure in FeeManager", async function () {
            const defaultFeeStructure = await contracts.feeManager.defaultFeeStructure();
            expect(defaultFeeStructure.protocolFeeBps).to.equal(100); // 1%
            expect(defaultFeeStructure.performanceFeeBps).to.equal(1000); // 10%
            expect(defaultFeeStructure.isActive).to.be.true;
        });
        
        it("Should have correct factory configuration", async function () {
            const deploymentFee = await contracts.arbitrageFactory.deploymentFee();
            expect(deploymentFee).to.equal(ethers.utils.parseEther("0.01"));
            
            const feeRecipient = await contracts.arbitrageFactory.feeRecipient();
            expect(feeRecipient).to.equal(deployer.address);
        });
    });
    
    describe("Basic Functionality Tests", function () {
        it("Should allow adding price updater in PriceOracle", async function () {
            await contracts.priceOracle.addPriceUpdater(user1.address);
            expect(await contracts.priceOracle.priceUpdaters(user1.address)).to.be.true;
        });
        
        it("Should allow adding allowed token in RiskManager", async function () {
            const mockToken = "0x" + "1".repeat(40); // Mock token address
            await contracts.riskManager.addAllowedToken(mockToken);
            expect(await contracts.riskManager.allowedTokens(mockToken)).to.be.true;
        });
        
        it("Should allow adding fee recipient in FeeManager", async function () {
            await contracts.feeManager.addFeeRecipient(user1.address, 5000); // 50%
            const recipientCount = await contracts.feeManager.getFeeRecipientsCount();
            expect(recipientCount).to.equal(2); // Owner + new recipient
        });
        
        it("Should calculate fees correctly", async function () {
            const mockToken = ethers.constants.AddressZero;
            const tradeAmount = ethers.utils.parseEther("1000");
            const profit = ethers.utils.parseEther("10");
            const gasUsed = 300000;
            const gasPrice = ethers.utils.parseUnits("20", "gwei");
            
            const fees = await contracts.feeManager.calculateFees(
                mockToken,
                tradeAmount,
                profit,
                gasUsed,
                gasPrice
            );
            
            expect(fees.protocolFee).to.be.gt(0);
            expect(fees.performanceFee).to.be.gt(0);
            expect(fees.totalFee).to.be.gt(0);
        });
    });
    
    describe("Security Tests", function () {
        it("Should reject unauthorized calls", async function () {
            await expect(
                contracts.priceOracle.connect(user1).addPriceUpdater(user2.address)
            ).to.be.revertedWith("AccessControl: caller is not the owner");
        });
        
        it("Should reject operations during emergency stop", async function () {
            await contracts.riskManager.activateEmergencyStop();
            
            await expect(
                contracts.riskManager.validateTrade(
                    user1.address,
                    ethers.constants.AddressZero,
                    ethers.utils.parseEther("100"),
                    ethers.utils.parseEther("1"),
                    ethers.utils.parseUnits("20", "gwei")
                )
            ).to.be.revertedWith("circuit breaker active");
            
            await contracts.riskManager.deactivateEmergencyStop();
        });
        
        it("Should validate contract addresses in constructors", async function () {
            const RiskManager = await ethers.getContractFactory("RiskManager");
            
            await expect(
                RiskManager.deploy(ethers.constants.AddressZero)
            ).to.be.revertedWith("RiskManager: invalid oracle");
        });
    });
    
    after(async function () {
        console.log("\n📋 Deployment Summary:");
        console.log("========================");
        for (const [name, contract] of Object.entries(contracts)) {
            if (contract && contract.address) {
                console.log(`${name}: ${contract.address}`);
            }
        }
        console.log("\n✅ All contract tests completed successfully!");
    });
});