const jwt = require("jsonwebtoken");
const express = require("express");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const pool = require("../db/pool");

const router = express.Router();

router.post(
  "/register",
  [
    body("name")
      .trim()
      .isLength({ min: 20, max: 60 })
      .withMessage("Name must be between 20 and 60 characters."),
    body("email")
      .trim()
      .isEmail()
      .withMessage("Enter a valid email address.")
      .normalizeEmail(),
    body("address")
      .trim()
      .isLength({ min: 1, max: 400 })
      .withMessage("Address is required and must be at most 400 characters."),
    body("password")
      .isLength({ min: 8, max: 16 })
      .withMessage("Password must be 8 to 16 characters.")
      .matches(/(?=.*[A-Z])(?=.*[^A-Za-z0-9])/)
      .withMessage(
        "Password must include an uppercase letter and a special character.",
      ),
  ],
  async (request, response) => {
    const errors = validationResult(request);

    if (!errors.isEmpty()) {
      return response.status(400).json({ errors: errors.array() });
    }

    const { name, email, address, password } = request.body;

    try {
      const passwordHash = await bcrypt.hash(password, 12);

      const result = await pool.query(
        `INSERT INTO users (name, email, address, password_hash, role)
         VALUES ($1, $2, $3, $4, 'normal_user')
         RETURNING id, name, email, address, role`,
        [name, email, address, passwordHash],
      );

      return response.status(201).json({ user: result.rows[0] });
    } catch (error) {
      if (error.code === "23505") {
        return response.status(409).json({
          message: "An account with that email already exists.",
        });
      }

      console.error("Registration failed:", error.message);
      return response.status(500).json({
        message: "Could not create the account.",
      });
    }
  },
);

router.post(
  "/login",
  [
    body("email")
      .trim()
      .isEmail()
      .withMessage("Enter a valid email address.")
      .normalizeEmail(),
    body("password").isString().notEmpty().withMessage("Password is required."),
  ],
  async (request, response) => {
    const errors = validationResult(request);

    if (!errors.isEmpty()) {
      return response.status(400).json({ errors: errors.array() });
    }

    const { email, password } = request.body;

    try {
      const result = await pool.query(
        `SELECT id, name, email, address, password_hash, role
         FROM users
         WHERE email = $1`,
        [email],
      );

      const user = result.rows[0];

      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return response.status(401).json({
          message: "Invalid email or password.",
        });
      }

      const token = jwt.sign(
        { sub: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "1h" },
      );

      return response.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          address: user.address,
          role: user.role,
        },
      });
    } catch (error) {
      console.error("Login failed:", error.message);
      return response.status(500).json({
        message: "Could not log in.",
      });
    }
  },
);

module.exports = router;
