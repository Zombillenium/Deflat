// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IOracle.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/// @notice Oracle ETH/USD via Chainlink, retourne un prix en 1e18
contract ChainlinkOracle is IOracle {
    AggregatorV3Interface internal priceFeed;

    constructor(address _feed) {
        priceFeed = AggregatorV3Interface(_feed);
    }

    function getPrice() external view override returns (uint256) {
        (
            ,
            int256 answer,
            ,
            ,
        ) = priceFeed.latestRoundData();

        require(answer > 0, "Invalid price");

        // Chainlink ETH/USD a 8 décimales → on convertit en 1e18
        return uint256(answer) * 1e10;
    }
}

