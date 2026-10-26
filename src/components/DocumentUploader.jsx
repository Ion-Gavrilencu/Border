
import { useCallback, useEffect, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import {
  CloudUpload,
  FileText,
  Image as ImageIcon,
  Link2,
  Trash2,
  FileCheck2,
  Video,
} from "lucide-react";

import "./DocumentUploader.css";

const ACCEPTED = {
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

const VIDEO_ACCEPTED = {
  "video/mp4": [".mp4"],
  "video/webm": [".webm"],
  "video/quicktime": [".mov"],
};

const isImage = (file) => file.type.startsWith("image/");
const isVideo = (file) => file.type.startsWith("video/");

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function PreviewFile({ file, onRemove, disabled }) {
  const previewUrl = useMemo(
    () => (isImage(file) ? URL.createObjectURL(file) : null),
    [file],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className="du-file">
      <div className="du-file-preview">
        {previewUrl ? (
          <img src={previewUrl} alt={file.name} />
        ) : isVideo(file) ? (
          <Video size={22} />
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
}) {
  const onDrop = useCallback(
    (acceptedFiles, rejectedFiles) => {
      if (disabled) return;

      if (rejectedFiles.length) {
        onError?.(
          "Unul sau mai multe fișiere au un format neacceptat ori depășesc limita de 100 MB.",
        );
      }

      if (!acceptedFiles.length) return;

      if (allowMixed) {
        onFilesChange((files || []).concat(acceptedFiles));
        onError?.("");
        return;
      }

      const allImages = acceptedFiles.every(isImage);

      if (!allImages && acceptedFiles.length > 1) {
        onError?.(
          "Poți adăuga mai multe fotografii sau un singur document.",
        );
        return;
      }

      onFilesChange(acceptedFiles);
      onLinkChange("");
      onError?.("");
    },
    [
      disabled,
      allowMixed,
      files,
      onFilesChange,
      onLinkChange,
      onError,
    ],
  );

  const { getRootProps, getInputProps, isDragActive, open } =
    useDropzone({
      onDrop,
      accept: allowMixed
        ? { ...ACCEPTED, ...VIDEO_ACCEPTED }
        : ACCEPTED,
      maxSize: 100 * 1024 * 1024,
      multiple: true,
      disabled,
      noClick: true,
      noKeyboard: true,
    });

  return (
    <div className="du-container">
      <div
        {...getRootProps({
          className: `du-dropzone ${isDragActive ? "du-active" : ""}`,
        })}
      >
        <input {...getInputProps()} />

        <div className="du-upload-icon">
          <CloudUpload size={28} />
        </div>

        <strong>
          {isDragActive
            ? "Eliberează fișierele aici"
            : "Trage fișierele aici"}
        </strong>

        <p>Sau selectează-le de pe calculator</p>

        <button
          type="button"
          className="du-select-button"
          onClick={open}
          disabled={disabled}
        >
          <CloudUpload size={16} />
          Alege fișiere
        </button>

        <div className="du-formats">
          <span>
            <FileText size={13} />
            PDF / Word
          </span>

          <span>
            <ImageIcon size={13} />
            JPG / PNG / WEBP
          </span>

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
            : "Mai multe fotografii sau un singur document."}
          {" "}Max. 100 MB/fișier
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
                disabled={disabled}
                onRemove={() =>
                  onFilesChange(
                    files.filter(
                      (_, fileIndex) => fileIndex !== index,
                    ),
                  )
                }
              />
            ))}
          </div>
        </div>
      )}

      <div className="du-separator">
        <span />
        <small>
          {allowMixed ? "ADAUGĂ ȘI UN LINK" : "SAU ADAUGĂ UN LINK"}
        </small>
        <span />
      </div>

      <div className="du-link-wrapper">
        <Link2 size={19} />

        <input
          type="url"
          placeholder="https://exemplu.md/document"
          aria-label="Link extern"
          value={linkUrl}
          disabled={disabled}
          onChange={(event) => {
            const value = event.target.value;

            onLinkChange(value);

            if (!allowMixed && value.trim()) {
              onFilesChange([]);
            }

            onError?.("");
          }}
        />
      </div>
    </div>
  );
}
