const bcrypt = require("bcryptjs");
const express = require("express");
const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../server");
const connectDB = require("../config/db");
const User = require("../models/User");
const Vehicle = require("../models/Vehicle");
const jwt = require("jsonwebtoken");

jest.setTimeout(30000);

const suffix = Date.now();
const passwordHash = bcrypt.hashSync("TestPassword123!", 4);
const users = {
  customer: { name: "Vehicle Customer", email: `vehicle-customer-${suffix}@example.com`, role: "CUSTOMER" },
  otherCustomer: { name: "Other Customer", email: `vehicle-other-${suffix}@example.com`, role: "CUSTOMER" },
  staff: { name: "Vehicle Staff", email: `vehicle-staff-${suffix}@example.com`, role: "STAFF" },
  admin: { name: "Vehicle Admin", email: `vehicle-admin-${suffix}@example.com`, role: "ADMIN" }
};
let tokens;
let customerVehicle;
let otherVehicle;

const vehiclePayload = (registrationNumber) => ({
  registrationNumber,
  make: "Toyota",
  model: "Corolla",
  year: 2022,
  fuelType: "petrol",
  vehicleType: "car"
});

const authHeader = (role) => ({ Authorization: `Bearer ${tokens[role]}` });

beforeAll(async () => {
  await connectDB();
  const createdUsers = Object.entries(users).map(([key, user]) => ({
    _id: new mongoose.Types.ObjectId(),
    ...user,
    username: `${key}-${suffix}`,
    passwordHash
  }));
  await User.collection.insertMany(createdUsers);
  tokens = Object.fromEntries(
    createdUsers.map((user) => [
      Object.keys(users).find((key) => users[key].email === user.email),
      jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: "1d" })
    ])
  );
});

afterAll(async () => {
  await Vehicle.deleteMany({ registrationNumber: { $regex: `^VTEST${suffix}` } });
  await User.deleteMany({ email: { $regex: `${suffix}@example\\.com$` } });
  await mongoose.disconnect();
});

test("unauthenticated vehicle requests are rejected", async () => {
  const response = await request(app).get("/api/vehicles");
  expect(response.status).toBe(401);
});

test("customer can create a vehicle and owner body input is ignored", async () => {
  const response = await request(app)
    .post("/api/vehicles")
    .set(authHeader("customer"))
    .send({ ...vehiclePayload(`VTEST${suffix}A`), owner: new mongoose.Types.ObjectId() });

  expect(response.status).toBe(201);
  expect(response.body.data.vehicle.ownerId.toString()).not.toBeUndefined();
  expect(response.body.data.vehicle.registrationNumber).toBe(`VTEST${suffix}A`);
  customerVehicle = response.body.data.vehicle;
});

test("duplicate registration numbers are rejected", async () => {
  const response = await request(app)
    .post("/api/vehicles")
    .set(authHeader("otherCustomer"))
    .send(vehiclePayload(` vtest${suffix}a `));

  expect(response.status).toBe(409);
});

test("missing required fields are rejected", async () => {
  const response = await request(app)
    .post("/api/vehicles")
    .set(authHeader("customer"))
    .send({ make: "Toyota" });

  expect(response.status).toBe(400);
});

test("invalid vehicle values are rejected", async () => {
  const response = await request(app)
    .post("/api/vehicles")
    .set(authHeader("customer"))
    .send({ ...vehiclePayload(`VTEST${suffix}B`), year: 3000, fuelType: "steam" });

  expect(response.status).toBe(400);
});

test("customer can retrieve only their own vehicles", async () => {
  const ownList = await request(app).get("/api/vehicles").set(authHeader("customer"));
  const ownVehicle = await request(app)
    .get(`/api/vehicles/${customerVehicle.id}`)
    .set(authHeader("customer"));

  expect(ownList.status).toBe(200);
  expect(ownList.body.data.vehicles).toHaveLength(1);
  expect(ownVehicle.status).toBe(200);
  expect(ownVehicle.body.data.vehicle.id).toBe(customerVehicle.id);
});

test("customer cannot retrieve another customer's vehicle", async () => {
  const created = await Vehicle.create({
    ...vehiclePayload(`VTEST${suffix}C`),
    fuelType: "PETROL",
    vehicleType: "CAR",
    owner: new mongoose.Types.ObjectId()
  });
  otherVehicle = created;

  const response = await request(app)
    .get(`/api/vehicles/${created._id}`)
    .set(authHeader("customer"));

  expect(response.status).toBe(404);
});

test("customer can update their own vehicle", async () => {
  const response = await request(app)
    .put(`/api/vehicles/${customerVehicle.id}`)
    .set(authHeader("customer"))
    .send({ model: "Camry", owner: new mongoose.Types.ObjectId() });

  expect(response.status).toBe(200);
  expect(response.body.data.vehicle.model).toBe("Camry");
});

test("customer cannot update another customer's vehicle", async () => {
  const response = await request(app)
    .put(`/api/vehicles/${otherVehicle._id}`)
    .set(authHeader("customer"))
    .send({ model: "Hacked" });

  expect(response.status).toBe(404);
});

test("staff can view all vehicles but cannot update or delete", async () => {
  const list = await request(app).get("/api/vehicles").set(authHeader("staff"));
  const detail = await request(app)
    .get(`/api/vehicles/${customerVehicle.id}`)
    .set(authHeader("staff"));
  const update = await request(app)
    .put(`/api/vehicles/${customerVehicle.id}`)
    .set(authHeader("staff"))
    .send({ model: "Denied" });
  const deletion = await request(app)
    .delete(`/api/vehicles/${customerVehicle.id}`)
    .set(authHeader("staff"));

  expect(list.status).toBe(200);
  expect(list.body.data.vehicles.length).toBeGreaterThanOrEqual(2);
  expect(detail.status).toBe(200);
  expect(update.status).toBe(403);
  expect(deletion.status).toBe(403);
});

test("admin can view, update, and delete vehicles", async () => {
  const update = await request(app)
    .put(`/api/vehicles/${customerVehicle.id}`)
    .set(authHeader("admin"))
    .send({ make: "Honda" });
  const list = await request(app).get("/api/vehicles").set(authHeader("admin"));
  const deletion = await request(app)
    .delete(`/api/vehicles/${otherVehicle._id}`)
    .set(authHeader("admin"));

  expect(update.status).toBe(200);
  expect(list.status).toBe(200);
  expect(list.body.data.vehicles.length).toBeGreaterThanOrEqual(2);
  expect(deletion.status).toBe(200);
});

test("invalid and nonexistent vehicle IDs return appropriate errors", async () => {
  const invalid = await request(app)
    .get("/api/vehicles/not-an-object-id")
    .set(authHeader("admin"));
  const missing = await request(app)
    .get(`/api/vehicles/${new mongoose.Types.ObjectId()}`)
    .set(authHeader("admin"));

  expect(invalid.status).toBe(400);
  expect(missing.status).toBe(404);
});