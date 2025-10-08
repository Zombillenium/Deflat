import { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import { VAULT_ABI, VAULT_ADDRESS, DFT_ABI, STABLE_ABI, DFT_ADDRESS, STABLE_ADDRESS } from "../contracts";
import { ethereumSepolia } from "../main";

/**
 * Récupère et met à jour les données du LiquidityVault
 * - refresh toutes les 10 s
 * - conserve 1 h d’historique EMA / Spot
 * - persiste localement
 */
export function useVaultData() {
  const [priceSeries, setPriceSeries] = useState<
    { ts: number; ema30: number; ema120: number; spot: number }[]
  >(() => {
    const saved = localStorage.getItem("vaultPriceSeries");
    return saved ? JSON.parse(saved) : [];
  });

  // === Balances de tokens (DFT et STABLE dans le vault)
  const vaultDFT = useReadContract({
    chainId: ethereumSepolia.id,
    abi: DFT_ABI,
    address: DFT_ADDRESS as `0x${string}`,
    functionName: "balanceOf",
    args: [VAULT_ADDRESS],
    query: { enabled: true },
  });

  const vaultStable = useReadContract({
    chainId: ethereumSepolia.id,
    abi: STABLE_ABI,
    address: STABLE_ADDRESS as `0x${string}`,
    functionName: "balanceOf",
    args: [VAULT_ADDRESS],
    query: { enabled: true },
  });

  // === Variables publiques du vault
  const emaShort = useReadContract({
    chainId: ethereumSepolia.id,
    abi: VAULT_ABI,
    address: VAULT_ADDRESS as `0x${string}`,
    functionName: "emaShort",
    query: { enabled: true },
  });

  const emaLong = useReadContract({
    chainId: ethereumSepolia.id,
    abi: VAULT_ABI,
    address: VAULT_ADDRESS as `0x${string}`,
    functionName: "emaLong",
    query: { enabled: true },
  });

  const spentTodayStableEq = useReadContract({
    chainId: ethereumSepolia.id,
    abi: VAULT_ABI,
    address: VAULT_ADDRESS as `0x${string}`,
    functionName: "spentTodayStableEq",
    query: { enabled: true },
  });

  // === Rafraîchissement périodique
  useEffect(() => {
    const refresh = () => {
      vaultDFT.refetch?.();
      vaultStable.refetch?.();
      emaShort.refetch?.();
      emaLong.refetch?.();
      spentTodayStableEq.refetch?.();
    };
    refresh();
    const interval = setInterval(refresh, 10_000);
    return () => clearInterval(interval);
  }, [vaultDFT.refetch, vaultStable.refetch, emaShort.refetch, emaLong.refetch, spentTodayStableEq.refetch]);

  // === Construction de l’historique (EMA / Spot)
  useEffect(() => {
    if (!emaShort?.data || !emaLong?.data) return;

    const now = Math.floor(Date.now() / 1000);
    const dftBal = Number(vaultDFT.data || 0n) / 1e18;
    const stableBal = Number(vaultStable.data || 0n) / 1e18;
    const spot = dftBal > 0 ? stableBal / dftBal : 0;

    const newPoint = {
      ts: now,
      ema30: Number(emaShort.data) / 1e18,
      ema120: Number(emaLong.data) / 1e18,
      spot,
    };

    setPriceSeries((prev) => {
      const updated = [...prev, newPoint].filter((p) => now - p.ts <= 3600);
      localStorage.setItem("vaultPriceSeries", JSON.stringify(updated));
      return updated;
    });
  }, [emaShort.data, emaLong.data, vaultDFT.data, vaultStable.data]);

  // === Données calculées
  const spentTodayNum = Number(spentTodayStableEq.data || 0n) / 1e18;
  const dailyBudgetAbs = 10000; // valeur de référence si non exposée on-chain
  const budgetPct = dailyBudgetAbs ? (100 * spentTodayNum) / dailyBudgetAbs : 0;

  const stableSharePct =
    (Number(vaultStable.data || 0n) /
      ((Number(vaultStable.data || 0n) + Number(vaultDFT.data || 1n)) || 1)) *
    100;

  return {
    vaultDFT,
    vaultStable,
    emaShort,
    emaLong,
    spentToday: spentTodayStableEq,
    priceSeries,
    budgetPct,
    spentTodayNum,
    dailyBudgetAbs,
    stableSharePct: isNaN(stableSharePct) ? 0 : stableSharePct,
  };
}
