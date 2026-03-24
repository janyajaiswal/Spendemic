"""
Forecast router — data pipeline + Chronos-2 inference.

Endpoints
---------
POST /api/v1/forecast               → run forecast with inline month data (primary)
GET  /api/v1/forecast               → run forecast using pre-saved ForecastContext rows
GET  /api/v1/forecast/to-graduation → forecast through the user's graduation date

Cold-start
----------
If zero transaction history exists, a single anchor month is synthesized from
the user's dollar amounts (rent + tuition_due - scholarship + travel_cost).
No assumed overheads. If the result is 0 the user is prompted to fill in
Forecast Setup first.
"""
from __future__ import annotations

import os
import sys
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from database import get_db
from models import Transaction, ForecastContext, TransactionTypeEnum, User
from routers.auth import get_current_user
from schemas import ForecastRequest, ForecastResponse

_ML_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "ml_models"))
if _ML_PATH not in sys.path:
    sys.path.insert(0, _ML_PATH)

import chronos_model  # noqa: E402

router = APIRouter(prefix="/api/v1/forecast", tags=["forecast"])


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("", response_model=ForecastResponse)
def run_forecast_inline(
    body: ForecastRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ForecastResponse:
    """
    Run a forecast by supplying future-month data directly in the request body.
    No pre-saved ForecastContext rows required.

    Minimum body (cold-start):
    ```json
    {
      "months": [
        {"year": 2026, "month": 4, "rent": 900},
        {"year": 2026, "month": 5, "rent": 900},
        {"year": 2026, "month": 6, "rent": 900, "is_summer_break": true}
      ]
    }
    ```
    """
    ordered = sorted(body.months, key=lambda m: (m.year, m.month))
    prediction_months = len(ordered)
    history, monthly_labels = _query_history(current_user.id, db, limit=body.history_months)
    cold_start = False

    future_covariates = [
        {k: v for k, v in {
            "rent":                 m.rent,
            "tuition_due":          m.tuition_due,
            "scholarship_received": m.scholarship_received,
            "travel_home":          int(m.travel_home),
            "travel_cost":          m.travel_cost or 0.0,
            "is_summer_break":      int(m.is_summer_break),
            "is_winter_break":      int(m.is_winter_break),
            "is_working":           int(m.is_working),
            "hours_per_week":       m.hours_per_week or 10.0,
        }.items() if v is not None}
        for m in ordered
    ]
    next_months = [(m.year, m.month) for m in ordered]

    if not history:
        anchor = _compute_anchor(
            ordered[0].rent, ordered[0].tuition_due,
            ordered[0].scholarship_received,
            ordered[0].travel_home, ordered[0].travel_cost,
        )
        if anchor is None:
            raise HTTPException(
                status_code=422,
                detail="No transaction history and no spending data in request. Include at least rent in the first month.",
            )
        today = date.today()
        prev_mo = today.month - 1 or 12
        prev_yr = today.year if today.month > 1 else today.year - 1
        history, monthly_labels, cold_start = [anchor], [(prev_yr, prev_mo)], True

    return _execute(history, monthly_labels, future_covariates, next_months, prediction_months, cold_start)


@router.get("")
def run_forecast(
    prediction_months: int = Query(default=3, ge=1, le=12),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Run forecast using pre-saved ForecastContext rows."""
    return _run_from_db(current_user.id, prediction_months, db)


@router.get("/to-graduation")
def forecast_to_graduation(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Forecast through the user's graduation date (set in Settings)."""
    user: User = db.query(User).filter(User.id == current_user.id).first()
    if not user or not user.graduation_date:
        raise HTTPException(status_code=422, detail="Set your graduation date in Settings to enable this.")
    today = date.today()
    if user.graduation_date <= today:
        raise HTTPException(status_code=422, detail="Graduation date is in the past.")
    months_left = (user.graduation_date.year - today.year) * 12 + (user.graduation_date.month - today.month) + 1
    return _run_from_db(current_user.id, max(1, min(months_left, 60)), db, graduation_date=user.graduation_date)


# ---------------------------------------------------------------------------
# Shared execution — called by all three endpoints
# ---------------------------------------------------------------------------

def _execute(history, monthly_labels, future_covariates, next_months, prediction_months, cold_start, graduation_date=None) -> dict:
    ok, msg = chronos_model.has_enough_data(history)
    if not ok:
        raise HTTPException(status_code=422, detail=msg)
    if chronos_model._PIPELINE is None:
        raise HTTPException(status_code=503, detail="ML model is still loading — try again in a few seconds.")
    try:
        predictions = chronos_model.forecast(history=history, future_covariates=future_covariates, prediction_months=prediction_months)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    for pred, (yr, mo) in zip(predictions, next_months):
        pred["year"], pred["month"] = yr, mo

    warnings = []
    if msg:
        warnings.append(msg)
    if cold_start:
        warnings.append("No transaction history yet — forecast anchored on your Forecast Setup data. Accuracy improves once you log real expenses.")

    return {
        "history": [
            {"year": y, "month": m, "total": round(t, 2), "synthetic": cold_start and i == len(monthly_labels) - 1}
            for i, ((y, m), t) in enumerate(zip(monthly_labels, history))
        ],
        "predictions": predictions,
        "prediction_months": prediction_months,
        "graduation_date": graduation_date.isoformat() if graduation_date else None,
        "warnings": warnings,
    }


def _run_from_db(user_id, prediction_months: int, db: Session, graduation_date=None) -> dict:
    """Build all inputs from DB (history + ForecastContext covariates) then execute."""
    history, monthly_labels = _query_history(user_id, db)
    cold_start = False

    if not history:
        anchor, anchor_label = _cold_start_from_db(user_id, db)
        if anchor is not None:
            history, monthly_labels, cold_start = [anchor], [anchor_label], True

    if monthly_labels:
        last_yr, last_mo = monthly_labels[-1]
    else:
        today = date.today()
        last_yr, last_mo = today.year, today.month

    next_months: list[tuple] = []
    yr, mo = last_yr, last_mo
    for _ in range(prediction_months):
        mo += 1
        if mo > 12:
            mo, yr = 1, yr + 1
        next_months.append((yr, mo))

    future_covariates = [
        _ctx_to_dict(
            db.query(ForecastContext).filter(
                ForecastContext.user_id == user_id,
                ForecastContext.year == f_yr,
                ForecastContext.month == f_mo,
            ).first()
        )
        for f_yr, f_mo in next_months
    ]

    return _execute(history, monthly_labels, future_covariates, next_months, prediction_months, cold_start, graduation_date)


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _query_history(user_id, db: Session, limit: int | None = None) -> tuple[list[float], list[tuple]]:
    """Aggregate expense transactions into monthly USD totals (oldest first)."""
    rows = (
        db.query(
            extract("year",  Transaction.transaction_date).label("yr"),
            extract("month", Transaction.transaction_date).label("mo"),
            func.sum(func.coalesce(Transaction.amount_in_usd, Transaction.amount)).label("total"),
        )
        .filter(Transaction.user_id == user_id, Transaction.type == TransactionTypeEnum.EXPENSE)
        .group_by("yr", "mo")
        .order_by("yr", "mo")
        .all()
    )
    history = [float(r.total) for r in rows]
    labels  = [(int(r.yr), int(r.mo)) for r in rows]
    if limit and len(history) > limit:
        history, labels = history[-limit:], labels[-limit:]
    return history, labels


def _compute_anchor(rent, tuition_due, scholarship, travel_home, travel_cost) -> float | None:
    """
    Compute cold-start anchor from explicitly provided dollar amounts only.
    Returns None if result is zero (insufficient data).
    """
    anchor = (
        (rent or 0.0)
        + (tuition_due or 0.0)
        - (scholarship or 0.0)
        + ((travel_cost or 0.0) if travel_home else 0.0)
    )
    return round(anchor, 2) if anchor > 0 else None


def _cold_start_from_db(user_id, db: Session) -> tuple[float | None, tuple | None]:
    """Build cold-start anchor from the nearest saved ForecastContext row."""
    ctx = (
        db.query(ForecastContext)
        .filter(ForecastContext.user_id == user_id)
        .order_by(ForecastContext.year.desc(), ForecastContext.month.desc())
        .first()
    )
    if ctx is None:
        return None, None
    anchor = _compute_anchor(ctx.rent, ctx.tuition_due, ctx.scholarship_received, ctx.travel_home, ctx.travel_cost)
    if anchor is None:
        return None, None
    today = date.today()
    prev_mo = today.month - 1 or 12
    prev_yr = today.year if today.month > 1 else today.year - 1
    return anchor, (prev_yr, prev_mo)


def _ctx_to_dict(ctx) -> dict:
    """Convert a ForecastContext ORM row to a covariate dict for chronos_model."""
    if ctx is None:
        return {}
    return {
        "hours_per_week":       float(ctx.hours_per_week)       if ctx.hours_per_week       is not None else 10.0,
        "is_working":           int(ctx.is_working),
        "is_summer_break":      int(ctx.is_summer_break),
        "is_winter_break":      int(ctx.is_winter_break),
        "travel_home":          int(ctx.travel_home),
        "travel_cost":          float(ctx.travel_cost)          if ctx.travel_cost          else 0.0,
        "tuition_due":          float(ctx.tuition_due)          if ctx.tuition_due          else 0.0,
        "scholarship_received": float(ctx.scholarship_received) if ctx.scholarship_received else 0.0,
        "exchange_rate":        float(ctx.exchange_rate)         if ctx.exchange_rate         else 1.0,
        "health_insurance":     int(ctx.health_insurance),
        "rent":                 float(ctx.rent)                  if ctx.rent                  else 0.0,
    }