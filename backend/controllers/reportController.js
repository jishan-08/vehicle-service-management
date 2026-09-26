const Appointment = require("../models/Appointment");
const Bill = require("../models/Bill");
const Service = require("../models/Service");
const Vehicle = require("../models/Vehicle");

const serviceStatuses = ["REQUESTED", "APPROVED", "SCHEDULED", "VEHICLE_RECEIVED", "INSPECTION", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const appointmentStatuses = ["REQUESTED", "CONFIRMED", "CHECKED_IN", "IN_SERVICE", "COMPLETED", "CANCELLED"];

const parseDateRange = (req, res) => {
  const { startDate, endDate } = req.query;
  if (!startDate && !endDate) return {};
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if ((startDate && !datePattern.test(startDate)) || (endDate && !datePattern.test(endDate))) {
    res.status(400).json({ success: false, message: "Dates must use YYYY-MM-DD format" });
    return null;
  }
  if (startDate && endDate && startDate > endDate) {
    res.status(400).json({ success: false, message: "startDate cannot be after endDate" });
    return null;
  }
  const range = {};
  if (startDate) range.$gte = new Date(`${startDate}T00:00:00.000Z`);
  if (endDate) range.$lte = new Date(`${endDate}T23:59:59.999Z`);
  return range;
};

const baseFilter = (req, field) => (req.user.role === "CUSTOMER" ? { [field]: req.user._id } : {});
const dateFilter = (range, field = "createdAt") => Object.keys(range).length ? { [field]: range } : {};
const appointmentDateFilter = (req) => {
  const filter = {};
  if (req.query.startDate) filter.$gte = req.query.startDate;
  if (req.query.endDate) filter.$lte = req.query.endDate;
  return Object.keys(filter).length ? { appointmentDate: filter } : {};
};
const asStatusMap = (statuses, rows) => Object.fromEntries(statuses.map((status) => [status, rows.find((row) => row._id === status)?.count || 0]));

const serviceSummary = async (req, res) => {
  const range = parseDateRange(req, res);
  if (range === null) return;
  const rows = await Service.aggregate([{ $match: { ...baseFilter(req, "customer"), ...dateFilter(range) } }, { $group: { _id: "$status", count: { $sum: 1 } } }]);
  return res.json({ success: true, data: { requested: asStatusMap(serviceStatuses, rows).REQUESTED, confirmed: asStatusMap(serviceStatuses, rows).APPROVED + asStatusMap(serviceStatuses, rows).SCHEDULED, checkedIn: asStatusMap(serviceStatuses, rows).VEHICLE_RECEIVED + asStatusMap(serviceStatuses, rows).INSPECTION, inService: asStatusMap(serviceStatuses, rows).IN_PROGRESS, completed: asStatusMap(serviceStatuses, rows).COMPLETED, cancelled: asStatusMap(serviceStatuses, rows).CANCELLED, byStatus: asStatusMap(serviceStatuses, rows) } });
};

const appointmentSummary = async (req, res) => {
  const range = parseDateRange(req, res);
  if (range === null) return;
  const filter = { ...baseFilter(req, "customer"), ...appointmentDateFilter(req) };
  const [rows, byDate] = await Promise.all([
    Appointment.aggregate([{ $match: filter }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Appointment.aggregate([{ $match: filter }, { $group: { _id: "$appointmentDate", count: { $sum: 1 } } }, { $sort: { _id: 1 } }])
  ]);
  const byStatus = asStatusMap(appointmentStatuses, rows);
  return res.json({ success: true, data: { total: Object.values(byStatus).reduce((sum, count) => sum + count, 0), upcoming: byStatus.REQUESTED + byStatus.CONFIRMED + byStatus.CHECKED_IN + byStatus.IN_SERVICE, completed: byStatus.COMPLETED, cancelled: byStatus.CANCELLED, byStatus, byDate: Object.fromEntries(byDate.map((item) => [item._id, item.count])) } });
};

const revenueSummary = async (req, res) => {
  const range = parseDateRange(req, res);
  if (range === null) return;
  const filter = { ...baseFilter(req, "customer"), paymentStatus: { $ne: "CANCELLED" }, ...dateFilter(range, "issuedAt") };
  const rows = await Bill.aggregate([{ $match: filter }, { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" }, paidRevenue: { $sum: "$amountPaid" }, outstandingAmount: { $sum: { $subtract: ["$totalAmount", "$amountPaid"] } }, totalInvoices: { $sum: 1 }, paidInvoices: { $sum: { $cond: [{ $eq: ["$paymentStatus", "PAID"] }, 1, 0] } }, pendingInvoices: { $sum: { $cond: [{ $in: ["$paymentStatus", ["PENDING", "PARTIALLY_PAID"]] }, 1, 0] } } } }]);
  const data = rows[0] || { totalRevenue: 0, paidRevenue: 0, outstandingAmount: 0, totalInvoices: 0, paidInvoices: 0, pendingInvoices: 0 };
  return res.json({ success: true, data });
};

const vehicleSummary = async (req, res) => {
  const range = parseDateRange(req, res);
  if (range === null) return;
  const vehicleFilter = { ...baseFilter(req, "owner"), ...dateFilter(range) };
  const serviceFilter = baseFilter(req, "customer");
  const [totalRegistered, current, completed] = await Promise.all([
    Vehicle.countDocuments(vehicleFilter),
    Service.distinct("vehicle", { ...serviceFilter, status: "IN_PROGRESS", ...dateFilter(range) }),
    Service.distinct("vehicle", { ...serviceFilter, status: "COMPLETED", ...dateFilter(range) })
  ]);
  return res.json({ success: true, data: { totalRegisteredVehicles: totalRegistered, vehiclesCurrentlyUnderService: current.length, vehiclesWithCompletedServiceHistory: completed.length } });
};

module.exports = { serviceSummary, appointmentSummary, revenueSummary, vehicleSummary };