const express = require("express");
const pool = require("../db/pool");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get(
  "/dashboard",
  authenticateToken,
  requireRole("store_owner"),
  async (request, response) => {
    try {
      const result = await pool.query(
        `SELECT
           s.id,
           s.name,
           s.address,
           COALESCE(ROUND(AVG(r.rating)::numeric, 2), 0) AS average_rating,
           COALESCE(
             json_agg(
               json_build_object(
                 'userId', u.id,
                 'name', u.name,
                 'email', u.email,
                 'rating', r.rating,
                 'submittedAt', r.created_at
               )
               ORDER BY u.name
             ) FILTER (WHERE r.id IS NOT NULL),
             '[]'::json
           ) AS ratings
         FROM stores AS s
         LEFT JOIN ratings AS r ON r.store_id = s.id
         LEFT JOIN users AS u ON u.id = r.user_id
         WHERE s.owner_id = $1
         GROUP BY s.id
         ORDER BY s.name ASC`,
        [request.user.id]
      );

      return response.json({ stores: result.rows });
    } catch (error) {
      console.error("Owner dashboard failed:", error.message);
      return response.status(500).json({
        message: "Could not load owner dashboard.",
      });
    }
  }
);

module.exports = router;
