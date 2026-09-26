const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema(
  {
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
      index: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    serviceType: {
      type: String,
      required: true,
      enum: [
        "GENERAL_SERVICE",
        "OIL_CHANGE",
        "BRAKE_SERVICE",
        "ENGINE_SERVICE",
        "AC_SERVICE",
        "TYRE_SERVICE",
        "BATTERY_SERVICE",
        "ELECTRICAL_SERVICE",
        "OTHER"
      ]
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      default: "MEDIUM",
      required: true
    },
    status: {
      type: String,
      enum: [
        "REQUESTED",
        "APPROVED",
        "SCHEDULED",
        "VEHICLE_RECEIVED",
        "INSPECTION",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED"
      ],
      default: "REQUESTED",
      required: true
    },
    assignedStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    estimatedCost: {
      type: Number,
      min: 0,
      default: null
    },
    actualCost: {
      type: Number,
      min: 0,
      default: null
    },
    inspectionNotes: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: ""
    },
    serviceNotes: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: ""
    },
    completedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

serviceSchema.index({ customer: 1, createdAt: -1 });
serviceSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Service", serviceSchema);