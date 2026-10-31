const request = require("supertest");
const { createApp } = require("../src/app");

function makePool() {
  return {
    query: jest.fn()
  };
}

describe("product-service", () => {
  let pool;
  let app;

  beforeEach(() => {
    pool = makePool();
    app = createApp(pool);
  });

  test("GET /health checks the database", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] });
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
  });

  test("GET /api/products returns products", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, name: "Keyboard", price: "50.00", stock: 3 }] });
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Keyboard");
  });

  test("POST /api/products validates required fields", async () => {
    const res = await request(app).post("/api/products").send({ name: "", price: -1 });
    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("POST /api/products creates a valid product", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 4, name: "Mouse", price: "25.00", stock: 5 }] });
    const res = await request(app).post("/api/products")
      .send({ name: "Mouse", price: 25, stock: 5 });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(4);
  });

  test("reserve endpoint rejects invalid quantity", async () => {
    const res = await request(app).post("/internal/products/1/reserve").send({ quantity: 0 });
    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });
});
