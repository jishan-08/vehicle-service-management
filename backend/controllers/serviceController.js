const mongoose = require("mongoose");
const Service = require("../models/Service");
const User = require("../models/User");
const Vehicle = require("../models/Vehicle");

const serviceTypes = new Set([
  "GENERAL_SERVICE",
  "OIL_CHANGE",
  "BRAKE_SERVICE",
  "ENGINE_SERVICE",
  "AC_SERVICE",
  "TYRE_SERVICE",
  "BATTERY_SERVICE",
  "ELECTRICAL_SERVICE",
  "OTHER"
]);
const priorities = new Set(["LOW", "MEDIUM", "HIGH", "URGENT"]);
const statuses = new Set([
  "REQUESTED",
  "APPROVED",
  "SCHEDULED",
  "VEHICLE_RECEIVED",
  "INSPECTION",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED"
]);
const transitions = {
  REQUESTED: ["APPROVED", "CANCELLED"],
  APPROVED: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["VEHICLE_RECEIVED", "CANCELLED"],
  VEHICLE_RECEIVED: ["INSPECTION"],
  INSPECTION: ["IN_PROGRESS"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: []
};

const normalizeOption = (value) => {
  if (typeof value !== "string") return value;
  return value.trim().toUpperCase();
};

const serializeService = (service) => ({
  id: service._id,
  vehicleId: service.vehicle,
  customerId: service.customer,
  serviceType: service.serviceType,
  description: service.description,
  priority: service.priority,
  status: service.status,
  assignedStaffId: service.assignedStaff,
  estimatedCost: service.estimatedCost,
  actualCost: service.actualCost,
  inspectionNotes: service.inspectionNotes,
  serviceNotes: service.serviceNotes,
  createdAt: service.createdAt,
  updatedAt: service.updatedAt,
  completedAt: service.completedAt
});

const validateObjectId = (value, label) => {
  if (!mongoose.isValidObjectId(value)) {
    return `${label} is invalid`;
  }
  return null;
};

const validateCost = (value, field) => {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return `${field} must be a non-negative number`;
  }
  return null;
};

const validateServiceFields = (input, { partial = false, role = "CUSTOMER" } = {}) => {
  const normalized = {};

  if (!partial || input.serviceType !== undefined) {
    normalized.serviceType = normalizeOption(input.serviceType);
    if (!serviceTypes.has(normalized.serviceType)) return { error: "Invalid serviceType" };
  }

  if (!partial || input.description !== undefined) {
    normalized.description = typeof input.description === "string" ? input.description.trim() : input.description;
    if (typeof normalized.description !== "string" || !normalized.description) {
      return { error: "description is required" };
    }
  }

  if (!partial || input.priority !== undefined) {
    normalized.priority = normalizeOption(input.priority || "MEDIUM");
    if (!priorities.has(normalized.priority)) return { error: "Invalid priority" };
  }

  for (const field of ["estimatedCost", "actualCost"]) {
    if (input[field] !== undefined) {
      const error = validateCost(input[field], field);
      if (error) return { error };
      normalized[field] = input[field];
    }
  }

  if (role === "CUSTOMER" && (input.actualCost !== undefined || input.status !== undefined || input.assignedStaff !== undefined)) {
    return { error: "Customers cannot modify status, actual cost, or staff assignment", forbidden: true };
  }

  if (role === "CUSTOMER" && (input.inspectionNotes !== undefined || input.serviceNotes !== undefined)) {
    return { error: "Customers cannot modify service notes", forbidden: true };
  }

  if (role !== "CUSTOMER") {
    for (const field of ["inspectionNotes", "serviceNotes"]) {
      if (input[field] !== undefined) {
        if (typeof input[field] !== "string") return { error: `${field} must be text` };
        normalized[field] = input[field].trim();
      }
    }
  }

  if (role === "ADMIN" && input.assignedStaff !== undefined) {
    const error = validateObjectId(input.assignedStaff, "assignedStaff");
    if (error) return { error };
    normalized.assignedStaff = input.assignedStaff;
  }

  return { value: normalized };
};

const serviceFilter = (req) => (req.user.role === "CUSTOMER" ? { customer: req.user._id } : {});

