
const multer = require("multer");

const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 10;

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
  },

  fileFilter(req, file, callback) {
    if (!allowedTypes.has(file.mimetype)) {
      return callback(
        new Error(
          "Format neacceptat. Sunt permise JPG, PNG, WEBP, PDF, DOC și DOCX."
        )
      );
    }

    callback(null, true);
  },
});

module.exports = upload;
