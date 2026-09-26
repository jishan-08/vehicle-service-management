const express = require("express");
const { createBill, listBills, getBill, updateBill, recordPayment, cancelBill } = require("../controllers/billController");
const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(authenticate);
router.post("/", authorizeRoles("STAFF", "ADMIN"), createBill);
router.get("/", authorizeRoles("CUSTOMER", "STAFF", "ADMIN"), listBills);
router.get("/:id", authorizeRoles("CUSTOMER", "STAFF", "ADMIN"), getBill);
router.put("/:id", authorizeRoles("STAFF", "ADMIN"), updateBill);
router.patch("/:id/payment", authorizeRoles("STAFF", "ADMIN"), recordPayment);
router.patch("/:id/cancel", authorizeRoles("ADMIN"), cancelBill);

module.exports = router;