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

jest.setTimeout(30000);

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const passwordHash = bcrypt.hashSync("AppointmentPassword123!", 4);
const users = {
  customer: { name: "Appointment Customer", email: `appointment-customer-${suffix}@example.com`, role: "CUSTOMER" },
  otherCustomer: { name: "Other Appointment Customer", email: `appointment-other-${suffix}@example.com`, role: "CUSTOMER" },
  staff: { name: "Appointment Staff", email: `appointment-staff-${suffix}@example.com`, role: "STAFF" },
  admin: { name: "Appointment Admin", email: `appointment-admin-${suffix}@example.com`, role: "ADMIN" }
};
let tokens;
let customerVehicle;
let otherVehicle;
let customerService;
let otherService;
const appointmentIds = [];

const futureDate = (days = 30) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
const appointmentPayload = (vehicleId, serviceId, time = "10:00") => ({
  vehicle: vehicleId.toString(),
  service: serviceId.toString(),
  customer: new mongoose.Types.ObjectId().toString(),
  appointmentDate: futureDate(),
  appointmentTime: time,
  notes: "Please inspect before service"
});
const authHeader = (role) => ({ Authorization: `Bearer ${tokens[role]}` });

beforeAll(async () => {
  await connectDB();
  const createdUsers = Object.entries(users).map(([key, user]) => ({
    _id: new mongoose.Types.ObjectId(),
    ...user,
    username: `appointment-${key}-${suffix}`,
    passwordHash
  }));
  await User.collection.insertMany(createdUsers);
  tokens = Object.fromEntries(createdUsers.map((user) => [
    Object.keys(users).find((key) => users[key].email === user.email),
    jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: "1d" })
  ]));

  customerVehicle = await Vehicle.create({ owner: createdUsers[0]._id, registrationNumber: `ATEST${Date.now()}A`, make: "Toyota", model: "Corolla", year: 2022, fuelType: "PETROL", vehicleType: "CAR" });
  otherVehicle = await Vehicle.create({ owner: createdUsers[1]._id, registrationNumber: `ATEST${Date.now()}B`, make: "Honda", model: "Civic", year: 2021, fuelType: "HYBRID", vehicleType: "CAR" });
  customerService = await Service.create({ vehicle: customerVehicle._id, customer: createdUsers[0]._id, serviceType: "OIL_CHANGE", description: "Oil and filter replacement", priority: "MEDIUM" });
  otherService = await Service.create({ vehicle: otherVehicle._id, customer: createdUsers[1]._id, serviceType: "BRAKE_SERVICE", description: "Brake inspection", priority: "HIGH" });
});

afterAll(async () => {
  await Appointment.deleteMany({ _id: { $in: appointmentIds } });
  await Service.deleteMany({ _id: { $in: [customerService && customerService._id, otherService && otherService._id].filter(Boolean) } });
  await Vehicle.deleteMany({ _id: { $in: [customerVehicle && customerVehicle._id, otherVehicle && otherVehicle._id].filter(Boolean) } });
  await User.deleteMany({ email: { $regex: `appointment-.*-${suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}@example\\.com$` } });
  await mongoose.disconnect();
});

const createAppointment = async (role = "customer", time = "10:00", vehicle = customerVehicle, service = customerService) => {
  const response = await request(app).post("/api/appointments").set(authHeader(role)).send(appointmentPayload(vehicle._id, service._id, time));
  if (response.body.data?.appointment?.id) appointmentIds.push(response.body.data.appointment.id);
  return response;
};

test("customer can create an appointment for their own vehicle and service", async () => {
  const response = await createAppointment("customer", "10:00");
  expect(response.status).toBe(201);
  expect(response.body.data.appointment.status).toBe("REQUESTED");
  expect(response.body.data.appointment.customerId.toString()).toBe(customerVehicle.owner.toString());
});

test("unauthenticated access and another customer's vehicle are rejected", async () => {
  const unauthenticated = await request(app).get("/api/appointments");
  const otherVehicleResponse = await createAppointment("customer", "11:00", otherVehicle, otherService);

  expect(unauthenticated.status).toBe(401);
  expect(otherVehicleResponse.status).toBe(404);
});

test("a service that does not belong to the selected vehicle is rejected", async () => {
  const response = await createAppointment("customer", "12:00", customerVehicle, otherService);
  expect(response.status).toBe(400);
});

