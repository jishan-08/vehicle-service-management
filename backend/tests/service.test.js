const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../server");
const connectDB = require("../config/db");
const User = require("../models/User");
const Vehicle = require("../models/Vehicle");
const Service = require("../models/Service");

jest.setTimeout(30000);

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const passwordHash = bcrypt.hashSync("ServicePassword123!", 4);
const users = {
  customer: { name: "Service Customer", email: `service-customer-${suffix}@example.com`, role: "CUSTOMER" },
  otherCustomer: { name: "Other Service Customer", email: `service-other-${suffix}@example.com`, role: "CUSTOMER" },
  staff: { name: "Service Staff", email: `service-staff-${suffix}@example.com`, role: "STAFF" },
  admin: { name: "Service Admin", email: `service-admin-${suffix}@example.com`, role: "ADMIN" }
};
let tokens;
let customerVehicle;
let otherVehicle;
let serviceId;
let otherServiceId;

const servicePayload = (vehicle) => ({
  vehicle: vehicle.toString(),
  customer: new mongoose.Types.ObjectId().toString(),
  serviceType: "oil_change",
  description: "Replace engine oil and inspect filters",
  priority: "high",
  estimatedCost: 120
});

const authHeader = (role) => ({ Authorization: `Bearer ${tokens[role]}` });

beforeAll(async () => {
  await connectDB();
  const createdUsers = Object.entries(users).map(([key, user]) => ({
    _id: new mongoose.Types.ObjectId(),
    ...user,
    username: `service-${key}-${suffix}`,
    passwordHash
  }));
  await User.collection.insertMany(createdUsers);
  tokens = Object.fromEntries(
    createdUsers.map((user) => [
      Object.keys(users).find((key) => users[key].email === user.email),
      jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: "1d" })
    ])
  );

  customerVehicle = await Vehicle.create({
    owner: createdUsers[0]._id,
    registrationNumber: `STEST${Date.now()}A`,
    make: "Toyota",
    model: "Corolla",
    year: 2022,
    fuelType: "PETROL",
    vehicleType: "CAR"
  });
  otherVehicle = await Vehicle.create({
    owner: createdUsers[1]._id,
    registrationNumber: `STEST${Date.now()}B`,
    make: "Honda",
    model: "Civic",
    year: 2021,
    fuelType: "HYBRID",
    vehicleType: "CAR"
  });
});

afterAll(async () => {
  await Service.deleteMany({ _id: { $in: [serviceId, otherServiceId].filter(Boolean) } });
  await Vehicle.deleteMany({ _id: { $in: [customerVehicle && customerVehicle._id, otherVehicle && otherVehicle._id].filter(Boolean) } });
  await User.deleteMany({ email: { $regex: `service-.*-${suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}@example\\.com$` } });
  await mongoose.disconnect();
});

test("unauthenticated service requests are rejected", async () => {
  const response = await request(app).get("/api/services");
  expect(response.status).toBe(401);
});

test("customer creates a service request for their own vehicle", async () => {
  const response = await request(app)
    .post("/api/services")
    .set(authHeader("customer"))
    .send(servicePayload(customerVehicle._id));

  expect(response.status).toBe(201);
  expect(response.body.data.service.status).toBe("REQUESTED");
  expect(response.body.data.service.serviceType).toBe("OIL_CHANGE");
  expect(response.body.data.service.priority).toBe("HIGH");
  serviceId = response.body.data.service.id;
});

test("customer cannot create a service for another customer's vehicle", async () => {
  const response = await request(app)
    .post("/api/services")
    .set(authHeader("customer"))
    .send(servicePayload(otherVehicle._id));

  expect(response.status).toBe(404);
});

