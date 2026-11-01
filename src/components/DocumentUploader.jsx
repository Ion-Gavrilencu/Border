import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import imageCompression from "browser-image-compression";
import {
  CloudUpload,
  FileText,
  Image as ImageIcon,
  Link2,
  Trash2,
  FileCheck2,
  Video,
  Upload,
  FileType2,
} from "lucide-react";
import "./DocumentUploader.css";

const MAX_INPUT_SIZE = 100 * 1024 * 1024;
const MAX_UPLOAD_SIZE = 4 * 1024 * 1024;
const TARGET_IMAGE_SIZE_MB = 1;
const ACCEPTED = {
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};
const VIDEO_ACCEPTED = {
  "video/mp4": [".mp4"],
  "video/webm": [".webm"],
  "video/quicktime": [".mov"],
};
const isImage = (file) => file?.type?.startsWith("image/") ?? false;
const isVideo = (file) => file?.type?.startsWith("video/") ?? false;
const formatSize = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

async function prepareFile(file) {
  if (!isImage(file)) {
    if (file.size > MAX_UPLOAD_SIZE) {
      throw new Error(
        `${file.name}: fișierul depășește 4 MB. Limita este necesară pentru încărcarea actuală pe Vercel.`,
      );
    }
    return file;
  }

  if (file.size <= TARGET_IMAGE_SIZE_MB * 1024 * 1024) return file;

  const compressed = await imageCompression(file, {
    maxSizeMB: TARGET_IMAGE_SIZE_MB,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    initialQuality: 0.85,
    preserveExif: false,
  });

  if (compressed.size > MAX_UPLOAD_SIZE) {
    throw new Error(`${file.name}: fotografia rămâne prea mare după comprimare.`);
  }

  // Menținem un obiect File, necesar pentru FormData și previzualizare.
  return new File([compressed], file.name, {
    type: compressed.type || file.type,
    lastModified: file.lastModified,
  });
}

function PreviewFile({ file, onRemove, disabled }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    setPreviewFailed(false);
    if (!isImage(file) || !(file instanceof Blob)) {
      setPreviewUrl(null);
      return undefined;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="du-file">
      <div className="du-file-preview">
        {previewUrl && !previewFailed ? (
          <img src={previewUrl} alt={file.name} onError={() => setPreviewFailed(true)} />
        ) : isVideo(file) ? (
          <Video size={22} />
        ) : isImage(file) ? (
          <ImageIcon size={22} />
        ) : (
          <FileText size={22} />
        )}
      </div>
      <div className="du-file-info">
        <strong title={file.name}>{file.name}</strong>
        <span>{formatSize(file.size)}</span>
      </div>
      <button
        type="button"
        className="du-remove"
        onClick={onRemove}
        disabled={disabled}
        title="Elimină fișierul"
        aria-label={`Elimină ${file.name}`}
      >
        <Trash2 size={17} />
      </button>
    </div>
  );
}

