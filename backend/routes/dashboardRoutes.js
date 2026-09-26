const express = require("express");
const { authenticate } = require("../middleware/authMiddleware");
const { getSummary } = require("../controllers/dashboardController");

const router = express.Router();
router.get("/summary", authenticate, getSummary);
module.exports = router;