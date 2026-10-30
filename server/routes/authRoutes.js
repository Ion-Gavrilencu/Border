const express = require("express");
const multer = require("multer");
const {
  login, logout, activateAccount, changePassword, updateProfile,
  updateAvatar, getAvatarImage, updatePreferences, getMe,
} = require("../controllers/authController");
const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
}).single("avatar");

router.post("/login", login);
router.post("/activate", activateAccount);
router.post("/logout", authenticate, logout);
router.patch("/change-password", authenticate, changePassword);
router.patch("/profile", authenticate, updateProfile);
router.patch("/preferences", authenticate, updatePreferences);
router.patch("/avatar", authenticate, (req, res, next) => {
  avatarUpload(req, res, (error) => {
    if (error) return res.status(400).json({ message: error.code === "LIMIT_FILE_SIZE" ? "Fotografia nu poate depăși 5 MB." : "Fișierul nu a putut fi încărcat." });
    next();
  });
}, updateAvatar);
router.get("/avatar-image/:id", getAvatarImage);
router.get("/me", authenticate, getMe);
router.get("/admin-test", authenticate, authorizeRoles("ADMIN"), (req, res) => {
  res.json({ message: "Ai acces la zona de administrare.", user: req.user });
});
module.exports = router;
