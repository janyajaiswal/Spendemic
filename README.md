# Spendemic — AI Financial Planner for International Students

A full-stack AI-powered financial planning web application built specifically for international students in the United States. Spendemic combines time-series machine learning forecasting, multi-currency budgeting, visa compliance tracking, and an AI chat assistant into a single cohesive tool.

**Live App**: [spendemic-rosy.vercel.app](https://spendemic-rosy.vercel.app)

---

## Academic Context

| | |
|---|---|
| **Course** | CPSC 597 — Master's Project |
| **Institution** | California State University, Fullerton |
| **Semester** | Spring 2026 |
| **Advisor** | Dr. Duy Ho |
| **Author** | Janya Jaiswal |

---

## Features

### Core Financial Tools
- **Transaction Management** — Log income and expenses with 18 categories, 45 currencies, live conversion preview, receipt upload, and recurring transaction support (daily through annually)
- **Budget Tracking** — Set weekly or monthly spending limits per category with real-time utilization and color-coded progress bars; sidebar bell alerts poll every 20 seconds and notify when budgets are approaching or exceeded
- **Savings Goals** — Track savings targets with optional deadlines; funding only permitted when current net savings are positive
- **CSV / Excel Import** — Three-step wizard with automatic column detection, date format disambiguation, and LLM-assisted category inference via Claude Haiku
- **What-If Scenario Planner** — Simulate hypothetical transactions without saving them to see the projected impact on monthly net

### AI Forecasting
- **Amazon Chronos-2** (primary) — T5-small transformer model producing probabilistic 60% confidence interval forecasts; runs locally with ngrok tunnel for GPU access
- **Meta Prophet** (production fallback) — Decomposable seasonal time-series model; hosted on Render, activates automatically when Chronos is unavailable
- **Statistical fallback** — Exponential smoothing (α=0.35) with clamped linear trend; requires no external dependencies
- **17 covariates** — Rent, food, tuition, scholarship, travel, health insurance, income, work hours, academic break flags, exchange rates
- **Cold-start support** — Synthesizes a forecast anchor from setup data for users with no transaction history
- **Covariate transparency** — Every forecast response includes a data sources panel showing where each input came from

### Additional Features
- **Multi-currency support** — 45 currencies with ExchangeRate-API (1-hour DB cache, 45-currency static fallback)
- **Visa & Work compliance** — Log weekly shift hours per job, track against F-1/J-1 work-hour caps, view visa rules
- **AI Chat Assistant** — Claude Haiku can add transactions, create budgets and goals, and navigate pages from natural language
- **Community FAQ** — Submit questions, post community answers, three-layer content moderation; moderator approval for `@fullerton.edu` accounts
- **Settings** — Profile, address, academic info, graduation date, loan details, avatar upload, job management with hours logging
- **Light / Dark mode** — Persisted to localStorage, toggled from the sidebar
- **8-step Onboarding Wizard** — Collects income, currencies, cost estimates, and graduation date before first access

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, React Router v7, Recharts, Lucide React, Vite 7 |
| Backend | FastAPI, Python 3.11, SQLAlchemy, PostgreSQL, Alembic, Pydantic |
| Authentication | Google OAuth 2.0 + email/OTP with JWT session revocation |
| Primary ML | Amazon Chronos-2 (T5-small transformer, HuggingFace) |
| Secondary ML | Meta Prophet (decomposable time-series) |
| AI Assistant | Claude Haiku via Anthropic API |
| Exchange Rates | ExchangeRate-API with PostgreSQL cache |
| Frontend Hosting | Vercel |
| Backend Hosting | Render (free tier) |
| Database | PostgreSQL (Neon, external managed) |
| Local ML Serving | ngrok tunnel to local machine |

---

## Project Structure

```
financial-planner/
├── frontend/                   # React + Vite TypeScript SPA
│   ├── src/
│   │   ├── pages/              # Landing, Auth, Onboarding, Dashboard,
│   │   │                       # Transactions, Budgets, Reports, Settings, FAQ
│   │   ├── components/         # Sidebar, ChatWidget, MoneyPlant, InfoTooltip
│   │   ├── contexts/           # AuthContext (Google OAuth + JWT)
│   │   ├── styles/             # Per-page CSS modules + global index.css
│   │   ├── lib/api.ts          # API base URL helpers
│   │   └── types/              # Shared TypeScript interfaces
│   └── vercel.json             # SPA rewrite rule for Vercel deployment
│
├── backend/                    # FastAPI application
│   ├── routers/                # One file per resource:
│   │   ├── auth.py             #   Google OAuth, OTP email signup, JWT
│   │   ├── users.py            #   Profile, avatar, loan projection
│   │   ├── transactions.py     #   CRUD, recurring materialization, receipts
│   │   ├── budgets.py          #   Category budgets, live spend calculation
│   │   ├── goals.py            #   Savings goals, net-surplus funding
│   │   ├── forecast.py         #   Chronos / Prophet / statistical pipeline
│   │   ├── forecast_context.py #   Per-month covariate setup
│   │   ├── exchange_rates.py   #   Rates API with DB cache
│   │   ├── jobs.py             #   Job management, hours logging
│   │   ├── alerts.py           #   Budget utilization alerts (computed, no writes)
│   │   ├── chat.py             #   Claude Haiku assistant
│   │   ├── import_transactions.py # CSV/Excel import with LLM inference
│   │   └── faq.py              #   Community Q&A with moderation
│   ├── models.py               # SQLAlchemy ORM models + all enums
│   ├── schemas.py              # Pydantic request/response schemas
│   ├── database.py             # SQLAlchemy engine and session
│   ├── main.py                 # FastAPI app, CORS, Chronos background load
│   ├── faq_data.json           # Static FAQ seed data
│   ├── requirements.txt        # Full deps including torch + chronos
│   ├── requirements-prod.txt   # Render deps (no torch/chronos)
│   └── Procfile                # Render web process definition
│
├── ml_models/                  # ML model code
│   ├── chronos_model.py        # Chronos-2 wrapper, covariate anchors, band capping
│   └── lstm_model.py           # Stub (Prophet invoked from forecast router)
│
└── start.sh                    # Local dev launcher: backend + ngrok tunnel
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 14+ (local) or a managed instance (Neon, Supabase, etc.)
- ngrok account (free) — only needed to run Chronos-2 locally

### 1. Clone and set up the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt    # includes torch + chronos (~500 MB first run)
```

Copy and fill in environment variables:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SECRET_KEY` | Yes | JWT signing secret (generate with `openssl rand -hex 32`) |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `SMTP_HOST` | Yes | SMTP server (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | Yes | SMTP port (e.g. `587`) |
| `SMTP_USER` | Yes | Sender email address |
| `SMTP_PASSWORD` | Yes | SMTP app password |
| `EXCHANGE_RATE_API_KEY` | Recommended | ExchangeRate-API key; falls back to static rates if absent |
| `ANTHROPIC_API_KEY` | Recommended | Claude Haiku — required for chat assistant and import classification |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins (default: `http://localhost:5173`) |
| `FORECAST_API_URL` | No | Public URL of the local ML server (set automatically by `start.sh`) |
| `DEBUG` | No | `True` to print OTPs to console instead of sending email |

Run database migrations and start the server:

```bash
alembic upgrade head
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`. Swagger docs at `http://localhost:8000/api/docs`.

### 2. Set up the frontend

```bash
cd frontend
npm install
```

Create a `.env.local` file:

```
VITE_API_URL=http://localhost:8000
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

Start the dev server:

```bash
npm run dev        # http://localhost:5173
```

### 3. Run the database

```bash
# Local PostgreSQL
createdb financial_planner
# Then set DATABASE_URL=postgresql://user:password@localhost:5432/financial_planner
```

### 4. Run Chronos-2 locally with ngrok (optional — improves forecast quality)

```bash
# From the project root, after completing backend setup:
./start.sh
```

This script:
1. Kills any existing process on port 8000
2. Activates the Python venv and starts the FastAPI backend (Chronos-2 loads in the background over ~25 seconds)
3. Opens an ngrok tunnel on a static domain
4. Prints the tunnel URL and the Vercel app URL

The ngrok tunnel URL must be set as `FORECAST_API_URL` in the Render backend environment so the hosted app can reach the local Chronos model. The script prints a reminder if the URL has changed.

---

## Deployment

The application uses a split deployment model:

| Component | Host | Notes |
|---|---|---|
| Frontend | Vercel | Static SPA with `vercel.json` rewrite rule |
| Backend | Render (free tier) | `requirements-prod.txt` excludes torch/chronos; Prophet is used |
| Database | Neon (PostgreSQL) | External managed, connected via `DATABASE_URL` |
| Chronos-2 model | Local machine + ngrok | Optional; improves forecast quality when running |

**Deploy backend to Render**: connect the repository, set the environment variables listed above, set the build command to `pip install -r requirements-prod.txt` and the start command to `uvicorn main:app --host 0.0.0.0 --port $PORT`.

**Deploy frontend to Vercel**: connect the repository, set the root directory to `frontend`, and add `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID` as environment variables.

---

## API Overview

All endpoints are prefixed with `/api/v1`. Full interactive documentation is available at `/api/docs` (Swagger UI) or `/api/redoc`.

| Router | Prefix | Key Endpoints |
|---|---|---|
| Auth | `/auth` | `POST /google`, `POST /register/request`, `POST /register/verify`, `POST /signin`, `POST /logout` |
| Users | `/users` | `GET/PUT /me`, `POST /me/avatar`, `GET /me/loan-projection`, `PATCH /me/notification-preferences` |
| Transactions | `/transactions` | `GET/POST /`, `PUT/DELETE /{id}`, `POST /{id}/receipt`, `GET /summary`, `GET /weekly-summary`, `GET /export` |
| Import | `/transactions/import` | `POST /preview`, `POST /confirm` |
| Budgets | `/budgets` | `GET/POST /`, `PUT/DELETE /{id}`, `GET /export` |
| Goals | `/goals` | `GET/POST /`, `POST /{id}/fund`, `GET /net-savings` |
| Forecast | `/forecast` | `GET /` (from DB), `POST /` (inline), `GET /to-graduation` |
| Forecast Context | `/forecast-context` | `GET/DELETE /`, `GET/PUT /{year}/{month}`, `POST /bulk-copy` |
| Exchange Rates | `/exchange-rates` | `GET /{base_currency}` |
| Jobs | `/jobs` | `GET/POST /`, `PUT/DELETE /{id}`, `POST /{id}/hours`, `GET /{id}/hours`, `GET /total-income` |
| Alerts | `/alerts` | `GET /` (computed, no writes) |
| Chat | `/chat` | `POST /` |
| FAQ | `/faq` | `GET/POST /submit`, `POST /questions/{id}/answer`, `GET /my-submissions`, `PATCH /submissions/{id}/review` |

---

## ML Forecasting Models

### Amazon Chronos-2 (Primary)

- **Architecture**: T5-small transformer fine-tuned on time-series data
- **Output**: Probabilistic quantiles `[0.2, 0.5, 0.8]` — 60% confidence interval
- **Covariates**: 17 student-specific fields translated into synthetic spending anchors appended to historical context
- **Cold-start**: Synthesizes a history anchor from `rent + food + tuition − scholarship + travel` when no transactions exist
- **Post-processing**: Outlier clipping (3× median cap), confidence band capping (`2.0–2.5×` median upper, `15–30%` lower floor)
- **Weekly scaling**: 52/12 = 4.333 weeks per month; rent applied only on the ISO week containing the 1st of month
- **Requires**: PyTorch, CUDA optional (CPU float32 fallback), ~500 MB model weights

### Meta Prophet (Production Fallback)

- **Architecture**: Decomposable additive model — piecewise trend + semester seasonality + calendar effects
- **Strengths**: Works well with limited data (2–6 months); interpretable component breakdown
- **Deployment**: Included in `requirements-prod.txt`; activates on Render when Chronos is unavailable
- **API selection**: Frontend passes `model=lstm` to route to this model (legacy parameter name)

### Statistical Fallback

- **Algorithm**: Exponential smoothing (α=0.35) + linear trend from first-third vs. last-third history average, clamped to ±10%/month
- **Use case**: Activates when neither Chronos nor Prophet is available
- **No external dependencies** required

---

## Database Schema (Key Tables)

| Table | Purpose |
|---|---|
| `users` | Profile, currencies, graduation date, visa type, loan details, break schedule |
| `user_sessions` | JWT session tracking with JTI-based revocation |
| `transactions` | Income and expense ledger; stores original currency + USD normalized amount |
| `budgets` | Category spending limits (weekly or monthly) |
| `goals` | Savings targets with progress tracking |
| `forecast_context` | Per-month ML covariates (rent, income, tuition, breaks, etc.) |
| `exchange_rate_cache` | 1-hour cached forex rates (Numeric 18,8 precision) |
| `jobs` | Employment records with hourly rate and hours per week |
| `job_hours_log` | Weekly hours worked per job |
| `faq_submissions` | Community questions with moderation status |
| `faq_answers` | Community answers per approved question |

---

## Development Notes

- All Python functions use type hints
- API routes follow REST conventions, all prefixed `/api/v1`
- TypeScript strict mode enabled on the frontend
- No frontend animation library — all transitions are pure CSS keyframes
- `tsc --noEmit` should be run before pushing to catch type errors before Vercel deployment
- The `start.sh` script handles the full local ML stack in one command

---

## License

Developed for academic purposes at California State University, Fullerton. Not licensed for commercial use.
