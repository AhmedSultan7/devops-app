const express = require("express");

function createApp({ pool, productClient }) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.status(200).json({ status: "healthy", service: "order-service" });
    } catch {
      res.status(503).json({ status: "unhealthy", service: "order-service" });
    }
  });

  app.get("/api/orders", async (_req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT o.id, o.customer_name AS "customerName", o.status, o.total,
                o.created_at AS "createdAt",
                COALESCE(json_agg(json_build_object(
                  'productId', oi.product_id, 'productName', oi.product_name,
                  'unitPrice', oi.unit_price, 'quantity', oi.quantity
                )) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
         FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
         GROUP BY o.id ORDER BY o.created_at DESC`
      );
      res.json(rows);
    } catch (err) { next(err); }
  });

  app.get("/api/orders/:id", async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT o.id, o.customer_name AS "customerName", o.status, o.total,
                o.created_at AS "createdAt",
                COALESCE(json_agg(json_build_object(
                  'productId', oi.product_id, 'productName', oi.product_name,
                  'unitPrice', oi.unit_price, 'quantity', oi.quantity
                )) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
         FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
         WHERE o.id = $1 GROUP BY o.id`,
        [req.params.id]
      );
      if (!rows[0]) return res.status(404).json({ error: "Order not found" });
      res.json(rows[0]);
    } catch (err) { next(err); }
  });

  app.post("/api/orders", async (req, res, next) => {
    const { customerName, items } = req.body || {};
    if (typeof customerName !== "string" || !customerName.trim() ||
        !Array.isArray(items) || items.length === 0 ||
        items.some(item => !Number.isInteger(Number(item.productId)) ||
          Number(item.productId) <= 0 || !Number.isInteger(Number(item.quantity)) ||
          Number(item.quantity) <= 0)) {
      return res.status(400).json({
        error: "customerName and at least one item with positive productId and quantity are required"
      });
    }

    const aggregated = new Map();
    for (const item of items) {
      const id = Number(item.productId);
      aggregated.set(id, (aggregated.get(id) || 0) + Number(item.quantity));
    }

    const reservations = [];
    try {
      let total = 0;
      const orderItems = [];
      for (const [productId, quantity] of aggregated.entries()) {
        const product = await productClient.reserve(productId, quantity);
        reservations.push({ productId, quantity });
        const unitPrice = Number(product.price);
        total += unitPrice * quantity;
        orderItems.push({
          productId, productName: product.name, unitPrice, quantity
        });
      }

      const client = await pool.connect();
      let order;
      try {
        await client.query("BEGIN");
        const inserted = await client.query(
          "INSERT INTO orders (customer_name, total) VALUES ($1, $2) RETURNING id, customer_name AS \"customerName\", status, total, created_at AS \"createdAt\"",
          [customerName.trim(), total.toFixed(2)]
        );
        order = inserted.rows[0];
        for (const item of orderItems) {
          await client.query(
            `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity)
             VALUES ($1, $2, $3, $4, $5)`,
            [order.id, item.productId, item.productName, item.unitPrice, item.quantity]
          );
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }

      res.status(201).json({
        ...order,
        items: orderItems
      });
    } catch (err) {
      for (const reservation of reservations.reverse()) {
        try { await productClient.release(reservation.productId, reservation.quantity); }
        catch (releaseErr) { console.error("Inventory compensation failed:", releaseErr.message); }
      }
      if (err.status) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  });

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

module.exports = { createApp };
