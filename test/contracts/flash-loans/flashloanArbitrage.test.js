import { expect } from 'chai';
import { ethers } from 'hardhat';
import { parseUnits, formatUnits } from 'ethers';

describe('FlashloanArbitrage Contract Tests', function () {
  let flashloanArbitrage;
  let owner;
  let user;
  let mockAavePool;
  let mockWETH;
  let mockUSDC;
  let mockUniswapV2Router;
  let mockUniswapV3Router;

  const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
  const USDC_ADDRESS = '0xA0b86a33E6417EaF4c0b6fb6aaCC78d4cF5AE0aB';
  
  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Deploy mock contracts for testing
    const MockERC20 = await ethers.getContractFactory('MockERC20');
    mockWETH = await MockERC20.deploy('Wrapped Ether', 'WETH', 18);
    mockUSDC = await MockERC20.deploy('USD Coin', 'USDC', 6);

    const MockAavePool = await ethers.getContractFactory('MockAavePool');
    mockAavePool = await MockAavePool.deploy();

    const MockUniswapV2Router = await ethers.getContractFactory('MockUniswapV2Router');
    mockUniswapV2Router = await MockUniswapV2Router.deploy();

    const MockUniswapV3Router = await ethers.getContractFactory('MockUniswapV3Router');
    mockUniswapV3Router = await MockUniswapV3Router.deploy();

    // Deploy FlashloanArbitrage contract
    const FlashloanArbitrage = await ethers.getContractFactory('FlashloanArbitrage');
    flashloanArbitrage = await FlashloanArbitrage.deploy(
      await mockAavePool.getAddress(),
      await mockUniswapV2Router.getAddress(),
      await mockUniswapV3Router.getAddress()
    );

    // Setup mock token balances and allowances
    await mockUSDC.mint(await mockAavePool.getAddress(), parseUnits('1000000', 6)); // 1M USDC
    await mockWETH.mint(await mockUniswapV2Router.getAddress(), parseUnits('500', 18)); // 500 WETH
    await mockUSDC.mint(await mockUniswapV3Router.getAddress(), parseUnits('1000000', 6)); // 1M USDC
  });

  describe('Contract Deployment', function () {
    it('should deploy with correct parameters', async function () {
      expect(await flashloanArbitrage.aavePool()).to.equal(await mockAavePool.getAddress());
      expect(await flashloanArbitrage.owner()).to.equal(owner.address);
      expect(await flashloanArbitrage.isEmergencyStopped()).to.equal(false);
    });

    it('should set correct router addresses', async function () {
      expect(await flashloanArbitrage.uniswapV2Router()).to.equal(await mockUniswapV2Router.getAddress());
      expect(await flashloanArbitrage.uniswapV3Router()).to.equal(await mockUniswapV3Router.getAddress());
    });
  });

  describe('Access Control', function () {
    it('should allow only owner to execute arbitrage', async function () {
      const arbitrageParams = {
        tokenIn: await mockUSDC.getAddress(),
        tokenOut: await mockWETH.getAddress(),
        amountIn: parseUnits('1000', 6),
        minAmountOut: parseUnits('0.4', 18),
        buyExchange: 0, // UniswapV2
        sellExchange: 1  // UniswapV3
      };

      await expect(
        flashloanArbitrage.connect(user).executeArbitrage(arbitrageParams)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('should allow owner to set emergency stop', async function () {
      await flashloanArbitrage.setEmergencyStop(true);
      expect(await flashloanArbitrage.isEmergencyStopped()).to.equal(true);
    });

    it('should prevent non-owner from setting emergency stop', async function () {
      await expect(
        flashloanArbitrage.connect(user).setEmergencyStop(true)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  describe('Emergency Stop Functionality', function () {
    it('should prevent arbitrage execution when emergency stopped', async function () {
      await flashloanArbitrage.setEmergencyStop(true);

      const arbitrageParams = {
        tokenIn: await mockUSDC.getAddress(),
        tokenOut: await mockWETH.getAddress(),
        amountIn: parseUnits('1000', 6),
        minAmountOut: parseUnits('0.4', 18),
        buyExchange: 0,
        sellExchange: 1
      };

      await expect(
        flashloanArbitrage.executeArbitrage(arbitrageParams)
      ).to.be.revertedWith('Emergency stop is active');
    });

    it('should allow emergency withdrawal when stopped', async function () {
      // Setup: Add some tokens to the contract
      await mockUSDC.mint(await flashloanArbitrage.getAddress(), parseUnits('1000', 6));
      
      await flashloanArbitrage.setEmergencyStop(true);
      
      const balanceBefore = await mockUSDC.balanceOf(owner.address);
      await flashloanArbitrage.emergencyWithdraw(await mockUSDC.getAddress());
      const balanceAfter = await mockUSDC.balanceOf(owner.address);

      expect(balanceAfter - balanceBefore).to.equal(parseUnits('1000', 6));
    });
  });

  describe('Profitability Checks', function () {
    it('should accurately check profitability', async function () {
      // Mock profitable scenario
      await mockUniswapV2Router.setMockPrice(await mockUSDC.getAddress(), await mockWETH.getAddress(), parseUnits('2000', 6)); // 1 WETH = 2000 USDC
      await mockUniswapV3Router.setMockPrice(await mockWETH.getAddress(), await mockUSDC.getAddress(), parseUnits('2010', 6)); // 1 WETH = 2010 USDC

      const profitability = await flashloanArbitrage.checkProfitability(
        await mockUSDC.getAddress(),
        await mockWETH.getAddress(),
        parseUnits('1000', 6), // 1000 USDC
        0, // Buy from UniswapV2
        1  // Sell on UniswapV3
      );

      expect(profitability.isProfitable).to.equal(true);
      expect(profitability.grossProfit).to.be.gt(0);
      expect(profitability.netProfit).to.be.gt(0);
      expect(profitability.netProfit).to.be.lt(profitability.grossProfit); // Account for gas
    });

    it('should detect unprofitable opportunities', async function () {
      // Mock unprofitable scenario (reverse prices)
      await mockUniswapV2Router.setMockPrice(await mockUSDC.getAddress(), await mockWETH.getAddress(), parseUnits('2010', 6));
      await mockUniswapV3Router.setMockPrice(await mockWETH.getAddress(), await mockUSDC.getAddress(), parseUnits('2000', 6));

      const profitability = await flashloanArbitrage.checkProfitability(
        await mockUSDC.getAddress(),
        await mockWETH.getAddress(),
        parseUnits('1000', 6),
        0,
        1
      );

      expect(profitability.isProfitable).to.equal(false);
      expect(profitability.netProfit).to.be.lte(0);
    });
  });

  describe('Arbitrage Execution', function () {
    beforeEach(async function () {
      // Setup profitable scenario
      await mockUniswapV2Router.setMockPrice(await mockUSDC.getAddress(), await mockWETH.getAddress(), parseUnits('2000', 6));
      await mockUniswapV3Router.setMockPrice(await mockWETH.getAddress(), await mockUSDC.getAddress(), parseUnits('2010', 6));
      
      // Setup flashloan availability
      await mockAavePool.setFlashloanAvailable(await mockUSDC.getAddress(), true);
    });

    it('should execute profitable arbitrage successfully', async function () {
      const arbitrageParams = {
        tokenIn: await mockUSDC.getAddress(),
        tokenOut: await mockWETH.getAddress(),
        amountIn: parseUnits('1000', 6),
        minAmountOut: parseUnits('0.4', 18),
        buyExchange: 0,
        sellExchange: 1
      };

      const tx = await flashloanArbitrage.executeArbitrage(arbitrageParams);
      const receipt = await tx.wait();

      // Check for ArbitrageExecuted event
      const arbitrageEvent = receipt.logs.find(log => 
        log.topics[0] === ethers.id('ArbitrageExecuted(address,address,uint256,uint256,uint256)')
      );
      
      expect(arbitrageEvent).to.not.be.undefined;
    });

    it('should handle flashloan execution correctly', async function () {
      const flashloanAmount = parseUnits('10000', 6); // 10k USDC
      
      const arbitrageParams = {
        tokenIn: await mockUSDC.getAddress(),
        tokenOut: await mockWETH.getAddress(),
        amountIn: flashloanAmount,
        minAmountOut: parseUnits('4', 18),
        buyExchange: 0,
        sellExchange: 1
      };

      // The arbitrage should trigger a flashloan
      const tx = await flashloanArbitrage.executeArbitrage(arbitrageParams);
      await expect(tx).to.emit(mockAavePool, 'FlashLoan');
    });

    it('should revert on insufficient profit', async function () {
      // Setup unprofitable scenario
      await mockUniswapV2Router.setMockPrice(await mockUSDC.getAddress(), await mockWETH.getAddress(), parseUnits('2000', 6));
      await mockUniswapV3Router.setMockPrice(await mockWETH.getAddress(), await mockUSDC.getAddress(), parseUnits('1995', 6)); // Loss

      const arbitrageParams = {
        tokenIn: await mockUSDC.getAddress(),
        tokenOut: await mockWETH.getAddress(),
        amountIn: parseUnits('1000', 6),
        minAmountOut: parseUnits('0.4', 18),
        buyExchange: 0,
        sellExchange: 1
      };

      await expect(
        flashloanArbitrage.executeArbitrage(arbitrageParams)
      ).to.be.revertedWith('Arbitrage not profitable');
    });
  });

  describe('Flashloan Callback', function () {
    it('should handle flashloan callback correctly', async function () {
      // This tests the executeOperation callback from Aave
      const flashloanAmount = parseUnits('5000', 6);
      const premium = parseUnits('4.5', 6); // 0.09% fee
      
      // Mint tokens to contract for the test
      await mockUSDC.mint(await flashloanArbitrage.getAddress(), flashloanAmount);
      
      // Setup the callback parameters
      const asset = await mockUSDC.getAddress();
      const amount = flashloanAmount;
      const params = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'address', 'uint256', 'uint256', 'uint8', 'uint8'],
        [
          await mockUSDC.getAddress(),
          await mockWETH.getAddress(),
          flashloanAmount,
          parseUnits('2', 18),
          0, // buyExchange
          1  // sellExchange
        ]
      );

      // Simulate the flashloan callback
      await expect(
        flashloanArbitrage.executeOperation([asset], [amount], [premium], owner.address, params)
      ).to.not.be.reverted;
    });

    it('should revert callback from unauthorized caller', async function () {
      const params = ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [0]);
      
      await expect(
        flashloanArbitrage.connect(user).executeOperation(
          [await mockUSDC.getAddress()],
          [parseUnits('1000', 6)],
          [parseUnits('1', 6)],
          user.address,
          params
        )
      ).to.be.revertedWith('Unauthorized flashloan callback');
    });
  });

  describe('Token Balance Management', function () {
    it('should track token balances correctly', async function () {
      const tokens = [await mockUSDC.getAddress(), await mockWETH.getAddress()];
      
      // Mint some tokens to the contract
      await mockUSDC.mint(await flashloanArbitrage.getAddress(), parseUnits('1000', 6));
      await mockWETH.mint(await flashloanArbitrage.getAddress(), parseUnits('0.5', 18));
      
      const balances = await flashloanArbitrage.getBalances(tokens);
      
      expect(balances[0]).to.equal(parseUnits('1000', 6));
      expect(balances[1]).to.equal(parseUnits('0.5', 18));
    });

    it('should allow owner to extract profits', async function () {
      // Mint profit tokens to the contract
      await mockUSDC.mint(await flashloanArbitrage.getAddress(), parseUnits('100', 6));
      
      const balanceBefore = await mockUSDC.balanceOf(owner.address);
      await flashloanArbitrage.extractProfit(await mockUSDC.getAddress());
      const balanceAfter = await mockUSDC.balanceOf(owner.address);

      expect(balanceAfter - balanceBefore).to.equal(parseUnits('100', 6));
    });

    it('should prevent non-owner from extracting profits', async function () {
      await mockUSDC.mint(await flashloanArbitrage.getAddress(), parseUnits('100', 6));
      
      await expect(
        flashloanArbitrage.connect(user).extractProfit(await mockUSDC.getAddress())
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  describe('Gas Optimization', function () {
    it('should use optimal gas for arbitrage execution', async function () {
      const arbitrageParams = {
        tokenIn: await mockUSDC.getAddress(),
        tokenOut: await mockWETH.getAddress(),
        amountIn: parseUnits('1000', 6),
        minAmountOut: parseUnits('0.4', 18),
        buyExchange: 0,
        sellExchange: 1
      };

      const gasEstimate = await flashloanArbitrage.executeArbitrage.estimateGas(arbitrageParams);
      
      // Should be under 500k gas for simple arbitrage
      expect(gasEstimate).to.be.lt(500000);
    });

    it('should batch multiple operations efficiently', async function () {
      const tokens = [await mockUSDC.getAddress(), await mockWETH.getAddress()];
      
      await mockUSDC.mint(await flashloanArbitrage.getAddress(), parseUnits('1000', 6));
      await mockWETH.mint(await flashloanArbitrage.getAddress(), parseUnits('0.5', 18));
      
      const gasEstimate = await flashloanArbitrage.getBalances.estimateGas(tokens);
      
      // Batch operation should be gas efficient
      expect(gasEstimate).to.be.lt(100000);
    });
  });

  describe('Edge Cases and Error Handling', function () {
    it('should handle zero amount input', async function () {
      const arbitrageParams = {
        tokenIn: await mockUSDC.getAddress(),
        tokenOut: await mockWETH.getAddress(),
        amountIn: 0,
        minAmountOut: parseUnits('0.4', 18),
        buyExchange: 0,
        sellExchange: 1
      };

      await expect(
        flashloanArbitrage.executeArbitrage(arbitrageParams)
      ).to.be.revertedWith('Amount must be greater than 0');
    });

    it('should handle invalid exchange IDs', async function () {
      const arbitrageParams = {
        tokenIn: await mockUSDC.getAddress(),
        tokenOut: await mockWETH.getAddress(),
        amountIn: parseUnits('1000', 6),
        minAmountOut: parseUnits('0.4', 18),
        buyExchange: 99, // Invalid
        sellExchange: 1
      };

      await expect(
        flashloanArbitrage.executeArbitrage(arbitrageParams)
      ).to.be.revertedWith('Invalid exchange ID');
    });

    it('should handle slippage protection', async function () {
      const arbitrageParams = {
        tokenIn: await mockUSDC.getAddress(),
        tokenOut: await mockWETH.getAddress(),
        amountIn: parseUnits('1000', 6),
        minAmountOut: parseUnits('10', 18), // Unrealistically high expectation
        buyExchange: 0,
        sellExchange: 1
      };

      await expect(
        flashloanArbitrage.executeArbitrage(arbitrageParams)
      ).to.be.revertedWith('Insufficient output amount');
    });
  });
});