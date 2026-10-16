
const express = require("express");
const { query, param, body, validationResult } = require("express-validator");
// const { query, validationResult } = require("express-validator");
const pool = require("../db/pool");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get(
  "/",
  authenticateToken,
  requireRole("normal_user"),
  [
    query("search")
      .optional()
      .trim()
      .isLength({ max: 120 })
      .withMessage("Search must be at most 120 characters."),
  ],
  async (request, response) => {
    const errors = validationResult(request);

    if (!errors.isEmpty()) {
      return response.status(400).json({ errors: errors.array() });
    }

    const search = request.query.search || "";

    try {
      const result = await pool.query(
        `SELECT
           s.id,
           s.name,
           s.address,
           COALESCE(ROUND(AVG(all_ratings.rating)::numeric, 2), 0) AS overall_rating,
           my_rating.rating AS user_rating
         FROM stores AS s
         LEFT JOIN ratings AS all_ratings ON all_ratings.store_id = s.id
         LEFT JOIN ratings AS my_rating
           ON my_rating.store_id = s.id AND my_rating.user_id = $1
         WHERE (
           $2::text = ''
           OR s.name ILIKE '%' || $2 || '%'
           OR s.address ILIKE '%' || $2 || '%'
         )
         GROUP BY s.id, my_rating.rating
         ORDER BY s.name ASC`,
        [request.user.id, search]
      );

      return response.json({ stores: result.rows });
    } catch (error) {
      console.error("Store listing failed:", error.message);
      return response.status(500).json({
        message: "Could not load stores.",
      });
    }
  }
);

router.put(
  "/:storeId/rating",
  authenticateToken,
  requireRole("normal_user"),
  [
    param("storeId")
      .isInt({ min: 1 })
      .toInt()
      .withMessage("Store ID must be a positive number."),
    body("rating")
      .isInt({ min: 1, max: 5 })
      .toInt()
      .withMessage("Rating must be a whole number from 1 to 5."),
  ],
  async (request, response) => {
    const errors = validationResult(request);

    if (!errors.isEmpty()) {
      return response.status(400).json({ errors: errors.array() });
    }

    const storeId = request.params.storeId;
    const rating = request.body.rating;

    try {
      const result = await pool.query(
        `INSERT INTO ratings (user_id, store_id, rating)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, store_id)
         DO UPDATE SET rating = EXCLUDED.rating, updated_at = NOW()
         RETURNING id, store_id, rating, created_at, updated_at`,
        [request.user.id, storeId, rating]
      );

      return response.json({ rating: result.rows[0] });
    } catch (error) {
      if (error.code === "23503") {
        return response.status(404).json({ message: "Store not found." });
      }

      console.error("Rating submission failed:", error.message);
      return response.status(500).json({ message: "Could not save rating." });
    }
  }
);

module.exports = router;
