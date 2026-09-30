const express = require("express");

const { globalSearch } = require("../controllers/searchController");

const authenticate = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authenticate, globalSearch);

module.exports = router;