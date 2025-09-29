// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IERC20.sol";
import "../interfaces/IUniswapV2Router.sol";
import "../interfaces/IUniswapV3Router.sol";
import "../security/EmergencyStop.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MultiDEXRouter
 * @notice Router for interacting with multiple DEX protocols
 * @dev Supports Uniswap V2, V3, SushiSwap, and other compatible protocols
 */
contract MultiDEXRouter is EmergencyStop, ReentrancyGuard {
    enum RouterType { 
        UNISWAP_V2, 
        UNISWAP_V3, 
        SUSHISWAP, 
        BALANCER,
        CURVE
    }
    
    struct RouterInfo {
        address routerAddress;
        RouterType routerType;
        bool isActive;
        uint256 feeRate; // in basis points
        string name;
    }
    
    struct SwapPath {
        address[] tokens;
        address[] routers;
        uint24[] fees; // For V3 pools
        uint256[] amounts;
    }
    
    struct MultiSwapParams {
        SwapPath path;
        uint256 amountIn;
        uint256 amountOutMin;
        uint256 deadline;
        address recipient;
    }
    
    mapping(address => RouterInfo) public routers;
    address[] public activeRouters;
    
    uint256 public constant MAX_ROUTERS = 20;
    uint256 public constant MAX_PATH_LENGTH = 5;
    uint256 public constant BASIS_POINTS = 10000;
    
    event RouterAdded(
        address indexed router,
        RouterType routerType,
        string name
    );
    
    event RouterRemoved(address indexed router);
    
    event RouterStatusChanged(
        address indexed router,
        bool isActive
    );
    
    event MultiSwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address indexed recipient
    );
    
    event PathOptimized(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 gasEstimate,
        uint256 expectedOutput
    );
    
    constructor() {
        // Initialize with common mainnet routers
        _addRouter(
            0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D, // Uniswap V2
            RouterType.UNISWAP_V2,
            "Uniswap V2"
        );
        
        _addRouter(
            0xE592427A0AEce92De3Edee1F18E0157C05861564, // Uniswap V3
            RouterType.UNISWAP_V3,
            "Uniswap V3"
        );
        
        _addRouter(
            0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F, // SushiSwap
            RouterType.SUSHISWAP,
            "SushiSwap"
        );
    }
    
    /**
     * @notice Execute multi-hop swap across multiple DEXs
     * @param params Multi-swap parameters
     * @return amountOut Final output amount
     */
    function executeMultiSwap(MultiSwapParams calldata params) 
        external 
        nonReentrant
        notInEmergencyStop
        onlyOperator
        returns (uint256 amountOut) 
    {
        require(_validateMultiSwapParams(params), "MultiDEXRouter: invalid parameters");
        
        uint256 currentAmount = params.amountIn;
        address currentToken = params.path.tokens[0];
        
        // Execute swaps along the path
        for (uint256 i = 0; i < params.path.routers.length; i++) {
            address router = params.path.routers[i];
            address tokenOut = params.path.tokens[i + 1];
            uint24 fee = params.path.fees[i];
            
            currentAmount = _executeSwapOnRouter(
                router,
                currentToken,
                tokenOut,
                currentAmount,
                fee,
                params.deadline
            );
            
            currentToken = tokenOut;
        }
        
        amountOut = currentAmount;
        require(amountOut >= params.amountOutMin, "MultiDEXRouter: insufficient output");
        
        // Transfer final amount to recipient
        if (params.recipient != address(this)) {
            IERC20(currentToken).transfer(params.recipient, amountOut);
        }
        
        emit MultiSwapExecuted(
            params.path.tokens[0],
            currentToken,
            params.amountIn,
            amountOut,
            params.recipient
        );
    }
    
    /**
     * @notice Find optimal path for token swap
     * @param tokenIn Input token
     * @param tokenOut Output token
     * @param amountIn Input amount
     * @return bestPath Optimal swap path
     * @return expectedOutput Expected output amount
     */
    function findOptimalPath(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (SwapPath memory bestPath, uint256 expectedOutput) {
        require(tokenIn != address(0) && tokenOut != address(0), "MultiDEXRouter: invalid tokens");
        require(amountIn > 0, "MultiDEXRouter: invalid amount");
        
        uint256 bestOutput = 0;
        uint256 bestGasEstimate = type(uint256).max;
        
        // Check direct swaps on all active routers
        for (uint256 i = 0; i < activeRouters.length; i++) {
            address router = activeRouters[i];
            if (!routers[router].isActive) continue;
            
            uint256 output = _getAmountOut(router, tokenIn, tokenOut, amountIn, 3000);
            uint256 gasEstimate = _estimateGasForRouter(router);
            
            if (output > bestOutput || (output == bestOutput && gasEstimate < bestGasEstimate)) {
                bestOutput = output;
                bestGasEstimate = gasEstimate;
                
                bestPath.tokens = new address[](2);
                bestPath.tokens[0] = tokenIn;
                bestPath.tokens[1] = tokenOut;
                
                bestPath.routers = new address[](1);
                bestPath.routers[0] = router;
                
                bestPath.fees = new uint24[](1);
                bestPath.fees[0] = 3000; // Default 0.3% fee
            }
        }
        
        expectedOutput = bestOutput;
        
        emit PathOptimized(tokenIn, tokenOut, bestGasEstimate, expectedOutput);
    }
    
    /**
     * @notice Add new router to the system
     * @param router Router address
     * @param routerType Type of router
     * @param name Router name
     */
    function addRouter(
        address router,
        RouterType routerType,
        string calldata name
    ) external onlyOwner {
        _addRouter(router, routerType, name);
    }
    
    /**
     * @notice Remove router from the system
     * @param router Router address to remove
     */
    function removeRouter(address router) external onlyOwner {
        require(routers[router].routerAddress != address(0), "MultiDEXRouter: router not found");
        
        routers[router].isActive = false;
        
        // Remove from active routers array
        for (uint256 i = 0; i < activeRouters.length; i++) {
            if (activeRouters[i] == router) {
                activeRouters[i] = activeRouters[activeRouters.length - 1];
                activeRouters.pop();
                break;
            }
        }
        
        delete routers[router];
        emit RouterRemoved(router);
    }
    
    /**
     * @notice Toggle router active status
     * @param router Router address
     * @param isActive New active status
     */
    function setRouterStatus(address router, bool isActive) external onlyOwner {
        require(routers[router].routerAddress != address(0), "MultiDEXRouter: router not found");
        
        routers[router].isActive = isActive;
        emit RouterStatusChanged(router, isActive);
    }
    
    /**
     * @notice Get all active routers
     * @return activeRoutersList List of active router addresses
     */
    function getActiveRouters() external view returns (address[] memory activeRoutersList) {
        uint256 count = 0;
        for (uint256 i = 0; i < activeRouters.length; i++) {
            if (routers[activeRouters[i]].isActive) {
                count++;
            }
        }
        
        activeRoutersList = new address[](count);
        uint256 index = 0;
        
        for (uint256 i = 0; i < activeRouters.length; i++) {
            if (routers[activeRouters[i]].isActive) {
                activeRoutersList[index] = activeRouters[i];
                index++;
            }
        }
    }
    
    /**
     * @notice Internal function to add router
     */
    function _addRouter(
        address router,
        RouterType routerType,
        string memory name
    ) internal {
        require(router != address(0), "MultiDEXRouter: invalid router");
        require(activeRouters.length < MAX_ROUTERS, "MultiDEXRouter: too many routers");
        require(routers[router].routerAddress == address(0), "MultiDEXRouter: router already exists");
        
        routers[router] = RouterInfo({
            routerAddress: router,
            routerType: routerType,
            isActive: true,
            feeRate: _getDefaultFeeRate(routerType),
            name: name
        });
        
        activeRouters.push(router);
        emit RouterAdded(router, routerType, name);
    }
    
    /**
     * @notice Execute swap on specific router
     */
    function _executeSwapOnRouter(
        address router,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint24 fee,
        uint256 deadline
    ) internal returns (uint256 amountOut) {
        RouterType routerType = routers[router].routerType;
        
        // Approve router to spend tokens
        IERC20(tokenIn).approve(router, amountIn);
        
        if (routerType == RouterType.UNISWAP_V2 || routerType == RouterType.SUSHISWAP) {
            amountOut = _executeV2Swap(router, tokenIn, tokenOut, amountIn, deadline);
        } else if (routerType == RouterType.UNISWAP_V3) {
            amountOut = _executeV3Swap(router, tokenIn, tokenOut, amountIn, fee, deadline);
        } else {
            revert("MultiDEXRouter: unsupported router type");
        }
    }
    
    /**
     * @notice Execute Uniswap V2 style swap
     */
    function _executeV2Swap(
        address router,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 deadline
    ) internal returns (uint256 amountOut) {
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        
        uint256[] memory amounts = IUniswapV2Router(router).swapExactTokensForTokens(
            amountIn,
            0, // Accept any amount of tokens out
            path,
            address(this),
            deadline
        );
        
        amountOut = amounts[amounts.length - 1];
    }
    
    /**
     * @notice Execute Uniswap V3 swap
     */
    function _executeV3Swap(
        address router,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint24 fee,
        uint256 deadline
    ) internal returns (uint256 amountOut) {
        IUniswapV3Router.ExactInputSingleParams memory params = IUniswapV3Router.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: fee,
            recipient: address(this),
            deadline: deadline,
            amountIn: amountIn,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });
        
        amountOut = IUniswapV3Router(router).exactInputSingle(params);
    }
    
    /**
     * @notice Get amount out for a given router
     */
    function _getAmountOut(
        address router,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint24 fee
    ) internal view returns (uint256 amountOut) {
        RouterType routerType = routers[router].routerType;
        
        if (routerType == RouterType.UNISWAP_V2 || routerType == RouterType.SUSHISWAP) {
            address[] memory path = new address[](2);
            path[0] = tokenIn;
            path[1] = tokenOut;
            
            try IUniswapV2Router(router).getAmountsOut(amountIn, path) returns (uint256[] memory amounts) {
                amountOut = amounts[amounts.length - 1];
            } catch {
                amountOut = 0;
            }
        } else {
            // For V3 and other routers, return a mock value
            // In production, this would use quoter contracts
            amountOut = amountIn; // Simplified
        }
    }
    
    /**
     * @notice Estimate gas for router
     */
    function _estimateGasForRouter(address router) internal view returns (uint256 gasEstimate) {
        RouterType routerType = routers[router].routerType;
        
        if (routerType == RouterType.UNISWAP_V2 || routerType == RouterType.SUSHISWAP) {
            gasEstimate = 150000;
        } else if (routerType == RouterType.UNISWAP_V3) {
            gasEstimate = 180000;
        } else {
            gasEstimate = 200000;
        }
    }
    
    /**
     * @notice Get default fee rate for router type
     */
    function _getDefaultFeeRate(RouterType routerType) internal pure returns (uint256 feeRate) {
        if (routerType == RouterType.UNISWAP_V2) {
            feeRate = 30; // 0.3%
        } else if (routerType == RouterType.UNISWAP_V3) {
            feeRate = 30; // 0.3% (can vary)
        } else if (routerType == RouterType.SUSHISWAP) {
            feeRate = 30; // 0.3%
        } else {
            feeRate = 30; // Default 0.3%
        }
    }
    
    /**
     * @notice Validate multi-swap parameters
     */
    function _validateMultiSwapParams(MultiSwapParams calldata params) 
        internal 
        view 
        returns (bool isValid) 
    {
        return params.path.tokens.length >= 2 &&
               params.path.tokens.length <= MAX_PATH_LENGTH &&
               params.path.routers.length == params.path.tokens.length - 1 &&
               params.path.fees.length == params.path.routers.length &&
               params.amountIn > 0 &&
               params.deadline > block.timestamp &&
               params.recipient != address(0);
    }
    
    /**
     * @notice Emergency token recovery
     */
    function emergencyTokenRecovery(address token, uint256 amount) 
        external 
        onlyOwner 
        onlyInEmergencyStop 
    {
        require(token != address(0), "MultiDEXRouter: invalid token");
        IERC20(token).transfer(owner, amount);
    }
}