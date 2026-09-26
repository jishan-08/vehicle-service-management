const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
      index: true
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
      index: true
    },
    appointmentDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/
    },
    appointmentTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/
    },
    status: {
      type: String,
      enum: ["REQUESTED", "CONFIRMED", "CHECKED_IN", "IN_SERVICE", "COMPLETED", "CANCELLED"],
      default: "REQUESTED",
      required: true
    },
    assignedStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: ""
    }
  },
  { timestamps: true }
);

appointmentSchema.index({ vehicle: 1, appointmentDate: 1, appointmentTime: 1, status: 1 });
appointmentSchema.index({ customer: 1, appointmentDate: 1 });

module.exports = mongoose.model("Appointment", appointmentSchema);