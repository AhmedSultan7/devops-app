require("dotenv").config();
const pool = require("./db");
const { createApp } = require("./app");

const port = Number(process.env.PORT || 3001);
const server = createApp(pool).listen(port, "0.0.0.0", () => {
  console.log(`product-service listening on ${port}`);
});

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
