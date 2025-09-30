// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * AMM minimal (x*y=k) entre DFT et STABLE avec frais dynamiques.
 * - addLiquidity / removeLiquidity
 * - swapStableForDFT / swapDFTForStable
 * - LP token intégré
 *
 * Hypothèses :
 * - tokenDFT et tokenStable sont des ERC20 18 décimales (classiques).
 * - Frais dynamiques: 1% → 7% selon % de STABLE retiré (swaps DFT->STABLE + removeLiquidity) sur 1h.
 *   Split: vault:burn = 5:2 (ex: 7% = 5% vault + 2% burn).
 */

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract LiquidityPool is ERC20, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable tokenDFT;
    IERC20 public immutable tokenStable;

    address public vaultAddress; // destinataire des frais "vault"
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // Réserves internes (Uniswap V2-like)
    uint112 private reserveDFT;
    uint112 private reserveStable;
    uint32  private blockTimestampLast;

    // ---- Tracking du retrait horaire de STABLE (fenêtre glissante) ----
    struct VolumeTracker {
        uint256 amount;      // volume cumulé de STABLE sortant "pondéré" sur 1h
        uint256 lastUpdated; // timestamp dernier update
    }
    VolumeTracker public withdrawalTracker; // STABLE sortant de la pool

    // ---- Events ----
    event Mint(address indexed provider, uint amountDFT, uint amountStable, uint liquidityMinted);
    event Burn(address indexed provider, uint liquidityBurned, uint amountDFT, uint amountStable);
    event Swap(
        address indexed trader,
        address indexed tokenIn,
        uint amountIn,
        address indexed tokenOut,
        uint amountOut
    );
    event Sync(uint112 reserveDFT, uint112 reserveStable);
    event VaultAddressUpdated(address indexed oldAddr, address indexed newAddr);
    event FeesApplied(
        address indexed trader,
        bool stableToDft,
        uint16 vaultFeeBps,
        uint16 burnFeeBps,
        uint256 vaultFeeAmountTokenIn,
        uint256 burnAmountDFT,
        uint256 ratioBps // % retrait dernière heure (basis points)
    );

    constructor(
        address _tokenDFT,
        address _tokenStable,
        string memory lpName,
        string memory lpSymbol,
        address _owner
    ) ERC20(lpName, lpSymbol) Ownable(_owner) {
        require(_tokenDFT != address(0) && _tokenStable != address(0), "Zero address");
        require(_tokenDFT != _tokenStable, "Identical tokens");
        tokenDFT = IERC20(_tokenDFT);
        tokenStable = IERC20(_tokenStable);
        withdrawalTracker.lastUpdated = block.timestamp;
    }

    // ========= ADMIN =========

    function setVaultAddress(address _vault) external onlyOwner {
        emit VaultAddressUpdated(vaultAddress, _vault);
        vaultAddress = _vault;
    }

    // ========= VIEWS =========

    function getReserves() external view returns (uint112 _reserveDFT, uint112 _reserveStable, uint32 _blockTimestampLast) {
        _reserveDFT = reserveDFT;
        _reserveStable = reserveStable;
        _blockTimestampLast = blockTimestampLast;
    }

    /// @notice prix instantané (approx) DFT en STABLE (et inverse)
    function getPrices() external view returns (uint priceDFTinStable18, uint priceStableinDFT18) {
        require(reserveDFT > 0 && reserveStable > 0, "No liquidity");
        priceDFTinStable18 = (uint(reserveStable) * 1e18) / uint(reserveDFT);
        priceStableinDFT18 = (uint(reserveDFT) * 1e18) / uint(reserveStable);
    }

    /// @notice Quote "legacy" (0% frais dynamiques). Conserve pour compat.
    function getAmountOut(uint amountIn, bool stableToDft) public view returns (uint amountOut) {
        require(amountIn > 0, "amountIn=0");
        (uint rIn, uint rOut) = stableToDft ? (uint(reserveStable), uint(reserveDFT)) : (uint(reserveDFT), uint(reserveStable));
        require(rIn > 0 && rOut > 0, "No liquidity");
        amountOut = (amountIn * rOut) / (rIn + amountIn);
    }

    /// @notice Quote avec frais dynamiques actuels appliqués (utile pour UI/frontend)
    function getQuoteWithDynamicFees(uint amountIn, bool stableToDft)
        external
        view
        returns (uint amountOutNet, uint16 vaultFeeBps, uint16 burnFeeBps, uint ratioBps)
    {
        (vaultFeeBps, burnFeeBps, ratioBps) = _currentFees();
        if (stableToDft) {
            // fees: vault sur tokenIn (stable), burn sur DFT out
            (uint rS, uint rD) = (uint(reserveStable), uint(reserveDFT));
            require(rS > 0 && rD > 0, "No liquidity");

            uint vaultFeeIn = (amountIn * vaultFeeBps) / 10_000;
            uint effectiveIn = amountIn - vaultFeeIn;
            uint grossOut = (effectiveIn * rD) / (rS + effectiveIn);
            uint burnOutDFT = (grossOut * burnFeeBps) / 10_000;
            amountOutNet = grossOut - burnOutDFT;
        } else {
            // fees: vault sur tokenIn (DFT), burn sur DFT (sur l'input)
            (uint rD, uint rS) = (uint(reserveDFT), uint(reserveStable));
            require(rD > 0 && rS > 0, "No liquidity");

            uint burnDFT = (amountIn * burnFeeBps) / 10_000;
            uint vaultFeeIn = (amountIn * vaultFeeBps) / 10_000;
            uint effectiveIn = amountIn - burnDFT - vaultFeeIn;
            amountOutNet = (effectiveIn * rS) / (rD + effectiveIn);
        }
    }

    // ========= CORE (internal) =========

    function _update(uint balanceDFT, uint balanceStable) private {
        require(balanceDFT <= type(uint112).max && balanceStable <= type(uint112).max, "Overflow");
        reserveDFT = uint112(balanceDFT);
        reserveStable = uint112(balanceStable);
        blockTimestampLast = uint32(block.timestamp);
        emit Sync(reserveDFT, reserveStable);
    }

    function _sqrt(uint y) private pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    // --- Fenêtre glissante 1h sur le STABLE sortant de la pool ---

    function _decayedWithdrawalAmount() private view returns (uint256 decayed) {
        uint256 elapsed = block.timestamp - withdrawalTracker.lastUpdated;
        if (elapsed >= 3600) return 0;
        // décroissance linéaire
        decayed = (withdrawalTracker.amount * (3600 - elapsed)) / 3600;
    }

    function _bumpWithdrawal(uint256 amountStableOut) private {
        uint256 decayed = _decayedWithdrawalAmount();
        withdrawalTracker.amount = decayed + amountStableOut;
        withdrawalTracker.lastUpdated = block.timestamp;
    }

    function _currentFees() private view returns (uint16 vaultFeeBps, uint16 burnFeeBps, uint ratioBps) {
        uint256 rStable = uint(reserveStable);
        if (rStable == 0) {
            // fallback 1%
            return (50, 50, 0);
        }
        uint256 decayed = _decayedWithdrawalAmount();
        ratioBps = uint((decayed * 10_000) / rStable); // % retrait sur 1h (en bps)

        // Points d'ancrage:
        // 0%  -> 1% total (0.5 + 0.5)
        // 5%  -> 3.5% total (2.5 + 1)
        // 10% -> 7% total (5 + 2)
        uint totalFeeBps;
        if (ratioBps == 0) {
            totalFeeBps = 100;
        } else if (ratioBps >= 1000) {
            totalFeeBps = 700;
        } else {
            // interpolation linéaire 0%→10% (100→700)
            totalFeeBps = 100 + (ratioBps * (700 - 100)) / 1000;
        }
        // split 5:2 (≈ 71.428% / 28.571%)
        uint vaultPart = (totalFeeBps * 5) / 7;
        uint burnPart  = totalFeeBps - vaultPart;
        vaultFeeBps = uint16(vaultPart);
        burnFeeBps  = uint16(burnPart);
    }

    // ========= LIQUIDITY (public) =========

    function addLiquidity(uint amountDFTDesired, uint amountStableDesired)
        external
        nonReentrant
        returns (uint liquidity, uint amountDFTAdded, uint amountStableAdded)
    {
        require(amountDFTDesired > 0 && amountStableDesired > 0, "zero amounts");

        (uint112 _rDFT, uint112 _rStable,) = (reserveDFT, reserveStable, blockTimestampLast);

        tokenDFT.safeTransferFrom(msg.sender, address(this), amountDFTDesired);
        tokenStable.safeTransferFrom(msg.sender, address(this), amountStableDesired);

        uint balanceDFT = tokenDFT.balanceOf(address(this));
        uint balanceStable = tokenStable.balanceOf(address(this));

        uint dAdded = balanceDFT - _rDFT;
        uint sAdded = balanceStable - _rStable;
        require(dAdded > 0 && sAdded > 0, "no token in");

        uint _totalSupply = totalSupply();

        if (_totalSupply == 0) {
            liquidity = _sqrt(dAdded * sAdded);
            require(liquidity > 0, "insufficient liquidity minted");
        } else {
            uint l1 = (dAdded * _totalSupply) / _rDFT;
            uint l2 = (sAdded * _totalSupply) / _rStable;
            liquidity = l1 < l2 ? l1 : l2;
            require(liquidity > 0, "insufficient liquidity minted");
        }

        _mint(msg.sender, liquidity);
        _update(balanceDFT, balanceStable);

        emit Mint(msg.sender, dAdded, sAdded, liquidity);
        return (liquidity, dAdded, sAdded);
    }

    function removeLiquidity(uint liquidity)
        external
        nonReentrant
        returns (uint amountDFTOut, uint amountStableOut)
    {
        require(liquidity > 0, "zero liquidity");
        (uint112 _rDFT, uint112 _rStable,) = (reserveDFT, reserveStable, blockTimestampLast);

        uint _totalSupply = totalSupply();
        amountDFTOut = (liquidity * _rDFT) / _totalSupply;
        amountStableOut = (liquidity * _rStable) / _totalSupply;
        require(amountDFTOut > 0 && amountStableOut > 0, "insufficient amounts");

        _burn(msg.sender, liquidity);

        tokenDFT.safeTransfer(msg.sender, amountDFTOut);
        tokenStable.safeTransfer(msg.sender, amountStableOut);

        // track: STABLE est sorti de la pool
        _bumpWithdrawal(amountStableOut);

        uint balanceDFT = tokenDFT.balanceOf(address(this));
        uint balanceStable = tokenStable.balanceOf(address(this));
        _update(balanceDFT, balanceStable);

        emit Burn(msg.sender, liquidity, amountDFTOut, amountStableOut);
    }

    // ========= SWAPS =========

    /// @notice swap STABLE -> DFT (fee vault en STABLE sur input, burn en DFT sur output)
    function swapStableForDFT(uint amountStableIn, uint minDFTOut)
        external
        nonReentrant
        returns (uint amountOut)
    {
        require(amountStableIn > 0, "amountIn=0");
        require(vaultAddress != address(0), "vault=0");

        (uint112 _rDFT, uint112 _rStable,) = (reserveDFT, reserveStable, blockTimestampLast);
        require(_rDFT > 0 && _rStable > 0, "No liquidity");

        tokenStable.safeTransferFrom(msg.sender, address(this), amountStableIn);

        // amount réellement reçu (tokens à frais supportés)
        uint balanceStable = tokenStable.balanceOf(address(this));
        uint actualIn = balanceStable - _rStable;

        (uint16 vaultFeeBps, uint16 burnFeeBps, uint ratioBps) = _currentFees();

        // fee vault (en STABLE, sur l'input)
        uint vaultFeeIn = (actualIn * vaultFeeBps) / 10_000;
        if (vaultFeeIn > 0) tokenStable.safeTransfer(vaultAddress, vaultFeeIn);

        uint effectiveIn = actualIn - vaultFeeIn;

        // out brut
        uint grossOut = (effectiveIn * _rDFT) / (_rStable + effectiveIn);

        // burn fee en DFT (sur l'output)
        uint burnOutDFT = (grossOut * burnFeeBps) / 10_000;
        uint netOut = grossOut - burnOutDFT;
        require(netOut >= minDFTOut, "slippage");

        if (burnOutDFT > 0) tokenDFT.safeTransfer(BURN_ADDRESS, burnOutDFT);
        tokenDFT.safeTransfer(msg.sender, netOut);

        // maj réserves
        uint balanceDFT = tokenDFT.balanceOf(address(this));
        balanceStable = tokenStable.balanceOf(address(this));
        _update(balanceDFT, balanceStable);

        emit FeesApplied(msg.sender, true, vaultFeeBps, burnFeeBps, vaultFeeIn, burnOutDFT, ratioBps);
        emit Swap(msg.sender, address(tokenStable), actualIn, address(tokenDFT), netOut);
        return netOut;
    }

    /// @notice swap DFT -> STABLE (burn en DFT sur input, fee vault en DFT sur input)
    function swapDFTForStable(uint amountDFTIn, uint minStableOut)
        external
        nonReentrant
        returns (uint amountOut)
    {
        require(amountDFTIn > 0, "amountIn=0");
        require(vaultAddress != address(0), "vault=0");

        (uint112 _rDFT, uint112 _rStable,) = (reserveDFT, reserveStable, blockTimestampLast);
        require(_rDFT > 0 && _rStable > 0, "No liquidity");

        tokenDFT.safeTransferFrom(msg.sender, address(this), amountDFTIn);

        uint balanceDFT = tokenDFT.balanceOf(address(this));
        uint actualIn = balanceDFT - _rDFT;

        (uint16 vaultFeeBps, uint16 burnFeeBps, uint ratioBps) = _currentFees();

        // burn + vault en DFT sur l'input
        uint burnInDFT = (actualIn * burnFeeBps) / 10_000;
        uint vaultFeeIn = (actualIn * vaultFeeBps) / 10_000;

        if (burnInDFT > 0) tokenDFT.safeTransfer(BURN_ADDRESS, burnInDFT);
        if (vaultFeeIn > 0) tokenDFT.safeTransfer(vaultAddress, vaultFeeIn);

        uint effectiveIn = actualIn - burnInDFT - vaultFeeIn;

        uint stableOut = (effectiveIn * _rStable) / (_rDFT + effectiveIn);
        require(stableOut >= minStableOut, "slippage");
        tokenStable.safeTransfer(msg.sender, stableOut);

        // track: STABLE sort de la pool
        _bumpWithdrawal(stableOut);

        // maj réserves
        balanceDFT = tokenDFT.balanceOf(address(this));
        uint balanceStable = tokenStable.balanceOf(address(this));
        _update(balanceDFT, balanceStable);

        emit FeesApplied(msg.sender, false, vaultFeeBps, burnFeeBps, vaultFeeIn, burnInDFT, ratioBps);
        emit Swap(msg.sender, address(tokenDFT), actualIn, address(tokenStable), stableOut);
        return stableOut;
    }
}

