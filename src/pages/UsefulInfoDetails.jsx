import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Video,
  Download,
  Paperclip,
  AlertCircle,
} from "lucide-react";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import "./UsefulInfoDetails.css";

const isValidUrl = (value) => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
};

const getAttachmentName = (item) =>
  item.original_name ||
  item.original_filename ||
  item.file_name ||
  item.filename ||
  item.name ||
  "Fișier atașat";

const getAttachmentType = (item) => {
  const type = String(
    item.mime_type || item.mimetype || item.file_type || "",
  ).toLowerCase();

  const name = getAttachmentName(item).toLowerCase();

  if (
    item.type === "link" ||
    item.file_category === "link" ||
    item.fileCategory === "link"
  ) {
    return "link";
  }

  if (type.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(name)) {
    return "image";
  }

  if (type.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(name)) {
    return "video";
  }

  if (type === "application/pdf" || /\.pdf$/i.test(name)) {
    return "pdf";
  }

  return "document";
};

function UsefulInfoDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [informatie, setInformatie] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [attachmentsError, setAttachmentsError] = useState("");
  const [openingId, setOpeningId] = useState(null);

  const canEdit = user?.role === "EDITOR" || user?.role === "ADMIN";

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setLoading(true);
      setMessage("");
      setAttachmentsError("");

      try {
        const response = await api.get(`/informatii-utile/${id}`);

        if (!active) return;

        setInformatie(response.data.informatie);

        try {
          const attachmentResponse = await api.get(
            `/attachments/informatii_utile/${id}`,
          );

          if (!active) return;

          const data = attachmentResponse.data;

          const items = Array.isArray(data)
            ? data
            : data.attachments || data.files || data.documente || [];

          setAttachments(Array.isArray(items) ? items : []);
        } catch (error) {
          if (!active) return;

          console.error("Eroare la încărcarea atașamentelor:", error);

          setAttachmentsError(
            "Atașamentele nu au putut fi încărcate. Verifică ruta API de atașamente.",
          );
        }
      } catch (error) {
        if (!active) return;

        console.error("Eroare la încărcarea informației utile:", error);

        setMessage(
          error.response?.data?.message ||
            "Eroare la încărcarea informației utile.",
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, [id]);

  const openAttachment = async (item) => {
    const type = getAttachmentType(item);

    const externalUrl = item.url || item.link_url || item.external_url;

    if (type === "link") {
      if (!isValidUrl(externalUrl)) {
        setAttachmentsError("Linkul atașat nu conține o adresă validă.");
        return;
      }

      window.open(externalUrl, "_blank", "noopener,noreferrer");
      return;
    }

    if (!item.id) {
      setAttachmentsError("Fișierul nu are un identificator valid.");
      return;
    }

    // Deschidem imediat fila pentru a evita blocarea
    // de către browser după cererea asincronă.
    const newTab = window.open("", "_blank");

    try {
      setOpeningId(item.id);
      setAttachmentsError("");

      const response = await api.get(`/attachments/file/${item.id}`, {
        responseType: "blob",
      });

      const blob = response.data;
      const blobUrl = URL.createObjectURL(blob);

      if (newTab) {
        newTab.location.href = blobUrl;
      } else {
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = getAttachmentName(item);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }

      // Păstrăm temporar URL-ul pentru a permite
      // browserului să deschidă fișierul.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (error) {
      if (newTab) newTab.close();

      console.error("Eroare la deschiderea fișierului:", error);

      setAttachmentsError(
        error.response?.data?.message || "Fișierul nu a putut fi deschis.",
      );
    } finally {
      setOpeningId(null);
    }
  };

  if (loading) {
    return (
      <div className="useful-info-details-loading">
        <div className="useful-info-details-spinner" />
        <span>Se încarcă informația...</span>
      </div>
    );
  }

  if (message) {
    return (
      <div className="useful-info-details-page">
        <div className="useful-info-details-error">
          <span className="useful-info-details-error-icon">!</span>
          <span>{message}</span>
        </div>

        <button
          type="button"
          className="useful-info-details-back-button"
          onClick={() => navigate("/informatii-utile")}
        >
          ← Înapoi la informații utile
        </button>
      </div>
    );
  }

  if (!informatie) return null;

  return (
    <div className="useful-info-details-page">
      <div className="useful-info-details-header">
        <div className="useful-info-details-title-section">
          <div className="useful-info-details-label">INFORMAȚIE UTILĂ</div>

          <h1>{informatie.title}</h1>

          <p>Informații și detalii utile pentru activitatea de serviciu</p>

          {informatie.category && (
            <div className="useful-info-details-category">
              {informatie.category}
            </div>
          )}
        </div>

        <button
          type="button"
          className="useful-info-details-back-button"
          onClick={() => navigate("/informatii-utile")}
        >
          <ArrowLeft size={16} />
          Înapoi
        </button>
      </div>

      <div className="useful-info-details-card">
        <div className="useful-info-details-card-header">
          <h2>Detalii informație</h2>
        </div>

        <div className="useful-info-details-card-body">
          {informatie.content?.trim() && (
            <div className="useful-info-details-content-section">
              <div className="useful-info-details-content-label">Conținut</div>

              <div className="useful-info-details-content">
                {informatie.content}
              </div>
            </div>
          )}

          <section className="uid-attachments">
            <div className="uid-attachments-heading">
              <div className="uid-attachments-icon">
                <Paperclip size={20} />
              </div>

              <div>
                <h3>Materiale atașate</h3>
                <p>Fotografii, documente, videoclipuri și linkuri</p>
              </div>
            </div>

            {attachmentsError && (
              <div className="uid-attachments-error">
                <AlertCircle size={17} />
                {attachmentsError}
              </div>
            )}

            {attachments.length === 0 ? (
              <p className="uid-attachments-empty">
                Nu există materiale atașate disponibile.
              </p>
            ) : (
              <div className="uid-attachments-list">
                {attachments.map((item, index) => {
                  const type = getAttachmentType(item);

                  return (
                    <div className="uid-attachment" key={item.id || index}>
                      <div className="uid-attachment-icon">
                        {type === "image" ? (
                          <ImageIcon size={20} />
                        ) : type === "video" ? (
                          <Video size={20} />
                        ) : type === "link" ? (
                          <ExternalLink size={20} />
                        ) : (
                          <FileText size={20} />
                        )}
                      </div>

                      <div className="uid-attachment-info">
                        <strong>{getAttachmentName(item)}</strong>

                        <span>
                          {type === "link"
                            ? "Link extern"
                            : type === "image"
                              ? "Fotografie"
                              : type === "video"
                                ? "Videoclip"
                                : type === "pdf"
                                  ? "Document PDF"
                                  : "Document"}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="uid-attachment-open"
                        disabled={openingId === item.id}
                        onClick={() => openAttachment(item)}
                      >
                        {openingId === item.id ? (
                          "Se deschide..."
                        ) : type === "link" ? (
                          <>
                            Deschide
                            <ExternalLink size={15} />
                          </>
                        ) : (
                          <>
                            Vizualizează
                            <Download size={15} />
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {informatie.created_by_name && (
            <div className="useful-info-details-author">
              <span className="useful-info-details-author-label">
                Adăugat de
              </span>

              <span className="useful-info-details-author-value">
                {informatie.created_by_name}
              </span>
            </div>
          )}
        </div>

        <div className="useful-info-details-actions">
          <button
            type="button"
            className="useful-info-details-back-action"
            onClick={() => navigate("/informatii-utile")}
          >
            Înapoi
          </button>

          {canEdit && (
            <button
              type="button"
              className="useful-info-details-edit-button"
              onClick={() => navigate(`/informatii-utile/${id}/edit`)}
            >
              Editează informația
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default UsefulInfoDetails;
