const axios = require("axios");

function createProductClient(baseURL) {
  const http = axios.create({ baseURL, timeout: 5000 });
  return {
    async reserve(productId, quantity) {
      try {
        const { data } = await http.post(`/internal/products/${productId}/reserve`, { quantity });
        return data;
      } catch (err) {
        const status = err.response?.status || 502;
        const message = err.response?.data?.error || "Product service unavailable";
        const error = new Error(message);
        error.status = status;
        throw error;
      }
    },
    async release(productId, quantity) {
      await http.post(`/internal/products/${productId}/release`, { quantity });
    }
  };
}

module.exports = { createProductClient };
