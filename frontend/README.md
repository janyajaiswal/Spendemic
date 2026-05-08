# Spendemic — Frontend

React 19 + TypeScript + Vite single-page application. See the root [README](../README.md) for full project documentation, setup instructions, and architecture overview.

## Local Development

```bash
npm install
npm run dev        # http://localhost:5173
```

## Build

```bash
npm run build      # output to dist/
npm run preview    # preview production build locally
```

## Environment Variables

Create a `.env.local` file in this directory:

```
VITE_API_URL=http://localhost:8000
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

For production (Vercel), set these as environment variables in the Vercel dashboard.

## Key Dependencies

| Package | Purpose |
|---|---|
| react 19 | UI framework |
| react-router-dom 7 | Client-side routing |
| recharts 3 | Chart library (SVG-based, composable) |
| @react-oauth/google | Google OAuth sign-in |
| lucide-react | Icon set |
| @vercel/analytics | Page view analytics |
| vite 7 | Build tool and dev server |
| typescript 5.9 | Static type checking |

## Deployment

Deployed on Vercel. The `vercel.json` at this directory level rewrites all paths to `index.html` to support client-side routing.
