// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IERC20.sol";
import "./security/EmergencyStop.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title MEVProtectedExecutor
 * @notice MEV-protected transaction executor with Flashbots and private relay integration
 * @dev Provides front-running protection, slippage control, and circuit breakers
 * @custom:security-contact security@example.com
 */
contract MEVProtectedExecutor is EmergencyStop, ReentrancyGuard, Pausable {
    
    /// @notice Transaction bundle status
    enum BundleStatus {
        PENDING,
        SUBMITTED,
        INCLUDED,
        FAILED,
        CANCELLED
    }
    
    /// @notice MEV protection strategy
    enum ProtectionStrategy {
        FLASHBOTS,
        PRIVATE_RELAY,
        PUBLIC_MEMPOOL,
        HYBRID
    }
    
    /// @notice Bundle transaction structure
    struct BundleTransaction {
        address target;
        bytes data;
        uint256 value;
        uint256 gasLimit;
        uint256 maxPriorityFee;
        uint256 maxFeePerGas;
    }
    
    /// @notice Bundle submission parameters
    struct Bundle {
        uint256 bundleId;
        BundleTransaction[] transactions;
        uint256 targetBlock;
        uint256 minTimestamp;
        uint256 maxTimestamp;
        uint256 revertingTxHashes;
        BundleStatus status;
        ProtectionStrategy strategy;
    }
    
    /// @notice Slippage protection configuration
    struct SlippageProtection {
        uint256 maxSlippageBps;
        uint256 priceImpactThreshold;
        uint256 frontRunCheckWindow;
        bool enabled;
    }
    
    /// @notice Circuit breaker configuration
    struct CircuitBreaker {
        uint256 maxFailures;
        uint256 windowDuration;
        uint256 cooldownPeriod;
        uint256 lastTriggerTime;
        uint256 failureCount;
        bool isTripped;
    }
    
    /// @notice Role-based access control roles
    bytes32 public constant RELAY_OPERATOR_ROLE = keccak256("RELAY_OPERATOR_ROLE");
    bytes32 public constant BUNDLE_SUBMITTER_ROLE = keccak256("BUNDLE_SUBMITTER_ROLE");
    
    /// @notice Registered private relays
    mapping(address => bool) public authorizedRelays;
    
    /// @notice Bundle tracking
    mapping(uint256 => Bundle) public bundles;
    uint256 public nextBundleId;
    
    /// @notice Slippage protection
    SlippageProtection public slippageProtection;
    
    /// @notice Circuit breaker state
    CircuitBreaker public circuitBreaker;
    
    /// @notice Kill switch - complete shutdown
    bool public killSwitchActivated;
    
    /// @notice MEV protection fees
    uint256 public mevProtectionFeeBps = 50; // 0.5%
    uint256 public constant MAX_MEV_FEE_BPS = 500; // 5%
    uint256 public constant BASIS_POINTS = 10000;
    
    /// @notice Treasury for collecting MEV protection fees
    address public treasury;
    
    /// @notice Events for monitoring and analytics
    event BundleSubmitted(
        uint256 indexed bundleId,
        address indexed submitter,
        uint256 targetBlock,
        ProtectionStrategy strategy,
        uint256 transactionCount
    );
    
    event BundleStatusUpdated(
        uint256 indexed bundleId,
        BundleStatus oldStatus,
        BundleStatus newStatus,
        uint256 blockNumber
    );
    
    event BundleIncluded(
        uint256 indexed bundleId,
        uint256 blockNumber,
        uint256 gasUsed,
        uint256 effectiveGasPrice
    );
    
    event BundleFailed(
        uint256 indexed bundleId,
        string reason
    );
    
    event SlippageProtectionTriggered(
        uint256 indexed bundleId,
        uint256 expectedOutput,
        uint256 actualOutput,
        uint256 slippage
    );
    
    event CircuitBreakerTripped(
        uint256 timestamp,
        uint256 failureCount,
        uint256 cooldownUntil
    );
    
    event CircuitBreakerReset(
        uint256 timestamp
    );
    
    event KillSwitchActivated(
        address indexed activator,
        uint256 timestamp
    );
    
    event KillSwitchDeactivated(
        address indexed deactivator,
        uint256 timestamp
    );
    
    event RelayAuthorized(
        address indexed relay,
        bool authorized
    );
    
    event MEVProtectionFeeUpdated(
        uint256 oldFeeBps,
        uint256 newFeeBps
    );
    
    event TreasuryUpdated(
        address indexed oldTreasury,
        address indexed newTreasury
    );
    
    /**
     * @notice Constructor
     * @param _treasury Treasury address for fee collection
     */
    constructor(address _treasury) {
        require(_treasury != address(0), "MEVProtectedExecutor: invalid treasury");
        treasury = _treasury;
        
        _initializeSlippageProtection();
        _initializeCircuitBreaker();
    }
    
    /**
     * @notice Submit MEV-protected transaction bundle
     * @dev Main entry point for protected execution
     * @param transactions Array of transactions to bundle
     * @param targetBlock Target block for inclusion
     * @param strategy MEV protection strategy
     * @return bundleId Unique bundle identifier
     */
    function submitBundle(
        BundleTransaction[] calldata transactions,
        uint256 targetBlock,
        ProtectionStrategy strategy
    )
        external
        nonReentrant
        notInEmergencyStop
        whenNotPaused
        onlyOperator
        returns (uint256 bundleId)
    {
        require(!killSwitchActivated, "MEVProtectedExecutor: kill switch active");
        require(!circuitBreaker.isTripped, "MEVProtectedExecutor: circuit breaker tripped");
        require(transactions.length > 0, "MEVProtectedExecutor: no transactions");
        require(targetBlock > block.number, "MEVProtectedExecutor: invalid target block");
        
        bundleId = nextBundleId++;
        
        // Create bundle
        Bundle storage bundle = bundles[bundleId];
        bundle.bundleId = bundleId;
        bundle.targetBlock = targetBlock;
        bundle.minTimestamp = block.timestamp;
        bundle.maxTimestamp = block.timestamp + 300; // 5 minute window
        bundle.status = BundleStatus.PENDING;
        bundle.strategy = strategy;
        
        // Copy transactions
        for (uint256 i = 0; i < transactions.length; i++) {
            bundle.transactions.push(transactions[i]);
        }
        
        emit BundleSubmitted(
            bundleId,
            msg.sender,
            targetBlock,
            strategy,
            transactions.length
        );
        
        return bundleId;
    }
    
    /**
     * @notice Execute bundle with MEV protection
     * @dev Can only be called by authorized relays
     * @param bundleId Bundle to execute
     * @return success Whether execution succeeded
     */
    function executeBundle(uint256 bundleId)
        external
        nonReentrant
        returns (bool success)
    {
        require(authorizedRelays[msg.sender], "MEVProtectedExecutor: unauthorized relay");
        require(!killSwitchActivated, "MEVProtectedExecutor: kill switch active");
        
        Bundle storage bundle = bundles[bundleId];
        require(bundle.status == BundleStatus.PENDING, "MEVProtectedExecutor: invalid status");
        require(block.number <= bundle.targetBlock, "MEVProtectedExecutor: block expired");
        
        bundle.status = BundleStatus.SUBMITTED;
        emit BundleStatusUpdated(bundleId, BundleStatus.PENDING, BundleStatus.SUBMITTED, block.number);
        
        // Execute each transaction in bundle
        for (uint256 i = 0; i < bundle.transactions.length; i++) {
            BundleTransaction memory txn = bundle.transactions[i];
            
            (bool txSuccess, ) = txn.target.call{value: txn.value, gas: txn.gasLimit}(txn.data);
            
            if (!txSuccess) {
                bundle.status = BundleStatus.FAILED;
                _recordFailure();
                emit BundleFailed(bundleId, "Transaction execution failed");
                return false;
            }
        }
        
        bundle.status = BundleStatus.INCLUDED;
        emit BundleStatusUpdated(bundleId, BundleStatus.SUBMITTED, BundleStatus.INCLUDED, block.number);
        emit BundleIncluded(bundleId, block.number, 0, tx.gasprice);
        
        return true;
    }
    
    /**
     * @notice Check and enforce slippage protection
     * @param expectedOutput Expected output amount
     * @param actualOutput Actual output amount
     * @param bundleId Associated bundle ID
     * @return withinLimits Whether slippage is within acceptable limits
     */
    function checkSlippage(
        uint256 expectedOutput,
        uint256 actualOutput,
        uint256 bundleId
    ) external view returns (bool withinLimits) {
        if (!slippageProtection.enabled) return true;
        
        if (actualOutput >= expectedOutput) return true;
        
        uint256 slippage = ((expectedOutput - actualOutput) * BASIS_POINTS) / expectedOutput;
        
        if (slippage > slippageProtection.maxSlippageBps) {
            return false;
        }
        
        return true;
    }
    
    /**
     * @notice Trigger slippage protection revert
     * @dev Called when slippage exceeds limits
     * @param bundleId Bundle that triggered protection
     * @param expectedOutput Expected output
     * @param actualOutput Actual output
     */
    function triggerSlippageProtection(
        uint256 bundleId,
        uint256 expectedOutput,
        uint256 actualOutput
    ) external onlyOperator {
        require(slippageProtection.enabled, "MEVProtectedExecutor: protection disabled");
        
        uint256 slippage = ((expectedOutput - actualOutput) * BASIS_POINTS) / expectedOutput;
        
        emit SlippageProtectionTriggered(bundleId, expectedOutput, actualOutput, slippage);
        
        // Mark bundle as failed
        Bundle storage bundle = bundles[bundleId];
        bundle.status = BundleStatus.FAILED;
        
        _recordFailure();
    }
    
    /**
     * @notice Record failure and check circuit breaker
     * @dev Internal function to track failures
     */
    function _recordFailure() internal {
        circuitBreaker.failureCount++;
        
        // Check if circuit breaker should trip
        if (circuitBreaker.failureCount >= circuitBreaker.maxFailures) {
            _tripCircuitBreaker();
        }
    }
    
    /**
     * @notice Trip circuit breaker
     * @dev Temporarily halt operations
     */
    function _tripCircuitBreaker() internal {
        circuitBreaker.isTripped = true;
        circuitBreaker.lastTriggerTime = block.timestamp;
        
        uint256 cooldownUntil = block.timestamp + circuitBreaker.cooldownPeriod;
        
        emit CircuitBreakerTripped(
            block.timestamp,
            circuitBreaker.failureCount,
            cooldownUntil
        );
    }
    
    /**
     * @notice Reset circuit breaker
     * @dev Can be called by owner or automatically after cooldown
     */
    function resetCircuitBreaker() external {
        require(
            msg.sender == owner || 
            block.timestamp >= circuitBreaker.lastTriggerTime + circuitBreaker.cooldownPeriod,
            "MEVProtectedExecutor: cannot reset yet"
        );
        
        circuitBreaker.isTripped = false;
        circuitBreaker.failureCount = 0;
        
        emit CircuitBreakerReset(block.timestamp);
    }
    
    /**
     * @notice Activate kill switch
     * @dev Emergency shutdown of all operations
     */
    function activateKillSwitch() external onlyOwner {
        require(!killSwitchActivated, "MEVProtectedExecutor: already activated");
        
        killSwitchActivated = true;
        _pause();
        
        emit KillSwitchActivated(msg.sender, block.timestamp);
    }
    
    /**
     * @notice Deactivate kill switch
     * @dev Resume operations after emergency
     */
    function deactivateKillSwitch() external onlyOwner {
        require(killSwitchActivated, "MEVProtectedExecutor: not activated");
        
        killSwitchActivated = false;
        
        emit KillSwitchDeactivated(msg.sender, block.timestamp);
    }
    
    /**
     * @notice Authorize or deauthorize relay
     * @param relay Relay address
     * @param authorized Authorization status
     */
    function setRelayAuthorization(address relay, bool authorized) external onlyOwner {
        require(relay != address(0), "MEVProtectedExecutor: invalid relay");
        
        authorizedRelays[relay] = authorized;
        
        emit RelayAuthorized(relay, authorized);
    }
    
    /**
     * @notice Update slippage protection configuration
     * @param maxSlippageBps Maximum slippage in basis points
     * @param priceImpactThreshold Price impact threshold
     * @param frontRunCheckWindow Front-run detection window
     * @param enabled Enable/disable protection
     */
    function updateSlippageProtection(
        uint256 maxSlippageBps,
        uint256 priceImpactThreshold,
        uint256 frontRunCheckWindow,
        bool enabled
    ) external onlyOwner {
        require(maxSlippageBps <= BASIS_POINTS, "MEVProtectedExecutor: invalid slippage");
        
        slippageProtection.maxSlippageBps = maxSlippageBps;
        slippageProtection.priceImpactThreshold = priceImpactThreshold;
        slippageProtection.frontRunCheckWindow = frontRunCheckWindow;
        slippageProtection.enabled = enabled;
    }
    
    /**
     * @notice Update circuit breaker configuration
     * @param maxFailures Maximum failures before trip
     * @param windowDuration Window duration for counting failures
     * @param cooldownPeriod Cooldown period after trip
     */
    function updateCircuitBreaker(
        uint256 maxFailures,
        uint256 windowDuration,
        uint256 cooldownPeriod
    ) external onlyOwner {
        require(maxFailures > 0, "MEVProtectedExecutor: invalid max failures");
        require(cooldownPeriod > 0, "MEVProtectedExecutor: invalid cooldown");
        
        circuitBreaker.maxFailures = maxFailures;
        circuitBreaker.windowDuration = windowDuration;
        circuitBreaker.cooldownPeriod = cooldownPeriod;
    }
    
    /**
     * @notice Update MEV protection fee
     * @param newFeeBps New fee in basis points
     */
    function updateMEVProtectionFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= MAX_MEV_FEE_BPS, "MEVProtectedExecutor: fee too high");
        
        uint256 oldFee = mevProtectionFeeBps;
        mevProtectionFeeBps = newFeeBps;
        
        emit MEVProtectionFeeUpdated(oldFee, newFeeBps);
    }
    
    /**
     * @notice Update treasury address
     * @param newTreasury New treasury address
     */
    function updateTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "MEVProtectedExecutor: invalid treasury");
        
        address oldTreasury = treasury;
        treasury = newTreasury;
        
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }
    
    /**
     * @notice Cancel pending bundle
     * @param bundleId Bundle to cancel
     */
    function cancelBundle(uint256 bundleId) external {
        Bundle storage bundle = bundles[bundleId];
        require(bundle.status == BundleStatus.PENDING, "MEVProtectedExecutor: cannot cancel");
        
        bundle.status = BundleStatus.CANCELLED;
        emit BundleStatusUpdated(bundleId, BundleStatus.PENDING, BundleStatus.CANCELLED, block.number);
    }
    
    /**
     * @notice Initialize slippage protection
     * @dev Sets default values
     */
    function _initializeSlippageProtection() internal {
        slippageProtection = SlippageProtection({
            maxSlippageBps: 100,            // 1%
            priceImpactThreshold: 200,      // 2%
            frontRunCheckWindow: 3,         // 3 blocks
            enabled: true
        });
    }
    
    /**
     * @notice Initialize circuit breaker
     * @dev Sets default values
     */
    function _initializeCircuitBreaker() internal {
        circuitBreaker = CircuitBreaker({
            maxFailures: 5,
            windowDuration: 1 hours,
            cooldownPeriod: 30 minutes,
            lastTriggerTime: 0,
            failureCount: 0,
            isTripped: false
        });
    }
    
    /**
     * @notice Get bundle details
     * @param bundleId Bundle ID
     * @return bundle Bundle details
     */
    function getBundle(uint256 bundleId) 
        external 
        view 
        returns (Bundle memory bundle) 
    {
        return bundles[bundleId];
    }
    
    /**
     * @notice Check if bundle can be executed
     * @param bundleId Bundle ID
     * @return canExecute Whether bundle can be executed
     */
    function canExecuteBundle(uint256 bundleId) 
        external 
        view 
        returns (bool canExecute) 
    {
        Bundle storage bundle = bundles[bundleId];
        
        return !killSwitchActivated &&
               !circuitBreaker.isTripped &&
               bundle.status == BundleStatus.PENDING &&
               block.number <= bundle.targetBlock &&
               block.timestamp >= bundle.minTimestamp &&
               block.timestamp <= bundle.maxTimestamp;
    }
    
    /**
     * @notice Pause contract
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Emergency token rescue
     * @param token Token address
     * @param amount Amount to rescue
     * @param recipient Recipient address
     */
    function emergencyTokenRescue(
        address token,
        uint256 amount,
        address recipient
    ) external onlyOwner whenPaused {
        require(token != address(0), "MEVProtectedExecutor: invalid token");
        require(recipient != address(0), "MEVProtectedExecutor: invalid recipient");
        
        IERC20(token).transfer(recipient, amount);
    }
}
