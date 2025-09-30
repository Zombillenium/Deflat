// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IOracle {
    /// @notice retourne le prix d’1 DFT en unités de stable (ex: 1e18 = 1 USDC)
    function getPrice() external view returns (uint256);
}

