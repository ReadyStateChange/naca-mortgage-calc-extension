// API Configuration for NACA Calculator
// Update API_BASE_URL after deploying to Railway

const API_BASE_URL = 'https://your-app.railway.app'; // TODO: Replace with actual Railway URL after deployment

export const API_ENDPOINTS = {
  rates: `${API_BASE_URL}/api/rates`,
  msaLookup: `${API_BASE_URL}/api/msa-lookup`,
};

