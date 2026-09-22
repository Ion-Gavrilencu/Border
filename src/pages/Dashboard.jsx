import {
  Megaphone,
  FileText,
  Scale,
  Info,
  ArrowRight
} from "lucide-react";

import "./Dashboard.css";

function Dashboard() {
  return (
    <div className="dashboard">

      <div className="welcome-section">
        <div>
          <h1>Bine ai venit!</h1>

          <p>
            Aici găsești informațiile și documentele de serviciu.
          </p>
        </div>
      </div>

      <div className="stats-grid">

        <div className="stat-card">
          <div className="stat-icon">
            <Megaphone size={24} />
          </div>

          <div>
            <span>Telegrame</span>
            <strong>24</strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <FileText size={24} />
          </div>

          <div>
            <span>Ordine interne</span>
            <strong>16</strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Scale size={24} />
          </div>

          <div>
            <span>Acte legislative</span>
            <strong>38</strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Info size={24} />
          </div>

          <div>
            <span>Informații utile</span>
            <strong>12</strong>
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

            <div className="information-item">
              <div className="item-icon telegram">
                <Megaphone size={19} />
              </div>

              <div>
                <strong>Telegramă nouă</strong>
                <p>Informare privind organizarea activității</p>
                <small>20 septembrie 2026</small>
              </div>
            </div>

            <div className="information-item">
              <div className="item-icon order">
                <FileText size={19} />
              </div>

              <div>
                <strong>Ordin intern</strong>
                <p>Dispoziții privind activitatea de serviciu</p>
                <small>18 septembrie 2026</small>
              </div>
            </div>

            <div className="information-item">
              <div className="item-icon law">
                <Scale size={19} />
              </div>

              <div>
                <strong>Modificare legislativă</strong>
                <p>Act normativ adăugat în baza legislativă</p>
                <small>15 septembrie 2026</small>
              </div>
            </div>

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

            <button>
              <Megaphone size={20} />
              <span>Telegrame</span>
              <ArrowRight size={17} />
            </button>

            <button>
              <FileText size={20} />
              <span>Ordine interne</span>
              <ArrowRight size={17} />
            </button>

            <button>
              <Scale size={20} />
              <span>Legislație</span>
              <ArrowRight size={17} />
            </button>

            <button>
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