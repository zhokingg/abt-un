// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../security/EmergencyStop.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ArbitrageFactory
 * @notice Factory pattern for deploying arbitrage contracts
 * @dev Uses minimal proxy pattern to reduce deployment costs
 */
contract ArbitrageFactory is EmergencyStop, ReentrancyGuard {
    using Clones for address;
    
    struct ContractInfo {
        address contractAddress;
        address deployer;
        uint256 deploymentTime;
        bool isActive;
        string contractType;
    }
    
    // Implementation contract addresses
    address public flashloanArbitrageImplementation;
    address public arbitrageExecutorImplementation;
    address public multiDEXRouterImplementation;
    
    // Deployed contracts tracking
    mapping(address => ContractInfo) public deployedContracts;
    address[] public allDeployedContracts;
    mapping(address => address[]) public userContracts;
    
    // Deployment fees
    uint256 public deploymentFee = 0.01 ether;
    address public feeRecipient;
    
    uint256 public constant MAX_CONTRACTS_PER_USER = 10;
    
    event ContractDeployed(
        address indexed deployer,
        address indexed contractAddress,
        string contractType,
        uint256 deploymentFee
    );
    
    event ContractStatusChanged(
        address indexed contractAddress,
        bool isActive
    );
    
    event ImplementationUpdated(
        string contractType,
        address oldImplementation,
        address newImplementation
    );
    
    constructor(
        address _flashloanArbitrageImpl,
        address _arbitrageExecutorImpl,
        address _multiDEXRouterImpl
    ) {
        require(_flashloanArbitrageImpl != address(0), "ArbitrageFactory: invalid flashloan impl");
        require(_arbitrageExecutorImpl != address(0), "ArbitrageFactory: invalid executor impl");
        require(_multiDEXRouterImpl != address(0), "ArbitrageFactory: invalid router impl");
        
        flashloanArbitrageImplementation = _flashloanArbitrageImpl;
        arbitrageExecutorImplementation = _arbitrageExecutorImpl;
        multiDEXRouterImplementation = _multiDEXRouterImpl;
        
        feeRecipient = owner;
    }
    
    /**
     * @notice Deploy a new contract using minimal proxy
     * @param implementation Implementation contract address
     * @param contractType Type of contract being deployed
     * @param salt Salt for CREATE2 deployment
     * @return contractAddress Address of deployed contract
     */
    function deployContract(
        address implementation,
        string calldata contractType,
        bytes32 salt
    ) external payable nonReentrant notInEmergencyStop returns (address contractAddress) {
        require(msg.value >= deploymentFee, "ArbitrageFactory: insufficient fee");
        require(implementation != address(0), "ArbitrageFactory: invalid implementation");
        require(
            userContracts[msg.sender].length < MAX_CONTRACTS_PER_USER,
            "ArbitrageFactory: too many contracts"
        );
        
        // Deploy clone using CREATE2
        contractAddress = implementation.cloneDeterministic(salt);
        
        // Record contract info
        _recordDeployment(contractAddress, contractType);
        
        // Handle fees
        _handleDeploymentFee();
        
        emit ContractDeployed(msg.sender, contractAddress, contractType, msg.value);
    }
    
    /**
     * @notice Predict contract address for CREATE2 deployment
     * @param implementation Implementation contract address
     * @param salt Salt for deployment
     * @return predictedAddress Predicted contract address
     */
    function predictContractAddress(
        address implementation,
        bytes32 salt
    ) external view returns (address predictedAddress) {
        predictedAddress = implementation.predictDeterministicAddress(salt);
    }
    
    /**
     * @notice Get contracts deployed by a user
     * @param user User address
     * @return contracts Array of contract addresses
     */
    function getUserContracts(address user) external view returns (address[] memory contracts) {
        contracts = userContracts[user];
    }
    
    /**
     * @notice Get contract deployment info
     * @param contractAddress Contract address
     * @return info Contract information
     */
    function getContractInfo(address contractAddress) 
        external 
        view 
        returns (ContractInfo memory info) 
    {
        info = deployedContracts[contractAddress];
    }
    
    /**
     * @notice Get all deployed contracts
     * @return contracts Array of all deployed contract addresses
     */
    function getAllDeployedContracts() external view returns (address[] memory contracts) {
        contracts = allDeployedContracts;
    }
    
    /**
     * @notice Update implementation contract
     * @param contractType Type of contract to update
     * @param newImplementation New implementation address
     */
    function updateImplementation(
        string calldata contractType,
        address newImplementation
    ) external onlyOwner {
        require(newImplementation != address(0), "ArbitrageFactory: invalid implementation");
        
        bytes32 typeHash = keccak256(abi.encodePacked(contractType));
        address oldImplementation;
        
        if (typeHash == keccak256(abi.encodePacked("FlashloanArbitrage"))) {
            oldImplementation = flashloanArbitrageImplementation;
            flashloanArbitrageImplementation = newImplementation;
        } else if (typeHash == keccak256(abi.encodePacked("ArbitrageExecutor"))) {
            oldImplementation = arbitrageExecutorImplementation;
            arbitrageExecutorImplementation = newImplementation;
        } else if (typeHash == keccak256(abi.encodePacked("MultiDEXRouter"))) {
            oldImplementation = multiDEXRouterImplementation;
            multiDEXRouterImplementation = newImplementation;
        } else {
            revert("ArbitrageFactory: unknown contract type");
        }
        
        emit ImplementationUpdated(contractType, oldImplementation, newImplementation);
    }
    
    /**
     * @notice Set deployment fee
     * @param newFee New deployment fee
     */
    function setDeploymentFee(uint256 newFee) external onlyOwner {
        deploymentFee = newFee;
    }
    
    /**
     * @notice Set fee recipient
     * @param newRecipient New fee recipient address
     */
    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "ArbitrageFactory: invalid recipient");
        feeRecipient = newRecipient;
    }
    
    /**
     * @notice Withdraw accumulated fees
     * @param amount Amount to withdraw
     */
    function withdrawFees(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "ArbitrageFactory: insufficient balance");
        
        (bool success, ) = feeRecipient.call{value: amount}("");
        require(success, "ArbitrageFactory: transfer failed");
    }
    
    /**
     * @notice Record contract deployment
     */
    function _recordDeployment(address contractAddress, string memory contractType) internal {
        deployedContracts[contractAddress] = ContractInfo({
            contractAddress: contractAddress,
            deployer: msg.sender,
            deploymentTime: block.timestamp,
            isActive: true,
            contractType: contractType
        });
        
        allDeployedContracts.push(contractAddress);
        userContracts[msg.sender].push(contractAddress);
    }
    
    /**
     * @notice Handle deployment fee distribution
     */
    function _handleDeploymentFee() internal {
        if (msg.value > deploymentFee) {
            // Refund excess
            uint256 refund = msg.value - deploymentFee;
            (bool success, ) = msg.sender.call{value: refund}("");
            require(success, "ArbitrageFactory: refund failed");
        }
    }
    
    /**
     * @notice Receive function to accept ETH
     */
    receive() external payable {}
}