
const express = require("express");

const {
  login,
  logout,
  activateAccount,
  changePassword,
  updateProfile,
} = require("../controllers/authController");

const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

// Autentificare
router.post("/login", login);

// Activarea contului
router.post("/activate", activateAccount);

// Deconectare - utilizator autentificat
router.post("/logout", authenticate, logout);

// Schimbarea parolei
router.patch(
  "/change-password",
  authenticate,
  changePassword
);

// Actualizarea profilului
router.patch("/profile", authenticate, updateProfile);

// Utilizatorul autentificat
router.get("/me", authenticate, (req, res) => {
  res.json({
    message: "Utilizator autentificat.",
    user: req.user,
  });
});

// Verificare acces administrator
router.get(
  "/admin-test",
  authenticate,
  authorizeRoles("ADMIN"),
  (req, res) => {
    res.json({
      message: "Ai acces la zona de administrare.",
      user: req.user,
    });
  }
);

module.exports = router;
