const express = require("express");


const {
  register,
  login,
  logout,
  getMe,
  activateAccount,
  changePassword,
  updateProfile,
} = require("../controllers/authController");


const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

// router.post("/register", register);

router.post("/login", login);
router.post("/activate", activateAccount);
// Schimbarea parolei - utilizator autentificat
router.patch(
  "/change-password",
  authenticate,
  changePassword
);
router.post("/logout", logout);

router.patch("/profile", authenticate, updateProfile);

router.get("/me", authenticate, (req, res) => {
  res.json({
    message: "Utilizator autentificat.",
    user: req.user,
  });
});

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