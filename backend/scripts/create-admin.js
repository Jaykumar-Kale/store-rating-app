require("dotenv").config();

const bcrypt = require("bcryptjs");
const pool = require("../db/pool");

async function createAdmin() {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const address = process.env.ADMIN_ADDRESS?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!name || name.length < 20 || name.length > 60) {
    throw new Error("Admin name must be between 20 and 60 characters.");
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid admin email address.");
  }

  if (!address || address.length > 400) {
    throw new Error("Admin address is required and must be at most 400 characters.");
  }

  if (
    !password ||
    password.length < 8 ||
    password.length > 16 ||
    !/[A-Z]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    throw new Error(
      "Admin password must be 8 to 16 characters with an uppercase letter and a special character."
    );
  }

  const existingUser = await pool.query(
    "SELECT id FROM users WHERE email = $1",
    [email]
  );

  if (existingUser.rows.length > 0) {
    throw new Error("A user with that email already exists.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await pool.query(
    `INSERT INTO users (name, email, address, password_hash, role)
     VALUES ($1, $2, $3, $4, 'system_admin')`,
    [name, email, address, passwordHash]
  );

  console.log(`Created system administrator account for ${email}.`);
}

createAdmin()
  .catch((error) => {
    console.error("Admin setup failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
