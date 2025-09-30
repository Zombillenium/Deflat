// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IVault {
    // vues
    function getPoolPriceDFTInStable18() external view returns (uint256);
    function getDeltaBps() external view returns (int256);
    function emaShort() external view returns (uint256);
    function emaLong() external view returns (uint256);

    // actions (owner only dans le contrat)
    function buyDFTViaPool(uint256 stableIn) external returns (uint256 dftOut);
    function sellDFTViaPool(uint256 dftIn) external returns (uint256 stableOut);
    function rebalanceOnceByPriceDrift() external;
    function seedLiquidity(uint256 amountDFT, uint256 amountStable) external;

    // admin
    function setPool(address _pool) external;
    function setParams(
        uint16 _triggerBps,
        uint16 _slippageBps,
        uint16 _kUpPer100bps,
        uint16 _kDownPer100bps,
        uint16 _maxActionBpsBuy,
        uint16 _maxActionBpsSell,
        uint32 _minSpacingSec,
        uint16 _maxStressRatioBps,
        uint16 _maxDailyBudgetBps,
        uint16 _targetStableShareBps,
        uint16 _allocBandBps
    ) external;
}

