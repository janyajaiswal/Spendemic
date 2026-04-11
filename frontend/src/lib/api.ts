// Single source of truth for API URLs.
// Set VITE_API_URL in Vercel environment variables to your Render backend URL.
// Set VITE_FORECAST_API_URL to http://localhost:8000 (local machine runs Chronos-2).

export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
export const API = API_BASE + '/api/v1';

// Forecast (Chronos-2) stays on local machine — falls back gracefully if unavailable.
export const FORECAST_API = (import.meta.env.VITE_FORECAST_API_URL ?? 'http://localhost:8000') + '/api/v1';