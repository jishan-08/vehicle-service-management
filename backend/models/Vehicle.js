const mongoose = require("mongoose");

const currentYear = new Date().getFullYear();

const vehicleSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 20
    },
    make: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60
    },
    model: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60
    },
    year: {
      type: Number,
      required: true,
      min: 1886,
      max: currentYear + 1,
      validate: {
        validator: Number.isInteger,
        message: "Year must be a whole number"
      }
    },
    fuelType: {
      type: String,
      required: true,
      enum: ["PETROL", "DIESEL", "ELECTRIC", "HYBRID", "CNG", "LPG"]
    },
    vehicleType: {
      type: String,
      required: true,
      enum: ["CAR", "MOTORCYCLE", "TRUCK", "VAN", "SUV", "BUS", "OTHER"]
    }
  },
  { timestamps: true }
);

vehicleSchema.index({ owner: 1, createdAt: -1 });

module.exports = mongoose.model("Vehicle", vehicleSchema);