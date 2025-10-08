import { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import { POOL_ABI, POOL_ADDRESS } from "../contracts";
import { ethereumSepolia } from "../main";

/**
 * Récupère et enregistre les données de la pool
 * -> met à jour toutes les 10s
 * -> conserve 1h d’historique (3600 s)
 * -> persiste dans localStorage
 */
export function usePoolData() {
  const [poolResSeries, setPoolResSeries] = useState<
    { ts: number; dft: bigint; stable: bigint }[]
  >(() => {
    // 🔁 charger l’historique précédent s’il existe
    const saved = localStorage.getItem("poolResSeries");
    return saved ? JSON.parse(saved, (_, v) => (typeof v === "string" && v.endsWith("n") ? BigInt(v.slice(0, -1)) : v)) : [];
  });

  // ⚙️ Lecture des réserves et prix
  const poolReserves = useReadContract({
    chainId: ethereumSepolia.id,
    abi: POOL_ABI,
    address: POOL_ADDRESS as `0x${string}`,
    functionName: "getReserves",
    query: { enabled: true },
  });
  const poolPrices = useReadContract({
    chainId: ethereumSepolia.id,
    abi: POOL_ABI,
    address: POOL_ADDRESS as `0x${string}`,
    functionName: "getPrices",
    query: { enabled: true },
  });

  // 🕒 Rafraîchissement toutes les 10 s
  useEffect(() => {
    const update = () => {
      poolReserves.refetch?.();
      poolPrices.refetch?.();
    };
    const interval = setInterval(update, 10_000);
    update(); // lecture immédiate
    return () => clearInterval(interval);
  }, [poolReserves.refetch, poolPrices.refetch]);

  // 🧮 Ajouter un point à chaque nouvelle lecture
  useEffect(() => {
    const data = poolReserves.data as [bigint, bigint, number] | undefined;
    if (!data) return;
    const [_rDFT, _rStable] = data;
    const now = Math.floor(Date.now() / 1000);

    setPoolResSeries((prev) => {
      const newPoint = { ts: now, dft: _rDFT, stable: _rStable };
      const updated = [...prev, newPoint].filter((p) => now - p.ts <= 3600); // garder 1 h

      // 🔒 persistance locale
      localStorage.setItem(
        "poolResSeries",
        JSON.stringify(updated, (_, v) => (typeof v === "bigint" ? v.toString() + "n" : v))
      );
      return updated;
    });
  }, [poolReserves.data]);

  return {
    poolDFT: { data: poolReserves?.data ? (poolReserves.data as any)[0] : 0n },
    poolStable: {
      data: poolReserves?.data ? (poolReserves.data as any)[1] : 0n,
    },
    poolPrices,
    poolResSeries,
  };
}
