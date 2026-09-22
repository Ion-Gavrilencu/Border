const express = require("express");

const {
  register,
  login,
  logout,
} = require("../controllers/authController");

const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

router.post("/register", register);

router.post("/login", login);

router.post("/logout", logout);

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