// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../interfaces/ILiquidityPool.sol";

/**
 * LiquidityVault v3 (sans oracle)
 * - Compare deux TWAP/EMA (30min vs 120min) calculés depuis le spot de la pool.
 * - Si EMA30 au-dessus d'EMA120 au-delà d'un seuil => BUY (lisser la hausse).
 * - Si EMA30 en-dessous d'EMA120 au-delà d'un seuil => SELL (lisser la baisse).
 * - Sizing asymétrique + caps + cooldown + budget 24h + garde-fous d'allocation + skip si pool en stress.
 */
contract LiquidityVault is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable stable;
    IERC20 public immutable dft;
    ILiquidityPool public pool;

    // ============ Params TWAP ============
    uint32  public shortPeriodSec = 30 minutes;   // EMA court
    uint32  public longPeriodSec  = 120 minutes;  // EMA long
    uint256 public emaShort;  // 1e18 (prix DFT en STABLE)
    uint256 public emaLong;   // 1e18
    uint32  public lastEmaUpdate; // timestamp dernier update

    // ============ Triggers & sizing ============
    uint16  public triggerBps = 100;      // 1% d'écart requis pour agir
    uint16  public slippageBps = 500;      // 5% slippage max
    uint16  public kUpPer100bps   = 25;   // +0.25% des fonds en stable par 100 bps au-dessus du seuil
    uint16  public kDownPer100bps = 50;   // +0.5%  des fonds (réf stable) par 100 bps au-dessus du seuil
    uint16  public maxActionBpsBuy  = 100; // 1% max de fonds en stable par action
    uint16  public maxActionBpsSell = 200; // 2% max de fonds (réf stable) par action
    uint32  public minSpacingSec    = 2 minutes; // cooldown
    uint32  public nextAllowedAt;   // timestamp après lequel on peut agir

    // ============ Stress / no-trade band ============
    // Si la pool signale un ratio de retraits (1h) élevé, on évite d'intervenir
    uint16  public maxStressRatioBps = 800; // 8% (au-delà on skip l'action)

    // ============ Budget 24h ============
    // Plafond de dépenses quotidiennes en bps de l'equity (stable + dft*spot)
    uint16  public maxDailyBudgetBps = 300; // 3% de l'equity max par 24h
    uint256 public spentTodayStableEq;      // stable-equivalent dépensé aujourd'hui
    uint32  public budgetDayStart;          // ancre 24h rolling

    // ============ Allocation guardrails ============
    uint16  public targetStableShareBps = 5000; // 50% stable, 50% DFT
    uint16  public allocBandBps         = 1000; // +/-10% tolérance

    // ============ Events ============
    event PoolSet(address indexed pool);
    event ParamsUpdated(
        uint16 triggerBps, uint16 slippageBps,
        uint16 kUpPer100bps, uint16 kDownPer100bps,
        uint16 maxActionBpsBuy, uint16 maxActionBpsSell,
        uint32 minSpacingSec, uint16 maxStressRatioBps,
        uint16 maxDailyBudgetBps, uint16 targetStableShareBps, uint16 allocBandBps
    );
    event EmaUpdated(uint256 emaShort, uint256 emaLong, uint32 ts, uint256 spot);
    event Rebalanced(string action, uint256 amountIn, uint256 amountOut, int256 deltaBps, uint256 stableEqBefore, uint256 stableEqAfter);
    event SeededLiquidity(uint256 dftAdded, uint256 stableAdded, uint256 lpMinted);

    constructor(
        address _stable,
        address _dft,
        address _pool,
        address _owner
    ) Ownable(_owner) {
        require(_stable != address(0) && _dft != address(0) && _pool != address(0), "zero addr");
        stable = IERC20(_stable);
        dft    = IERC20(_dft);
        pool   = ILiquidityPool(_pool);

        // approvals infinis vers la pool
        SafeERC20.forceApprove(stable, _pool, type(uint256).max);
        SafeERC20.forceApprove(dft, _pool, type(uint256).max);

        lastEmaUpdate  = uint32(block.timestamp);
        budgetDayStart = uint32(block.timestamp);
        emit PoolSet(_pool);
    }

    // ============ Admin ============

    function setPool(address _pool) external onlyOwner {
        require(_pool != address(0), "zero addr");
        pool = ILiquidityPool(_pool);
        SafeERC20.forceApprove(stable, _pool, 0);
        SafeERC20.forceApprove(dft, _pool, 0);
        SafeERC20.forceApprove(stable, _pool, type(uint256).max);
        SafeERC20.forceApprove(dft, _pool, type(uint256).max);
        emit PoolSet(_pool);
    }

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
    ) external onlyOwner {
        require(_slippageBps <= 300, "slippage too high");
        require(_targetStableShareBps <= 10000, "bad target");
        require(_allocBandBps <= 5000, "bad band");
        triggerBps          = _triggerBps;
        slippageBps         = _slippageBps;
        kUpPer100bps        = _kUpPer100bps;
        kDownPer100bps      = _kDownPer100bps;
        maxActionBpsBuy     = _maxActionBpsBuy;
        maxActionBpsSell    = _maxActionBpsSell;
        minSpacingSec       = _minSpacingSec;
        maxStressRatioBps   = _maxStressRatioBps;
        maxDailyBudgetBps   = _maxDailyBudgetBps;
        targetStableShareBps= _targetStableShareBps;
        allocBandBps        = _allocBandBps;
        emit ParamsUpdated(
            triggerBps, slippageBps, kUpPer100bps, kDownPer100bps,
            maxActionBpsBuy, maxActionBpsSell, minSpacingSec,
            maxStressRatioBps, maxDailyBudgetBps, targetStableShareBps, allocBandBps
        );
    }

    // ============ Views utils ============

    function getPoolPriceDFTInStable18() public view returns (uint256 price) {
        (uint pDFTinStable18, ) = pool.getPrices();
        return pDFTinStable18; // 1 DFT en STABLE (1e18)
    }

    function _stableEquivalent(uint256 priceDFT) internal view returns (uint256 eq) {
        // equity (stable + dft*price)
        uint256 s = stable.balanceOf(address(this));
        uint256 d = dft.balanceOf(address(this));
        eq = s + (d * priceDFT) / 1e18;
    }

    function _allocationStableShareBps(uint256 priceDFT) internal view returns (uint16 shareBps) {
        uint256 s = stable.balanceOf(address(this));
        uint256 d = dft.balanceOf(address(this));
        uint256 eq = s + (d * priceDFT) / 1e18;
        if (eq == 0) return 0;
        shareBps = uint16((s * 10000) / eq);
    }

    // ============ EMA / TWAP (EMA discrète, pas de boucle) ============

    function _updateEmas() internal {
        uint256 spot = getPoolPriceDFTInStable18();
        uint32 tsNow = uint32(block.timestamp);
        if (emaLong == 0 || emaShort == 0) {
            emaLong = spot;
            emaShort = spot;
            lastEmaUpdate = tsNow;
            emit EmaUpdated(emaShort, emaLong, tsNow, spot);
            return;
        }

        uint32 dt = tsNow - lastEmaUpdate;
        if (dt == 0) return;

        // facteur discret: f = min(dt, period)/period  (borne 0..1)
        uint256 fShort = dt >= shortPeriodSec ? 1e18 : (uint256(dt) * 1e18) / shortPeriodSec;
        uint256 fLong  = dt >= longPeriodSec  ? 1e18 : (uint256(dt) * 1e18) / longPeriodSec;

        // ema = ema + f*(spot - ema)
        emaShort = emaShort + ((spot > emaShort ? (spot - emaShort) : (emaShort - spot)) * fShort / 1e18) * (spot > emaShort ? 1 : uint256(0)) 
                           - ((spot < emaShort ? (emaShort - spot) : 0) * fShort / 1e18);

        emaLong  = emaLong  + ((spot > emaLong  ? (spot - emaLong)  : (emaLong  - spot)) * fLong  / 1e18) * (spot > emaLong  ? 1 : uint256(0))
                           - ((spot < emaLong  ? (emaLong  - spot)  : 0) * fLong  / 1e18);

        lastEmaUpdate = tsNow;
        emit EmaUpdated(emaShort, emaLong, tsNow, spot);
    }

    function getDeltaBps() public view returns (int256 deltaBps) {
        if (emaLong == 0) return 0;
        // delta = (emaShort - emaLong) / emaLong * 1e4
        if (emaShort >= emaLong) {
            deltaBps = int256(((emaShort - emaLong) * 10000) / emaLong);
        } else {
            deltaBps = -int256(((emaLong - emaShort) * 10000) / emaLong);
        }
    }

    // ============ Actions bas niveau (via pool) ============

    function buyDFTViaPool(uint256 stableIn) public onlyOwner returns (uint256 dftOut) {
        require(stableIn > 0, "zero in");
        uint256 q = pool.getAmountOut(stableIn, true);
        uint256 minOut = (q * (10_000 - slippageBps)) / 10_000;
        dftOut = pool.swapStableForDFT(stableIn, minOut);
    }

    function sellDFTViaPool(uint256 dftIn) public onlyOwner returns (uint256 stableOut) {
        require(dftIn > 0, "zero in");
        uint256 q = pool.getAmountOut(dftIn, false);
        uint256 minOut = (q * (10_000 - slippageBps)) / 10_000;
        stableOut = pool.swapDFTForStable(dftIn, minOut);
    }

    // ============ Budget 24h ============

    function _rollBudgetWindowIfNeeded() internal {
        if (block.timestamp >= budgetDayStart + 24 hours) {
            budgetDayStart = uint32(block.timestamp);
            spentTodayStableEq = 0;
        }
    }

    // ============ Rebalance principal (drift EMA30 vs EMA120) ============

    function rebalanceOnceByPriceDrift() external onlyOwner {
        require(block.timestamp >= nextAllowedAt, "cooldown");
        _updateEmas();

        // si pool en stress, on skip (évite d'aller contre le marché quand la pool charge déjà des frais élevés)
        (uint outNet,, , uint ratioBps) = pool.getQuoteWithDynamicFees(1e18, true); // quote symbolique
        // ratioBps = % retrait (1h) côté pool
        if (ratioBps > maxStressRatioBps) {
            nextAllowedAt = uint32(block.timestamp) + minSpacingSec;
            return;
        }

        int256 delta = getDeltaBps();
        int256 trig  = int256(int16(triggerBps));
        if (delta == 0) {
            nextAllowedAt = uint32(block.timestamp) + minSpacingSec;
            return;
        }

        uint256 spot = getPoolPriceDFTInStable18();
        uint256 equityBefore = _stableEquivalent(spot);

        // Budget 24h
        _rollBudgetWindowIfNeeded();
        uint256 dailyMax = (equityBefore * maxDailyBudgetBps) / 10_000;
        if (spentTodayStableEq >= dailyMax) {
            nextAllowedAt = uint32(block.timestamp) + minSpacingSec;
            return;
        }
        uint256 dailyRemaining = dailyMax - spentTodayStableEq;

        // Allocation bounds (50/50 +/- band)
        uint16 stableShare = _allocationStableShareBps(spot);
        uint16 minShare = targetStableShareBps > allocBandBps ? targetStableShareBps - allocBandBps : 0;
        uint16 maxShare = targetStableShareBps + allocBandBps;
        if (stableShare > 10000) stableShare = 10000;
        if (maxShare > 10000) maxShare = 10000;

        if (delta >= trig) {
            // Prix monte -> BUY (utiliser % des fonds en STABLE)
            uint256 sBal = stable.balanceOf(address(this));
            if (sBal == 0) { nextAllowedAt = uint32(block.timestamp) + minSpacingSec; return; }

            // sizing
            uint256 excess = uint256(delta - trig); // bps au-dessus du seuil
            uint256 actionBps = (excess * kUpPer100bps) / 100; // par tranches de 100 bps
            if (actionBps > maxActionBpsBuy) actionBps = maxActionBpsBuy;

            uint256 stableIn = (sBal * actionBps) / 10_000;
            if (stableIn == 0) { nextAllowedAt = uint32(block.timestamp) + minSpacingSec; return; }

            // respect du budget 24h
            if (stableIn > dailyRemaining) stableIn = dailyRemaining;
            if (stableIn == 0) { nextAllowedAt = uint32(block.timestamp) + minSpacingSec; return; }

            // Allocation guardrail : si on est déjà trop "léger" en stable, éviter de BUY
            if (stableShare <= minShare && delta < int256(uint256(triggerBps) * 2)) {
                // on est déjà très bas en stable, éviter d'accélérer la baisse
                nextAllowedAt = uint32(block.timestamp) + minSpacingSec;
                return;
            }

            uint256 dftOut = buyDFTViaPool(stableIn);
            spentTodayStableEq += stableIn;

            uint256 equityAfter = _stableEquivalent(spot);
            emit Rebalanced("BUY", stableIn, dftOut, delta, equityBefore, equityAfter);
        } else if (-delta >= trig) {
            // Prix baisse -> SELL (utilise % des fonds en référence stable)
            uint256 sBalRef = stable.balanceOf(address(this));
            uint256 dBal    = dft.balanceOf(address(this));
            if (dBal == 0) { nextAllowedAt = uint32(block.timestamp) + minSpacingSec; return; }

            uint256 excess = uint256((-delta) - trig); // bps au-dessus du seuil
            uint256 actionBps = (excess * kDownPer100bps) / 100;
            if (actionBps > maxActionBpsSell) actionBps = maxActionBpsSell;

            // on vise à obtenir 'stableTarget' en sortie (~% de sBalRef), puis converti en DFT in estimé
            uint256 stableTarget = (sBalRef * actionBps) / 10_000;
            if (stableTarget == 0) { nextAllowedAt = uint32(block.timestamp) + minSpacingSec; return; }

            if (stableTarget > dailyRemaining) stableTarget = dailyRemaining;
            if (stableTarget == 0) { nextAllowedAt = uint32(block.timestamp) + minSpacingSec; return; }

            uint256 dftInEst = (stableTarget * 1e18) / spot; // approx
            if (dftInEst > dBal) dftInEst = dBal;
            if (dftInEst == 0) { nextAllowedAt = uint32(block.timestamp) + minSpacingSec; return; }

            // Allocation guardrail : si on est déjà trop "haut" en stable, éviter de SELL si signal faible
            if (stableShare >= maxShare && -delta < int256(uint256(triggerBps) * 2)) {
                nextAllowedAt = uint32(block.timestamp) + minSpacingSec;
                return;
            }

            uint256 stableOut = sellDFTViaPool(dftInEst);
            spentTodayStableEq += stableOut;

            uint256 equityAfter = _stableEquivalent(spot);
            emit Rebalanced("SELL", dftInEst, stableOut, delta, equityBefore, equityAfter);
        }

        nextAllowedAt = uint32(block.timestamp) + minSpacingSec;
    }

    // ============ Seed Liquidity (pratique tests) ============

    function seedLiquidity(uint256 amountDFT, uint256 amountStable) external onlyOwner {
        require(amountDFT > 0 && amountStable > 0, "zeros");
        (uint liq, uint dAdded, uint sAdded) = pool.addLiquidity(amountDFT, amountStable);
        emit SeededLiquidity(dAdded, sAdded, liq);
    }

    // ============ Rescue ============

    function rescueToken(address token, uint256 amount, address to) external onlyOwner {
        require(to != address(0), "zero to");
        IERC20(token).safeTransfer(to, amount);
    }
}

