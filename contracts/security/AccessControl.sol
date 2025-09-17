// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title AccessControl
 * @notice Provides access control functionality for arbitrage contracts
 */
contract AccessControl {
    address public owner;
    mapping(address => bool) public operators;
    mapping(address => bool) public emergencyStoppers;
    
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);
    event EmergencyStopperAdded(address indexed stopper);
    event EmergencyStopperRemoved(address indexed stopper);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "AccessControl: caller is not the owner");
        _;
    }
    
    modifier onlyOperator() {
        require(operators[msg.sender] || msg.sender == owner, "AccessControl: caller is not an operator");
        _;
    }
    
    modifier onlyEmergencyStopper() {
        require(emergencyStoppers[msg.sender] || msg.sender == owner, "AccessControl: caller cannot stop emergency");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        operators[msg.sender] = true;
        emergencyStoppers[msg.sender] = true;
        emit OwnershipTransferred(address(0), msg.sender);
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "AccessControl: new owner is the zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
    
    function addOperator(address operator) external onlyOwner {
        require(operator != address(0), "AccessControl: operator is the zero address");
        operators[operator] = true;
        emit OperatorAdded(operator);
    }
    
    function removeOperator(address operator) external onlyOwner {
        operators[operator] = false;
        emit OperatorRemoved(operator);
    }
    
    function addEmergencyStopper(address stopper) external onlyOwner {
        require(stopper != address(0), "AccessControl: stopper is the zero address");
        emergencyStoppers[stopper] = true;
        emit EmergencyStopperAdded(stopper);
    }
    
    function removeEmergencyStopper(address stopper) external onlyOwner {
        emergencyStoppers[stopper] = false;
        emit EmergencyStopperRemoved(stopper);
    }
}