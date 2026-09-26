const mongoose = require("mongoose");
const Vehicle = require("../models/Vehicle");

const fuelTypes = new Set(["PETROL", "DIESEL", "ELECTRIC", "HYBRID", "CNG", "LPG"]);
const vehicleTypes = new Set(["CAR", "MOTORCYCLE", "TRUCK", "VAN", "SUV", "BUS", "OTHER"]);
const currentYear = new Date().getFullYear();

const normalizeText = (value) => (typeof value === "string" ? value.trim() : value);
const normalizeRegistration = (value) => {
  const normalized = normalizeText(value);
  return typeof normalized === "string" ? normalized.toUpperCase() : normalized;
};
const normalizeOption = (value) => {
  const normalized = normalizeText(value);
  return typeof normalized === "string" ? normalized.toUpperCase() : normalized;
};

const serializeVehicle = (vehicle) => ({
  id: vehicle._id,
  ownerId: vehicle.owner,
  registrationNumber: vehicle.registrationNumber,
  make: vehicle.make,
  model: vehicle.model,
  year: vehicle.year,
  fuelType: vehicle.fuelType,
  vehicleType: vehicle.vehicleType,
  createdAt: vehicle.createdAt,
  updatedAt: vehicle.updatedAt
});

const validateVehicleInput = (input, partial = false) => {
  const fields = ["registrationNumber", "make", "model", "year", "fuelType", "vehicleType"];
  const normalized = {};

  for (const field of fields) {
    if (!partial || input[field] !== undefined) {
      normalized[field] = input[field];
    }
  }

  if (!partial) {
    const missingField = fields.find(
      (field) => normalized[field] === undefined || normalized[field] === null || normalized[field] === ""
    );
    if (missingField) {
      return { error: `${missingField} is required` };
    }
  }

  if (normalized.registrationNumber !== undefined) {
    normalized.registrationNumber = normalizeRegistration(normalized.registrationNumber);
    if (!normalized.registrationNumber) {
      return { error: "registrationNumber is required" };
    }
  }

  for (const field of ["make", "model"]) {
    if (normalized[field] !== undefined) {
      normalized[field] = normalizeText(normalized[field]);
      if (!normalized[field]) {
        return { error: `${field} is required` };
      }
    }
  }

  if (normalized.year !== undefined) {
    if (!Number.isInteger(normalized.year) || normalized.year < 1886 || normalized.year > currentYear + 1) {
      return { error: `year must be a whole number between 1886 and ${currentYear + 1}` };
    }
  }

  for (const [field, allowedValues] of [["fuelType", fuelTypes], ["vehicleType", vehicleTypes]]) {
    if (normalized[field] !== undefined) {
      normalized[field] = normalizeOption(normalized[field]);
      if (!allowedValues.has(normalized[field])) {
        return { error: `Invalid ${field}` };
      }
    }
  }

  return { value: normalized };
};

const getVehicleId = (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, message: "Invalid vehicle ID" });
    return null;
  }

  return req.params.id;
};

const ownerFilter = (req) => (req.user.role === "CUSTOMER" ? { owner: req.user._id } : {});

const createVehicle = async (req, res) => {
  const validation = validateVehicleInput(req.body || {});
  if (validation.error) {
    return res.status(400).json({ success: false, message: validation.error });
  }

  try {
    const vehicle = await Vehicle.create({
      ...validation.value,
      owner: req.user._id
    });

    return res.status(201).json({
      success: true,
      message: "Vehicle created successfully",
      data: { vehicle: serializeVehicle(vehicle) }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A vehicle with this registration number already exists"
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: "Invalid vehicle data" });
    }

    throw error;
  }
};

const listVehicles = async (req, res) => {
  const vehicles = await Vehicle.find(ownerFilter(req)).sort({ createdAt: -1 });
  return res.json({
    success: true,
    data: { vehicles: vehicles.map(serializeVehicle) }
  });
};

const getVehicle = async (req, res) => {
  const vehicleId = getVehicleId(req, res);
  if (!vehicleId) return;

  const vehicle = await Vehicle.findOne({ _id: vehicleId, ...ownerFilter(req) });
  if (!vehicle) {
    return res.status(404).json({ success: false, message: "Vehicle not found" });
  }

  return res.json({ success: true, data: { vehicle: serializeVehicle(vehicle) } });
};

const updateVehicle = async (req, res) => {
  const vehicleId = getVehicleId(req, res);
  if (!vehicleId) return;

  const validation = validateVehicleInput(req.body || {}, true);
  if (validation.error) {
    return res.status(400).json({ success: false, message: validation.error });
  }

  if (!Object.keys(validation.value).length) {
    return res.status(400).json({ success: false, message: "At least one vehicle field is required" });
  }

  try {
    const vehicle = await Vehicle.findOneAndUpdate(
      { _id: vehicleId, ...ownerFilter(req) },
      validation.value,
      { returnDocument: "after", runValidators: true }
    );

    if (!vehicle) {
      return res.status(404).json({ success: false, message: "Vehicle not found" });
    }

    return res.json({
      success: true,
      message: "Vehicle updated successfully",
      data: { vehicle: serializeVehicle(vehicle) }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A vehicle with this registration number already exists"
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: "Invalid vehicle data" });
    }

    throw error;
  }
};

const deleteVehicle = async (req, res) => {
  const vehicleId = getVehicleId(req, res);
  if (!vehicleId) return;

  const vehicle = await Vehicle.findOneAndDelete({ _id: vehicleId, ...ownerFilter(req) });
  if (!vehicle) {
    return res.status(404).json({ success: false, message: "Vehicle not found" });
  }

  return res.json({ success: true, message: "Vehicle deleted successfully" });
};

module.exports = { createVehicle, listVehicles, getVehicle, updateVehicle, deleteVehicle };