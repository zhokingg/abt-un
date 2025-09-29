// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IERC20.sol";
import "../security/EmergencyStop.sol";
import "../oracle/PriceOracle.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RiskManager
 * @notice On-chain risk management and circuit breakers
 * @dev Manages risk parameters and circuit breakers for arbitrage operations
 */
contract RiskManager is EmergencyStop, ReentrancyGuard {
    PriceOracle public priceOracle;
    
    struct RiskParameters {
        uint256 maxTradeAmount;        // Maximum trade amount per transaction
        uint256 maxDailyVolume;        // Maximum daily trading volume
        uint256 maxSlippageBps;        // Maximum allowed slippage in basis points
        uint256 minProfitBps;          // Minimum profit requirement in basis points
        uint256 maxGasPrice;           // Maximum gas price allowed
        uint256 cooldownPeriod;        // Cooldown between trades
        bool isActive;                 // Whether risk parameters are active
    }
    
    struct DailyVolume {
        uint256 volume;
        uint256 lastResetTimestamp;
    }
    
    struct TradeHistory {
        uint256 lastTradeTimestamp;
        uint256 consecutiveSuccesses;
        uint256 consecutiveFailures;
        uint256 totalTrades;
        uint256 totalProfit;
        uint256 totalLoss;
    }
    
    struct CircuitBreaker {
        uint256 threshold;             // Threshold for triggering
        uint256 duration;              // How long circuit breaker stays active
        uint256 triggeredAt;           // When it was last triggered
        bool isActive;                 // Whether circuit breaker is currently active
        string reason;                 // Reason for circuit breaker
    }
    
    // Token address => Risk parameters
    mapping(address => RiskParameters) public tokenRiskParams;
    
    // Token address => Daily volume tracking
    mapping(address => DailyVolume) public dailyVolumes;
    
    // User address => Trade history
    mapping(address => TradeHistory) public tradeHistories;
    
    // Circuit breakers by type
    mapping(string => CircuitBreaker) public circuitBreakers;
    
    // Allowed tokens for trading
    mapping(address => bool) public allowedTokens;
    
    // Global risk parameters
    uint256 public globalMaxTradeAmount = 100000 * 1e6; // $100k USDC
    uint256 public globalMaxDailyVolume = 1000000 * 1e6; // $1M USDC
    uint256 public maxConsecutiveFailures = 5;
    uint256 public maxTotalLossPercentage = 1000; // 10%
    
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant DAY_IN_SECONDS = 86400;
    
    event RiskParametersUpdated(
        address indexed token,
        uint256 maxTradeAmount,
        uint256 maxDailyVolume,
        uint256 maxSlippageBps
    );
    
    event CircuitBreakerTriggered(
        string indexed breakerType,
        string reason,
        uint256 duration
    );
    
    event CircuitBreakerReset(string indexed breakerType);
    
    event TradeRejected(
        address indexed user,
        address indexed token,
        uint256 amount,
        string reason
    );
    
    event RiskViolation(
        address indexed user,
        string violationType,
        uint256 value,
        uint256 threshold
    );
    
    modifier onlyWhenSafe() {
        require(!_isAnyCircuitBreakerActive(), "RiskManager: circuit breaker active");
        _;
    }
    
    constructor(address _priceOracle) {
        require(_priceOracle != address(0), "RiskManager: invalid oracle");
        priceOracle = PriceOracle(_priceOracle);
        
        // Initialize default circuit breakers
        _initializeCircuitBreakers();
    }
    
    /**
     * @notice Validate trade before execution
     * @param user User address
     * @param token Token address
     * @param amount Trade amount
     * @param expectedProfit Expected profit
     * @param gasPrice Current gas price
     * @return isValid Whether trade passes risk checks
     * @return reason Reason if trade is rejected
     */
    function validateTrade(
        address user,
        address token,
        uint256 amount,
        uint256 expectedProfit,
        uint256 gasPrice
    ) external onlyWhenSafe returns (bool isValid, string memory reason) {
        
        // Check if token is allowed
        if (!allowedTokens[token]) {
            return (false, "Token not allowed");
        }
        
        // Check trade amount limits
        RiskParameters memory params = tokenRiskParams[token];
        if (params.isActive && amount > params.maxTradeAmount) {
            emit TradeRejected(user, token, amount, "Exceeds max trade amount");
            return (false, "Exceeds max trade amount");
        }
        
        if (amount > globalMaxTradeAmount) {
            emit TradeRejected(user, token, amount, "Exceeds global max trade amount");
            return (false, "Exceeds global max trade amount");
        }
        
        // Check daily volume limits
        if (!_checkDailyVolumeLimit(token, amount)) {
            emit TradeRejected(user, token, amount, "Exceeds daily volume limit");
            return (false, "Exceeds daily volume limit");
        }
        
        // Check cooldown period
        TradeHistory memory history = tradeHistories[user];
        if (params.isActive && params.cooldownPeriod > 0) {
            if (block.timestamp - history.lastTradeTimestamp < params.cooldownPeriod) {
                return (false, "Cooldown period not elapsed");
            }
        }
        
        // Check consecutive failures
        if (history.consecutiveFailures >= maxConsecutiveFailures) {
            _triggerCircuitBreaker("USER_FAILURE", "Too many consecutive failures", 3600);
            return (false, "Too many consecutive failures");
        }
        
        // Check gas price
        if (params.isActive && gasPrice > params.maxGasPrice) {
            return (false, "Gas price too high");
        }
        
        // Check minimum profit requirement
        uint256 minProfit = params.isActive ? 
            (amount * params.minProfitBps) / BASIS_POINTS : 
            (amount * 50) / BASIS_POINTS; // Default 0.5%
            
        if (expectedProfit < minProfit) {
            return (false, "Insufficient expected profit");
        }
        
        return (true, "");
    }
    
    /**
     * @notice Record trade result
     * @param user User address
     * @param token Token address
     * @param amount Trade amount
     * @param profit Actual profit (0 if loss)
     * @param success Whether trade was successful
     */
    function recordTradeResult(
        address user,
        address token,
        uint256 amount,
        uint256 profit,
        bool success
    ) external onlyOperator nonReentrant {
        
        // Update daily volume
        _updateDailyVolume(token, amount);
        
        // Update trade history
        TradeHistory storage history = tradeHistories[user];
        history.lastTradeTimestamp = block.timestamp;
        history.totalTrades++;
        
        if (success) {
            history.consecutiveSuccesses++;
            history.consecutiveFailures = 0;
            history.totalProfit += profit;
        } else {
            history.consecutiveFailures++;
            history.consecutiveSuccesses = 0;
            history.totalLoss += amount; // Assume full loss for simplicity
            
            // Check if user has exceeded loss threshold
            uint256 totalValue = history.totalProfit + history.totalLoss;
            if (totalValue > 0) {
                uint256 lossPercentage = (history.totalLoss * BASIS_POINTS) / totalValue;
                if (lossPercentage > maxTotalLossPercentage) {
                    emit RiskViolation(user, "EXCESSIVE_LOSS", lossPercentage, maxTotalLossPercentage);
                    _triggerCircuitBreaker("USER_LOSS", "Excessive loss percentage", 7200);
                }
            }
        }
    }
    
    /**
     * @notice Set risk parameters for a token
     * @param token Token address
     * @param params Risk parameters
     */
    function setTokenRiskParameters(
        address token,
        RiskParameters calldata params
    ) external onlyOwner {
        require(token != address(0), "RiskManager: invalid token");
        require(params.maxTradeAmount > 0, "RiskManager: invalid max trade amount");
        require(params.maxSlippageBps <= 1000, "RiskManager: slippage too high"); // Max 10%
        
        tokenRiskParams[token] = params;
        
        emit RiskParametersUpdated(
            token,
            params.maxTradeAmount,
            params.maxDailyVolume,
            params.maxSlippageBps
        );
    }
    
    /**
     * @notice Add allowed token
     * @param token Token address to allow
     */
    function addAllowedToken(address token) external onlyOwner {
        require(token != address(0), "RiskManager: invalid token");
        allowedTokens[token] = true;
    }
    
    /**
     * @notice Remove allowed token
     * @param token Token address to remove
     */
    function removeAllowedToken(address token) external onlyOwner {
        allowedTokens[token] = false;
    }
    
    /**
     * @notice Trigger circuit breaker manually
     * @param breakerType Type of circuit breaker
     * @param reason Reason for triggering
     * @param duration Duration in seconds
     */
    function triggerCircuitBreaker(
        string calldata breakerType,
        string calldata reason,
        uint256 duration
    ) external onlyOwner {
        _triggerCircuitBreaker(breakerType, reason, duration);
    }
    
    /**
     * @notice Reset circuit breaker
     * @param breakerType Type of circuit breaker to reset
     */
    function resetCircuitBreaker(string calldata breakerType) external onlyOwner {
        CircuitBreaker storage breaker = circuitBreakers[breakerType];
        breaker.isActive = false;
        breaker.triggeredAt = 0;
        
        emit CircuitBreakerReset(breakerType);
    }
    
    /**
     * @notice Get user trade statistics
     * @param user User address
     * @return history Trade history
     */
    function getUserTradeHistory(address user) 
        external 
        view 
        returns (TradeHistory memory history) 
    {
        history = tradeHistories[user];
    }
    
    /**
     * @notice Check if any circuit breaker is active
     * @return isActive Whether any circuit breaker is active
     */
    function isAnyCircuitBreakerActive() external view returns (bool isActive) {
        return _isAnyCircuitBreakerActive();
    }
    
    /**
     * @notice Get circuit breaker status
     * @param breakerType Circuit breaker type
     * @return breaker Circuit breaker info
     */
    function getCircuitBreaker(string calldata breakerType) 
        external 
        view 
        returns (CircuitBreaker memory breaker) 
    {
        breaker = circuitBreakers[breakerType];
    }
    
    /**
     * @notice Set global risk parameters
     * @param maxTradeAmount Global max trade amount
     * @param maxDailyVolume Global max daily volume
     */
    function setGlobalRiskParameters(
        uint256 maxTradeAmount,
        uint256 maxDailyVolume
    ) external onlyOwner {
        require(maxTradeAmount > 0, "RiskManager: invalid trade amount");
        require(maxDailyVolume > maxTradeAmount, "RiskManager: invalid daily volume");
        
        globalMaxTradeAmount = maxTradeAmount;
        globalMaxDailyVolume = maxDailyVolume;
    }
    
    /**
     * @notice Update price oracle
     * @param newOracle New oracle address
     */
    function updatePriceOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "RiskManager: invalid oracle");
        priceOracle = PriceOracle(newOracle);
    }
    
    /**
     * @notice Initialize default circuit breakers
     */
    function _initializeCircuitBreakers() internal {
        circuitBreakers["PRICE_VOLATILITY"] = CircuitBreaker({
            threshold: 500, // 5% price deviation
            duration: 1800, // 30 minutes
            triggeredAt: 0,
            isActive: false,
            reason: ""
        });
        
        circuitBreakers["HIGH_GAS"] = CircuitBreaker({
            threshold: 100 gwei,
            duration: 3600, // 1 hour
            triggeredAt: 0,
            isActive: false,
            reason: ""
        });
        
        circuitBreakers["USER_FAILURE"] = CircuitBreaker({
            threshold: maxConsecutiveFailures,
            duration: 3600, // 1 hour
            triggeredAt: 0,
            isActive: false,
            reason: ""
        });
    }
    
    /**
     * @notice Check daily volume limit
     * @param token Token address
     * @param amount Amount to add
     * @return withinLimit Whether within daily limit
     */
    function _checkDailyVolumeLimit(address token, uint256 amount) 
        internal 
        view 
        returns (bool withinLimit) 
    {
        DailyVolume memory daily = dailyVolumes[token];
        
        // Reset if new day
        if (block.timestamp - daily.lastResetTimestamp >= DAY_IN_SECONDS) {
            return amount <= _getDailyVolumeLimit(token);
        }
        
        return (daily.volume + amount) <= _getDailyVolumeLimit(token);
    }
    
    /**
     * @notice Update daily volume
     * @param token Token address
     * @param amount Amount to add
     */
    function _updateDailyVolume(address token, uint256 amount) internal {
        DailyVolume storage daily = dailyVolumes[token];
        
        // Reset if new day
        if (block.timestamp - daily.lastResetTimestamp >= DAY_IN_SECONDS) {
            daily.volume = amount;
            daily.lastResetTimestamp = block.timestamp;
        } else {
            daily.volume += amount;
        }
    }
    
    /**
     * @notice Get daily volume limit for token
     * @param token Token address
     * @return limit Daily volume limit
     */
    function _getDailyVolumeLimit(address token) internal view returns (uint256 limit) {
        RiskParameters memory params = tokenRiskParams[token];
        if (params.isActive && params.maxDailyVolume > 0) {
            limit = params.maxDailyVolume;
        } else {
            limit = globalMaxDailyVolume;
        }
    }
    
    /**
     * @notice Trigger circuit breaker
     * @param breakerType Type of circuit breaker
     * @param reason Reason for triggering
     * @param duration Duration in seconds
     */
    function _triggerCircuitBreaker(
        string memory breakerType,
        string memory reason,
        uint256 duration
    ) internal {
        CircuitBreaker storage breaker = circuitBreakers[breakerType];
        breaker.isActive = true;
        breaker.triggeredAt = block.timestamp;
        breaker.duration = duration;
        breaker.reason = reason;
        
        emit CircuitBreakerTriggered(breakerType, reason, duration);
    }
    
    /**
     * @notice Check if any circuit breaker is active
     * @return isActive Whether any circuit breaker is active
     */
    function _isAnyCircuitBreakerActive() internal view returns (bool isActive) {
        string[3] memory breakerTypes = ["PRICE_VOLATILITY", "HIGH_GAS", "USER_FAILURE"];
        
        for (uint256 i = 0; i < breakerTypes.length; i++) {
            CircuitBreaker memory breaker = circuitBreakers[breakerTypes[i]];
            if (breaker.isActive && 
                (block.timestamp - breaker.triggeredAt) < breaker.duration) {
                return true;
            }
        }
        
        return false;
    }
}