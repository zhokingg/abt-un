// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IERC20.sol";
import "./interfaces/IUniswapV2Router.sol";
import "./interfaces/IUniswapV3Router.sol";
import "./security/EmergencyStop.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ArbitrageExecutor
 * @notice Multi-hop, multi-DEX arbitrage executor with gas optimization and MEV protection hooks
 * @dev Executes complex arbitrage strategies across Uniswap V2/V3, SushiSwap, and other AMMs
 * @custom:security-contact security@example.com
 */
contract ArbitrageExecutor is EmergencyStop, ReentrancyGuard, Pausable {
    
    /// @notice DEX types supported
    enum DEXType {
        UNISWAP_V2,
        UNISWAP_V3,
        SUSHISWAP,
        CURVE,
        BALANCER
    }
    
    /// @notice Single swap hop in arbitrage route
    struct SwapHop {
        DEXType dexType;
        address router;
        address tokenIn;
        address tokenOut;
        uint24 fee;          // For V3 pools (3000 = 0.3%)
        bytes extraData;     // Protocol-specific data
    }
    
    /// @notice Complete arbitrage route configuration
    struct ArbitrageRoute {
        SwapHop[] hops;
        uint256 amountIn;
        uint256 minAmountOut;
        uint256 deadline;
        address recipient;
    }
    
    /// @notice Execution result details
    struct ExecutionResult {
        bool success;
        uint256 amountOut;
        uint256 gasUsed;
        uint256 profit;
        string errorMessage;
    }
    
    /// @notice Slippage protection configuration
    struct SlippageConfig {
        uint256 maxSlippageBps;    // Maximum slippage in basis points
        uint256 minProfitBps;      // Minimum profit in basis points
        bool enableDynamicSlippage; // Enable dynamic slippage based on volatility
    }
    
    /// @notice Registered DEX routers
    mapping(DEXType => mapping(address => bool)) public registeredRouters;
    
    /// @notice Global slippage configuration
    SlippageConfig public slippageConfig;
    
    /// @notice MEV protection relay address
    address public mevProtectionRelay;
    
    /// @notice Constants
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MAX_HOPS = 5;
    uint256 public constant MAX_SLIPPAGE_BPS = 500; // 5%
    uint256 public constant MIN_PROFIT_BPS = 10;    // 0.1%
    
    /// @notice Gas optimization threshold
    uint256 public gasOptimizationThreshold = 200000;
    
    /// @notice Events for monitoring and analytics
    event ArbitrageExecuted(
        address indexed executor,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 profit,
        uint256 gasUsed
    );
    
    event ArbitrageFailed(
        address indexed executor,
        address tokenIn,
        uint256 amountIn,
        string reason
    );
    
    event RouteExecuted(
        uint256 indexed routeId,
        uint256 hopsExecuted,
        uint256 totalGasUsed
    );
    
    event DEXRouterRegistered(
        DEXType indexed dexType,
        address indexed router,
        bool status
    );
    
    event SlippageConfigUpdated(
        uint256 maxSlippageBps,
        uint256 minProfitBps,
        bool enableDynamicSlippage
    );
    
    event MEVProtectionRelayUpdated(
        address indexed oldRelay,
        address indexed newRelay
    );
    
    /**
     * @notice Constructor to initialize the arbitrage executor
     */
    constructor() {
        _initializeDefaultRouters();
        _initializeSlippageConfig();
    }
    
    /**
     * @notice Execute arbitrage through multiple DEX hops
     * @dev Main entry point for arbitrage execution
     * @param route Complete arbitrage route configuration
     * @return result Execution result with profit and gas data
     */
    function executeArbitrage(ArbitrageRoute calldata route)
        external
        nonReentrant
        notInEmergencyStop
        whenNotPaused
        onlyOperator
        returns (ExecutionResult memory result)
    {
        uint256 gasStart = gasleft();
        
        // Validate route
        require(_validateRoute(route), "ArbitrageExecutor: invalid route");
        
        // Execute arbitrage
        try this._executeArbitrageInternal(route) returns (uint256 finalAmount) {
            result.success = true;
            result.amountOut = finalAmount;
            result.profit = finalAmount > route.amountIn ? finalAmount - route.amountIn : 0;
            
            // Ensure minimum profit
            uint256 minProfit = (route.amountIn * slippageConfig.minProfitBps) / BASIS_POINTS;
            require(result.profit >= minProfit, "ArbitrageExecutor: insufficient profit");
            
            emit ArbitrageExecuted(
                msg.sender,
                route.hops[0].tokenIn,
                route.hops[route.hops.length - 1].tokenOut,
                route.amountIn,
                result.amountOut,
                result.profit,
                gasStart - gasleft()
            );
        } catch Error(string memory reason) {
            result.success = false;
            result.errorMessage = reason;
            
            emit ArbitrageFailed(
                msg.sender,
                route.hops[0].tokenIn,
                route.amountIn,
                reason
            );
        }
        
        result.gasUsed = gasStart - gasleft();
    }
    
    /**
     * @notice Internal arbitrage execution
     * @dev External for try/catch pattern
     * @param route Arbitrage route
     * @return finalAmount Final output amount
     */
    function _executeArbitrageInternal(ArbitrageRoute calldata route)
        external
        returns (uint256 finalAmount)
    {
        require(msg.sender == address(this), "ArbitrageExecutor: internal only");
        
        uint256 currentAmount = route.amountIn;
        address currentToken = route.hops[0].tokenIn;
        
        // Execute each hop in the route
        for (uint256 i = 0; i < route.hops.length; i++) {
            SwapHop memory hop = route.hops[i];
            
            // Verify token consistency
            require(hop.tokenIn == currentToken, "ArbitrageExecutor: token mismatch");
            
            // Execute swap based on DEX type
            currentAmount = _executeSwap(hop, currentAmount, route.deadline);
            currentToken = hop.tokenOut;
        }
        
        // Verify final amount meets minimum
        require(currentAmount >= route.minAmountOut, "ArbitrageExecutor: slippage too high");
        
        return currentAmount;
    }
    
    /**
     * @notice Execute single swap on specified DEX
     * @dev Routes to appropriate DEX implementation
     * @param hop Swap hop configuration
     * @param amountIn Input amount
     * @param deadline Transaction deadline
     * @return amountOut Output amount
     */
    function _executeSwap(
        SwapHop memory hop,
        uint256 amountIn,
        uint256 deadline
    ) internal returns (uint256 amountOut) {
        require(registeredRouters[hop.dexType][hop.router], "ArbitrageExecutor: router not registered");
        
        if (hop.dexType == DEXType.UNISWAP_V2 || hop.dexType == DEXType.SUSHISWAP) {
            return _executeV2Swap(hop, amountIn, deadline);
        } else if (hop.dexType == DEXType.UNISWAP_V3) {
            return _executeV3Swap(hop, amountIn, deadline);
        } else {
            revert("ArbitrageExecutor: unsupported DEX type");
        }
    }
    
    /**
     * @notice Execute Uniswap V2 style swap
     * @dev Handles Uniswap V2 and SushiSwap
     * @param hop Swap hop
     * @param amountIn Input amount
     * @param deadline Transaction deadline
     * @return amountOut Output amount
     */
    function _executeV2Swap(
        SwapHop memory hop,
        uint256 amountIn,
        uint256 deadline
    ) internal returns (uint256 amountOut) {
        IUniswapV2Router router = IUniswapV2Router(hop.router);
        
        // Approve router to spend tokens
        IERC20(hop.tokenIn).approve(hop.router, amountIn);
        
        // Build path
        address[] memory path = new address[](2);
        path[0] = hop.tokenIn;
        path[1] = hop.tokenOut;
        
        // Calculate minimum output with slippage
        uint256 minAmountOut = _calculateMinAmountOut(amountIn, slippageConfig.maxSlippageBps);
        
        // Execute swap
        uint256[] memory amounts = router.swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            address(this),
            deadline
        );
        
        return amounts[amounts.length - 1];
    }
    
    /**
     * @notice Execute Uniswap V3 swap
     * @dev Handles Uniswap V3 exact input single
     * @param hop Swap hop
     * @param amountIn Input amount
     * @param deadline Transaction deadline
     * @return amountOut Output amount
     */
    function _executeV3Swap(
        SwapHop memory hop,
        uint256 amountIn,
        uint256 deadline
    ) internal returns (uint256 amountOut) {
        IUniswapV3Router router = IUniswapV3Router(hop.router);
        
        // Approve router to spend tokens
        IERC20(hop.tokenIn).approve(hop.router, amountIn);
        
        // Calculate minimum output with slippage
        uint256 minAmountOut = _calculateMinAmountOut(amountIn, slippageConfig.maxSlippageBps);
        
        // Execute swap
        IUniswapV3Router.ExactInputSingleParams memory params = IUniswapV3Router.ExactInputSingleParams({
            tokenIn: hop.tokenIn,
            tokenOut: hop.tokenOut,
            fee: hop.fee,
            recipient: address(this),
            deadline: deadline,
            amountIn: amountIn,
            amountOutMinimum: minAmountOut,
            sqrtPriceLimitX96: 0
        });
        
        return router.exactInputSingle(params);
    }
    
    /**
     * @notice Validate arbitrage route
     * @dev Checks route parameters for validity
     * @param route Route to validate
     * @return isValid Whether route is valid
     */
    function _validateRoute(ArbitrageRoute calldata route)
        internal
        view
        returns (bool isValid)
    {
        if (route.hops.length == 0 || route.hops.length > MAX_HOPS) return false;
        if (route.amountIn == 0) return false;
        if (route.minAmountOut == 0) return false;
        if (route.deadline <= block.timestamp) return false;
        
        // Validate each hop
        for (uint256 i = 0; i < route.hops.length; i++) {
            SwapHop memory hop = route.hops[i];
            if (hop.tokenIn == address(0) || hop.tokenOut == address(0)) return false;
            if (hop.router == address(0)) return false;
            if (!registeredRouters[hop.dexType][hop.router]) return false;
        }
        
        // Verify circular route (arbitrage should end with same token)
        if (route.hops[0].tokenIn != route.hops[route.hops.length - 1].tokenOut) return false;
        
        return true;
    }
    
    /**
     * @notice Calculate minimum output amount with slippage protection
     * @param amountIn Input amount
     * @param slippageBps Slippage in basis points
     * @return minAmountOut Minimum acceptable output
     */
    function _calculateMinAmountOut(uint256 amountIn, uint256 slippageBps)
        internal
        pure
        returns (uint256 minAmountOut)
    {
        return amountIn - ((amountIn * slippageBps) / BASIS_POINTS);
    }
    
    /**
     * @notice Initialize default DEX routers
     * @dev Sets up mainnet router addresses
     */
    function _initializeDefaultRouters() internal {
        // Uniswap V2
        address uniV2Router = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
        registeredRouters[DEXType.UNISWAP_V2][uniV2Router] = true;
        emit DEXRouterRegistered(DEXType.UNISWAP_V2, uniV2Router, true);
        
        // Uniswap V3
        address uniV3Router = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
        registeredRouters[DEXType.UNISWAP_V3][uniV3Router] = true;
        emit DEXRouterRegistered(DEXType.UNISWAP_V3, uniV3Router, true);
        
        // SushiSwap
        address sushiRouter = 0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F;
        registeredRouters[DEXType.SUSHISWAP][sushiRouter] = true;
        emit DEXRouterRegistered(DEXType.SUSHISWAP, sushiRouter, true);
    }
    
    /**
     * @notice Initialize slippage configuration
     * @dev Sets default slippage parameters
     */
    function _initializeSlippageConfig() internal {
        slippageConfig = SlippageConfig({
            maxSlippageBps: 100,        // 1%
            minProfitBps: 50,           // 0.5%
            enableDynamicSlippage: false
        });
    }
    
    /**
     * @notice Register or update DEX router
     * @dev Only callable by owner
     * @param dexType Type of DEX
     * @param router Router address
     * @param status Active status
     */
    function registerRouter(
        DEXType dexType,
        address router,
        bool status
    ) external onlyOwner {
        require(router != address(0), "ArbitrageExecutor: invalid router");
        
        registeredRouters[dexType][router] = status;
        emit DEXRouterRegistered(dexType, router, status);
    }
    
    /**
     * @notice Update slippage configuration
     * @dev Only callable by owner
     * @param maxSlippageBps Maximum slippage
     * @param minProfitBps Minimum profit
     * @param enableDynamicSlippage Enable dynamic slippage
     */
    function updateSlippageConfig(
        uint256 maxSlippageBps,
        uint256 minProfitBps,
        bool enableDynamicSlippage
    ) external onlyOwner {
        require(maxSlippageBps <= MAX_SLIPPAGE_BPS, "ArbitrageExecutor: slippage too high");
        require(minProfitBps >= MIN_PROFIT_BPS, "ArbitrageExecutor: profit too low");
        
        slippageConfig.maxSlippageBps = maxSlippageBps;
        slippageConfig.minProfitBps = minProfitBps;
        slippageConfig.enableDynamicSlippage = enableDynamicSlippage;
        
        emit SlippageConfigUpdated(maxSlippageBps, minProfitBps, enableDynamicSlippage);
    }
    
    /**
     * @notice Set MEV protection relay address
     * @dev Used for Flashbots/private relay integration
     * @param relay Relay address
     */
    function setMEVProtectionRelay(address relay) external onlyOwner {
        require(relay != address(0), "ArbitrageExecutor: invalid relay");
        
        address oldRelay = mevProtectionRelay;
        mevProtectionRelay = relay;
        
        emit MEVProtectionRelayUpdated(oldRelay, relay);
    }
    
    /**
     * @notice Emergency token rescue
     * @dev Only callable when paused
     * @param token Token to rescue
     * @param amount Amount to rescue
     * @param recipient Recipient address
     */
    function emergencyTokenRescue(
        address token,
        uint256 amount,
        address recipient
    ) external onlyOwner whenPaused {
        require(token != address(0), "ArbitrageExecutor: invalid token");
        require(recipient != address(0), "ArbitrageExecutor: invalid recipient");
        require(amount > 0, "ArbitrageExecutor: invalid amount");
        
        IERC20(token).transfer(recipient, amount);
    }
    
    /**
     * @notice Pause contract
     * @dev Emergency pause mechanism
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause contract
     * @dev Resume operations
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Get router status
     * @param dexType DEX type
     * @param router Router address
     * @return isRegistered Whether router is registered
     */
    function isRouterRegistered(DEXType dexType, address router)
        external
        view
        returns (bool isRegistered)
    {
        return registeredRouters[dexType][router];
    }
    
    /**
     * @notice Estimate gas for route
     * @dev Provides gas estimate for arbitrage execution
     * @param route Route to estimate
     * @return estimatedGas Estimated gas cost
     */
    function estimateGas(ArbitrageRoute calldata route)
        external
        view
        returns (uint256 estimatedGas)
    {
        // Base gas cost
        uint256 baseGas = 100000;
        
        // Add per-hop gas cost
        uint256 perHopGas = 150000;
        estimatedGas = baseGas + (route.hops.length * perHopGas);
        
        return estimatedGas;
    }
}
