import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip as RTooltip, Legend, RadialBarChart, RadialBar } from "recharts";
import { fmt, tsToHHMM } from "../utils/format";

export function VaultPanel({
  vaultDFT,
  vaultStable,
  emaShort,
  emaLong,
  spentToday,
  priceSeries,
  budgetPct,
  spentTodayNum,
  dailyBudgetAbs,
  stableSharePct,
  vaultStatus,
  isCooldown,
  nextAllowedAt,
  stressRatioBps,
  stressMax,
  lastAction,
}: any) {
  return (
    <div className="section-card">
      <h2>📊 Vault</h2>
      <p>Vault DFT: {vaultDFT.data ? fmt(vaultDFT.data as bigint) : "..."}</p>
      <p>Vault Stable: {vaultStable.data ? fmt(vaultStable.data as bigint) : "..."}</p>
      <p>EMA30: {emaShort.data ? fmt(emaShort.data as bigint) : "..."}</p>
      <p>EMA120: {emaLong.data ? fmt(emaLong.data as bigint) : "..."}</p>
      <p>Spent today: {spentToday.data ? fmt(spentToday.data as bigint) : "..."}</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 10 }}>
        {/* EMA/Spot chart */}
        <div>
          <h3>EMA30 / EMA120 / Spot</h3>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={priceSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="ts" tickFormatter={tsToHHMM}/>
                <YAxis/>
                <RTooltip labelFormatter={(v) => tsToHHMM(Number(v))}/>
                <Legend />
                <Line type="monotone" dataKey="spot" name="Spot" dot={false}/>
                <Line type="monotone" dataKey="ema30" name="EMA30" dot={false}/>
                <Line type="monotone" dataKey="ema120" name="EMA120" dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Budget gauge */}
        <div>
          <h3>Budget 24h</h3>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="60%"
                outerRadius="100%"
                data={[{ name: "Budget", value: Math.round(budgetPct) }]}
                startAngle={90}
                endAngle={-270}
              >
                <RadialBar dataKey="value" cornerRadius={10} />
                <RTooltip />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <p>
            {Math.round(budgetPct)}% utilisé — {spentTodayNum.toFixed(2)} /{" "}
            {dailyBudgetAbs.toFixed(2)} stable eq
          </p>
        </div>
      </div>

      {/* Allocation */}
      <div className="section-card" style={{ marginTop: 12 }}>
        <h3>Allocation Vault (Stable vs DFT)</h3>
        <p>
          Stable: {stableSharePct.toFixed(1)}% — DFT: {(100 - stableSharePct).toFixed(1)}%
        </p>
      </div>

      {/* Status */}
      <div className="section-card" style={{ marginTop: 12 }}>
        <h3>État</h3>
        <p>
          <span style={{ color: vaultStatus.color, fontWeight: 600 }}>
            {vaultStatus.label}
          </span>
          {" · "}
          {isCooldown ? `cooldown jusqu’à ${tsToHHMM(Number(nextAllowedAt.data || 0n))}` : "cooldown OK"}
          {" · "}
          Stress: {stressRatioBps} bps (max {stressMax} bps)
        </p>
        {lastAction && (
          <p>
            Dernière action: <b>{lastAction.label}</b> — {tsToHHMM(lastAction.ts)} —
            <a
              href={`https://sepolia.etherscan.io/tx/${lastAction.tx}`}
              target="_blank"
              rel="noreferrer"
              style={{ marginLeft: 6 }}
            >
              voir tx ↗
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

