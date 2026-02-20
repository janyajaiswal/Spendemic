# AI Financial Planner for International Students

Master's project for CPSC 597 at CSUF, Spring 2026.
Advisor: Dr. Duy Ho

## Project Goal

Build an AI-powered budgeting web app tailored to
international students, featuring time-series
forecasting (Amazon Chronos vs LSTM benchmark),
multi-currency support, and rule-based budget alerts.

## Stack

- Frontend: React + Vite (TypeScript)
- Backend: FastAPI (Python 3.11)
- Database: PostgreSQL (via AWS RDS)
- ML: Amazon Chronos (primary), LSTM (benchmark)
- Agent: LangChain (deferred to final phase)
- Cloud: AWS (Cognito, RDS, S3, CloudFront, SNS, EC2)
- Exchange Rates: ExchangeRate-API (free tier)

## Folder Structure

financial-planner/
├── frontend/ # React + Vite app
├── backend/ # FastAPI app
├── ml_models/ # Chronos + LSTM pipelines
├── docs/ # Proposal and notes
└── CLAUDE.md

## Conventions

- Python: PEP8, type hints on all functions
- TypeScript: strict mode, functional components
- API routes: all prefixed with /api/v1
- Every ML model must output MAE and RMSE metrics
- Commit after every working feature

## Current Phase

Phase 1 — Project scaffold and PostgreSQL schema
