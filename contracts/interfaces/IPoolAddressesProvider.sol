// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IPoolAddressesProvider interface
 * @notice Interface for the Aave Pool Addresses Provider contract
 */
interface IPoolAddressesProvider {
    function getPool() external view returns (address);
    function getPoolConfigurator() external view returns (address);
    function getPriceOracle() external view returns (address);
    function getACLManager() external view returns (address);
    function getACLAdmin() external view returns (address);
    function getPriceOracleSentinel() external view returns (address);
    function getPoolDataProvider() external view returns (address);
}