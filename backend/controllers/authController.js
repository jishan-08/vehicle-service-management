const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const safeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

const createToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
};

const validateCredentials = (name, email, password) => {
  if (typeof name !== "string" || name.trim().length < 2) {
    return "Name must be at least 2 characters long";
  }

  if (typeof email !== "string" || !emailPattern.test(email.trim())) {
    return "A valid email address is required";
  }

  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters long";
  }

  return null;
};

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    const validationError = validateCredentials(name, email, password);

    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists"
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: "CUSTOMER"
    });

    return res.status(201).json({
      success: true,
      message: "Customer account created successfully",
      data: { user: safeUser(user), token: createToken(user) }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists"
      });
    }

    throw error;
  }
};

const login = async (req, res) => {
  const { email, password } = req.body || {};

  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({
      success: false,
      message: "Email and password are required"
    });
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select(
    "+passwordHash"
  );
  const passwordMatches = user && (await bcrypt.compare(password, user.passwordHash));

  if (!user || !passwordMatches) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password"
    });
  }

  return res.json({
    success: true,
    message: "Login successful",
    data: { user: safeUser(user), token: createToken(user) }
  });
};

const me = (req, res) =>
  res.json({ success: true, data: { user: safeUser(req.user) } });

module.exports = { register, login, me };