
const express = require("express");
const authenticate = require("../middleware/authMiddleware");

const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require("../controllers/notificationController");

const router = express.Router();

// Toate rutele necesită autentificare.
router.use(authenticate);

// Lista notificărilor utilizatorului.
router.get("/", getNotifications);

// Marchează toate notificările ca citite.
router.patch("/read-all", markAllNotificationsRead);

// Marchează o notificare ca citită.
router.patch("/:id/read", markNotificationRead);

module.exports = router;
