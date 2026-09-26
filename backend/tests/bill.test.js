const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../server");
const connectDB = require("../config/db");
const User = require("../models/User");
const Vehicle = require("../models/Vehicle");
const Service = require("../models/Service");
const Appointment = require("../models/Appointment");
const Bill = require("../models/Bill");

jest.setTimeout(30000);

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const passwordHash = bcrypt.hashSync("BillPassword123!", 4);
const users = {
  customer: { name: "Bill Customer", email: `bill-customer-${suffix}@example.com`, role: "CUSTOMER" },
  otherCustomer: { name: "Other Bill Customer", email: `bill-other-${suffix}@example.com`, role: "CUSTOMER" },
  staff: { name: "Bill Staff", email: `bill-staff-${suffix}@example.com`, role: "STAFF" },
  admin: { name: "Bill Admin", email: `bill-admin-${suffix}@example.com`, role: "ADMIN" }
};
let tokens;
let customerVehicle;
let otherVehicle;
let customerService;
let otherService;
let inServiceAppointment;
let completedAppointment;
let requestedAppointment;
let otherBillableAppointment;
const billIds = [];
const appointmentIds = [];

const authHeader = (role) => ({ Authorization: `Bearer ${tokens[role]}` });
const billPayload = (appointment) => ({
  appointment: appointment.toString(),
  services: [{ description: "Labour", amount: 100 }, { description: "Inspection", amount: 50 }],
  parts: [{ description: "Oil filter", amount: 25 }],
  taxRate: 10,
  discount: 10,
  notes: "Payable on collection"
});

beforeAll(async () => {
  await connectDB();
  const createdUsers = Object.entries(users).map(([key, user]) => ({ _id: new mongoose.Types.ObjectId(), ...user, username: `bill-${key}-${suffix}`, passwordHash }));
  await User.collection.insertMany(createdUsers);
  tokens = Object.fromEntries(createdUsers.map((user) => [Object.keys(users).find((key) => users[key].email === user.email), jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: "1d" })]));
  customerVehicle = await Vehicle.create({ owner: createdUsers[0]._id, registrationNumber: `BTEST${Date.now()}A`, make: "Toyota", model: "Corolla", year: 2022, fuelType: "PETROL", vehicleType: "CAR" });
  otherVehicle = await Vehicle.create({ owner: createdUsers[1]._id, registrationNumber: `BTEST${Date.now()}B`, make: "Honda", model: "Civic", year: 2021, fuelType: "HYBRID", vehicleType: "CAR" });
  customerService = await Service.create({ vehicle: customerVehicle._id, customer: createdUsers[0]._id, serviceType: "OIL_CHANGE", description: "Oil change", priority: "MEDIUM" });
  otherService = await Service.create({ vehicle: otherVehicle._id, customer: createdUsers[1]._id, serviceType: "BRAKE_SERVICE", description: "Brake service", priority: "HIGH" });
  inServiceAppointment = await Appointment.create({ customer: createdUsers[0]._id, vehicle: customerVehicle._id, service: customerService._id, appointmentDate: "2099-01-01", appointmentTime: "09:00", status: "IN_SERVICE" });
  completedAppointment = await Appointment.create({ customer: createdUsers[0]._id, vehicle: customerVehicle._id, service: customerService._id, appointmentDate: "2099-01-02", appointmentTime: "09:00", status: "COMPLETED" });
  requestedAppointment = await Appointment.create({ customer: createdUsers[1]._id, vehicle: otherVehicle._id, service: otherService._id, appointmentDate: "2099-01-03", appointmentTime: "09:00", status: "REQUESTED" });
  otherBillableAppointment = await Appointment.create({ customer: createdUsers[1]._id, vehicle: otherVehicle._id, service: otherService._id, appointmentDate: "2099-01-04", appointmentTime: "09:00", status: "COMPLETED" });
  appointmentIds.push(inServiceAppointment._id, completedAppointment._id, requestedAppointment._id, otherBillableAppointment._id);
});

afterAll(async () => {
  await Bill.deleteMany({ _id: { $in: billIds } });
  await Appointment.deleteMany({ _id: { $in: appointmentIds } });
  await Service.deleteMany({ _id: { $in: [customerService && customerService._id, otherService && otherService._id].filter(Boolean) } });
  await Vehicle.deleteMany({ _id: { $in: [customerVehicle && customerVehicle._id, otherVehicle && otherVehicle._id].filter(Boolean) } });
  await User.deleteMany({ email: { $regex: `bill-.*-${suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}@example\\.com$` } });
  await mongoose.disconnect();
});

const createBill = async (role, appointment = inServiceAppointment, payload = billPayload(appointment._id)) => {
  const response = await request(app).post("/api/bills").set(authHeader(role)).send(payload);
  if (response.body.data?.bill?.id) billIds.push(response.body.data.bill.id);
  return response;
};

const createEligibleAppointment = async (status = "COMPLETED", day = Math.floor(Math.random() * 10000) + 10) => {
  const appointment = await Appointment.create({ customer: customerVehicle.owner, vehicle: customerVehicle._id, service: customerService._id, appointmentDate: `2099-02-${String((day % 27) + 1).padStart(2, "0")}`, appointmentTime: `${String((day % 8) + 9).padStart(2, "0")}:00`, status });
  appointmentIds.push(appointment._id);
  return appointment;
};

