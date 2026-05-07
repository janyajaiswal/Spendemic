// Single source of truth for API URLs.
// Set VITE_API_URL in Vercel environment variables to your Render backend URL.

export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
export const API = API_BASE + '/api/v1';

// Forecast URL is fetched at runtime from Render (/api/v1/config).
// This means you only need to update the FORECAST_API_URL env var on Render
// when the ngrok tunnel URL changes — no Vercel rebuild needed.
let _forecastBase: string | null = null;

export async function getForecastAPI(): Promise<string> {
  if (_forecastBase) return _forecastBase;
  try {
    const res = await fetch(`${API_BASE}/api/v1/config`);
    const data = await res.json();
    if (data.forecast_url) {
      _forecastBase = data.forecast_url + '/api/v1';
      return _forecastBase;
    }
  } catch {
    // fall through to local default
  }
  _forecastBase = 'http://localhost:8000/api/v1';
  return _forecastBase;
}
