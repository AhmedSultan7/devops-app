import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

afterEach(() => cleanup());

describe("Mini Shop", () => {
  beforeEach(() => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 1, name: "Mechanical Keyboard", description: "Tactile switches", price: "79.99", stock: 4 }
        ]
      })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });
  });

  it("loads and displays products", async () => {
    render(<App />);
    expect(await screen.findByText("Mechanical Keyboard")).toBeInTheDocument();
    expect(screen.getByText("$79.99")).toBeInTheDocument();
  });

  it("shows an empty state when no products match search", async () => {
    render(<App />);
    await screen.findByText("Mechanical Keyboard");
    await userEvent.type(screen.getByLabelText("Search products"), "not-a-product");
    expect(screen.getByText("No products found.")).toBeInTheDocument();
  });
});
