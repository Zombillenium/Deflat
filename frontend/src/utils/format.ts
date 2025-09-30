import { formatUnits } from "viem";

export const to18 = (v: bigint | undefined) => (v ? Number(formatUnits(v, 18)) : 0);
export const fmt = (v: bigint | undefined, d = 18) =>
  v !== undefined ? formatUnits(v, d) : "...";

export const nowSec = () => Math.floor(Date.now() / 1000);

export const tsToHHMM = (ts: number) => {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

