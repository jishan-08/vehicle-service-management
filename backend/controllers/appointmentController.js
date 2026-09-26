const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const Service = require("../models/Service");
const User = require("../models/User");
const Vehicle = require("../models/Vehicle");

const statuses = new Set(["REQUESTED", "CONFIRMED", "CHECKED_IN", "IN_SERVICE", "COMPLETED", "CANCELLED"]);
const activeStatuses = ["REQUESTED", "CONFIRMED", "CHECKED_IN", "IN_SERVICE"];
const transitions = {
  REQUESTED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED"],
  CHECKED_IN: ["IN_SERVICE"],
  IN_SERVICE: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: []
};

const isValidId = (value) => mongoose.isValidObjectId(value);
const normalizeStatus = (value) => (typeof value === "string" ? value.trim().toUpperCase() : value);

const serializeAppointment = (appointment) => ({
  id: appointment._id,
  customerId: appointment.customer,
  vehicleId: appointment.vehicle,
  serviceId: appointment.service,
  appointmentDate: appointment.appointmentDate,
  appointmentTime: appointment.appointmentTime,
  status: appointment.status,
  assignedStaffId: appointment.assignedStaff,
  notes: appointment.notes,
  createdAt: appointment.createdAt,
  updatedAt: appointment.updatedAt
});

const getAppointmentId = (req, res) => {
  if (!isValidId(req.params.id)) {
    res.status(400).json({ success: false, message: "Invalid appointment ID" });
    return null;
  }
  return req.params.id;
};

const appointmentFilter = (req) => (req.user.role === "CUSTOMER" ? { customer: req.user._id } : {});

const parseDateTime = (date, time) => {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(year, month - 1, day, Number(time.slice(0, 2)), Number(time.slice(3)));
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return parsed;
};

const validateSchedule = (date, time) => {
  const parsed = parseDateTime(date, time);
  if (!parsed) return "appointmentDate must be YYYY-MM-DD and appointmentTime must be HH:mm";
  if (parsed <= new Date()) return "Appointment must be scheduled for a future date and time";
  return null;
};

const hasConflict = async (vehicleId, date, time, excludeId) => {
  const query = { vehicle: vehicleId, appointmentDate: date, appointmentTime: time, status: { $in: activeStatuses } };
  if (excludeId) query._id = { $ne: excludeId };
  return Appointment.exists(query);
};

const resolveReferences = async (vehicleId, serviceId) => {
  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) return { error: "Vehicle not found", status: 404 };
  const service = await Service.findById(serviceId);
  if (!service) return { error: "Service not found", status: 404 };
  if (service.vehicle.toString() !== vehicle._id.toString()) return { error: "Service does not belong to this vehicle", status: 400 };
  return { vehicle, service };
};

const createAppointment = async (req, res) => {
  const { vehicle, service, appointmentDate, appointmentTime } = req.body || {};
  if (!isValidId(vehicle) || !isValidId(service)) {
    return res.status(400).json({ success: false, message: "Valid vehicle and service IDs are required" });
  }
  const scheduleError = validateSchedule(appointmentDate, appointmentTime);
  if (scheduleError) return res.status(400).json({ success: false, message: scheduleError });

  const references = await resolveReferences(vehicle, service);
  if (references.error) return res.status(references.status).json({ success: false, message: references.error });
  if (req.user.role === "CUSTOMER" && references.vehicle.owner.toString() !== req.user._id.toString()) {
    return res.status(404).json({ success: false, message: "Vehicle not found or not owned by customer" });
  }
  if (references.service.customer.toString() !== references.vehicle.owner.toString()) {
    return res.status(400).json({ success: false, message: "Service customer does not match vehicle owner" });
  }
  if (await hasConflict(vehicle, appointmentDate, appointmentTime)) {
    return res.status(409).json({ success: false, message: "This vehicle already has an active appointment at that time" });
  }

  const appointmentData = {
    vehicle: references.vehicle._id,
    service: references.service._id,
    customer: references.vehicle.owner,
    appointmentDate,
    appointmentTime,
    notes: typeof req.body.notes === "string" ? req.body.notes.trim() : "",
    status: "REQUESTED"
  };
  if (req.user.role === "ADMIN" && req.body.assignedStaff !== undefined) {
    if (!isValidId(req.body.assignedStaff)) return res.status(400).json({ success: false, message: "Invalid assigned staff ID" });
    const staff = await User.findOne({ _id: req.body.assignedStaff, role: "STAFF" });
    if (!staff) return res.status(400).json({ success: false, message: "assignedStaff must reference a staff user" });
    appointmentData.assignedStaff = staff._id;
  }

  const appointment = await Appointment.create(appointmentData);
  return res.status(201).json({ success: true, message: "Appointment created successfully", data: { appointment: serializeAppointment(appointment) } });
};

