// src/hooks/useHistory.ts
import { useEffect, useState } from "react";
import { decodeEventLog, formatUnits } from "viem";
import { usePublicClient } from "wagmi";
import { VAULT_ABI, POOL_ABI, VAULT_ADDRESS, POOL_ADDRESS } from "../contracts";

// 🔧 Transforme les args (BigInt -> string lisible)
function serializeArgs(args: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(args).map(([k, v]) => {
      if (typeof v === "bigint") {
        // Conversion en ETH/Stable avec 18 décimales
        return [k, formatUnits(v, 18)];
      }
      return [k, v];
    })
  );
}

export function useHistory() {
  const publicClient = usePublicClient();
  const [history, setHistory] = useState<
    { ts: number; label: string; tx: `0x${string}`; details: string }[]
  >([]);

  useEffect(() => {
    if (!publicClient) return;

    // Handler pour traiter un log
    const handleLog = async (log: any, prefix: string, abi: any) => {
      try {
        const decoded = decodeEventLog({
          abi,
          data: log.data,
          topics: log.topics,
        });

        const ts = Number(
          (await publicClient.getBlock({ blockHash: log.blockHash! }))
            ?.timestamp || 0n
        );

        // 🔧 Sérialisation safe (BigInt -> string)
        const safeArgs = serializeArgs(decoded.args);

        setHistory((prev) => {
          const newRows = [
            {
              ts,
              label: `${prefix} ${decoded.eventName}`,
              tx: log.transactionHash!,
              details: JSON.stringify(safeArgs, null, 2), // joli JSON
            },
            ...prev,
          ];
          return newRows.slice(0, 50); // garder les 50 derniers
        });
      } catch (err) {
        console.warn(`❌ Failed to decode log for ${prefix}`, err);
      }
    };

    // Abonnement aux events du Vault
    const unwatchVault = publicClient.watchContractEvent({
      address: VAULT_ADDRESS as `0x${string}`,
      abi: VAULT_ABI,
      onLogs: (logs) => {
        logs.forEach((log) => handleLog(log, "Vault", VAULT_ABI));
      },
    });

    // Abonnement aux events de la Pool
    const unwatchPool = publicClient.watchContractEvent({
      address: POOL_ADDRESS as `0x${string}`,
      abi: POOL_ABI,
      onLogs: (logs) => {
        logs.forEach((log) => handleLog(log, "Pool", POOL_ABI));
      },
    });

    console.log("✅ Watching Vault & Pool events in real-time...");

    return () => {
      unwatchVault?.();
      unwatchPool?.();
    };
  }, [publicClient]);

  return { history };
}

