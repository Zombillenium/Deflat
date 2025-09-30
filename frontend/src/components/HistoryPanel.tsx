import { tsToHHMM } from "../utils/format";

export function HistoryPanel({ history }: any) {
  return (
    <div className="section-card">
      <h2>📜 Historique (50 derniers)</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th>Heure</th>
              <th>Événement</th>
              <th>Détails</th>
              <th>Tx</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h: any, i: number) => (
              <tr key={i} style={{ borderTop: "1px solid #eee" }}>
                <td>{tsToHHMM(h.ts)}</td>
                <td>{h.label}</td>
                <td>{h.details}</td>
                <td>
                  <a
                    href={`https://sepolia.etherscan.io/tx/${h.tx}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {h.tx.slice(0, 10)}…{h.tx.slice(-6)}
                  </a>
                </td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={4}>Aucun événement récent.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