test("customer can view own services but not another customer's service", async () => {
  const otherService = await Service.create({
    vehicle: otherVehicle._id,
    customer: otherVehicle.owner,
    serviceType: "BRAKE_SERVICE",
    description: "Inspect brake pads",
    priority: "MEDIUM"
  });
  otherServiceId = otherService._id;

  const list = await request(app).get("/api/services").set(authHeader("customer"));
  const own = await request(app).get(`/api/services/${serviceId}`).set(authHeader("customer"));
  const other = await request(app).get(`/api/services/${otherServiceId}`).set(authHeader("customer"));

  expect(list.status).toBe(200);
  expect(list.body.data.services).toHaveLength(1);
  expect(own.status).toBe(200);
  expect(other.status).toBe(404);
});

test("invalid service type, priority, negative cost, and missing vehicle are rejected", async () => {
  const invalidType = await request(app).post("/api/services").set(authHeader("customer")).send({
    ...servicePayload(customerVehicle._id), serviceType: "INVALID"
  });
  const invalidPriority = await request(app).post("/api/services").set(authHeader("customer")).send({
    ...servicePayload(customerVehicle._id), priority: "INVALID"
  });
  const negativeCost = await request(app).post("/api/services").set(authHeader("customer")).send({
    ...servicePayload(customerVehicle._id), estimatedCost: -1
  });
  const missingVehicle = await request(app).post("/api/services").set(authHeader("customer")).send({
    ...servicePayload(new mongoose.Types.ObjectId())
  });

  expect(invalidType.status).toBe(400);
  expect(invalidPriority.status).toBe(400);
  expect(negativeCost.status).toBe(400);
  expect(missingVehicle.status).toBe(404);
});

test("REQUESTED to COMPLETED is rejected", async () => {
  const response = await request(app)
    .patch(`/api/services/${serviceId}/status`)
    .set(authHeader("staff"))
    .send({ status: "COMPLETED" });

  expect(response.status).toBe(400);
});

test("staff can advance through every valid status transition", async () => {
  const workflow = [
    ["APPROVED", 200],
    ["SCHEDULED", 200],
    ["VEHICLE_RECEIVED", 200],
    ["INSPECTION", 200],
    ["IN_PROGRESS", 200],
    ["COMPLETED", 200]
  ];

  for (const [status, expectedStatus] of workflow) {
    const response = await request(app)
      .patch(`/api/services/${serviceId}/status`)
      .set(authHeader("staff"))
      .send({ status });
    expect(response.status).toBe(expectedStatus);
  }
});

test("customer cannot change service status or actual cost", async () => {
  const response = await request(app)
    .put(`/api/services/${serviceId}`)
    .set(authHeader("customer"))
    .send({ actualCost: 99, status: "REQUESTED" });

  expect(response.status).toBe(403);
});

test("staff can view jobs and update notes and actual cost", async () => {
  const list = await request(app).get("/api/services").set(authHeader("staff"));
  const update = await request(app)
    .put(`/api/services/${serviceId}`)
    .set(authHeader("staff"))
    .send({ inspectionNotes: "Brake inspection complete", actualCost: 140 });

  expect(list.status).toBe(200);
  expect(list.body.data.services.length).toBeGreaterThanOrEqual(2);
  expect(update.status).toBe(200);
  expect(update.body.data.service.actualCost).toBe(140);
});

test("admin can assign staff and delete a service", async () => {
  const staffUser = await User.findOne({ email: users.staff.email });
  const assign = await request(app)
    .put(`/api/services/${serviceId}`)
    .set(authHeader("admin"))
    .send({ assignedStaff: staffUser._id.toString(), serviceNotes: "Ready for final review" });
  const deletion = await request(app)
    .delete(`/api/services/${otherServiceId}`)
    .set(authHeader("admin"));

  expect(assign.status).toBe(200);
  expect(assign.body.data.service.assignedStaffId.toString()).toBe(staffUser._id.toString());
  expect(deletion.status).toBe(200);
});

test("invalid and nonexistent service IDs are handled", async () => {
  const invalid = await request(app)
    .get("/api/services/not-an-object-id")
    .set(authHeader("admin"));
  const missing = await request(app)
    .get(`/api/services/${new mongoose.Types.ObjectId()}`)
    .set(authHeader("admin"));

  expect(invalid.status).toBe(400);
  expect(missing.status).toBe(404);
});