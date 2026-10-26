const express = require("express");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const pool = require("../db/pool");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get(
  "/dashboard",
  authenticateToken,
  requireRole("system_admin"),
  async (request, response) => {
    try {
      const [users, stores, ratings] = await Promise.all([
        pool.query("SELECT COUNT(*)::int AS total FROM users"),
        pool.query("SELECT COUNT(*)::int AS total FROM stores"),
        pool.query("SELECT COUNT(*)::int AS total FROM ratings"),
      ]);

      return response.json({
        totalUsers: users.rows[0].total,
        totalStores: stores.rows[0].total,
        totalRatings: ratings.rows[0].total,
      });
    } catch (error) {
      console.error("Admin dashboard failed:", error.message);
      return response
        .status(500)
        .json({ message: "Could not load dashboard." });
    }
  },
);

router.post(
  "/users",
  authenticateToken,
  requireRole("system_admin"),
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
        "Password needs an uppercase letter and a special character.",
      ),
    body("role").isIn(["system_admin", "normal_user", "store_owner"]),
  ],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
      return response.status(400).json({ errors: errors.array() });
    }

    const { name, email, address, password, role } = request.body;

    try {
      const passwordHash = await bcrypt.hash(password, 12);
      const result = await pool.query(
        `INSERT INTO users (name, email, address, password_hash, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, email, address, role`,
        [name, email, address, passwordHash, role],
      );

      return response.status(201).json({ user: result.rows[0] });
    } catch (error) {
      if (error.code === "23505") {
        return response.status(409).json({
          message: "An account with that email already exists.",
        });
      }
      console.error("Admin user creation failed:", error.message);
      return response
        .status(500)
        .json({ message: "Could not create the user." });
    }
  },
);

router.post(
  "/stores",
  authenticateToken,
  requireRole("system_admin"),
  [
    body("name")
      .trim()
      .isLength({ min: 1, max: 120 })
      .withMessage(
        "Store name is required and must be at most 120 characters.",
      ),
    body("email")
      .trim()
      .isEmail()
      .withMessage("Enter a valid store email.")
      .normalizeEmail(),
    body("address")
      .trim()
      .isLength({ min: 1, max: 400 })
      .withMessage("Address is required and must be at most 400 characters."),
    body("owner_id")
      .optional({ nullable: true })
      .isInt({ min: 1 })
      .toInt()
      .withMessage("Owner ID must be a positive number."),
  ],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
      return response.status(400).json({ errors: errors.array() });
    }

    const { name, email, address } = request.body;
    const ownerId = request.body.owner_id ?? null;

    try {
      if (ownerId !== null) {
        const owner = await pool.query("SELECT role FROM users WHERE id = $1", [
          ownerId,
        ]);

        if (!owner.rows.length || owner.rows[0].role !== "store_owner") {
          return response.status(400).json({
            message: "Owner ID must belong to a store owner.",
          });
        }
      }

      const result = await pool.query(
        `INSERT INTO stores (name, email, address, owner_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, email, address, owner_id`,
        [name, email, address, ownerId],
      );

      return response.status(201).json({ store: result.rows[0] });
    } catch (error) {
      if (error.code === "23505") {
        return response.status(409).json({
          message: "A store with that email already exists.",
        });
      }
      console.error("Store creation failed:", error.message);
      return response
        .status(500)
        .json({ message: "Could not create the store." });
    }
  },
);

module.exports = router;
