const express = require("express");
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

      response.json({
        totalUsers: users.rows[0].total,
        totalStores: stores.rows[0].total,
        totalRatings: ratings.rows[0].total,
      });
    } catch (error) {
      console.error("Admin dashboard failed:", error.message);
      response.status(500).json({ message: "Could not load dashboard." });
    }
  }
);

module.exports = router;
