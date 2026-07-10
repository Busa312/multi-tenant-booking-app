import { CmsApiClient } from "@booking/api-client";

const STORAGE_KEY = "booking_cms_token";

// Standalone from AuthContext so it can be imported by non-component code too;
// both read/write the same localStorage key.
export const cmsApiClient = new CmsApiClient({
  baseUrl: import.meta.env.VITE_API_URL,
  getAuthToken: () => localStorage.getItem(STORAGE_KEY),
});
