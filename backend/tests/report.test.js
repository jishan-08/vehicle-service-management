const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../server");
const connectDB = require("../config/db");
const User = require("../models/User");
const Vehicle = require("../models/Vehicle");
const Service = require("../models/Service");
const Appointment = require("../models/Appointment");
const Bill = require("../models/Bill");

jest.setTimeout(30000);

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const passwordHash = bcrypt.hashSync("ReportPassword123!", 4);
const users = {
  customer: { name: "Report Customer", email: `report-customer-${suffix}@example.com`, role: "CUSTOMER" },
  otherCustomer: { name: "Other Report Customer", email: `report-other-${suffix}@example.com`, role: "CUSTOMER" },
  staff: { name: "Report Staff", email: `report-staff-${suffix}@example.com`, role: "STAFF" },
  admin: { name: "Report Admin", email: `report-admin-${suffix}@example.com`, role: "ADMIN" }
};
let tokens;
let customerVehicle;
let otherVehicle;
let customerService;
let otherService;
let customerUpcoming;
let customerCompleted;
const ids = { appointments: [], services: [], bills: [], vehicles: [] };

const authHeader = (role) => ({ Authorization: `Bearer ${tokens[role]}` });

beforeAll(async () => {
  await connectDB();
  const createdUsers = Object.entries(users).map(([key, user]) => ({ _id: new mongoose.Types.ObjectId(), ...user, username: `report-${key}-${suffix}`, passwordHash }));
  await User.collection.insertMany(createdUsers);
  tokens = Object.fromEntries(createdUsers.map((user) => [Object.keys(users).find((key) => users[key].email === user.email), jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: "1d" })]));
  customerVehicle = await Vehicle.create({ owner: createdUsers[0]._id, registrationNumber: `RTEST${Date.now()}A`, make: "Toyota", model: "Yaris", year: 2023, fuelType: "PETROL", vehicleType: "CAR" });
  otherVehicle = await Vehicle.create({ owner: createdUsers[1]._id, registrationNumber: `RTEST${Date.now()}B`, make: "Honda", model: "Jazz", year: 2022, fuelType: "HYBRID", vehicleType: "CAR" });
  ids.vehicles.push(customerVehicle._id, otherVehicle._id);
  customerService = await Service.create({ vehicle: customerVehicle._id, customer: createdUsers[0]._id, serviceType: "OIL_CHANGE", description: "Report oil service", priority: "MEDIUM", status: "IN_PROGRESS" });
  otherService = await Service.create({ vehicle: otherVehicle._id, customer: createdUsers[1]._id, serviceType: "BRAKE_SERVICE", description: "Report brake service", priority: "HIGH", status: "COMPLETED" });
  ids.services.push(customerService._id, otherService._id);
  customerUpcoming = await Appointment.create({ customer: createdUsers[0]._id, vehicle: customerVehicle._id, service: customerService._id, appointmentDate: "2099-05-01", appointmentTime: "09:00", status: "CONFIRMED" });
  customerCompleted = await Appointment.create({ customer: createdUsers[0]._id, vehicle: customerVehicle._id, service: customerService._id, appointmentDate: "2099-05-02", appointmentTime: "09:00", status: "COMPLETED" });
  ids.appointments.push(customerUpcoming._id, customerCompleted._id);
  const customerBill = await Bill.create({ customer: createdUsers[0]._id, vehicle: customerVehicle._id, appointment: customerCompleted._id, services: [{ description: "Report service", amount: 100 }], parts: [], subtotal: 100, tax: 10, discount: 0, totalAmount: 110, amountPaid: 50, paymentStatus: "PARTIALLY_PAID", invoiceNumber: `RINV-${Date.now()}-1` });
  const cancelledBill = await Bill.create({ customer: createdUsers[0]._id, vehicle: customerVehicle._id, appointment: new mongoose.Types.ObjectId(), services: [], parts: [], subtotal: 500, tax: 0, discount: 0, totalAmount: 500, amountPaid: 0, paymentStatus: "CANCELLED", invoiceNumber: `RINV-${Date.now()}-2` });
  ids.bills.push(customerBill._id, cancelledBill._id);
});

afterAll(async () => {
  await Bill.deleteMany({ _id: { $in: ids.bills } });
  await Appointment.deleteMany({ _id: { $in: ids.appointments } });
  await Service.deleteMany({ _id: { $in: ids.services } });
  await Vehicle.deleteMany({ _id: { $in: ids.vehicles } });
  await User.deleteMany({ email: { $regex: `report-.*-${suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}@example\\.com$` } });
  await mongoose.disconnect();
});

