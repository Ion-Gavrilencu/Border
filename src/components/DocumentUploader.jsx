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

// =====================================================
// CONFIGURARE
// =====================================================

const MB = 1024 * 1024;

const MAX_INPUT_SIZE = 100 * MB;
const MAX_UPLOAD_SIZE = 4 * MB;

const TARGET_IMAGE_SIZE_MB = 1;

// Nu impunem o limită fixă de pagini.
// Documentele sunt procesate succesiv.
const PDF_PROFILES = [
  {
    scale: 1.5,
    quality: 0.78,
    label: "Echilibrat",
  },
  {
    scale: 1.25,
    quality: 0.69,
    label: "Compact",
  },
  {
    scale: 1.05,
    quality: 0.62,
    label: "Compact suplimentar",
  },
];

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

// =====================================================
// FUNCȚII AUXILIARE
// =====================================================

const isPdf = (file) => file?.type === "application/pdf" || /\.pdf$/i.test(file?.name || "");

const isImage = (file) => file?.type?.startsWith("image/") ?? false;

const isVideo = (file) => file?.type?.startsWith("video/") ?? false;

const formatSize = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;

  if (bytes < MB) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / MB).toFixed(2)} MB`;
};

const optimizationInfo = new WeakMap();

const pauseBrowser = () => new Promise((resolve) => setTimeout(resolve, 0));

function createPreparedFile(original, data, mimeType) {
  const prepared = new File([data], original.name, {
    type: mimeType,
    lastModified: original.lastModified,
  });

  if (prepared.size < original.size) {
    optimizationInfo.set(prepared, {
      originalSize: original.size,
      saved: original.size - prepared.size,
    });
  }

  return prepared;
}

// =====================================================
// CANVAS -> JPEG
// =====================================================

function canvasToJpeg(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error("Nu s-a putut genera imaginea paginii PDF."));
          return;
        }

        try {
          const buffer = await blob.arrayBuffer();
          resolve(new Uint8Array(buffer));
        } catch (error) {
          reject(error);
        }
      },
      "image/jpeg",
      quality,
    );
  });
}

// =====================================================
// VERIFICARE PDF
// =====================================================

async function inspectPdf(pdf, file) {
  // Nu reconstruim documente care conțin text selectabil,
  // adnotări sau formulare, pentru a nu pierde informații.
  const fields = await pdf.getFieldObjects();

  if (fields && Object.keys(fields).length > 0) {
    throw new Error(`${file.name}: PDF-ul conține formulare. ` + "Originalul trebuie păstrat.");
  }

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);

    try {
      const [textContent, annotations] = await Promise.all([
        page.getTextContent(),
        page.getAnnotations(),
      ]);

      const hasText = textContent.items.some(
        (item) => typeof item.str === "string" && item.str.trim().length > 0,
      );

      if (hasText) {
        throw new Error(
          `${file.name}: PDF-ul conține text selectabil. ` +
            "Nu îl reconstruim pentru a păstra textul original.",
        );
      }

      if (annotations.length > 0) {
        throw new Error(
          `${file.name}: PDF-ul conține adnotări sau elemente interactive. ` +
            "Originalul trebuie păstrat.",
        );
      }
    } finally {
      page.cleanup();
    }

    // Permitem browserului să răspundă între verificări.
    if (pageNumber % 5 === 0) {
      await pauseBrowser();
    }
  }
}

// =====================================================
// RECONSTRUIRE PDF SCANAT
// =====================================================

async function buildOptimizedPdf(pdf, jsPDF, profile, onProgress) {
  let output = null;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);

    let canvas = null;

    try {
      const viewport = page.getViewport({
        scale: profile.scale,
      });

      canvas = document.createElement("canvas");

      canvas.width = Math.max(1, Math.ceil(viewport.width));

      canvas.height = Math.max(1, Math.ceil(viewport.height));

      const context = canvas.getContext("2d", {
        alpha: false,
      });

      if (!context) {
        throw new Error("Browserul nu poate crea suprafața de procesare PDF.");
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: context,
        canvas,
        viewport,
        background: "rgb(255,255,255)",
      }).promise;

      const jpegBytes = await canvasToJpeg(canvas, profile.quality);

      // Viewport la scale 1 are dimensiuni în puncte PDF.
      // Nu aplicăm conversia suplimentară 72 / 96.
      const originalViewport = page.getViewport({
        scale: 1,
      });

      const width = originalViewport.width;
      const height = originalViewport.height;

      const orientation = width > height ? "landscape" : "portrait";

      if (!output) {
        output = new jsPDF({
          orientation,
          unit: "pt",
          format: [width, height],
          compress: true,
          putOnlyUsedFonts: true,
        });
      } else {
        output.addPage([width, height], orientation);
      }

      output.addImage(jpegBytes, "JPEG", 0, 0, width, height, undefined, "FAST");

      onProgress?.({
        page: pageNumber,
        total: pdf.numPages,
        profile: profile.label,
      });
    } finally {
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
        canvas = null;
      }

      page.cleanup();
    }

    if (pageNumber % 4 === 0) {
      await pauseBrowser();
    }
  }

  if (!output) {
    throw new Error("Documentul PDF nu conține pagini valide.");
  }

  return output.output("arraybuffer");
}

// =====================================================
// OPTIMIZARE PDF
// =====================================================

async function optimizeScannedPdf(file, onProgress) {
  // PDF-urile deja acceptate de backend sunt păstrate.
  // Evităm modificarea inutilă a documentelor mici.
  if (file.size <= MAX_UPLOAD_SIZE) {
    return file;
  }

  let pdf = null;

  try {
    onProgress?.({
      message: "Se analizează PDF-ul...",
    });

    const [pdfjs, jspdfModule, workerModule] = await Promise.all([
      import("pdfjs-dist"),
      import("jspdf"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]);

    const { jsPDF } = jspdfModule;

    pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;

    const source = new Uint8Array(await file.arrayBuffer());

    pdf = await pdfjs.getDocument({
      data: source,
      useSystemFonts: true,
    }).promise;

    if (!pdf.numPages) {
      throw new Error(`${file.name}: documentul nu conține pagini.`);
    }

    // Verificare conservatoare pentru semnături/formulare.
    // Aceasta nu reprezintă o validare criptografică.
    const rawBytes = await file.arrayBuffer();
    const rawText = new TextDecoder("latin1").decode(new Uint8Array(rawBytes));

    const hasSensitiveStructures = /\/ByteRange\s*\[|\/Sig\b|\/AcroForm\b|\/XFA\b/.test(rawText);

    if (hasSensitiveStructures) {
      throw new Error(
        `${file.name}: PDF-ul poate conține semnături ` + "sau formulare. Nu îl modificăm automat.",
      );
    }

    onProgress?.({
      message: `Se verifică ${pdf.numPages} pagini...`,
    });

    await inspectPdf(pdf, file);

    // Încercăm profilurile în ordine:
    // echilibrat -> compact -> compact suplimentar.
    for (const profile of PDF_PROFILES) {
      onProgress?.({
        message: `Se comprimă PDF-ul: ${profile.label}...`,
      });

      const bytes = await buildOptimizedPdf(pdf, jsPDF, profile, onProgress);

      if (bytes.byteLength <= MAX_UPLOAD_SIZE && bytes.byteLength < file.size) {
        const prepared = createPreparedFile(file, bytes, "application/pdf");

        onProgress?.({
          message: "PDF optimizat cu succes.",
        });

        return prepared;
      }

      // Eliberăm referința la rezultatul profilului curent
      // înainte de următoarea încercare.
      await pauseBrowser();
    }

    throw new Error(
      `${file.name}: documentul nu poate fi redus ` +
        "sub 4 MB cu profilurile disponibile. " +
        "Încearcă împărțirea în documente mai mici.",
    );
  } catch (error) {
    if (error?.message?.startsWith(`${file.name}:`)) {
      throw error;
    }

    throw new Error(
      `${file.name}: optimizarea PDF a eșuat: ` + (error?.message || "eroare necunoscută"),
    );
  } finally {
    if (pdf) {
      try {
        await pdf.destroy();
      } catch (error) {
        console.warn("Nu s-au putut elibera complet resursele PDF:", error);
      }
    }
  }
}

// =====================================================
// OPTIMIZARE IMAGINI
// =====================================================

async function optimizeImage(file) {
  if (file.size <= 250 * 1024) {
    return file;
  }

  let compressed;

  try {
    compressed = await imageCompression(file, {
      maxSizeMB: TARGET_IMAGE_SIZE_MB,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      initialQuality: 0.85,
      preserveExif: false,
      fileType: file.type,
    });
  } catch (error) {
    if (file.size > MAX_UPLOAD_SIZE) {
      throw new Error(
        `${file.name}: optimizarea fotografiei a eșuat ` + "și fișierul depășește 4 MB.",
      );
    }

    return file;
  }

  const chosen = compressed.size < file.size ? compressed : file;

  if (chosen.size > MAX_UPLOAD_SIZE) {
    throw new Error(`${file.name}: fotografia depășește 4 MB ` + "după optimizare.");
  }

  if (chosen === file) {
    return file;
  }

  return createPreparedFile(file, chosen, chosen.type || file.type);
}

// =====================================================
// PREGĂTIRE FIȘIERE
// =====================================================

async function prepareFile(file, onProgress) {
  if (isPdf(file)) {
    return optimizeScannedPdf(file, onProgress);
  }

  if (isImage(file)) {
    return optimizeImage(file);
  }

  // Word și video rămân nemodificate.
  if (file.size > MAX_UPLOAD_SIZE) {
    throw new Error(`${file.name}: fișierul depășește limita ` + "actuală de 4 MB.");
  }

  return file;
}

// =====================================================
// PREVIZUALIZARE FIȘIER
// =====================================================

function PreviewFile({ file, onRemove, disabled }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  const savings = optimizationInfo.get(file);

  useEffect(() => {
    setPreviewFailed(false);

    if (!isImage(file) || !(file instanceof Blob)) {
      setPreviewUrl(null);
      return undefined;
    }

    const url = URL.createObjectURL(file);

    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
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

        {savings && (
          <span className="du-savings" title={`Inițial ${formatSize(savings.originalSize)}`}>
            Economisit {formatSize(savings.saved)} (
            {Math.round((savings.saved / savings.originalSize) * 100)}
            %)
          </span>
        )}
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

// =====================================================
// COMPONENTA PRINCIPALĂ
// =====================================================

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
  const [progressText, setProgressText] = useState("");

  const busyRef = useRef(false);
  const filesRef = useRef(files);

  filesRef.current = files;

  const onDrop = useCallback(
    async (acceptedFiles, rejectedFiles) => {
      if (disabled || busyRef.current) return;

      const errors = [];

      if (rejectedFiles.length) {
        errors.push(
          "Unul sau mai multe fișiere au un format " + "neacceptat ori depășesc limita de 100 MB.",
        );
      }

      if (!acceptedFiles.length) {
        if (errors.length) {
          onError?.(errors.join(" "));
        }
        return;
      }

      if (!allowMixed && !acceptedFiles.every(isImage) && acceptedFiles.length > 1) {
        onError?.("Poți adăuga mai multe fotografii " + "sau un singur document.");
        return;
      }

      busyRef.current = true;
      setProcessing(true);

      try {
        const prepared = [];

        // Procesare succesivă:
        // reduce consumul simultan de memorie
        // și păstrează ordinea fișierelor.
        for (let index = 0; index < acceptedFiles.length; index++) {
          const file = acceptedFiles[index];

          setProgressText(`Pregătire ${index + 1}/${acceptedFiles.length}: ${file.name}`);

          try {
            const optimized = await prepareFile(file, (progress) => {
              if (progress?.message) {
                setProgressText(progress.message);
              } else if (progress?.page && progress?.total) {
                setProgressText(
                  `${progress.profile || "Optimizare"}: ` +
                    `pagina ${progress.page}/${progress.total}`,
                );
              }
            });

            prepared.push(optimized);
          } catch (error) {
            errors.push(error?.message || `${file.name}: pregătirea a eșuat.`);
          }

          await pauseBrowser();
        }

        if (prepared.length) {
          const existing = filesRef.current || [];

          if (allowMixed) {
            onFilesChange?.(existing.concat(prepared));
          } else {
            const next = existing.concat(prepared);

            if (next.length > 1 && !next.every(isImage)) {
              errors.push("Poți adăuga mai multe fotografii " + "sau un singur document.");
            } else {
              onFilesChange?.(next);
              onLinkChange?.("");
            }
          }
        }

        if (errors.length) {
          onError?.(errors.join(" "));
        } else {
          onError?.("");
        }
      } catch (error) {
        onError?.(error?.message || "A apărut o eroare la pregătirea fișierelor.");
      } finally {
        busyRef.current = false;
        setProcessing(false);
        setProgressText("");
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

  const totalSaved = files.reduce((sum, file) => sum + (optimizationInfo.get(file)?.saved || 0), 0);

  return (
    <div className={`du-container${isTelegram ? " du-telegram" : ""}`}>
      <div
        {...getRootProps({
          className: `du-dropzone ${isDragActive ? "du-active" : ""}`,
        })}
      >
        <input {...getInputProps()} />

        <div className="du-upload-icon">
          <CloudUpload size={isTelegram ? 54 : 28} strokeWidth={1.8} />
        </div>

        <strong>
          {processing
            ? "Se optimizează fișierele..."
            : isDragActive
              ? "Eliberează fișierele aici"
              : "Trage fișierele aici"}
        </strong>

        <p>{processing && progressText ? progressText : "Sau selectează-le de pe calculator"}</p>

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
          Fotografiile și PDF-urile scanate sunt optimizate automat; Word și video max. 4 MB.
          PDF-urile digitale rămân intacte.
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

          {totalSaved > 0 && (
            <div className="du-total-savings" role="status">
              Spațiu economisit: {formatSize(totalSaved)}
            </div>
          )}

          <div className="du-files-grid">
            {files.map((file, index) => (
              <PreviewFile
                key={`${file.name}-${file.lastModified}-${index}`}
                file={file}
                disabled={disabled || processing}
                onRemove={() =>
                  onFilesChange?.(files.filter((_, fileIndex) => fileIndex !== index))
                }
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

            if (!allowMixed && value.trim()) {
              onFilesChange?.([]);
            }

            onError?.("");
          }}
        />
      </div>
    </div>
  );
}
