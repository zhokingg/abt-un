// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./AccessControl.sol";

/**
 * @title EmergencyStop
 * @notice Provides emergency stop functionality for arbitrage contracts
 */
contract EmergencyStop is AccessControl {
    bool public emergencyStopped = false;
    uint256 public emergencyStopTimestamp;
    uint256 public constant EMERGENCY_STOP_DURATION = 24 hours;
    
    event EmergencyStopActivated(address indexed activatedBy, uint256 timestamp);
    event EmergencyStopDeactivated(address indexed deactivatedBy, uint256 timestamp);
    
    modifier notInEmergencyStop() {
        require(!emergencyStopped, "EmergencyStop: contract is in emergency stop");
        _;
    }
    
    modifier onlyInEmergencyStop() {
        require(emergencyStopped, "EmergencyStop: contract is not in emergency stop");
        _;
    }
    
    /**
     * @notice Activate emergency stop
     * @dev Can be called by owner or emergency stoppers
     */
    function activateEmergencyStop() external onlyEmergencyStopper {
        require(!emergencyStopped, "EmergencyStop: already in emergency stop");
        
        emergencyStopped = true;
        emergencyStopTimestamp = block.timestamp;
        
        emit EmergencyStopActivated(msg.sender, block.timestamp);
    }
    
    /**
     * @notice Deactivate emergency stop
     * @dev Can only be called by owner
     */
    function deactivateEmergencyStop() external onlyOwner {
        require(emergencyStopped, "EmergencyStop: not in emergency stop");
        
        emergencyStopped = false;
        
        emit EmergencyStopDeactivated(msg.sender, block.timestamp);
    }
    
    /**
     * @notice Auto-deactivate emergency stop after duration
     * @dev Can be called by anyone after the emergency stop duration
     */
    function autoDeactivateEmergencyStop() external {
        require(emergencyStopped, "EmergencyStop: not in emergency stop");
        require(
            block.timestamp >= emergencyStopTimestamp + EMERGENCY_STOP_DURATION,
            "EmergencyStop: emergency stop duration not elapsed"
        );
        
        emergencyStopped = false;
        
        emit EmergencyStopDeactivated(msg.sender, block.timestamp);
    }
    
    /**
     * @notice Check if emergency stop is active
     */
    function isEmergencyStopped() external view returns (bool) {
        return emergencyStopped;
    }
    
    /**
     * @notice Get time remaining for emergency stop
     */
    function getEmergencyStopTimeRemaining() external view returns (uint256) {
        if (!emergencyStopped) return 0;
        
        uint256 endTime = emergencyStopTimestamp + EMERGENCY_STOP_DURATION;
        if (block.timestamp >= endTime) return 0;
        
        return endTime - block.timestamp;
    }
}