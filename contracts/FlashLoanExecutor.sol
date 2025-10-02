// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IFlashLoanReceiver.sol";
import "./interfaces/IPoolAddressesProvider.sol";
import "./interfaces/IPool.sol";
import "./interfaces/IERC20.sol";
import "./security/EmergencyStop.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title FlashLoanExecutor
 * @notice Unified flash loan executor supporting multiple protocols (Aave, Uniswap V3, etc.)
 * @dev Provides a secure interface for executing flash loans from various DeFi protocols
 * @custom:security-contact security@example.com
 */
contract FlashLoanExecutor is IFlashLoanReceiver, EmergencyStop, ReentrancyGuard, Pausable {
    
    /// @notice Supported flash loan protocols
    enum Protocol {
        AAVE_V3,
        UNISWAP_V3,
        BALANCER
    }
    
    /// @notice Flash loan request parameters
    struct FlashLoanParams {
        Protocol protocol;
        address[] assets;
        uint256[] amounts;
        bytes userData;
        address initiator;
    }
    
    /// @notice Protocol-specific addresses
    struct ProtocolAddresses {
        address pool;
        address addressesProvider;
        bool isActive;
    }
    
    /// @dev Aave V3 Pool Addresses Provider (Ethereum mainnet)
    IPoolAddressesProvider public constant AAVE_ADDRESSES_PROVIDER = 
        IPoolAddressesProvider(0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e);
    
    /// @notice Mapping of supported protocols to their addresses
    mapping(Protocol => ProtocolAddresses) public protocolAddresses;
    
    /// @notice Track active flash loans to prevent reentrancy
    mapping(bytes32 => bool) private activeLoans;
    
    /// @notice Maximum number of assets in a single flash loan
    uint256 public constant MAX_ASSETS = 10;
    
    /// @notice Flash loan fee tracking (basis points)
    uint256 public constant AAVE_FLASH_LOAN_FEE_BPS = 9; // 0.09%
    
    /// @notice Events for monitoring and analytics
    event FlashLoanExecuted(
        Protocol indexed protocol,
        address indexed initiator,
        address[] assets,
        uint256[] amounts,
        uint256[] premiums,
        bool success
    );
    
    event FlashLoanFailed(
        Protocol indexed protocol,
        address indexed initiator,
        string reason
    );
    
    event ProtocolAdded(
        Protocol indexed protocol,
        address pool,
        address addressesProvider
    );
    
    event ProtocolUpdated(
        Protocol indexed protocol,
        address newPool,
        bool isActive
    );
    
    event EmergencyWithdrawal(
        address indexed token,
        address indexed recipient,
        uint256 amount
    );
    
    /**
     * @notice Contract constructor
     * @dev Initializes supported flash loan protocols
     */
    constructor() {
        _initializeProtocols();
    }
    
    /**
     * @notice Execute a flash loan from specified protocol
     * @dev Main entry point for flash loan execution
     * @param params Flash loan parameters including protocol, assets, and amounts
     * @return success Whether the flash loan was successful
     */
    function executeFlashLoan(FlashLoanParams memory params) 
        external 
        nonReentrant
        notInEmergencyStop
        whenNotPaused
        onlyOperator
        returns (bool success) 
    {
        require(params.assets.length > 0, "FlashLoanExecutor: no assets specified");
        require(params.assets.length == params.amounts.length, "FlashLoanExecutor: length mismatch");
        require(params.assets.length <= MAX_ASSETS, "FlashLoanExecutor: too many assets");
        
        ProtocolAddresses memory protocol = protocolAddresses[params.protocol];
        require(protocol.isActive, "FlashLoanExecutor: protocol not active");
        
        bytes32 loanId = _generateLoanId(params);
        require(!activeLoans[loanId], "FlashLoanExecutor: loan already active");
        
        activeLoans[loanId] = true;
        
        try this._executeProtocolFlashLoan(params, protocol) returns (bool result) {
            success = result;
        } catch Error(string memory reason) {
            emit FlashLoanFailed(params.protocol, params.initiator, reason);
            success = false;
        }
        
        activeLoans[loanId] = false;
    }
    
    /**
     * @notice Internal flash loan execution for specific protocol
     * @dev External visibility for try/catch pattern
     * @param params Flash loan parameters
     * @param protocol Protocol-specific addresses
     * @return success Whether execution was successful
     */
    function _executeProtocolFlashLoan(
        FlashLoanParams memory params,
        ProtocolAddresses memory protocol
    ) external returns (bool success) {
        require(msg.sender == address(this), "FlashLoanExecutor: internal only");
        
        if (params.protocol == Protocol.AAVE_V3) {
            return _executeAaveFlashLoan(params, protocol);
        } else if (params.protocol == Protocol.UNISWAP_V3) {
            revert("FlashLoanExecutor: Uniswap V3 not yet implemented");
        } else if (params.protocol == Protocol.BALANCER) {
            revert("FlashLoanExecutor: Balancer not yet implemented");
        }
        
        revert("FlashLoanExecutor: unsupported protocol");
    }
    
    /**
     * @notice Execute Aave V3 flash loan
     * @dev Handles Aave-specific flash loan execution
     * @param params Flash loan parameters
     * @param protocol Protocol addresses
     * @return success Whether execution was successful
     */
    function _executeAaveFlashLoan(
        FlashLoanParams memory params,
        ProtocolAddresses memory protocol
    ) internal returns (bool success) {
        IPool pool = IPool(protocol.pool);
        
        uint256[] memory modes = new uint256[](params.assets.length);
        // Mode 0: no debt, pay back in same transaction
        for (uint256 i = 0; i < modes.length; i++) {
            modes[i] = 0;
        }
        
        bytes memory callbackParams = abi.encode(params);
        
        pool.flashLoan(
            address(this),
            params.assets,
            params.amounts,
            modes,
            params.initiator,
            callbackParams,
            0 // referral code
        );
        
        return true;
    }
    
    /**
     * @notice Aave flash loan callback
     * @dev Called by Aave Pool after transferring borrowed assets
     * @param assets The addresses of the assets being flash borrowed
     * @param amounts The amounts of the assets being flash borrowed
     * @param premiums The fee amounts for each asset
     * @param initiator The address that initiated the flash loan
     * @param params Encoded parameters passed through the flash loan
     * @return success True if operation succeeds
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external override returns (bool success) {
        ProtocolAddresses memory aaveProtocol = protocolAddresses[Protocol.AAVE_V3];
        require(msg.sender == aaveProtocol.pool, "FlashLoanExecutor: invalid callback caller");
        
        FlashLoanParams memory flashParams = abi.decode(params, (FlashLoanParams));
        require(initiator == address(this), "FlashLoanExecutor: invalid initiator");
        
        // Execute custom logic with borrowed funds
        // Note: In production, this would call back to a strategy contract
        // For now, we just ensure we can repay
        
        // Calculate total debt (borrowed amount + premium)
        for (uint256 i = 0; i < assets.length; i++) {
            uint256 totalDebt = amounts[i] + premiums[i];
            uint256 balance = IERC20(assets[i]).balanceOf(address(this));
            
            require(balance >= totalDebt, "FlashLoanExecutor: insufficient funds to repay");
            
            // Approve pool to pull repayment
            IERC20(assets[i]).approve(msg.sender, totalDebt);
        }
        
        emit FlashLoanExecuted(
            flashParams.protocol,
            flashParams.initiator,
            assets,
            amounts,
            premiums,
            true
        );
        
        return true;
    }
    
    /**
     * @notice Initialize supported protocols
     * @dev Sets up Aave V3 and other protocol addresses
     */
    function _initializeProtocols() internal {
        // Initialize Aave V3
        address aavePool = AAVE_ADDRESSES_PROVIDER.getPool();
        protocolAddresses[Protocol.AAVE_V3] = ProtocolAddresses({
            pool: aavePool,
            addressesProvider: address(AAVE_ADDRESSES_PROVIDER),
            isActive: true
        });
        
        emit ProtocolAdded(Protocol.AAVE_V3, aavePool, address(AAVE_ADDRESSES_PROVIDER));
    }
    
    /**
     * @notice Update protocol configuration
     * @dev Only callable by owner
     * @param protocol Protocol to update
     * @param pool New pool address
     * @param isActive Whether protocol should be active
     */
    function updateProtocol(
        Protocol protocol,
        address pool,
        bool isActive
    ) external onlyOwner {
        require(pool != address(0), "FlashLoanExecutor: invalid pool address");
        
        protocolAddresses[protocol].pool = pool;
        protocolAddresses[protocol].isActive = isActive;
        
        emit ProtocolUpdated(protocol, pool, isActive);
    }
    
    /**
     * @notice Emergency token withdrawal
     * @dev Only callable when contract is paused and by owner
     * @param token Token address to withdraw
     * @param amount Amount to withdraw
     * @param recipient Recipient address
     */
    function emergencyWithdraw(
        address token,
        uint256 amount,
        address recipient
    ) external onlyOwner whenPaused {
        require(token != address(0), "FlashLoanExecutor: invalid token");
        require(recipient != address(0), "FlashLoanExecutor: invalid recipient");
        require(amount > 0, "FlashLoanExecutor: invalid amount");
        
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance >= amount, "FlashLoanExecutor: insufficient balance");
        
        IERC20(token).transfer(recipient, amount);
        
        emit EmergencyWithdrawal(token, recipient, amount);
    }
    
    /**
     * @notice Pause contract operations
     * @dev Emergency pause mechanism
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause contract operations
     * @dev Resume normal operations
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Generate unique loan ID
     * @dev Creates a unique identifier for tracking active loans
     * @param params Flash loan parameters
     * @return loanId Unique loan identifier
     */
    function _generateLoanId(FlashLoanParams memory params) 
        internal 
        view 
        returns (bytes32 loanId) 
    {
        return keccak256(abi.encodePacked(
            params.protocol,
            params.initiator,
            block.timestamp,
            params.assets,
            params.amounts
        ));
    }
    
    /**
     * @notice Check if protocol is supported and active
     * @param protocol Protocol to check
     * @return isSupported Whether protocol is supported
     */
    function isProtocolSupported(Protocol protocol) 
        external 
        view 
        returns (bool isSupported) 
    {
        return protocolAddresses[protocol].isActive;
    }
    
    /**
     * @notice Get protocol addresses
     * @param protocol Protocol to query
     * @return addresses Protocol-specific addresses
     */
    function getProtocolAddresses(Protocol protocol) 
        external 
        view 
        returns (ProtocolAddresses memory addresses) 
    {
        return protocolAddresses[protocol];
    }
    
    /**
     * @notice Calculate flash loan fee for given amount
     * @param protocol Protocol being used
     * @param amount Loan amount
     * @return fee Fee amount in tokens
     */
    function calculateFlashLoanFee(Protocol protocol, uint256 amount) 
        external 
        pure 
        returns (uint256 fee) 
    {
        if (protocol == Protocol.AAVE_V3) {
            return (amount * AAVE_FLASH_LOAN_FEE_BPS) / 10000;
        }
        return 0;
    }
}
