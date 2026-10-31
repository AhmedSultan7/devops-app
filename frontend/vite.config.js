import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api/products": { target: "http://localhost:3001", changeOrigin: true },
      "/api/orders": { target: "http://localhost:3002", changeOrigin: true }
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test-setup.js"
  }
});
