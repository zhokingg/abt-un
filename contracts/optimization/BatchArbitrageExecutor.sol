// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IERC20.sol";
import "../security/EmergencyStop.sol";
import "./GasOptimizedFlashloanArbitrage.sol";

/**
 * @title BatchArbitrageExecutor
 * @notice Execute multiple arbitrage operations in a single transaction for gas efficiency
 * @dev Reduces overhead by batching multiple operations and optimizing gas usage
 */
contract BatchArbitrageExecutor is EmergencyStop {
    
    struct BatchOperation {
        address target;          // Contract to call
        bytes callData;          // Encoded function call
        uint256 value;           // ETH value to send
        bool required;           // If true, revert if this operation fails
    }
    
    struct ArbitrageBatch {
        GasOptimizedFlashloanArbitrage.PackedArbitrageData[] arbitrages;
        uint256 maxGasPerOperation;
        uint256 minTotalProfit;
        uint32 deadline;
    }
    
    // Gas optimization settings
    uint256 public constant MAX_BATCH_SIZE = 10;
    uint256 public constant MIN_GAS_RESERVE = 50000; // Reserve gas for final operations
    
    // Batch execution stats
    mapping(address => uint256) public operatorBatchCount;
    mapping(address => uint256) public operatorTotalProfit;
    
    // Events
    event BatchExecuted(
        address indexed operator,
        uint256 operationCount,
        uint256 totalProfit,
        uint256 gasUsed
    );
    
    event BatchOperationFailed(
        uint256 indexed batchId,
        uint256 indexed operationIndex,
        string reason
    );
    
    /**
     * @notice Execute multiple arbitrage operations in batch
     * @param batch Batch of arbitrage operations to execute
     */
    function executeBatch(ArbitrageBatch calldata batch) 
        external 
        notInEmergencyStop
        onlyOperator
    {
        uint256 batchSize = batch.arbitrages.length;
        require(batchSize > 0 && batchSize <= MAX_BATCH_SIZE, "Invalid batch size");
        require(block.timestamp <= batch.deadline, "Batch expired");
        
        uint256 startGas = gasleft();
        uint256 totalProfit = 0;
        uint256 successCount = 0;
        
        // Execute each arbitrage in the batch
        for (uint256 i = 0; i < batchSize;) {
            // Check if we have enough gas for this operation plus reserve
            if (gasleft() < batch.maxGasPerOperation + MIN_GAS_RESERVE) {
                break; // Stop executing to avoid out of gas
            }
            
            try this._executeArbitrageInBatch(batch.arbitrages[i]) returns (uint256 profit) {
                totalProfit += profit;
                successCount++;
            } catch Error(string memory reason) {
                emit BatchOperationFailed(block.number, i, reason);
                // Continue with next operation unless it was required
            } catch {
                emit BatchOperationFailed(block.number, i, "Unknown error");
            }
            
            unchecked { ++i; }
        }
        
        require(totalProfit >= batch.minTotalProfit, "Insufficient total profit");
        require(successCount > 0, "No successful operations");
        
        uint256 gasUsed = startGas - gasleft();
        
        // Update stats
        operatorBatchCount[msg.sender]++;
        operatorTotalProfit[msg.sender] += totalProfit;
        
        emit BatchExecuted(msg.sender, successCount, totalProfit, gasUsed);
    }
    
    /**
     * @notice Internal function to execute single arbitrage in batch context
     * @dev This is external but only callable by this contract
     */
    function _executeArbitrageInBatch(
        GasOptimizedFlashloanArbitrage.PackedArbitrageData calldata data
    ) external returns (uint256 profit) {
        require(msg.sender == address(this), "Internal function");
        
        // In a real implementation, this would call the gas-optimized arbitrage contract
        // For now, we'll simulate the arbitrage execution
        profit = _simulateArbitrageProfit(data);
        
        require(profit > 0, "No profit from arbitrage");
    }
    
    /**
     * @notice Execute generic batch operations with gas optimization
     * @param operations Array of operations to execute
     */
    function executeGenericBatch(BatchOperation[] calldata operations)
        external
        notInEmergencyStop
        onlyOperator
        returns (bool[] memory results)
    {
        uint256 length = operations.length;
        require(length > 0 && length <= MAX_BATCH_SIZE, "Invalid batch size");
        
        results = new bool[](length);
        uint256 startGas = gasleft();
        
        for (uint256 i = 0; i < length;) {
            BatchOperation calldata op = operations[i];
            
            // Check gas availability
            if (gasleft() < MIN_GAS_RESERVE) {
                if (op.required) {
                    revert("Insufficient gas for required operation");
                }
                break;
            }
            
            // Execute operation
            (bool success,) = op.target.call{value: op.value}(op.callData);
            results[i] = success;
            
            if (!success && op.required) {
                revert("Required operation failed");
            }
            
            unchecked { ++i; }
        }
        
        uint256 gasUsed = startGas - gasleft();
        emit BatchExecuted(msg.sender, length, 0, gasUsed);
    }
    
    /**
     * @notice Estimate gas for batch execution
     * @param batch Batch to estimate gas for
     */
    function estimateBatchGas(ArbitrageBatch calldata batch) 
        external 
        view 
        returns (uint256 estimatedGas) 
    {
        // Base gas cost for batch setup
        estimatedGas = 21000 + (batch.arbitrages.length * 50000);
        
        // Add estimated gas per arbitrage
        for (uint256 i = 0; i < batch.arbitrages.length; i++) {
            estimatedGas += _estimateArbitrageGas(batch.arbitrages[i]);
        }
        
        // Add safety margin
        estimatedGas = (estimatedGas * 120) / 100; // 20% buffer
    }
    
    /**
     * @notice Get batch execution statistics for operator
     */
    function getBatchStats(address operator) 
        external 
        view 
        returns (uint256 batchCount, uint256 totalProfit) 
    {
        batchCount = operatorBatchCount[operator];
        totalProfit = operatorTotalProfit[operator];
    }
    
    /**
     * @dev Simulate arbitrage profit for demonstration
     */
    function _simulateArbitrageProfit(
        GasOptimizedFlashloanArbitrage.PackedArbitrageData calldata data
    ) internal pure returns (uint256 profit) {
        // Simulate profit calculation based on trade amount
        uint256 amount = data.amountIn;
        uint256 minProfitBps = data.minProfitBps;
        
        // Mock profit: 0.2% of trade amount
        profit = (amount * minProfitBps) / 10000;
        
        // Add some randomness based on token addresses
        uint256 bonus = uint256(keccak256(abi.encode(data.tokenA, data.tokenB))) % 100;
        profit += (amount * bonus) / 100000; // Up to 0.1% additional profit
    }
    
    /**
     * @dev Estimate gas for single arbitrage operation
     */
    function _estimateArbitrageGas(
        GasOptimizedFlashloanArbitrage.PackedArbitrageData calldata data
    ) internal pure returns (uint256 gas) {
        // Base gas for arbitrage execution
        gas = 200000;
        
        // Additional gas based on trade complexity
        if (data.feeA != data.feeB) {
            gas += 50000; // Different fee tiers require more gas
        }
        
        // Scale with trade amount (larger trades may need more gas)
        if (data.amountIn > 100000 * 1e6) { // > $100k
            gas += 75000;
        }
        
        return gas;
    }
    
    /**
     * @notice Emergency batch stop - cancel all pending operations
     */
    function emergencyBatchStop() external onlyOwner {
        // This would cancel any pending batch operations
        // In a real implementation, this might interact with a queue system
        emit BatchExecuted(msg.sender, 0, 0, 0);
    }
    
    /**
     * @notice Withdraw accumulated profits from batch operations
     */
    function withdrawBatchProfits(address token, uint256 amount) 
        external 
        onlyOwner 
    {
        if (token == address(0)) {
            // Withdraw ETH
            (bool success,) = payable(owner()).call{value: amount}("");
            require(success, "ETH withdrawal failed");
        } else {
            // Withdraw ERC20 token
            IERC20(token).transfer(owner(), amount);
        }
    }
    
    // Allow contract to receive ETH for batch operations
    receive() external payable {}
}