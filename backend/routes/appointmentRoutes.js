const express = require("express");
const {
  createAppointment,
  listAppointments,
  getAppointment,
  updateAppointment,
  deleteAppointment,
  updateStatus
} = require("../controllers/appointmentController");
const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate);
router.post("/", authorizeRoles("CUSTOMER", "ADMIN"), createAppointment);
router.get("/", authorizeRoles("CUSTOMER", "STAFF", "ADMIN"), listAppointments);
router.get("/:id", authorizeRoles("CUSTOMER", "STAFF", "ADMIN"), getAppointment);
router.put("/:id", authorizeRoles("CUSTOMER", "STAFF", "ADMIN"), updateAppointment);
router.delete("/:id", authorizeRoles("ADMIN"), deleteAppointment);
router.patch("/:id/status", authorizeRoles("CUSTOMER", "STAFF", "ADMIN"), updateStatus);

module.exports = router;