const express = require("express");

function createApp(pool) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.status(200).json({ status: "healthy", service: "product-service" });
    } catch {
      res.status(503).json({ status: "unhealthy", service: "product-service" });
    }
  });

  app.get("/api/products", async (_req, res, next) => {
    try {
      const { rows } = await pool.query(
        "SELECT id, name, description, price, stock, image_url AS \"imageUrl\" FROM products ORDER BY id"
      );
      res.json(rows);
    } catch (err) { next(err); }
  });

  app.get("/api/products/:id", async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        "SELECT id, name, description, price, stock, image_url AS \"imageUrl\" FROM products WHERE id = $1",
        [req.params.id]
      );
      if (!rows[0]) return res.status(404).json({ error: "Product not found" });
      res.json(rows[0]);
    } catch (err) { next(err); }
  });

  app.post("/api/products", async (req, res, next) => {
    const { name, description = "", price, stock = 0, imageUrl = "" } = req.body || {};
    if (typeof name !== "string" || !name.trim() ||
        !Number.isFinite(Number(price)) || Number(price) < 0 ||
        !Number.isInteger(Number(stock)) || Number(stock) < 0 ||
        typeof description !== "string" || typeof imageUrl !== "string") {
      return res.status(400).json({ error: "Valid name, non-negative price and non-negative integer stock are required" });
    }
    try {
      const { rows } = await pool.query(
        `INSERT INTO products (name, description, price, stock, image_url)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, description, price, stock, image_url AS "imageUrl"`,
        [name.trim(), description, Number(price), Number(stock), imageUrl]
      );
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  });

  app.put("/api/products/:id", async (req, res, next) => {
    const allowed = ["name", "description", "price", "stock", "imageUrl"];
    const keys = Object.keys(req.body || {});
    if (!keys.length || keys.some(key => !allowed.includes(key))) {
      return res.status(400).json({ error: "Provide one or more supported product fields" });
    }
    const { name, description, price, stock, imageUrl } = req.body;
    if ((name !== undefined && (typeof name !== "string" || !name.trim())) ||
        (description !== undefined && typeof description !== "string") ||
        (price !== undefined && (!Number.isFinite(Number(price)) || Number(price) < 0)) ||
        (stock !== undefined && (!Number.isInteger(Number(stock)) || Number(stock) < 0)) ||
        (imageUrl !== undefined && typeof imageUrl !== "string")) {
      return res.status(400).json({ error: "Invalid product field value" });
    }
    const mapping = { name, description, price, stock, imageUrl };
    const columns = { name: "name", description: "description", price: "price", stock: "stock", imageUrl: "image_url" };
    const sets = [];
    const values = [];
    for (const key of keys) {
      values.push(key === "price" ? Number(mapping[key]) : key === "stock" ? Number(mapping[key]) : mapping[key]);
      sets.push(`${columns[key]} = $${values.length}`);
    }
    values.push(req.params.id);
    try {
      const { rows } = await pool.query(
        `UPDATE products SET ${sets.join(", ")}, updated_at = NOW()
         WHERE id = $${values.length}
         RETURNING id, name, description, price, stock, image_url AS "imageUrl"`,
        values
      );
      if (!rows[0]) return res.status(404).json({ error: "Product not found" });
      res.json(rows[0]);
    } catch (err) { next(err); }
  });

  app.delete("/api/products/:id", async (req, res, next) => {
    try {
      const result = await pool.query("DELETE FROM products WHERE id = $1", [req.params.id]);
      if (!result.rowCount) return res.status(404).json({ error: "Product not found" });
      res.status(204).end();
    } catch (err) { next(err); }
  });

  // Internal endpoints used by the order service to reserve/release inventory.
  app.post("/internal/products/:id/reserve", async (req, res, next) => {
    const quantity = Number(req.body?.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ error: "Quantity must be a positive integer" });
    }
    try {
      const { rows } = await pool.query(
        `UPDATE products SET stock = stock - $1, updated_at = NOW()
         WHERE id = $2 AND stock >= $1
         RETURNING id, name, price, stock`,
        [quantity, req.params.id]
      );
      if (!rows[0]) {
        const exists = await pool.query("SELECT id FROM products WHERE id = $1", [req.params.id]);
        if (!exists.rows[0]) return res.status(404).json({ error: "Product not found" });
        return res.status(409).json({ error: "Insufficient stock" });
      }
      res.json(rows[0]);
    } catch (err) { next(err); }
  });

  app.post("/internal/products/:id/release", async (req, res, next) => {
    const quantity = Number(req.body?.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ error: "Quantity must be a positive integer" });
    }
    try {
      const { rows } = await pool.query(
        `UPDATE products SET stock = stock + $1, updated_at = NOW()
         WHERE id = $2 RETURNING id, stock`,
        [quantity, req.params.id]
      );
      if (!rows[0]) return res.status(404).json({ error: "Product not found" });
      res.json(rows[0]);
    } catch (err) { next(err); }
  });

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

module.exports = { createApp };
