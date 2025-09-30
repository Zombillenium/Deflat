// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILiquidityPool {
    // Vues de prix
    function getPrices() external view returns (uint priceDFTinStable18, uint priceStableinDFT18);
    function getAmountOut(uint amountIn, bool stableToDft) external view returns (uint amountOut);

    // Quote avec frais dynamiques (doit exister dans ta LiquidityPool)
    function getQuoteWithDynamicFees(uint amountIn, bool stableToDft)
        external
        view
        returns (uint outNet, uint16 vaultFeeBps, uint16 burnFeeBps, uint ratioBps);

    // Liquidité
    function addLiquidity(uint amountDFTDesired, uint amountStableDesired)
        external
        returns (uint liquidity, uint amountDFTAdded, uint amountStableAdded);

    // Swaps
    function swapStableForDFT(uint amountStableIn, uint minDFTOut) external returns (uint amountOut);
    function swapDFTForStable(uint amountDFTIn, uint minStableOut) external returns (uint amountOut);

    // Admin (pour brancher la Vault – doit exister dans ta Pool)
    function setVaultAddress(address _vault) external;
}

