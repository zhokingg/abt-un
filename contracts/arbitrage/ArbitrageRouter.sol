// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IERC20.sol";
import "../interfaces/IUniswapV2Router.sol";
import "../interfaces/IUniswapV3Router.sol";
import "../security/EmergencyStop.sol";

/**
 * @title ArbitrageRouter
 * @notice Handles DEX routing and swap logic for arbitrage execution
 */
contract ArbitrageRouter is EmergencyStop {
    uint256 public constant MAX_SLIPPAGE = 500; // 5% maximum slippage
    uint256 public constant BASIS_POINTS = 10000;
    
    struct SwapParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOutMin;
        address router;
        uint24 fee; // For V3 pools, 0 for V2
        uint256 deadline;
    }
    
    event SwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address indexed router
    );
    
    event SlippageProtectionTriggered(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 expectedAmount,
        uint256 actualAmount
    );
    
    /**
     * @notice Execute a token swap on specified DEX
     * @param params Swap parameters
     * @return amountOut Amount of tokens received
     */
    function executeSwap(SwapParams memory params) 
        external 
        notInEmergencyStop
        onlyOperator
        returns (uint256 amountOut) 
    {
        require(params.tokenIn != address(0) && params.tokenOut != address(0), "ArbitrageRouter: invalid tokens");
        require(params.amountIn > 0, "ArbitrageRouter: invalid amount");
        require(params.router != address(0), "ArbitrageRouter: invalid router");
        require(block.timestamp <= params.deadline, "ArbitrageRouter: swap expired");
        
        // Ensure we have the tokens
        uint256 balanceBefore = IERC20(params.tokenIn).balanceOf(address(this));
        require(balanceBefore >= params.amountIn, "ArbitrageRouter: insufficient balance");
        
        // Approve router to spend tokens
        IERC20(params.tokenIn).approve(params.router, params.amountIn);
        
        // Execute swap based on router type
        if (params.fee > 0) {
            // Uniswap V3 swap
            amountOut = _executeV3Swap(params);
        } else {
            // Uniswap V2 swap
            amountOut = _executeV2Swap(params);
        }
        
        // Validate slippage protection
        require(amountOut >= params.amountOutMin, "ArbitrageRouter: slippage too high");
        
        emit SwapExecuted(
            params.tokenIn,
            params.tokenOut,
            params.amountIn,
            amountOut,
            params.router
        );
    }
    
    /**
     * @notice Execute multiple swaps atomically
     * @param swaps Array of swap parameters
     * @return amountsOut Array of output amounts
     */
    function executeMultipleSwaps(SwapParams[] memory swaps) 
        external 
        notInEmergencyStop
        onlyOperator
        returns (uint256[] memory amountsOut) 
    {
        require(swaps.length > 0 && swaps.length <= 10, "ArbitrageRouter: invalid swaps length");
        
        amountsOut = new uint256[](swaps.length);
        
        for (uint256 i = 0; i < swaps.length; i++) {
            amountsOut[i] = this.executeSwap(swaps[i]);
        }
    }
    
    /**
     * @notice Calculate minimum output amount with slippage protection
     * @param expectedAmount Expected output amount
     * @param slippageBps Slippage tolerance in basis points
     * @return minAmount Minimum acceptable output amount
     */
    function calculateMinAmountOut(uint256 expectedAmount, uint256 slippageBps) 
        external 
        pure 
        returns (uint256 minAmount) 
    {
        require(slippageBps <= MAX_SLIPPAGE, "ArbitrageRouter: slippage too high");
        minAmount = (expectedAmount * (BASIS_POINTS - slippageBps)) / BASIS_POINTS;
    }
    
    /**
     * @notice Execute Uniswap V2 swap
     * @param params Swap parameters
     * @return amountOut Output amount
     */
    function _executeV2Swap(SwapParams memory params) internal returns (uint256 amountOut) {
        IUniswapV2Router router = IUniswapV2Router(params.router);
        
        address[] memory path = new address[](2);
        path[0] = params.tokenIn;
        path[1] = params.tokenOut;
        
        uint256[] memory amounts = router.swapExactTokensForTokens(
            params.amountIn,
            params.amountOutMin,
            path,
            address(this),
            params.deadline
        );
        
        amountOut = amounts[amounts.length - 1];
    }
    
    /**
     * @notice Execute Uniswap V3 swap
     * @param params Swap parameters
     * @return amountOut Output amount
     */
    function _executeV3Swap(SwapParams memory params) internal returns (uint256 amountOut) {
        IUniswapV3Router router = IUniswapV3Router(params.router);
        
        IUniswapV3Router.ExactInputSingleParams memory swapParams = IUniswapV3Router.ExactInputSingleParams({
            tokenIn: params.tokenIn,
            tokenOut: params.tokenOut,
            fee: params.fee,
            recipient: address(this),
            deadline: params.deadline,
            amountIn: params.amountIn,
            amountOutMinimum: params.amountOutMin,
            sqrtPriceLimitX96: 0
        });
        
        amountOut = router.exactInputSingle(swapParams);
    }
    
    /**
     * @notice Get token balance
     * @param token Token address
     * @return balance Token balance of this contract
     */
    function getTokenBalance(address token) external view returns (uint256 balance) {
        return IERC20(token).balanceOf(address(this));
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
        require(token != address(0), "ArbitrageRouter: invalid token");
        require(amount > 0, "ArbitrageRouter: invalid amount");
        
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance >= amount, "ArbitrageRouter: insufficient balance");
        
        IERC20(token).transfer(owner, amount);
    }
    
    /**
     * @notice Validate swap parameters
     * @param params Swap parameters to validate
     * @return isValid Whether parameters are valid
     */
    function validateSwapParams(SwapParams memory params) external view returns (bool isValid) {
        return params.tokenIn != address(0) &&
               params.tokenOut != address(0) &&
               params.tokenIn != params.tokenOut &&
               params.amountIn > 0 &&
               params.router != address(0) &&
               params.deadline > block.timestamp &&
               params.amountOutMin > 0;
    }
}