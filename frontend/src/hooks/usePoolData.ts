import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import {
  DFT_ABI,
  STABLE_ABI,
  POOL_ABI,
  DFT_ADDRESS,
  STABLE_ADDRESS,
  POOL_ADDRESS,
} from "../contracts";

export function usePoolData() {
  const poolDFT = useReadContract({
    abi: DFT_ABI,
    address: DFT_ADDRESS as `0x${string}`,
    functionName: "balanceOf",
    args: [POOL_ADDRESS],
  });

  const poolStable = useReadContract({
    abi: STABLE_ABI,
    address: STABLE_ADDRESS as `0x${string}`,
    functionName: "balanceOf",
    args: [POOL_ADDRESS],
  });

  const poolPrices = useReadContract({
    abi: POOL_ABI,
    address: POOL_ADDRESS as `0x${string}`,
    functionName: "getPrices",
  });

  const priceSpot = poolPrices.data
    ? Number(formatUnits((poolPrices.data as any)[0], 18))
    : 0;

  return { poolDFT, poolStable, poolPrices, priceSpot };
}