const getServiceId = (req, res) => {
  const error = validateObjectId(req.params.id, "service ID");
  if (error) {
    res.status(400).json({ success: false, message: error });
    return null;
  }
  return req.params.id;
};

const findService = (id, req) => Service.findOne({ _id: id, ...serviceFilter(req) });

const createService = async (req, res) => {
  const vehicleId = req.body && req.body.vehicle;
  const vehicleError = validateObjectId(vehicleId, "vehicle ID");
  if (vehicleError) {
    return res.status(400).json({ success: false, message: vehicleError });
  }

  const validation = validateServiceFields(req.body || {});
  if (validation.error) {
    return res.status(validation.forbidden ? 403 : 400).json({ success: false, message: validation.error });
  }

  const vehicle = await Vehicle.findOne({ _id: vehicleId, owner: req.user._id });
  if (!vehicle) {
    return res.status(404).json({ success: false, message: "Vehicle not found or not owned by customer" });
  }

  const service = await Service.create({
    ...validation.value,
    vehicle: vehicle._id,
    customer: vehicle.owner,
    status: "REQUESTED"
  });

  return res.status(201).json({
    success: true,
    message: "Service request created successfully",
    data: { service: serializeService(service) }
  });
};

const listServices = async (req, res) => {
  const services = await Service.find(serviceFilter(req)).sort({ createdAt: -1 });
  return res.json({ success: true, data: { services: services.map(serializeService) } });
};

const getService = async (req, res) => {
  const serviceId = getServiceId(req, res);
  if (!serviceId) return;

  const service = await findService(serviceId, req);
  if (!service) return res.status(404).json({ success: false, message: "Service not found" });

  return res.json({ success: true, data: { service: serializeService(service) } });
};

const updateService = async (req, res) => {
  const serviceId = getServiceId(req, res);
  if (!serviceId) return;

  const validation = validateServiceFields(req.body || {}, { partial: true, role: req.user.role });
  if (validation.error) {
    return res.status(validation.forbidden ? 403 : 400).json({ success: false, message: validation.error });
  }
  if (!Object.keys(validation.value).length) {
    return res.status(400).json({ success: false, message: "At least one service field is required" });
  }

  if (req.user.role === "ADMIN" && validation.value.assignedStaff) {
    const staff = await User.findOne({ _id: validation.value.assignedStaff, role: "STAFF" });
    if (!staff) return res.status(400).json({ success: false, message: "assignedStaff must reference a staff user" });
  }

  const service = await Service.findOneAndUpdate(
    { _id: serviceId, ...serviceFilter(req) },
    validation.value,
    { returnDocument: "after", runValidators: true }
  );
  if (!service) return res.status(404).json({ success: false, message: "Service not found" });

  return res.json({
    success: true,
    message: "Service updated successfully",
    data: { service: serializeService(service) }
  });
};

const deleteService = async (req, res) => {
  const serviceId = getServiceId(req, res);
  if (!serviceId) return;

  const service = await Service.findByIdAndDelete(serviceId);
  if (!service) return res.status(404).json({ success: false, message: "Service not found" });

  return res.json({ success: true, message: "Service deleted successfully" });
};

const updateStatus = async (req, res) => {
  const serviceId = getServiceId(req, res);
  if (!serviceId) return;

  const nextStatus = normalizeOption(req.body && req.body.status);
  if (!statuses.has(nextStatus)) {
    return res.status(400).json({ success: false, message: "Invalid status" });
  }

  const service = await findService(serviceId, req);
  if (!service) return res.status(404).json({ success: false, message: "Service not found" });
  if (req.user.role === "STAFF" && nextStatus === "CANCELLED") {
    return res.status(403).json({ success: false, message: "Only admins can cancel service jobs" });
  }
  if (!transitions[service.status].includes(nextStatus)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status transition from ${service.status} to ${nextStatus}`
    });
  }

  service.status = nextStatus;
  service.completedAt = nextStatus === "COMPLETED" ? new Date() : null;
  await service.save();

  return res.json({
    success: true,
    message: "Service status updated successfully",
    data: { service: serializeService(service) }
  });
};

module.exports = { createService, listServices, getService, updateService, deleteService, updateStatus };