export default function DocumentUploader({
  files = [],
  onFilesChange,
  linkUrl = "",
  onLinkChange,
  disabled = false,
  onError,
  allowMixed = false,
  variant = "default",
}) {
  const [processing, setProcessing] = useState(false);
  const busyRef = useRef(false);
  const filesRef = useRef(files);
  filesRef.current = files;

  const onDrop = useCallback(
    async (acceptedFiles, rejectedFiles) => {
      if (disabled || busyRef.current) return;
      if (rejectedFiles.length) {
        onError?.(
          "Unul sau mai multe fișiere au un format neacceptat ori depășesc limita de 100 MB.",
        );
      }
      if (!acceptedFiles.length) return;

      if (!allowMixed && !acceptedFiles.every(isImage) && acceptedFiles.length > 1) {
        onError?.("Poți adăuga mai multe fotografii sau un singur document.");
        return;
      }

      busyRef.current = true;
      setProcessing(true);
      try {
        const results = await Promise.allSettled(acceptedFiles.map(prepareFile));
        const prepared = results
          .filter((result) => result.status === "fulfilled")
          .map((result) => result.value);
        const errors = results
          .filter((result) => result.status === "rejected")
          .map((result) => result.reason?.message || "Fișierul nu a putut fi pregătit.");

        if (prepared.length) {
          const existing = filesRef.current || [];
          if (allowMixed) {
            onFilesChange(existing.concat(prepared));
          } else {
            const next = existing.concat(prepared);
            if (next.length > 1 && !next.every(isImage)) {
              onError?.("Poți adăuga mai multe fotografii sau un singur document.");
              return;
            }
            onFilesChange(prepared);
            onLinkChange?.("");
          }
        }
        if (errors.length) onError?.(errors.join(" "));
        else if (!rejectedFiles.length) onError?.("");
      } finally {
        busyRef.current = false;
        setProcessing(false);
      }
    },
    [disabled, allowMixed, onFilesChange, onLinkChange, onError],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: allowMixed ? { ...ACCEPTED, ...VIDEO_ACCEPTED } : ACCEPTED,
    maxSize: MAX_INPUT_SIZE,
    multiple: true,
    disabled: disabled || processing,
    noClick: true,
    noKeyboard: true,
  });
  const isTelegram = variant === "telegram";
  return (
    <div className={`du-container${isTelegram ? " du-telegram" : ""}`}>
      <div {...getRootProps({ className: `du-dropzone ${isDragActive ? "du-active" : ""}` })}>
        <input {...getInputProps()} />
        <div className="du-upload-icon">
          <CloudUpload size={isTelegram ? 54 : 28} strokeWidth={1.8} />
        </div>
        <strong>
          {processing
            ? "Se comprimă fotografiile..."
            : isDragActive
              ? "Eliberează fișierele aici"
              : "Trage fișierele aici"}
        </strong>
        <p>Sau selectează-le de pe calculator</p>
        <button
          type="button"
          className="du-select-button"
          onClick={open}
          disabled={disabled || processing}
        >
          <Upload size={19} />
          {processing ? "Se pregătesc..." : "Alege fișiere"}
        </button>
        <div className="du-formats">
          {isTelegram ? (
            <>
              <span className="du-format-pdf">
                <FileText size={18} />
                PDF
              </span>
              <span className="du-format-word">
                <FileType2 size={18} />
                Word
              </span>
              <span className="du-format-image">
                <ImageIcon size={18} />
                JPG / PNG / WEBP
              </span>
            </>
          ) : (
            <>
              <span>
                <FileText size={13} />
                PDF / Word
              </span>
              <span>
                <ImageIcon size={13} />
                JPG / PNG / WEBP
              </span>
            </>
          )}
          {allowMixed && (
            <span>
              <Video size={13} />
              MP4 / WEBM / MOV
            </span>
          )}
        </div>
        <small>
          {allowMixed
            ? "Poți selecta mai multe fișiere și adăuga un link."
            : "Mai multe fotografii sau un singur document."}{" "}
          Fotografii comprimate automat; alte fișiere max. 4 MB.
        </small>
      </div>
      {files.length > 0 && (
        <div className="du-selected">
          <div className="du-selected-header">
            <span>
              <FileCheck2 size={16} />
              Fișiere selectate
            </span>
            <span className="du-count">{files.length}</span>
          </div>
          <div className="du-files-grid">
            {files.map((file, index) => (
              <PreviewFile
                key={`${file.name}-${file.lastModified}-${index}`}
                file={file}
                disabled={disabled || processing}
                onRemove={() => onFilesChange(files.filter((_, fileIndex) => fileIndex !== index))}
              />
            ))}
          </div>
        </div>
      )}
      <div className="du-separator">
        <span />
        <small>{allowMixed ? "ADAUGĂ ȘI UN LINK" : "SAU ADAUGĂ UN LINK"}</small>
        <span />
      </div>
      <div className="du-link-wrapper">
        <Link2 size={23} />
        <input
          type="url"
          placeholder="https://exemplu.md/document"
          aria-label="Link extern"
          value={linkUrl}
          disabled={disabled || processing}
          onChange={(event) => {
            const value = event.target.value;
            onLinkChange?.(value);
            if (!allowMixed && value.trim()) onFilesChange([]);
            onError?.("");
          }}
        />
      </div>
    </div>
  );
}