test("staff can create a bill with server-side calculations and invoice number", async () => {
  const response = await createBill("staff");
  expect(response.status).toBe(201);
  expect(response.body.data.bill.subtotal).toBe(175);
  expect(response.body.data.bill.tax).toBe(16.5);
  expect(response.body.data.bill.discount).toBe(10);
  expect(response.body.data.bill.totalAmount).toBe(181.5);
  expect(response.body.data.bill.invoiceNumber).toMatch(/^INV-\d{4}-\d{6}$/);
});

test("completed appointments are billable and duplicate billing is rejected", async () => {
  const completed = await createBill("admin", completedAppointment, billPayload(completedAppointment._id));
  const duplicate = await createBill("admin", completedAppointment, billPayload(completedAppointment._id));
  expect(completed.status).toBe(201);
  expect(duplicate.status).toBe(409);
});

test("inappropriate appointments and invalid appointment IDs are rejected", async () => {
  const inappropriate = await createBill("staff", requestedAppointment, billPayload(requestedAppointment._id));
  const invalid = await request(app).post("/api/bills").set(authHeader("staff")).send(billPayload("not-an-id"));
  expect(inappropriate.status).toBe(400);
  expect(invalid.status).toBe(400);
});

test("customers cannot create bills and can only view their own bills", async () => {
  const forbidden = await createBill("customer");
  const list = await request(app).get("/api/bills").set(authHeader("customer"));
  const staffList = await request(app).get("/api/bills").set(authHeader("staff"));
  expect(forbidden.status).toBe(403);
  expect(list.status).toBe(200);
  expect(list.body.data.bills.every((bill) => bill.customerId.toString() === customerVehicle.owner.toString())).toBe(true);
  expect(staffList.body.data.bills.length).toBeGreaterThanOrEqual(2);
});

test("customers cannot access another customer's bill", async () => {
  const otherBill = await createBill("admin", otherBillableAppointment, { ...billPayload(otherBillableAppointment._id), services: [{ description: "Other labour", amount: 40 }] });
  const response = await request(app).get(`/api/bills/${otherBill.body.data.bill.id}`).set(authHeader("customer"));
  expect(response.status).toBe(404);
});

test("negative, excessive, and malformed amounts are rejected", async () => {
  const validationAppointment = await createEligibleAppointment();
  const negative = await request(app).post("/api/bills").set(authHeader("staff")).send({ ...billPayload(validationAppointment._id), services: [{ description: "Bad", amount: -1 }] });
  const excessive = await request(app).post("/api/bills").set(authHeader("staff")).send({ ...billPayload(validationAppointment._id), services: [{ description: "Small", amount: 10 }], parts: [], discount: 11 });
  const invalid = await request(app).post("/api/bills").set(authHeader("staff")).send({ ...billPayload(validationAppointment._id), services: "not-an-array" });
  expect(negative.status).toBe(400);
  expect(excessive.status).toBe(400);
  expect(invalid.status).toBe(400);
});

test("partial and full payments update payment status and overpayment is rejected", async () => {
  const paymentAppointment = await createEligibleAppointment();
  const created = await request(app).post("/api/bills").set(authHeader("admin")).send({ ...billPayload(paymentAppointment._id), services: [{ description: "Second bill", amount: 200 }], parts: [], taxRate: 0, discount: 0 });
  const id = created.body.data.bill.id;
  billIds.push(id);
  const partial = await request(app).patch(`/api/bills/${id}/payment`).set(authHeader("staff")).send({ amount: 75, paymentMethod: "card" });
  const overpayment = await request(app).patch(`/api/bills/${id}/payment`).set(authHeader("staff")).send({ amount: 200, paymentMethod: "CASH" });
  const full = await request(app).patch(`/api/bills/${id}/payment`).set(authHeader("staff")).send({ amount: 125, paymentMethod: "UPI" });
  expect(partial.status).toBe(200);
  expect(partial.body.data.bill.paymentStatus).toBe("PARTIALLY_PAID");
  expect(overpayment.status).toBe(400);
  expect(full.status).toBe(200);
  expect(full.body.data.bill.paymentStatus).toBe("PAID");
});

test("admin can cancel an unpaid bill and cancellation blocks payments", async () => {
  const cancellationAppointment = await createEligibleAppointment();
  const created = await request(app).post("/api/bills").set(authHeader("admin")).send({ ...billPayload(cancellationAppointment._id), services: [{ description: "Cancellation test", amount: 20 }], parts: [], taxRate: 0, discount: 0 });
  const id = created.body.data.bill.id;
  billIds.push(id);
  const cancelled = await request(app).patch(`/api/bills/${id}/cancel`).set(authHeader("admin"));
  const payment = await request(app).patch(`/api/bills/${id}/payment`).set(authHeader("staff")).send({ amount: 1, paymentMethod: "CASH" });
  expect(cancelled.status).toBe(200);
  expect(cancelled.body.data.bill.paymentStatus).toBe("CANCELLED");
  expect(payment.status).toBe(400);
});

test("staff can update bill charges and invalid bill IDs are handled", async () => {
  const updateAppointment = await createEligibleAppointment();
  const created = await request(app).post("/api/bills").set(authHeader("admin")).send({ ...billPayload(updateAppointment._id), services: [{ description: "Update test", amount: 30 }], parts: [], taxRate: 0, discount: 0 });
  const id = created.body.data.bill.id;
  billIds.push(id);
  const updated = await request(app).put(`/api/bills/${id}`).set(authHeader("staff")).send({ services: [{ description: "Updated labour", amount: 50 }], taxRate: 10, discount: 0 });
  const invalid = await request(app).get("/api/bills/not-an-id").set(authHeader("admin"));
  expect(updated.status).toBe(200);
  expect(updated.body.data.bill.totalAmount).toBe(55);
  expect(invalid.status).toBe(400);
});