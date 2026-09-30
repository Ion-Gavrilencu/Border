import { Megaphone, FileText, Scale, Info, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "./Dashboard.css";

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    telegrame: 0,
    ordine: 0,
    legislatie: 0,
    informatii_utile: 0,
    utilizatori: 0,
  });

  const [loadingStats, setLoadingStats] = useState(true);
  const [recent, setRecent] = useState([]);
  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await api.get("/dashboard/stats");

        setStats(response.data.stats);
        setRecent(response.data.recent || []);
      } catch (error) {
        console.error("Eroare la încărcarea statisticilor:", error);
      } finally {
        setLoadingStats(false);
      }
    };

    loadStats();
  }, []);
  return (
    <div className="dashboard">
      <div className="welcome-section">
        <div>
          <h1>Bine ai venit!</h1>

          <p>Aici găsești informațiile și documentele de serviciu.</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <Megaphone size={24} />
          </div>

          <div>
            <span>Telegrame</span>
            <strong>{loadingStats ? "..." : stats.telegrame}</strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <FileText size={24} />
          </div>

          <div>
            <span>Ordine interne</span>
            <strong>{loadingStats ? "..." : stats.ordine}</strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Scale size={24} />
          </div>

          <div>
            <span>Acte legislative</span>
            <strong>{loadingStats ? "..." : stats.legislatie}</strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Info size={24} />
          </div>

          <div>
            <span>Informații utile</span>
            <strong>{loadingStats ? "..." : stats.informatii_utile}</strong>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-card">
          <div className="card-header">
            <div>
              <h2>Ultimele informații</h2>
              <p>Documente adăugate recent</p>
            </div>

            <ArrowRight size={20} />
          </div>

          <div className="information-list">
            {recent.length === 0 ? (
              <p>Nu există documente recente.</p>
            ) : (
              recent.map((item) => (
                <div
                  className="information-item"
                  key={`${item.type}-${item.id}`}
                  onClick={() => {
                    if (item.type === "telegrama") {
                      navigate(`/telegrame/${item.id}`);
                    }

                    if (item.type === "ordin") {
                      navigate(`/ordine/${item.id}`);
                    }

                    if (item.type === "legislatie") {
                      navigate(`/legislatie/${item.id}`);
                    }

                    if (item.type === "informatii") {
                      navigate(`/informatii-utile/${item.id}`);
                    }
                  }}
                >
                  <div
                    className={`item-icon ${
                      item.type === "telegrama"
                        ? "telegram"
                        : item.type === "ordin"
                          ? "order"
                          : "law"
                    }`}
                  >
                    {item.type === "telegrama" && <Megaphone size={19} />}

                    {item.type === "ordin" && <FileText size={19} />}

                    {item.type === "legislatie" && <Scale size={19} />}

                    {item.type === "informatii" && <Info size={19} />}
                  </div>

                  <div>
                    <strong>
                      {item.type === "telegrama"
                        ? "Telegramă nouă"
                        : item.type === "ordin"
                          ? "Ordin intern"
                          : item.type === "legislatie"
                            ? "Act legislativ"
                            : "Informație utilă"}
                    </strong>

                    <p>{item.title}</p>

                    <small>
                      {new Date(item.created_at).toLocaleDateString("ro-RO")}
                    </small>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="dashboard-card">
          <div className="card-header">
            <div>
              <h2>Acces rapid</h2>
              <p>Secțiuni utilizate frecvent</p>
            </div>
          </div>

          <div className="quick-links">
            <button onClick={() => navigate("/telegrame")}>
              <Megaphone size={20} />
              <span>Telegrame</span>
              <ArrowRight size={17} />
            </button>

            <button onClick={() => navigate("/ordine")}>
              <FileText size={20} />
              <span>Ordine interne</span>
              <ArrowRight size={17} />
            </button>

            <button onClick={() => navigate("/legislatie")}>
              <Scale size={20} />
              <span>Legislație</span>
              <ArrowRight size={17} />
            </button>

            <button onClick={() => navigate("/informatii-utile")}>
              <Info size={20} />
              <span>Informații utile</span>
              <ArrowRight size={17} />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Dashboard;
