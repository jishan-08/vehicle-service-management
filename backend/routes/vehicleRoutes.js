const express = require("express");
const {
  createVehicle,
  listVehicles,
  getVehicle,
  updateVehicle,
  deleteVehicle
} = require("../controllers/vehicleController");
const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate);
router.post("/", authorizeRoles("CUSTOMER"), createVehicle);
router.get("/", authorizeRoles("CUSTOMER", "STAFF", "ADMIN"), listVehicles);
router.get("/:id", authorizeRoles("CUSTOMER", "STAFF", "ADMIN"), getVehicle);
router.put("/:id", authorizeRoles("CUSTOMER", "ADMIN"), updateVehicle);
router.delete("/:id", authorizeRoles("CUSTOMER", "ADMIN"), deleteVehicle);

module.exports = router;