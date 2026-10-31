require("dotenv").config();
const pool = require("./db");
const { createApp } = require("./app");
const { createProductClient } = require("./product-client");

const port = Number(process.env.PORT || 3002);
const productClient = createProductClient(process.env.PRODUCT_SERVICE_URL || "http://localhost:3001");
const server = createApp({ pool, productClient }).listen(port, "0.0.0.0", () => {
  console.log(`order-service listening on ${port}`);
});

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
