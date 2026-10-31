const request = require("supertest");
const { createApp } = require("../src/app");

describe("order-service", () => {
  let pool;
  let productClient;
  let app;
  let client;

  beforeEach(() => {
    client = { query: jest.fn(), release: jest.fn() };
    pool = {
      query: jest.fn(),
      connect: jest.fn().mockResolvedValue(client)
    };
    productClient = {
      reserve: jest.fn(),
      release: jest.fn().mockResolvedValue({})
    };
    app = createApp({ pool, productClient });
  });

  test("GET /health checks database connectivity", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] });
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.service).toBe("order-service");
  });

  test("POST /api/orders validates input", async () => {
    const res = await request(app).post("/api/orders")
      .send({ customerName: "Test", items: [] });
    expect(res.status).toBe(400);
    expect(productClient.reserve).not.toHaveBeenCalled();
  });

  test("POST /api/orders reserves stock and persists an order", async () => {
    productClient.reserve.mockResolvedValueOnce({
      id: 1, name: "Keyboard", price: "50.00", stock: 4
    });
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 22, customerName: "Sam", status: "confirmed", total: "100.00" }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    const res = await request(app).post("/api/orders").send({
      customerName: "Sam",
      items: [{ productId: 1, quantity: 2 }]
    });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(22);
    expect(res.body.total).toBe("100.00");
    expect(productClient.reserve).toHaveBeenCalledWith(1, 2);
    expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(client.query).toHaveBeenLastCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalled();
  });

  test("releases reserved inventory if order persistence fails", async () => {
    productClient.reserve.mockResolvedValueOnce({
      id: 1, name: "Keyboard", price: "50.00", stock: 4
    });
    client.query
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("database write failed"))
      .mockResolvedValueOnce({});

    const res = await request(app).post("/api/orders").send({
      customerName: "Sam",
      items: [{ productId: 1, quantity: 2 }]
    });

    expect(res.status).toBe(500);
    expect(productClient.release).toHaveBeenCalledWith(1, 2);
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
  });
});
