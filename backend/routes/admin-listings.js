const express = require("express");
const { query, validationResult } = require("express-validator");
const pool = require("../db/pool");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get(
  "/stores",
  authenticateToken,
  requireRole("system_admin"),
  [
    query("name").optional().trim().isLength({ max: 120 }),
    query("email").optional().trim().isLength({ max: 255 }),
    query("address").optional().trim().isLength({ max: 400 }),
    query("sortBy").optional().isIn(["name", "email", "address", "rating"]),
    query("sortOrder").optional().isIn(["asc", "desc"]),
  ],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
      return response.status(400).json({ errors: errors.array() });
    }

    const name = request.query.name || "";
    const email = request.query.email || "";
    const address = request.query.address || "";
    const sortBy = request.query.sortBy || "name";
    const direction = request.query.sortOrder === "desc" ? "DESC" : "ASC";
    const sortColumn = {
      name: "s.name",
      email: "s.email",
      address: "s.address",
      rating: "rating",
    }[sortBy];

    try {
      const result = await pool.query(
        `SELECT s.id, s.name, s.email, s.address,
                COALESCE(ROUND(AVG(r.rating)::numeric, 2), 0) AS rating
         FROM stores s
         LEFT JOIN ratings r ON r.store_id = s.id
         WHERE s.name ILIKE '%' || $1 || '%'
           AND s.email ILIKE '%' || $2 || '%'
           AND s.address ILIKE '%' || $3 || '%'
         GROUP BY s.id
         ORDER BY ${sortColumn} ${direction}, s.id ASC`,
        [name, email, address]
      );
      return response.json({ stores: result.rows });
    } catch (error) {
      console.error("Admin store listing failed:", error.message);
      return response.status(500).json({ message: "Could not load stores." });
    }
  }
);

router.get(
  "/users",
  authenticateToken,
  requireRole("system_admin"),
  [
    query("name").optional().trim().isLength({ max: 60 }),
    query("email").optional().trim().isLength({ max: 255 }),
    query("address").optional().trim().isLength({ max: 400 }),
    query("role")
      .optional()
      .isIn(["system_admin", "normal_user", "store_owner"]),
    query("sortBy").optional().isIn(["name", "email", "address", "role", "rating"]),
    query("sortOrder").optional().isIn(["asc", "desc"]),
  ],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
      return response.status(400).json({ errors: errors.array() });
    }

    const name = request.query.name || "";
    const email = request.query.email || "";
    const address = request.query.address || "";
    const role = request.query.role || "";
    const sortBy = request.query.sortBy || "name";
    const direction = request.query.sortOrder === "desc" ? "DESC" : "ASC";
    const sortColumn = {
      name: "u.name",
      email: "u.email",
      address: "u.address",
      role: "u.role",
      rating: "rating",
    }[sortBy];

    try {
      const result = await pool.query(
        `SELECT u.id, u.name, u.email, u.address, u.role,
                CASE WHEN u.role = 'store_owner'
                     THEN COALESCE(ROUND(AVG(r.rating)::numeric, 2), 0)
                     ELSE NULL END AS rating
         FROM users u
         LEFT JOIN stores s ON s.owner_id = u.id
         LEFT JOIN ratings r ON r.store_id = s.id
         WHERE u.name ILIKE '%' || $1 || '%'
           AND u.email ILIKE '%' || $2 || '%'
           AND u.address ILIKE '%' || $3 || '%'
           AND ($4 = '' OR u.role = $4)
         GROUP BY u.id
         ORDER BY ${sortColumn} ${direction} NULLS LAST, u.id ASC`,
        [name, email, address, role]
      );
      return response.json({ users: result.rows });
    } catch (error) {
      console.error("Admin user listing failed:", error.message);
      return response.status(500).json({ message: "Could not load users." });
    }
  }
);

module.exports = router;