test("dashboard requires authentication and customer data is isolated", async () => {
  const unauthenticated = await request(app).get("/api/dashboard/summary");
  const customer = await request(app).get("/api/dashboard/summary").set(authHeader("customer"));

  expect(unauthenticated.status).toBe(401);
  expect(customer.status).toBe(200);
  expect(customer.body.data.role).toBe("CUSTOMER");
  expect(customer.body.data.summary.totalVehicles).toBe(1);
  expect(customer.body.data.summary.upcomingAppointments).toBe(1);
  expect(customer.body.data.summary.totalAmountDue).toBe(60);
  expect(customer.body.data.summary.totalCustomers).toBeUndefined();
});

test("staff dashboard exposes operations but not admin-only totals", async () => {
  const response = await request(app).get("/api/dashboard/summary").set(authHeader("staff"));
  expect(response.status).toBe(200);
  expect(response.body.data.role).toBe("STAFF");
  expect(response.body.data.summary.serviceWorkload.IN_PROGRESS).toBeGreaterThanOrEqual(1);
  expect(response.body.data.summary.totalCustomers).toBeUndefined();
});

test("admin dashboard exposes system totals and excludes cancelled revenue", async () => {
  const response = await request(app).get("/api/dashboard/summary").set(authHeader("admin"));
  expect(response.status).toBe(200);
  expect(response.body.data.role).toBe("ADMIN");
  expect(response.body.data.summary.totalCustomers).toBeGreaterThanOrEqual(2);
  expect(response.body.data.summary.totalRevenue).toBeGreaterThanOrEqual(50);
  expect(response.body.data.summary.outstandingAmount).toBeGreaterThanOrEqual(60);
});

test("service report returns actual workflow counts", async () => {
  const response = await request(app).get("/api/reports/service-summary").set(authHeader("customer"));
  expect(response.status).toBe(200);
  expect(response.body.data.byStatus.IN_PROGRESS).toBe(1);
  expect(response.body.data.completed).toBe(0);
  expect(response.body.data.cancelled).toBe(0);
});

test("appointment report returns status and date summaries", async () => {
  const response = await request(app).get("/api/reports/appointment-summary?startDate=2099-05-01&endDate=2099-05-31").set(authHeader("customer"));
  expect(response.status).toBe(200);
  expect(response.body.data.total).toBe(2);
  expect(response.body.data.completed).toBe(1);
  expect(response.body.data.upcoming).toBe(1);
  expect(response.body.data.byDate["2099-05-01"]).toBe(1);
});

test("revenue report calculates paid and outstanding values and excludes cancelled bills", async () => {
  const response = await request(app).get("/api/reports/revenue-summary").set(authHeader("customer"));
  expect(response.status).toBe(200);
  expect(response.body.data.totalRevenue).toBe(110);
  expect(response.body.data.paidRevenue).toBe(50);
  expect(response.body.data.outstandingAmount).toBe(60);
  expect(response.body.data.pendingInvoices).toBe(1);
  expect(response.body.data.totalInvoices).toBe(1);
});

test("vehicle report counts registered, active, and completed-history vehicles", async () => {
  const customer = await request(app).get("/api/reports/vehicle-summary").set(authHeader("customer"));
  const admin = await request(app).get("/api/reports/vehicle-summary").set(authHeader("admin"));
  expect(customer.status).toBe(200);
  expect(customer.body.data.totalRegisteredVehicles).toBe(1);
  expect(customer.body.data.vehiclesCurrentlyUnderService).toBe(1);
  expect(customer.body.data.vehiclesWithCompletedServiceHistory).toBe(0);
  expect(admin.body.data.totalRegisteredVehicles).toBeGreaterThanOrEqual(2);
});

test("invalid date ranges are rejected and valid empty ranges return zeroes", async () => {
  const invalid = await request(app).get("/api/reports/revenue-summary?startDate=2099-06-02&endDate=2099-06-01").set(authHeader("admin"));
  const empty = await request(app).get("/api/reports/service-summary?startDate=2099-12-01&endDate=2099-12-31").set(authHeader("customer"));
  expect(invalid.status).toBe(400);
  expect(empty.status).toBe(200);
  expect(empty.body.data.byStatus.IN_PROGRESS).toBe(0);
});

test("invalid authentication and unauthorized report roles are rejected", async () => {
  const invalid = await request(app).get("/api/reports/revenue-summary").set("Authorization", "Bearer invalid.token");
  const missing = await request(app).get("/api/reports/appointment-summary");
  expect(invalid.status).toBe(401);
  expect(missing.status).toBe(401);
});