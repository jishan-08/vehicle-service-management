const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const Bill = require("../models/Bill");
const User = require("../models/User");

const billableStatuses = ["IN_SERVICE", "COMPLETED"];
const paymentMethods = new Set(["CASH", "CARD", "UPI", "BANK_TRANSFER"]);
const paymentStatuses = new Set(["PENDING", "PARTIALLY_PAID", "PAID", "CANCELLED"]);

const isValidId = (value) => mongoose.isValidObjectId(value);
const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const serializeBill = (bill) => ({
  id: bill._id,
  customerId: bill.customer,
  vehicleId: bill.vehicle,
  appointmentId: bill.appointment,
  services: bill.services,
  parts: bill.parts,
  subtotal: bill.subtotal,
  tax: bill.tax,
  discount: bill.discount,
  totalAmount: bill.totalAmount,
  amountPaid: bill.amountPaid,
  paymentStatus: bill.paymentStatus,
  paymentMethod: bill.paymentMethod,
  invoiceNumber: bill.invoiceNumber,
  notes: bill.notes,
  issuedAt: bill.issuedAt,
  dueDate: bill.dueDate,
  createdAt: bill.createdAt,
  updatedAt: bill.updatedAt
});

const billFilter = (req) => (req.user.role === "CUSTOMER" ? { customer: req.user._id } : {});
const billId = (req, res) => {
  if (!isValidId(req.params.id)) {
    res.status(400).json({ success: false, message: "Invalid bill ID" });
    return null;
  }
  return req.params.id;
};

const normalizeItems = (items, field) => {
  if (items === undefined) return [];
  if (!Array.isArray(items)) return { error: `${field} must be an array` };
  const normalized = [];
  for (const item of items) {
    if (!item || typeof item.description !== "string" || !item.description.trim()) return { error: `Each ${field} item needs a description` };
    if (typeof item.amount !== "number" || !Number.isFinite(item.amount) || item.amount < 0) return { error: `${field} amounts must be non-negative numbers` };
    normalized.push({ description: item.description.trim(), amount: roundMoney(item.amount) });
  }
  return normalized;
};

const calculateAmounts = (input) => {
  const services = normalizeItems(input.services, "services");
  if (services.error) return services;
  const parts = normalizeItems(input.parts, "parts");
  if (parts.error) return parts;
  const taxRate = input.taxRate === undefined ? 0 : input.taxRate;
  const discount = input.discount === undefined ? 0 : input.discount;
  if (typeof taxRate !== "number" || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) return { error: "taxRate must be between 0 and 100" };
  if (typeof discount !== "number" || !Number.isFinite(discount) || discount < 0) return { error: "discount must be a non-negative number" };
  const subtotal = roundMoney([...services, ...parts].reduce((sum, item) => sum + item.amount, 0));
  if (discount > subtotal) return { error: "discount cannot exceed subtotal" };
  const tax = roundMoney((subtotal - discount) * taxRate / 100);
  const totalAmount = roundMoney(Math.max(0, subtotal + tax - discount));
  return { value: { services, parts, subtotal, tax, discount, totalAmount } };
};

const nextInvoiceNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const latest = await Bill.findOne({ invoiceNumber: new RegExp(`^${prefix}\\d+$`) }).sort({ invoiceNumber: -1 }).select("invoiceNumber");
  const sequence = latest ? Number(latest.invoiceNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(sequence).padStart(6, "0")}`;
};

const resolveAppointment = async (appointmentId) => {
  if (!isValidId(appointmentId)) return { error: "Invalid appointment ID", status: 400 };
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) return { error: "Appointment not found", status: 404 };
  if (!billableStatuses.includes(appointment.status)) return { error: "Only in-service or completed appointments can be billed", status: 400 };
  return { appointment };
};

const createBill = async (req, res) => {
  const { appointment } = req.body || {};
  const resolved = await resolveAppointment(appointment);
  if (resolved.error) return res.status(resolved.status).json({ success: false, message: resolved.error });
  const existing = await Bill.findOne({ appointment });
  if (existing) return res.status(409).json({ success: false, message: "A bill already exists for this appointment" });
  const amounts = calculateAmounts(req.body || {});
  if (amounts.error) return res.status(400).json({ success: false, message: amounts.error });
  const invoiceNumber = await nextInvoiceNumber();
  const bill = await Bill.create({ ...amounts.value, appointment: resolved.appointment._id, customer: resolved.appointment.customer, vehicle: resolved.appointment.vehicle, invoiceNumber, notes: typeof req.body.notes === "string" ? req.body.notes.trim() : "", dueDate: req.body.dueDate || null });
  return res.status(201).json({ success: true, message: "Bill created successfully", data: { bill: serializeBill(bill) } });
};

const listBills = async (req, res) => {
  const bills = await Bill.find(billFilter(req)).sort({ createdAt: -1 });
  return res.json({ success: true, data: { bills: bills.map(serializeBill) } });
};

const getBill = async (req, res) => {
  const id = billId(req, res);
  if (!id) return;
  const bill = await Bill.findOne({ _id: id, ...billFilter(req) });
  if (!bill) return res.status(404).json({ success: false, message: "Bill not found" });
  return res.json({ success: true, data: { bill: serializeBill(bill) } });
};

const updateBill = async (req, res) => {
  const id = billId(req, res);
  if (!id) return;
  const bill = await Bill.findOne({ _id: id, ...billFilter(req) });
  if (!bill) return res.status(404).json({ success: false, message: "Bill not found" });
  if (bill.paymentStatus === "CANCELLED" || bill.paymentStatus === "PAID") return res.status(400).json({ success: false, message: "This bill cannot be modified" });
  const amounts = calculateAmounts(req.body || {});
  if (amounts.error) return res.status(400).json({ success: false, message: amounts.error });
  if (amounts.value.totalAmount < bill.amountPaid) return res.status(400).json({ success: false, message: "Updated total cannot be below amount already paid" });
  Object.assign(bill, amounts.value);
  if (req.body.notes !== undefined) bill.notes = typeof req.body.notes === "string" ? req.body.notes.trim() : bill.notes;
  await bill.save();
  return res.json({ success: true, message: "Bill updated successfully", data: { bill: serializeBill(bill) } });
};

const recordPayment = async (req, res) => {
  const id = billId(req, res);
  if (!id) return;
  const bill = await Bill.findOne({ _id: id, ...billFilter(req) });
  if (!bill) return res.status(404).json({ success: false, message: "Bill not found" });
  if (bill.paymentStatus === "CANCELLED") return res.status(400).json({ success: false, message: "Cancelled bills cannot receive payments" });
  const { amount, paymentMethod } = req.body || {};
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, message: "Payment amount must be greater than zero" });
  const method = typeof paymentMethod === "string" ? paymentMethod.trim().toUpperCase() : paymentMethod;
  if (!paymentMethods.has(method)) return res.status(400).json({ success: false, message: "Invalid payment method" });
  const nextPaid = roundMoney(bill.amountPaid + amount);
  if (nextPaid > bill.totalAmount) return res.status(400).json({ success: false, message: "Payment cannot exceed the outstanding balance" });
  bill.amountPaid = nextPaid;
  bill.paymentMethod = method;
  bill.paymentStatus = nextPaid === bill.totalAmount ? "PAID" : "PARTIALLY_PAID";
  await bill.save();
  return res.json({ success: true, message: "Payment recorded successfully", data: { bill: serializeBill(bill) } });
};

const cancelBill = async (req, res) => {
  const id = billId(req, res);
  if (!id) return;
  const bill = await Bill.findById(id);
  if (!bill) return res.status(404).json({ success: false, message: "Bill not found" });
  if (bill.amountPaid > 0 || bill.paymentStatus === "PAID") return res.status(400).json({ success: false, message: "Bills with payments cannot be cancelled" });
  bill.paymentStatus = "CANCELLED";
  await bill.save();
  return res.json({ success: true, message: "Bill cancelled successfully", data: { bill: serializeBill(bill) } });
};

module.exports = { createBill, listBills, getBill, updateBill, recordPayment, cancelBill };