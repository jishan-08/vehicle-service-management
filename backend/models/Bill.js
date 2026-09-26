const mongoose = require("mongoose");

const lineItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true, maxlength: 200 },
    amount: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const billSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true, index: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", required: true, unique: true },
    services: { type: [lineItemSchema], default: [] },
    parts: { type: [lineItemSchema], default: [] },
    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, required: true, min: 0, default: 0 },
    paymentStatus: { type: String, enum: ["PENDING", "PARTIALLY_PAID", "PAID", "CANCELLED"], default: "PENDING", required: true },
    paymentMethod: { type: String, enum: ["CASH", "CARD", "UPI", "BANK_TRANSFER"], default: null },
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    notes: { type: String, trim: true, maxlength: 4000, default: "" },
    issuedAt: { type: Date, default: Date.now },
    dueDate: { type: Date, default: null }
  },
  { timestamps: true }
);

billSchema.index({ customer: 1, createdAt: -1 });

module.exports = mongoose.model("Bill", billSchema);