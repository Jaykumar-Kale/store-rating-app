const express = require("express");

const app = express();
const PORT = 3000;

app.get("/api/health", (request, response) => {
  response.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
