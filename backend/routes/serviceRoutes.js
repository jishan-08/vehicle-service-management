const express = require("express");
const {
  createService,
  listServices,
  getService,
  updateService,
  deleteService,
  updateStatus
} = require("../controllers/serviceController");
const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate);
router.post("/", authorizeRoles("CUSTOMER"), createService);
router.get("/", authorizeRoles("CUSTOMER", "STAFF", "ADMIN"), listServices);
router.get("/:id", authorizeRoles("CUSTOMER", "STAFF", "ADMIN"), getService);
router.put("/:id", authorizeRoles("CUSTOMER", "STAFF", "ADMIN"), updateService);
router.delete("/:id", authorizeRoles("ADMIN"), deleteService);
router.patch("/:id/status", authorizeRoles("STAFF", "ADMIN"), updateStatus);

module.exports = router;