// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IERC20.sol";
import "../security/EmergencyStop.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FeeManager
 * @notice Fee collection and distribution mechanism
 * @dev Manages protocol fees, performance fees, and fee distribution
 */
contract FeeManager is EmergencyStop, ReentrancyGuard {
    struct FeeStructure {
        uint256 protocolFeeBps;      // Protocol fee in basis points
        uint256 performanceFeeBps;   // Performance fee in basis points
        uint256 gasFeeBps;           // Gas fee in basis points
        uint256 minimumFee;          // Minimum fee amount
        bool isActive;               // Whether fee structure is active
    }
    
    struct FeeRecipient {
        address recipient;
        uint256 sharePercentage;     // Share percentage (0-10000)
        bool isActive;
    }
    
    struct FeeCollection {
        uint256 totalCollected;
        uint256 totalDistributed;
        uint256 lastDistribution;
        mapping(address => uint256) tokenBalances;
    }
    
    // Token address => Fee structure
    mapping(address => FeeStructure) public tokenFeeStructures;
    
    // Fee recipients array
    FeeRecipient[] public feeRecipients;
    
    // Fee collections by token
    mapping(address => FeeCollection) internal feeCollections;
    
    // User => Token => Accumulated fees
    mapping(address => mapping(address => uint256)) public userFees;
    
    // Performance tracking
    mapping(address => uint256) public totalFeesGenerated;
    mapping(address => uint256) public lastFeeUpdate;
    
    // Default fee structure
    FeeStructure public defaultFeeStructure;
    
    // Constants
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MAX_PROTOCOL_FEE = 500;  // 5%
    uint256 public constant MAX_PERFORMANCE_FEE = 2000; // 20%
    uint256 public constant MIN_DISTRIBUTION_INTERVAL = 86400; // 24 hours
    
    // Events
    event FeeCollected(
        address indexed token,
        address indexed user,
        uint256 amount,
        string feeType
    );
    
    event FeesDistributed(
        address indexed token,
        uint256 totalAmount,
        uint256 timestamp
    );
    
    event FeeStructureUpdated(
        address indexed token,
        uint256 protocolFeeBps,
        uint256 performanceFeeBps,
        uint256 gasFeeBps
    );
    
    event FeeRecipientUpdated(
        uint256 indexed index,
        address recipient,
        uint256 sharePercentage
    );
    
    event UserFeeWithdrawn(
        address indexed user,
        address indexed token,
        uint256 amount
    );
    
    constructor() {
        // Initialize default fee structure
        defaultFeeStructure = FeeStructure({
            protocolFeeBps: 100,      // 1%
            performanceFeeBps: 1000,  // 10%
            gasFeeBps: 50,            // 0.5%
            minimumFee: 1e15,         // 0.001 ETH equivalent
            isActive: true
        });
        
        // Add owner as initial fee recipient
        feeRecipients.push(FeeRecipient({
            recipient: owner,
            sharePercentage: BASIS_POINTS, // 100%
            isActive: true
        }));
    }
    
    /**
     * @notice Collect protocol fee
     * @param token Token address
     * @param user User address
     * @param tradeAmount Trade amount
     * @return feeAmount Fee amount collected
     */
    function collectProtocolFee(
        address token,
        address user,
        uint256 tradeAmount
    ) external onlyOperator nonReentrant returns (uint256 feeAmount) {
        
        FeeStructure memory feeStructure = _getFeeStructure(token);
        
        feeAmount = (tradeAmount * feeStructure.protocolFeeBps) / BASIS_POINTS;
        
        if (feeAmount < feeStructure.minimumFee) {
            feeAmount = feeStructure.minimumFee;
        }
        
        // Collect fee
        _collectFee(token, user, feeAmount, "PROTOCOL");
        
        emit FeeCollected(token, user, feeAmount, "PROTOCOL");
    }
    
    /**
     * @notice Collect performance fee
     * @param token Token address
     * @param user User address
     * @param profit Profit amount
     * @return feeAmount Fee amount collected
     */
    function collectPerformanceFee(
        address token,
        address user,
        uint256 profit
    ) external onlyOperator nonReentrant returns (uint256 feeAmount) {
        
        if (profit == 0) return 0;
        
        FeeStructure memory feeStructure = _getFeeStructure(token);
        
        feeAmount = (profit * feeStructure.performanceFeeBps) / BASIS_POINTS;
        
        // Collect fee
        _collectFee(token, user, feeAmount, "PERFORMANCE");
        
        emit FeeCollected(token, user, feeAmount, "PERFORMANCE");
    }
    
    /**
     * @notice Collect gas fee
     * @param token Token address
     * @param user User address
     * @param gasUsed Gas used in transaction
     * @param gasPrice Gas price
     * @return feeAmount Fee amount collected
     */
    function collectGasFee(
        address token,
        address user,
        uint256 gasUsed,
        uint256 gasPrice
    ) external onlyOperator nonReentrant returns (uint256 feeAmount) {
        
        FeeStructure memory feeStructure = _getFeeStructure(token);
        
        uint256 gasCost = gasUsed * gasPrice;
        feeAmount = (gasCost * feeStructure.gasFeeBps) / BASIS_POINTS;
        
        // Collect fee
        _collectFee(token, user, feeAmount, "GAS");
        
        emit FeeCollected(token, user, feeAmount, "GAS");
    }
    
    /**
     * @notice Distribute collected fees to recipients
     * @param token Token address
     */
    function distributeFees(address token) external onlyOperator nonReentrant {
        FeeCollection storage collection = feeCollections[token];
        
        require(
            block.timestamp - collection.lastDistribution >= MIN_DISTRIBUTION_INTERVAL,
            "FeeManager: distribution too frequent"
        );
        
        uint256 availableAmount = collection.tokenBalances[token];
        require(availableAmount > 0, "FeeManager: no fees to distribute");
        
        // Distribute to active recipients
        uint256 totalShares = _getTotalActiveShares();
        require(totalShares > 0, "FeeManager: no active recipients");
        
        for (uint256 i = 0; i < feeRecipients.length; i++) {
            FeeRecipient memory recipient = feeRecipients[i];
            if (!recipient.isActive) continue;
            
            uint256 recipientAmount = (availableAmount * recipient.sharePercentage) / totalShares;
            
            if (recipientAmount > 0) {
                IERC20(token).transfer(recipient.recipient, recipientAmount);
            }
        }
        
        collection.totalDistributed += availableAmount;
        collection.tokenBalances[token] = 0;
        collection.lastDistribution = block.timestamp;
        
        emit FeesDistributed(token, availableAmount, block.timestamp);
    }
    
    /**
     * @notice Withdraw user fees
     * @param token Token address
     */
    function withdrawUserFees(address token) external nonReentrant notInEmergencyStop {
        uint256 feeAmount = userFees[msg.sender][token];
        require(feeAmount > 0, "FeeManager: no fees to withdraw");
        
        userFees[msg.sender][token] = 0;
        IERC20(token).transfer(msg.sender, feeAmount);
        
        emit UserFeeWithdrawn(msg.sender, token, feeAmount);
    }
    
    /**
     * @notice Set fee structure for a token
     * @param token Token address
     * @param feeStructure New fee structure
     */
    function setTokenFeeStructure(
        address token,
        FeeStructure calldata feeStructure
    ) external onlyOwner {
        require(token != address(0), "FeeManager: invalid token");
        require(
            feeStructure.protocolFeeBps <= MAX_PROTOCOL_FEE,
            "FeeManager: protocol fee too high"
        );
        require(
            feeStructure.performanceFeeBps <= MAX_PERFORMANCE_FEE,
            "FeeManager: performance fee too high"
        );
        
        tokenFeeStructures[token] = feeStructure;
        
        emit FeeStructureUpdated(
            token,
            feeStructure.protocolFeeBps,
            feeStructure.performanceFeeBps,
            feeStructure.gasFeeBps
        );
    }
    
    /**
     * @notice Update default fee structure
     * @param feeStructure New default fee structure
     */
    function setDefaultFeeStructure(FeeStructure calldata feeStructure) external onlyOwner {
        require(
            feeStructure.protocolFeeBps <= MAX_PROTOCOL_FEE,
            "FeeManager: protocol fee too high"
        );
        require(
            feeStructure.performanceFeeBps <= MAX_PERFORMANCE_FEE,
            "FeeManager: performance fee too high"
        );
        
        defaultFeeStructure = feeStructure;
    }
    
    /**
     * @notice Add fee recipient
     * @param recipient Recipient address
     * @param sharePercentage Share percentage
     */
    function addFeeRecipient(address recipient, uint256 sharePercentage) external onlyOwner {
        require(recipient != address(0), "FeeManager: invalid recipient");
        require(sharePercentage > 0 && sharePercentage <= BASIS_POINTS, "FeeManager: invalid share");
        
        feeRecipients.push(FeeRecipient({
            recipient: recipient,
            sharePercentage: sharePercentage,
            isActive: true
        }));
        
        emit FeeRecipientUpdated(feeRecipients.length - 1, recipient, sharePercentage);
    }
    
    /**
     * @notice Update fee recipient
     * @param index Recipient index
     * @param recipient New recipient address
     * @param sharePercentage New share percentage
     */
    function updateFeeRecipient(
        uint256 index,
        address recipient,
        uint256 sharePercentage
    ) external onlyOwner {
        require(index < feeRecipients.length, "FeeManager: invalid index");
        require(recipient != address(0), "FeeManager: invalid recipient");
        require(sharePercentage > 0 && sharePercentage <= BASIS_POINTS, "FeeManager: invalid share");
        
        feeRecipients[index].recipient = recipient;
        feeRecipients[index].sharePercentage = sharePercentage;
        
        emit FeeRecipientUpdated(index, recipient, sharePercentage);
    }
    
    /**
     * @notice Toggle fee recipient active status
     * @param index Recipient index
     * @param isActive New active status
     */
    function setFeeRecipientStatus(uint256 index, bool isActive) external onlyOwner {
        require(index < feeRecipients.length, "FeeManager: invalid index");
        feeRecipients[index].isActive = isActive;
    }
    
    /**
     * @notice Get token fee structure
     * @param token Token address
     * @return feeStructure Fee structure for token
     */
    function getTokenFeeStructure(address token) 
        external 
        view 
        returns (FeeStructure memory feeStructure) 
    {
        feeStructure = _getFeeStructure(token);
    }
    
    /**
     * @notice Get fee collection info
     * @param token Token address
     * @return totalCollected Total fees collected
     * @return totalDistributed Total fees distributed
     * @return currentBalance Current balance
     * @return lastDistribution Last distribution timestamp
     */
    function getFeeCollectionInfo(address token) 
        external 
        view 
        returns (
            uint256 totalCollected,
            uint256 totalDistributed,
            uint256 currentBalance,
            uint256 lastDistribution
        ) 
    {
        FeeCollection storage collection = feeCollections[token];
        totalCollected = collection.totalCollected;
        totalDistributed = collection.totalDistributed;
        currentBalance = collection.tokenBalances[token];
        lastDistribution = collection.lastDistribution;
    }
    
    /**
     * @notice Get user fee balance
     * @param user User address
     * @param token Token address
     * @return feeBalance User's fee balance
     */
    function getUserFeeBalance(address user, address token) 
        external 
        view 
        returns (uint256 feeBalance) 
    {
        feeBalance = userFees[user][token];
    }
    
    /**
     * @notice Get fee recipients count
     * @return count Number of fee recipients
     */
    function getFeeRecipientsCount() external view returns (uint256 count) {
        count = feeRecipients.length;
    }
    
    /**
     * @notice Calculate fees for a trade
     * @param token Token address
     * @param tradeAmount Trade amount
     * @param profit Profit amount
     * @param gasUsed Gas used
     * @param gasPrice Gas price
     * @return protocolFee Protocol fee
     * @return performanceFee Performance fee
     * @return gasFee Gas fee
     * @return totalFee Total fee
     */
    function calculateFees(
        address token,
        uint256 tradeAmount,
        uint256 profit,
        uint256 gasUsed,
        uint256 gasPrice
    ) external view returns (
        uint256 protocolFee,
        uint256 performanceFee,
        uint256 gasFee,
        uint256 totalFee
    ) {
        FeeStructure memory feeStructure = _getFeeStructure(token);
        
        protocolFee = (tradeAmount * feeStructure.protocolFeeBps) / BASIS_POINTS;
        if (protocolFee < feeStructure.minimumFee) {
            protocolFee = feeStructure.minimumFee;
        }
        
        performanceFee = (profit * feeStructure.performanceFeeBps) / BASIS_POINTS;
        
        uint256 gasCost = gasUsed * gasPrice;
        gasFee = (gasCost * feeStructure.gasFeeBps) / BASIS_POINTS;
        
        totalFee = protocolFee + performanceFee + gasFee;
    }
    
    /**
     * @notice Emergency fee withdrawal
     * @param token Token address
     * @param amount Amount to withdraw
     */
    function emergencyFeeWithdrawal(address token, uint256 amount) 
        external 
        onlyOwner 
        onlyInEmergencyStop 
    {
        require(token != address(0), "FeeManager: invalid token");
        require(amount > 0, "FeeManager: invalid amount");
        
        IERC20(token).transfer(owner, amount);
    }
    
    /**
     * @notice Get fee structure for token (internal)
     * @param token Token address
     * @return feeStructure Fee structure
     */
    function _getFeeStructure(address token) 
        internal 
        view 
        returns (FeeStructure memory feeStructure) 
    {
        feeStructure = tokenFeeStructures[token];
        
        // Use default if not set or inactive
        if (!feeStructure.isActive) {
            feeStructure = defaultFeeStructure;
        }
    }
    
    /**
     * @notice Collect fee internally
     * @param token Token address
     * @param user User address
     * @param amount Fee amount
     * @param feeType Fee type
     */
    function _collectFee(
        address token,
        address user,
        uint256 amount,
        string memory feeType
    ) internal {
        if (amount == 0) return;
        
        // Transfer fee from user
        IERC20(token).transferFrom(user, address(this), amount);
        
        // Update collections
        FeeCollection storage collection = feeCollections[token];
        collection.totalCollected += amount;
        collection.tokenBalances[token] += amount;
        
        // Update tracking
        totalFeesGenerated[token] += amount;
        lastFeeUpdate[token] = block.timestamp;
    }
    
    /**
     * @notice Get total active shares
     * @return totalShares Total percentage shares of active recipients
     */
    function _getTotalActiveShares() internal view returns (uint256 totalShares) {
        for (uint256 i = 0; i < feeRecipients.length; i++) {
            if (feeRecipients[i].isActive) {
                totalShares += feeRecipients[i].sharePercentage;
            }
        }
    }
}