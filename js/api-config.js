// API Configuration for NACA Calculator
// Railway production base URL

const API_BASE_URL =
  "https://naca-mortgage-calc-extension-production.up.railway.app";

export const API_ENDPOINTS = {
  rates: `${API_BASE_URL}/api/rates`,
  msaLookup: `${API_BASE_URL}/api/msa-lookup`,
};
