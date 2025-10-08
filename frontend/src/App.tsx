// src/App.tsx
import { useEffect, useState } from "react";
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
  POOL_ABI,
  DFT_ADDRESS,
  STABLE_ADDRESS,
  POOL_ADDRESS,
} from "./contracts";

// UI Components
import UserPanel from "./components/UserPanel";
import { PoolPanel } from "./components/PoolPanel";
import { VaultPanel } from "./components/VaultPanel";
import { HistoryPanel } from "./components/HistoryPanel";
import { HelpPanel } from "./components/HelpPanel";

// Hooks
import { usePoolData } from "./hooks/usePoolData";
import { useVaultData } from "./hooks/useVaultData";
import { useHistory } from "./hooks/useHistory";

export default function App() {
  // ---- Wallet / Wagmi ----
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connectors, connectAsync, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  // ---- UI ----
  const [dark, setDark] = useState(false);
  const [buyAmount, setBuyAmount] = useState("0");
  const [sellAmount, setSellAmount] = useState("0");
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");

  // ---- Data hooks ----
  const pool = usePoolData();
  const vault = useVaultData();
  const history = useHistory();

  // ---- Connectors ciblés ----
  // Rabby arrive via injected() avec EIP-6963 (nom "Rabby Wallet")
  const rabbyConnector = connectors.find((c) => /rabby/i.test(c.name));
  // MetaMask arrive via metaMask() (id "metaMask") ou parfois via injected() (nom)
  const metaMaskConnector =
    connectors.find((c) => (c as any).id?.startsWith?.("metaMask")) ??
    connectors.find((c) => /metamask/i.test(c.name));

  const onConnectRabby = async () => {
    try {
      if (!rabbyConnector) return alert("Rabby non détecté");
      await connectAsync({ connector: rabbyConnector, chainId: ethereumSepolia.id });
    } catch (err: any) {
      console.warn("❌ Erreur connexion Rabby:", err?.message || err);
      alert("❌ Impossible de se connecter via Rabby (voir console).");
    }
  };

  const onConnectMetaMask = async () => {
    try {
      if (!metaMaskConnector) return alert("MetaMask non détecté");
      await connectAsync({ connector: metaMaskConnector, chainId: ethereumSepolia.id });
    } catch (err: any) {
      console.warn("❌ Erreur connexion MetaMask:", err?.message || err);
      if (err?.code === 4902 || err?.message?.includes?.("Unrecognized chain")) {
        alert("Veuillez ajouter manuellement le réseau Sepolia dans votre wallet.");
      } else {
        alert("❌ Impossible de se connecter via MetaMask (voir console).");
      }
    }
  };

  // ---- Balances utilisateur ----
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

  useEffect(() => {
    if (!userDFT?.refetch || !userStable?.refetch) return;
    const refresh = () => {
      userDFT.refetch();
      userStable.refetch();
    };
    refresh();
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [userDFT?.refetch, userStable?.refetch]);

  // ---- Réseau ----
  const isWrongNetwork = chainId !== ethereumSepolia.id;
  const handleSwitch = async () => {
    try {
      await switchChainAsync({ chainId: ethereumSepolia.id });
    } catch (err) {
      console.warn("❌ Erreur switch réseau:", err);
    }
  };

  // ---- Dark mode ----
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  // ---- Actions AMM ----
  const onBuy = async () => {
    if (!buyAmount || Number(buyAmount) <= 0) return;
    try {
      const amountIn = ethers.parseUnits(buyAmount, 18);
      await writeContractAsync({
        chainId: ethereumSepolia.id,
        abi: STABLE_ABI,
        address: STABLE_ADDRESS as `0x${string}`,
        functionName: "approve",
        args: [POOL_ADDRESS, amountIn],
      });
      await writeContractAsync({
        chainId: ethereumSepolia.id,
        abi: POOL_ABI,
        address: POOL_ADDRESS as `0x${string}`,
        functionName: "swapStableForDFT",
        args: [amountIn, 0n], // attention: pas de slippage check
      });
      alert("✅ Achat effectué avec succès !");
    } catch (err) {
      console.warn("❌ Erreur BUY:", err);
      alert("❌ Transaction échouée ou refusée");
    }
  };

  const onSell = async () => {
    if (!sellAmount || Number(sellAmount) <= 0) return;
    try {
      const amountIn = ethers.parseUnits(sellAmount, 18);
      await writeContractAsync({
        chainId: ethereumSepolia.id,
        abi: DFT_ABI,
        address: DFT_ADDRESS as `0x${string}`,
        functionName: "approve",
        args: [POOL_ADDRESS, amountIn],
      });
      await writeContractAsync({
        chainId: ethereumSepolia.id,
        abi: POOL_ABI,
        address: POOL_ADDRESS as `0x${string}`,
        functionName: "swapDFTForStable",
        args: [amountIn, 0n], // attention: pas de slippage check
      });
      alert("✅ Vente effectuée avec succès !");
    } catch (err) {
      console.warn("❌ Erreur SELL:", err);
      alert("❌ Transaction échouée ou refusée");
    }
  };

  // ---- Envoi DFT ----
  const onSend = async () => {
    if (!sendTo || !sendAmount || Number(sendAmount) <= 0) {
      alert("Veuillez renseigner une adresse et un montant valide.");
      return;
    }
    try {
      await writeContractAsync({
        chainId: ethereumSepolia.id,
        abi: DFT_ABI,
        address: DFT_ADDRESS as `0x${string}`,
        functionName: "transfer",
        args: [sendTo, ethers.parseUnits(sendAmount, 18)],
      });
      alert(`✅ ${sendAmount} DFT envoyés à ${sendTo}`);
      setSendAmount("");
      setSendTo("");
    } catch (err: any) {
      console.warn("❌ Erreur lors du transfert:", err);
      alert("❌ Échec de la transaction (voir console).");
    }
  };

  // ---- Rendu ----
  if (!isConnected) {
    return (
      <div className={`app-container ${dark ? "dark" : ""}`}>
        <div className="section-card">
          <h1>Deflat Dashboard</h1>
          <p>👉 Connectez votre wallet :</p>

          {/* Rabby */}
          {rabbyConnector ? (
            <button
              onClick={onConnectRabby}
              disabled={isPending}
              style={{ display: "block", marginBottom: 10, padding: "8px 16px", fontWeight: 500 }}
            >
              {isPending ? "Connexion..." : "🧱 Rabby Wallet"}
            </button>
          ) : (
            <p style={{ color: "#888" }}>Rabby non détecté</p>
          )}

          {/* MetaMask */}
          {metaMaskConnector ? (
            <button
              onClick={onConnectMetaMask}
              disabled={isPending}
              style={{ display: "block", marginBottom: 10, padding: "8px 16px", fontWeight: 500 }}
            >
              {isPending ? "Connexion..." : "🦊 MetaMask"}
            </button>
          ) : (
            <p style={{ color: "#888" }}>MetaMask non détecté</p>
          )}

          <div style={{ marginTop: 12 }}>
            <button onClick={() => setDark((d) => !d)}>{dark ? "☀️ Light" : "🌙 Dark"}</button>
          </div>

          <p style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
            {rabbyConnector && metaMaskConnector
              ? "✅ Rabby et MetaMask détectés"
              : rabbyConnector
              ? "✅ Rabby détecté"
              : metaMaskConnector
              ? "✅ MetaMask détecté"
              : "❌ Aucun wallet détecté"}
          </p>
        </div>
      </div>
    );
  }

  // === UI principale ===
  return (
    <div className={`app-container ${dark ? "dark" : ""}`}>
      <div className="header-row">
        <h1>Deflat Dashboard</h1>
        <button onClick={() => setDark((d) => !d)}>{dark ? "☀️ Light" : "🌙 Dark"}</button>
      </div>

      <div className="section-card">
        <p>
          ✅ Connecté : <span className="wallet-address">{address}</span>
        </p>
        <button className="disconnect" onClick={() => disconnect()}>
          🔌 Déconnexion
        </button>
        {isWrongNetwork && (
          <button onClick={handleSwitch} style={{ marginLeft: 12 }}>
            🔁 Passer sur Sepolia
          </button>
        )}
      </div>

      <UserPanel
        userDFT={userDFT}
        userStable={userStable}
        buyAmount={buyAmount}
        setBuyAmount={setBuyAmount}
        sellAmount={sellAmount}
        setSellAmount={setSellAmount}
        onBuy={onBuy}
        onSell={onSell}
      />

      <PoolPanel
        poolDFT={pool.poolDFT}
        poolStable={pool.poolStable}
        poolPrices={pool.poolPrices}
        poolResSeries={pool.poolResSeries}
      />

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
        vaultStatus={{ label: "ℹ️ Lecture seule", color: "#6b7280" }}
        isCooldown={false}
        nextAllowedAt={0n}
        stressRatioBps={0}
        stressMax={0}
        lastAction={undefined}
      />

      <HistoryPanel history={history.history} />
      <HelpPanel />
    </div>
  );
}
