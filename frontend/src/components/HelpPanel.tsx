export function HelpPanel() {
  return (
    <div className="section-card">
      <h2>ℹ️ Aide</h2>
      <ul>
        <li><b>EMA</b> : moyenne mobile exponentielle (30min & 120min) pour lisser le prix.</li>
        <li><b>Cooldown</b> : délai minimum entre deux actions de la Vault.</li>
        <li><b>SpentToday</b> : budget dépensé aujourd’hui (équivalent stable).</li>
        <li><b>Stress</b> : proxy via ratio de retraits 1h, si trop élevé → Vault skip.</li>
        <li><b>Approve</b> : autorise la Vault à dépenser vos stables pour le BUY.</li>
      </ul>
    </div>
  );
}

