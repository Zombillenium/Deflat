import { useMemo } from "react";
import { ethers } from "ethers";
import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import {
  DFT_ABI,
  STABLE_ABI,
  VAULT_ABI,
  DFT_ADDRESS,
  STABLE_ADDRESS,
  VAULT_ADDRESS,
  POOL_ABI,
  POOL_ADDRESS,
} from "../contracts";
import { to18, nowSec } from "../utils/format";

export function useVaultData(priceSpot: number) {
  const vaultDFT = useReadContract({
    abi: DFT_ABI,
    address: DFT_ADDRESS as `0x${string}`,
    functionName: "balanceOf",
    args: [VAULT_ADDRESS],
  });

  const vaultStable = useReadContract({
    abi: STABLE_ABI,
    address: STABLE_ADDRESS as `0x${string}`,
    functionName: "balanceOf",
    args: [VAULT_ADDRESS],
  });

  const emaShort = useReadContract({
    abi: VAULT_ABI,
    address: VAULT_ADDRESS as `0x${string}`,
    functionName: "emaShort",
  });

  const emaLong = useReadContract({
    abi: VAULT_ABI,
    address: VAULT_ADDRESS as `0x${string}`,
    functionName: "emaLong",
  });

  const spentToday = useReadContract({
    abi: VAULT_ABI,
    address: VAULT_ADDRESS as `0x${string}`,
    functionName: "spentTodayStableEq",
  });

  const maxDailyBudgetBps = useReadContract({
    abi: VAULT_ABI,
    address: VAULT_ADDRESS as `0x${string}`,
    functionName: "maxDailyBudgetBps",
  });

  const nextAllowedAt = useReadContract({
    abi: VAULT_ABI,
    address: VAULT_ADDRESS as `0x${string}`,
    functionName: "nextAllowedAt",
  });

  const maxStressRatioBps = useReadContract({
    abi: VAULT_ABI,
    address: VAULT_ADDRESS as `0x${string}`,
    functionName: "maxStressRatioBps",
  });

  const quoteDyn = useReadContract({
    abi: POOL_ABI,
    address: POOL_ADDRESS as `0x${string}`,
    functionName: "getQuoteWithDynamicFees",
    args: [ethers.parseUnits("1", 18), true],
  });

  const vaultStableNum = to18(vaultStable.data as bigint | undefined);
  const vaultDFTNum = to18(vaultDFT.data as bigint | undefined);
  const vaultEquity = useMemo(
    () => vaultStableNum + vaultDFTNum * priceSpot,
    [vaultStableNum, vaultDFTNum, priceSpot]
  );

  const stableSharePct = useMemo(
    () => (vaultEquity > 0 ? (vaultStableNum / vaultEquity) * 100 : 0),
    [vaultStableNum, vaultEquity]
  );

  const spentTodayNum = to18(spentToday.data as bigint | undefined);
  const dailyBudgetBps = Number(maxDailyBudgetBps.data || 0n);
  const dailyBudgetAbs = useMemo(
    () => (vaultEquity * dailyBudgetBps) / 10000,
    [vaultEquity, dailyBudgetBps]
  );

  const budgetPct = useMemo(
    () => (dailyBudgetAbs > 0 ? Math.min(100, (spentTodayNum / dailyBudgetAbs) * 100) : 0),
    [spentTodayNum, dailyBudgetAbs]
  );

  const stressRatioBps = useMemo(() => {
    if (!quoteDyn.data) return 0;
    const tuple = quoteDyn.data as readonly [bigint, bigint, bigint, bigint];
    return Number(tuple[3] || 0n);
  }, [quoteDyn.data]);

  const stressMax = Number(maxStressRatioBps.data || 0n);

  const isCooldown = Number(nextAllowedAt.data || 0n) > nowSec();

  const vaultStatus = useMemo(() => {
    if (isCooldown) return { label: "⏸ Cooldown", color: "#f59e0b" };
    if (stressRatioBps > stressMax) return { label: "⏸ Skip (Stress)", color: "#ef4444" };
    if (dailyBudgetAbs > 0 && spentTodayNum >= dailyBudgetAbs)
      return { label: "⏸ Budget atteint", color: "#ef4444" };
    return { label: "✅ Active", color: "#10b981" };
  }, [isCooldown, stressRatioBps, stressMax, dailyBudgetAbs, spentTodayNum]);

  return {
    vaultDFT,
    vaultStable,
    emaShort,
    emaLong,
    spentToday,
    vaultEquity,
    stableSharePct,
    budgetPct,
    spentTodayNum,
    dailyBudgetAbs,
    stressRatioBps,
    stressMax,
    isCooldown,
    vaultStatus,
    nextAllowedAt,
  };
}

