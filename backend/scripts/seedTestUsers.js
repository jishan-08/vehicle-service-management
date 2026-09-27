const dotenv = require("dotenv");
const dns = require("dns");
const path = require("path");
const bcrypt = require("bcryptjs");

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const connectDB = require("../config/db");
const User = require("../models/User");

const testUsers = [
  {
    name: "Test Super Admin",
    email: "admin.test@vanta.local",
    username: "admin_test",
    password: "Admin@12345",
    role: "ADMIN"
  },
  {
    name: "Test Staff",
    email: "staff.test@vanta.local",
    username: "staff_test",
    password: "Staff@12345",
    role: "STAFF"
  },
  {
    name: "Test Customer",
    email: "customer.test@vanta.local",
    username: "customer_test",
    password: "Customer@12345",
    role: "CUSTOMER"
  }
];

async function seedTestUsers() {
  try {
    await connectDB();

    const indexes = await User.collection.indexes();
    console.log("Existing User collection indexes:", indexes);

    for (const testUser of testUsers) {
      const normalizedEmail = testUser.email.toLowerCase().trim();
      const passwordHash = await bcrypt.hash(testUser.password, 12);

      const existing = await User.findOne({ email: normalizedEmail });
      if (existing) {
        existing.name = testUser.name;
        existing.role = testUser.role;
        existing.passwordHash = passwordHash;
        await existing.save();
      } else {
        await User.collection.insertOne({
          name: testUser.name,
          email: normalizedEmail,
          username: testUser.username,
          passwordHash,
          role: testUser.role,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    console.log("=== Test Accounts Seeded/Verified Successfully ===");
    console.log("Role | Email | Username | Password");
    for (const u of testUsers) {
      console.log(`${u.role} | ${u.email} | ${u.username} | ${u.password}`);
    }
    process.exit(0);
  } catch (error) {
    console.error("Error seeding test users:", error.message);
    process.exit(1);
  }
}

seedTestUsers();
