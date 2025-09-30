import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip as RTooltip, Legend } from "recharts";
import { fmt, tsToHHMM, to18 } from "../utils/format";

export function PoolPanel({ poolDFT, poolStable, poolPrices, poolResSeries }: any) {
  return (
    <div className="section-card">
      <h2>🏦 Pool</h2>
      <p>Pool DFT: {poolDFT.data ? fmt(poolDFT.data as bigint) : "..."}</p>
      <p>Pool Stable: {poolStable.data ? fmt(poolStable.data as bigint) : "..."}</p>
      <p>Prix DFT → Stable: {poolPrices.data ? fmt((poolPrices.data as any)[0]) : "..."}</p>
      <p>Prix Stable → DFT: {poolPrices.data ? fmt((poolPrices.data as any)[1]) : "..."}</p>

      <h3>Évolution des réserves (Pool)</h3>
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={poolResSeries}>
            <defs>
              <linearGradient id="dft" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopOpacity={0.8}/>
                <stop offset="95%" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="stable" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopOpacity={0.8}/>
                <stop offset="95%" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="ts" tickFormatter={tsToHHMM}/>
            <YAxis/>
            <RTooltip labelFormatter={(v) => tsToHHMM(Number(v))}/>
            <Legend />
            <Area type="monotone" dataKey="dft" name="DFT" fillOpacity={0.2} fill="url(#dft)" />
            <Area type="monotone" dataKey="stable" name="Stable" fillOpacity={0.2} fill="url(#stable)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

