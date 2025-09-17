// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IERC20.sol";
import "../interfaces/IUniswapV2Router.sol";
import "../interfaces/IUniswapV3Router.sol";

/**
 * @title ProfitCalculator
 * @notice On-chain profit validation for arbitrage opportunities
 */
contract ProfitCalculator {
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MAX_SLIPPAGE = 500; // 5%
    
    struct ArbitrageParams {
        address tokenA;
        address tokenB;
        uint256 amountIn;
        address routerA;
        address routerB;
        uint24 feeA; // For V3 pools
        uint24 feeB; // For V3 pools
        uint256 minProfitBps; // Minimum profit in basis points
    }
    
    struct ProfitResult {
        uint256 grossProfit;
        uint256 netProfit;
        uint256 gasCost;
        uint256 flashLoanFee;
        bool isProfitable;
        uint256 profitPercentage;
    }
    
    event ProfitCalculated(
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountIn,
        uint256 grossProfit,
        uint256 netProfit,
        bool isProfitable
    );
    
    /**
     * @notice Calculate potential profit for arbitrage opportunity
     * @param params Arbitrage parameters
     * @param gasPrice Current gas price for cost calculation
     * @param flashLoanFeeBps Flash loan fee in basis points
     * @return result Detailed profit calculation result
     */
    function calculateProfit(
        ArbitrageParams memory params,
        uint256 gasPrice,
        uint256 flashLoanFeeBps
    ) external view returns (ProfitResult memory result) {
        require(params.tokenA != address(0) && params.tokenB != address(0), "ProfitCalculator: invalid tokens");
        require(params.amountIn > 0, "ProfitCalculator: invalid amount");
        require(params.minProfitBps <= BASIS_POINTS, "ProfitCalculator: invalid min profit");
        
        // Simulate first swap (buy)
        uint256 amountOut1 = simulateSwap(
            params.tokenA,
            params.tokenB,
            params.amountIn,
            params.routerA,
            params.feeA
        );
        
        // Simulate second swap (sell)
        uint256 amountOut2 = simulateSwap(
            params.tokenB,
            params.tokenA,
            amountOut1,
            params.routerB,
            params.feeB
        );
        
        // Calculate gross profit
        if (amountOut2 > params.amountIn) {
            result.grossProfit = amountOut2 - params.amountIn;
        } else {
            result.grossProfit = 0;
        }
        
        // Calculate costs
        result.gasCost = estimateGasCost(gasPrice);
        result.flashLoanFee = (params.amountIn * flashLoanFeeBps) / BASIS_POINTS;
        
        // Calculate net profit
        uint256 totalCosts = result.gasCost + result.flashLoanFee;
        if (result.grossProfit > totalCosts) {
            result.netProfit = result.grossProfit - totalCosts;
        } else {
            result.netProfit = 0;
        }
        
        // Calculate profitability
        result.profitPercentage = (result.netProfit * BASIS_POINTS) / params.amountIn;
        result.isProfitable = result.profitPercentage >= params.minProfitBps && result.netProfit > 0;
        
        emit ProfitCalculated(
            params.tokenA,
            params.tokenB,
            params.amountIn,
            result.grossProfit,
            result.netProfit,
            result.isProfitable
        );
    }
    
    /**
     * @notice Simulate swap on a DEX
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Input amount
     * @param router Router address
     * @param fee Pool fee (for V3, 0 for V2)
     * @return amountOut Expected output amount
     */
    function simulateSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        address router,
        uint24 fee
    ) internal view returns (uint256 amountOut) {
        require(tokenIn != tokenOut, "ProfitCalculator: identical tokens");
        require(amountIn > 0, "ProfitCalculator: zero amount");
        
        if (fee > 0) {
            // V3 simulation - simplified, would need actual quoter in production
            amountOut = (amountIn * 99) / 100; // Simplified 1% fee approximation
        } else {
            // V2 simulation
            try IUniswapV2Router(router).getAmountsOut(amountIn, _getPath(tokenIn, tokenOut)) returns (uint[] memory amounts) {
                amountOut = amounts[amounts.length - 1];
            } catch {
                amountOut = 0;
            }
        }
    }
    
    /**
     * @notice Estimate gas cost for arbitrage transaction
     * @param gasPrice Current gas price
     * @return gasCost Estimated gas cost in token units
     */
    function estimateGasCost(uint256 gasPrice) internal pure returns (uint256 gasCost) {
        // Estimated gas for flashloan arbitrage: ~300k gas
        uint256 estimatedGas = 300000;
        gasCost = estimatedGas * gasPrice;
    }
    
    /**
     * @notice Create path array for token swap
     * @param tokenA First token
     * @param tokenB Second token
     * @return path Token path array
     */
    function _getPath(address tokenA, address tokenB) internal pure returns (address[] memory path) {
        path = new address[](2);
        path[0] = tokenA;
        path[1] = tokenB;
    }
    
    /**
     * @notice Validate arbitrage parameters
     * @param params Arbitrage parameters to validate
     * @return isValid Whether parameters are valid
     */
    function validateArbitrageParams(ArbitrageParams memory params) external pure returns (bool isValid) {
        return params.tokenA != address(0) &&
               params.tokenB != address(0) &&
               params.tokenA != params.tokenB &&
               params.amountIn > 0 &&
               params.routerA != address(0) &&
               params.routerB != address(0) &&
               params.minProfitBps <= BASIS_POINTS;
    }
}