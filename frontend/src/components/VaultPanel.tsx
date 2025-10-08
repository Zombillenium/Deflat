import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  Legend,
  RadialBarChart,
  RadialBar,
} from "recharts";
import { fmt, tsToHHMM } from "../utils/format";

/**
 * Affiche l’état du Vault avec EMA, budget et allocations
 */
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
  const data = priceSeries?.length ? priceSeries : [];

  return (
    <div className="section-card">
      <h2>📊 Vault</h2>
      <p>DFT: {vaultDFT.data ? fmt(vaultDFT.data as bigint) : "..."}</p>
      <p>Stable: {vaultStable.data ? fmt(vaultStable.data as bigint) : "..."}</p>
      <p>EMA30: {emaShort.data ? fmt(emaShort.data as bigint) : "..."}</p>
      <p>EMA120: {emaLong.data ? fmt(emaLong.data as bigint) : "..."}</p>
      <p>Spent today: {spentToday.data ? fmt(spentToday.data as bigint) : "..."}</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginTop: 10,
        }}
      >
        {/* Courbe EMA */}
        <div>
          <h3>EMA30 / EMA120 / Spot (1h)</h3>
          <div style={{ height: 240, minWidth: 300 }}>
            {data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                  <XAxis
                    dataKey="ts"
                    tickFormatter={(v) => tsToHHMM(Number(v))}
                    stroke="#9ca3af"
                  />
                  <YAxis domain={["auto", "auto"]} stroke="#9ca3af" />
                  <RTooltip
                    labelFormatter={(v) => tsToHHMM(Number(v))}
                    formatter={(val: number) => val.toFixed(5)}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="ema30"
                    name="EMA30"
                    stroke="#4f46e5"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="ema120"
                    name="EMA120"
                    stroke="#10b981"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="spot"
                    name="Spot"
                    stroke="#f59e0b"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ textAlign: "center", marginTop: 80, color: "#888" }}>
                (Aucune donnée à afficher pour le moment)
              </p>
            )}
          </div>
        </div>

        {/* Jauge budget */}
        <div>
          <h3>Budget 24h</h3>
          <div style={{ height: 240, minWidth: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="60%"
                outerRadius="100%"
                data={[{ name: "Budget", value: Math.round(budgetPct) }]}
                startAngle={90}
                endAngle={-270}
              >
                <RadialBar
                  dataKey="value"
                  cornerRadius={10}
                  fill={budgetPct > 90 ? "#ef4444" : "#10b981"}
                />
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
          Stable: {stableSharePct.toFixed(1)}% — DFT:{" "}
          {(100 - stableSharePct).toFixed(1)}%
        </p>
      </div>

      {/* État */}
      <div className="section-card" style={{ marginTop: 12 }}>
        <h3>État</h3>
        <p>
          <span style={{ color: vaultStatus.color, fontWeight: 600 }}>
            {vaultStatus.label}
          </span>
          {" · "}
          {isCooldown
            ? `cooldown jusqu’à ${tsToHHMM(Number(nextAllowedAt?.data || 0n))}`
            : "cooldown OK"}
          {" · "}
          Stress: {stressRatioBps} bps (max {stressMax} bps)
        </p>
        {lastAction && (
          <p>
            Dernière action : <b>{lastAction.label}</b> —{" "}
            {tsToHHMM(lastAction.ts)} —{" "}
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
