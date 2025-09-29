// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IERC20.sol";
import "../security/EmergencyStop.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ArbitrageRouter.sol";

/**
 * @title ArbitrageExecutor
 * @notice Core logic for atomic arbitrage execution
 * @dev Executes arbitrage trades atomically with built-in safety checks
 */
contract ArbitrageExecutor is EmergencyStop, ReentrancyGuard {
    ArbitrageRouter public arbitrageRouter;
    
    uint256 public constant MAX_SLIPPAGE_BPS = 500; // 5%
    uint256 public constant MIN_PROFIT_BPS = 50;   // 0.5%
    uint256 public constant BASIS_POINTS = 10000;
    
    struct ExecutionParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        address[] routers;
        uint24[] fees;
        uint256 minProfitBps;
        uint256 maxSlippageBps;
        uint256 deadline;
    }
    
    struct ExecutionResult {
        uint256 amountOut;
        uint256 profit;
        uint256 gasUsed;
        bool success;
        string errorMessage;
    }
    
    event ArbitrageExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 profit,
        address indexed executor
    );
    
    event ExecutionFailed(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        string reason
    );
    
    constructor(address _arbitrageRouter) {
        require(_arbitrageRouter != address(0), "ArbitrageExecutor: invalid router");
        arbitrageRouter = ArbitrageRouter(_arbitrageRouter);
    }
    
    /**
     * @notice Execute atomic arbitrage between multiple DEXs
     * @param params Execution parameters
     * @return result Execution result
     */
    function executeArbitrage(ExecutionParams calldata params) 
        external 
        nonReentrant
        notInEmergencyStop
        onlyOperator
        returns (ExecutionResult memory result) 
    {
        uint256 gasStart = gasleft();
        
        // Validate parameters
        require(_validateParams(params), "ArbitrageExecutor: invalid parameters");
        
        try this._executeArbitrageInternal(params) returns (uint256 profit) {
            result.amountOut = profit + params.amountIn;
            result.profit = profit;
            result.success = true;
            
            emit ArbitrageExecuted(
                params.tokenIn,
                params.tokenOut,
                params.amountIn,
                result.amountOut,
                result.profit,
                msg.sender
            );
        } catch Error(string memory reason) {
            result.success = false;
            result.errorMessage = reason;
            
            emit ExecutionFailed(
                params.tokenIn,
                params.tokenOut,
                params.amountIn,
                reason
            );
        }
        
        result.gasUsed = gasStart - gasleft();
    }
    
    /**
     * @notice Internal arbitrage execution (external for try/catch)
     * @param params Execution parameters
     * @return profit Net profit from arbitrage
     */
    function _executeArbitrageInternal(ExecutionParams calldata params) 
        external 
        returns (uint256 profit) 
    {
        require(msg.sender == address(this), "ArbitrageExecutor: internal function");
        
        uint256 balanceBefore = IERC20(params.tokenIn).balanceOf(address(this));
        require(balanceBefore >= params.amountIn, "ArbitrageExecutor: insufficient balance");
        
        // First swap: tokenIn -> tokenOut on first router
        ArbitrageRouter.SwapParams memory swap1 = ArbitrageRouter.SwapParams({
            tokenIn: params.tokenIn,
            tokenOut: params.tokenOut,
            amountIn: params.amountIn,
            amountOutMin: _calculateMinAmountOut(
                params.amountIn, 
                params.maxSlippageBps
            ),
            router: params.routers[0],
            fee: params.fees[0],
            deadline: params.deadline
        });
        
        uint256 amountOut1 = arbitrageRouter.executeSwap(swap1);
        
        // Second swap: tokenOut -> tokenIn on second router
        ArbitrageRouter.SwapParams memory swap2 = ArbitrageRouter.SwapParams({
            tokenIn: params.tokenOut,
            tokenOut: params.tokenIn,
            amountIn: amountOut1,
            amountOutMin: params.amountIn + _calculateMinProfit(
                params.amountIn, 
                params.minProfitBps
            ),
            router: params.routers[1],
            fee: params.fees[1],
            deadline: params.deadline
        });
        
        uint256 amountOut2 = arbitrageRouter.executeSwap(swap2);
        
        // Calculate profit
        require(amountOut2 > params.amountIn, "ArbitrageExecutor: no profit");
        profit = amountOut2 - params.amountIn;
        
        // Ensure minimum profit threshold
        uint256 minProfit = _calculateMinProfit(params.amountIn, params.minProfitBps);
        require(profit >= minProfit, "ArbitrageExecutor: insufficient profit");
    }
    
    /**
     * @notice Validate execution parameters
     * @param params Parameters to validate
     * @return isValid Whether parameters are valid
     */
    function _validateParams(ExecutionParams calldata params) 
        internal 
        view 
        returns (bool isValid) 
    {
        return params.tokenIn != address(0) &&
               params.tokenOut != address(0) &&
               params.tokenIn != params.tokenOut &&
               params.amountIn > 0 &&
               params.routers.length == 2 &&
               params.fees.length == 2 &&
               params.routers[0] != address(0) &&
               params.routers[1] != address(0) &&
               params.minProfitBps >= MIN_PROFIT_BPS &&
               params.maxSlippageBps <= MAX_SLIPPAGE_BPS &&
               params.deadline > block.timestamp;
    }
    
    /**
     * @notice Calculate minimum amount out with slippage protection
     * @param amountIn Input amount
     * @param slippageBps Slippage in basis points
     * @return minAmountOut Minimum acceptable output amount
     */
    function _calculateMinAmountOut(uint256 amountIn, uint256 slippageBps) 
        internal 
        pure 
        returns (uint256 minAmountOut) 
    {
        minAmountOut = amountIn - ((amountIn * slippageBps) / BASIS_POINTS);
    }
    
    /**
     * @notice Calculate minimum profit required
     * @param amountIn Input amount
     * @param profitBps Profit requirement in basis points
     * @return minProfit Minimum profit required
     */
    function _calculateMinProfit(uint256 amountIn, uint256 profitBps) 
        internal 
        pure 
        returns (uint256 minProfit) 
    {
        minProfit = (amountIn * profitBps) / BASIS_POINTS;
    }
    
    /**
     * @notice Emergency token recovery
     * @param token Token to recover
     * @param amount Amount to recover
     */
    function emergencyTokenRecovery(address token, uint256 amount) 
        external 
        onlyOwner 
        onlyInEmergencyStop 
    {
        require(token != address(0), "ArbitrageExecutor: invalid token");
        require(amount > 0, "ArbitrageExecutor: invalid amount");
        
        IERC20(token).transfer(owner, amount);
    }
    
    /**
     * @notice Update arbitrage router
     * @param newRouter New router address
     */
    function updateArbitrageRouter(address newRouter) external onlyOwner {
        require(newRouter != address(0), "ArbitrageExecutor: invalid router");
        arbitrageRouter = ArbitrageRouter(newRouter);
    }
}