
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "./Telegrame.css";
import { useAuth } from "../context/AuthContext";

function Telegrame() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [telegrame, setTelegrame] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    number: "",
    telegramDate: "",
    content: "",
  });

  const [selectedFiles, setSelectedFiles] = useState([]);

  const [links, setLinks] = useState([]);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const [saving, setSaving] = useState(false);

  const loadTelegrame = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/telegrame");

      setTelegrame(response.data.telegrame);
    } catch (error) {
      console.error("Eroare telegrame:", error);

      setError(
        error.response?.data?.message ||
          "Nu s-au putut încărca telegramele."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTelegrame();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const getFileCategory = (file) => {
    if (file.type.startsWith("image/")) {
      return "image";
    }

    if (file.type.startsWith("video/")) {
      return "video";
    }

    if (file.type === "application/pdf") {
      return "pdf";
    }

    if (
      file.type === "application/msword" ||
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      return "word";
    }

    return "other";
  };

  const formatFileSize = (bytes) => {
    if (!bytes) {
      return "0 KB";
    }

    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleFilesChange = (e) => {
    const files = Array.from(e.target.files || []);

    if (files.length === 0) {
      return;
    }

    const maxFileSize = 100 * 1024 * 1024;

    const invalidFiles = files.filter(
      (file) => file.size > maxFileSize
    );

    if (invalidFiles.length > 0) {
      alert(
        `Următoarele fișiere depășesc limita de 100 MB:\n\n${invalidFiles
          .map((file) => file.name)
          .join("\n")}`
      );

      e.target.value = "";
      return;
    }

    setSelectedFiles((current) => {
      const existingKeys = new Set(
        current.map(
          (file) =>
            `${file.name}-${file.size}-${file.lastModified}`
        )
      );

      const newFiles = files.filter(
        (file) =>
          !existingKeys.has(
            `${file.name}-${file.size}-${file.lastModified}`
          )
      );

      return [...current, ...newFiles];
    });

    e.target.value = "";
  };

  const removeSelectedFile = (indexToRemove) => {
    setSelectedFiles((current) =>
      current.filter(
        (_, index) => index !== indexToRemove
      )
    );
  };

  const addLinkToList = () => {
    const name = linkName.trim();
    const url = linkUrl.trim();

    if (!name) {
      alert("Introduceți denumirea linkului.");
      return;
    }

    if (!url) {
      alert("Introduceți adresa linkului.");
      return;
    }

    try {
      const parsedUrl = new URL(url);

      if (
        !["http:", "https:"].includes(
          parsedUrl.protocol
        )
      ) {
        alert(
          "Sunt permise doar linkurile HTTP și HTTPS."
        );
        return;
      }
    } catch {
      alert("Adresa introdusă nu este un link valid.");
      return;
    }

    const alreadyExists = links.some(
      (link) => link.url === url
    );

    if (alreadyExists) {
      alert("Acest link a fost deja adăugat.");
      return;
    }

    setLinks((current) => [
      ...current,
      {
        name,
        url,
      },
    ]);

    setLinkName("");
    setLinkUrl("");
  };

  const removeLinkFromList = (indexToRemove) => {
    setLinks((current) =>
      current.filter(
        (_, index) => index !== indexToRemove
      )
    );
  };

  const uploadAttachments = async (telegramId) => {
    if (selectedFiles.length === 0) {
      return [];
    }

    const failedFiles = [];

    for (const file of selectedFiles) {
      try {
        const attachmentFormData = new FormData();

        attachmentFormData.append("file", file);
        attachmentFormData.append(
          "entityType",
          "telegrame"
        );
        attachmentFormData.append(
          "entityId",
          telegramId
        );
        attachmentFormData.append(
          "fileCategory",
          getFileCategory(file)
        );

        await api.post(
          "/attachments/upload",
          attachmentFormData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );
      } catch (error) {
        console.error(
          `Eroare încărcare fișier ${file.name}:`,
          error
        );

        failedFiles.push(file.name);
      }
    }

    return failedFiles;
  };

  const uploadLinks = async (telegramId) => {
    if (links.length === 0) {
      return [];
    }

    const failedLinks = [];

    for (const link of links) {
      try {
        await api.post("/attachments/link", {
          entityType: "telegrame",
          entityId: telegramId,
          name: link.name,
          url: link.url,
        });
      } catch (error) {
        console.error(
          `Eroare adăugare link ${link.url}:`,
          error
        );

        failedLinks.push(link.name);
      }
    }

    return failedLinks;
  };

  const resetForm = () => {
    setFormData({
      title: "",
      number: "",
      telegramDate: "",
      content: "",
    });

    setSelectedFiles([]);
    setLinks([]);
    setLinkName("");
    setLinkUrl("");
  };

  const handleCancelForm = () => {
    if (saving) {
      return;
    }

    resetForm();
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");

      /*
       * 1. Creăm telegrama.
       */
      const response = await api.post(
        "/telegrame",
        formData
      );

      const newTelegram = response.data.telegram;

      /*
       * 2. Încărcăm fișierele.
       */
      const failedFiles =
        await uploadAttachments(
          newTelegram.id
        );

      /*
       * 3. Salvăm linkurile.
       */
      const failedLinks =
        await uploadLinks(newTelegram.id);

      /*
       * 4. Adăugăm telegrama în listă.
       */
      setTelegrame((current) => [
        newTelegram,
        ...current,
      ]);

      /*
       * 5. Resetăm formularul.
       */
      resetForm();
      setShowForm(false);

      /*
       * 6. Informăm dacă unele atașamente
       * nu au putut fi salvate.
       */
      if (
        failedFiles.length > 0 ||
        failedLinks.length > 0
      ) {
        let message =
          "Telegrama a fost salvată, însă unele atașamente nu au putut fi adăugate.\n\n";

        if (failedFiles.length > 0) {
          message +=
            "Fișiere:\n" +
            failedFiles.join("\n") +
            "\n\n";
        }

        if (failedLinks.length > 0) {
          message +=
            "Linkuri:\n" +
            failedLinks.join("\n");
        }

        alert(message);
      }
    } catch (error) {
      console.error(
        "Eroare adăugare telegramă:",
        error
      );

      setError(
        error.response?.data?.message ||
          "Telegrama nu a putut fi adăugată."
      );
    } finally {
      setSaving(false);
    }
  };

  const resetFilters = () => {
    setSearchTerm("");
    setDateFrom("");
    setDateTo("");
  };

  const filteredTelegrame = telegrame.filter(
    (telegram) => {
      const search = searchTerm
        .toLowerCase()
        .trim();

      const matchesSearch =
        !search ||
        telegram.title
          ?.toLowerCase()
          .includes(search) ||
        telegram.number
          ?.toLowerCase()
          .includes(search) ||
        telegram.created_by_name
          ?.toLowerCase()
          .includes(search) ||
        telegram.created_by_username
          ?.toLowerCase()
          .includes(search);

      const telegramDate = telegram.telegram_date
        ? new Date(telegram.telegram_date)
        : null;

      const matchesDateFrom =
        !dateFrom ||
        (telegramDate &&
          telegramDate >=
            new Date(`${dateFrom}T00:00:00`));

      const matchesDateTo =
        !dateTo ||
        (telegramDate &&
          telegramDate <=
            new Date(`${dateTo}T23:59:59`));

      return (
        matchesSearch &&
        matchesDateFrom &&
        matchesDateTo
      );
    }
  );

  if (loading) {
    return (
      <div className="telegrame-page">
        <div className="telegram-loading">
          Se încarcă telegramele...
        </div>
      </div>
    );
  }

  return (
    <div className="telegrame-page">
      <div className="telegrame-header">
        <div>
          <h1>Telegrame</h1>

          <p className="telegrame-description">
            Lista telegramelor disponibile în
            platformă.
          </p>
        </div>

        <div className="telegram-header-actions">
          {(user?.role === "EDITOR" ||
            user?.role === "ADMIN") && (
            <button
              type="button"
              className="telegram-add-button"
              onClick={() =>
                setShowForm(
                  (current) => !current
                )
              }
            >
              {showForm
                ? "Închide formularul"
                : "Adaugă telegramă"}
            </button>
          )}

          <input
            type="text"
            placeholder="Caută după număr, titlu sau autor..."
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(event.target.value)
            }
            className="telegram-search-input"
          />

          <input
            type="date"
            value={dateFrom}
            onChange={(event) =>
              setDateFrom(event.target.value)
            }
            className="telegram-date-filter"
          />

          <input
            type="date"
            value={dateTo}
            onChange={(event) =>
              setDateTo(event.target.value)
            }
            className="telegram-date-filter"
          />

          <button
            type="button"
            className="telegram-reset-button"
            onClick={resetFilters}
          >
            Resetează filtrele
          </button>
        </div>
      </div>

      {error && (
        <div className="telegram-error">
          {error}
        </div>
      )}

      {showForm && (
        <form
          className="telegram-form"
          onSubmit={handleSubmit}
        >
          <div className="telegram-form-header">
            <div>
              <h2>Adaugă telegramă</h2>

              <p>
                Completează datele telegramei și
                atașează documentele sau linkurile
                necesare.
              </p>
            </div>
          </div>

          <div className="telegram-form-body">
            <div className="telegram-form-group">
              <label htmlFor="telegram-number">
                Număr telegramă
              </label>

              <input
                id="telegram-number"
                type="text"
                name="number"
                value={formData.number}
                onChange={handleChange}
                placeholder="Ex: 125/2026"
              />
            </div>

            <div className="telegram-form-group">
              <label htmlFor="telegram-title">
                Titlu
              </label>

              <input
                id="telegram-title"
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Introduceți titlul telegramei"
                required
              />
            </div>

            <div className="telegram-form-group">
              <label htmlFor="telegram-date">
                Data telegramei
              </label>

              <input
                id="telegram-date"
                type="date"
                name="telegramDate"
                value={formData.telegramDate}
                onChange={handleChange}
              />
            </div>

            <div className="telegram-form-group">
              <label htmlFor="telegram-content">
                Conținut
              </label>

              <textarea
                id="telegram-content"
                name="content"
                value={formData.content}
                onChange={handleChange}
                placeholder="Introduceți conținutul telegramei..."
                rows="10"
                required
              />
            </div>

            {/* =================================================
                DOCUMENTE ȘI FIȘIERE
                ================================================= */}

            <div className="telegram-form-group">
              <label>
                Documente și fișiere
              </label>

              <div className="telegram-file-upload">
                <label
                  htmlFor="telegram-files"
                  className="telegram-file-upload-button"
                >
                  + Adaugă fișiere
                </label>

                <input
                  id="telegram-files"
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,.mov,.pdf,.doc,.docx"
                  onChange={handleFilesChange}
                  className="telegram-file-input"
                />

                <p className="telegram-file-help">
                  Poți selecta mai multe fișiere:
                  PDF, Word, imagini și video.
                  Dimensiunea maximă este de 100 MB
                  pentru fiecare fișier.
                </p>
              </div>

              {selectedFiles.length > 0 && (
                <div className="telegram-selected-files">
                  <div className="telegram-selected-files-title">
                    Fișiere selectate (
                    {selectedFiles.length})
                  </div>

                  {selectedFiles.map(
                    (file, index) => (
                      <div
                        key={`${file.name}-${file.lastModified}`}
                        className="telegram-selected-file"
                      >
                        <div className="telegram-selected-file-info">
                          <strong>
                            {file.name}
                          </strong>

                          <span>
                            {formatFileSize(
                              file.size
                            )}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="telegram-remove-file"
                          onClick={() =>
                            removeSelectedFile(
                              index
                            )
                          }
                          disabled={saving}
                        >
                          Elimină
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {/* =================================================
                LINKURI
                ================================================= */}

            <div className="telegram-form-group">
              <label>
                Linkuri și surse externe
              </label>

              <div className="telegram-link-box">
                <div className="telegram-link-fields">
                  <input
                    type="text"
                    value={linkName}
                    onChange={(event) =>
                      setLinkName(
                        event.target.value
                      )
                    }
                    placeholder="Denumire link, ex: Sursa oficială"
                  />

                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(event) =>
                      setLinkUrl(
                        event.target.value
                      )
                    }
                    placeholder="https://exemplu.md/..."
                  />

                  <button
                    type="button"
                    className="telegram-add-link-button"
                    onClick={addLinkToList}
                    disabled={saving}
                  >
                    + Adaugă link
                  </button>
                </div>

                <p className="telegram-file-help">
                  Sunt acceptate linkuri HTTP și
                  HTTPS.
                </p>

                {links.length > 0 && (
                  <div className="telegram-links-list">
                    <div className="telegram-selected-files-title">
                      Linkuri adăugate (
                      {links.length})
                    </div>

                    {links.map(
                      (link, index) => (
                        <div
                          key={`${link.url}-${index}`}
                          className="telegram-link-item"
                        >
                          <div className="telegram-link-item-info">
                            <strong>
                              {link.name}
                            </strong>

                            <span>
                              {link.url}
                            </span>
                          </div>

                          <button
                            type="button"
                            className="telegram-remove-file"
                            onClick={() =>
                              removeLinkFromList(
                                index
                              )
                            }
                            disabled={saving}
                          >
                            Elimină
                          </button>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="telegram-form-actions">
            <button
              type="button"
              className="telegram-cancel-button"
              onClick={handleCancelForm}
              disabled={saving}
            >
              Anulează
            </button>

            <button
              type="submit"
              className="telegram-save-button"
              disabled={saving}
            >
              {saving
                ? "Se salvează..."
                : "Salvează telegrama"}
            </button>
          </div>
        </form>
      )}

      {telegrame.length === 0 ? (
        <div className="telegram-empty">
          Nu există telegrame.
        </div>
      ) : (
        <div className="telegrame-table-wrapper">
          <table className="telegrame-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Număr</th>
                <th>Titlu</th>
                <th>Data</th>
                <th>Creat de</th>
              </tr>
            </thead>

            <tbody>
              {filteredTelegrame.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    className="telegram-no-results"
                  >
                    Nu au fost găsite rezultate.
                  </td>
                </tr>
              ) : (
                filteredTelegrame.map(
                  (telegram) => (
                    <tr
                      key={telegram.id}
                      className="telegram-row"
                      onClick={() =>
                        navigate(
                          `/telegrame/${telegram.id}`
                        )
                      }
                    >
                      <td>{telegram.id}</td>

                      <td>
                        {telegram.number || "-"}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="telegram-title-link"
                          onClick={(event) => {
                            event.stopPropagation();

                            navigate(
                              `/telegrame/${telegram.id}`
                            );
                          }}
                        >
                          {telegram.title}
                        </button>
                      </td>

                      <td>
                        {telegram.telegram_date
                          ? new Date(
                              telegram.telegram_date
                            ).toLocaleDateString(
                              "ro-RO"
                            )
                          : "-"}
                      </td>

                      <td>
                        {telegram.created_by_name ||
                          telegram.created_by_username ||
                          "-"}
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Telegrame;