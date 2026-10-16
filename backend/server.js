require("dotenv").config();

const ownerRoutes = require("./routes/owner");
const storeRoutes = require("./routes/stores");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const express = require("express");
const pool = require("./db/pool");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/stores", storeRoutes);
app.use("/api/owner", ownerRoutes);

app.get("/api/health", (request, response) => {
  response.json({ status: "ok" });
});

app.get("/api/db-health", async (request, response) => {
  try {
    const result = await pool.query("SELECT NOW() AS current_time");

    response.json({
      status: "ok",
      databaseTime: result.rows[0].current_time,
    });
  } catch (error) {
    console.error("Database health check failed:", error.message);
    response.status(500).json({
      status: "error",
      message: "Database connection failed",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
