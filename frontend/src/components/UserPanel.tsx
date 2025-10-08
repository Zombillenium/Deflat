// src/components/UserPanel.tsx
import { useState } from "react";
import { ethers } from "ethers";
import { useWriteContract } from "wagmi";
import { fmt } from "../utils/format";
import { DFT_ABI, DFT_ADDRESS } from "../contracts";
import { ethereumSepolia } from "../main";

interface UserPanelProps {
  userDFT: { data?: bigint } | undefined;
  userStable: { data?: bigint } | undefined;
  buyAmount: string;
  setBuyAmount: (v: string) => void;
  sellAmount: string;
  setSellAmount: (v: string) => void;
  onBuy: () => Promise<void>;
  onSell: () => Promise<void>;
}

export default function UserPanel({
  userDFT,
  userStable,
  buyAmount,
  setBuyAmount,
  sellAmount,
  setSellAmount,
  onBuy,
  onSell,
}: UserPanelProps) {
  const { writeContractAsync } = useWriteContract();

  // Champs d’envoi de DFT
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sending, setSending] = useState(false);

  const onSend = async () => {
    if (!sendTo || !sendAmount || Number(sendAmount) <= 0) {
      alert("Veuillez renseigner une adresse et un montant valide.");
      return;
    }

    try {
      setSending(true);
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
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="section-card">
      <h2>👤 Utilisateur</h2>
      <p>
        💠 DFT :{" "}
        {userDFT?.data !== undefined ? fmt(userDFT.data as bigint) : "..."}
      </p>
      <p>
        💵 Stable :{" "}
        {userStable?.data !== undefined ? fmt(userStable.data as bigint) : "..."}
      </p>

      {/* Acheter */}
      <div style={{ marginTop: 20 }}>
        <h3>🛒 Acheter du DFT</h3>
        <input
          type="number"
          min="0"
          value={buyAmount}
          onChange={(e) => setBuyAmount(e.target.value)}
          placeholder="Montant en STABLE"
        />
        <button onClick={onBuy}>Buy</button>
      </div>

      {/* Vendre */}
      <div style={{ marginTop: 20 }}>
        <h3>💰 Vendre du DFT</h3>
        <input
          type="number"
          min="0"
          value={sellAmount}
          onChange={(e) => setSellAmount(e.target.value)}
          placeholder="Montant en DFT"
        />
        <button onClick={onSell}>Sell</button>
      </div>

      {/* Envoyer */}
      <div style={{ marginTop: 20 }}>
        <h3>📤 Envoyer des DFT</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <input
            type="text"
            placeholder="Adresse du destinataire (0x...)"
            value={sendTo}
            onChange={(e) => setSendTo(e.target.value)}
          />
          <input
            type="number"
            min="0"
            placeholder="Montant DFT"
            value={sendAmount}
            onChange={(e) => setSendAmount(e.target.value)}
          />
          <button onClick={onSend} disabled={sending}>
            {sending ? "⏳ Envoi..." : "📤 Envoyer"}
          </button>
        </div>
      </div>
    </div>
  );
}
