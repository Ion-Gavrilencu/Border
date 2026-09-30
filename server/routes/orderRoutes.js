const express = require("express");

const {
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
} = require("../controllers/orderController");

const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

// USER, EDITOR, ADMIN
router.get(
  "/",
  authenticate,
  getOrders
);

// USER, EDITOR, ADMIN
router.get(
  "/:id",
  authenticate,
  getOrderById
);

// EDITOR, ADMIN
router.post(
  "/",
  authenticate,
  authorizeRoles("EDITOR", "ADMIN"),
  createOrder
);

// EDITOR, ADMIN
router.patch(
  "/:id",
  authenticate,
  authorizeRoles("EDITOR", "ADMIN"),
  updateOrder
);

// ADMIN only
router.delete(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  deleteOrder
);

module.exports = router;