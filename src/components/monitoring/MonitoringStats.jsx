import { Clock3, Download, Search, Users } from "lucide-react";

export default function MonitoringStats({ stats = {}, totalUsers = 0, loading = false }) {
  const cards = [
    { label: "Utilizatori online", value: stats.online_users, subtitle: `din ${totalUsers} utilizatori`, icon: Users, color: "green" },
    { label: "Conectări astăzi", value: stats.logins_today, subtitle: "astăzi", icon: Clock3, color: "blue" },
    { label: "Căutări efectuate", value: stats.searches_24h, subtitle: "în ultimele 24 de ore", icon: Search, color: "blue" },
    { label: "Descărcări documente", value: stats.downloads_24h, subtitle: "în ultimele 24 de ore", icon: Download, color: "blue" },
  ];

  return (
    <section className="mon-stats" aria-label="Statistici monitorizare">
      {cards.map(({ label, value, subtitle, icon: Icon, color }) => (
        <article className="mon-stat" key={label}>
          <span className={`mon-stat-icon mon-${color}`}><Icon size={29} /></span>
          <div>
            <span className="mon-stat-label">{label}</span>
            <strong>{value ?? (loading ? "…" : "—")}</strong>
            <small>{subtitle}</small>
          </div>
        </article>
      ))}
    </section>
  );
}
