
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const os = require("os");

// Detectăm mediul Vercel
const isVercel = process.env.VERCEL === "1";

// Directorul pentru încărcarea fișierelor
const uploadDirectory = isVercel
  ? path.join(os.tmpdir(), "border-uploads", "attachments")
  : path.resolve(
      process.env.UPLOAD_DIR ||
        path.join(__dirname, "..", "uploads", "attachments")
    );

// Creăm directorul doar dacă nu există
fs.mkdirSync(uploadDirectory, {
  recursive: true,
});

const allowedMimeTypes = [
  // Imagini
  "image/jpeg",
  "image/png",
  "image/webp",

  // Video
  "video/mp4",
  "video/webm",
  "video/quicktime",

  // PDF
  "application/pdf",

  // Word
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname);

    const uniqueName =
      `${Date.now()}-${Math.round(Math.random() * 1e9)}` +
      extension.toLowerCase();

    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Tipul acestui fișier nu este permis. Sunt acceptate imagini, video, PDF și Word."
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

module.exports = upload;