test("invalid IDs, past appointments, and malformed schedules are rejected", async () => {
  const invalidId = await request(app).post("/api/appointments").set(authHeader("customer")).send({ ...appointmentPayload(customerVehicle._id, customerService._id), vehicle: "invalid" });
  const past = await request(app).post("/api/appointments").set(authHeader("customer")).send({ ...appointmentPayload(customerVehicle._id, customerService._id, "13:00"), appointmentDate: "2000-01-01" });
  const malformed = await request(app).post("/api/appointments").set(authHeader("customer")).send({ ...appointmentPayload(customerVehicle._id, customerService._id, "14:00"), appointmentDate: "2026-99-99" });

  expect(invalidId.status).toBe(400);
  expect(past.status).toBe(400);
  expect(malformed.status).toBe(400);
});

test("conflicting active appointments are rejected but cancelled slots are reusable", async () => {
  const conflict = await createAppointment("customer", "10:00");
  expect(conflict.status).toBe(409);

  const cancelled = await request(app).patch(`/api/appointments/${appointmentIds[0]}/status`).set(authHeader("customer")).send({ status: "CANCELLED" });
  const reusable = await createAppointment("customer", "10:00");

  expect(cancelled.status).toBe(200);
  expect(reusable.status).toBe(201);
});

test("customer sees only their appointments and cannot view another customer's appointment", async () => {
  const other = await createAppointment("admin", "15:00", otherVehicle, otherService);
  const list = await request(app).get("/api/appointments").set(authHeader("customer"));
  const hidden = await request(app).get(`/api/appointments/${other.body.data.appointment.id}`).set(authHeader("customer"));

  expect(list.status).toBe(200);
  expect(list.body.data.appointments.every((item) => item.customerId.toString() === customerVehicle.owner.toString())).toBe(true);
  expect(hidden.status).toBe(404);
});

test("customer cannot arbitrarily change status or assign staff", async () => {
  const response = await request(app).put(`/api/appointments/${appointmentIds[1]}`).set(authHeader("customer")).send({ status: "CONFIRMED", assignedStaff: new mongoose.Types.ObjectId() });
  expect(response.status).toBe(403);
});

test("customer can cancel a requested appointment but cannot complete it", async () => {
  const appointment = await createAppointment("customer", "16:00");
  const completed = await request(app).patch(`/api/appointments/${appointment.body.data.appointment.id}/status`).set(authHeader("customer")).send({ status: "COMPLETED" });
  const cancelled = await request(app).patch(`/api/appointments/${appointment.body.data.appointment.id}/status`).set(authHeader("customer")).send({ status: "CANCELLED" });

  expect(completed.status).toBe(403);
  expect(cancelled.status).toBe(200);
});

test("staff can view appointments, update notes, and advance valid statuses", async () => {
  const appointment = await createAppointment("customer", "17:00");
  const list = await request(app).get("/api/appointments").set(authHeader("staff"));
  const update = await request(app).put(`/api/appointments/${appointment.body.data.appointment.id}`).set(authHeader("staff")).send({ notes: "Bay 2 prepared" });
  const confirmed = await request(app).patch(`/api/appointments/${appointment.body.data.appointment.id}/status`).set(authHeader("staff")).send({ status: "CONFIRMED" });

  expect(list.status).toBe(200);
  expect(update.status).toBe(200);
  expect(confirmed.status).toBe(200);
});

test("every valid appointment status transition succeeds", async () => {
  const appointment = await createAppointment("customer", "18:00");
  const workflow = ["CONFIRMED", "CHECKED_IN", "IN_SERVICE", "COMPLETED"];
  for (const status of workflow) {
    const response = await request(app).patch(`/api/appointments/${appointment.body.data.appointment.id}/status`).set(authHeader("staff")).send({ status });
    expect(response.status).toBe(200);
  }
});

test("invalid status jumps are rejected", async () => {
  const appointment = await createAppointment("customer", "19:00");
  const response = await request(app).patch(`/api/appointments/${appointment.body.data.appointment.id}/status`).set(authHeader("staff")).send({ status: "IN_SERVICE" });
  expect(response.status).toBe(400);
});

test("admin has full appointment management including assignment and deletion", async () => {
  const appointment = await createAppointment("admin", "20:00");
  const staff = await User.findOne({ email: users.staff.email });
  const assigned = await request(app).put(`/api/appointments/${appointment.body.data.appointment.id}`).set(authHeader("admin")).send({ assignedStaff: staff._id.toString(), notes: "Assigned to bay 1" });
  const deleted = await request(app).delete(`/api/appointments/${appointment.body.data.appointment.id}`).set(authHeader("admin"));

  expect(assigned.status).toBe(200);
  expect(deleted.status).toBe(200);
});

test("nonexistent appointment and invalid appointment IDs return correct errors", async () => {
  const invalid = await request(app).get("/api/appointments/not-an-id").set(authHeader("admin"));
  const missing = await request(app).get(`/api/appointments/${new mongoose.Types.ObjectId()}`).set(authHeader("admin"));

  expect(invalid.status).toBe(400);
  expect(missing.status).toBe(404);
});