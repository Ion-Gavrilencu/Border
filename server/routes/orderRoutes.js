
const express = require("express");

const {
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
  addOrderFavorite,
  removeOrderFavorite,
} = require("../controllers/orderController");

const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

// USER, EDITOR, ADMIN — lista ordinelor
router.get("/", authenticate, getOrders);

// USER, EDITOR, ADMIN — adăugare la favorite
router.post("/:id/favorite", authenticate, addOrderFavorite);

// USER, EDITOR, ADMIN — eliminare din favorite
router.delete("/:id/favorite", authenticate, removeOrderFavorite);

// USER, EDITOR, ADMIN — detaliile unui ordin
router.get("/:id", authenticate, getOrderById);

// EDITOR, ADMIN — creare ordin
router.post(
  "/",
  authenticate,
  authorizeRoles("EDITOR", "ADMIN"),
  createOrder
);

// EDITOR, ADMIN — modificare ordin
router.patch(
  "/:id",
  authenticate,
  authorizeRoles("EDITOR", "ADMIN"),
  updateOrder
);

// ADMIN — ștergere ordin
router.delete(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  deleteOrder
);

module.exports = router;
