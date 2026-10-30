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

const canManageAttachments = (req, res, next) => {
  const allowedRoles = ["EDITOR", "ADMIN"];

  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      message: "Nu ai permisiunea de a modifica atașamente.",
    });
  }

  next();
};

// Vizualizare: GET /file/:id
// Descărcare: GET /file/:id?download=1
router.get("/file/:id", authMiddleware, getAttachmentFile);

router.get("/:entityType/:entityId", authMiddleware, getAttachments);

router.post(
  "/upload",
  authMiddleware,
  canManageAttachments,
  upload.single("file"),
  uploadAttachment,
);

router.post(
  "/link",
  authMiddleware,
  canManageAttachments,
  createAttachmentLink,
);

router.delete(
  "/:id",
  authMiddleware,
  (req, res, next) => {
    if (req.user?.role !== "ADMIN") {
      return res.status(403).json({
        message: "Doar administratorul poate șterge atașamente.",
      });
    }

    next();
  },
  deleteAttachment,
);

module.exports = router;
