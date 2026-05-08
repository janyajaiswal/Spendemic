# AI Financial Planner for International Students

A comprehensive AI-powered budgeting web application designed specifically for international students, featuring advanced time-series forecasting, multi-currency support, and intelligent budget alerts.

## 🎓 Academic Project

**Course**: CPSC 597 - Master's Project
**Institution**: California State University, Fullerton
**Semester**: Spring 2026
**Advisor**: Dr. Duy Ho

## 🎯 Project Overview

This application helps international students manage their finances effectively by:

- **Time-Series Forecasting**: Predicts future expenses using Amazon Chronos (primary, local) and Prophet by Meta (hosted fallback)
- **Multi-Currency Support**: Handles multiple currencies with real-time exchange rates
- **Budget Alerts**: Rule-based notifications for overspending and budget insights
- **User Authentication**: Secure login via AWS Cognito
- **Cloud Infrastructure**: Fully deployed on AWS (RDS, S3, CloudFront, EC2, SNS)

## 🏗️ Architecture

### Tech Stack

- **Frontend**: React + Vite with TypeScript
- **Backend**: FastAPI (Python 3.11)
- **Database**: PostgreSQL (AWS RDS)
- **ML Models**: Amazon Chronos (primary, local), Prophet by Meta (hosted fallback)
- **AI Agent**: LangChain (deferred to final phase)
- **Cloud**: AWS (Cognito, RDS, S3, CloudFront, SNS, EC2)
- **Exchange Rates**: ExchangeRate-API (free tier)

### Folder Structure

```
financial-planner/
├── frontend/          # React + Vite TypeScript app
├── backend/           # FastAPI application
├── ml_models/         # Chronos and Prophet forecasting models
└── docs/              # Project documentation and proposal
```

## 🚀 Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your configuration
uvicorn main:app --reload
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Database Setup

```bash
# Create PostgreSQL database
createdb financial_planner

# Run migrations (once implemented)
cd backend
alembic upgrade head
```

## 📊 ML Models

### Amazon Chronos

Primary forecasting model for expense prediction. Outputs MAE and RMSE metrics.

### Prophet (Meta)

Hosted fallback model — runs on the production server without a GPU. Decomposes spending into trend + semester seasonality + covariate effects. Designed for small datasets (months, not years), making it ideal for student spending data. Activates automatically when Chronos is unavailable.

## 📝 Development Conventions

- **Python**: PEP8 compliant, type hints on all functions
- **TypeScript**: Strict mode enabled, functional components
- **API Routes**: All prefixed with `/api/v1`
- **ML Metrics**: Every model must output MAE and RMSE
- **Version Control**: Commit after every working feature

## 🔗 API Endpoints

- `GET /`: API information
- `GET /api/v1/health`: Health check endpoint
- More endpoints to be documented as developed

## 📅 Development Phases

### Phase 1: Project Scaffold & PostgreSQL Schema ✅

- Set up project structure
- Initialize frontend and backend
- Design database schema

### Phase 2: Core Features (In Progress)

- User authentication (AWS Cognito)
- Transaction management
- Budget tracking

### Phase 3: ML Integration

- Implement Chronos forecasting
- Implement Prophet hosted fallback
- Covariate-aware prediction (rent, tuition, breaks, income)

### Phase 4: Advanced Features

- Multi-currency support
- Budget alerts and notifications
- LangChain AI agent

### Phase 5: Deployment

- AWS infrastructure setup
- CI/CD pipeline
- Production deployment

## 📄 License

This project is developed for academic purposes at California State University, Fullerton.

## 👤 Author

Janya Jaiswal  
Master's Student, Computer Science  
California State University, Fullerton

---

**Note**: This project is under active development as part of CPSC 597 coursework.
