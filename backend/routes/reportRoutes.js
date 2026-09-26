const express = require("express");
const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");
const { serviceSummary, appointmentSummary, revenueSummary, vehicleSummary } = require("../controllers/reportController");

const router = express.Router();
router.use(authenticate);
router.get("/service-summary", authorizeRoles("CUSTOMER", "STAFF", "ADMIN"), serviceSummary);
router.get("/appointment-summary", authorizeRoles("CUSTOMER", "STAFF", "ADMIN"), appointmentSummary);
router.get("/revenue-summary", authorizeRoles("CUSTOMER", "STAFF", "ADMIN"), revenueSummary);
router.get("/vehicle-summary", authorizeRoles("CUSTOMER", "STAFF", "ADMIN"), vehicleSummary);
module.exports = router;