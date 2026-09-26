const Appointment = require("../models/Appointment");
const Bill = require("../models/Bill");
const Service = require("../models/Service");
const User = require("../models/User");
const Vehicle = require("../models/Vehicle");

const activeServiceStatuses = ["REQUESTED", "APPROVED", "SCHEDULED", "VEHICLE_RECEIVED", "INSPECTION", "IN_PROGRESS"];
const activeAppointmentStatuses = ["REQUESTED", "CONFIRMED", "CHECKED_IN", "IN_SERVICE"];

const billTotals = async (filter) => {
  const [pending, paid, billed] = await Promise.all([
    Bill.aggregate([{ $match: { ...filter, paymentStatus: { $in: ["PENDING", "PARTIALLY_PAID"] } } }, { $group: { _id: null, count: { $sum: 1 }, due: { $sum: { $subtract: ["$totalAmount", "$amountPaid"] } } } }]),
    Bill.aggregate([{ $match: { ...filter, paymentStatus: "PAID" } }, { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: "$totalAmount" } } }]),
    Bill.aggregate([{ $match: { ...filter, paymentStatus: { $ne: "CANCELLED" } } }, { $group: { _id: null, revenue: { $sum: "$totalAmount" } } }])
  ]);
  return { pendingBills: pending[0]?.count || 0, outstandingAmount: pending[0]?.due || 0, paidBills: paid[0]?.count || 0, paidRevenue: paid[0]?.revenue || 0, totalRevenue: billed[0]?.revenue || 0 };
};

const customerSummary = async (userId) => {
  const owner = { owner: userId };
  const customer = { customer: userId };
  const [totalVehicles, activeServiceRequests, upcomingAppointments, completedServices, bills] = await Promise.all([
    Vehicle.countDocuments(owner),
    Service.countDocuments({ ...customer, status: { $in: activeServiceStatuses } }),
    Appointment.countDocuments({ ...customer, status: { $in: activeAppointmentStatuses }, appointmentDate: { $gte: new Date().toISOString().slice(0, 10) } }),
    Service.countDocuments({ ...customer, status: "COMPLETED" }),
    billTotals(customer)
  ]);
  return { totalVehicles, activeServiceRequests, upcomingAppointments, completedServices, pendingBills: bills.pendingBills, paidBills: bills.paidBills, totalAmountDue: bills.outstandingAmount };
};

const staffSummary = async () => {
  const today = new Date().toISOString().slice(0, 10);
  const [todaysAppointments, pendingAppointments, vehiclesCurrentlyInService, completedServices, bills, serviceWorkload] = await Promise.all([
    Appointment.countDocuments({ appointmentDate: today }),
    Appointment.countDocuments({ status: { $in: ["REQUESTED", "CONFIRMED"] } }),
    Service.countDocuments({ status: "IN_PROGRESS" }),
    Service.countDocuments({ status: "COMPLETED" }),
    billTotals({}),
    Service.aggregate([{ $match: { status: { $nin: ["COMPLETED", "CANCELLED"] } } }, { $group: { _id: "$status", count: { $sum: 1 } } }, { $sort: { _id: 1 } }])
  ]);
  return { todaysAppointments, pendingAppointments, vehiclesCurrentlyInService, completedServices, pendingBills: bills.pendingBills, serviceWorkload: Object.fromEntries(serviceWorkload.map((item) => [item._id, item.count])) };
};

const adminSummary = async () => {
  const [totalCustomers, totalStaff, totalVehicles, totalAppointments, activeServices, completedServices, bills] = await Promise.all([
    User.countDocuments({ role: "CUSTOMER" }),
    User.countDocuments({ role: "STAFF" }),
    Vehicle.countDocuments(),
    Appointment.countDocuments(),
    Service.countDocuments({ status: { $in: activeServiceStatuses } }),
    Service.countDocuments({ status: "COMPLETED" }),
    billTotals({})
  ]);
  return { totalCustomers, totalStaff, totalVehicles, totalAppointments, activeServices, completedServices, pendingBills: bills.pendingBills, paidBills: bills.paidBills, totalRevenue: bills.totalRevenue, outstandingAmount: bills.outstandingAmount };
};

const getSummary = async (req, res) => {
  const data = req.user.role === "CUSTOMER" ? await customerSummary(req.user._id) : req.user.role === "STAFF" ? await staffSummary() : await adminSummary();
  return res.json({ success: true, data: { role: req.user.role, summary: data } });
};

module.exports = { getSummary };