import {
  Pencil, ExternalLink, Paperclip, UploadCloud, Plus, X,
  CheckCircle2, File as FileIcon, Download, Trash2,
  LockKeyhole, RefreshCw,
} from "lucide-react";
import React, { useRef } from "react";
import api from "../../services/api";

const MAX_FILES = 10;
const categories = [
  { value: "documente", label: "Documente falsificate" },
  { value: "transport", label: "Control transport" },
  { value: "contrabanda", label: "Contrabandă" },
  { value: "migratie", label: "Migrație ilegală" },
  { value: "altele", label: "Alte noutăți" },
];
const getFileName = (attachment) => attachment.original_name || attachment.name || "Document";
const formatFileSize = (bytes) => {
  const size = Number(bytes);
  return Number.isFinite(size) ? `${(size / 1024 / 1024).toFixed(2)} MB` : "";
};
const isImageAttachment = (attachment) =>
  attachment.attachment_type === "file" && attachment.file_category === "image";

function PrivateNewsImage({ attachment, className = "" }) {
  const [src, setSrc] = React.useState("");
  React.useEffect(() => {
    let active = true;
    let url = "";
    setSrc("");
    api.get(`/attachments/file/${attachment.id}`, { responseType: "blob" })
      .then(({ data }) => {
        if (!active) return;
        url = URL.createObjectURL(data);
        setSrc(url);
      })
      .catch((error) => console.error("NEWS IMAGE ERROR:", error));
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [attachment.id]);
  return src ? <img src={src} alt={getFileName(attachment)} className={className} /> : <div className={`border-news-photo border-news-placeholder ${className}`} />;
}

export default function NewsForm({
  editingId, form, saving, selectedFiles, editingAttachments,
  attachmentsLoading, uploadProgress, removingAttachmentId, canDelete,
  onSubmit, onCancel, updateForm, setForm, handleSelectFiles,
  removeSelectedFile, handleDownloadAttachment, handleRemoveAttachment,
}) {
  const fileInputRef = useRef(null);
  return (
    <form className="border-news-form" onSubmit={onSubmit}>
              <h3>
                {editingId !== null ? "Editează noutatea" : "Publică o noutate"}
              </h3>

              <div className="border-news-form-grid">
                <div className="border-news-publication-type">
                  <span className="border-news-field-label">
                    Tipul publicației
                  </span>

                  <div className="border-news-type-grid">
                    <button
                      type="button"
                      className={`border-news-type-option ${
                        form.type === "internal" ? "active" : ""
                      }`}
                      disabled={saving}
                      aria-pressed={form.type === "internal"}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          type: "internal",
                          url: "",
                        }))
                      }
                    >
                      <div className="border-news-type-title">
                        <Pencil size={20} />

                        <strong>Știre proprie</strong>
                      </div>

                      <span>Text, fotografie și documente</span>
                    </button>

                    <button
                      type="button"
                      className={`border-news-type-option ${
                        form.type === "external" ? "active" : ""
                      }`}
                      disabled={saving}
                      aria-pressed={form.type === "external"}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          type: "external",
                          content: "",
                        }))
                      }
                    >
                      <div className="border-news-type-title">
                        <ExternalLink size={20} />

                        <strong>Articol extern</strong>
                      </div>

                      <span>Link către publicația originală</span>
                    </button>
                  </div>
                </div>

                <label>
                  Categorie
                  <select
                    value={form.category}
                    disabled={saving}
                    onChange={(event) =>
                      updateForm("category", event.target.value)
                    }
                  >
                    {categories.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                Titlul știrii *
                <input
                  type="text"
                  value={form.title}
                  maxLength={300}
                  required
                  disabled={saving}
                  onChange={(event) => updateForm("title", event.target.value)}
                  placeholder="Introdu titlul noutății"
                />
              </label>

              {form.type === "external" ? (
                <label>
                  Link către articol *
                  <input
                    type="url"
                    value={form.url}
                    maxLength={2048}
                    required
                    disabled={saving}
                    onChange={(event) => updateForm("url", event.target.value)}
                    placeholder="https://site.md/articol"
                  />
                </label>
              ) : (
                <label>
                  Conținutul știrii *
                  <textarea
                    value={form.content}
                    maxLength={20000}
                    required
                    rows={8}
                    disabled={saving}
                    onChange={(event) =>
                      updateForm("content", event.target.value)
                    }
                    placeholder="Redactează conținutul noutății..."
                  />
                </label>
              )}

              <label>
                Sursa
                <input
                  type="text"
                  value={form.source}
                  maxLength={150}
                  disabled={saving}
                  onChange={(event) => updateForm("source", event.target.value)}
                  placeholder="Ex.: Poliția de Frontieră"
                />
              </label>

              {/* IMAGINE PRINCIPALĂ PRIN LINK */}
              <label>
                Link imagine principală (opțional)
                <input
                  type="url"
                  value={form.image_url || ""}
                  maxLength={2048}
                  disabled={saving}
                  onChange={(event) =>
                    updateForm("image_url", event.target.value)
                  }
                  placeholder="https://exemplu.md/fotografie.jpg"
                />
                <small>
                  Introdu adresa directă a fotografiei (JPG, PNG sau WEBP).
                  Dacă încarci și fotografii private, prima fotografie încărcată
                  are prioritate în lista știrilor.
                </small>
              </label>

              {form.image_url?.trim() && (
                <div className="border-news-url-preview">
                  <strong>Previzualizare imagine din link</strong>
                  <div style={{ marginTop: 10 }}>
                    <img
                      key={form.image_url}
                      src={form.image_url}
                      alt="Previzualizarea imaginii principale"
                      referrerPolicy="no-referrer"
                      style={{
                        display: "block",
                        width: "100%",
                        maxWidth: 360,
                        maxHeight: 220,
                        objectFit: "contain",
                        borderRadius: 12,
                      }}
                    />
                  </div>
                  <small>
                    Dacă imaginea nu apare, verifică dacă linkul duce direct
                    la o fotografie și dacă site-ul permite afișarea ei.
                  </small>
                </div>
              )}

              {/* ÎNCĂRCARE DIRECTĂ */}
              <div className="border-news-upload-section">
                <div className="border-news-upload-heading">
                  <div>
                    <h4>Fotografii și documente</h4>

                    <p>
                      Poți încărca mai multe fotografii și documente PDF sau
                      Word. Prima fotografie încărcată va fi afișată ca imagine
                      principală. Maximum 10 fișiere în total, câte 4 MB
                      fiecare.
                    </p>
                  </div>

                  <Paperclip size={21} />
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx"
                  onChange={handleSelectFiles}
                  disabled={saving}
                  style={{
                    display: "none",
                  }}
                />

                <button
                  type="button"
                  className="border-news-upload-zone"
                  disabled={saving || selectedFiles.length >= MAX_FILES}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span className="border-news-upload-icon">
                    <UploadCloud size={30} />
                  </span>

                  <strong>Încarcă fotografia sau documentele</strong>

                  <span>Selectează din telefon sau calculator</span>

                  <span>JPG, PNG, WEBP, PDF, DOC, DOCX</span>

                  <span className="border-news-upload-button">
                    <Plus size={16} />
                    Selectează fișiere
                  </span>
                </button>

                {/* FIȘIERE SELECTATE */}
                {selectedFiles.length > 0 && (
                  <div className="border-news-selected-files">
                    <div className="border-news-selected-header">
                      <strong>
                        Fișiere selectate ({selectedFiles.length})
                      </strong>

                      <CheckCircle2 size={18} />
                    </div>

                    {selectedFiles.map((file, index) => (
                      <div
                        className="border-news-selected-item"
                        key={`${file.name}-${file.size}-${index}`}
                      >
                        <FileIcon size={19} />

                        <div>
                          <strong>{file.name}</strong>

                          <small>{formatFileSize(file.size)}</small>
                        </div>

                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => removeSelectedFile(index)}
                          aria-label={`Elimină ${file.name}`}
                        >
                          <X size={17} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* ATAȘAMENTE SALVATE */}
                {editingId !== null && (
                  <div className="border-news-saved-attachments">
                    <h4>Atașamente salvate</h4>

                    {attachmentsLoading[editingId] ? (
                      <p>Se încarcă atașamentele...</p>
                    ) : editingAttachments.length === 0 ? (
                      <p>Nu există atașamente salvate.</p>
                    ) : (
                      editingAttachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="border-news-saved-file"
                        >
                          {isImageAttachment(attachment) ? (
                            <PrivateNewsImage
                              attachment={attachment}
                              className="border-news-private-thumbnail"
                            />
                          ) : (
                            <FileIcon size={22} />
                          )}

                          <div className="border-news-saved-file-info">
                            <strong>{getFileName(attachment)}</strong>

                            <small>
                              {formatFileSize(attachment.file_size)}
                            </small>
                          </div>

                          {attachment.attachment_type === "file" && (
                            <button
                              type="button"
                              onClick={() =>
                                handleDownloadAttachment(attachment)
                              }
                              title="Descarcă"
                            >
                              <Download size={17} />
                            </button>
                          )}

                          {canDelete && (
                            <button
                              type="button"
                              disabled={
                                saving || removingAttachmentId === attachment.id
                              }
                              onClick={() => handleRemoveAttachment(attachment)}
                              title="Șterge atașamentul"
                            >
                              <Trash2 size={17} />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                <div className="border-news-private-note">
                  <LockKeyhole size={16} />

                  <span>
                    Fișierele încărcate sunt păstrate în spațiul privat și
                    accesate prin autentificarea aplicației.
                  </span>
                </div>

                {uploadProgress && (
                  <div className="border-news-upload-progress" role="status">
                    <RefreshCw size={17} className="refresh-spin" />

                    {uploadProgress}
                  </div>
                )}
              </div>

              {/* ACȚIUNI */}
              <div className="border-news-form-actions">
                <button
                  type="button"
                  className="border-news-cancel"
                  onClick={onCancel}
                  disabled={saving}
                >
                  Anulează
                </button>

                <button
                  type="submit"
                  className="border-news-add"
                  disabled={saving}
                >
                  {saving
                    ? "Se salvează..."
                    : editingId !== null
                      ? "Salvează modificările"
                      : "Publică noutatea"}
                </button>
              </div>
    </form>
  );
}
