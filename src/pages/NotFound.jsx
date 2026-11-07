import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, Home, SearchX, ShieldCheck, Compass } from "lucide-react";
import "./NotFound.css";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <main className="border-404-page">
      <div className="border-404-breadcrumb">
        <Compass size={15} aria-hidden="true" /> BORDER / NAVIGARE / PAGINĂ INDISPONIBILĂ
      </div>
      <motion.section
        className="border-404-card"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        aria-labelledby="border-404-title"
      >
        <div className="border-404-glow" aria-hidden="true" />
        <div className="border-404-symbol">
          <SearchX size={36} strokeWidth={1.8} aria-hidden="true" />
        </div>
        <div className="border-404-code">404</div>
        <h1 id="border-404-title">Pagina nu a fost găsită</h1>
        <p>
          Adresa accesată nu există sau pagina a fost mutată. Poți reveni la Dashboard pentru a
          continua navigarea în BORDER.
        </p>
        <div className="border-404-actions">
          <button
            type="button"
            className="border-404-primary"
            onClick={() => navigate("/dashboard")}
          >
            <Home size={18} aria-hidden="true" /> Înapoi la Dashboard
          </button>
          <button
            type="button"
            className="border-404-secondary"
            onClick={() => {
              if (window.history.length > 1) navigate(-1);
              else navigate("/dashboard");
            }}
          >
            <ArrowLeft size={18} aria-hidden="true" /> Pagina anterioară
          </button>
        </div>
      </motion.section>
      <div className="border-404-footer">
        <ShieldCheck size={16} aria-hidden="true" /> BORDER · Portal informațional
      </div>
    </main>
  );
}
