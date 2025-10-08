import { tsToHHMM } from "../utils/format";

export function HistoryPanel({ history }: any) {
  return (
    <div className="section-card">
      <h2>📜 Historique (dernière heure)</h2>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
          }}
        >
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={{ width: "10%" }}>Heure</th>
              <th style={{ width: "10%" }}>Source</th>
              <th style={{ width: "15%" }}>Événement</th>
              <th style={{ width: "55%" }}>Détails</th>
              <th style={{ width: "10%" }}>Tx</th>
            </tr>
          </thead>
          <tbody>
            {history.length > 0 ? (
              history.map((h: any, i: number) => (
                <tr
                  key={i}
                  style={{
                    borderTop: "1px solid #eee",
                    verticalAlign: "top",
                  }}
                >
                  <td>{tsToHHMM(h.ts)}</td>
                  <td>{h.source}</td>
                  <td>{h.label}</td>
                  <td
                    style={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      lineHeight: "1.4em",
                    }}
                  >
                    {h.details
                      .split(";")
                      .map((line: string, idx: number) => (
                        <div key={idx}>• {line.trim()}</div>
                      ))}
                  </td>
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
              ))
            ) : (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "#777" }}>
                  Aucun événement récent.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
