// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IFlashLoanReceiver.sol";
import "../interfaces/IPoolAddressesProvider.sol";
import "../interfaces/IPool.sol";
import "../interfaces/IERC20.sol";
import "./ArbitrageRouter.sol";
import "./ProfitCalculator.sol";
import "../security/EmergencyStop.sol";

/**
 * @title FlashloanArbitrage
 * @notice Main arbitrage execution contract using Aave V3 flashloans
 */
contract FlashloanArbitrage is IFlashLoanReceiver, EmergencyStop {
    IPoolAddressesProvider public constant ADDRESSES_PROVIDER = 
        IPoolAddressesProvider(0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e); // Mainnet Aave V3
    
    ArbitrageRouter public arbitrageRouter;
    ProfitCalculator public profitCalculator;
    
    uint256 public constant MAX_TRADE_AMOUNT = 1000000 * 1e6; // $1M USDC max
    uint256 public constant MIN_PROFIT_BPS = 10; // 0.1% minimum profit
    uint256 public constant FLASHLOAN_FEE_BPS = 9; // 0.09% Aave fee
    
    struct ArbitrageData {
        address tokenA;
        address tokenB;
        uint256 amountIn;
        address routerA;
        address routerB;
        uint24 feeA;
        uint24 feeB;
        uint256 minProfitBps;
        uint256 deadline;
    }
    
    event ArbitrageExecuted(
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountIn,
        uint256 profit,
        address indexed initiator
    );
    
    event FlashloanExecuted(
        address indexed asset,
        uint256 amount,
        uint256 premium,
        bool success
    );
    
    event ProfitExtracted(
        address indexed token,
        uint256 amount,
        address indexed recipient
    );
    
    constructor(address _arbitrageRouter, address _profitCalculator) {
        require(_arbitrageRouter != address(0), "FlashloanArbitrage: invalid router");
        require(_profitCalculator != address(0), "FlashloanArbitrage: invalid calculator");
        
        arbitrageRouter = ArbitrageRouter(_arbitrageRouter);
        profitCalculator = ProfitCalculator(_profitCalculator);
    }
    
    /**
     * @notice Execute arbitrage using flashloan
     * @param arbitrageData Arbitrage execution parameters
     */
    function executeArbitrage(ArbitrageData memory arbitrageData) 
        external 
        notInEmergencyStop
        onlyOperator 
    {
        require(arbitrageData.amountIn > 0, "FlashloanArbitrage: invalid amount");
        require(arbitrageData.amountIn <= MAX_TRADE_AMOUNT, "FlashloanArbitrage: amount too large");
        require(block.timestamp <= arbitrageData.deadline, "FlashloanArbitrage: expired");
        
        // Validate profit potential before executing
        ProfitCalculator.ProfitResult memory profitResult = profitCalculator.calculateProfit(
            ProfitCalculator.ArbitrageParams({
                tokenA: arbitrageData.tokenA,
                tokenB: arbitrageData.tokenB,
                amountIn: arbitrageData.amountIn,
                routerA: arbitrageData.routerA,
                routerB: arbitrageData.routerB,
                feeA: arbitrageData.feeA,
                feeB: arbitrageData.feeB,
                minProfitBps: arbitrageData.minProfitBps
            }),
            tx.gasprice,
            FLASHLOAN_FEE_BPS
        );
        
        require(profitResult.isProfitable, "FlashloanArbitrage: not profitable");
        
        // Prepare flashloan
        address[] memory assets = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        uint256[] memory modes = new uint256[](1);
        
        assets[0] = arbitrageData.tokenA;
        amounts[0] = arbitrageData.amountIn;
        modes[0] = 0; // No debt, we'll repay in the same transaction
        
        bytes memory params = abi.encode(arbitrageData);
        
        IPool pool = IPool(ADDRESSES_PROVIDER.getPool());
        pool.flashLoan(
            address(this),
            assets,
            amounts,
            modes,
            msg.sender,
            params,
            0
        );
    }
    
    /**
     * @notice Callback function for Aave flashloan
     * @param assets The addresses of the assets being flashloaned
     * @param amounts The amounts of each asset being flashloaned
     * @param premiums The fees to be paid for each asset
     * @param initiator The address that initiated the flashloan
     * @param params Additional parameters passed to the flashloan
     * @return success True if the operation was successful
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external override returns (bool success) {
        require(msg.sender == ADDRESSES_PROVIDER.getPool(), "FlashloanArbitrage: invalid caller");
        require(assets.length == 1, "FlashloanArbitrage: invalid assets length");
        
        ArbitrageData memory arbitrageData = abi.decode(params, (ArbitrageData));
        
        try this._executeArbitrageLogic(arbitrageData, amounts[0]) {
            // Check if we have enough to repay flashloan
            uint256 totalDebt = amounts[0] + premiums[0];
            uint256 balance = IERC20(assets[0]).balanceOf(address(this));
            
            require(balance >= totalDebt, "FlashloanArbitrage: insufficient funds to repay");
            
            // Approve pool to take repayment
            IERC20(assets[0]).approve(ADDRESSES_PROVIDER.getPool(), totalDebt);
            
            // Calculate profit
            uint256 profit = balance - totalDebt;
            
            emit ArbitrageExecuted(
                arbitrageData.tokenA,
                arbitrageData.tokenB,
                amounts[0],
                profit,
                initiator
            );
            
            emit FlashloanExecuted(assets[0], amounts[0], premiums[0], true);
            
            success = true;
        } catch Error(string memory reason) {
            emit FlashloanExecuted(assets[0], amounts[0], premiums[0], false);
            // In case of failure, we still need to repay the flashloan
            // This should not happen if profit calculation was correct
            require(false, reason);
        }
    }
    
    /**
     * @notice Internal arbitrage execution logic
     * @param arbitrageData Arbitrage parameters
     * @param amount Flashloan amount
     */
    function _executeArbitrageLogic(ArbitrageData memory arbitrageData, uint256 amount) external {
        require(msg.sender == address(this), "FlashloanArbitrage: internal function");
        
        // First swap: tokenA -> tokenB on routerA
        ArbitrageRouter.SwapParams memory swap1 = ArbitrageRouter.SwapParams({
            tokenIn: arbitrageData.tokenA,
            tokenOut: arbitrageData.tokenB,
            amountIn: amount,
            amountOutMin: 0, // We'll calculate this properly in production
            router: arbitrageData.routerA,
            fee: arbitrageData.feeA,
            deadline: arbitrageData.deadline
        });
        
        uint256 amountB = arbitrageRouter.executeSwap(swap1);
        
        // Second swap: tokenB -> tokenA on routerB
        ArbitrageRouter.SwapParams memory swap2 = ArbitrageRouter.SwapParams({
            tokenIn: arbitrageData.tokenB,
            tokenOut: arbitrageData.tokenA,
            amountIn: amountB,
            amountOutMin: amount + ((amount * MIN_PROFIT_BPS) / 10000), // Ensure minimum profit
            router: arbitrageData.routerB,
            fee: arbitrageData.feeB,
            deadline: arbitrageData.deadline
        });
        
        arbitrageRouter.executeSwap(swap2);
    }
    
    /**
     * @notice Extract profits to owner
     * @param token Token address
     * @param amount Amount to extract
     */
    function extractProfit(address token, uint256 amount) 
        external 
        onlyOwner
        notInEmergencyStop 
    {
        require(token != address(0), "FlashloanArbitrage: invalid token");
        require(amount > 0, "FlashloanArbitrage: invalid amount");
        
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance >= amount, "FlashloanArbitrage: insufficient balance");
        
        IERC20(token).transfer(owner, amount);
        
        emit ProfitExtracted(token, amount, owner);
    }
    
    /**
     * @notice Get contract balances for multiple tokens
     * @param tokens Array of token addresses
     * @return balances Array of token balances
     */
    function getBalances(address[] memory tokens) 
        external 
        view 
        returns (uint256[] memory balances) 
    {
        balances = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            balances[i] = IERC20(tokens[i]).balanceOf(address(this));
        }
    }
    
    /**
     * @notice Emergency token recovery
     * @param token Token address
     * @param amount Amount to recover
     */
    function emergencyTokenRecovery(address token, uint256 amount) 
        external 
        onlyOwner
        onlyInEmergencyStop 
    {
        require(token != address(0), "FlashloanArbitrage: invalid token");
        require(amount > 0, "FlashloanArbitrage: invalid amount");
        
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance >= amount, "FlashloanArbitrage: insufficient balance");
        
        IERC20(token).transfer(owner, amount);
    }
    
    /**
     * @notice Update arbitrage router
     * @param newRouter New router address
     */
    function updateArbitrageRouter(address newRouter) external onlyOwner {
        require(newRouter != address(0), "FlashloanArbitrage: invalid router");
        arbitrageRouter = ArbitrageRouter(newRouter);
    }
    
    /**
     * @notice Update profit calculator
     * @param newCalculator New calculator address
     */
    function updateProfitCalculator(address newCalculator) external onlyOwner {
        require(newCalculator != address(0), "FlashloanArbitrage: invalid calculator");
        profitCalculator = ProfitCalculator(newCalculator);
    }
    
    /**
     * @notice Check if arbitrage is currently profitable
     * @param arbitrageData Arbitrage parameters
     * @return isProfitable Whether the arbitrage is profitable
     * @return profitResult Detailed profit calculation
     */
    function checkProfitability(ArbitrageData memory arbitrageData) 
        external 
        view 
        returns (bool isProfitable, ProfitCalculator.ProfitResult memory profitResult) 
    {
        profitResult = profitCalculator.calculateProfit(
            ProfitCalculator.ArbitrageParams({
                tokenA: arbitrageData.tokenA,
                tokenB: arbitrageData.tokenB,
                amountIn: arbitrageData.amountIn,
                routerA: arbitrageData.routerA,
                routerB: arbitrageData.routerB,
                feeA: arbitrageData.feeA,
                feeB: arbitrageData.feeB,
                minProfitBps: arbitrageData.minProfitBps
            }),
            tx.gasprice,
            FLASHLOAN_FEE_BPS
        );
        
        isProfitable = profitResult.isProfitable;
    }
}