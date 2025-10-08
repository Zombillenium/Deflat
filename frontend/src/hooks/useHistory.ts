import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { decodeEventLog, getEventSelector } from "viem";
import {
  POOL_ABI,
  VAULT_ABI,
  POOL_ADDRESS,
  VAULT_ADDRESS,
} from "../contracts";
import { ethereumSepolia } from "../main";

// 🔹 formate intelligemment les BigInt et valeurs numériques
function fmtValue(key: string, v: any): string {
  try {
    // adresses Ethereum → garder brutes
    if (typeof v === "string" && v.startsWith("0x")) {
      return `${key}: ${v.slice(0, 6)}…${v.slice(-4)}`;
    }

    const isBigInt =
      typeof v === "bigint" ||
      (typeof v === "string" && /^[0-9]{8,}$/.test(v)); // longs chiffres

    // 🔸 BigInt / valeurs 18 décimales
    if (isBigInt) {
      const n = Number(v) / 1e18;
      const symbol = /stable|tokenIn/i.test(key)
        ? "STABLE"
        : /dft|tokenOut/i.test(key)
        ? "DFT"
        : "";

      // Format hybride : espaces pour milliers, point pour décimales
      const nStr = (Math.round(n * 100) / 100)
        .toFixed(2)
        .replace(/\B(?=(\d{3})+(?!\d))/g, " ");

      return `${key}: ${nStr}${symbol ? " " + symbol : ""}`;
    }

    // 🔸 petits nombres normaux
    if (!isNaN(Number(v))) {
      const nStr = (Math.round(Number(v) * 100) / 100)
        .toFixed(2)
        .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
      return `${key}: ${nStr}`;
    }

    // 🔸 fallback texte brut
    return `${key}: ${v}`;
  } catch {
    return `${key}: ${v}`;
  }
}

/**
 * Historique Pool + Vault lisible
 * - compat Alchemy Free tier (10 blocs)
 * - formate automatiquement les bigints et adresses
 * - persiste 1h
 */
export function useHistory() {
  const [history, setHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem("deflatHistory");
    return saved ? JSON.parse(saved) : [];
  });

  const publicClient = usePublicClient({ chainId: ethereumSepolia.id });

  useEffect(() => {
    if (!publicClient) return;

    const fetchEvents = async () => {
      try {
        const current = await publicClient.getBlockNumber();
        const step = 10n;
        const blocksBack = 80n; // ~10 min
        const now = Math.floor(Date.now() / 1000);

        const poolTopics = [
          getEventSelector("Swap(address,address,uint256,address,uint256)"),
          getEventSelector(
            "FeesApplied(address,bool,uint16,uint16,uint256,uint256,uint256)"
          ),
          getEventSelector("Sync(uint112,uint112)"),
          getEventSelector("Mint(address,uint256,uint256,uint256)"),
          getEventSelector("Burn(address,uint256,uint256,uint256)"),
        ];
        const vaultTopics = [
          getEventSelector(
            "Rebalanced(string,uint256,uint256,int256,uint256,uint256)"
          ),
          getEventSelector("SeededLiquidity(uint256,uint256,uint256)"),
          getEventSelector("EmaUpdated(uint256,uint256,uint32,uint256)"),
        ];

        const allLogs: any[] = [];
        for (let from = current - blocksBack; from < current; from += step) {
          const to = from + step - 1n;
          const [poolBatch, vaultBatch] = await Promise.all([
            publicClient.getLogs({
              address: POOL_ADDRESS as `0x${string}`,
              topics: [poolTopics],
              fromBlock: from,
              toBlock: to,
            }),
            publicClient.getLogs({
              address: VAULT_ADDRESS as `0x${string}`,
              topics: [vaultTopics],
              fromBlock: from,
              toBlock: to,
            }),
          ]);
          allLogs.push(...poolBatch, ...vaultBatch);
        }

        const decode = (logs: any[], abi: any, source: string) =>
          logs
            .map((log) => {
              try {
                const d = decodeEventLog({
                  abi,
                  data: log.data,
                  topics: log.topics,
                });

                // ⬇️ Séparation des valeurs par "; "
                const args = Object.entries(d.args || {}).map(([k, v]) =>
                  fmtValue(k, v)
                );

                return {
                  ts: now,
                  source,
                  label: d.eventName,
                  details: args.join("; "),
                  tx: log.transactionHash,
                };
              } catch {
                return null;
              }
            })
            .filter(Boolean);

        const decoded = [
          ...decode(allLogs, POOL_ABI, "Pool"),
          ...decode(allLogs, VAULT_ABI, "Vault"),
        ];

        setHistory((prev) => {
          const updated = [...prev, ...decoded]
            .filter((e) => now - e.ts <= 3600)
            .filter(
              (v, i, arr) =>
                arr.findIndex((x) => x.tx === v.tx && x.label === v.label) === i
            )
            .slice(-300);

          localStorage.setItem("deflatHistory", JSON.stringify(updated));
          return updated;
        });
      } catch (err) {
        console.warn("⚠️ Erreur lecture logs:", err);
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 10_000);
    return () => clearInterval(interval);
  }, [publicClient]);

  return { history };
}
