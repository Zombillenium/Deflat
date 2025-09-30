// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IOracle.sol";

contract DummyOracle is IOracle {
    uint256 private price;

    constructor(uint256 _price) {
        price = _price;
    }

    function setPrice(uint256 _price) external {
        price = _price;
    }

    function getPrice() external view override returns (uint256) {
        return price;
    }
}

