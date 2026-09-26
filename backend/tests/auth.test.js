const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const app = require("../server");
const connectDB = require("../config/db");
const User = require("../models/User");
const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");

jest.setTimeout(30000);

const email = `auth-test-${Date.now()}@example.com`;
const password = "CorrectPassword123!";

beforeAll(async () => {
  await connectDB();
});

afterAll(async () => {
  await User.deleteOne({ email });
  await mongoose.disconnect();
});

test("registers a customer and never returns a password hash", async () => {
  const response = await request(app).post("/api/auth/register").send({
    name: "Test Customer",
    email,
    password,
    role: "ADMIN"
  });

  expect(response.status).toBe(201);
  expect(response.body.success).toBe(true);
  expect(response.body.data.user.role).toBe("CUSTOMER");
  expect(response.body.data.user.passwordHash).toBeUndefined();
  expect(response.body.data.token).toEqual(expect.any(String));
});

test("rejects duplicate registration", async () => {
  const response = await request(app).post("/api/auth/register").send({
    name: "Another Customer",
    email,
    password
  });

  expect(response.status).toBe(409);
});

test("logs in with the correct password and rejects the wrong password", async () => {
  const success = await request(app).post("/api/auth/login").send({ email, password });
  const failure = await request(app).post("/api/auth/login").send({
    email,
    password: "WrongPassword123!"
  });

  expect(success.status).toBe(200);
  expect(success.body.data.user.passwordHash).toBeUndefined();
  expect(failure.status).toBe(401);
});

test("protects me and accepts a valid token", async () => {
  const login = await request(app).post("/api/auth/login").send({ email, password });
  const token = login.body.data.token;

  const missing = await request(app).get("/api/auth/me");
  const valid = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
  const invalid = await request(app)
    .get("/api/auth/me")
    .set("Authorization", "Bearer invalid.token.value");

  expect(missing.status).toBe(401);
  expect(valid.status).toBe(200);
  expect(valid.body.data.user.email).toBe(email);
  expect(invalid.status).toBe(401);
});

test("role middleware rejects a customer on an admin-only route", async () => {
  const login = await request(app).post("/api/auth/login").send({ email, password });
  const roleApp = express();
  roleApp.use(express.json());
  roleApp.get("/admin-only", authenticate, authorizeRoles("ADMIN"), (req, res) => {
    res.json({ success: true });
  });

  const response = await request(roleApp)
    .get("/admin-only")
    .set("Authorization", `Bearer ${login.body.data.token}`);

  expect(response.status).toBe(403);
});

test("health endpoint remains available", async () => {
  const response = await request(app).get("/api/health");

  expect(response.status).toBe(200);
  expect(response.body.status).toBe("healthy");
});

test("rejects malformed JSON with a client error", async () => {
  const response = await request(app)
    .post("/api/auth/login")
    .set("Content-Type", "application/json")
    .send('{"email":');

  expect(response.status).toBe(400);
  expect(response.body.message).toBe("Malformed JSON request body");
});

test("can issue a valid JWT with the configured secret", async () => {
  const login = await request(app).post("/api/auth/login").send({ email, password });
  const decoded = jwt.verify(login.body.data.token, process.env.JWT_SECRET);

  expect(decoded.sub).toBeDefined();
  expect(decoded.role).toBe("CUSTOMER");
});