const listAppointments = async (req, res) => {
  const appointments = await Appointment.find(appointmentFilter(req)).sort({ appointmentDate: 1, appointmentTime: 1 });
  return res.json({ success: true, data: { appointments: appointments.map(serializeAppointment) } });
};

const getAppointment = async (req, res) => {
  const appointmentId = getAppointmentId(req, res);
  if (!appointmentId) return;
  const appointment = await Appointment.findOne({ _id: appointmentId, ...appointmentFilter(req) });
  if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });
  return res.json({ success: true, data: { appointment: serializeAppointment(appointment) } });
};

const updateAppointment = async (req, res) => {
  const appointmentId = getAppointmentId(req, res);
  if (!appointmentId) return;
  const appointment = await Appointment.findOne({ _id: appointmentId, ...appointmentFilter(req) });
  if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });
  if (req.user.role === "CUSTOMER" && (req.body.status !== undefined || req.body.assignedStaff !== undefined)) {
    return res.status(403).json({ success: false, message: "Customers cannot modify status or staff assignment" });
  }

  const updates = {};
  for (const field of ["appointmentDate", "appointmentTime", "notes"]) {
    if (req.body[field] !== undefined) updates[field] = field === "notes" && typeof req.body[field] === "string" ? req.body[field].trim() : req.body[field];
  }
  if (updates.appointmentDate || updates.appointmentTime) {
    const date = updates.appointmentDate || appointment.appointmentDate;
    const time = updates.appointmentTime || appointment.appointmentTime;
    const scheduleError = validateSchedule(date, time);
    if (scheduleError) return res.status(400).json({ success: false, message: scheduleError });
    if (await hasConflict(appointment.vehicle, date, time, appointment._id)) return res.status(409).json({ success: false, message: "This vehicle already has an active appointment at that time" });
    updates.appointmentDate = date;
    updates.appointmentTime = time;
  }
  if (req.user.role === "ADMIN" && req.body.assignedStaff !== undefined) {
    if (req.body.assignedStaff !== null && !isValidId(req.body.assignedStaff)) return res.status(400).json({ success: false, message: "Invalid assigned staff ID" });
    if (req.body.assignedStaff) {
      const staff = await User.findOne({ _id: req.body.assignedStaff, role: "STAFF" });
      if (!staff) return res.status(400).json({ success: false, message: "assignedStaff must reference a staff user" });
    }
    updates.assignedStaff = req.body.assignedStaff;
  }
  if (!Object.keys(updates).length) return res.status(400).json({ success: false, message: "At least one appointment field is required" });
  Object.assign(appointment, updates);
  await appointment.save();
  return res.json({ success: true, message: "Appointment updated successfully", data: { appointment: serializeAppointment(appointment) } });
};

const deleteAppointment = async (req, res) => {
  const appointmentId = getAppointmentId(req, res);
  if (!appointmentId) return;
  const appointment = await Appointment.findByIdAndDelete(appointmentId);
  if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });
  return res.json({ success: true, message: "Appointment deleted successfully" });
};

const updateStatus = async (req, res) => {
  const appointmentId = getAppointmentId(req, res);
  if (!appointmentId) return;
  const nextStatus = normalizeStatus(req.body && req.body.status);
  if (!statuses.has(nextStatus)) return res.status(400).json({ success: false, message: "Invalid status" });
  const appointment = await Appointment.findOne({ _id: appointmentId, ...appointmentFilter(req) });
  if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });
  if (req.user.role === "CUSTOMER" && nextStatus !== "CANCELLED") return res.status(403).json({ success: false, message: "Customers can only cancel appointments" });
  if (!transitions[appointment.status].includes(nextStatus)) return res.status(400).json({ success: false, message: `Invalid status transition from ${appointment.status} to ${nextStatus}` });
  appointment.status = nextStatus;
  await appointment.save();
  return res.json({ success: true, message: "Appointment status updated successfully", data: { appointment: serializeAppointment(appointment) } });
};

module.exports = { createAppointment, listAppointments, getAppointment, updateAppointment, deleteAppointment, updateStatus };