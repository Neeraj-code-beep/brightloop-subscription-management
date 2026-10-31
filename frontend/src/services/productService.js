import apiClient from './apiClient.js';

export const productService = {
  async getProducts(params = {}) {
    const res = await apiClient.get('/products', { params });
    return res.data.data;
  },

  async getProductById(id) {
    const res = await apiClient.get(`/products/${id}`);
    return res.data.data;
  },

  async createProduct(data) {
    const res = await apiClient.post('/products', data);
    return res.data.data;
  },

  async updateProduct(id, data) {
    const res = await apiClient.patch(`/products/${id}`, data);
    return res.data.data;
  },

  async updateProductStatus(id, isActive) {
    const res = await apiClient.patch(`/products/${id}/status`, { isActive });
    return res.data.data;
  },

  async calculatePrice(id, variantIds = []) {
    const res = await apiClient.post(`/products/${id}/calculate-price`, { variantIds });
    return res.data.data;
  },

  async createVariant(productId, data) {
    const res = await apiClient.post(`/products/${productId}/variants`, data);
    return res.data.data;
  },

  async updateVariant(productId, variantId, data) {
    const res = await apiClient.patch(`/products/${productId}/variants/${variantId}`, data);
    return res.data.data;
  },

  async updateVariantStatus(productId, variantId, isActive) {
    const res = await apiClient.patch(`/products/${productId}/variants/${variantId}/status`, { isActive });
    return res.data.data;
  },
};

export default productService;
