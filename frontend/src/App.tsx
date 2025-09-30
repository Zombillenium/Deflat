// src/App.tsx
import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { ethers } from "ethers";

import "./App.css";
import { ethereumSepolia } from "./main";

import {
  DFT_ABI,
  STABLE_ABI,
  VAULT_ABI,
  DFT_ADDRESS,
  STABLE_ADDRESS,
  VAULT_ADDRESS,
} from "./contracts";

import { fmt, nowSec } from "./utils/format";

// Hooks
import { usePoolData } from "./hooks/usePoolData";
import { useVaultData } from "./hooks/useVaultData";
import { useHistory } from "./hooks/useHistory";

// UI Components
import UserPanel from "./components/UserPanel";
import { PoolPanel } from "./components/PoolPanel";
import { VaultPanel } from "./components/VaultPanel";
import { HistoryPanel } from "./components/HistoryPanel";
import { HelpPanel } from "./components/HelpPanel";

export default function App() {
  // Wallet / network
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connectors, connectAsync } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  // UI
  const [dark, setDark] = useState(false);
  const [buyAmount, setBuyAmount] = useState("0");
  const [sellAmount, setSellAmount] = useState("0");
  console.log("🔗 chainId détecté:", chainId, "isConnected:", isConnected, "address:", address);

  // Dark mode
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  // Data hooks
  const pool = usePoolData();
  const vault = useVaultData();
  const history = useHistory();

  // ✅ User balances
  const userDFT = useReadContract({
    chainId: ethereumSepolia.id,
    abi: DFT_ABI,
    address: DFT_ADDRESS as `0x${string}`,
    functionName: "balanceOf",
    args: [address],
    query: { enabled: !!address },
  });

  const userStable = useReadContract({
    chainId: ethereumSepolia.id,
    abi: STABLE_ABI,
    address: STABLE_ADDRESS as `0x${string}`,
    functionName: "balanceOf",
    args: [address],
    query: { enabled: !!address },
  });

  const lastAction = useMemo(
    () => (history.history || []).find((h) => h.label.startsWith("Vault ")),
    [history.history]
  );

  // Derived status
  const isWrongNetwork = chainId !== ethereumSepolia.id;
  const isCooldown = Number(vault.nextAllowedAt?.data || 0n) > nowSec();

  const vaultStatus = useMemo(() => {
    if (isCooldown) return { label: "⏸ Cooldown", color: "#f59e0b" };
    if (vault.stressRatioBps > vault.stressMax)
      return { label: "⏸ Skip (Stress)", color: "#ef4444" };
    if (
      vault.dailyBudgetAbs > 0 &&
      vault.spentTodayNum >= vault.dailyBudgetAbs
    )
      return { label: "⏸ Budget atteint", color: "#ef4444" };
    return { label: "✅ Active", color: "#10b981" };
  }, [
    isCooldown,
    vault.stressRatioBps,
    vault.stressMax,
    vault.dailyBudgetAbs,
    vault.spentTodayNum,
  ]);

  // Writer (un seul hook suffit)
  const { writeContractAsync } = useWriteContract();

  const onApprove = async () => {
    if (!buyAmount || Number(buyAmount) <= 0) return;
    await writeContractAsync({
      chainId: ethereumSepolia.id,
      abi: STABLE_ABI,
      address: STABLE_ADDRESS as `0x${string}`,
      functionName: "approve",
      args: [VAULT_ADDRESS, ethers.parseUnits(buyAmount, 18)],
    });
  };

  const onBuy = async () => {
    if (!buyAmount || Number(buyAmount) <= 0) return;
    await writeContractAsync({
      chainId: ethereumSepolia.id,
      abi: VAULT_ABI,
      address: VAULT_ADDRESS as `0x${string}`,
      functionName: "buyDFT",
      args: [ethers.parseUnits(buyAmount, 18)],
    });
  };

  const onSell = async () => {
    if (!sellAmount || Number(sellAmount) <= 0) return;
    await writeContractAsync({
      chainId: ethereumSepolia.id,
      abi: VAULT_ABI,
      address: VAULT_ADDRESS as `0x${string}`,
      functionName: "sellDFT",
      args: [ethers.parseUnits(sellAmount, 18)],
    });
  };

  // Gates
  if (isWrongNetwork) {
    return (
      <div className={`app-container ${dark ? "dark" : ""}`}>
        <div className="section-card">
          <h1>Deflat Dashboard</h1>
          <p>⚠️ Mauvais réseau (id détecté : {chainId}).</p>
          <button onClick={() => switchChain({ chainId: ethereumSepolia.id })}>
            Switch to Sepolia
          </button>
          <div style={{ marginTop: 12 }}>
            <button onClick={() => setDark((d) => !d)}>
              {dark ? "☀️ Light" : "🌙 Dark"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className={`app-container ${dark ? "dark" : ""}`}>
        <div className="section-card">
          <h1>Deflat Dashboard</h1>
          <p>👉 Connectez votre wallet :</p>
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => connectAsync({ connector })}
              style={{ display: "block", marginBottom: 10 }}
            >
              {connector.name}
            </button>
          ))}
          <div style={{ marginTop: 12 }}>
            <button onClick={() => setDark((d) => !d)}>
              {dark ? "☀️ Light" : "🌙 Dark"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main UI
  return (
    <div className={`app-container ${dark ? "dark" : ""}`}>
      <div className="header-row">
        <h1>Deflat Dashboard</h1>
        <button onClick={() => setDark((d) => !d)}>
          {dark ? "☀️ Light" : "🌙 Dark"}
        </button>
      </div>

      {/* Wallet row */}
      <div className="section-card">
        <p>
          ✅ Connecté : <span className="wallet-address">{address}</span>
        </p>
        <button className="disconnect" onClick={() => disconnect()}>
          🔌 Déconnexion
        </button>
      </div>

      {/* User */}
      <UserPanel
        userDFT={userDFT}
        userStable={userStable}
        buyAmount={buyAmount}
        setBuyAmount={setBuyAmount}
        sellAmount={sellAmount}
        setSellAmount={setSellAmount}
        onApprove={onApprove}
        onBuy={onBuy}
        onSell={onSell}
      />

      {/* Pool */}
      <PoolPanel
        poolDFT={pool.poolDFT}
        poolStable={pool.poolStable}
        poolPrices={pool.poolPrices}
        poolResSeries={pool.poolResSeries}
      />

      {/* Vault */}
      <VaultPanel
        vaultDFT={vault.vaultDFT}
        vaultStable={vault.vaultStable}
        emaShort={vault.emaShort}
        emaLong={vault.emaLong}
        spentToday={vault.spentToday}
        priceSeries={vault.priceSeries}
        budgetPct={vault.budgetPct}
        spentTodayNum={vault.spentTodayNum}
        dailyBudgetAbs={vault.dailyBudgetAbs}
        stableSharePct={vault.stableSharePct}
        vaultStatus={vaultStatus}
        isCooldown={isCooldown}
        nextAllowedAt={vault.nextAllowedAt}
        stressRatioBps={vault.stressRatioBps}
        stressMax={vault.stressMax}
        lastAction={lastAction}
      />

      {/* History */}
      <HistoryPanel history={history.history} />

      {/* Help */}
      <HelpPanel />
    </div>
  );
}

