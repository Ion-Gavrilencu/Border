const express = require("express");
const router = express.Router();

const upload = require("../middleware/uploadMiddleware");

const {
  uploadAttachment,
  createAttachmentLink,
  getAttachments,
  getAttachmentFile,
  deleteAttachment,
} = require("../controllers/attachmentController");

const authMiddleware = require("../middleware/authMiddleware");

// Deschiderea unui fișier
// IMPORTANT: această rută trebuie să fie înainte de /:entityType/:entityId
router.get(
  "/file/:id",
  authMiddleware,
  getAttachmentFile
);

// Obținerea atașamentelor unei înregistrări
router.get(
  "/:entityType/:entityId",
  authMiddleware,
  getAttachments
);

// Încărcarea unui fișier
router.post(
  "/upload",
  authMiddleware,
  upload.single("file"),
  uploadAttachment
);

// Adăugarea unui link
router.post(
  "/link",
  authMiddleware,
  createAttachmentLink
);

// Ștergerea unui atașament
router.delete(
  "/:id",
  authMiddleware,
  deleteAttachment
);

module.exports = router;