// src/components/PoolPanel.tsx
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  Legend,
} from "recharts";
import { fmt, tsToHHMM } from "../utils/format";
import { useMemo } from "react";

/**
 * Affiche l’état et l’évolution de la pool sur la dernière heure
 */
export function PoolPanel({ poolDFT, poolStable, poolPrices, poolResSeries }: any) {
  const data = useMemo(() => {
    if (!poolResSeries || poolResSeries.length === 0) return [];
    return poolResSeries.map((e: any) => ({
      ts: e.ts,
      dft: Number(e.dft) / 1e18,
      stable: Number(e.stable) / 1e18,
    }));
  }, [poolResSeries]);

  return (
    <div className="section-card">
      <h2>🏦 Pool</h2>
      <p>💧 DFT : {poolDFT?.data ? fmt(poolDFT.data as bigint) : "..."}</p>
      <p>💵 Stable : {poolStable?.data ? fmt(poolStable.data as bigint) : "..."}</p>
      <p>
        💱 Prix DFT → Stable :{" "}
        {poolPrices?.data ? fmt((poolPrices.data as any)[0]) : "..."}
      </p>
      <p>
        💱 Prix Stable → DFT :{" "}
        {poolPrices?.data ? fmt((poolPrices.data as any)[1]) : "..."}
      </p>

      <h3>📈 Évolution des réserves (dernière heure)</h3>
<div
  style={{
    width: "100%",
    height: 300,     // ✅ hauteur fixe
    minWidth: 320,   // ✅ largeur minimale
  }}
>
  {data.length > 0 ? (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="dft" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.6} />
            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="stable" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} />
        <XAxis
          dataKey="ts"
          tickFormatter={(v) => tsToHHMM(Number(v))}
          stroke="#9ca3af"
        />
        <YAxis stroke="#9ca3af" domain={["auto", "auto"]} />
        <RTooltip
          labelFormatter={(v) => tsToHHMM(Number(v))}
          formatter={(val: number) => val.toFixed(5)}
        />
        <Legend />
        <Area
          type="monotone"
          dataKey="dft"
          name="DFT"
          stroke="#4f46e5"
          fill="url(#dft)"
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="stable"
          name="Stable"
          stroke="#10b981"
          fill="url(#stable)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  ) : (
    <p style={{ textAlign: "center", marginTop: 80, color: "#888" }}>
      (Aucune donnée à afficher pour le moment)
    </p>
  )}
</div>

    </div>
  );
}
