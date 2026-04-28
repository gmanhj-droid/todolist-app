const express = require("express");
const { createMockMiddleware } = require("openapi-mock-express-middleware");
const swaggerUi = require("swagger-ui-express");
const swaggerDoc = require("../swagger/swagger.json");

const app = express();

// Mock Server
app.use("/api", createMockMiddleware({ spec: "../swagger/swagger.json" }));

// Swagger UI
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc));

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Mock server is running on http://localhost:${PORT}/api`);
  console.log(`Swagger UI is available on http://localhost:${PORT}/docs`);
});
