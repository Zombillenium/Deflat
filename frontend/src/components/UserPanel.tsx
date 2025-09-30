import { ethers } from "ethers";
import { useState } from "react";
import { useWriteContract } from "wagmi";
import {
  STABLE_ABI,
  VAULT_ABI,
  STABLE_ADDRESS,
  VAULT_ADDRESS,
} from "../contracts";
import { fmt } from "../utils/format";

interface UserPanelProps {
  userDFT: { data?: bigint } | undefined;
  userStable: { data?: bigint } | undefined;
}

export default function UserPanel({ userDFT, userStable }: UserPanelProps) {
  const [buyAmount, setBuyAmount] = useState("0");
  const [sellAmount, setSellAmount] = useState("0");

  const { writeContract: approveStableWrite } = useWriteContract();
  const { writeContract: buyDFTWrite } = useWriteContract();
  const { writeContract: sellDFTWrite } = useWriteContract();

  const onApprove = async () => {
    if (!buyAmount || Number(buyAmount) <= 0) return;
    await approveStableWrite({
      abi: STABLE_ABI,
      address: STABLE_ADDRESS as `0x${string}`,
      functionName: "approve",
      args: [VAULT_ADDRESS, ethers.parseUnits(buyAmount, 18)],
    });
  };

  const onBuy = async () => {
    if (!buyAmount || Number(buyAmount) <= 0) return;
    await buyDFTWrite({
      abi: VAULT_ABI,
      address: VAULT_ADDRESS as `0x${string}`,
      functionName: "buyDFT",
      args: [ethers.parseUnits(buyAmount, 18)],
    });
  };

  const onSell = async () => {
    if (!sellAmount || Number(sellAmount) <= 0) return;
    await sellDFTWrite({
      abi: VAULT_ABI,
      address: VAULT_ADDRESS as `0x${string}`,
      functionName: "sellDFT",
      args: [ethers.parseUnits(sellAmount, 18)],
    });
  };

  return (
    <div className="section-card">
      <h2>👤 User</h2>
      <p>Your DFT: {userDFT?.data ? fmt(userDFT.data as bigint) : "..."}</p>
      <p>Your Stable: {userStable?.data ? fmt(userStable.data as bigint) : "..."}</p>

      <h3>Buy DFT</h3>
      <input
        type="number"
        value={buyAmount}
        onChange={(e) => setBuyAmount(e.target.value)}
        placeholder="Amount stable"
      />
      <button onClick={onApprove}>Approve</button>
      <button onClick={onBuy}>Buy</button>

      <h3>Sell DFT</h3>
      <input
        type="number"
        value={sellAmount}
        onChange={(e) => setSellAmount(e.target.value)}
        placeholder="Amount DFT"
      />
      <button onClick={onSell}>Sell</button>
    </div>
  );
}

